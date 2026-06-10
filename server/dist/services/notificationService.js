"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createNotification = createNotification;
exports.notifyNewInquiry = notifyNewInquiry;
exports.notifyCompanyRegistration = notifyCompanyRegistration;
exports.notifyUserRegistration = notifyUserRegistration;
exports.notifySupplierRegistration = notifySupplierRegistration;
exports.notifyNewCompanyLead = notifyNewCompanyLead;
const database_1 = __importDefault(require("../config/database"));
const email_1 = require("../config/email");
async function createNotification(data) {
    try {
        await database_1.default.execute(`INSERT INTO notifications (user_id, type, title, message, link) VALUES (?, ?, ?, ?, ?)`, [data.userId || null, data.type, data.title, data.message, data.link || null]);
    }
    catch (err) {
        console.error('[Notification] Failed to create:', err);
    }
}
// ============================================================
// Group email notification
// ============================================================
async function getActiveNotificationEmails() {
    try {
        const [rows] = await database_1.default.execute('SELECT email FROM notification_emails WHERE is_active = 1');
        return rows.map((r) => r.email);
    }
    catch {
        return [];
    }
}
async function sendGroupEmail(subject, html, text) {
    const recipients = await getActiveNotificationEmails();
    if (recipients.length === 0) {
        console.log('[Notification] No active email recipients configured, skipping email');
        return;
    }
    if ((0, email_1.shouldSkipRealEmail)()) {
        (0, email_1.sendMailDevMode)(recipients.join(', '), subject, html);
        return;
    }
    try {
        await email_1.transporter.sendMail({
            from: `"${email_1.FROM_NAME}" <${email_1.FROM_EMAIL}>`,
            to: recipients.join(', '),
            subject,
            html,
            text,
            replyTo: email_1.REPLY_TO_EMAIL,
            envelope: {
                from: email_1.RETURN_PATH_EMAIL,
                to: recipients,
            },
        });
    }
    catch (err) {
        console.error('[Notification] Group email failed:', err);
    }
}
async function notifyNewInquiry(inquiry) {
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
    const sourceLabel = inquiry.sourcePage ? (SOURCE_LABELS[inquiry.sourcePage] || inquiry.sourcePage) : null;
    const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #b8864a;">新设计询单</h2>
      <table style="width: 100%; border-collapse: collapse;">
        <tr><td style="padding: 8px 0; border-bottom: 1px solid #eee;"><strong>Name:</strong></td><td style="padding: 8px 0; border-bottom: 1px solid #eee;">${inquiry.name}</td></tr>
        <tr><td style="padding: 8px 0; border-bottom: 1px solid #eee;"><strong>Phone:</strong></td><td style="padding: 8px 0; border-bottom: 1px solid #eee;">${inquiry.phone}</td></tr>
        <tr><td style="padding: 8px 0; border-bottom: 1px solid #eee;"><strong>City:</strong></td><td style="padding: 8px 0; border-bottom: 1px solid #eee;">${inquiry.city}</td></tr>
        <tr><td style="padding: 8px 0; border-bottom: 1px solid #eee;"><strong>Area:</strong></td><td style="padding: 8px 0; border-bottom: 1px solid #eee;">${inquiry.area_range}</td></tr>
        ${inquiry.companyName ? `<tr><td style="padding: 8px 0; border-bottom: 1px solid #eee;"><strong>Company:</strong></td><td style="padding: 8px 0; border-bottom: 1px solid #eee;">${inquiry.companyName}</td></tr>` : ''}
        ${sourceLabel ? `<tr><td style="padding: 8px 0; border-bottom: 1px solid #eee;"><strong>来源:</strong></td><td style="padding: 8px 0; border-bottom: 1px solid #eee; color: #b8864a;"><strong>${sourceLabel}</strong></td></tr>` : ''}
        ${inquiry.message ? `<tr><td style="padding: 8px 0; border-bottom: 1px solid #eee;"><strong>Message:</strong></td><td style="padding: 8px 0; border-bottom: 1px solid #eee;">${inquiry.message}</td></tr>` : ''}
        <tr><td style="padding: 8px 0;"><strong>Time:</strong></td><td style="padding: 8px 0;">${new Date().toLocaleString('en-US')}</td></tr>
      </table>
    </div>
  `;
    const text = `New Inquiry: ${inquiry.name}, ${inquiry.phone}, ${inquiry.city}, ${inquiry.area_range}`;
    await sendGroupEmail('[Tarmeer] 新设计询单', html, text);
}
const SOURCE_LABELS = {
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
    'supplier-email': '供应商门户邮箱注册',
    'supplier-google': '供应商门户 Google 登录',
};
async function notifyCompanyRegistration(company) {
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
    const typeLabels = {
        design_studio: 'Design Studio', renovation_company: 'Renovation & Fit-out',
        general_contractor: 'General Contractor', mep_contractor: 'MEP Contractor',
        maintenance_company: 'Maintenance Company', specialty_trade: 'Specialty Trade',
        landscaping: 'Landscaping', swimming_pool: 'Swimming Pool', furnishing: 'Furnishing',
    };
    const typeLabel = typeLabels[company.companyType] || company.companyType;
    const sourceLabel = company.signupSource ? (SOURCE_LABELS[company.signupSource] || company.signupSource) : '未知';
    const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #b8864a;">新装修公司注册</h2>
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
    await sendGroupEmail('[Tarmeer] 新装修公司注册', html, text);
}
async function notifyUserRegistration(user) {
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
      <h2 style="color: #b8864a;">新${roleLabel}注册</h2>
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
    await sendGroupEmail(`[Tarmeer] 新${roleLabel}注册`, html, text);
}
async function notifySupplierRegistration(supplier) {
    const sourceLabel = supplier.signupSource ? (SOURCE_LABELS[supplier.signupSource] || supplier.signupSource) : '未知';
    const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #b8864a;">新供应商注册</h2>
      <table style="width: 100%; border-collapse: collapse;">
        <tr><td style="padding: 8px 0; border-bottom: 1px solid #eee;"><strong>姓名:</strong></td><td style="padding: 8px 0; border-bottom: 1px solid #eee;">${supplier.fullName || '—'}</td></tr>
        <tr><td style="padding: 8px 0; border-bottom: 1px solid #eee;"><strong>邮箱:</strong></td><td style="padding: 8px 0; border-bottom: 1px solid #eee;">${supplier.email}</td></tr>
        <tr><td style="padding: 8px 0; border-bottom: 1px solid #eee;"><strong>注册渠道:</strong></td><td style="padding: 8px 0; border-bottom: 1px solid #eee; color: #b8864a;"><strong>${sourceLabel}</strong></td></tr>
        <tr><td style="padding: 8px 0;"><strong>时间:</strong></td><td style="padding: 8px 0;">${new Date().toLocaleString('zh-CN')}</td></tr>
      </table>
      <p style="margin-top: 16px;"><a href="https://admin.tarmeer.com/admin/suppliers" style="color: #b8864a;">在管理后台查看 →</a></p>
    </div>
  `;
    const text = `新供应商: ${supplier.fullName || supplier.email}, ${supplier.email} | 渠道: ${sourceLabel}`;
    await createNotification({
        type: 'user_registration',
        title: `新供应商注册: ${supplier.fullName || supplier.email}`,
        message: `${supplier.email} 通过 ${sourceLabel} 注册`,
        link: '/admin/suppliers',
    });
    await sendGroupEmail('[Tarmeer] 新供应商注册', html, text);
}
async function notifyNewCompanyLead(lead) {
    const title = `New company lead: ${lead.companyName || lead.contactName}`;
    const msg = `${lead.contactName} (${lead.phone}) — ${lead.companyName}, ${lead.city}`;
    await createNotification({
        type: 'company_lead',
        title,
        message: msg,
        link: '/admin/inquiries?type=company',
    });
    const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #b8864a;">🏢 新装修公司线索</h2>
      <p style="color: #6b6b6b;">装修公司通过落地页提交了合作意向。</p>
      <table style="width: 100%; border-collapse: collapse;">
        <tr><td style="padding: 8px 0; border-bottom: 1px solid #eee;"><strong>Contact:</strong></td><td style="padding: 8px 0; border-bottom: 1px solid #eee;">${lead.contactName}</td></tr>
        <tr><td style="padding: 8px 0; border-bottom: 1px solid #eee;"><strong>Company:</strong></td><td style="padding: 8px 0; border-bottom: 1px solid #eee;">${lead.companyName || '—'}</td></tr>
        <tr><td style="padding: 8px 0; border-bottom: 1px solid #eee;"><strong>Phone:</strong></td><td style="padding: 8px 0; border-bottom: 1px solid #eee;">${lead.phone}</td></tr>
        <tr><td style="padding: 8px 0; border-bottom: 1px solid #eee;"><strong>City:</strong></td><td style="padding: 8px 0; border-bottom: 1px solid #eee;">${lead.city || '—'}</td></tr>
        <tr><td style="padding: 8px 0; border-bottom: 1px solid #eee;"><strong>Type:</strong></td><td style="padding: 8px 0; border-bottom: 1px solid #eee;">${lead.companyType || '—'}</td></tr>
        <tr><td style="padding: 8px 0; border-bottom: 1px solid #eee;"><strong>Source:</strong></td><td style="padding: 8px 0; border-bottom: 1px solid #eee; color: #b8864a;"><strong>${lead.sourcePage}</strong></td></tr>
        <tr><td style="padding: 8px 0;"><strong>Time:</strong></td><td style="padding: 8px 0;">${new Date().toLocaleString('en-US')}</td></tr>
      </table>
      <p style="margin-top: 16px;"><a href="https://admin.tarmeer.com/admin/inquiries?type=company" style="color: #b8864a;">View in Admin →</a></p>
    </div>
  `;
    const text = `New Company Lead: ${lead.contactName}, ${lead.companyName}, ${lead.phone}, ${lead.city}`;
    await sendGroupEmail('[Tarmeer] 🏢 新装修公司线索', html, text);
}
