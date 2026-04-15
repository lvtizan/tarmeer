import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import axios from 'axios';
import passport from 'passport';
import pool from '../config/database';
import config from '../config';
import { sendDesignerRegistrationEmail, sendVerificationEmail, generateVerificationToken, sendPasswordResetEmail, generatePasswordResetToken } from '../services/emailService';
import { buildRegisterEmailStatus } from '../lib/registerEmailPolicy';
import { buildRegistrationAvailabilityResult } from '../lib/registrationAvailability';
import { recordAuthFailure, recordAuthSuccess } from '../middleware/authRateLimit';
import { findDesignerByOAuthId, createOAuthDesigner } from '../lib/oauthHandler';

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

function isTempEmail(email: string): boolean {
  const domain = email.split('@')[1]?.toLowerCase();
  return TEMP_EMAIL_DOMAINS.includes(domain);
}

function normalizeCity(city?: string | null): string | null {
  if (!city) return null;
  return city
    .trim()
    .split(/[\s-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ');
}

function sanitizeDesignerSession(designer: any) {
  if (!designer) return designer;

  const {
    password,
    verification_token,
    verification_expires,
    reset_token,
    reset_expires,
    ...safeDesigner
  } = designer;

  return safeDesigner;
}

function resolveFrontendUrl(req: any): string {
  if (config.nodeEnv === 'production') {
    return config.frontendUrl;
  }

  return req.headers.origin
    || req.headers.referer?.split('/').slice(0, 3).join('/')
    || config.frontendUrl
    || 'https://www.tarmeer.com';
}

async function checkExistingDesignerFields(email?: string, phone?: string | null) {
  const normalizedPhone = phone?.trim();
  const checks = await Promise.all([
    email
      ? pool.execute('SELECT id FROM designers WHERE email = ? AND email_verified = 1 UNION SELECT id FROM users WHERE email = ? LIMIT 1', [email, email])
      : Promise.resolve([[ ]]),
    normalizedPhone
      ? pool.execute('SELECT id FROM designers WHERE phone = ? LIMIT 1', [normalizedPhone])
      : Promise.resolve([[ ]]),
  ]);

  const [emailRows, phoneRows] = checks.map((entry) => entry[0] as any[]);
  return buildRegistrationAvailabilityResult({
    emailExists: emailRows.length > 0,
    phoneExists: phoneRows.length > 0,
  });
}

export async function checkAvailability(req: any, res: any) {
  try {
    const { email, phone } = req.body;
    const availability = await checkExistingDesignerFields(email, phone);
    res.json(availability);
  } catch (error) {
    console.error('Registration availability error:', error);
    res.status(500).json({ error: 'Failed to check registration availability.' });
  }
}

export async function register(req: any, res: any) {
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
    
    const hashedPassword = await bcrypt.hash(password, 10);
    const { token: verificationToken, expires: verificationExpires } = generateVerificationToken();
    
    const [result] = await pool.execute(
      'INSERT INTO designers (email, password, full_name, phone, city, verification_token, verification_expires, status, is_approved) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [email, hashedPassword, name, phone || null, normalizeCity(city), verificationToken, verificationExpires, 'pending', 0]
    );
    
    const designerId = (result as any).insertId;
    
    const [designer] = await pool.execute(
      'SELECT * FROM designers WHERE id = ?',
      [designerId]
    );
    
    const newDesigner = (designer as any[])[0];
    const smtpConfigured = Boolean(config.smtp.user && config.smtp.pass);

    // 从请求中动态获取前端域名（优先使用请求头的 origin）
    const frontendUrl = resolveFrontendUrl(req);

    let verificationSent = false;

    if (smtpConfigured) {
      try {
        const sendResult = await sendVerificationEmail(email, name, verificationToken, frontendUrl);
        const mailInfo = sendResult as any;
        verificationSent = true;
        console.log(`[SMTP] Verification email sent to ${email}`, {
          messageId: mailInfo?.messageId,
          response: mailInfo?.response,
          accepted: mailInfo?.accepted,
          rejected: mailInfo?.rejected,
        });
      } catch (emailError: any) {
        console.error('[SMTP] Verification email failed:', emailError?.message || emailError);
        if (emailError?.response) console.error('[SMTP] Response:', emailError.response);
      }

      setImmediate(async () => {
        try {
          const sendResult = await sendDesignerRegistrationEmail(newDesigner);
          const mailInfo = sendResult as any;
          console.log(`[SMTP] Registration notification sent for ${email}`, {
            messageId: mailInfo?.messageId,
            response: mailInfo?.response,
            accepted: mailInfo?.accepted,
            rejected: mailInfo?.rejected,
          });
        } catch (emailError: any) {
          console.error('[SMTP] Registration notification failed:', emailError?.message || emailError);
          if (emailError?.response) console.error('[SMTP] Response:', emailError.response);
        }
      });
    } else {
      console.warn('[SMTP] Not configured: set SMTP_USER and SMTP_PASS in .env on server, then pm2 restart tarmeer-api');
      verificationSent = false;
    }

    const emailStatus = buildRegisterEmailStatus({
      verificationSent,
      notificationQueued: smtpConfigured,
    });

    res.status(201).json({
      message: emailStatus.message,
      email,
      emailSent: emailStatus.emailSent,
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Registration failed. Please try again or contact support.' });
  }
}

export async function verifyEmail(req: any, res: any) {
  try {
    const { token } = req.body;
    
    const [designer] = await pool.execute(
      'SELECT * FROM designers WHERE verification_token = ? AND verification_expires > NOW()',
      [token]
    );
    
    if ((designer as any[]).length === 0) {
      return res.status(400).json({ error: 'Verification link is invalid or has expired.' });
    }
    
    const user = (designer as any[])[0];

    if (user.deleted_at) {
      return res.status(400).json({ error: 'Verification link is invalid or has expired.' });
    }
    
    await pool.execute(
      'UPDATE designers SET email_verified = TRUE, verification_token = NULL, verification_expires = NULL WHERE id = ?',
      [user.id]
    );
    
    const loginToken = jwt.sign(
      { id: user.id, email: user.email },
      config.jwt.secret,
      { expiresIn: '7d' }
    );
    
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
  } catch (error) {
    console.error('Verification error:', error);
    res.status(500).json({ error: 'Verification failed. Please try again.' });
  }
}

export async function resendVerification(req: any, res: any) {
  try {
    const { email } = req.body;
    
    const [designer] = await pool.execute(
      'SELECT * FROM designers WHERE email = ? AND email_verified = FALSE',
      [email]
    );
    
    if ((designer as any[]).length === 0) {
      return res.status(400).json({ error: 'Email not found or already verified.' });
    }
    
    const user = (designer as any[])[0];

    if (user.deleted_at) {
      return res.status(400).json({ error: 'Email not found or already verified.' });
    }
    
    const { token: verificationToken, expires: verificationExpires } = generateVerificationToken();
    
    await pool.execute(
      'UPDATE designers SET verification_token = ?, verification_expires = ? WHERE id = ?',
      [verificationToken, verificationExpires, user.id]
    );
    
    // 从请求中动态获取前端域名
    const frontendUrl = resolveFrontendUrl(req);
    
    const sendResult = await sendVerificationEmail(email, user.full_name, verificationToken, frontendUrl);
    const mailInfo = sendResult as any;
    console.log(`[SMTP] Verification email resent to ${email}`, {
      messageId: mailInfo?.messageId,
      response: mailInfo?.response,
      accepted: mailInfo?.accepted,
      rejected: mailInfo?.rejected,
    });
    
    res.json({ message: 'Verification email sent. Please check your inbox.' });
  } catch (error) {
    console.error('Resend verification error:', error);
    res.status(500).json({ error: 'Failed to send verification email. Please try again.' });
  }
}

export async function login(req: any, res: any) {
  try {
    const { email, password } = req.body;

    const [designer] = await pool.execute(
      'SELECT * FROM designers WHERE email = ?',
      [email]
    );

    if ((designer as any[]).length === 0) {
      recordAuthFailure(req, res, () => {}); // 记录失败尝试
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const user = (designer as any[])[0];

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

    const isValid = await bcrypt.compare(password, user.password);

    if (!isValid) {
      recordAuthFailure(req, res, () => {}); // 记录失败尝试
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    // 登录成功，清除失败尝试记录
    recordAuthSuccess(req, res, () => {});

    const token = jwt.sign(
      { id: user.id, email: user.email },
      config.jwt.secret,
      { expiresIn: '7d' }
    );

    res.json({
      token,
      designer: sanitizeDesignerSession(user)
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed. Please try again.' });
  }
}

// 忘记密码 - 发送重置邮件
export async function forgotPassword(req: any, res: any) {
  try {
    const { email } = req.body;
    
    const [designer] = await pool.execute(
      'SELECT * FROM designers WHERE email = ?',
      [email]
    );
    
    // 无论用户是否存在，都返回成功（安全考虑，不泄露用户信息）
    if ((designer as any[]).length === 0) {
      return res.json({ message: 'If that email is registered, you will receive a password reset link.' });
    }
    
    const user = (designer as any[])[0];

    if (user.deleted_at) {
      return res.status(400).json({ error: 'Designer account is deleted.' });
    }
    const { token, expires } = generatePasswordResetToken();
    
    await pool.execute(
      'UPDATE designers SET reset_token = ?, reset_expires = ? WHERE id = ?',
      [token, expires, user.id]
    );
    
    // 从请求中动态获取前端域名
    const frontendUrl = resolveFrontendUrl(req);
    
    // 异步发送邮件
    setImmediate(async () => {
      try {
        const sendResult = await sendPasswordResetEmail(email, token, frontendUrl);
        const mailInfo = sendResult as any;
        console.log(`[SMTP] Password reset email sent to ${email}`, {
          messageId: mailInfo?.messageId,
          response: mailInfo?.response,
          accepted: mailInfo?.accepted,
          rejected: mailInfo?.rejected,
        });
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

// 重置密码
export async function resetPassword(req: any, res: any) {
  try {
    const { token, password } = req.body;
    
    if (!password || password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters.' });
    }
    
    const [designer] = await pool.execute(
      'SELECT * FROM designers WHERE reset_token = ? AND reset_expires > NOW()',
      [token]
    );
    
    if ((designer as any[]).length === 0) {
      return res.status(400).json({ error: 'Reset link is invalid or has expired.' });
    }
    
    const user = (designer as any[])[0];

    if (user.deleted_at) {
      return res.status(400).json({ error: 'Reset link is invalid or has expired.' });
    }
    const hashedPassword = await bcrypt.hash(password, 10);
    
    await pool.execute(
      'UPDATE designers SET password = ?, reset_token = NULL, reset_expires = NULL WHERE id = ?',
      [hashedPassword, user.id]
    );
    
    // 自动登录
    const loginToken = jwt.sign(
      { id: user.id, email: user.email },
      config.jwt.secret,
      { expiresIn: '7d' }
    );
    
    res.json({
      message: 'Password reset successfully.',
      token: loginToken,
      designer: sanitizeDesignerSession({
        ...user,
        reset_token: null,
        reset_expires: null
      })
    });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ error: 'Failed to reset password. Please try again.' });
  }
}

// 获取当前用户信息
export async function getMe(req: any, res: any) {
  try {
    const [rows] = await pool.execute(
      'SELECT * FROM designers WHERE id = ? AND deleted_at IS NULL',
      [req.user.id]
    );

    const designers = rows as any[];
    if (designers.length === 0) {
      return res.status(404).json({ error: 'Designer not found.' });
    }

    res.json({ designer: sanitizeDesignerSession(designers[0]) });
  } catch (error) {
    console.error('Get me error:', error);
    res.status(500).json({ error: 'Failed to get user info.' });
  }
}

// OAuth 回调处理
export async function oauthCallback(req: any, res: any) {
  const frontendUrl = config.frontendUrl || 'http://localhost:5173';

  try {
    const user = req.user as any;

    if (!user) {
      return res.redirect(`${frontendUrl}/auth?error=oauth_failed`);
    }

    // 如果是已有账号通过 OAuth 关联但邮箱未验证，自动验证
    if (!user.email_verified) {
      await pool.execute(
        'UPDATE designers SET email_verified = TRUE WHERE id = ?',
        [user.id]
      );
    }

    // 生成 JWT token
    const token = jwt.sign(
      { id: user.id, email: user.email },
      config.jwt.secret,
      { expiresIn: '7d' }
    );

    // 重定向到前端，携带 token
    res.redirect(`${frontendUrl}/auth/callback?token=${token}&provider=oauth`);
  } catch (error) {
    console.error('OAuth callback error:', error);
    res.redirect(`${frontendUrl}/auth?error=oauth_error`);
  }
}

// Google One Tap 登录
export async function googleOneTap(req: any, res: any) {
  try {
    const { credential } = req.body;

    if (!credential) {
      return res.status(400).json({ error: 'Missing credential' });
    }

    // 用 Google tokeninfo 端点验证 ID Token
    const tokenInfoUrl = `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(credential)}`;
    const { data: payload } = await axios.get(tokenInfoUrl, { timeout: 5000 });

    // 验证 audience（client_id）
    if (payload.aud !== config.oauth.google.clientId) {
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
    let designer = await findDesignerByOAuthId('google', googleId);

    if (!designer) {
      const result = await createOAuthDesigner({
        id: googleId,
        email,
        displayName: name,
        photoUrl: picture,
        provider: 'google',
      });
      designer = result.designer;

      // 如果是已有账号关联但邮箱未验证，自动验证
      if (result.needsVerification) {
        await pool.execute(
          'UPDATE designers SET email_verified = TRUE WHERE id = ?',
          [designer.id]
        );
      }
    }

    // 生成 JWT
    const token = jwt.sign(
      { id: designer.id, email: designer.email },
      config.jwt.secret,
      { expiresIn: '7d' }
    );

    console.log(`[GoogleOneTap] Login success: ${designer.email} (id=${designer.id})`);

    res.json({ token });
  } catch (error: any) {
    // Google tokeninfo 返回 400 表示 token 无效
    if (error.response?.status === 400) {
      return res.status(401).json({ error: 'Invalid Google credential' });
    }
    console.error('[GoogleOneTap] Error:', error.message || error);
    res.status(500).json({ error: 'One Tap login failed' });
  }
}
