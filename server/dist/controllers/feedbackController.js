"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.submitFeedback = submitFeedback;
exports.listFeedback = listFeedback;
exports.getFeedback = getFeedback;
exports.getUnreadFeedbackCount = getUnreadFeedbackCount;
exports.markAllFeedbackRead = markAllFeedbackRead;
const database_1 = __importDefault(require("../config/database"));
// Submit feedback (public, no auth required)
async function submitFeedback(req, res) {
    try {
        const { title, content, source, user_id, user_name, user_email, company_name, company_type } = req.body;
        if (!title?.trim() || !content?.trim()) {
            return res.status(400).json({ error: 'Title and content are required.' });
        }
        await database_1.default.execute(`INSERT INTO feedback (title, content, source, user_id, user_name, user_email, company_name, company_type)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`, [
            title.trim().slice(0, 200),
            content.trim().slice(0, 2000),
            source || 'website',
            user_id || null,
            user_name?.trim().slice(0, 100) || null,
            user_email?.trim().slice(0, 255) || null,
            company_name?.trim().slice(0, 255) || null,
            company_type?.trim().slice(0, 100) || null,
        ]);
        res.status(201).json({ message: 'Feedback submitted. Thank you!' });
    }
    catch (error) {
        console.error('Submit feedback error:', error);
        res.status(500).json({ error: 'Failed to submit feedback.' });
    }
}
// List feedback (admin only)
async function listFeedback(req, res) {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const offset = (page - 1) * limit;
        const { unread } = req.query;
        let where = 'WHERE 1=1';
        const params = [];
        if (unread === 'true') {
            where += ' AND is_read = 0';
        }
        const [countRows] = await database_1.default.execute(`SELECT COUNT(*) as total FROM feedback ${where}`, params);
        const total = countRows[0].total;
        const [rows] = await database_1.default.execute(`SELECT id, title, content, source, user_id, user_name, user_email, company_name, company_type, is_read, created_at
       FROM feedback ${where}
       ORDER BY created_at DESC
       LIMIT ${Number(limit)} OFFSET ${Number(offset)}`, params);
        // Count unread total for badge
        const [unreadRows] = await database_1.default.execute(`SELECT COUNT(*) as count FROM feedback WHERE is_read = 0`);
        const unreadCount = unreadRows[0].count;
        res.json({
            feedback: rows,
            unreadCount,
            pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
        });
    }
    catch (error) {
        console.error('List feedback error:', error);
        res.status(500).json({ error: 'Failed to load feedback.' });
    }
}
// Get single feedback (admin only), marks as read
async function getFeedback(req, res) {
    try {
        const { id } = req.params;
        const [rows] = await database_1.default.execute(`SELECT id, title, content, source, user_id, user_name, user_email, company_name, company_type, is_read, created_at
       FROM feedback WHERE id = ?`, [id]);
        const item = rows[0];
        if (!item)
            return res.status(404).json({ error: 'Feedback not found.' });
        // Mark as read if not already
        if (!item.is_read) {
            await database_1.default.execute('UPDATE feedback SET is_read = 1 WHERE id = ?', [id]);
            item.is_read = 1;
        }
        res.json({ feedback: item });
    }
    catch (error) {
        console.error('Get feedback error:', error);
        res.status(500).json({ error: 'Failed to load feedback.' });
    }
}
// Count unread feedback (used by notification system)
async function getUnreadFeedbackCount() {
    try {
        const [rows] = await database_1.default.execute(`SELECT COUNT(*) as count FROM feedback WHERE is_read = 0`);
        return Number(rows[0]?.count || 0);
    }
    catch {
        return 0;
    }
}
// Mark all feedback as read (admin)
async function markAllFeedbackRead(req, res) {
    try {
        await database_1.default.execute('UPDATE feedback SET is_read = 1 WHERE is_read = 0');
        res.json({ ok: true });
    }
    catch (error) {
        console.error('Mark all feedback read error:', error);
        res.status(500).json({ error: 'Failed to mark feedback as read.' });
    }
}
