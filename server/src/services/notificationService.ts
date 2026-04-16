import pool from '../config/database';
import { transporter, FROM_EMAIL, FROM_NAME, REPLY_TO_EMAIL, RETURN_PATH_EMAIL, shouldSkipRealEmail, sendMailDevMode } from '../config/email';

// ============================================================
// In-app notification
// ============================================================

interface CreateNotification {
  userId?: number | null; // null = admin broadcast
  type: 'inquiry' | 'company_registration' | 'user_registration' | 'system';
  title: string;
  message: string;
  link?: string;
}

export async function createNotification(data: CreateNotification) {
  try {
    await pool.execute(
      `INSERT INTO notifications (user_id, type, title, message, link) VALUES (?, ?, ?, ?, ?)`,
      [data.userId || null, data.type, data.title, data.message, data.link || null]
    );
  } catch (err) {
    console.error('[Notification] Failed to create:', err);
  }
}

// ============================================================
// Group email notification
// ============================================================

async function getActiveNotificationEmails(): Promise<string[]> {
  try {
    const [rows] = await pool.execute(
      'SELECT email FROM notification_emails WHERE is_active = 1'
    );
    return (rows as any[]).map((r: any) => r.email);
  } catch {
    return [];
  }
}

async function sendGroupEmail(subject: string, html: string, text: string) {
  const recipients = await getActiveNotificationEmails();
  if (recipients.length === 0) {
    console.log('[Notification] No active email recipients configured, skipping email');
    return;
  }

  if (shouldSkipRealEmail()) {
    sendMailDevMode(recipients.join(', '), subject, html);
    return;
  }

  try {
    await transporter.sendMail({
      from: `"${FROM_NAME}" <${FROM_EMAIL}>`,
      to: recipients.join(', '),
      subject,
      html,
      text,
      replyTo: REPLY_TO_EMAIL,
      envelope: {
        from: RETURN_PATH_EMAIL,
        to: recipients,
      },
    });
  } catch (err) {
    console.error('[Notification] Group email failed:', err);
  }
}

// ============================================================
// Event handlers
// ============================================================

interface InquiryData {
  id: number;
  name: string;
  phone: string;
  city: string;
  area_range: string;
  message?: string;
  companyName?: string;
}

export async function notifyNewInquiry(inquiry: InquiryData) {
  const title = `New inquiry from ${inquiry.name}`;
  const msg = `${inquiry.name} (${inquiry.phone}) in ${inquiry.city}, area ${inquiry.area_range}${inquiry.companyName ? ` - for ${inquiry.companyName}` : ''}`;

  // In-app (broadcast to admins)
  await createNotification({
    type: 'inquiry',
    title,
    message: msg,
    link: '/admin/inquiries',
  });

  // Group email
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #b8864a;">New Design Inquiry</h2>
      <table style="width: 100%; border-collapse: collapse;">
        <tr><td style="padding: 8px 0; border-bottom: 1px solid #eee;"><strong>Name:</strong></td><td style="padding: 8px 0; border-bottom: 1px solid #eee;">${inquiry.name}</td></tr>
        <tr><td style="padding: 8px 0; border-bottom: 1px solid #eee;"><strong>Phone:</strong></td><td style="padding: 8px 0; border-bottom: 1px solid #eee;">${inquiry.phone}</td></tr>
        <tr><td style="padding: 8px 0; border-bottom: 1px solid #eee;"><strong>City:</strong></td><td style="padding: 8px 0; border-bottom: 1px solid #eee;">${inquiry.city}</td></tr>
        <tr><td style="padding: 8px 0; border-bottom: 1px solid #eee;"><strong>Area:</strong></td><td style="padding: 8px 0; border-bottom: 1px solid #eee;">${inquiry.area_range}</td></tr>
        ${inquiry.message ? `<tr><td style="padding: 8px 0; border-bottom: 1px solid #eee;"><strong>Message:</strong></td><td style="padding: 8px 0; border-bottom: 1px solid #eee;">${inquiry.message}</td></tr>` : ''}
        ${inquiry.companyName ? `<tr><td style="padding: 8px 0; border-bottom: 1px solid #eee;"><strong>Company:</strong></td><td style="padding: 8px 0; border-bottom: 1px solid #eee;">${inquiry.companyName}</td></tr>` : ''}
        <tr><td style="padding: 8px 0;"><strong>Time:</strong></td><td style="padding: 8px 0;">${new Date().toLocaleString('en-US')}</td></tr>
      </table>
    </div>
  `;
  const text = `New Inquiry: ${inquiry.name}, ${inquiry.phone}, ${inquiry.city}, ${inquiry.area_range}`;

  await sendGroupEmail('[Tarmeer] New Design Inquiry', html, text);
}

interface CompanyData {
  companyName: string;
  contactPerson: string;
  phone: string;
  city: string;
  companyType: string;
  services: string[];
  signupSource?: string;
}

const SOURCE_LABELS: Record<string, string> = {
  'for-companies-landing': '企业落地页（/for-companies）',
  'join-page': '注册页邮箱（/join）',
  'join-page-google': '注册页 Google 登录（/join）',
  'auth-page': '登录页邮箱（/auth）',
  'auth-page-google': '登录页 Google 登录（/auth）',
  'google-oauth': 'Google OAuth（业主）',
  'google-oauth-company': 'Google OAuth（企业）',
  'google-one-tap': 'Google One Tap 弹窗',
  'designer-application': '设计师申请',
  'home-banner': '首页 Banner',
};

export async function notifyCompanyRegistration(company: CompanyData) {
  const title = `New company registered: ${company.companyName}`;
  const msg = `${company.companyName} (${company.companyType}) in ${company.city}, contact: ${company.contactPerson}`;

  // In-app
  await createNotification({
    type: 'company_registration',
    title,
    message: msg,
    link: '/admin/companies',
  });

  // Group email
  const typeLabels: Record<string, string> = {
    design_studio: 'Design Studio', renovation_company: 'Renovation & Fit-out',
    general_contractor: 'General Contractor', mep_contractor: 'MEP Contractor',
    maintenance_company: 'Maintenance Company', specialty_trade: 'Specialty Trade',
    landscaping: 'Landscaping & Pools', furnishing: 'Furnishing',
  };
  const typeLabel = typeLabels[company.companyType] || company.companyType;
  const sourceLabel = company.signupSource ? (SOURCE_LABELS[company.signupSource] || company.signupSource) : '未知';
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #b8864a;">New Company Registration</h2>
      <table style="width: 100%; border-collapse: collapse;">
        <tr><td style="padding: 8px 0; border-bottom: 1px solid #eee;"><strong>Company:</strong></td><td style="padding: 8px 0; border-bottom: 1px solid #eee;">${company.companyName}</td></tr>
        <tr><td style="padding: 8px 0; border-bottom: 1px solid #eee;"><strong>Type:</strong></td><td style="padding: 8px 0; border-bottom: 1px solid #eee;">${typeLabel}</td></tr>
        <tr><td style="padding: 8px 0; border-bottom: 1px solid #eee;"><strong>Contact:</strong></td><td style="padding: 8px 0; border-bottom: 1px solid #eee;">${company.contactPerson}</td></tr>
        <tr><td style="padding: 8px 0; border-bottom: 1px solid #eee;"><strong>Phone:</strong></td><td style="padding: 8px 0; border-bottom: 1px solid #eee;">${company.phone}</td></tr>
        <tr><td style="padding: 8px 0; border-bottom: 1px solid #eee;"><strong>City:</strong></td><td style="padding: 8px 0; border-bottom: 1px solid #eee;">${company.city}</td></tr>
        <tr><td style="padding: 8px 0; border-bottom: 1px solid #eee;"><strong>Services:</strong></td><td style="padding: 8px 0; border-bottom: 1px solid #eee;">${company.services.join(', ')}</td></tr>
        <tr><td style="padding: 8px 0; border-bottom: 1px solid #eee;"><strong>注册渠道:</strong></td><td style="padding: 8px 0; border-bottom: 1px solid #eee; color: #b8864a;"><strong>${sourceLabel}</strong></td></tr>
        <tr><td style="padding: 8px 0;"><strong>Time:</strong></td><td style="padding: 8px 0;">${new Date().toLocaleString('en-US')}</td></tr>
      </table>
      <p style="margin-top: 20px; color: #666;">Please log in to the admin panel to review and approve.</p>
    </div>
  `;
  const text = `New Company: ${company.companyName} (${typeLabel}), ${company.contactPerson}, ${company.phone}, ${company.city} | 渠道: ${sourceLabel}`;

  await sendGroupEmail('[Tarmeer] New Company Registration', html, text);
}

// ============================================================
// New user/homeowner registration notification
// ============================================================

interface UserData {
  email: string;
  fullName: string;
  phone?: string | null;
  city?: string | null;
  role: string;
  signupSource?: string | null;
}

export async function notifyUserRegistration(user: UserData) {
  const title = `New user registered: ${user.fullName || user.email}`;
  const msg = `${user.fullName || user.email} (${user.role})${user.city ? ' in ' + user.city : ''}`;

  // In-app
  await createNotification({
    type: 'user_registration',
    title,
    message: msg,
    link: '/admin/users',
  });

  const sourceLabel = user.signupSource ? (SOURCE_LABELS[user.signupSource] || user.signupSource) : '未知';
  const roleLabel = user.role === 'homeowner' || user.role === 'user' ? '业主' : user.role === 'designer' ? '设计师' : user.role;

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #b8864a;">New User Registration</h2>
      <table style="width: 100%; border-collapse: collapse;">
        <tr><td style="padding: 8px 0; border-bottom: 1px solid #eee;"><strong>Name:</strong></td><td style="padding: 8px 0; border-bottom: 1px solid #eee;">${user.fullName || '—'}</td></tr>
        <tr><td style="padding: 8px 0; border-bottom: 1px solid #eee;"><strong>Email:</strong></td><td style="padding: 8px 0; border-bottom: 1px solid #eee;">${user.email}</td></tr>
        <tr><td style="padding: 8px 0; border-bottom: 1px solid #eee;"><strong>Role:</strong></td><td style="padding: 8px 0; border-bottom: 1px solid #eee;">${roleLabel}</td></tr>
        <tr><td style="padding: 8px 0; border-bottom: 1px solid #eee;"><strong>Phone:</strong></td><td style="padding: 8px 0; border-bottom: 1px solid #eee;">${user.phone || '—'}</td></tr>
        <tr><td style="padding: 8px 0; border-bottom: 1px solid #eee;"><strong>City:</strong></td><td style="padding: 8px 0; border-bottom: 1px solid #eee;">${user.city || '—'}</td></tr>
        <tr><td style="padding: 8px 0; border-bottom: 1px solid #eee;"><strong>注册渠道:</strong></td><td style="padding: 8px 0; border-bottom: 1px solid #eee; color: #b8864a;"><strong>${sourceLabel}</strong></td></tr>
        <tr><td style="padding: 8px 0;"><strong>Time:</strong></td><td style="padding: 8px 0;">${new Date().toLocaleString('en-US')}</td></tr>
      </table>
    </div>
  `;
  const text = `New ${roleLabel}: ${user.fullName || user.email}, ${user.phone || '—'}, ${user.city || '—'} | 渠道: ${sourceLabel}`;

  await sendGroupEmail(`[Tarmeer] New ${roleLabel} Registration`, html, text);
}
