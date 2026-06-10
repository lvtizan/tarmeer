"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const database_1 = __importDefault(require("../config/database"));
const auth_1 = require("../middleware/auth");
const adminAuth_1 = require("../middleware/adminAuth");
const router = (0, express_1.Router)();
// ============================================================
// User notifications (bell icon)
// ============================================================
// Get notifications for current user (admins see broadcast notifications)
router.get('/', auth_1.authenticate, async (req, res) => {
    try {
        const limit = Math.min(Math.max(1, parseInt(req.query.limit) || 20), 100);
        const [rows] = await database_1.default.execute(`SELECT * FROM notifications WHERE user_id IS NULL OR user_id = ? ORDER BY created_at DESC LIMIT ${Number(limit)}`, [req.user.userId]);
        const [unreadRows] = await database_1.default.execute(`SELECT COUNT(*) as count FROM notifications WHERE (user_id IS NULL OR user_id = ?) AND is_read = 0`, [req.user.userId]);
        res.json({
            notifications: rows,
            unread_count: unreadRows[0].count,
        });
    }
    catch (error) {
        console.error('Get notifications error:', error);
        res.status(500).json({ error: 'Failed to load notifications.' });
    }
});
// Mark one as read
router.put('/:id/read', auth_1.authenticate, async (req, res) => {
    try {
        await database_1.default.execute('UPDATE notifications SET is_read = 1 WHERE id = ? AND (user_id = ? OR user_id IS NULL)', [req.params.id, req.user.userId]);
        res.json({ ok: true });
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to update notification.' });
    }
});
// Mark all as read
router.put('/read-all', auth_1.authenticate, async (req, res) => {
    try {
        await database_1.default.execute('UPDATE notifications SET is_read = 1 WHERE (user_id IS NULL OR user_id = ?) AND is_read = 0', [req.user.userId]);
        res.json({ ok: true });
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to update notifications.' });
    }
});
// ============================================================
// Admin: notification email config
// ============================================================
// List all notification emails
router.get('/emails', adminAuth_1.authenticateAdmin, adminAuth_1.requireAdmin, async (_req, res) => {
    try {
        const [rows] = await database_1.default.execute('SELECT * FROM notification_emails ORDER BY created_at DESC');
        res.json({ emails: rows });
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to load email list.' });
    }
});
// Add email
router.post('/emails', adminAuth_1.authenticateAdmin, adminAuth_1.requireAdmin, async (req, res) => {
    try {
        const { email, label } = req.body;
        if (!email)
            return res.status(400).json({ error: 'Email is required.' });
        await database_1.default.execute('INSERT INTO notification_emails (email, label) VALUES (?, ?) ON DUPLICATE KEY UPDATE label = VALUES(label), is_active = 1', [email, label || null]);
        res.json({ ok: true });
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to add email.' });
    }
});
// Toggle active/inactive
router.put('/emails/:id', adminAuth_1.authenticateAdmin, adminAuth_1.requireAdmin, async (req, res) => {
    try {
        const { is_active } = req.body;
        await database_1.default.execute('UPDATE notification_emails SET is_active = ? WHERE id = ?', [is_active ? 1 : 0, req.params.id]);
        res.json({ ok: true });
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to update email.' });
    }
});
// Delete email
router.delete('/emails/:id', adminAuth_1.authenticateAdmin, adminAuth_1.requireAdmin, async (req, res) => {
    try {
        await database_1.default.execute('DELETE FROM notification_emails WHERE id = ?', [req.params.id]);
        res.json({ ok: true });
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to delete email.' });
    }
});
exports.default = router;
