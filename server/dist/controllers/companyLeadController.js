"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.submitCompanyLead = submitCompanyLead;
exports.checkCompanyPhone = checkCompanyPhone;
exports.getCompanyLeads = getCompanyLeads;
const database_1 = __importDefault(require("../config/database"));
const analyticsEvents_1 = require("../lib/analyticsEvents");
const crmPush_1 = require("../lib/crmPush");
async function submitCompanyLead(req, res) {
    try {
        const { contactName: _contactName, phone, companyName: _companyName, city, companyType, yearEstablished, scopeOfBusiness, lang } = req.body;
        const contactName = _contactName?.slice(0, 100) || _contactName;
        const companyName = _companyName?.slice(0, 200) || _companyName;
        const sourcePage = (req.headers.referer || null)?.slice(0, 500) || null;
        // Check if phone number already registered.
        // 同时查 users.phone 与 company_profiles.phone —— 注册电话可能只落在 profile 未同步到 users，
        // 只查 users 会漏（正是重复注册的成因之一）。仅拦「已注册」的号引导登录，不拦未注册号的重复线索。
        if (phone) {
            const [userRows] = await database_1.default.execute(`SELECT u.id,
                (SELECT COUNT(*) FROM company_profiles cp WHERE cp.user_id = u.id LIMIT 1) AS has_company
         FROM users u WHERE u.phone = ? AND u.deleted_at IS NULL LIMIT 1`, [phone]);
            const existingUser = userRows[0];
            const [profileRows] = await database_1.default.execute('SELECT id FROM company_profiles WHERE phone = ? AND deleted_at IS NULL LIMIT 1', [phone]);
            if (existingUser || profileRows.length > 0) {
                return res.status(409).json({
                    phoneExists: true,
                    hasCompanyProfile: (existingUser?.has_company > 0) || profileRows.length > 0,
                });
            }
        }
        const [result] = await database_1.default.execute(`INSERT INTO company_leads (contact_name, phone, company_name, company_type, city, year_established, scope_of_business, lang, source_page)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`, [contactName, phone, companyName, companyType || null, city || null, yearEstablished || null, scopeOfBusiness || null, lang || 'en', sourcePage]);
        const leadId = result.insertId;
        // Push to admin SSE subscribers — both company_lead and the mirrored inquiry
        analyticsEvents_1.analyticsEvents.notifyChange('company_lead');
        // Mirror into design_inquiries so it appears in the admin Company inquiries tab
        const inquiryMessage = [
            `[Company Inquiry]`,
            `Company: ${companyName}`,
            companyType ? `Type: ${companyType}` : '',
            yearEstablished ? `Est. ${yearEstablished}` : '',
        ].filter(Boolean).join(' | ');
        database_1.default.execute(`INSERT INTO design_inquiries (name, phone, city, area_range, message, source_company_name, crm_sync_status)
       VALUES (?, ?, ?, ?, ?, ?, 'synced')`, [contactName, phone, city || null, companyType || 'company-lead', inquiryMessage, companyName]).then(() => analyticsEvents_1.analyticsEvents.notifyChange('inquiry')).catch(() => { });
        // Fire-and-forget CRM push (company tenant)
        // notes field carries company_type so CRM sales team sees it
        (0, crmPush_1.pushCompanyLeadToCRM)({
            applicationId: leadId,
            contactName: contactName || undefined,
            companyName: companyName || contactName,
            phone: phone || undefined,
            city: city || undefined,
            licenseNumber: undefined,
            page: sourcePage || undefined,
            description: [
                companyType ? `Type: ${companyType}` : '',
                yearEstablished ? `Est. ${yearEstablished}` : '',
                scopeOfBusiness ? `Scope: ${scopeOfBusiness}` : '',
            ].filter(Boolean).join(', ') || undefined,
        }).catch(() => { });
        const [lead] = await database_1.default.execute('SELECT * FROM company_leads WHERE id = ?', [leadId]);
        res.status(201).json({
            message: 'Submitted successfully. We will contact you soon.',
            lead: lead[0],
        });
    }
    catch (error) {
        console.error('Submit company lead error:', error);
        res.status(500).json({ error: 'Submission failed. Please try again.' });
    }
}
async function checkCompanyPhone(req, res) {
    try {
        const phone = req.query.phone;
        if (!phone)
            return res.json({ exists: false });
        const [[userRows], [profileRows]] = await Promise.all([
            database_1.default.execute(`SELECT id,
                (SELECT COUNT(*) FROM company_profiles cp WHERE cp.user_id = users.id LIMIT 1) AS has_company
         FROM users WHERE phone = ? AND deleted_at IS NULL LIMIT 1`, [phone]),
            database_1.default.execute('SELECT id FROM company_leads WHERE phone = ? LIMIT 1', [phone]),
        ]);
        const user = userRows[0];
        const lead = profileRows[0];
        if (user || lead) {
            return res.json({
                exists: true,
                hasAccount: !!user,
                hasCompanyProfile: user ? user.has_company > 0 : false,
            });
        }
        res.json({ exists: false });
    }
    catch (error) {
        console.error('checkCompanyPhone error:', error);
        res.json({ exists: false });
    }
}
async function getCompanyLeads(req, res) {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const offset = (page - 1) * limit;
        const status = req.query.status;
        let whereClause = 'WHERE 1=1';
        const params = [];
        if (status) {
            whereClause += ' AND status = ?';
            params.push(status);
        }
        const [countResult] = await database_1.default.execute(`SELECT COUNT(*) as total FROM company_leads ${whereClause}`, params);
        const total = countResult[0].total;
        const [leads] = await database_1.default.execute(`SELECT * FROM company_leads ${whereClause} ORDER BY created_at DESC LIMIT ? OFFSET ?`, [...params, limit, offset]);
        res.json({
            leads,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
            },
        });
    }
    catch (error) {
        console.error('Get company leads error:', error);
        res.status(500).json({ error: 'Failed to load company leads.' });
    }
}
