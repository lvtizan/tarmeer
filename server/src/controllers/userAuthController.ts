import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import axios from 'axios';
import pool from '../config/database';
import config from '../config';
import { sendVerificationEmail, generateVerificationToken, sendPasswordResetEmail, sendAdminPasswordResetEmail, generatePasswordResetToken } from '../services/emailService';
import { notifyUserRegistration } from '../services/notificationService';
import { recordAuthFailure, recordAuthSuccess } from '../middleware/authRateLimit';
import { logActivity, getClientIp } from '../lib/activityLogger';

const TEMP_EMAIL_DOMAINS = [
  'tempmail.com', 'guerrillamail.com', '10minutemail.com', 'throwaway.email',
  'mailinator.com', 'guerrillamailblock.com', 'sharklasers.com', 'grr.la',
  'pokemail.net', 'spam4.me'
];

function isTempEmail(email: string): boolean {
  const domain = email.split('@')[1]?.toLowerCase();
  return TEMP_EMAIL_DOMAINS.includes(domain);
}

function normalizeCity(city?: string | null): string | null {
  if (!city) return null;
  return city.trim().split(/[\s-]+/).filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ');
}

function sanitizeUser(user: any) {
  if (!user) return user;
  const { password, verification_token, verification_token_expires, reset_token, reset_token_expires, ...safe } = user;
  return safe;
}

function resolveFrontendUrl(req: any): string {
  if (config.nodeEnv === 'production') return config.frontendUrl;
  return req.headers.origin
    || req.headers.referer?.split('/').slice(0, 3).join('/')
    || config.frontendUrl || 'https://www.tarmeer.com';
}

function generateToken(user: { id: number; email: string; role: string }) {
  return jwt.sign(
    { userId: user.id, email: user.email, role: user.role },
    config.jwt.secret,
    { expiresIn: '7d' }
  );
}

async function getLinkedDesignerPayload(user: { id: number; email: string }) {
  // Look up company_profile for this user instead of legacy designers table
  const [rows] = await pool.execute(
    `SELECT id, company_name as full_name, phone, city, description as bio, logo_url as avatar_url, status, created_at, updated_at
     FROM company_profiles
     WHERE user_id = ? AND deleted_at IS NULL`,
    [user.id]
  );

  const profile = (rows as any[])[0];
  if (!profile) {
    return null;
  }

  // Map to the shape the frontend expects (designer-like payload)
  return {
    id: profile.id,
    email: user.email,
    full_name: profile.full_name,
    title: '',
    phone: profile.phone,
    city: profile.city,
    address: null,
    bio: profile.bio,
    avatar_url: profile.avatar_url,
    style: null,
    expertise: [],
    status: profile.status,
    is_approved: profile.status === 'approved' ? 1 : 0,
    email_verified: 1,
    display_order: 0,
    created_at: profile.created_at,
    updated_at: profile.updated_at,
  };
}

// Register a new user (role = 'user' by default)
export async function register(req: any, res: any) {
  try {
    const { email, password, fullName, full_name, phone, city, role: requestedRole, signup_source } = req.body;
    const name = fullName || full_name || email.split('@')[0];
    const source = typeof signup_source === 'string' ? signup_source.slice(0, 64) : null;
    const validRoles = ['homeowner', 'company'];
    const assignRole = validRoles.includes(requestedRole) ? requestedRole : null;

    if (isTempEmail(email)) {
      return res.status(400).json({ error: 'Temporary email addresses are not allowed. Please use a valid email.' });
    }

    // Check if email already exists in users table
    const [existing] = await pool.execute('SELECT id FROM users WHERE email = ? LIMIT 1', [email]);
    if ((existing as any[]).length > 0) {
      return res.status(400).json({ error: 'This email is already registered.' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const { token: verificationToken, expires: verificationExpires } = generateVerificationToken();

    const [result] = await pool.execute(
      `INSERT INTO users (email, password, full_name, phone, city, verification_token, verification_token_expires, role, active_role, onboarding_completed, status, signup_source)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?)`,
      [email, hashedPassword, name, phone || null, normalizeCity(city), verificationToken, verificationExpires,
       assignRole || 'user', assignRole || null, assignRole ? 1 : 0, source]
    );

    const userId = (result as any).insertId;

    setImmediate(() => {
      logActivity({
        userId, userName: name, userRole: assignRole || 'homeowner',
        action: 'register', targetType: 'user', targetId: userId, description: '注册账号',
        ip: getClientIp(req),
      }).catch(() => {});
    });

    const frontendUrl = resolveFrontendUrl(req);
    const smtpConfigured = Boolean(config.smtp.user && config.smtp.pass);

    let verificationSent = false;
    if (smtpConfigured) {
      try {
        await sendVerificationEmail(email, name, verificationToken, frontendUrl);
        verificationSent = true;
      } catch (emailError: any) {
        console.error('[SMTP] Verification email failed:', emailError?.message || emailError);
      }
    }

    // Backfill company_leads.email so getProfile can match by email when phone is missing
    if (assignRole === 'company' && phone) {
      pool.execute(
        'UPDATE company_leads SET email = ? WHERE phone = ? AND email IS NULL ORDER BY created_at DESC LIMIT 1',
        [email, phone]
      ).catch(() => {});
    }

    // Notify admins of new user registration (skip 'company' role — handled by profile creation)
    if ((assignRole || 'user') !== 'company') {
      setImmediate(() => {
        notifyUserRegistration({
          email,
          fullName: name,
          phone: phone || null,
          city: city || null,
          role: assignRole || 'user',
          signupSource: source,
        }).catch(() => {});
      });
    }

    res.status(201).json({
      message: verificationSent
        ? 'Registration successful! Please check your email to verify your account.'
        : 'Registration successful! Email verification is temporarily unavailable.',
      email,
      emailSent: verificationSent,
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Registration failed. Please try again or contact support.' });
  }
}

// Try admin_users table login, return response or null
async function tryAdminLogin(email: string, password: string): Promise<{
  token: string;
  isAdmin: true;
  admin: { id: number; email: string; fullName: string; role: string; permissions: any };
} | null> {
  const [adminRows] = await pool.execute(
    'SELECT id, email, password, full_name, role, permissions, is_active FROM admin_users WHERE email = ?',
    [email.toLowerCase().trim()]
  );
  const admins = adminRows as any[];
  if (admins.length === 0) return null;

  const admin = admins[0];
  if (!admin.is_active) return null;

  const isValid = await bcrypt.compare(password, admin.password);
  if (!isValid) return null;

  const adminToken = jwt.sign(
    { adminId: admin.id, type: 'admin' },
    config.jwt.secret,
    { expiresIn: '7d' }
  );
  return {
    token: adminToken,
    isAdmin: true,
    admin: {
      id: admin.id,
      email: admin.email,
      fullName: admin.full_name,
      role: admin.role,
      permissions: admin.permissions,
    },
  };
}

// Migrate a legacy designer account to users table on first login
async function tryDesignerMigrationLogin(email: string, password: string): Promise<{
  token: string;
  user: any;
  designer: any;
} | null> {
  const [rows] = await pool.execute(
    'SELECT * FROM designers WHERE email = ? AND deleted_at IS NULL',
    [email]
  );
  const designers = rows as any[];
  if (designers.length === 0) return null;

  const designer = designers[0];

  // Check if the linked user account has been deleted by admin
  const linkedUserDeleted = designer.user_id
    ? await (async () => {
        const [r] = await pool.execute('SELECT id, deleted_at FROM users WHERE id = ?', [designer.user_id]);
        const u = (r as any[])[0];
        return !u || u.deleted_at !== null;
      })()
    : false;

  if (!designer.password) {
    // Google OAuth account: if the admin deleted the linked user, allow re-registration
    if (linkedUserDeleted) return null;
    throw Object.assign(new Error('This account was registered with Google. Please use "Continue with Google" to sign in, or use "Forgot password" to set a password.'), { status: 401 });
  }
  if (!designer.email_verified) {
    throw Object.assign(new Error('This account was not verified. Please register again to create a new account.'), { status: 401 });
  }

  const isValid = await bcrypt.compare(password, designer.password);
  if (!isValid) return null;

  // If already linked to an active (non-deleted) user, return that user
  if (designer.user_id && !linkedUserDeleted) {
    const [userRows] = await pool.execute('SELECT * FROM users WHERE id = ? AND deleted_at IS NULL', [designer.user_id]);
    if ((userRows as any[]).length > 0) {
      const user = (userRows as any[])[0];
      return { token: generateToken(user), user: sanitizeUser(user), designer };
    }
  }

  // Lazy migration: create users row for this legacy designer
  const [result] = await pool.execute(
    `INSERT INTO users (email, password, full_name, phone, city, email_verified, role, active_role, onboarding_completed, status)
     VALUES (?, ?, ?, ?, ?, TRUE, 'company', 'company', 1, 'active')`,
    [email, designer.password, designer.full_name, designer.phone || null, designer.city || null]
  );
  const userId = (result as any).insertId;
  await pool.execute('UPDATE designers SET user_id = ? WHERE id = ?', [userId, designer.id]);

  const [newUserRows] = await pool.execute('SELECT * FROM users WHERE id = ?', [userId]);
  const user = (newUserRows as any[])[0];
  return { token: generateToken(user), user: sanitizeUser(user), designer: { ...designer, user_id: userId } };
}

// Login against users table (falls back to admin_users, then legacy designers)
export async function login(req: any, res: any) {
  try {
    const { email, password } = req.body;

    const [rows] = await pool.execute('SELECT * FROM users WHERE email = ?', [email]);
    const users = rows as any[];

    if (users.length === 0) {
      // No user found — try admin_users, then legacy designers
      const adminResult = await tryAdminLogin(email, password);
      if (adminResult) {
        recordAuthSuccess(req, res, () => {});
        return res.json(adminResult);
      }
      try {
        const designerResult = await tryDesignerMigrationLogin(email, password);
        if (designerResult) {
          recordAuthSuccess(req, res, () => {});
          return res.json(designerResult);
        }
      } catch (e: any) {
        return res.status(e.status || 401).json({ error: e.message || 'Invalid email or password.' });
      }
      recordAuthFailure(req, res, () => {});
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const user = users[0];

    if (user.status === 'suspended') {
      return res.status(403).json({ error: 'Your account has been suspended. Please contact support.' });
    }

    if (!user.email_verified) {
      return res.status(401).json({
        error: 'Please verify your email address first.',
        needVerification: true,
        email: user.email
      });
    }

    // OAuth users without password
    if (!user.password) {
      return res.status(401).json({ error: 'Please login with Google or Facebook.' });
    }

    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) {
      // Password wrong for users table — try admin_users as fallback
      const adminResult = await tryAdminLogin(email, password);
      if (adminResult) {
        recordAuthSuccess(req, res, () => {});
        return res.json(adminResult);
      }
      recordAuthFailure(req, res, () => {});
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    recordAuthSuccess(req, res, () => {});

    const token = generateToken(user);

    setImmediate(() => {
      logActivity({
        userId: user.id, userName: user.full_name || user.email, userRole: user.active_role || 'homeowner',
        action: 'login', targetType: 'session', description: '登录系统',
        ip: getClientIp(req),
      }).catch(() => {});
    });

    const designer = await getLinkedDesignerPayload({
      id: user.id,
      email: user.email,
    });

    res.json({
      token,
      user: sanitizeUser(user),
      designer,
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed. Please try again.' });
  }
}

// Verify email using users table
export async function verifyEmail(req: any, res: any) {
  try {
    const { token } = req.body;

    const [rows] = await pool.execute(
      'SELECT * FROM users WHERE verification_token = ? AND verification_token_expires > NOW()',
      [token]
    );

    if ((rows as any[]).length === 0) {
      return res.status(400).json({ error: 'Verification link is invalid or has expired.' });
    }

    const user = (rows as any[])[0];

    await pool.execute(
      'UPDATE users SET email_verified = TRUE, verification_token = NULL, verification_token_expires = NULL WHERE id = ?',
      [user.id]
    );

    const loginToken = generateToken({ ...user, email_verified: true });

    res.json({
      message: 'Email verified successfully.',
      token: loginToken,
      user: sanitizeUser({ ...user, email_verified: true, verification_token: null, verification_token_expires: null }),
    });
  } catch (error) {
    console.error('Verification error:', error);
    res.status(500).json({ error: 'Verification failed. Please try again.' });
  }
}

// Resend verification email
export async function resendVerification(req: any, res: any) {
  try {
    const { email } = req.body;

    const [rows] = await pool.execute(
      'SELECT * FROM users WHERE email = ? AND email_verified = FALSE',
      [email]
    );

    if ((rows as any[]).length === 0) {
      return res.status(400).json({ error: 'Email not found or already verified.' });
    }

    const user = (rows as any[])[0];
    const { token: verificationToken, expires: verificationExpires } = generateVerificationToken();

    await pool.execute(
      'UPDATE users SET verification_token = ?, verification_token_expires = ? WHERE id = ?',
      [verificationToken, verificationExpires, user.id]
    );

    const frontendUrl = resolveFrontendUrl(req);
    await sendVerificationEmail(email, user.full_name, verificationToken, frontendUrl);

    res.json({ message: 'Verification email sent. Please check your inbox.' });
  } catch (error) {
    console.error('Resend verification error:', error);
    res.status(500).json({ error: 'Failed to send verification email. Please try again.' });
  }
}

// Forgot password
export async function forgotPassword(req: any, res: any) {
  const genericMessage = 'If that email is registered, you will receive a password reset link.';
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email is required.' });

    const normalizedEmail = email.toLowerCase().trim();
    const frontendUrl = resolveFrontendUrl(req);

    let handled = false;

    // Check users table
    const [userRows] = await pool.execute('SELECT * FROM users WHERE email = ?', [normalizedEmail]);
    if ((userRows as any[]).length > 0) {
      const user = (userRows as any[])[0];
      if (user.status !== 'suspended') {
        const { token, expires } = generatePasswordResetToken();
        await pool.execute('UPDATE users SET reset_token = ?, reset_token_expires = ? WHERE id = ?', [token, expires, user.id]);
        setImmediate(async () => {
          try { await sendPasswordResetEmail(normalizedEmail, token, frontendUrl); }
          catch (e: any) { console.error('[SMTP] Password reset email failed:', e?.message); }
        });
      }
      handled = true;
    }

    // Also check admin_users table (same email may exist in both)
    const [adminRows] = await pool.execute('SELECT id, email, is_active FROM admin_users WHERE email = ?', [normalizedEmail]);
    if ((adminRows as any[]).length > 0) {
      const admin = (adminRows as any[])[0];
      if (admin.is_active) {
        const { token, expires } = generatePasswordResetToken();
        await pool.execute('UPDATE admin_users SET reset_token = ?, reset_token_expires = ? WHERE id = ?', [token, expires, admin.id]);
        setImmediate(async () => {
          try { await sendAdminPasswordResetEmail(normalizedEmail, token, frontendUrl); }
          catch (e: any) { console.error('[SMTP] Admin password reset email failed:', e?.message); }
        });
      }
      handled = true;
    }

    res.json({ message: genericMessage });
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({ error: 'Failed to process request. Please try again.' });
  }
}

// Reset password
export async function resetPassword(req: any, res: any) {
  try {
    const { token, password } = req.body;

    if (!password || password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters.' });
    }

    const [rows] = await pool.execute(
      'SELECT * FROM users WHERE reset_token = ? AND reset_token_expires > NOW()',
      [token]
    );

    if ((rows as any[]).length === 0) {
      return res.status(400).json({ error: 'Reset link is invalid or has expired.' });
    }

    const user = (rows as any[])[0];
    const hashedPassword = await bcrypt.hash(password, 10);

    await pool.execute(
      'UPDATE users SET password = ?, reset_token = NULL, reset_token_expires = NULL WHERE id = ?',
      [hashedPassword, user.id]
    );

    const loginToken = generateToken(user);

    res.json({
      message: 'Password reset successfully.',
      token: loginToken,
      user: sanitizeUser({ ...user, reset_token: null, reset_token_expires: null }),
    });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ error: 'Failed to reset password. Please try again.' });
  }
}

// Get current user profile + linked data
export async function getMe(req: any, res: any) {
  try {
    const [rows] = await pool.execute('SELECT * FROM users WHERE id = ?', [req.user.userId]);
    const users = rows as any[];

    if (users.length === 0) {
      return res.status(404).json({ error: 'User not found.' });
    }

    const user = users[0];
    const designer = await getLinkedDesignerPayload({
      id: user.id,
      email: user.email,
    });

    res.json({
      user: sanitizeUser(user),
      designer,
    });
  } catch (error) {
    console.error('Get me error:', error);
    res.status(500).json({ error: 'Failed to get user info.' });
  }
}

// Update user profile
export async function updateProfile(req: any, res: any) {
  try {
    const { fullName, full_name, phone, city } = req.body;
    const name = fullName || full_name;
    const userId = req.user.userId;

    const updates: string[] = [];
    const values: any[] = [];

    if (name) { updates.push('full_name = ?'); values.push(name); }
    if (phone !== undefined) { updates.push('phone = ?'); values.push(phone || null); }
    if (city !== undefined) { updates.push('city = ?'); values.push(normalizeCity(city)); }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update.' });
    }

    values.push(userId);
    await pool.execute(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`, values);

    // Sync phone to company_profiles if user has one
    if (phone) {
      await pool.execute(
        'UPDATE company_profiles SET phone = ? WHERE user_id = ? AND (phone IS NULL OR phone = ?)',
        [phone, userId, '']
      ).catch(() => {});
    }

    const [rows] = await pool.execute('SELECT * FROM users WHERE id = ?', [userId]);
    res.json({ user: sanitizeUser((rows as any[])[0]) });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ error: 'Failed to update profile.' });
  }
}

// Update full name (requires current password for security)
export async function updateName(req: any, res: any) {
  try {
    const { full_name, current_password } = req.body;
    const userId = req.user.userId;

    if (!full_name || !full_name.trim()) {
      return res.status(400).json({ error: 'Name is required.' });
    }
    if (!current_password) {
      return res.status(400).json({ error: 'Current password is required.' });
    }

    const [rows] = await pool.execute('SELECT * FROM users WHERE id = ?', [userId]);
    const user = (rows as any[])[0];
    if (!user) return res.status(404).json({ error: 'User not found.' });

    if (!user.password) {
      return res.status(400).json({ error: 'OAuth accounts cannot change name via password. Please update your profile instead.' });
    }

    const isValid = await bcrypt.compare(current_password, user.password);
    if (!isValid) {
      return res.status(401).json({ error: 'Current password is incorrect.' });
    }

    await pool.execute('UPDATE users SET full_name = ? WHERE id = ?', [full_name.trim(), userId]);

    const [updated] = await pool.execute('SELECT * FROM users WHERE id = ?', [userId]);
    res.json({ message: 'Name updated successfully.', user: sanitizeUser((updated as any[])[0]) });
  } catch (error) {
    console.error('Update name error:', error);
    res.status(500).json({ error: 'Failed to update name. Please try again.' });
  }
}

// Change password (requires current password)
export async function changePassword(req: any, res: any) {
  try {
    const { current_password, new_password } = req.body;
    const userId = req.user.userId;

    if (!current_password) {
      return res.status(400).json({ error: 'Current password is required.' });
    }
    if (!new_password || new_password.length < 6) {
      return res.status(400).json({ error: 'New password must be at least 6 characters.' });
    }

    const [rows] = await pool.execute('SELECT * FROM users WHERE id = ?', [userId]);
    const user = (rows as any[])[0];
    if (!user) return res.status(404).json({ error: 'User not found.' });

    if (!user.password) {
      return res.status(400).json({ error: 'OAuth accounts do not have a password to change. Please use your social login.' });
    }

    const isValid = await bcrypt.compare(current_password, user.password);
    if (!isValid) {
      return res.status(401).json({ error: 'Current password is incorrect.' });
    }

    const hashedPassword = await bcrypt.hash(new_password, 10);
    await pool.execute('UPDATE users SET password = ? WHERE id = ?', [hashedPassword, userId]);

    res.json({ message: 'Password changed successfully.' });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ error: 'Failed to change password. Please try again.' });
  }
}

// Google One Tap login — creates user (not designer)
export async function googleOneTap(req: any, res: any) {
  try {
    const { credential } = req.body;
    if (!credential) return res.status(400).json({ error: 'Missing credential' });

    const tokenInfoUrl = `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(credential)}`;
    const { data: payload } = await axios.get(tokenInfoUrl, { timeout: 5000 });

    if (payload.aud !== config.oauth.google.clientId) {
      return res.status(401).json({ error: 'Invalid token audience' });
    }
    if (!['accounts.google.com', 'https://accounts.google.com'].includes(payload.iss)) {
      return res.status(401).json({ error: 'Invalid token issuer' });
    }

    const email = payload.email;
    const name = payload.name || email?.split('@')[0] || 'User';
    const picture = payload.picture || '';

    if (!email) return res.status(400).json({ error: 'Email not available from Google' });

    // Find or create user
    let [rows] = await pool.execute('SELECT * FROM users WHERE email = ?', [email]);
    let user = (rows as any[])[0];

    if (!user) {
      // Also check designers table for existing OAuth user
      const [designerRows] = await pool.execute(
        'SELECT * FROM designers WHERE email = ? AND deleted_at IS NULL', [email]
      );
      const existingDesigner = (designerRows as any[])[0];

      if (existingDesigner && existingDesigner.user_id) {
        // Designer already linked to a user
        [rows] = await pool.execute('SELECT * FROM users WHERE id = ?', [existingDesigner.user_id]);
        user = (rows as any[])[0];
      } else {
        // Create new user
        const [result] = await pool.execute(
          `INSERT INTO users (email, password, full_name, avatar_url, role, email_verified, status, signup_source)
           VALUES (?, '', ?, ?, 'user', TRUE, 'active', 'google-one-tap')`,
          [email, name, picture]
        );
        const userId = (result as any).insertId;

        // If there was an unlinked designer with this email, link them
        if (existingDesigner) {
          await pool.execute('UPDATE designers SET user_id = ? WHERE id = ?', [userId, existingDesigner.id]);
        }

        [rows] = await pool.execute('SELECT * FROM users WHERE id = ?', [userId]);
        user = (rows as any[])[0];
      }
    }

    // Ensure email is verified for OAuth users
    if (!user.email_verified) {
      await pool.execute('UPDATE users SET email_verified = TRUE WHERE id = ?', [user.id]);
      user.email_verified = true;
    }

    const token = generateToken(user);
    res.json({ token });
  } catch (error: any) {
    if (error.response?.status === 400) {
      return res.status(401).json({ error: 'Invalid Google credential' });
    }
    console.error('[GoogleOneTap] Error:', error.message || error);
    res.status(500).json({ error: 'One Tap login failed' });
  }
}

// OAuth callback (Google/Facebook passport)
export async function oauthCallback(req: any, res: any) {
  const frontendUrl = config.frontendUrl || 'http://localhost:5173';

  try {
    const passportUser = req.user as any;
    if (!passportUser) {
      return res.redirect(`${frontendUrl}/auth?error=oauth_failed`);
    }

    // Role (and optional phone) passed via OAuth state parameter
    const rawState = req.query.state;
    let oauthRole: string | undefined;
    let oauthPhone: string | undefined;
    try {
      const parsed = JSON.parse(rawState);
      oauthRole = parsed.role;
      oauthPhone = parsed.phone;
    } catch {
      // Legacy plain string state (e.g. "company")
      oauthRole = rawState;
    }
    const validRoles = ['homeowner', 'company'];
    const assignRole = validRoles.includes(oauthRole as string) ? oauthRole : null;

    // passportUser comes from designers table (passport strategy)
    // Find or create corresponding user record
    let [rows] = await pool.execute('SELECT * FROM users WHERE email = ?', [passportUser.email]);
    let user = (rows as any[])[0];

    if (!user) {
      const googleSource = assignRole === 'company' ? 'google-oauth-company' : 'google-oauth';
      const [result] = await pool.execute(
        `INSERT INTO users (email, password, full_name, phone, avatar_url, role, active_role, onboarding_completed, email_verified, status, signup_source)
         VALUES (?, '', ?, ?, ?, ?, ?, ?, TRUE, 'active', ?)`,
        [passportUser.email, passportUser.full_name, oauthPhone || null, passportUser.avatar_url || '',
         assignRole || 'user', assignRole || null, assignRole ? 1 : 0, googleSource]
      );
      const userId = (result as any).insertId;
      // Link legacy designer row if it exists (passport strategy may have created one)
      if (passportUser.id) {
        await pool.execute('UPDATE designers SET user_id = ? WHERE id = ? AND user_id IS NULL', [userId, passportUser.id]).catch(() => {});
      }

      // Notify admins of new user registration via Google OAuth
      if ((assignRole || 'user') !== 'company') {
        setImmediate(() => {
          notifyUserRegistration({
            email: passportUser.email,
            fullName: passportUser.full_name,
            phone: oauthPhone || null,
            city: null,
            role: assignRole || 'user',
            signupSource: googleSource,
          }).catch(() => {});
        });
      }

      [rows] = await pool.execute('SELECT * FROM users WHERE id = ?', [userId]);
      user = (rows as any[])[0];
    } else {
      if (!user.email_verified) {
        await pool.execute('UPDATE users SET email_verified = TRUE WHERE id = ?', [user.id]);
      }
      // If user exists but no active_role and we have one from OAuth state, set it
      if (!user.active_role && assignRole) {
        await pool.execute(
          'UPDATE users SET active_role = ?, role = ?, onboarding_completed = 1 WHERE id = ?',
          [assignRole, assignRole, user.id]
        );
        user.active_role = assignRole;
      }
      // Backfill phone from OAuth state if user has no phone yet
      if (oauthPhone && !user.phone) {
        await pool.execute('UPDATE users SET phone = ? WHERE id = ?', [oauthPhone, user.id]);
        user.phone = oauthPhone;
      }
    }

    // Backfill company_leads.email so getProfile can match by email too
    const matchPhone = user.phone || oauthPhone;
    if (assignRole === 'company' && matchPhone) {
      pool.execute(
        'UPDATE company_leads SET email = ? WHERE phone = ? AND email IS NULL ORDER BY created_at DESC LIMIT 1',
        [passportUser.email, matchPhone]
      ).catch(() => {});
    }

    const token = generateToken(user);

    setImmediate(() => {
      logActivity({
        userId: user.id, userName: user.full_name || user.email, userRole: user.active_role || 'homeowner',
        action: 'login', targetType: 'session', description: 'Google OAuth 登录',
        ip: getClientIp(req),
      }).catch(() => {});
    });

    const roleParam = assignRole ? `&role=${assignRole}` : '';
    res.redirect(`${frontendUrl}/auth/callback?token=${token}&provider=oauth${roleParam}`);
  } catch (error) {
    console.error('OAuth callback error:', error);
    res.redirect(`${frontendUrl}/auth?error=oauth_error`);
  }
}
