"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.submitComplaint = submitComplaint;
exports.getComplaints = getComplaints;
exports.updateComplaintStatus = updateComplaintStatus;
exports.markNotificationSeen = markNotificationSeen;
exports.getNewCounts = getNewCounts;
const database_1 = __importDefault(require("../config/database"));
const feedbackController_1 = require("./feedbackController");
async function countBySql(sql, params = []) {
    const [rows] = await database_1.default.execute(sql, params);
    return Number(rows[0]?.count || 0);
}
function isRecoverableSchemaError(error) {
    return error?.code === 'ER_NO_SUCH_TABLE' || error?.code === 'ER_BAD_FIELD_ERROR';
}
// Submit complaint (public, no auth required)
async function submitComplaint(req, res) {
    try {
        const { company_slug, reporter_name, reporter_email, content_type, description, evidence_urls } = req.body;
        if (!reporter_name || !reporter_email || !description) {
            return res.status(400).json({ error: 'Name, email, and description are required.' });
        }
        const [result] = await database_1.default.execute(`INSERT INTO complaints (company_slug, reporter_name, reporter_email, content_type, description, evidence_urls)
       VALUES (?, ?, ?, ?, ?, ?)`, [company_slug || null, reporter_name, reporter_email, content_type || 'other', description, evidence_urls ? JSON.stringify(evidence_urls) : null]);
        res.status(201).json({
            message: 'Complaint submitted successfully. We will review it shortly.',
            complaintId: result.insertId,
        });
    }
    catch (error) {
        console.error('Submit complaint error:', error);
        res.status(500).json({ error: 'Failed to submit complaint.' });
    }
}
// List complaints (admin only)
async function getComplaints(req, res) {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const offset = (page - 1) * limit;
        const { status, search, country } = req.query;
        const VALID_COUNTRIES = new Set(['ae', 'vn', 'sa']);
        let where = 'WHERE 1=1';
        const params = [];
        if (country && VALID_COUNTRIES.has(country)) {
            // vn- 前缀只覆盖目录公司；注册公司 slug 由 email 生成，须按 company_profiles.country 兜底
            if (country === 'vn') {
                where += " AND (c.company_slug LIKE 'vn-%' OR c.company_slug IN (SELECT slug FROM company_profiles WHERE country = 'vn'))";
            } else {
                where += " AND (c.company_slug IS NULL OR (c.company_slug NOT LIKE 'vn-%' AND c.company_slug NOT IN (SELECT slug FROM company_profiles WHERE country = 'vn')))";
            }
        }
        if (status) {
            where += ' AND c.status = ?';
            params.push(status);
        }
        if (search) {
            where += ' AND (c.reporter_name LIKE ? OR c.reporter_email LIKE ?)';
            params.push(`%${search}%`, `%${search}%`);
        }
        const [countRows] = await database_1.default.execute(`SELECT COUNT(*) as total FROM complaints c ${where}`, params);
        const total = countRows[0].total;
        const [rows] = await database_1.default.execute(`SELECT c.*
       FROM complaints c
       ${where}
       ORDER BY c.created_at DESC
       LIMIT ${Number(limit)} OFFSET ${Number(offset)}`, params);
        res.json({
            complaints: rows,
            pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
        });
    }
    catch (error) {
        console.error('Get complaints error:', error);
        res.status(500).json({ error: 'Failed to load complaints.' });
    }
}
// Update complaint status (admin only)
async function updateComplaintStatus(req, res) {
    try {
        const { id } = req.params;
        const { status, admin_notes } = req.body;
        const validStatuses = ['pending', 'reviewing', 'resolved', 'dismissed'];
        if (status && !validStatuses.includes(status)) {
            return res.status(400).json({ error: 'Invalid status.' });
        }
        const updates = [];
        const values = [];
        if (status) {
            updates.push('status = ?');
            values.push(status);
            if (status === 'resolved') {
                updates.push('resolved_at = NOW()');
            }
        }
        if (admin_notes !== undefined) {
            updates.push('admin_notes = ?');
            values.push(admin_notes);
        }
        if (updates.length === 0) {
            return res.status(400).json({ error: 'No fields to update.' });
        }
        values.push(id);
        await database_1.default.execute(`UPDATE complaints SET ${updates.join(', ')} WHERE id = ?`, values);
        res.json({ message: 'Complaint updated.' });
    }
    catch (error) {
        console.error('Update complaint status error:', error);
        res.status(500).json({ error: 'Failed to update complaint.' });
    }
}
// Mark notification page as seen (admin only)
async function markNotificationSeen(req, res) {
    try {
        const page = req.query.page;
        const validPages = ['inquiries', 'companies', 'complaints', 'users', 'feedback'];
        if (!page || !validPages.includes(page)) {
            return res.status(400).json({ error: 'Invalid page. Must be one of: ' + validPages.join(', ') });
        }
        const adminId = req.adminId;
        if (!adminId) {
            return res.status(401).json({ error: 'Admin ID not found.' });
        }
        await database_1.default.execute(`INSERT INTO admin_last_seen (admin_id, page_key, last_seen_at) VALUES (?, ?, NOW())
       ON DUPLICATE KEY UPDATE last_seen_at = NOW()`, [adminId, page]);
        res.json({ ok: true });
    }
    catch (error) {
        console.error('Mark notification seen error:', error);
        res.status(500).json({ error: 'Failed to mark notification as seen.' });
    }
}
async function getLastSeenAt(adminId, pageKey) {
    try {
        const [rows] = await database_1.default.execute(`SELECT last_seen_at FROM admin_last_seen WHERE admin_id = ? AND page_key = ?`, [adminId, pageKey]);
        const row = rows[0];
        return row ? row.last_seen_at : '1970-01-01';
    }
    catch (error) {
        if (isRecoverableSchemaError(error))
            return '1970-01-01';
        throw error;
    }
}
// Get new notification counts (admin only)
async function getNewCounts(req, res) {
    try {
        const adminId = req.adminId;
        let newComplaints = 0;
        let newDesignerApps = 0;
        let newCompanyApps = 0;
        let newInquiries = 0;
        let newUsers = 0;
        let newFeedback = 0;
        let pendingProjectCompanies = 0;
        let pendingProjectCount = 0;
        if (adminId) {
            const [seenInquiries, seenCompanies, seenComplaints, seenUsers] = await Promise.all([
                getLastSeenAt(adminId, 'inquiries'),
                getLastSeenAt(adminId, 'companies'),
                getLastSeenAt(adminId, 'complaints'),
                getLastSeenAt(adminId, 'users'),
            ]);
            try {
                newComplaints = await countBySql(`SELECT COUNT(*) as count FROM complaints WHERE status = 'pending' AND created_at > ?`, [seenComplaints]);
            }
            catch (error) {
                if (!isRecoverableSchemaError(error))
                    throw error;
            }
            try {
                newDesignerApps = await countBySql(`SELECT COUNT(*) as count FROM designers WHERE status = 'pending'`);
            }
            catch (error) {
                if (error?.code === 'ER_BAD_FIELD_ERROR') {
                    newDesignerApps = await countBySql(`SELECT COUNT(*) as count FROM designers WHERE COALESCE(is_approved, 0) = 0`);
                }
                else if (!isRecoverableSchemaError(error)) {
                    throw error;
                }
            }
            try {
                newCompanyApps = await countBySql(`SELECT COUNT(*) as count FROM company_profiles WHERE status = 'pending' AND created_at > ? AND deleted_at IS NULL`, [seenCompanies]);
            }
            catch (error) {
                if (!isRecoverableSchemaError(error))
                    throw error;
            }
            try {
                newInquiries = await countBySql(`SELECT COUNT(*) as count FROM inquiries WHERE status = 'new' AND created_at > ? AND deleted_at IS NULL`, [seenInquiries]);
            }
            catch (error) {
                if (!isRecoverableSchemaError(error))
                    throw error;
            }
            try {
                newUsers = await countBySql(`SELECT COUNT(*) as count FROM users WHERE created_at > GREATEST(?, DATE_SUB(NOW(), INTERVAL 24 HOUR))`, [seenUsers]);
            }
            catch (error) {
                if (!isRecoverableSchemaError(error))
                    throw error;
            }
        }
        else {
            // Fallback: no adminId (shouldn't happen behind adminAuth)
            try {
                newComplaints = await countBySql(`SELECT COUNT(*) as count FROM complaints WHERE status = 'pending'`);
            }
            catch (error) {
                if (!isRecoverableSchemaError(error))
                    throw error;
            }
            try {
                newDesignerApps = await countBySql(`SELECT COUNT(*) as count FROM designers WHERE status = 'pending'`);
            }
            catch (error) {
                if (error?.code === 'ER_BAD_FIELD_ERROR') {
                    newDesignerApps = await countBySql(`SELECT COUNT(*) as count FROM designers WHERE COALESCE(is_approved, 0) = 0`);
                }
                else if (!isRecoverableSchemaError(error)) {
                    throw error;
                }
            }
            try {
                newCompanyApps = await countBySql(`SELECT COUNT(*) as count FROM company_profiles WHERE status = 'pending' AND deleted_at IS NULL`);
            }
            catch (error) {
                if (!isRecoverableSchemaError(error))
                    throw error;
            }
            try {
                newInquiries = await countBySql(`SELECT COUNT(*) as count FROM inquiries WHERE status = 'new'`);
            }
            catch (error) {
                if (!isRecoverableSchemaError(error))
                    throw error;
            }
            try {
                newUsers = await countBySql(`SELECT COUNT(*) as count FROM users WHERE created_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR)`);
            }
            catch (error) {
                if (!isRecoverableSchemaError(error))
                    throw error;
            }
        }
        newFeedback = await (0, feedbackController_1.getUnreadFeedbackCount)();
        try {
            const [rows] = await database_1.default.execute(`SELECT COUNT(DISTINCT company_profile_id) as companies, COUNT(*) as total
         FROM projects WHERE status = 'pending' AND deleted_at IS NULL`);
            pendingProjectCompanies = rows[0]?.companies || 0;
            pendingProjectCount = rows[0]?.total || 0;
        }
        catch { /* non-critical */ }
        res.json({ newComplaints, newDesignerApps, newCompanyApps, newInquiries, newUsers, newFeedback, pendingProjectCompanies, pendingProjectCount });
    }
    catch (error) {
        console.error('Get new counts error:', error);
        res.status(500).json({ error: 'Failed to get notification counts.' });
    }
}
