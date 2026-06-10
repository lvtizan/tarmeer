"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.submitLead = submitLead;
exports.listLeads = listLeads;
const database_1 = __importDefault(require("../config/database"));
async function submitLead(req, res) {
    try {
        const { contact_name, phone, company_name, category, origin, message, source_page } = req.body;
        if (!contact_name || !phone) {
            return res.status(400).json({ error: 'Contact name and phone are required.' });
        }
        await database_1.default.execute(`INSERT INTO supplier_leads (contact_name, phone, company_name, category, origin, message, source_page)
       VALUES (?, ?, ?, ?, ?, ?, ?)`, [contact_name, phone, company_name || null, category || null, origin || null, message || null, source_page || null]);
        res.status(201).json({ message: 'Submitted successfully.' });
    }
    catch (error) {
        console.error('Submit supplier lead error:', error);
        res.status(500).json({ error: 'Submission failed.' });
    }
}
async function listLeads(req, res) {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const offset = (page - 1) * limit;
        const [countRows] = await database_1.default.execute('SELECT COUNT(*) as total FROM supplier_leads');
        const total = countRows[0].total;
        const [leads] = await database_1.default.query(`SELECT * FROM supplier_leads ORDER BY created_at DESC LIMIT ${limit} OFFSET ${offset}`);
        res.json({ leads, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } });
    }
    catch (error) {
        console.error('List supplier leads error:', error);
        res.status(500).json({ error: 'Failed to load leads.' });
    }
}
