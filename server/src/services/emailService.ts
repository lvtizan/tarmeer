import { transporter, NOTIFICATION_EMAIL, FROM_EMAIL, shouldSkipRealEmail, sendMailDevMode } from '../config/email';
import crypto from 'crypto';

// 默认前端URL（当无法从请求中获取时使用）
const DEFAULT_FRONTEND_URL = process.env.FRONTEND_URL || 'https://www.tarmeer.com';

// 请求级别的前端URL存储
let currentFrontendUrl: string | null = null;

// 设置当前请求的前端URL（由controller在处理请求时调用）
export function setFrontendUrl(url: string) {
  currentFrontendUrl = url;
}

// 获取当前前端URL
export function getFrontendUrl(): string {
  return currentFrontendUrl || DEFAULT_FRONTEND_URL;
}

export async function sendVerificationEmail(email: string, fullName: string, token: string) {
  const verificationLink = `${getFrontendUrl()}/verify-email?token=${token}`;
  
  const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #b8864a;">Dear ${fullName},</h2>
        <p>Thank you for registering on Tarmeer Designer Platform!</p>
        <p>Please click the button below to verify your email address:</p>
        <a href="${verificationLink}" style="display: inline-block; padding: 12px 24px; background-color: #b8864a; color: white; text-decoration: none; border-radius: 8px; margin: 20px 0;">Verify Email</a>
        <p style="color: #666; font-size: 14px;">This link is valid for 24 hours.</p>
        <p style="color: #666; font-size: 14px;">If you did not register for a Tarmeer account, please ignore this email.</p>
        <br>
        <p style="color: #b8864a; font-weight: bold;">Tarmeer Team</p>
      </div>
    `;
  
  if (shouldSkipRealEmail()) {
    return sendMailDevMode(email, '[Tarmeer] Verify Your Email Address', html);
  }
  
  await transporter.sendMail({
    from: `"Tarmeer" <${FROM_EMAIL}>`,
    to: email,
    subject: '[Tarmeer] Verify Your Email Address',
    html
  });
}

export async function sendDesignerRegistrationEmail(designer: any) {
  const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #b8864a;">New Designer Registration</h2>
        <table style="width: 100%; border-collapse: collapse;">
          <tr><td style="padding: 8px 0; border-bottom: 1px solid #eee;"><strong>Name:</strong></td><td style="padding: 8px 0; border-bottom: 1px solid #eee;">${designer.full_name}</td></tr>
          <tr><td style="padding: 8px 0; border-bottom: 1px solid #eee;"><strong>Email:</strong></td><td style="padding: 8px 0; border-bottom: 1px solid #eee;">${designer.email}</td></tr>
          <tr><td style="padding: 8px 0; border-bottom: 1px solid #eee;"><strong>Phone:</strong></td><td style="padding: 8px 0; border-bottom: 1px solid #eee;">${designer.phone || 'Not provided'}</td></tr>
          <tr><td style="padding: 8px 0; border-bottom: 1px solid #eee;"><strong>City:</strong></td><td style="padding: 8px 0; border-bottom: 1px solid #eee;">${designer.city || 'Not provided'}</td></tr>
          <tr><td style="padding: 8px 0; border-bottom: 1px solid #eee;"><strong>Email Verified:</strong></td><td style="padding: 8px 0; border-bottom: 1px solid #eee;">${designer.email_verified ? '✅ Verified' : '❌ Not Verified'}</td></tr>
          <tr><td style="padding: 8px 0;"><strong>Registration Time:</strong></td><td style="padding: 8px 0;">${new Date().toLocaleString('en-US')}</td></tr>
        </table>
        <p style="margin-top: 20px; color: #666;">Please log in to the admin panel to review.</p>
      </div>
    `;
  
  if (shouldSkipRealEmail()) {
    return sendMailDevMode(NOTIFICATION_EMAIL, '[Tarmeer] New Designer Registration', html);
  }
  
  await transporter.sendMail({
    from: `"Tarmeer" <${FROM_EMAIL}>`,
    to: NOTIFICATION_EMAIL,
    subject: '[Tarmeer] New Designer Registration',
    html
  });
}

export function generateVerificationToken(): { token: string; expires: Date } {
  const token = crypto.randomBytes(32).toString('hex');
  const expires = new Date(Date.now() + 24 * 60 * 60 * 1000);
  return { token, expires };
}

// 密码重置邮件
export async function sendPasswordResetEmail(email: string, token: string) {
  const resetLink = `${getFrontendUrl()}/reset-password?token=${token}`;
  
  const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #b8864a;">Password Reset Request</h2>
        <p>We received a request to reset your password for your Tarmeer account.</p>
        <p>Click the button below to set a new password:</p>
        <a href="${resetLink}" style="display: inline-block; padding: 12px 24px; background-color: #b8864a; color: white; text-decoration: none; border-radius: 8px; margin: 20px 0;">Reset Password</a>
        <p style="color: #666; font-size: 14px;">This link is valid for 1 hour.</p>
        <p style="color: #666; font-size: 14px;">If you did not request a password reset, please ignore this email.</p>
        <br>
        <p style="color: #b8864a; font-weight: bold;">Tarmeer Team</p>
      </div>
    `;
  
  if (shouldSkipRealEmail()) {
    return sendMailDevMode(email, '[Tarmeer] Reset Your Password', html);
  }
  
  await transporter.sendMail({
    from: `"Tarmeer" <${FROM_EMAIL}>`,
    to: email,
    subject: '[Tarmeer] Reset Your Password',
    html
  });
}

export function generatePasswordResetToken(): { token: string; expires: Date } {
  const token = crypto.randomBytes(32).toString('hex');
  const expires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
  return { token, expires };
}

export async function sendProjectSubmissionEmail(project: any, designer: any) {
  const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #b8864a;">Designer ${designer.full_name} submitted a new project</h2>
        <table style="width: 100%; border-collapse: collapse;">
          <tr><td style="padding: 8px 0; border-bottom: 1px solid #eee;"><strong>Project Name:</strong></td><td style="padding: 8px 0; border-bottom: 1px solid #eee;">${project.title}</td></tr>
          <tr><td style="padding: 8px 0; border-bottom: 1px solid #eee;"><strong>Style:</strong></td><td style="padding: 8px 0; border-bottom: 1px solid #eee;">${project.style || 'Not provided'}</td></tr>
          <tr><td style="padding: 8px 0; border-bottom: 1px solid #eee;"><strong>Location:</strong></td><td style="padding: 8px 0; border-bottom: 1px solid #eee;">${project.location || 'Not provided'}</td></tr>
          <tr><td style="padding: 8px 0; border-bottom: 1px solid #eee;"><strong>Area:</strong></td><td style="padding: 8px 0; border-bottom: 1px solid #eee;">${project.area || 'Not provided'}</td></tr>
          <tr><td style="padding: 8px 0; border-bottom: 1px solid #eee;"><strong>Budget:</strong></td><td style="padding: 8px 0; border-bottom: 1px solid #eee;">${project.cost || 'Not provided'}</td></tr>
          <tr><td style="padding: 8px 0;"><strong>Submission Time:</strong></td><td style="padding: 8px 0;">${new Date().toLocaleString('en-US')}</td></tr>
        </table>
        <p style="margin-top: 20px; color: #666;">Please log in to the admin panel to review.</p>
      </div>
    `;
  
  if (shouldSkipRealEmail()) {
    return sendMailDevMode(NOTIFICATION_EMAIL, '[Tarmeer] New Project Submission', html);
  }
  
  await transporter.sendMail({
    from: `"Tarmeer" <${FROM_EMAIL}>`,
    to: NOTIFICATION_EMAIL,
    subject: '[Tarmeer] New Project Submission',
    html
  });
}

export async function sendContactFormEmail(contact: any) {
  const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #b8864a;">New Client Inquiry</h2>
        <table style="width: 100%; border-collapse: collapse;">
          <tr><td style="padding: 8px 0; border-bottom: 1px solid #eee;"><strong>Name:</strong></td><td style="padding: 8px 0; border-bottom: 1px solid #eee;">${contact.name}</td></tr>
          <tr><td style="padding: 8px 0; border-bottom: 1px solid #eee;"><strong>Email:</strong></td><td style="padding: 8px 0; border-bottom: 1px solid #eee;">${contact.email || 'Not provided'}</td></tr>
          <tr><td style="padding: 8px 0; border-bottom: 1px solid #eee;"><strong>Phone:</strong></td><td style="padding: 8px 0; border-bottom: 1px solid #eee;">${contact.phone || 'Not provided'}</td></tr>
          <tr><td style="padding: 8px 0; border-bottom: 1px solid #eee;"><strong>Type:</strong></td><td style="padding: 8px 0; border-bottom: 1px solid #eee;">${contact.type}</td></tr>
          <tr><td style="padding: 8px 0; border-bottom: 1px solid #eee;"><strong>Message:</strong></td><td style="padding: 8px 0; border-bottom: 1px solid #eee;">${contact.message || 'None'}</td></tr>
          <tr><td style="padding: 8px 0;"><strong>Time:</strong></td><td style="padding: 8px 0;">${new Date().toLocaleString('en-US')}</td></tr>
        </table>
        <p style="margin-top: 20px; color: #666;">Please reply to the client promptly.</p>
      </div>
    `;
  
  if (shouldSkipRealEmail()) {
    return sendMailDevMode(NOTIFICATION_EMAIL, '[Tarmeer] New Client Inquiry', html);
  }
  
  await transporter.sendMail({
    from: `"Tarmeer" <${FROM_EMAIL}>`,
    to: NOTIFICATION_EMAIL,
    subject: '[Tarmeer] New Client Inquiry',
    html
  });
}
