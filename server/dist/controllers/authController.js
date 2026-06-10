"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.checkAvailability = checkAvailability;
exports.register = register;
exports.verifyEmail = verifyEmail;
exports.resendVerification = resendVerification;
exports.login = login;
exports.forgotPassword = forgotPassword;
exports.resetPassword = resetPassword;
exports.getMe = getMe;
exports.oauthCallback = oauthCallback;
exports.googleOneTap = googleOneTap;
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const axios_1 = __importDefault(require("axios"));
const database_1 = __importDefault(require("../config/database"));
const config_1 = __importDefault(require("../config"));
const emailService_1 = require("../services/emailService");
const registerEmailPolicy_1 = require("../lib/registerEmailPolicy");
const registrationAvailability_1 = require("../lib/registrationAvailability");
const authRateLimit_1 = require("../middleware/authRateLimit");
const oauthHandler_1 = require("../lib/oauthHandler");
const TEMP_EMAIL_DOMAINS = [
    'tempmail.com',
    'guerrillamail.com',
    '10minutemail.com',
    'throwaway.email',
    'mailinator.com',
    'guerrillamailblock.com',
    'sharklasers.com',
    'grr.la',
    'pokemail.net',
    'spam4.me'
];
function isTempEmail(email) {
    const domain = email.split('@')[1]?.toLowerCase();
    return TEMP_EMAIL_DOMAINS.includes(domain);
}
function normalizeCity(city) {
    if (!city)
        return null;
    return city
        .trim()
        .split(/[\s-]+/)
        .filter(Boolean)
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
        .join(' ');
}
function sanitizeDesignerSession(designer) {
    if (!designer)
        return designer;
    const { password, verification_token, verification_expires, reset_token, reset_expires, ...safeDesigner } = designer;
    return safeDesigner;
}
function resolveFrontendUrl(req) {
    if (config_1.default.nodeEnv === 'production') {
        return config_1.default.frontendUrl;
    }
    return req.headers.origin
        || req.headers.referer?.split('/').slice(0, 3).join('/')
        || config_1.default.frontendUrl
        || 'https://www.tarmeer.com';
}
async function checkExistingDesignerFields(email, phone) {
    const normalizedPhone = phone?.trim();
    const checks = await Promise.all([
        email
            ? database_1.default.execute(`SELECT id FROM designers
           WHERE email = ? AND email_verified = 1
           AND (user_id IS NULL OR EXISTS (
             SELECT 1 FROM users WHERE id = designers.user_id AND deleted_at IS NULL
           ))
           UNION
           SELECT id FROM users WHERE email = ? AND deleted_at IS NULL
           UNION
           SELECT id FROM supplier_users WHERE email = ? AND email_verified = 1
           LIMIT 1`, [email, email, email])
            : Promise.resolve([[]]),
        normalizedPhone
            ? database_1.default.execute('SELECT id FROM designers WHERE phone = ? LIMIT 1', [normalizedPhone])
            : Promise.resolve([[]]),
    ]);
    const [emailRows, phoneRows] = checks.map((entry) => entry[0]);
    return (0, registrationAvailability_1.buildRegistrationAvailabilityResult)({
        emailExists: emailRows.length > 0,
        phoneExists: phoneRows.length > 0,
    });
}
async function checkAvailability(req, res) {
    try {
        const { email, phone } = req.body;
        const availability = await checkExistingDesignerFields(email, phone);
        res.json(availability);
    }
    catch (error) {
        console.error('Registration availability error:', error);
        res.status(500).json({ error: 'Failed to check registration availability.' });
    }
}
async function register(req, res) {
    try {
        const { email, password, fullName, full_name, phone, city } = req.body;
        const name = fullName || full_name;
        if (isTempEmail(email)) {
            return res.status(400).json({ error: 'Temporary email addresses are not allowed. Please use a valid email.' });
        }
        const availability = await checkExistingDesignerFields(email, phone || null);
        if (availability.error) {
            return res.status(400).json({ error: availability.error });
        }
        const hashedPassword = await bcryptjs_1.default.hash(password, 10);
        const { token: verificationToken, expires: verificationExpires } = (0, emailService_1.generateVerificationToken)();
        const [result] = await database_1.default.execute('INSERT INTO designers (email, password, full_name, phone, city, verification_token, verification_expires, status, is_approved) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)', [email, hashedPassword, name, phone || null, normalizeCity(city), verificationToken, verificationExpires, 'pending', 0]);
        const designerId = result.insertId;
        const [designer] = await database_1.default.execute('SELECT * FROM designers WHERE id = ?', [designerId]);
        const newDesigner = designer[0];
        const smtpConfigured = Boolean(config_1.default.smtp.user && config_1.default.smtp.pass);
        // 从请求中动态获取前端域名（优先使用请求头的 origin）
        const frontendUrl = resolveFrontendUrl(req);
        let verificationSent = false;
        if (smtpConfigured) {
            try {
                const sendResult = await (0, emailService_1.sendVerificationEmail)(email, name, verificationToken, frontendUrl);
                const mailInfo = sendResult;
                verificationSent = true;
                console.log(`[SMTP] Verification email sent to ${email}`, {
                    messageId: mailInfo?.messageId,
                    response: mailInfo?.response,
                    accepted: mailInfo?.accepted,
                    rejected: mailInfo?.rejected,
                });
            }
            catch (emailError) {
                console.error('[SMTP] Verification email failed:', emailError?.message || emailError);
                if (emailError?.response)
                    console.error('[SMTP] Response:', emailError.response);
            }
            // Designer registration notification removed — designers now register as 装企
        }
        else {
            console.warn('[SMTP] Not configured: set SMTP_USER and SMTP_PASS in .env on server, then pm2 restart tarmeer-api');
            verificationSent = false;
        }
        const emailStatus = (0, registerEmailPolicy_1.buildRegisterEmailStatus)({
            verificationSent,
            notificationQueued: smtpConfigured,
        });
        res.status(201).json({
            message: emailStatus.message,
            email,
            emailSent: emailStatus.emailSent,
        });
    }
    catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ error: 'Registration failed. Please try again or contact support.' });
    }
}
async function verifyEmail(req, res) {
    try {
        const { token } = req.body;
        const [designer] = await database_1.default.execute('SELECT * FROM designers WHERE verification_token = ? AND verification_expires > NOW()', [token]);
        if (designer.length === 0) {
            return res.status(400).json({ error: 'Verification link is invalid or has expired.' });
        }
        const user = designer[0];
        if (user.deleted_at) {
            return res.status(400).json({ error: 'Verification link is invalid or has expired.' });
        }
        await database_1.default.execute('UPDATE designers SET email_verified = TRUE, verification_token = NULL, verification_expires = NULL WHERE id = ?', [user.id]);
        const loginToken = jsonwebtoken_1.default.sign({ id: user.id, email: user.email }, config_1.default.jwt.secret, { expiresIn: '7d' });
        res.json({
            message: 'Email verified successfully.',
            token: loginToken,
            designer: sanitizeDesignerSession({
                ...user,
                email_verified: true,
                verification_token: null,
                verification_expires: null
            })
        });
    }
    catch (error) {
        console.error('Verification error:', error);
        res.status(500).json({ error: 'Verification failed. Please try again.' });
    }
}
async function resendVerification(req, res) {
    try {
        const { email } = req.body;
        const [designer] = await database_1.default.execute('SELECT * FROM designers WHERE email = ? AND email_verified = FALSE', [email]);
        if (designer.length === 0) {
            return res.status(400).json({ error: 'Email not found or already verified.' });
        }
        const user = designer[0];
        if (user.deleted_at) {
            return res.status(400).json({ error: 'Email not found or already verified.' });
        }
        const { token: verificationToken, expires: verificationExpires } = (0, emailService_1.generateVerificationToken)();
        await database_1.default.execute('UPDATE designers SET verification_token = ?, verification_expires = ? WHERE id = ?', [verificationToken, verificationExpires, user.id]);
        // 从请求中动态获取前端域名
        const frontendUrl = resolveFrontendUrl(req);
        const sendResult = await (0, emailService_1.sendVerificationEmail)(email, user.full_name, verificationToken, frontendUrl);
        const mailInfo = sendResult;
        console.log(`[SMTP] Verification email resent to ${email}`, {
            messageId: mailInfo?.messageId,
            response: mailInfo?.response,
            accepted: mailInfo?.accepted,
            rejected: mailInfo?.rejected,
        });
        res.json({ message: 'Verification email sent. Please check your inbox.' });
    }
    catch (error) {
        console.error('Resend verification error:', error);
        res.status(500).json({ error: 'Failed to send verification email. Please try again.' });
    }
}
async function login(req, res) {
    try {
        const { email, password } = req.body;
        const [designer] = await database_1.default.execute('SELECT * FROM designers WHERE email = ?', [email]);
        if (designer.length === 0) {
            (0, authRateLimit_1.recordAuthFailure)(req, res, () => { }); // 记录失败尝试
            return res.status(401).json({ error: 'Invalid email or password.' });
        }
        const user = designer[0];
        if (user.deleted_at) {
            return res.status(403).json({ error: 'Designer account is deleted.' });
        }
        if (!user.email_verified) {
            return res.status(401).json({
                error: 'Please verify your email address first.',
                needVerification: true,
                email: user.email
            });
        }
        const isValid = await bcryptjs_1.default.compare(password, user.password);
        if (!isValid) {
            (0, authRateLimit_1.recordAuthFailure)(req, res, () => { }); // 记录失败尝试
            return res.status(401).json({ error: 'Invalid email or password.' });
        }
        // 登录成功，清除失败尝试记录
        (0, authRateLimit_1.recordAuthSuccess)(req, res, () => { });
        const token = jsonwebtoken_1.default.sign({ id: user.id, email: user.email }, config_1.default.jwt.secret, { expiresIn: '7d' });
        res.json({
            token,
            designer: sanitizeDesignerSession(user)
        });
    }
    catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Login failed. Please try again.' });
    }
}
// 忘记密码 - 发送重置邮件
async function forgotPassword(req, res) {
    try {
        const { email } = req.body;
        const [designer] = await database_1.default.execute('SELECT * FROM designers WHERE email = ?', [email]);
        // 无论用户是否存在，都返回成功（安全考虑，不泄露用户信息）
        if (designer.length === 0) {
            return res.json({ message: 'If that email is registered, you will receive a password reset link.' });
        }
        const user = designer[0];
        if (user.deleted_at) {
            return res.status(400).json({ error: 'Designer account is deleted.' });
        }
        const { token, expires } = (0, emailService_1.generatePasswordResetToken)();
        await database_1.default.execute('UPDATE designers SET reset_token = ?, reset_expires = ? WHERE id = ?', [token, expires, user.id]);
        // 从请求中动态获取前端域名
        const frontendUrl = resolveFrontendUrl(req);
        // 异步发送邮件
        setImmediate(async () => {
            try {
                const sendResult = await (0, emailService_1.sendPasswordResetEmail)(email, token, frontendUrl);
                const mailInfo = sendResult;
                console.log(`[SMTP] Password reset email sent to ${email}`, {
                    messageId: mailInfo?.messageId,
                    response: mailInfo?.response,
                    accepted: mailInfo?.accepted,
                    rejected: mailInfo?.rejected,
                });
            }
            catch (emailError) {
                console.error('[SMTP] Password reset email failed:', emailError?.message || emailError);
            }
        });
        res.json({ message: 'If that email is registered, you will receive a password reset link.' });
    }
    catch (error) {
        console.error('Forgot password error:', error);
        res.status(500).json({ error: 'Failed to process request. Please try again.' });
    }
}
// 重置密码
async function resetPassword(req, res) {
    try {
        const { token, password } = req.body;
        if (!password || password.length < 6) {
            return res.status(400).json({ error: 'Password must be at least 6 characters.' });
        }
        const [designer] = await database_1.default.execute('SELECT * FROM designers WHERE reset_token = ? AND reset_expires > NOW()', [token]);
        if (designer.length === 0) {
            return res.status(400).json({ error: 'Reset link is invalid or has expired.' });
        }
        const user = designer[0];
        if (user.deleted_at) {
            return res.status(400).json({ error: 'Reset link is invalid or has expired.' });
        }
        const hashedPassword = await bcryptjs_1.default.hash(password, 10);
        await database_1.default.execute('UPDATE designers SET password = ?, reset_token = NULL, reset_expires = NULL WHERE id = ?', [hashedPassword, user.id]);
        // 自动登录
        const loginToken = jsonwebtoken_1.default.sign({ id: user.id, email: user.email }, config_1.default.jwt.secret, { expiresIn: '7d' });
        res.json({
            message: 'Password reset successfully.',
            token: loginToken,
            designer: sanitizeDesignerSession({
                ...user,
                reset_token: null,
                reset_expires: null
            })
        });
    }
    catch (error) {
        console.error('Reset password error:', error);
        res.status(500).json({ error: 'Failed to reset password. Please try again.' });
    }
}
// 获取当前用户信息
async function getMe(req, res) {
    try {
        const [rows] = await database_1.default.execute('SELECT * FROM designers WHERE id = ? AND deleted_at IS NULL', [req.user.id]);
        const designers = rows;
        if (designers.length === 0) {
            return res.status(404).json({ error: 'Designer not found.' });
        }
        res.json({ designer: sanitizeDesignerSession(designers[0]) });
    }
    catch (error) {
        console.error('Get me error:', error);
        res.status(500).json({ error: 'Failed to get user info.' });
    }
}
// OAuth 回调处理
async function oauthCallback(req, res) {
    const frontendUrl = config_1.default.frontendUrl || 'http://localhost:5173';
    try {
        const user = req.user;
        if (!user) {
            return res.redirect(`${frontendUrl}/auth?error=oauth_failed`);
        }
        // 如果是已有账号通过 OAuth 关联但邮箱未验证，自动验证
        if (!user.email_verified) {
            await database_1.default.execute('UPDATE designers SET email_verified = TRUE WHERE id = ?', [user.id]);
        }
        // 生成 JWT token
        const token = jsonwebtoken_1.default.sign({ id: user.id, email: user.email }, config_1.default.jwt.secret, { expiresIn: '7d' });
        // 重定向到前端，携带 token
        res.redirect(`${frontendUrl}/auth/callback?token=${token}&provider=oauth`);
    }
    catch (error) {
        console.error('OAuth callback error:', error);
        res.redirect(`${frontendUrl}/auth?error=oauth_error`);
    }
}
// Google One Tap 登录
async function googleOneTap(req, res) {
    try {
        const { credential } = req.body;
        if (!credential) {
            return res.status(400).json({ error: 'Missing credential' });
        }
        // 用 Google tokeninfo 端点验证 ID Token
        const tokenInfoUrl = `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(credential)}`;
        const { data: payload } = await axios_1.default.get(tokenInfoUrl, { timeout: 5000 });
        // 验证 audience（client_id）
        if (payload.aud !== config_1.default.oauth.google.clientId) {
            console.error('[GoogleOneTap] Invalid audience:', payload.aud);
            return res.status(401).json({ error: 'Invalid token audience' });
        }
        // 验证 issuer
        if (!['accounts.google.com', 'https://accounts.google.com'].includes(payload.iss)) {
            console.error('[GoogleOneTap] Invalid issuer:', payload.iss);
            return res.status(401).json({ error: 'Invalid token issuer' });
        }
        const googleId = payload.sub;
        const email = payload.email;
        const name = payload.name || payload.email?.split('@')[0] || 'Designer';
        const picture = payload.picture || '';
        if (!email) {
            return res.status(400).json({ error: 'Email not available from Google' });
        }
        // 查找或创建用户（复用现有 OAuth 逻辑）
        let designer = await (0, oauthHandler_1.findDesignerByOAuthId)('google', googleId);
        if (!designer) {
            const result = await (0, oauthHandler_1.createOAuthDesigner)({
                id: googleId,
                email,
                displayName: name,
                photoUrl: picture,
                provider: 'google',
            });
            designer = result.designer;
        }
        // Resolve to users table — all JWTs must use new format { userId }
        let userId = designer.user_id;
        if (!userId) {
            const [userRows] = await database_1.default.execute('SELECT id FROM users WHERE email = ? LIMIT 1', [email]);
            userId = userRows[0]?.id;
        }
        if (!userId) {
            return res.status(500).json({ error: 'Failed to resolve user account.' });
        }
        // 生成新格式 JWT（auth 中间件走 users 表路径）
        const [userRow] = await database_1.default.execute('SELECT id, email, role FROM users WHERE id = ?', [userId]);
        const user = userRow[0];
        const token = jsonwebtoken_1.default.sign({ userId: user.id, email: user.email, role: user.role }, config_1.default.jwt.secret, { expiresIn: '7d' });
        console.log(`[GoogleOneTap] Login success: ${user.email} (userId=${user.id})`);
        res.json({ token });
    }
    catch (error) {
        // Google tokeninfo 返回 400 表示 token 无效
        if (error.response?.status === 400) {
            return res.status(401).json({ error: 'Invalid Google credential' });
        }
        console.error('[GoogleOneTap] Error:', error.message || error);
        res.status(500).json({ error: 'One Tap login failed' });
    }
}
