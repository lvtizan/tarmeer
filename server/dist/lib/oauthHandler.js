"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.downloadAvatar = downloadAvatar;
exports.findDesignerByOAuthId = findDesignerByOAuthId;
exports.findDesignerByEmail = findDesignerByEmail;
exports.linkOAuthToDesigner = linkOAuthToDesigner;
exports.createOAuthDesigner = createOAuthDesigner;
// server/src/lib/oauthHandler.ts
const axios_1 = __importDefault(require("axios"));
const promises_1 = __importDefault(require("fs/promises"));
const path_1 = __importDefault(require("path"));
const database_1 = __importDefault(require("../config/database"));
const variantWorker_1 = require("./variantWorker");
const UPLOAD_DIR = path_1.default.join(process.cwd(), 'public', 'uploads', 'avatars');
// 确保上传目录存在
async function ensureUploadDir() {
    try {
        await promises_1.default.mkdir(UPLOAD_DIR, { recursive: true, mode: 0o755 });
    }
    catch (error) {
        console.error('Failed to create upload directory:', error);
    }
}
// 下载并保存头像
async function downloadAvatar(url, designerId) {
    try {
        await ensureUploadDir();
        const ext = url.includes('.png') ? '.png' : '.jpg';
        const filename = `${designerId}${ext}`;
        const filepath = path_1.default.join(UPLOAD_DIR, filename);
        // Validate URL to prevent SSRF
        if (!url.startsWith('https://')) {
            console.error('[avatar] Rejected non-HTTPS URL:', url);
            return null;
        }
        console.log('[avatar] Downloading from:', url);
        const response = await axios_1.default.get(url, {
            responseType: 'arraybuffer',
            timeout: 10000,
            maxRedirects: 3,
            maxContentLength: 5 * 1024 * 1024, // 5MB max
        });
        await promises_1.default.writeFile(filepath, Buffer.from(response.data), { mode: 0o644 });
        (0, variantWorker_1.enqueueVariants)(filepath);
        console.log('[avatar] Saved to:', filepath);
        return `/uploads/avatars/${filename}`;
    }
    catch (error) {
        console.error('Failed to download avatar:', error);
        return null;
    }
}
// 通过 OAuth ID 查找用户
async function findDesignerByOAuthId(provider, oauthId) {
    const field = provider === 'google' ? 'google_id' : 'facebook_id';
    const [rows] = await database_1.default.execute(`SELECT id, email, email_verified, full_name, avatar_url
     FROM designers WHERE ${field} = ? AND deleted_at IS NULL`, [oauthId]);
    const designers = rows;
    return designers.length > 0 ? designers[0] : null;
}
// 通过邮箱查找用户
async function findDesignerByEmail(email) {
    const [rows] = await database_1.default.execute(`SELECT id, email, email_verified, full_name, avatar_url
     FROM designers WHERE email = ? AND deleted_at IS NULL`, [email]);
    const designers = rows;
    return designers.length > 0 ? designers[0] : null;
}
// 关联 OAuth ID 到已有账号
async function linkOAuthToDesigner(designerId, provider, oauthId) {
    const field = provider === 'google' ? 'google_id' : 'facebook_id';
    await database_1.default.execute(`UPDATE designers SET ${field} = ?, oauth_provider = ? WHERE id = ?`, [oauthId, provider, designerId]);
}
// 创建新的 OAuth 用户
async function createOAuthDesigner(profile) {
    const { email, displayName, photoUrl, provider, id: oauthId } = profile;
    // 检查邮箱是否已存在
    const existing = await findDesignerByEmail(email);
    if (existing) {
        // Legacy: link OAuth ID to existing designer row (keep it working for old accounts)
        await linkOAuthToDesigner(existing.id, provider, oauthId);
        // Ensure user record exists in users table
        if (!existing.user_id) {
            const [existingUser] = await database_1.default.execute('SELECT id FROM users WHERE email = ? LIMIT 1', [email]);
            let userId;
            if (existingUser.length > 0) {
                userId = existingUser[0].id;
            }
            else {
                const [ur] = await database_1.default.execute(`INSERT INTO users (email, password, full_name, phone, city, role, status, email_verified)
           VALUES (?, '', ?, ?, ?, 'user', 'active', 1)`, [email, existing.full_name || displayName, existing.phone || '', existing.city || 'Dubai']);
                userId = ur.insertId;
            }
            await database_1.default.execute('UPDATE designers SET user_id = ? WHERE id = ?', [userId, existing.id]);
            existing.user_id = userId;
        }
        // Download avatar to users table
        if (photoUrl) {
            const avatarUrl = await downloadAvatar(photoUrl, existing.user_id || existing.id);
            if (avatarUrl) {
                await database_1.default.execute('UPDATE users SET avatar_url = ? WHERE id = ?', [avatarUrl, existing.user_id]);
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
    const [userResult] = await database_1.default.execute(`INSERT INTO users (email, password, full_name, phone, city, avatar_url, role, status, email_verified)
     VALUES (?, '', ?, '', 'Dubai', ?, 'user', 'active', 1)`, [email, displayName, photoUrl || null]);
    const userId = userResult.insertId;
    // Download avatar using user ID
    let savedAvatarUrl = photoUrl || null;
    if (photoUrl) {
        const avatarUrl = await downloadAvatar(photoUrl, userId);
        if (avatarUrl) {
            await database_1.default.execute('UPDATE users SET avatar_url = ? WHERE id = ?', [avatarUrl, userId]);
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
        },
        isNew: true,
        needsVerification: false,
    };
}
