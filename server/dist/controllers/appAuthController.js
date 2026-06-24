"use strict";
// App 鉴权（/api/v1/auth）—— App 专属，与 Web 的 /api/auth 完全隔离。
// access token（短，1h）+ refresh token（长，60d，仅存 sha256 哈希）。
// 轮换 + 重用检测：旧 refresh 被用过后再出现 → 视为泄露，吊销整个 family。
// 仅覆盖 user / supplier（App MVP 角色）。
// access token payload：
//   user     → {userId,email,role}，与 Web generateToken 一致，可访问 authenticate 保护的接口；
//   supplier → {supplierUserId,email,type:'supplier'}，与 authenticateSupplier 一致。
// ⚠️ 已知权衡（P1-3）：access 为无状态 JWT，签发后 1h 内无法吊销；封号/登出对 refresh 立即生效，
//    但已签发的 access 最长 1h 仍有效。高危操作如需即时失效需引入 jti 黑名单/tokenVersion（后续）。
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.appLogin = appLogin;
exports.appRefresh = appRefresh;
exports.appLogout = appLogout;
exports.ensureRefreshTokenTable = ensureRefreshTokenTable;
const crypto_1 = __importDefault(require("crypto"));
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const database_1 = __importDefault(require("../config/database"));
const config_1 = __importDefault(require("../config"));
const authRateLimit_1 = require("../middleware/authRateLimit");

const ACCESS_TTL = '1h';
const REFRESH_TTL_DAYS = 60;
const REFRESH_BYTES = 32; // 256-bit
// 固定假哈希：账号不存在/无密码时也跑一次 bcrypt，抹平时序侧信道（防账号枚举）
const DUMMY_HASH = bcryptjs_1.default.hashSync(crypto_1.default.randomBytes(16).toString('hex'), 10);

function sha256(s) {
    return crypto_1.default.createHash('sha256').update(s).digest('hex');
}
function newOpaqueToken() {
    return crypto_1.default.randomBytes(REFRESH_BYTES).toString('hex');
}
function newFamilyId() {
    return crypto_1.default.randomBytes(16).toString('hex');
}

let _tableReady = false;
async function ensureRefreshTokenTable() {
    if (_tableReady)
        return;
    await database_1.default.query(`
    CREATE TABLE IF NOT EXISTS app_refresh_tokens (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      subject_type ENUM('user','supplier') NOT NULL,
      subject_id BIGINT NOT NULL,
      token_hash CHAR(64) NOT NULL,
      family_id CHAR(32) NOT NULL,
      expires_at DATETIME NOT NULL,
      revoked_at DATETIME NULL,
      user_agent VARCHAR(255) NULL,
      ip VARCHAR(64) NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uk_token_hash (token_hash),
      KEY idx_subject (subject_type, subject_id),
      KEY idx_family (family_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
    _tableReady = true;
}

function signAccess(subjectType, subject) {
    if (subjectType === 'supplier') {
        return jsonwebtoken_1.default.sign({ supplierUserId: subject.id, email: subject.email, type: 'supplier' }, config_1.default.jwt.secret, { expiresIn: ACCESS_TTL });
    }
    return jsonwebtoken_1.default.sign({ userId: subject.id, email: subject.email, role: subject.role }, config_1.default.jwt.secret, { expiresIn: ACCESS_TTL });
}

async function issueRefresh(subjectType, subjectId, familyId, req) {
    const raw = newOpaqueToken();
    const hash = sha256(raw);
    const expires = new Date(Date.now() + REFRESH_TTL_DAYS * 24 * 60 * 60 * 1000);
    const ua = (req.headers['user-agent'] || '').slice(0, 255);
    const ip = (req.ip || '').slice(0, 64);
    await database_1.default.execute(`INSERT INTO app_refresh_tokens (subject_type, subject_id, token_hash, family_id, expires_at, user_agent, ip)
     VALUES (?, ?, ?, ?, ?, ?, ?)`, [subjectType, subjectId, hash, familyId, expires, ua, ip]);
    return raw;
}

function sanitizeUser(u) {
    const { password, verification_token, verification_expires, reset_token, reset_expires, profile_status, ...safe } = u;
    return safe;
}

async function revokeFamily(familyId) {
    await database_1.default.execute('UPDATE app_refresh_tokens SET revoked_at = NOW() WHERE family_id = ? AND revoked_at IS NULL', [familyId]);
}

// POST /api/v1/auth/login  { email, password }
// 防枚举：账号不存在 / OAuth 无密码 / 密码错 → 统一 401，且都跑一次 bcrypt（抹平时序）。
// 账号状态差异化提示（未验证/封禁）仅在密码正确后返回。
async function appLogin(req, res) {
    try {
        await ensureRefreshTokenTable();
        const { email, password } = req.body || {};
        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password are required.' });
        }
        // 1) 定位主体（先 users，再 supplier_users）
        let subjectType = null;
        let subject = null;
        const [uRows] = await database_1.default.execute('SELECT * FROM users WHERE email = ? AND deleted_at IS NULL LIMIT 1', [email]);
        if (uRows.length > 0) {
            subjectType = 'user';
            subject = uRows[0];
        }
        else {
            const [sRows] = await database_1.default.execute('SELECT * FROM supplier_users WHERE email = ? LIMIT 1', [email]);
            if (sRows.length > 0) {
                subjectType = 'supplier';
                subject = sRows[0];
            }
        }
        // 2) 恒定时间密码校验（不存在/无密码也跑一次 bcrypt）
        const storedHash = (subject && subject.password) ? subject.password : DUMMY_HASH;
        const passwordOk = await bcryptjs_1.default.compare(password, storedHash);
        if (!subjectType || !subject.password || !passwordOk) {
            (0, authRateLimit_1.recordAuthFailure)(req, res, () => { });
            return res.status(401).json({ error: 'Invalid email or password.' });
        }
        // 3) 密码正确后才返回状态相关提示
        if (subjectType === 'user' && subject.status === 'suspended') {
            return res.status(403).json({ error: 'Account suspended.' });
        }
        if (!subject.email_verified) {
            return res.status(401).json({ error: 'Please verify your email first.', needVerification: true, email: subject.email });
        }
        // 4) 签发 access + refresh
        (0, authRateLimit_1.recordAuthSuccess)(req, res, () => { });
        const familyId = newFamilyId();
        const refreshToken = await issueRefresh(subjectType, subject.id, familyId, req);
        return res.json({
            accessToken: signAccess(subjectType, subject),
            refreshToken,
            expiresIn: 3600,
            accountType: subjectType,
            user: sanitizeUser(subject),
        });
    }
    catch (err) {
        console.error('[appAuth] login error:', err.message);
        return res.status(500).json({ error: 'Login failed.' });
    }
}

// POST /api/v1/auth/refresh  { refreshToken }
async function appRefresh(req, res) {
    try {
        await ensureRefreshTokenTable();
        const { refreshToken } = req.body || {};
        if (!refreshToken || typeof refreshToken !== 'string')
            return res.status(400).json({ error: 'refreshToken is required.' });
        const hash = sha256(refreshToken);
        const [rows] = await database_1.default.execute('SELECT * FROM app_refresh_tokens WHERE token_hash = ? LIMIT 1', [hash]);
        if (rows.length === 0)
            return res.status(401).json({ error: 'Invalid refresh token.' });
        const row = rows[0];
        // 重用检测：已吊销的 refresh 再次出现 → 视为泄露，吊销整个 family
        if (row.revoked_at) {
            await revokeFamily(row.family_id);
            return res.status(401).json({ error: 'Refresh token reuse detected. Please log in again.' });
        }
        if (new Date(row.expires_at).getTime() < Date.now()) {
            return res.status(401).json({ error: 'Refresh token expired. Please log in again.' });
        }
        // 原子轮换：条件吊销，防并发/弱网重试竞态。affectedRows=0 表示已被并发请求抢先轮换，
        // 不触发 family 吊销（避免误把正常用户踢下线），让客户端重试。
        const [upd] = await database_1.default.execute('UPDATE app_refresh_tokens SET revoked_at = NOW() WHERE id = ? AND revoked_at IS NULL', [row.id]);
        if (!upd || upd.affectedRows === 0) {
            return res.status(401).json({ error: 'Refresh token already used. Please retry.' });
        }
        // 取主体并复查禁用状态（封号/删除后 refresh 立即失效）
        let subject;
        if (row.subject_type === 'user') {
            const [u] = await database_1.default.execute('SELECT * FROM users WHERE id = ? AND deleted_at IS NULL LIMIT 1', [row.subject_id]);
            if (u.length === 0) {
                await revokeFamily(row.family_id);
                return res.status(401).json({ error: 'Account not found.' });
            }
            subject = u[0];
            if (subject.status === 'suspended') {
                await revokeFamily(row.family_id);
                return res.status(403).json({ error: 'Account suspended.' });
            }
        }
        else {
            // supplier 禁用状态在 supplier_profiles.status（rejected=封禁）
            const [s] = await database_1.default.execute(`SELECT su.*, sp.status AS profile_status
                 FROM supplier_users su
                 LEFT JOIN supplier_profiles sp ON sp.supplier_user_id = su.id
                 WHERE su.id = ? LIMIT 1`, [row.subject_id]);
            if (s.length === 0) {
                await revokeFamily(row.family_id);
                return res.status(401).json({ error: 'Account not found.' });
            }
            subject = s[0];
            if (subject.profile_status === 'rejected') {
                await revokeFamily(row.family_id);
                return res.status(403).json({ error: 'Account suspended.' });
            }
        }
        const newRefresh = await issueRefresh(row.subject_type, row.subject_id, row.family_id, req);
        return res.json({
            accessToken: signAccess(row.subject_type, subject),
            refreshToken: newRefresh,
            expiresIn: 3600,
            accountType: row.subject_type,
            user: sanitizeUser(subject),
        });
    }
    catch (err) {
        console.error('[appAuth] refresh error:', err.message);
        return res.status(500).json({ error: 'Refresh failed.' });
    }
}

// POST /api/v1/auth/logout  { refreshToken }
async function appLogout(req, res) {
    try {
        await ensureRefreshTokenTable();
        const { refreshToken } = req.body || {};
        if (refreshToken && typeof refreshToken === 'string') {
            await database_1.default.execute('UPDATE app_refresh_tokens SET revoked_at = NOW() WHERE token_hash = ? AND revoked_at IS NULL', [sha256(refreshToken)]);
        }
        return res.json({ success: true });
    }
    catch (err) {
        console.error('[appAuth] logout error:', err.message);
        return res.status(500).json({ error: 'Logout failed.' });
    }
}
