// server/src/lib/oauthHandler.ts
import axios from 'axios';
import fs from 'fs/promises';
import path from 'path';
import pool from '../config/database';

interface OAuthProfile {
  id: string;
  email: string;
  displayName: string;
  photoUrl?: string;
  provider: 'google' | 'facebook';
}

interface DesignerResult {
  id: number;
  email: string;
  email_verified: boolean;
  full_name: string;
  avatar_url?: string;
  phone?: string;
  city?: string;
  user_id?: number;
}

const UPLOAD_DIR = path.join(process.cwd(), 'public', 'uploads', 'avatars');

// 确保上传目录存在
async function ensureUploadDir() {
  try {
    await fs.mkdir(UPLOAD_DIR, { recursive: true, mode: 0o755 });
  } catch (error) {
    console.error('Failed to create upload directory:', error);
  }
}

// 下载并保存头像
export async function downloadAvatar(
  url: string,
  designerId: number
): Promise<string | null> {
  try {
    await ensureUploadDir();

    const ext = url.includes('.png') ? '.png' : '.jpg';
    const filename = `${designerId}${ext}`;
    const filepath = path.join(UPLOAD_DIR, filename);

    // Validate URL to prevent SSRF
    if (!url.startsWith('https://')) {
      console.error('[avatar] Rejected non-HTTPS URL:', url);
      return null;
    }

    console.log('[avatar] Downloading from:', url);
    const response = await axios.get(url, {
      responseType: 'arraybuffer',
      timeout: 10000,
      maxRedirects: 3,
      maxContentLength: 5 * 1024 * 1024, // 5MB max
    });
    await fs.writeFile(filepath, Buffer.from(response.data), { mode: 0o644 });
    console.log('[avatar] Saved to:', filepath);

    return `/uploads/avatars/${filename}`;
  } catch (error) {
    console.error('Failed to download avatar:', error);
    return null;
  }
}

// 通过 OAuth ID 查找用户
export async function findDesignerByOAuthId(
  provider: 'google' | 'facebook',
  oauthId: string
): Promise<DesignerResult | null> {
  const field = provider === 'google' ? 'google_id' : 'facebook_id';

  const [rows] = await pool.execute(
    `SELECT id, email, email_verified, full_name, avatar_url
     FROM designers WHERE ${field} = ? AND deleted_at IS NULL`,
    [oauthId]
  );

  const designers = rows as DesignerResult[];
  return designers.length > 0 ? designers[0] : null;
}

// 通过邮箱查找用户
export async function findDesignerByEmail(
  email: string
): Promise<DesignerResult | null> {
  const [rows] = await pool.execute(
    `SELECT id, email, email_verified, full_name, avatar_url
     FROM designers WHERE email = ? AND deleted_at IS NULL`,
    [email]
  );

  const designers = rows as DesignerResult[];
  return designers.length > 0 ? designers[0] : null;
}

// 关联 OAuth ID 到已有账号
export async function linkOAuthToDesigner(
  designerId: number,
  provider: 'google' | 'facebook',
  oauthId: string
): Promise<void> {
  const field = provider === 'google' ? 'google_id' : 'facebook_id';

  await pool.execute(
    `UPDATE designers SET ${field} = ?, oauth_provider = ? WHERE id = ?`,
    [oauthId, provider, designerId]
  );
}

// 创建新的 OAuth 用户
export async function createOAuthDesigner(
  profile: OAuthProfile
): Promise<{ designer: DesignerResult; isNew: boolean; needsVerification: boolean }> {
  const { email, displayName, photoUrl, provider, id: oauthId } = profile;

  // 检查邮箱是否已存在
  const existing = await findDesignerByEmail(email);

  if (existing) {
    // Legacy: link OAuth ID to existing designer row (keep it working for old accounts)
    await linkOAuthToDesigner(existing.id, provider, oauthId);

    // Ensure user record exists in users table
    if (!existing.user_id) {
      const [existingUser] = await pool.execute('SELECT id FROM users WHERE email = ? LIMIT 1', [email]);
      let userId: number;
      if ((existingUser as any[]).length > 0) {
        userId = (existingUser as any[])[0].id;
      } else {
        const [ur] = await pool.execute(
          `INSERT INTO users (email, password, full_name, phone, city, role, status, email_verified)
           VALUES (?, '', ?, ?, ?, 'user', 'active', 1)`,
          [email, existing.full_name || displayName, existing.phone || '', existing.city || 'Dubai']
        );
        userId = (ur as any).insertId;
      }
      await pool.execute('UPDATE designers SET user_id = ? WHERE id = ?', [userId, existing.id]);
      existing.user_id = userId;
    }

    // Download avatar to users table
    if (photoUrl) {
      const avatarUrl = await downloadAvatar(photoUrl, existing.user_id || existing.id);
      if (avatarUrl) {
        await pool.execute('UPDATE users SET avatar_url = ? WHERE id = ?', [avatarUrl, existing.user_id]);
        existing.avatar_url = avatarUrl;
      }
    }

    return {
      designer: existing,
      isNew: false,
      needsVerification: !existing.email_verified,
    };
  }

  // Create new user in users table only (no designers table)
  const [userResult] = await pool.execute(
    `INSERT INTO users (email, password, full_name, phone, city, avatar_url, role, status, email_verified)
     VALUES (?, '', ?, '', 'Dubai', ?, 'user', 'active', 1)`,
    [email, displayName, photoUrl || null]
  );
  const userId = (userResult as any).insertId;

  // Download avatar using user ID
  let savedAvatarUrl = photoUrl || null;
  if (photoUrl) {
    const avatarUrl = await downloadAvatar(photoUrl, userId);
    if (avatarUrl) {
      await pool.execute('UPDATE users SET avatar_url = ? WHERE id = ?', [avatarUrl, userId]);
      savedAvatarUrl = avatarUrl;
    }
  }

  return {
    designer: {
      id: userId,
      email,
      email_verified: true,
      full_name: displayName,
      avatar_url: savedAvatarUrl || undefined,
      user_id: userId,
    } as DesignerResult,
    isNew: true,
    needsVerification: false,
  };
}
