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

// ── Survey → company_profiles 字段映射 ──────────────────────────────────────
const YEAR_MAP = {
    'Before 2000': 1995, '2000-2010': 2005, '2010-2015': 2012,
    '2015-2020': 2017,   '2020+': 2021,
};
// { column, type (null=已存在无需ALTER), extract(sections, interviewId) }
const SURVEY_FIELD_MAP = [
    { column: 'establishment_year', type: null,
      extract: (s) => { const y = s.section_1?.year_established; return y && YEAR_MAP[y] ? YEAR_MAP[y] : undefined; } },
    { column: 'city',                type: null,
      extract: (s) => s.section_1?.registration_location || undefined },
    { column: 'office_type',         type: 'VARCHAR(50)',
      extract: (s) => s.section_1?.field_3 || undefined },
    { column: 'one_stop_service',    type: 'VARCHAR(20)',
      extract: (s) => s.section_2?.one_stop_service || undefined },
    { column: 'has_construction_permit', type: 'TINYINT(1)',
      extract: (s) => { const v = s.section_2?.field_3; return v === 'Held' ? 1 : v === 'Not Held' ? 0 : undefined; } },
    { column: 'total_employees',     type: 'VARCHAR(20)',
      extract: (s) => s.section_3?.total_employees || undefined },
    { column: 'pm_team_size',        type: 'VARCHAR(20)',
      extract: (s) => s.section_3?.pm_team_size || undefined },
    { column: 'design_team_size',    type: 'VARCHAR(20)',
      extract: (s) => s.section_3?.design_team_size || undefined },
    { column: 'construction_team',   type: 'VARCHAR(20)',
      extract: (s) => s.section_3?.construction_team || undefined },
    { column: 'owner_nationality',   type: 'JSON',
      extract: (s) => { const v = s.section_3?.owner_nationality; return Array.isArray(v) && v.length ? v : undefined; } },
    { column: 'main_project_types',  type: 'JSON',
      extract: (s) => { const v = s.section_4?.main_project_types; return Array.isArray(v) && v.length ? v : undefined; } },
    { column: 'min_project_value',   type: 'VARCHAR(50)',
      extract: (s) => s.section_4?.typical_contract_value || undefined },
    { column: 'max_project_value',   type: 'VARCHAR(50)',
      extract: (s) => s.section_4?.field_4 || undefined },
    { column: 'material_sources',    type: 'JSON',
      extract: (s) => { const v = s.section_5?.main_material_sources; return Array.isArray(v) && v.length ? v : undefined; } },
    { column: 'latest_interview_id', type: 'INT',
      extract: (_s, ivId) => ivId },
    { column: 'last_interviewed_at', type: 'DATETIME',
      extract: () => new Date() },
];

// ── 自动补列（幂等，兼容 MySQL 8.0 — 不支持 ADD COLUMN IF NOT EXISTS）────────
async function ensureColumns(pool) {
    const [existing] = await pool.execute(
        `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'company_profiles'`
    );
    const existingSet = new Set(existing.map(r => r.COLUMN_NAME));
    for (const f of SURVEY_FIELD_MAP.filter(f => f.type !== null)) {
        if (existingSet.has(f.column)) continue;
        try {
            await pool.execute(`ALTER TABLE company_profiles ADD COLUMN \`${f.column}\` ${f.type} NULL`);
            console.log(`[field-merge] added column: ${f.column}`);
        } catch (e) {
            console.error(`[field-merge] ensureColumn ${f.column}:`, e.message);
        }
    }
}

async function ensureEditLogsTable() {
  try {
    await database_1.default.execute(`
      CREATE TABLE IF NOT EXISTS interview_edit_logs (
        id INT AUTO_INCREMENT PRIMARY KEY,
        interview_id INT NOT NULL,
        editor_id INT NOT NULL,
        editor_name VARCHAR(100) NOT NULL,
        snapshot_before JSON,
        edit_summary TEXT,
        edited_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_interview_id (interview_id)
      )
    `);
  } catch(e) {
    console.error('[field] ensureEditLogsTable:', e.message);
  }
}
async function ensureInterviewColumns() {
  const cols = ['company_ref_source'];
  try {
    const [existing] = await database_1.default.execute(
      `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'company_interviews'`
    );
    const existingSet = new Set(existing.map(r => r.COLUMN_NAME));
    if (!existingSet.has('company_ref_source')) {
      await database_1.default.execute(`ALTER TABLE company_interviews ADD COLUMN company_ref_source VARCHAR(20) NULL DEFAULT 'uae'`);
      console.log('[field] added column: company_ref_source');
    }
    if (!existingSet.has('country')) {
      await database_1.default.execute(`ALTER TABLE company_interviews ADD COLUMN country VARCHAR(5) NOT NULL DEFAULT 'ae'`);
      console.log('[field] added column: country');
    }
  } catch(e) {
    console.error('[field] ensureInterviewColumns:', e.message);
  }
}
// Run on module load
ensureEditLogsTable();
ensureInterviewColumns();
ensureColumns(database_1.default);

// ── 核心合并逻辑（fire-and-forget）──────────────────────────────────────────
async function mergeInterviewToProfile(interviewId) {
    try {
        const [rows] = await database_1.default.execute(`SELECT * FROM company_interviews WHERE id = ? LIMIT 1`, [interviewId]);
        const iv = rows[0];
        if (!iv) return;

        // 条件1：必须匹配到已注册装企（profile 来源）
        if (iv.company_ref_source !== 'profile' || !iv.company_ref_id) {
            console.log(`[field-merge] #${interviewId}: no profile match, skip`);
            return;
        }
        // 条件2：必须有带经纬度的实地照片
        const photos = Array.isArray(iv.photos) ? iv.photos : [];
        const hasGeoPhoto = photos.some(p => p && p.lat != null && p.lng != null);
        if (!hasGeoPhoto) {
            console.log(`[field-merge] #${interviewId}: no geo photo, skip`);
            return;
        }

        await ensureColumns(database_1.default);

        const sections = {
            section_1: iv.section_1 || {},
            section_2: iv.section_2 || {},
            section_3: iv.section_3 || {},
            section_4: iv.section_4 || {},
            section_5: iv.section_5 || {},
        };

        const setClauses = [];
        const values = [];
        for (const f of SURVEY_FIELD_MAP) {
            const val = f.extract(sections, iv.id);
            if (val === undefined || val === null) continue;
            setClauses.push(`\`${f.column}\` = ?`);
            values.push(typeof val === 'object' && !(val instanceof Date) ? JSON.stringify(val) : val);
        }
        if (setClauses.length === 0) return;

        values.push(iv.company_ref_id);
        await database_1.default.execute(
            `UPDATE company_profiles SET ${setClauses.join(', ')} WHERE id = ?`, values
        );
        console.log(`[field-merge] #${interviewId} -> company_profiles #${iv.company_ref_id} (${setClauses.length} fields)`);

        // 同步 CRM（fire-and-forget，CRM 团队实现接口后生效）
        try {
            const crmSvc = require('../lib/crmIntegrationService');
            crmSvc.partnerSync(iv.company_ref_id);
        } catch (e) {
            console.error('[field-merge] CRM sync:', e.message);
        }
    } catch (e) {
        console.error(`[field-merge] #${interviewId} error:`, e.message);
    }
}

async function createDraft(req, res) {
    try {
        const interviewerId = req.adminId || null;
        const [result] = await database_1.default.execute(
            `INSERT INTO company_interviews (status, interviewer_id) VALUES ('draft', ?)`,
            [interviewerId]
        );
        const id = result.insertId;
        res.status(201).json({ id });
    }
    catch (e) {
        console.error('createDraft error:', e);
        res.status(500).json({ error: 'Failed to create draft.' });
    }
}
async function getMyDraft(req, res) {
    const id = parseInt(String(req.query.id || ''), 10);
    if (!id) return res.json({ draft: null });
    try {
        const [rows] = await database_1.default.execute(`SELECT * FROM company_interviews WHERE id = ? AND status = 'draft' LIMIT 1`, [id]);
        const drafts = rows;
        if (drafts.length === 0) return res.json({ draft: null });
        res.json({ draft: drafts[0] });
    }
    catch (e) {
        res.status(500).json({ error: 'Failed to fetch draft.' });
    }
}
async function saveDraft(req, res) {
    const { id } = req.params;
    const { company_name, company_ref_id, company_ref_source, section_1, section_2, section_3, section_4, section_5, section_6, section_7, section_8, section_9, photos, } = req.body;
    try {
        const [rows] = await database_1.default.execute(`SELECT id FROM company_interviews WHERE id = ? AND status = 'draft'`, [id]);
        if (rows.length === 0) {
            return res.status(404).json({ error: 'Draft not found or already submitted.' });
        }
        const fields = {};
        if (company_name !== undefined)
            fields.company_name = String(company_name).slice(0, 200);
        if (company_ref_id !== undefined)
            fields.company_ref_id = company_ref_id || null;
        if (company_ref_source !== undefined)
            fields.company_ref_source = company_ref_source || 'uae';
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
async function submitInterview(req, res) {
    const { id } = req.params;
    try {
        const [rows] = await database_1.default.execute('SELECT id FROM company_interviews WHERE id = ? AND status = ?', [id, 'draft']);
        if (rows.length === 0) {
            return res.status(404).json({ error: 'Draft not found.' });
        }
        await database_1.default.execute(`UPDATE company_interviews SET status = 'submitted', submitted_at = NOW() WHERE id = ?`, [id]);
        // Write initial audit log
        try {
          const editorId = req.adminId || 0;
          const [editorRows] = await database_1.default.execute(
            'SELECT full_name FROM admin_users WHERE id = ?', [editorId]
          );
          const editorName = editorRows[0]?.full_name || '—';
          await database_1.default.execute(
            `INSERT INTO interview_edit_logs (interview_id, editor_id, editor_name, snapshot_before, edit_summary)
             VALUES (?, ?, ?, NULL, 'Initial submission')`,
            [id, editorId, editorName]
          );
        } catch(logErr) {
          console.error('[field] audit log error:', logErr.message);
        }
        res.json({ ok: true });
        // fire-and-forget：满足条件时自动合并 + 同步 CRM
        mergeInterviewToProfile(parseInt(id, 10)).catch(() => {});
    }
    catch (e) {
        res.status(500).json({ error: 'Failed to submit.' });
    }
}
async function uploadPhoto(req, res) {
    const { id } = req.params;
    if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
    }
    try {
        const [rows] = await database_1.default.execute('SELECT photos FROM company_interviews WHERE id = ?', [id]);
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
async function getSurveySchema(req, res) {
    try {
        const [rows] = await database_1.default.execute('SELECT schema_json FROM survey_schema WHERE id = 1');
        if (rows.length === 0) return res.json({ schema: null });
        res.json({ schema: JSON.parse(rows[0].schema_json) });
    } catch {
        res.json({ schema: null });
    }
}
async function searchCompanies(req, res) {
  const q = String(req.query.q || '').trim().slice(0, 100);
  if (!q) return res.json({ results: [] });
  const like = `%${q}%`;
  try {
    const [rows] = await database_1.default.execute(
      `(SELECT id, name_en AS name, city, 'uae' AS source FROM uae_companies WHERE name_en LIKE ? AND name_en IS NOT NULL)
       UNION
       (SELECT id, company_name AS name, city, 'profile' AS source FROM company_profiles WHERE company_name LIKE ? AND deleted_at IS NULL)
       ORDER BY name
       LIMIT 20`,
      [like, like]
    );

    // For each company, fetch recent submitted interviews
    const results = await Promise.all(rows.map(async (company) => {
      const [ivRows] = await database_1.default.execute(
        `SELECT ci.id, ci.submitted_at, COALESCE(au.full_name, '—') AS interviewer_name
         FROM company_interviews ci
         LEFT JOIN admin_users au ON au.id = ci.interviewer_id
         WHERE ci.company_ref_id = ? AND ci.company_ref_source = ? AND ci.status = 'submitted'
         ORDER BY ci.submitted_at DESC
         LIMIT 5`,
        [company.id, company.source]
      );
      return { ...company, interviews: ivRows };
    }));

    res.json({ results });
  } catch(e) {
    console.error('searchCompanies error:', e);
    res.status(500).json({ error: 'Search failed.' });
  }
}
async function loadInterview(req, res) {
    const { id } = req.params;
    try {
        const [rows] = await database_1.default.execute(
            `SELECT ci.*, COALESCE(au.full_name, '—') AS interviewer_name
             FROM company_interviews ci
             LEFT JOIN admin_users au ON au.id = ci.interviewer_id
             WHERE ci.id = ? AND ci.status = 'submitted'`,
            [id]
        );
        if (rows.length === 0) return res.status(404).json({ error: 'Interview not found.' });
        res.json({ interview: rows[0] });
    } catch(e) {
        res.status(500).json({ error: 'Failed to load interview.' });
    }
}
exports.loadInterview = loadInterview;
async function reSubmitInterview(req, res) {
  const { id } = req.params;
  const allowed = ['company_name','company_ref_id','company_ref_source',
    'section_1','section_2','section_3','section_4','section_5',
    'section_6','section_7','section_8','section_9'];

  try {
    // Fetch current state for snapshot
    const [rows] = await database_1.default.execute(
      'SELECT * FROM company_interviews WHERE id = ? AND status = ?',
      [id, 'submitted']
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Submitted interview not found.' });
    const current = rows[0];

    // Build update fields
    const fields = {};
    for (const key of allowed) {
      if (req.body[key] !== undefined) {
        fields[key] = typeof req.body[key] === 'object' ? JSON.stringify(req.body[key]) : req.body[key];
      }
    }
    if (Object.keys(fields).length > 0) {
      const setClauses = Object.keys(fields).map(k => `${k} = ?`).join(', ');
      await database_1.default.execute(
        `UPDATE company_interviews SET ${setClauses}, submitted_at = NOW(), updated_at = NOW() WHERE id = ?`,
        [...Object.values(fields), id]
      ).catch(async () => {
        // updated_at may not exist; retry without it
        await database_1.default.execute(
          `UPDATE company_interviews SET ${setClauses}, submitted_at = NOW() WHERE id = ?`,
          [...Object.values(fields), id]
        );
      });
    }

    // Build edit summary (field-level diff)
    const summaryParts = [];
    for (const key of allowed) {
      if (req.body[key] !== undefined) {
        const oldVal = typeof current[key] === 'object' && current[key] !== null
          ? JSON.stringify(current[key]) : String(current[key] || '');
        const newVal = typeof req.body[key] === 'object'
          ? JSON.stringify(req.body[key]) : String(req.body[key]);
        if (oldVal !== newVal) summaryParts.push(`${key}: "${oldVal.slice(0, 80)}" → "${newVal.slice(0, 80)}"`);
      }
    }
    const editSummary = summaryParts.length > 0 ? summaryParts.join('; ') : 'Re-submitted (no field changes)';

    // Snapshot: all sections before edit
    const snapshotBefore = {};
    for (const key of allowed) snapshotBefore[key] = current[key];

    // Write audit log
    const editorId = req.adminId || 0;
    const [editorRows] = await database_1.default.execute(
      'SELECT full_name FROM admin_users WHERE id = ?', [editorId]
    );
    const editorName = editorRows[0]?.full_name || '—';
    await database_1.default.execute(
      `INSERT INTO interview_edit_logs (interview_id, editor_id, editor_name, snapshot_before, edit_summary)
       VALUES (?, ?, ?, ?, ?)`,
      [id, editorId, editorName, JSON.stringify(snapshotBefore), editSummary]
    );

    res.json({ ok: true });
    // Re-run merge in case data changed
    mergeInterviewToProfile(parseInt(id, 10)).catch(() => {});
  } catch(e) {
    console.error('reSubmitInterview error:', e);
    res.status(500).json({ error: 'Failed to re-submit.' });
  }
}
exports.reSubmitInterview = reSubmitInterview;
