import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import pool from '../config/database';
import config from '../config';
import { sendVerificationEmail, generateVerificationToken } from '../services/emailService';
import { notifySupplierRegistration } from '../services/notificationService';
import { slugify } from '../lib/slugify';

const TEMP_EMAIL_DOMAINS = [
  'tempmail.com', 'guerrillamail.com', '10minutemail.com', 'throwaway.email',
  'mailinator.com', 'guerrillamailblock.com', 'sharklasers.com', 'grr.la',
  'pokemail.net', 'spam4.me'
];

function isTempEmail(email: string): boolean {
  const domain = email.split('@')[1]?.toLowerCase();
  return TEMP_EMAIL_DOMAINS.includes(domain);
}

function generateSupplierToken(user: { id: number; email: string }) {
  return jwt.sign(
    { supplierUserId: user.id, email: user.email, type: 'supplier' },
    config.jwt.secret,
    { expiresIn: '7d' }
  );
}

function sanitize(user: any) {
  const { password, verification_token, verification_expires, reset_token, reset_expires, ...safe } = user;
  return safe;
}

function resolveFrontendUrl(req: any): string {
  if (config.nodeEnv === 'production') return config.frontendUrl;
  return req.headers.origin
    || req.headers.referer?.split('/').slice(0, 3).join('/')
    || config.frontendUrl || 'https://www.tarmeer.com';
}

export async function register(req: any, res: any) {
  try {
    const { email, password, full_name, phone } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password are required.' });

    if (isTempEmail(email)) {
      return res.status(400).json({ error: 'Temporary email addresses are not allowed.' });
    }

    const [existing] = await pool.execute('SELECT id FROM supplier_users WHERE email = ? LIMIT 1', [email]);
    if ((existing as any[]).length > 0) {
      return res.status(400).json({ error: 'This email is already registered.' });
    }

    // Also check users table to prevent confusion
    const [userExisting] = await pool.execute('SELECT id FROM users WHERE email = ? LIMIT 1', [email]);
    if ((userExisting as any[]).length > 0) {
      return res.status(400).json({ error: 'This email is registered as a homeowner/company account. Please use a different email.' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const { token: verificationToken, expires: verificationExpires } = generateVerificationToken();

    const [result] = await pool.execute(
      `INSERT INTO supplier_users (email, password, full_name, phone, verification_token, verification_expires)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [email, hashedPassword, full_name || email.split('@')[0], phone || null, verificationToken, verificationExpires]
    );

    const userId = (result as any).insertId;

    // Create supplier_profiles entry with status=pending
    const displayName = full_name || email.split('@')[0];
    const baseSlug = slugify(displayName) || `supplier-${userId}`;
    let slug = baseSlug;
    // Ensure slug uniqueness
    const [slugCheck] = await pool.execute('SELECT id FROM supplier_profiles WHERE slug = ? LIMIT 1', [slug]);
    if ((slugCheck as any[]).length > 0) {
      slug = `${baseSlug}-${userId}`;
    }
    await pool.execute(
      `INSERT INTO supplier_profiles (supplier_user_id, company_name, slug, status, contact_phone) VALUES (?, ?, ?, 'pending', ?)`,
      [userId, displayName, slug, phone || null]
    );

    const frontendUrl = resolveFrontendUrl(req);

    // Send verification email + admin notification (fire-and-forget)
    setImmediate(() => {
      sendVerificationEmail(email, displayName, verificationToken, frontendUrl).catch((err: any) =>
        console.error('[supplier] Verification email failed:', err)
      );
      notifySupplierRegistration({ email, fullName: displayName, signupSource: 'supplier-email' }).catch(() => {});
    });

    res.status(201).json({
      message: 'Account created. Please check your email to verify.',
      user: { id: userId, email, full_name: displayName },
    });
  } catch (error) {
    console.error('Supplier register error:', error);
    res.status(500).json({ error: 'Registration failed.' });
  }
}

export async function login(req: any, res: any) {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password are required.' });

    const [rows] = await pool.execute('SELECT * FROM supplier_users WHERE email = ? LIMIT 1', [email]);
    const user = (rows as any[])[0];
    if (!user) return res.status(401).json({ error: 'Invalid email or password.' });

    if (!user.password) return res.status(401).json({ error: 'Please sign in with Google.' });

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(401).json({ error: 'Invalid email or password.' });

    if (!user.email_verified) {
      return res.status(403).json({ error: 'Please verify your email before signing in.' });
    }

    const token = generateSupplierToken({ id: user.id, email: user.email });

    // Get profile if exists
    const [profileRows] = await pool.execute(
      'SELECT id, company_name, slug, status FROM supplier_profiles WHERE supplier_user_id = ? LIMIT 1',
      [user.id]
    );
    const profile = (profileRows as any[])[0] || null;

    res.json({
      token,
      user: sanitize(user),
      profile,
    });
  } catch (error) {
    console.error('Supplier login error:', error);
    res.status(500).json({ error: 'Login failed.' });
  }
}

export async function verifyEmail(req: any, res: any) {
  try {
    const { token } = req.body;
    if (!token) return res.status(400).json({ error: 'Token is required.' });

    const [rows] = await pool.execute(
      'SELECT * FROM supplier_users WHERE verification_token = ? AND verification_expires > NOW() LIMIT 1',
      [token]
    );
    if ((rows as any[]).length === 0) {
      return res.status(400).json({ error: 'Verification link is invalid or has expired.' });
    }
    const user = (rows as any[])[0];

    await pool.execute(
      'UPDATE supplier_users SET email_verified = 1, verification_token = NULL, verification_expires = NULL WHERE id = ?',
      [user.id]
    );

    const loginToken = generateSupplierToken({ id: user.id, email: user.email });
    res.json({ message: 'Email verified successfully.', token: loginToken, user: sanitize(user) });
  } catch (error) {
    console.error('Supplier verifyEmail error:', error);
    res.status(500).json({ error: 'Verification failed. Please try again.' });
  }
}

export async function checkVerified(req: any, res: any) {
  try {
    const email = req.query.email as string;
    if (!email) return res.json({ verified: false });

    const [rows] = await pool.execute(
      'SELECT id, email, email_verified, full_name FROM supplier_users WHERE email = ? LIMIT 1',
      [email]
    );
    const user = (rows as any[])[0];
    if (!user || !user.email_verified) return res.json({ verified: false });

    const token = generateSupplierToken({ id: user.id, email: user.email });
    res.json({ verified: true, token, user: { id: user.id, email: user.email, full_name: user.full_name } });
  } catch {
    res.json({ verified: false });
  }
}

export async function checkAvailability(req: any, res: any) {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email is required.' });

    // Check if already a supplier
    const [supplierRows] = await pool.execute('SELECT id FROM supplier_users WHERE email = ? LIMIT 1', [email]);
    if ((supplierRows as any[]).length > 0) {
      return res.json({ isNewEmail: false });
    }

    // Check if email belongs to a homeowner/company account
    const [userRows] = await pool.execute('SELECT id FROM users WHERE email = ? LIMIT 1', [email]);
    if ((userRows as any[]).length > 0) {
      return res.json({ isNewEmail: false, conflict: 'homeowner' });
    }

    res.json({ isNewEmail: true });
  } catch (error) {
    console.error('Supplier check availability error:', error);
    res.status(500).json({ error: 'Check failed.' });
  }
}

export async function googleCallback(req: any, res: any) {
  try {
    const profile = req.user;
    if (!profile) return res.redirect('/supplier/auth?error=google_failed');

    const email = profile.emails?.[0]?.value;
    const googleId = profile.id;
    const fullName = profile.displayName || '';
    const avatarUrl = profile.photos?.[0]?.value || '';

    if (!email) return res.redirect('/supplier/auth?error=no_email');

    // Check if google_id already exists
    const [existing] = await pool.execute('SELECT * FROM supplier_users WHERE google_id = ? LIMIT 1', [googleId]);
    let user = (existing as any[])[0];

    if (!user) {
      // Check by email
      const [byEmail] = await pool.execute('SELECT * FROM supplier_users WHERE email = ? LIMIT 1', [email]);
      user = (byEmail as any[])[0];

      if (user) {
        // Link google_id to existing account
        await pool.execute('UPDATE supplier_users SET google_id = ?, avatar_url = COALESCE(avatar_url, ?), email_verified = 1 WHERE id = ?',
          [googleId, avatarUrl, user.id]);
      } else {
        // Ensure not in users table
        const [userTableCheck] = await pool.execute('SELECT id FROM users WHERE email = ? LIMIT 1', [email]);
        if ((userTableCheck as any[]).length > 0) {
          return res.redirect('/supplier/auth?error=email_is_homeowner');
        }

        // Create new supplier user
        const [result] = await pool.execute(
          `INSERT INTO supplier_users (email, full_name, google_id, avatar_url, email_verified)
           VALUES (?, ?, ?, ?, 1)`,
          [email, fullName, googleId, avatarUrl]
        );
        const [newUser] = await pool.execute('SELECT * FROM supplier_users WHERE id = ?', [(result as any).insertId]);
        user = (newUser as any[])[0];
        setImmediate(() => {
          notifySupplierRegistration({ email, fullName: fullName || undefined, signupSource: 'supplier-google' }).catch(() => {});
        });
      }
    }

    const token = generateSupplierToken({ id: user.id, email: user.email });
    const frontendUrl = resolveFrontendUrl(req);
    res.redirect(`${frontendUrl}/supplier/auth/callback?token=${token}`);
  } catch (error) {
    console.error('Supplier Google callback error:', error);
    res.redirect('/supplier/auth?error=server_error');
  }
}
