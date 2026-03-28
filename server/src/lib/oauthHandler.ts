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
}

const UPLOAD_DIR = path.join(process.cwd(), 'public', 'uploads', 'avatars');

// 确保上传目录存在
async function ensureUploadDir() {
  try {
    await fs.mkdir(UPLOAD_DIR, { recursive: true });
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

    console.log('[avatar] Downloading from:', url);
    const { execSync } = require('child_process');
    const proxyEnv = process.env.HTTPS_PROXY || process.env.https_proxy;
    const proxyArg = proxyEnv ? `-x ${proxyEnv}` : '';
    execSync(`curl ${proxyArg} -sL --create-dirs -o "${filepath}" --max-time 10 "${url}"`);
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
    // 关联 OAuth ID
    await linkOAuthToDesigner(existing.id, provider, oauthId);

    // 下载头像
    if (photoUrl) {
      const avatarUrl = await downloadAvatar(photoUrl, existing.id);
      if (avatarUrl) {
        await pool.execute(
          'UPDATE designers SET avatar_url = ? WHERE id = ?',
          [avatarUrl, existing.id]
        );
        existing.avatar_url = avatarUrl;
      }
    }

    return {
      designer: existing,
      isNew: false,
      needsVerification: !existing.email_verified,
    };
  }

  // 创建新用户（OAuth 登录邮箱已由提供商验证，自动设为 verified）
  const field = provider === 'google' ? 'google_id' : 'facebook_id';

  const [result] = await pool.execute(
    `INSERT INTO designers
     (email, full_name, ${field}, oauth_provider, email_verified, status, is_approved, city)
     VALUES (?, ?, ?, ?, TRUE, ?, ?, ?)`,
    [
      email,
      displayName,
      oauthId,
      provider,
      'pending',
      0,
      'Dubai',
    ]
  );

  const designerId = (result as any).insertId;

  // 下载头像（用真实 ID，避免竞态条件）
  if (photoUrl) {
    const avatarUrl = await downloadAvatar(photoUrl, designerId);
    if (avatarUrl) {
      await pool.execute(
        'UPDATE designers SET avatar_url = ? WHERE id = ?',
        [avatarUrl, designerId]
      );
    }
  }

  const [designer] = await pool.execute(
    'SELECT id, email, email_verified, full_name, avatar_url FROM designers WHERE id = ?',
    [designerId]
  );

  return {
    designer: (designer as DesignerResult[])[0],
    isNew: true,
    needsVerification: false,
  };
}
