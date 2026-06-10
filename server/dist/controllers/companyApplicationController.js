"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.applyAsCompany = applyAsCompany;
exports.getMyCompanyStatus = getMyCompanyStatus;
const database_1 = __importDefault(require("../config/database"));
const analyticsEvents_1 = require("../lib/analyticsEvents");
// Submit company application
async function applyAsCompany(req, res) {
    try {
        const userId = req.user.userId;
        if (!userId)
            return res.status(401).json({ error: 'Authentication required.' });
        // Check for existing pending/approved application
        const [existing] = await database_1.default.execute("SELECT id, status FROM company_applications WHERE user_id = ? AND status IN ('pending', 'approved')", [userId]);
        if (existing.length > 0) {
            const app = existing[0];
            return res.status(400).json({
                error: 'You already have a company application.',
                status: app.status,
            });
        }
        const { company_name, license_number, phone, city, address, description } = req.body;
        if (!company_name) {
            return res.status(400).json({ error: 'Company name is required.' });
        }
        const [result] = await database_1.default.execute(`INSERT INTO company_applications (user_id, company_name, license_number, phone, city, address, description)
       VALUES (?, ?, ?, ?, ?, ?, ?)`, [userId, company_name, license_number || null, phone || null, city || null, address || null, description || null]);
        const applicationId = result.insertId;
        // Push to admin SSE subscribers
        analyticsEvents_1.analyticsEvents.notifyChange('company_application');
        res.status(201).json({
            message: 'Company application submitted successfully. It will be reviewed by our team.',
            applicationId,
            status: 'pending',
        });
    }
    catch (error) {
        console.error('Apply as company error:', error);
        res.status(500).json({ error: 'Failed to submit application.' });
    }
}
// Get current user's company application status
async function getMyCompanyStatus(req, res) {
    try {
        const userId = req.user.userId;
        if (!userId)
            return res.status(401).json({ error: 'Authentication required.' });
        const [rows] = await database_1.default.execute('SELECT id, company_name, status, admin_notes, linked_company_id, created_at FROM company_applications WHERE user_id = ? ORDER BY created_at DESC LIMIT 1', [userId]);
        if (rows.length === 0) {
            return res.json({ applied: false });
        }
        const app = rows[0];
        // If approved and linked, get company info
        let company = null;
        if (app.linked_company_id) {
            const [companyRows] = await database_1.default.execute('SELECT id, name, slug, logo_url, city FROM uae_companies WHERE id = ?', [app.linked_company_id]);
            if (companyRows.length > 0) {
                company = companyRows[0];
            }
        }
        res.json({
            applied: true,
            applicationId: app.id,
            companyName: app.company_name,
            status: app.status,
            adminNotes: app.admin_notes,
            linkedCompany: company,
            appliedAt: app.created_at,
        });
    }
    catch (error) {
        console.error('Get company status error:', error);
        res.status(500).json({ error: 'Failed to get status.' });
    }
}
