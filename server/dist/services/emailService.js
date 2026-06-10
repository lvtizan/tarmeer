"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendVerificationEmail = sendVerificationEmail;
exports.generateVerificationToken = generateVerificationToken;
exports.sendPasswordResetEmail = sendPasswordResetEmail;
exports.sendAdminPasswordResetEmail = sendAdminPasswordResetEmail;
exports.generatePasswordResetToken = generatePasswordResetToken;
exports.sendContactFormEmail = sendContactFormEmail;
exports.sendProjectRejectionEmail = sendProjectRejectionEmail;
const email_1 = require("../config/email");
const crypto_1 = __importDefault(require("crypto"));
const DEFAULT_FRONTEND_URL = process.env.FRONTEND_URL || 'https://www.tarmeer.com';
function normalizeFrontendUrl(frontendUrl) {
    return frontendUrl || DEFAULT_FRONTEND_URL;
}
async function sendTransactionalMail({ to, subject, html, text }) {
    if ((0, email_1.shouldSkipRealEmail)()) {
        return (0, email_1.sendMailDevMode)(to, subject, html);
    }
    return email_1.transporter.sendMail({
        from: `"${email_1.FROM_NAME}" <${email_1.FROM_EMAIL}>`,
        to,
        subject,
        html,
        text,
        replyTo: email_1.REPLY_TO_EMAIL,
        envelope: {
            from: email_1.RETURN_PATH_EMAIL,
            to,
        },
    });
}
async function sendVerificationEmail(email, fullName, token, frontendUrl) {
    const verificationLink = `${normalizeFrontendUrl(frontendUrl)}/verify-email?token=${token}`;
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
    const text = [
        `Dear ${fullName},`,
        '',
        'Thank you for registering on Tarmeer Designer Platform.',
        'Please verify your email address with the link below:',
        verificationLink,
        '',
        'This link is valid for 24 hours.',
        'If you did not register for a Tarmeer account, please ignore this email.',
        '',
        'Tarmeer Team',
    ].join('\n');
    await sendTransactionalMail({
        to: email,
        subject: '[Tarmeer] Verify Your Email Address',
        html,
        text,
    });
}
function generateVerificationToken() {
    const token = crypto_1.default.randomBytes(32).toString('hex');
    const expires = new Date(Date.now() + 24 * 60 * 60 * 1000);
    return { token, expires };
}
// 密码重置邮件
async function sendPasswordResetEmail(email, token, frontendUrl) {
    const resetLink = `${normalizeFrontendUrl(frontendUrl)}/reset-password?token=${token}`;
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
    const text = [
        'Password Reset Request',
        '',
        'We received a request to reset your password for your Tarmeer account.',
        'Use the link below to set a new password:',
        resetLink,
        '',
        'This link is valid for 1 hour.',
        'If you did not request a password reset, please ignore this email.',
        '',
        'Tarmeer Team',
    ].join('\n');
    await sendTransactionalMail({
        to: email,
        subject: '[Tarmeer] Reset Your Password',
        html,
        text,
    });
}
async function sendAdminPasswordResetEmail(email, token, frontendUrl) {
    const resetLink = `${normalizeFrontendUrl(frontendUrl)}/admin/reset-password?token=${token}`;
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #b8864a;">Admin Password Reset Request</h2>
        <p>We received a request to reset your Tarmeer admin password.</p>
        <p>Click the button below to set a new password:</p>
        <a href="${resetLink}" style="display: inline-block; padding: 12px 24px; background-color: #b8864a; color: white; text-decoration: none; border-radius: 8px; margin: 20px 0;">Reset Admin Password</a>
        <p style="color: #666; font-size: 14px;">This link is valid for 1 hour.</p>
        <p style="color: #666; font-size: 14px;">If you did not request a password reset, please ignore this email.</p>
        <br>
        <p style="color: #b8864a; font-weight: bold;">Tarmeer Team</p>
      </div>
    `;
    const text = [
        'Admin Password Reset Request',
        '',
        'We received a request to reset your Tarmeer admin password.',
        'Use the link below to set a new password:',
        resetLink,
        '',
        'This link is valid for 1 hour.',
        'If you did not request a password reset, please ignore this email.',
        '',
        'Tarmeer Team',
    ].join('\n');
    await sendTransactionalMail({
        to: email,
        subject: '[Tarmeer Admin] Reset Your Password',
        html,
        text,
    });
}
function generatePasswordResetToken() {
    const token = crypto_1.default.randomBytes(32).toString('hex');
    const expires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
    return { token, expires };
}
async function sendContactFormEmail(contact) {
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
    const text = [
        'New Client Inquiry',
        `Name: ${contact.name}`,
        `Email: ${contact.email || 'Not provided'}`,
        `Phone: ${contact.phone || 'Not provided'}`,
        `Type: ${contact.type}`,
        `Message: ${contact.message || 'None'}`,
        `Time: ${new Date().toLocaleString('en-US')}`,
    ].join('\n');
    await sendTransactionalMail({
        to: email_1.NOTIFICATION_EMAIL,
        subject: '[Tarmeer] 新客户咨询',
        html,
        text,
    });
}
async function sendProjectRejectionEmail(to, companyName, projectTitle, rejectionReason, projectListUrl) {
    const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #333;">
      <h2 style="color: #b8864a;">Your project submission was not approved</h2>
      <p>Hi <strong>${companyName}</strong>,</p>
      <p>We reviewed your recently submitted project <strong>"${projectTitle}"</strong> and it does not meet our content guidelines at this time.</p>
      <table style="width:100%; border-collapse:collapse; margin: 16px 0;">
        <tr>
          <td style="padding: 10px 12px; background:#fef2f2; border-left: 4px solid #ef4444; color:#7f1d1d; font-size:14px;">
            <strong>Reason:</strong> ${rejectionReason}
          </td>
        </tr>
      </table>
      <p>Please update your project photos to show interior design or renovation work, then resubmit for review.</p>
      <a href="${projectListUrl}" style="display:inline-block; padding:12px 24px; background-color:#b8864a; color:white; text-decoration:none; border-radius:8px; margin:16px 0; font-size:14px;">
        View &amp; Edit Your Projects
      </a>
      <p style="color:#666; font-size:13px;">If you have any questions, feel free to contact our support team.</p>
      <p style="color:#b8864a; font-weight:bold;">The Tarmeer Team</p>
    </div>
  `;
    const text = [
        `Your project submission was not approved`,
        ``,
        `Hi ${companyName},`,
        ``,
        `We reviewed your project "${projectTitle}" and it does not meet our content guidelines.`,
        ``,
        `Reason: ${rejectionReason}`,
        ``,
        `Please update your project photos (interior design / renovation work) and resubmit.`,
        ``,
        `View & Edit Your Projects: ${projectListUrl}`,
        ``,
        `The Tarmeer Team`,
    ].join('\n');
    await sendTransactionalMail({
        to,
        subject: `Your project "${projectTitle}" was not approved — Tarmeer`,
        html,
        text,
    });
}
