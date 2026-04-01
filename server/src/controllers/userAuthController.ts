import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import axios from 'axios';
import pool from '../config/database';
import config from '../config';
import { sendVerificationEmail, generateVerificationToken, sendPasswordResetEmail, generatePasswordResetToken } from '../services/emailService';
import { recordAuthFailure, recordAuthSuccess } from '../middleware/authRateLimit';

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

// Register a new user (role = 'user' by default)
export async function register(req: any, res: any) {
  try {
    const { email, password, fullName, full_name, phone, city } = req.body;
    const name = fullName || full_name || email.split('@')[0];

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
      `INSERT INTO users (email, password, full_name, phone, city, verification_token, verification_token_expires, role, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'user', 'active')`,
      [email, hashedPassword, name, phone || null, normalizeCity(city), verificationToken, verificationExpires]
    );

    const userId = (result as any).insertId;
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

// Login against users table
export async function login(req: any, res: any) {
  try {
    const { email, password } = req.body;

    const [rows] = await pool.execute('SELECT * FROM users WHERE email = ?', [email]);
    const users = rows as any[];

    if (users.length === 0) {
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
      recordAuthFailure(req, res, () => {});
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    recordAuthSuccess(req, res, () => {});

    const token = generateToken(user);

    // Get linked designer/company info
    const linkedData = await getLinkedData(user);

    res.json({
      token,
      user: sanitizeUser(user),
      // Backward compat: if user is a designer, also return designer object
      ...(linkedData.designer ? { designer: linkedData.designer } : {}),
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

    // Also update linked designer if exists
    await pool.execute(
      'UPDATE designers SET email_verified = TRUE, verification_token = NULL, verification_expires = NULL WHERE user_id = ?',
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
  try {
    const { email } = req.body;

    const [rows] = await pool.execute('SELECT * FROM users WHERE email = ?', [email]);

    if ((rows as any[]).length === 0) {
      return res.json({ message: 'If that email is registered, you will receive a password reset link.' });
    }

    const user = (rows as any[])[0];
    if (user.status === 'suspended') {
      return res.json({ message: 'If that email is registered, you will receive a password reset link.' });
    }

    const { token, expires } = generatePasswordResetToken();

    await pool.execute(
      'UPDATE users SET reset_token = ?, reset_token_expires = ? WHERE id = ?',
      [token, expires, user.id]
    );

    const frontendUrl = resolveFrontendUrl(req);
    setImmediate(async () => {
      try {
        await sendPasswordResetEmail(email, token, frontendUrl);
      } catch (emailError: any) {
        console.error('[SMTP] Password reset email failed:', emailError?.message || emailError);
      }
    });

    res.json({ message: 'If that email is registered, you will receive a password reset link.' });
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

    // Also update linked designer password
    await pool.execute(
      'UPDATE designers SET password = ?, reset_token = NULL, reset_expires = NULL WHERE user_id = ?',
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
    const linkedData = await getLinkedData(user);

    res.json({
      user: sanitizeUser(user),
      // Backward compat
      designer: linkedData.designer || null,
      company: linkedData.company || null,
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

    // Also sync to linked designer
    if (updates.length > 0) {
      const designerUpdates = updates.map(u => u); // same field names
      const designerValues = [...values.slice(0, -1), userId];
      await pool.execute(
        `UPDATE designers SET ${designerUpdates.join(', ')} WHERE user_id = ?`,
        designerValues
      ).catch(() => {}); // ignore if no linked designer
    }

    const [rows] = await pool.execute('SELECT * FROM users WHERE id = ?', [userId]);
    res.json({ user: sanitizeUser((rows as any[])[0]) });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ error: 'Failed to update profile.' });
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
          `INSERT INTO users (email, password, full_name, avatar_url, role, email_verified, status)
           VALUES (?, '', ?, ?, 'user', TRUE, 'active')`,
          [email, name, picture]
        );
        const userId = (result as any).insertId;

        // If there was an unlinked designer with this email, link them
        if (existingDesigner) {
          await pool.execute('UPDATE designers SET user_id = ? WHERE id = ?', [userId, existingDesigner.id]);
          await pool.execute("UPDATE users SET role = 'designer' WHERE id = ?", [userId]);
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

    // passportUser comes from designers table (passport strategy)
    // Find or create corresponding user record
    let [rows] = await pool.execute('SELECT * FROM users WHERE email = ?', [passportUser.email]);
    let user = (rows as any[])[0];

    if (!user) {
      const [result] = await pool.execute(
        `INSERT INTO users (email, password, full_name, avatar_url, role, email_verified, status)
         VALUES (?, '', ?, ?, 'designer', TRUE, 'active')`,
        [passportUser.email, passportUser.full_name, passportUser.avatar_url || '']
      );
      const userId = (result as any).insertId;
      await pool.execute('UPDATE designers SET user_id = ? WHERE id = ?', [userId, passportUser.id]);

      [rows] = await pool.execute('SELECT * FROM users WHERE id = ?', [userId]);
      user = (rows as any[])[0];
    } else if (!user.email_verified) {
      await pool.execute('UPDATE users SET email_verified = TRUE WHERE id = ?', [user.id]);
    }

    const token = generateToken(user);
    res.redirect(`${frontendUrl}/auth/callback?token=${token}&provider=oauth`);
  } catch (error) {
    console.error('OAuth callback error:', error);
    res.redirect(`${frontendUrl}/auth?error=oauth_error`);
  }
}

// Helper: get linked designer and company data
async function getLinkedData(user: any) {
  const result: { designer: any; company: any } = { designer: null, company: null };

  if (user.role === 'designer' || true) {
    // Always check — user might have a linked designer even if role is 'user' during transition
    const [rows] = await pool.execute(
      'SELECT * FROM designers WHERE user_id = ? AND deleted_at IS NULL',
      [user.id]
    );
    const designers = rows as any[];
    if (designers.length > 0) {
      const { password, verification_token, verification_expires, reset_token, reset_expires, ...safe } = designers[0];
      result.designer = safe;
    }
  }

  if (user.role === 'company') {
    const [rows] = await pool.execute(
      'SELECT * FROM uae_companies WHERE owner_user_id = ?',
      [user.id]
    );
    if ((rows as any[]).length > 0) {
      result.company = (rows as any[])[0];
    }
  }

  return result;
}
