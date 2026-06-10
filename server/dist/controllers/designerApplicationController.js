"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.applyAsDesigner = applyAsDesigner;
exports.getMyDesignerStatus = getMyDesignerStatus;
const database_1 = __importDefault(require("../config/database"));
// Apply as designer (authenticated user submits designer application)
async function applyAsDesigner(req, res) {
    try {
        const userId = req.user.userId;
        if (!userId) {
            return res.status(401).json({ error: 'Authentication required.' });
        }
        // Check user exists and isn't already a designer
        const [userRows] = await database_1.default.execute('SELECT * FROM users WHERE id = ?', [userId]);
        const user = userRows[0];
        if (!user)
            return res.status(404).json({ error: 'User not found.' });
        // Check if already has a designer record
        const [existingDesigner] = await database_1.default.execute('SELECT id, status FROM designers WHERE user_id = ? AND deleted_at IS NULL', [userId]);
        if (existingDesigner.length > 0) {
            const designer = existingDesigner[0];
            return res.status(400).json({
                error: 'You already have a designer application.',
                status: designer.status,
            });
        }
        const { bio, style, expertise, city, title } = req.body;
        if (!bio || !city) {
            return res.status(400).json({ error: 'Bio and city are required.' });
        }
        // Create designer record linked to user
        const [result] = await database_1.default.execute(`INSERT INTO designers (user_id, email, password, full_name, phone, city, bio, style, expertise, title, avatar_url, email_verified, status, is_approved)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, TRUE, 'pending', 0)`, [
            userId,
            user.email,
            user.password || '',
            user.full_name,
            user.phone || null,
            city,
            bio,
            style || null,
            JSON.stringify(expertise || []),
            title || null,
            user.avatar_url || null,
        ]);
        const designerId = result.insertId;
        // Update user role to designer
        await database_1.default.execute("UPDATE users SET role = 'designer' WHERE id = ?", [userId]);
        res.status(201).json({
            message: 'Designer application submitted successfully. It will be reviewed by our team.',
            designerId,
            status: 'pending',
        });
    }
    catch (error) {
        console.error('Apply as designer error:', error);
        res.status(500).json({ error: 'Failed to submit application.' });
    }
}
// Get current user's designer application status
async function getMyDesignerStatus(req, res) {
    try {
        const userId = req.user.userId;
        if (!userId) {
            return res.status(401).json({ error: 'Authentication required.' });
        }
        const [rows] = await database_1.default.execute('SELECT id, status, rejection_reason, created_at FROM designers WHERE user_id = ? AND deleted_at IS NULL', [userId]);
        if (rows.length === 0) {
            return res.json({ applied: false });
        }
        const designer = rows[0];
        res.json({
            applied: true,
            designerId: designer.id,
            status: designer.status,
            rejectionReason: designer.rejection_reason,
            appliedAt: designer.created_at,
        });
    }
    catch (error) {
        console.error('Get designer status error:', error);
        res.status(500).json({ error: 'Failed to get status.' });
    }
}
