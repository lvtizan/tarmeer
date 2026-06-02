"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createDraft = createDraft;
exports.getMyDraft = getMyDraft;
exports.saveDraft = saveDraft;
exports.submitInterview = submitInterview;
exports.searchCompanies = searchCompanies;
exports.uploadPhoto = uploadPhoto;
exports.getSurveySchema = getSurveySchema;
exports.uploadPhotoMiddleware = void 0;
const database_1 = __importDefault(require("../config/database"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const crypto_1 = __importDefault(require("crypto"));
const multer_1 = __importDefault(require("multer"));
const FIELD_PHOTOS_DIR = path_1.default.join(__dirname, '..', '..', 'public', 'uploads', 'field-photos');
if (!fs_1.default.existsSync(FIELD_PHOTOS_DIR)) {
    fs_1.default.mkdirSync(FIELD_PHOTOS_DIR, { recursive: true, mode: 0o755 });
}
const _fieldPhotoStorage = multer_1.default.diskStorage({
    destination: (_req, _file, cb) => cb(null, FIELD_PHOTOS_DIR),
    filename: (_req, _file, cb) => {
        const name = `fp-${Date.now()}-${crypto_1.default.randomBytes(4).toString('hex')}.jpg`;
        cb(null, name);
    },
});
exports.uploadPhotoMiddleware = (0, multer_1.default)({
    storage: _fieldPhotoStorage,
    limits: { fileSize: 20 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
        if (file.mimetype.startsWith('image/')) cb(null, true);
        else cb(new Error('Only image files allowed'));
    },
}).single('photo');
// POST /api/field/interviews — create draft
async function createDraft(req, res) {
    const interviewerId = req.admin.id;
    try {
        const [result] = await database_1.default.execute(`INSERT INTO company_interviews (interviewer_id, status) VALUES (?, 'draft')`, [interviewerId]);
        const id = result.insertId;
        res.status(201).json({ id });
    }
    catch (e) {
        console.error('createDraft error:', e);
        res.status(500).json({ error: 'Failed to create draft.' });
    }
}
// GET /api/field/interviews/draft — get latest draft for current user
async function getMyDraft(req, res) {
    const interviewerId = req.admin.id;
    try {
        const [rows] = await database_1.default.execute(`SELECT * FROM company_interviews
       WHERE interviewer_id = ? AND status = 'draft'
       ORDER BY updated_at DESC LIMIT 1`, [interviewerId]);
        const drafts = rows;
        if (drafts.length === 0)
            return res.json({ draft: null });
        res.json({ draft: drafts[0] });
    }
    catch (e) {
        res.status(500).json({ error: 'Failed to fetch draft.' });
    }
}
// PATCH /api/field/interviews/:id — auto-save
async function saveDraft(req, res) {
    const { id } = req.params;
    const interviewerId = req.admin.id;
    const { company_name, company_ref_id, section_1, section_2, section_3, section_4, section_5, section_6, section_7, section_8, section_9, photos, } = req.body;
    try {
        // Verify ownership and draft status
        const [rows] = await database_1.default.execute(`SELECT id FROM company_interviews WHERE id = ? AND interviewer_id = ? AND status = 'draft'`, [id, interviewerId]);
        if (rows.length === 0) {
            return res.status(404).json({ error: 'Draft not found or already submitted.' });
        }
        const fields = {};
        if (company_name !== undefined)
            fields.company_name = String(company_name).slice(0, 200);
        if (company_ref_id !== undefined)
            fields.company_ref_id = company_ref_id || null;
        if (section_1 !== undefined)
            fields.section_1 = JSON.stringify(section_1);
        if (section_2 !== undefined)
            fields.section_2 = JSON.stringify(section_2);
        if (section_3 !== undefined)
            fields.section_3 = JSON.stringify(section_3);
        if (section_4 !== undefined)
            fields.section_4 = JSON.stringify(section_4);
        if (section_5 !== undefined)
            fields.section_5 = JSON.stringify(section_5);
        if (section_6 !== undefined)
            fields.section_6 = JSON.stringify(section_6);
        if (section_7 !== undefined)
            fields.section_7 = JSON.stringify(section_7);
        if (section_8 !== undefined)
            fields.section_8 = JSON.stringify(section_8);
        if (section_9 !== undefined)
            fields.section_9 = JSON.stringify(section_9);
        if (photos !== undefined)
            fields.photos = JSON.stringify(photos);
        if (Object.keys(fields).length === 0)
            return res.json({ ok: true });
        const setClauses = Object.keys(fields).map(k => `${k} = ?`).join(', ');
        const values = [...Object.values(fields), id];
        await database_1.default.execute(`UPDATE company_interviews SET ${setClauses} WHERE id = ?`, values);
        res.json({ ok: true });
    }
    catch (e) {
        console.error('saveDraft error:', e);
        res.status(500).json({ error: 'Failed to save.' });
    }
}
// POST /api/field/interviews/:id/submit — submit
async function submitInterview(req, res) {
    const { id } = req.params;
    const interviewerId = req.admin.id;
    try {
        const [rows] = await database_1.default.execute('SELECT id FROM company_interviews WHERE id = ? AND interviewer_id = ? AND status = ?', [id, interviewerId, 'draft']);
        if (rows.length === 0) {
            return res.status(404).json({ error: 'Draft not found.' });
        }
        await database_1.default.execute(`UPDATE company_interviews SET status = 'submitted', submitted_at = NOW() WHERE id = ?`, [id]);
        res.json({ ok: true });
    }
    catch (e) {
        res.status(500).json({ error: 'Failed to submit.' });
    }
}
// POST /api/field/interviews/:id/photos — upload watermark photo
async function uploadPhoto(req, res) {
    const { id } = req.params;
    const interviewerId = req.admin.id;
    if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
    }
    try {
        const [rows] = await database_1.default.execute('SELECT photos FROM company_interviews WHERE id = ? AND interviewer_id = ?', [id, interviewerId]);
        if (rows.length === 0) {
            fs_1.default.unlinkSync(req.file.path);
            return res.status(404).json({ error: 'Interview not found' });
        }
        await fs_1.default.promises.chmod(req.file.path, 0o644);
        const url = `/uploads/field-photos/${req.file.filename}`;
        const meta = {
            url,
            lat: req.body.lat ? parseFloat(req.body.lat) : undefined,
            lng: req.body.lng ? parseFloat(req.body.lng) : undefined,
            timestamp: req.body.timestamp || new Date().toISOString(),
        };
        const existing = rows[0].photos || [];
        const updated = [...existing, meta];
        await database_1.default.execute('UPDATE company_interviews SET photos = ? WHERE id = ?', [JSON.stringify(updated), id]);
        res.json({ url });
    }
    catch (e) {
        console.error('uploadPhoto error:', e);
        if (req.file?.path) {
            try { fs_1.default.unlinkSync(req.file.path); } catch {}
        }
        res.status(500).json({ error: 'Upload failed' });
    }
}
// GET /api/field/survey-schema — return current survey schema (falls back to null if not seeded)
async function getSurveySchema(req, res) {
    try {
        const [rows] = await database_1.default.execute('SELECT schema_json FROM survey_schema WHERE id = 1');
        if (rows.length === 0) return res.json({ schema: null });
        res.json({ schema: JSON.parse(rows[0].schema_json) });
    } catch {
        res.json({ schema: null });
    }
}
// GET /api/field/companies/search?q= — search uae_companies for linking
async function searchCompanies(req, res) {
    const q = String(req.query.q || '').trim().slice(0, 100);
    if (!q)
        return res.json({ results: [] });
    try {
        const [rows] = await database_1.default.execute(`SELECT id, name_en AS name, city FROM uae_companies WHERE name_en LIKE ? LIMIT 10`, [`%${q}%`]);
        res.json({ results: rows });
    }
    catch (e) {
        res.status(500).json({ error: 'Search failed.' });
    }
}
