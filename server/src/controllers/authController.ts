import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import pool from '../config/database';
import config from '../config';
import { sendDesignerRegistrationEmail, sendVerificationEmail, generateVerificationToken, sendPasswordResetEmail, generatePasswordResetToken, setFrontendUrl } from '../services/emailService';

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

export async function register(req: any, res: any) {
  try {
    const { email, password, fullName, full_name, phone, city } = req.body;
    const name = fullName || full_name;
    
    if (isTempEmail(email)) {
      return res.status(400).json({ error: 'Temporary email addresses are not allowed. Please use a valid email.' });
    }
    
    const [existing] = await pool.execute(
      'SELECT id FROM designers WHERE email = ?',
      [email]
    );
    
    if ((existing as any[]).length > 0) {
      return res.status(400).json({ error: 'Email already registered' });
    }
    
    const hashedPassword = await bcrypt.hash(password, 10);
    const { token: verificationToken, expires: verificationExpires } = generateVerificationToken();
    
    const [result] = await pool.execute(
      'INSERT INTO designers (email, password, full_name, phone, city, verification_token, verification_expires) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [email, hashedPassword, name, phone || null, normalizeCity(city), verificationToken, verificationExpires]
    );
    
    const designerId = (result as any).insertId;
    
    const [designer] = await pool.execute(
      'SELECT * FROM designers WHERE id = ?',
      [designerId]
    );
    
    const newDesigner = (designer as any[])[0];
    const smtpConfigured = config.smtp.user && config.smtp.pass;

    // 从请求中动态获取前端域名（优先使用请求头的 origin）
    const frontendUrl = req.headers.origin || req.headers.referer?.split('/').slice(0, 3).join('/') || process.env.FRONTEND_URL || 'https://www.tarmeer.com';
    setFrontendUrl(frontendUrl);

    // 立即返回注册成功响应
    res.status(201).json({
      message: 'Registration successful! Please check your email to verify your account.',
      email: email,
      emailSent: true
    });

    // 异步发送邮件，不阻塞响应
    if (smtpConfigured) {
      setImmediate(async () => {
        try {
          await sendVerificationEmail(email, name, verificationToken);
          console.log(`[SMTP] Verification email sent to ${email}`);
          await sendDesignerRegistrationEmail(newDesigner);
          console.log(`[SMTP] Registration notification sent for ${email}`);
        } catch (emailError: any) {
          console.error('[SMTP] Verification email failed:', emailError?.message || emailError);
          if (emailError?.response) console.error('[SMTP] Response:', emailError.response);
        }
      });
    } else {
      console.warn('[SMTP] Not configured: set SMTP_USER and SMTP_PASS in .env on server, then pm2 restart tarmeer-api');
    }
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
    
    const { token: verificationToken, expires: verificationExpires } = generateVerificationToken();
    
    await pool.execute(
      'UPDATE designers SET verification_token = ?, verification_expires = ? WHERE id = ?',
      [verificationToken, verificationExpires, user.id]
    );
    
    // 从请求中动态获取前端域名
    const frontendUrl = req.headers.origin || req.headers.referer?.split('/').slice(0, 3).join('/') || process.env.FRONTEND_URL || 'https://www.tarmeer.com';
    setFrontendUrl(frontendUrl);
    
    await sendVerificationEmail(email, user.full_name, verificationToken);
    
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
      return res.status(401).json({ error: 'Invalid email or password.' });
    }
    
    const user = (designer as any[])[0];
    
    if (!user.email_verified) {
      return res.status(401).json({ 
        error: 'Please verify your email address first.',
        needVerification: true,
        email: user.email
      });
    }
    
    const isValid = await bcrypt.compare(password, user.password);
    
    if (!isValid) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }
    
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
    const { token, expires } = generatePasswordResetToken();
    
    await pool.execute(
      'UPDATE designers SET reset_token = ?, reset_expires = ? WHERE id = ?',
      [token, expires, user.id]
    );
    
    // 从请求中动态获取前端域名
    const frontendUrl = req.headers.origin || req.headers.referer?.split('/').slice(0, 3).join('/') || process.env.FRONTEND_URL || 'https://www.tarmeer.com';
    setFrontendUrl(frontendUrl);
    
    // 异步发送邮件
    setImmediate(async () => {
      try {
        await sendPasswordResetEmail(email, token);
        console.log(`[SMTP] Password reset email sent to ${email}`);
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
