"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.upsertProfile = upsertProfile;
exports.getProfile = getProfile;
exports.getAssignedDesigner = getAssignedDesigner;
const database_1 = __importDefault(require("../config/database"));
const analyticsEvents_1 = require("../lib/analyticsEvents");
const detectCountry_1 = require("../lib/detectCountry");
const homeownerProjectSerialization_1 = require("../lib/homeownerProjectSerialization");
/**
 * POST /api/homeowner/profile
 * Create or update homeowner profile (renovation requirements)
 */
async function upsertProfile(req, res) {
    try {
        const userId = req.user.userId;
        const { area_range, city, address, phone, stage, budget_range, notes } = req.body;
        if (!area_range || !city || !phone) {
            return res.status(400).json({ error: 'Area range, city, and phone are required.' });
        }
        // 国家归属：按手机号前缀定国家（隔离铁律，见 AGENTS.md）
        const country = detectCountry_1.detectCountry(phone);
        // Check if profile exists
        const [existing] = await database_1.default.execute('SELECT id FROM homeowner_profiles WHERE user_id = ?', [userId]);
        if (existing.length > 0) {
            // Update
            await database_1.default.execute(`UPDATE homeowner_profiles SET area_range = ?, city = ?, address = ?, phone = ?, stage = ?, budget_range = ?, notes = ?, country = ? WHERE user_id = ?`, [area_range, city, address || null, phone, stage || null, budget_range || null, notes || null, country, userId]);
        }
        else {
            // Create
            await database_1.default.execute(`INSERT INTO homeowner_profiles (user_id, area_range, city, address, phone, stage, budget_range, notes, country) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`, [userId, area_range, city, address || null, phone, stage || null, budget_range || null, notes || null, country]);
            // Push to admin SSE subscribers (only on create, not update)
            analyticsEvents_1.analyticsEvents.notifyChange('homeowner');
        }
        // Ensure active_role is set
        await database_1.default.execute('UPDATE users SET active_role = ?, onboarding_completed = 1 WHERE id = ? AND active_role IS NULL', ['homeowner', userId]);
        const [rows] = await database_1.default.execute('SELECT * FROM homeowner_profiles WHERE user_id = ?', [userId]);
        res.json({ profile: rows[0] });
    }
    catch (error) {
        console.error('Upsert homeowner profile error:', error);
        res.status(500).json({ error: 'Failed to save profile.' });
    }
}
/**
 * GET /api/homeowner/profile
 */
async function getProfile(req, res) {
    try {
        const userId = req.user.userId;
        const [rows] = await database_1.default.execute('SELECT * FROM homeowner_profiles WHERE user_id = ?', [userId]);
        if (rows.length === 0) {
            return res.json({ profile: null });
        }
        res.json({ profile: rows[0] });
    }
    catch (error) {
        console.error('Get homeowner profile error:', error);
        res.status(500).json({ error: 'Failed to get profile.' });
    }
}
/**
 * GET /api/homeowner/assigned-designer
 * Get the designer assigned to this homeowner
 */
async function getAssignedDesigner(req, res) {
    try {
        const userId = req.user.userId;
        const [profileRows] = await database_1.default.execute('SELECT assigned_designer_id, assigned_at FROM homeowner_profiles WHERE user_id = ?', [userId]);
        if (profileRows.length === 0 || !profileRows[0].assigned_designer_id) {
            return res.json({ designer: null, assigned_at: null });
        }
        const designerId = profileRows[0].assigned_designer_id;
        const assignedAt = profileRows[0].assigned_at;
        const [designerRows] = await database_1.default.execute(`SELECT d.id, d.full_name, d.email, d.phone, d.city, d.bio, d.avatar_url, d.title, d.style,
              (SELECT COUNT(*) FROM projects WHERE designer_id = d.id AND status = 'published') as project_count
       FROM designers d WHERE d.id = ? AND d.deleted_at IS NULL`, [designerId]);
        if (designerRows.length === 0) {
            return res.json({ designer: null, assigned_at: null });
        }
        // Get designer's recent projects
        const [projectRows] = await database_1.default.execute(`SELECT id, title, description, style, image_urls FROM projects WHERE designer_id = ? AND status = 'published' ORDER BY created_at DESC LIMIT 6`, [designerId]);
        const designer = designerRows[0];
        designer.recent_projects = (0, homeownerProjectSerialization_1.normalizeHomeownerRecentProjects)(projectRows);
        res.json({ designer, assigned_at: assignedAt });
    }
    catch (error) {
        console.error('Get assigned designer error:', error);
        res.status(500).json({ error: 'Failed to get assigned designer.' });
    }
}
