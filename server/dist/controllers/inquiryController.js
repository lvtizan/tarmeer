"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.submitInquiry = submitInquiry;
exports.getInquiries = getInquiries;
exports.updateInquiryStatus = updateInquiryStatus;
exports.exportInquiries = exportInquiries;
exports.batchDeleteInquiries = batchDeleteInquiries;
exports.batchRestoreInquiries = batchRestoreInquiries;
exports.getMyInquiries = getMyInquiries;
exports.updateMyInquiryStatus = updateMyInquiryStatus;
exports.resendCrmSync = resendCrmSync;
const database_1 = __importDefault(require("../config/database"));
const detectCountry_1 = require("../lib/detectCountry");
const exceljs_1 = __importDefault(require("exceljs"));
const analyticsEvents_1 = require("../lib/analyticsEvents");
const notificationService_1 = require("../services/notificationService");
const crmPush_1 = require("../lib/crmPush");
const activityLogger_1 = require("../lib/activityLogger");
// Build the LeadPayload from a design_inquiries DB row. Used by both initial
// submit (fire-and-forget) and admin manual resend.
function buildLeadFromRow(row) {
    const companyName = row.source_company_name || undefined;
    const notes = [
        companyName ? `Company: ${companyName}` : '',
        row.message || '',
    ]
        .filter(Boolean)
        .join(' | ') || undefined;
    return {
        inquiryId: row.id,
        externalId: `inquiry-${row.id}`,
        name: row.name || 'Anonymous',
        phone: row.phone,
        city: row.city || undefined,
        area: row.area_range || undefined,
        notes,
        page: undefined,
    };
}
// 必须与前端城市选项保持一致：AE = Banner/ServiceInquiryCard 的 UAE_CITIES，VN = VN_CITIES
const VALID_CITIES = [
    'Dubai', 'Abu Dhabi', 'Sharjah', 'Ajman', 'Ras Al Khaimah', 'Fujairah', 'Umm Al Quwain',
    'Hồ Chí Minh', 'Hà Nội', 'Đà Nẵng', 'Bình Dương', 'Đồng Nai', 'Cần Thơ', 'Hải Phòng', 'Nha Trang',
];
// Area is stored as a free-form short string (e.g. "2500m²"). Validate length only.
const MAX_AREA_LENGTH = 64;
// Submit inquiry (public, no auth required)
async function submitInquiry(req, res) {
    try {
        const { name, phone, city, area_range, message, company_id, expert_id, source_company_name, source_company_slug, source_page } = req.body;
        // 专家询价无面积字段：area_range 仅装企询价必填
        if (!phone || (!area_range && !expert_id)) {
            return res.status(400).json({ error: 'Phone and area range are required.' });
        }
        if (city && !VALID_CITIES.includes(city)) {
            return res.status(400).json({ error: 'Invalid city.' });
        }
        if (area_range && (typeof area_range !== 'string' || area_range.length > MAX_AREA_LENGTH)) {
            return res.status(400).json({ error: 'Invalid area.' });
        }
        const [result] = await database_1.default.execute(`INSERT INTO design_inquiries (name, phone, city, area_range, message, company_id, expert_id, source_company_name, source_company_slug)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`, [name || null, phone, city || null, area_range || '', message || null, company_id || null, expert_id || null, source_company_name || null, source_company_slug || null]);
        const inquiryId = result.insertId;
        // Push to admin SSE subscribers (real-time map animation)
        analyticsEvents_1.analyticsEvents.notifyChange('inquiry');
        setImmediate(() => {
            (0, activityLogger_1.logActivity)({
                userId: req.user?.userId || null, userName: req.body.name || 'Anonymous', userRole: 'homeowner',
                action: 'create', targetType: 'inquiry', targetId: inquiryId,
                targetName: req.body.source_company_name || '',
                description: `向「${req.body.source_company_name || '未知公司'}」提交了询盘`,
                ip: (0, activityLogger_1.getClientIp)(req),
                metadata: {
                    submitter: req.body.name || null,
                    company: req.body.source_company_name || null,
                    city: req.body.city || null,
                    area: req.body.area_range || null,
                    phone: req.body.phone ? String(req.body.phone).slice(0, 4) + '****' : null,
                },
            }).catch(() => { });
        });
        // Async notification (don't block response)
        const companyName = source_company_name || undefined;
        setImmediate(() => {
            (0, notificationService_1.notifyNewInquiry)({ id: inquiryId, name: name || 'Anonymous', phone, city, area_range, message, companyName, sourcePage: source_page || undefined }).catch(() => { });
        });
        // Push to CRM (fire-and-forget)
        (0, crmPush_1.pushLeadToCRM)({
            inquiryId,
            externalId: `inquiry-${inquiryId}`,
            name: name || 'Anonymous',
            phone,
            city: city || undefined,
            area: area_range || undefined,
            notes: [companyName ? `Company: ${companyName}` : '', message || ''].filter(Boolean).join(' | ') || undefined,
            page: source_page || undefined,
            company: source_company_name || undefined,
        }).catch(() => { });
        res.status(201).json({
            message: 'Inquiry submitted successfully. We will contact you soon.',
            inquiryId,
        });
    }
    catch (error) {
        console.error('Submit inquiry error:', error);
        res.status(500).json({ error: 'Failed to submit inquiry.' });
    }
}
// List inquiries (admin only)
async function getInquiries(req, res) {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const offset = (page - 1) * limit;
        const { status, designer_id, company_id, search, type } = req.query;
        const showDeleted = req.query.deleted === 'true';
        let where = 'WHERE 1=1';
        const params = [];
        if (showDeleted) {
            where += ' AND di.deleted_at IS NOT NULL';
        }
        else {
            where += ' AND di.deleted_at IS NULL';
        }
        if (status) {
            where += ' AND di.status = ?';
            params.push(status);
        }
        if (company_id) {
            where += ' AND di.company_id = ?';
            params.push(company_id);
        }
        if (type === 'homeowner') {
            // 业主 = 既非公司线索也非材料询单
            where += " AND (di.message IS NULL OR (di.message NOT LIKE '[Company Inquiry]%' AND di.message NOT LIKE '[Material Inquiry]%'))";
        }
        else if (type === 'company') {
            where += " AND di.message LIKE '[Company Inquiry]%'";
        }
        else if (type === 'material') {
            where += " AND di.message LIKE '[Material Inquiry]%'";
        }
        if (search) {
            where += ' AND (di.name LIKE ? OR di.phone LIKE ? OR di.source_company_name LIKE ?)';
            params.push(`%${search}%`, `%${search}%`, `%${search}%`);
        }
        const country = req.query.country;
        const VALID_COUNTRIES = new Set(['ae', 'vn', 'sa']);
        if (country && VALID_COUNTRIES.has(country)) {
            // 归属规则：公司归属优先（company_id → company_profiles.country），
            // 无公司关联时按手机号前缀兜底（+84/084 = VN），否则归 AE
            const f = detectCountry_1.inquiryCountryWhere(country, 'di.phone', 'di.company_id');
            where += f.sql;
            params.push(...f.params);
        }
        // Group by phone: count duplicates, keep only the latest row per phone.
        // Use a derived column alias via a subquery to satisfy ONLY_FULL_GROUP_BY.
        const groupExpr = "COALESCE(NULLIF(di.phone,''), CAST(di.id AS CHAR))";
        const [countRows] = await database_1.default.execute(`SELECT COUNT(*) as total FROM (
         SELECT ${groupExpr} as gk FROM design_inquiries di ${where} GROUP BY gk
       ) grouped`, params);
        const total = countRows[0].total;
        const [rows] = await database_1.default.execute(`SELECT latest.*,
        cp.company_name,
        dup.dup_count
       FROM design_inquiries latest
       LEFT JOIN company_profiles cp ON latest.company_id = cp.id
       INNER JOIN (
         SELECT MAX(di.id) as max_id, COUNT(*) as dup_count
         FROM design_inquiries di ${where}
         GROUP BY ${groupExpr}
       ) dup ON latest.id = dup.max_id
       ORDER BY latest.created_at DESC
       LIMIT ${Number(limit)} OFFSET ${Number(offset)}`, params);
        res.json({
            inquiries: rows,
            pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
        });
    }
    catch (error) {
        console.error('Get inquiries error:', error);
        res.status(500).json({ error: 'Failed to load inquiries.' });
    }
}
// Update inquiry status (admin only)
async function updateInquiryStatus(req, res) {
    try {
        const { id } = req.params;
        const { status, admin_notes } = req.body;
        const validStatuses = ['new', 'contacted', 'resolved', 'archived'];
        if (status && !validStatuses.includes(status)) {
            return res.status(400).json({ error: 'Invalid status.' });
        }
        const updates = [];
        const values = [];
        if (status) {
            updates.push('status = ?');
            values.push(status);
        }
        if (admin_notes !== undefined) {
            updates.push('admin_notes = ?');
            values.push(admin_notes);
        }
        if (updates.length === 0) {
            return res.status(400).json({ error: 'No fields to update.' });
        }
        values.push(id);
        await database_1.default.execute(`UPDATE design_inquiries SET ${updates.join(', ')} WHERE id = ?`, values);
        res.json({ message: 'Inquiry updated.' });
    }
    catch (error) {
        console.error('Update inquiry error:', error);
        res.status(500).json({ error: 'Failed to update inquiry.' });
    }
}
// Export inquiries as Excel (admin only)
async function exportInquiries(req, res) {
    try {
        const { status, designer_id, company_id } = req.query;
        let where = 'WHERE 1=1';
        const params = [];
        if (status) {
            where += ' AND di.status = ?';
            params.push(status);
        }
        if (company_id) {
            where += ' AND di.company_id = ?';
            params.push(company_id);
        }
        const exportCountry = req.query.country;
        const EXPORT_VALID_COUNTRIES = new Set(['ae', 'vn', 'sa']);
        if (exportCountry && EXPORT_VALID_COUNTRIES.has(exportCountry)) {
            // 归属规则须与 getInquiries 完全一致
            const f = detectCountry_1.inquiryCountryWhere(exportCountry, 'di.phone', 'di.company_id');
            where += f.sql;
            params.push(...f.params);
        }
        const [rows] = await database_1.default.execute(`SELECT di.*,
        cp.company_name
       FROM design_inquiries di
       LEFT JOIN company_profiles cp ON di.company_id = cp.id
       ${where}
       ORDER BY di.created_at DESC`, params);
        const data = rows.map((row) => ({
            'ID': row.id,
            'Name': row.name,
            'Phone': row.phone,
            'City': row.city,
            'Area Range': row.area_range,
            'Message': row.message || '',
            'Source Company': row.source_company_name || row.company_name || '',
            'Status': row.status,
            'Admin Notes': row.admin_notes || '',
            'Created At': row.created_at,
        }));
        const workbook = new exceljs_1.default.Workbook();
        const worksheet = workbook.addWorksheet('Inquiries');
        worksheet.columns = Object.keys(data[0] || {
            ID: '',
            Name: '',
            Phone: '',
            City: '',
            'Area Range': '',
            Message: '',
            'Source Company': '',
            Status: '',
            'Admin Notes': '',
            'Created At': '',
        }).map((header) => ({ header, key: header, width: Math.min(Math.max(header.length + 8, 14), 36) }));
        worksheet.addRows(data);
        const buffer = await workbook.xlsx.writeBuffer();
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename=inquiries-${new Date().toISOString().slice(0, 10)}.xlsx`);
        res.send(buffer);
    }
    catch (error) {
        console.error('Export inquiries error:', error);
        res.status(500).json({ error: 'Failed to export inquiries.' });
    }
}
// Batch soft-delete inquiries (admin only)
async function batchDeleteInquiries(req, res) {
    try {
        const { ids, reason } = req.body;
        if (!Array.isArray(ids) || ids.length === 0) {
            return res.status(400).json({ error: 'ids must be a non-empty array.' });
        }
        if (!reason || typeof reason !== 'string' || reason.trim().length === 0) {
            return res.status(400).json({ error: 'reason is required.' });
        }
        const adminId = req.adminId;
        // Get admin name
        const [adminRows] = await database_1.default.execute('SELECT full_name FROM admin_users WHERE id = ?', [adminId]);
        const adminName = adminRows[0]?.full_name || 'Unknown';
        // Snapshot rows before deletion
        const placeholders = ids.map(() => '?').join(',');
        const [snapshot] = await database_1.default.execute(`SELECT * FROM design_inquiries WHERE id IN (${placeholders}) AND deleted_at IS NULL`, ids);
        const snapshotRows = snapshot;
        if (snapshotRows.length === 0) {
            return res.status(404).json({ error: 'No matching active inquiries found.' });
        }
        const activeIds = snapshotRows.map((r) => r.id);
        const activePlaceholders = activeIds.map(() => '?').join(',');
        // Soft delete
        const [result] = await database_1.default.execute(`UPDATE design_inquiries SET deleted_at = NOW(), deleted_by = ?, deleted_reason = ? WHERE id IN (${activePlaceholders})`, [adminId, reason.trim(), ...activeIds]);
        // Audit log
        await database_1.default.execute(`INSERT INTO admin_audit_log (admin_id, admin_name, action, target_type, target_ids, reason, metadata)
       VALUES (?, ?, 'delete_inquiry', 'inquiry', ?, ?, ?)`, [adminId, adminName, JSON.stringify(activeIds), reason.trim(), JSON.stringify({ snapshot: snapshotRows })]);
        res.json({ deleted: result.affectedRows });
    }
    catch (error) {
        console.error('Batch delete inquiries error:', error);
        res.status(500).json({ error: 'Failed to delete inquiries.' });
    }
}
// Batch restore soft-deleted inquiries (admin only)
async function batchRestoreInquiries(req, res) {
    try {
        const { ids } = req.body;
        if (!Array.isArray(ids) || ids.length === 0) {
            return res.status(400).json({ error: 'ids must be a non-empty array.' });
        }
        const adminId = req.adminId;
        // Get admin name
        const [adminRows] = await database_1.default.execute('SELECT full_name FROM admin_users WHERE id = ?', [adminId]);
        const adminName = adminRows[0]?.full_name || 'Unknown';
        const placeholders = ids.map(() => '?').join(',');
        // Restore
        const [result] = await database_1.default.execute(`UPDATE design_inquiries SET deleted_at = NULL, deleted_by = NULL WHERE id IN (${placeholders}) AND deleted_at IS NOT NULL`, ids);
        // Audit log
        await database_1.default.execute(`INSERT INTO admin_audit_log (admin_id, admin_name, action, target_type, target_ids, reason, metadata)
       VALUES (?, ?, 'restore_inquiry', 'inquiry', ?, NULL, NULL)`, [adminId, adminName, JSON.stringify(ids)]);
        res.json({ restored: result.affectedRows });
    }
    catch (error) {
        console.error('Batch restore inquiries error:', error);
        res.status(500).json({ error: 'Failed to restore inquiries.' });
    }
}
// Get inquiries for current designer/company (authenticated)
async function getMyInquiries(req, res) {
    try {
        const userId = req.user.userId;
        if (!userId)
            return res.status(401).json({ error: 'Authentication required.' });
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const offset = (page - 1) * limit;
        // Find company profile for this user
        const [companyRows] = await database_1.default.execute('SELECT id FROM company_profiles WHERE user_id = ?', [userId]);
        const companyId = companyRows[0]?.id;
        if (!companyId) {
            return res.json({ inquiries: [], pagination: { page, limit, total: 0, totalPages: 0 } });
        }
        const where = 'WHERE company_id = ?';
        const params = [companyId];
        const [countRows] = await database_1.default.execute(`SELECT COUNT(*) as total FROM design_inquiries ${where}`, params);
        const total = countRows[0].total;
        const [rows] = await database_1.default.execute(`SELECT * FROM design_inquiries ${where} ORDER BY created_at DESC LIMIT ${Number(limit)} OFFSET ${Number(offset)}`, params);
        res.json({
            inquiries: rows,
            pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
        });
    }
    catch (error) {
        console.error('Get my inquiries error:', error);
        res.status(500).json({ error: 'Failed to load inquiries.' });
    }
}
// Update inquiry status for the company that owns it (company portal)
async function updateMyInquiryStatus(req, res) {
    try {
        const userId = req.user?.userId;
        if (!userId)
            return res.status(401).json({ error: 'Authentication required.' });
        const { id } = req.params;
        const { status } = req.body;
        const allowed = ['new', 'contacted', 'resolved'];
        if (!allowed.includes(status)) {
            return res.status(400).json({ error: 'Invalid status. Allowed: new, contacted, resolved.' });
        }
        // Verify the inquiry belongs to this company
        const [companyRows] = await database_1.default.execute('SELECT id FROM company_profiles WHERE user_id = ? LIMIT 1', [userId]);
        const companyId = companyRows[0]?.id;
        if (!companyId)
            return res.status(403).json({ error: 'No company profile found.' });
        const [rows] = await database_1.default.execute('SELECT id FROM design_inquiries WHERE id = ? AND company_id = ? AND deleted_at IS NULL LIMIT 1', [id, companyId]);
        if (rows.length === 0) {
            return res.status(404).json({ error: 'Inquiry not found.' });
        }
        await database_1.default.execute('UPDATE design_inquiries SET status = ? WHERE id = ? AND company_id = ? AND deleted_at IS NULL', [status, id, companyId]);
        res.json({ ok: true, status });
    }
    catch (error) {
        console.error('updateMyInquiryStatus error:', error);
        res.status(500).json({ error: 'Failed to update status.' });
    }
}
// Manually retry pushing an inquiry to CRM (admin only).
// Used to recover from transient failures or to re-push after fixing an
// upstream issue. Unlike submitInquiry, this one AWAITS the result so the
// admin immediately sees whether it succeeded.
async function resendCrmSync(req, res) {
    try {
        const { id } = req.params;
        const [rows] = await database_1.default.execute('SELECT * FROM design_inquiries WHERE id = ? AND deleted_at IS NULL', [id]);
        const row = rows[0];
        if (!row) {
            return res.status(404).json({ error: 'Inquiry not found.' });
        }
        const lead = buildLeadFromRow(row);
        const result = await (0, crmPush_1.pushLeadToCRM)(lead);
        // Reload the row so the client sees the updated sync status / error
        const [updatedRows] = await database_1.default.execute('SELECT * FROM design_inquiries WHERE id = ?', [id]);
        const updated = updatedRows[0];
        if (result) {
            return res.json({
                success: true,
                leadId: result?.data?.leadId ?? null,
                action: result?.data?.action ?? null,
                inquiry: updated,
            });
        }
        // pushLeadToCRM returned null → either config missing or failure
        // (markFailed already wrote the error). Surface it.
        return res.status(502).json({
            success: false,
            error: 'CRM push failed. See crm_last_error on the inquiry.',
            inquiry: updated,
        });
    }
    catch (error) {
        console.error('Resend CRM sync error:', error);
        res.status(500).json({ error: 'Failed to resend CRM sync.' });
    }
}
