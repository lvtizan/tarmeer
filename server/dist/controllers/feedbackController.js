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
exports.adminReplyFeedback = adminReplyFeedback;
exports.listMyFeedback = listMyFeedback;
exports.getMyConversation = getMyConversation;
exports.userReplyFeedback = userReplyFeedback;
exports.getMyUnreadReplyCount = getMyUnreadReplyCount;
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
        // 对话回复 + 标记用户发来的消息为 admin 已读
        const [replies] = await database_1.default.execute(`SELECT id, feedback_id, sender, content, created_at FROM feedback_replies WHERE feedback_id = ? ORDER BY created_at ASC`, [id]);
        await database_1.default.execute(`UPDATE feedback_replies SET read_by_admin = 1 WHERE feedback_id = ? AND sender = 'user' AND read_by_admin = 0`, [id]);
        res.json({ feedback: item, replies });
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
// ── 客服对话：admin 回复 ──────────────────────────────────────────────
// admin 回复某条反馈 → 写一条 sender='admin' 的对话消息(read_by_admin=1 自己已读, read_by_user=0 待用户读)。
async function adminReplyFeedback(req, res) {
    try {
        const { id } = req.params;
        const content = (req.body?.content || '').trim();
        if (!content)
            return res.status(400).json({ error: 'Reply content is required.' });
        const [fb] = await database_1.default.execute('SELECT id FROM feedback WHERE id = ?', [id]);
        if (!fb.length)
            return res.status(404).json({ error: 'Feedback not found.' });
        await database_1.default.execute(`INSERT INTO feedback_replies (feedback_id, sender, content, read_by_admin, read_by_user) VALUES (?, 'admin', ?, 1, 0)`, [id, content.slice(0, 2000)]);
        await database_1.default.execute('UPDATE feedback SET is_read = 1 WHERE id = ?', [id]);
        const [replies] = await database_1.default.execute(`SELECT id, feedback_id, sender, content, created_at FROM feedback_replies WHERE feedback_id = ? ORDER BY created_at ASC`, [id]);
        res.status(201).json({ ok: true, replies });
    }
    catch (error) {
        console.error('Admin reply feedback error:', error);
        res.status(500).json({ error: 'Failed to send reply.' });
    }
}
// ── 用户端：我的反馈列表(带每条线程未读 admin 回复数)──────────────────
async function listMyFeedback(req, res) {
    try {
        const userId = req.user?.id || req.user?.userId;
        if (!userId)
            return res.status(401).json({ error: 'Login required.' });
        const [rows] = await database_1.default.execute(`SELECT f.id, f.title, f.content, f.source, f.created_at,
        (SELECT COUNT(*) FROM feedback_replies r WHERE r.feedback_id = f.id AND r.sender = 'admin' AND r.read_by_user = 0) AS unread_replies,
        (SELECT COUNT(*) FROM feedback_replies r WHERE r.feedback_id = f.id) AS reply_count,
        (SELECT r.created_at FROM feedback_replies r WHERE r.feedback_id = f.id ORDER BY r.created_at DESC LIMIT 1) AS last_reply_at
       FROM feedback f WHERE f.user_id = ? ORDER BY COALESCE(last_reply_at, f.created_at) DESC`, [userId]);
        res.json({ feedback: rows });
    }
    catch (error) {
        console.error('List my feedback error:', error);
        res.status(500).json({ error: 'Failed to load feedback.' });
    }
}
// ── 用户端：某条反馈的完整对话(校验归属) + 标记 admin 回复为用户已读 ──
async function getMyConversation(req, res) {
    try {
        const userId = req.user?.id || req.user?.userId;
        if (!userId)
            return res.status(401).json({ error: 'Login required.' });
        const { id } = req.params;
        const [rows] = await database_1.default.execute('SELECT id, title, content, source, created_at FROM feedback WHERE id = ? AND user_id = ?', [id, userId]);
        if (!rows.length)
            return res.status(404).json({ error: 'Feedback not found.' });
        const [replies] = await database_1.default.execute(`SELECT id, feedback_id, sender, content, created_at FROM feedback_replies WHERE feedback_id = ? ORDER BY created_at ASC`, [id]);
        await database_1.default.execute(`UPDATE feedback_replies SET read_by_user = 1 WHERE feedback_id = ? AND sender = 'admin' AND read_by_user = 0`, [id]);
        res.json({ feedback: rows[0], replies });
    }
    catch (error) {
        console.error('Get my conversation error:', error);
        res.status(500).json({ error: 'Failed to load conversation.' });
    }
}
// ── 用户端：在对话里继续回复 ─────────────────────────────────────────
async function userReplyFeedback(req, res) {
    try {
        const userId = req.user?.id || req.user?.userId;
        if (!userId)
            return res.status(401).json({ error: 'Login required.' });
        const { id } = req.params;
        const content = (req.body?.content || '').trim();
        if (!content)
            return res.status(400).json({ error: 'Reply content is required.' });
        const [rows] = await database_1.default.execute('SELECT id FROM feedback WHERE id = ? AND user_id = ?', [id, userId]);
        if (!rows.length)
            return res.status(404).json({ error: 'Feedback not found.' });
        await database_1.default.execute(`INSERT INTO feedback_replies (feedback_id, sender, content, read_by_user, read_by_admin) VALUES (?, 'user', ?, 1, 0)`, [id, content.slice(0, 2000)]);
        await database_1.default.execute('UPDATE feedback SET is_read = 0 WHERE id = ?', [id]); // 用户新消息 → admin 列表标未读
        const [replies] = await database_1.default.execute(`SELECT id, feedback_id, sender, content, created_at FROM feedback_replies WHERE feedback_id = ? ORDER BY created_at ASC`, [id]);
        res.status(201).json({ ok: true, replies });
    }
    catch (error) {
        console.error('User reply feedback error:', error);
        res.status(500).json({ error: 'Failed to send reply.' });
    }
}
// ── 用户端：未读 admin 回复总数(个人中心反馈按钮角标)────────────────
async function getMyUnreadReplyCount(req, res) {
    try {
        const userId = req.user?.id || req.user?.userId;
        if (!userId)
            return res.status(401).json({ error: 'Login required.' });
        const [rows] = await database_1.default.execute(`SELECT COUNT(*) AS count FROM feedback_replies r JOIN feedback f ON r.feedback_id = f.id
       WHERE f.user_id = ? AND r.sender = 'admin' AND r.read_by_user = 0`, [userId]);
        res.json({ count: Number(rows[0]?.count || 0) });
    }
    catch (error) {
        console.error('Get my unread reply count error:', error);
        res.json({ count: 0 });
    }
}
