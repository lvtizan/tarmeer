"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.register = register;
exports.login = login;
exports.verifyEmail = verifyEmail;
exports.checkVerified = checkVerified;
exports.checkAvailability = checkAvailability;
exports.googleCallback = googleCallback;
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const database_1 = __importDefault(require("../config/database"));
const config_1 = __importDefault(require("../config"));
const emailService_1 = require("../services/emailService");
const notificationService_1 = require("../services/notificationService");
const slugify_1 = require("../lib/slugify");
const TEMP_EMAIL_DOMAINS = [
    'tempmail.com', 'guerrillamail.com', '10minutemail.com', 'throwaway.email',
    'mailinator.com', 'guerrillamailblock.com', 'sharklasers.com', 'grr.la',
    'pokemail.net', 'spam4.me'
];
function isTempEmail(email) {
    const domain = email.split('@')[1]?.toLowerCase();
    return TEMP_EMAIL_DOMAINS.includes(domain);
}
function generateSupplierToken(user) {
    return jsonwebtoken_1.default.sign({ supplierUserId: user.id, email: user.email, type: 'supplier' }, config_1.default.jwt.secret, { expiresIn: '7d' });
}
function sanitize(user) {
    const { password, verification_token, verification_expires, reset_token, reset_expires, ...safe } = user;
    return safe;
}
function resolveFrontendUrl(req) {
    if (config_1.default.nodeEnv === 'production')
        return config_1.default.frontendUrl;
    return req.headers.origin
        || req.headers.referer?.split('/').slice(0, 3).join('/')
        || config_1.default.frontendUrl || 'https://www.tarmeer.com';
}
async function register(req, res) {
    try {
        const { email, password, full_name, phone } = req.body;
        if (!email || !password)
            return res.status(400).json({ error: 'Email and password are required.' });
        if (isTempEmail(email)) {
            return res.status(400).json({ error: 'Temporary email addresses are not allowed.' });
        }
        const [existing] = await database_1.default.execute('SELECT id FROM supplier_users WHERE email = ? LIMIT 1', [email]);
        if (existing.length > 0) {
            return res.status(400).json({ error: 'This email is already registered.' });
        }
        // Also check users table to prevent confusion
        const [userExisting] = await database_1.default.execute('SELECT id FROM users WHERE email = ? LIMIT 1', [email]);
        if (userExisting.length > 0) {
            return res.status(400).json({ error: 'This email is registered as a homeowner/company account. Please use a different email.' });
        }
        const hashedPassword = await bcryptjs_1.default.hash(password, 10);
        const { token: verificationToken, expires: verificationExpires } = (0, emailService_1.generateVerificationToken)();
        const [result] = await database_1.default.execute(`INSERT INTO supplier_users (email, password, full_name, phone, verification_token, verification_expires)
       VALUES (?, ?, ?, ?, ?, ?)`, [email, hashedPassword, full_name || email.split('@')[0], phone || null, verificationToken, verificationExpires]);
        const userId = result.insertId;
        // Create supplier_profiles entry with status=pending
        const displayName = full_name || email.split('@')[0];
        const baseSlug = (0, slugify_1.slugify)(displayName) || `supplier-${userId}`;
        let slug = baseSlug;
        // Ensure slug uniqueness
        const [slugCheck] = await database_1.default.execute('SELECT id FROM supplier_profiles WHERE slug = ? LIMIT 1', [slug]);
        if (slugCheck.length > 0) {
            slug = `${baseSlug}-${userId}`;
        }
        // 按手机号前缀判定国家（与 companyProfileController 的 detectedCountry 规则一致）
        const rawPhone = phone || '';
        const detectedCountry = rawPhone.startsWith('+84') || rawPhone.startsWith('084') ? 'vn'
            : rawPhone.startsWith('+966') || rawPhone.startsWith('00966') ? 'sa'
                : 'ae';
        await database_1.default.execute(`INSERT INTO supplier_profiles (supplier_user_id, company_name, slug, status, contact_phone, country) VALUES (?, ?, ?, 'pending', ?, ?)`, [userId, displayName, slug, phone || null, detectedCountry]);
        const frontendUrl = resolveFrontendUrl(req);
        // Send verification email + admin notification (fire-and-forget)
        setImmediate(() => {
            (0, emailService_1.sendVerificationEmail)(email, displayName, verificationToken, frontendUrl).catch((err) => console.error('[supplier] Verification email failed:', err));
            (0, notificationService_1.notifySupplierRegistration)({ email, fullName: displayName, signupSource: 'supplier-email' }).catch(() => { });
        });
        res.status(201).json({
            message: 'Account created. Please check your email to verify.',
            user: { id: userId, email, full_name: displayName },
        });
    }
    catch (error) {
        console.error('Supplier register error:', error);
        res.status(500).json({ error: 'Registration failed.' });
    }
}
async function login(req, res) {
    try {
        const { email, password } = req.body;
        if (!email || !password)
            return res.status(400).json({ error: 'Email and password are required.' });
        const [rows] = await database_1.default.execute('SELECT * FROM supplier_users WHERE email = ? LIMIT 1', [email]);
        const user = rows[0];
        if (!user)
            return res.status(401).json({ error: 'Invalid email or password.' });
        if (!user.password)
            return res.status(401).json({ error: 'Please sign in with Google.' });
        const valid = await bcryptjs_1.default.compare(password, user.password);
        if (!valid)
            return res.status(401).json({ error: 'Invalid email or password.' });
        if (!user.email_verified) {
            return res.status(403).json({ error: 'Please verify your email before signing in.' });
        }
        const token = generateSupplierToken({ id: user.id, email: user.email });
        // Get profile if exists
        const [profileRows] = await database_1.default.execute('SELECT id, company_name, slug, status FROM supplier_profiles WHERE supplier_user_id = ? LIMIT 1', [user.id]);
        const profile = profileRows[0] || null;
        res.json({
            token,
            user: sanitize(user),
            profile,
        });
    }
    catch (error) {
        console.error('Supplier login error:', error);
        res.status(500).json({ error: 'Login failed.' });
    }
}
async function verifyEmail(req, res) {
    try {
        const { token } = req.body;
        if (!token)
            return res.status(400).json({ error: 'Token is required.' });
        const [rows] = await database_1.default.execute('SELECT * FROM supplier_users WHERE verification_token = ? AND verification_expires > NOW() LIMIT 1', [token]);
        if (rows.length === 0) {
            return res.status(400).json({ error: 'Verification link is invalid or has expired.' });
        }
        const user = rows[0];
        await database_1.default.execute('UPDATE supplier_users SET email_verified = 1, verification_token = NULL, verification_expires = NULL WHERE id = ?', [user.id]);
        const loginToken = generateSupplierToken({ id: user.id, email: user.email });
        res.json({ message: 'Email verified successfully.', token: loginToken, user: sanitize(user) });
    }
    catch (error) {
        console.error('Supplier verifyEmail error:', error);
        res.status(500).json({ error: 'Verification failed. Please try again.' });
    }
}
async function checkVerified(req, res) {
    try {
        const email = req.query.email;
        if (!email)
            return res.json({ verified: false });
        const [rows] = await database_1.default.execute('SELECT id, email, email_verified, full_name FROM supplier_users WHERE email = ? LIMIT 1', [email]);
        const user = rows[0];
        if (!user || !user.email_verified)
            return res.json({ verified: false });
        const token = generateSupplierToken({ id: user.id, email: user.email });
        res.json({ verified: true, token, user: { id: user.id, email: user.email, full_name: user.full_name } });
    }
    catch {
        res.json({ verified: false });
    }
}
async function checkAvailability(req, res) {
    try {
        const { email } = req.body;
        if (!email)
            return res.status(400).json({ error: 'Email is required.' });
        // Check if already a supplier
        const [supplierRows] = await database_1.default.execute('SELECT id FROM supplier_users WHERE email = ? LIMIT 1', [email]);
        if (supplierRows.length > 0) {
            return res.json({ isNewEmail: false });
        }
        // Check if email belongs to a homeowner/company account
        const [userRows] = await database_1.default.execute('SELECT id FROM users WHERE email = ? LIMIT 1', [email]);
        if (userRows.length > 0) {
            return res.json({ isNewEmail: false, conflict: 'homeowner' });
        }
        res.json({ isNewEmail: true });
    }
    catch (error) {
        console.error('Supplier check availability error:', error);
        res.status(500).json({ error: 'Check failed.' });
    }
}
async function googleCallback(req, res) {
    try {
        const profile = req.user;
        if (!profile)
            return res.redirect('/supplier/auth?error=google_failed');
        const email = profile.emails?.[0]?.value;
        const googleId = profile.id;
        const fullName = profile.displayName || '';
        const avatarUrl = profile.photos?.[0]?.value || '';
        if (!email)
            return res.redirect('/supplier/auth?error=no_email');
        // Check if google_id already exists
        const [existing] = await database_1.default.execute('SELECT * FROM supplier_users WHERE google_id = ? LIMIT 1', [googleId]);
        let user = existing[0];
        if (!user) {
            // Check by email
            const [byEmail] = await database_1.default.execute('SELECT * FROM supplier_users WHERE email = ? LIMIT 1', [email]);
            user = byEmail[0];
            if (user) {
                // Link google_id to existing account
                await database_1.default.execute('UPDATE supplier_users SET google_id = ?, avatar_url = COALESCE(avatar_url, ?), email_verified = 1 WHERE id = ?', [googleId, avatarUrl, user.id]);
            }
            else {
                // Ensure not in users table
                const [userTableCheck] = await database_1.default.execute('SELECT id FROM users WHERE email = ? LIMIT 1', [email]);
                if (userTableCheck.length > 0) {
                    return res.redirect('/supplier/auth?error=email_is_homeowner');
                }
                // Create new supplier user
                const [result] = await database_1.default.execute(`INSERT INTO supplier_users (email, full_name, google_id, avatar_url, email_verified)
           VALUES (?, ?, ?, ?, 1)`, [email, fullName, googleId, avatarUrl]);
                const [newUser] = await database_1.default.execute('SELECT * FROM supplier_users WHERE id = ?', [result.insertId]);
                user = newUser[0];
                setImmediate(() => {
                    (0, notificationService_1.notifySupplierRegistration)({ email, fullName: fullName || undefined, signupSource: 'supplier-google' }).catch(() => { });
                });
            }
        }
        const token = generateSupplierToken({ id: user.id, email: user.email });
        const frontendUrl = resolveFrontendUrl(req);
        res.redirect(`${frontendUrl}/supplier/auth/callback?token=${token}`);
    }
    catch (error) {
        console.error('Supplier Google callback error:', error);
        res.redirect('/supplier/auth?error=server_error');
    }
}
