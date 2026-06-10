"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.listInterviews = listInterviews;
exports.getInterview = getInterview;
exports.editInterview = editInterview;
exports.deleteInterviews = deleteInterviews;
exports.listStaff = listStaff;
exports.createStaff = createStaff;
exports.toggleStaff = toggleStaff;
exports.updateStaffPermissions = updateStaffPermissions;
const database_1 = __importDefault(require("../config/database"));
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const STAFF_VALID_COUNTRIES = new Set(['ae', 'vn', 'sa']);
// 自动补列（幂等）：外勤人员按国家隔离需要 admin_users.country
async function ensureStaffCountryColumn() {
    try {
        const [existing] = await database_1.default.execute(`SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'admin_users'`);
        const existingSet = new Set(existing.map(r => r.COLUMN_NAME));
        if (!existingSet.has('country')) {
            await database_1.default.execute(`ALTER TABLE admin_users ADD COLUMN country VARCHAR(5) NOT NULL DEFAULT 'ae'`);
            console.log('[field] added column: admin_users.country');
        }
    }
    catch (e) {
        console.error('[field] ensureStaffCountryColumn:', e.message);
    }
}
ensureStaffCountryColumn();
// GET /api/admin/interviews
async function listInterviews(req, res) {
    const country = req.query.country || req.country || 'ae';
    try {
        const [rows] = await database_1.default.execute(`
      SELECT ci.id, ci.company_name, ci.status, ci.submitted_at, ci.created_at,
             ci.company_ref_id, ci.company_ref_source,
             COALESCE(au.full_name, '—') AS interviewer_name,
             CASE ci.company_ref_source
               WHEN 'uae'     THEN uc.name_en
               WHEN 'profile' THEN cp.company_name
               ELSE NULL
             END AS linked_company_name
      FROM company_interviews ci
      LEFT JOIN admin_users au ON au.id = ci.interviewer_id
      LEFT JOIN uae_companies uc ON uc.id = ci.company_ref_id AND ci.company_ref_source = 'uae' AND uc.country = ci.country
      LEFT JOIN company_profiles cp ON cp.id = ci.company_ref_id AND ci.company_ref_source = 'profile' AND cp.country = ci.country
      WHERE ci.country = ?
      ORDER BY ci.updated_at DESC
      LIMIT 200
    `, [country]);
        res.json({ interviews: rows });
    }
    catch (e) {
        res.status(500).json({ error: 'Failed to list interviews.' });
    }
}
// GET /api/admin/interviews/:id
async function getInterview(req, res) {
    const { id } = req.params;
    try {
        const [rows] = await database_1.default.execute(`
      SELECT ci.*, COALESCE(au.full_name, '—') AS interviewer_name,
             CASE ci.company_ref_source
               WHEN 'uae'     THEN uc.name_en
               WHEN 'profile' THEN cp.company_name
               ELSE NULL
             END AS linked_company_name
      FROM company_interviews ci
      LEFT JOIN admin_users au ON au.id = ci.interviewer_id
      LEFT JOIN uae_companies uc ON uc.id = ci.company_ref_id AND ci.company_ref_source = 'uae' AND uc.country = ci.country
      LEFT JOIN company_profiles cp ON cp.id = ci.company_ref_id AND ci.company_ref_source = 'profile' AND cp.country = ci.country
      WHERE ci.id = ?
    `, [id]);
        const items = rows;
        if (items.length === 0)
            return res.status(404).json({ error: 'Not found.' });
        // Fetch edit logs
        const [logRows] = await database_1.default.execute(
            `SELECT id, editor_id, editor_name, edit_summary, edited_at
             FROM interview_edit_logs WHERE interview_id = ? ORDER BY edited_at ASC`,
            [id]
        );
        res.json({ interview: items[0], edit_logs: logRows });
    }
    catch (e) {
        res.status(500).json({ error: 'Failed to fetch interview.' });
    }
}
// PATCH /api/admin/interviews/:id — super admin edit
async function editInterview(req, res) {
    const { id } = req.params;
    const allowed = ['company_name', 'company_ref_id', 'section_1', 'section_2', 'section_3',
        'section_4', 'section_5', 'section_6', 'section_7', 'section_8', 'section_9'];
    const fields = {};
    for (const key of allowed) {
        if (req.body[key] !== undefined) {
            fields[key] = typeof req.body[key] === 'object'
                ? JSON.stringify(req.body[key])
                : req.body[key];
        }
    }
    if (Object.keys(fields).length === 0)
        return res.json({ ok: true });
    try {
        const setClauses = Object.keys(fields).map(k => `${k} = ?`).join(', ');
        await database_1.default.execute(`UPDATE company_interviews SET ${setClauses} WHERE id = ?`, [...Object.values(fields), id]);
        res.json({ ok: true });
    }
    catch (e) {
        res.status(500).json({ error: 'Failed to update interview.' });
    }
}
// DELETE /api/admin/interviews — bulk delete by ids[]
async function deleteInterviews(req, res) {
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0)
        return res.status(400).json({ error: 'ids array required' });
    const safe = ids.map(Number).filter(n => Number.isInteger(n) && n > 0);
    if (safe.length === 0)
        return res.status(400).json({ error: 'No valid ids' });
    try {
        const placeholders = safe.map(() => '?').join(',');
        await database_1.default.execute(`DELETE FROM company_interviews WHERE id IN (${placeholders})`, safe);
        res.json({ ok: true, deleted: safe.length });
    }
    catch (e) {
        res.status(500).json({ error: 'Failed to delete interviews.' });
    }
}
// GET /api/admin/staff
async function listStaff(req, res) {
    const country = STAFF_VALID_COUNTRIES.has(req.query.country) ? req.query.country : 'ae';
    try {
        const [rows] = await database_1.default.execute(`
      SELECT au.id, au.email, au.full_name, au.is_active, au.created_at, au.last_login, au.permissions, au.country,
             COUNT(ci.id) AS submitted_count
      FROM admin_users au
      LEFT JOIN company_interviews ci ON ci.interviewer_id = au.id AND ci.status = 'submitted'
      WHERE au.role = 'field_staff' AND au.country = ?
      GROUP BY au.id
      ORDER BY au.created_at DESC
    `, [country]);
        // Parse permissions JSON for each row
        const staff = rows.map(r => ({
            ...r,
            permissions: typeof r.permissions === 'string' ? JSON.parse(r.permissions || '{}') : (r.permissions || {}),
        }));
        res.json({ staff });
    }
    catch (e) {
        res.status(500).json({ error: 'Failed to list staff.' });
    }
}
// POST /api/admin/staff
async function createStaff(req, res) {
    const { email, password, fullName } = req.body;
    // 新增人员归入管理后台当前切换的国家（前端必传；缺省回落 ae）
    const country = STAFF_VALID_COUNTRIES.has(req.body.country) ? req.body.country : 'ae';
    if (!email || !password || !fullName) {
        return res.status(400).json({ error: 'email, password, fullName required.' });
    }
    if (password.length < 8) {
        return res.status(400).json({ error: 'Password must be at least 8 characters.' });
    }
    try {
        const [existing] = await database_1.default.execute('SELECT id FROM admin_users WHERE email = ?', [email.toLowerCase().trim()]);
        if (existing.length > 0) {
            return res.status(409).json({ error: 'Email already exists.' });
        }
        const hashed = await bcryptjs_1.default.hash(password, 12);
        const [result] = await database_1.default.execute(`INSERT INTO admin_users (email, password, full_name, role, country) VALUES (?, ?, ?, 'field_staff', ?)`, [email.toLowerCase().trim(), hashed, fullName.trim(), country]);
        res.status(201).json({ id: result.insertId });
    }
    catch (e) {
        res.status(500).json({ error: 'Failed to create staff.' });
    }
}
// PATCH /api/admin/staff/:id — toggle active
async function toggleStaff(req, res) {
    const { id } = req.params;
    const { is_active } = req.body;
    try {
        await database_1.default.execute('UPDATE admin_users SET is_active = ? WHERE id = ? AND role = ?', [is_active ? 1 : 0, id, 'field_staff']);
        res.json({ ok: true });
    }
    catch (e) {
        res.status(500).json({ error: 'Failed to update staff.' });
    }
}
// PATCH /api/admin/staff/:id/permissions — update staff permissions
async function updateStaffPermissions(req, res) {
    const { id } = req.params;
    const { permissions } = req.body;
    if (!permissions || typeof permissions !== 'object') {
        return res.status(400).json({ error: 'permissions object required.' });
    }
    // Only allow safe permission keys for field_staff
    const allowed = ['can_view_interviews'];
    const safe = {};
    for (const key of allowed) {
        if (key in permissions) safe[key] = Boolean(permissions[key]);
    }
    try {
        await database_1.default.execute('UPDATE admin_users SET permissions = ? WHERE id = ? AND role = ?', [JSON.stringify(safe), id, 'field_staff']);
        res.json({ ok: true });
    }
    catch (e) {
        res.status(500).json({ error: 'Failed to update permissions.' });
    }
}
