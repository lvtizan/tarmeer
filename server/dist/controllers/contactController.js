"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createContact = createContact;
exports.getContacts = getContacts;
exports.updateContactStatus = updateContactStatus;
const database_1 = __importDefault(require("../config/database"));
const emailService_1 = require("../services/emailService");
async function createContact(req, res) {
    try {
        const { name, email, phone, type, message, designer_id, project_id } = req.body;
        // 必填校验(与路由 express-validator 同口径)+ 可选字段兜底 null，防空/非法 body → INSERT undefined → 500。
        if (!name || typeof name !== 'string' || !name.trim() || !['inquiry', 'quote', 'partnership'].includes(type)) {
            return res.status(400).json({ error: 'Name and a valid type (inquiry/quote/partnership) are required.' });
        }
        const [result] = await database_1.default.execute(`INSERT INTO contacts (name, email, phone, type, message, designer_id, project_id)
       VALUES (?, ?, ?, ?, ?, ?, ?)`, [name, email || null, phone || null, type, message || null, designer_id || null, project_id || null]);
        const contactId = result.insertId;
        const [contact] = await database_1.default.execute('SELECT * FROM contacts WHERE id = ?', [contactId]);
        await (0, emailService_1.sendContactFormEmail)(contact[0]);
        res.status(201).json({
            message: 'Submitted successfully. We will contact you soon.',
            contact: contact[0]
        });
    }
    catch (error) {
        console.error('Create contact error:', error);
        res.status(500).json({ error: 'Submission failed. Please try again.' });
    }
}
async function getContacts(req, res) {
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
        const [countResult] = await database_1.default.execute(`SELECT COUNT(*) as total FROM contacts ${whereClause}`, params);
        const total = countResult[0].total;
        const [contacts] = await database_1.default.execute(`SELECT c.*, cp.company_name as designer_name, p.title as project_title
       FROM contacts c
       LEFT JOIN company_profiles cp ON c.designer_id = cp.id
       LEFT JOIN projects p ON c.project_id = p.id
       ${whereClause}
       ORDER BY c.created_at DESC
       LIMIT ? OFFSET ?`, [...params, limit, offset]);
        res.json({
            contacts,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit)
            }
        });
    }
    catch (error) {
        console.error('Get contacts error:', error);
        res.status(500).json({ error: 'Failed to load contacts.' });
    }
}
async function updateContactStatus(req, res) {
    try {
        const { id } = req.params;
        const { status } = req.body;
        await database_1.default.execute('UPDATE contacts SET status = ? WHERE id = ?', [status, id]);
        const [contact] = await database_1.default.execute('SELECT * FROM contacts WHERE id = ?', [id]);
        res.json({
            message: 'Status updated successfully.',
            contact: contact[0]
        });
    }
    catch (error) {
        console.error('Update contact status error:', error);
        res.status(500).json({ error: 'Failed to update status.' });
    }
}
