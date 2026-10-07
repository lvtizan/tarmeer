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
const verification = require("../lib/verificationV7");
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

const FIELD_ATTACHMENTS_DIR = path_1.default.join(__dirname, '..', '..', 'public', 'uploads', 'field-attachments');
if (!fs_1.default.existsSync(FIELD_ATTACHMENTS_DIR)) {
    fs_1.default.mkdirSync(FIELD_ATTACHMENTS_DIR, { recursive: true, mode: 0o755 });
}
const _ALLOWED_ATTACHMENT_TYPES = new Set([
    'image/jpeg', 'image/png', 'image/webp', 'image/gif',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
]);
const _attachmentStorage = multer_1.default.diskStorage({
    destination: (_req, _file, cb) => cb(null, FIELD_ATTACHMENTS_DIR),
    filename: (_req, file, cb) => {
        const ext = path_1.default.extname(file.originalname).toLowerCase() || '.bin';
        const name = `fa-${Date.now()}-${crypto_1.default.randomBytes(4).toString('hex')}${ext}`;
        cb(null, name);
    },
});
exports.uploadAttachmentMiddleware = (0, multer_1.default)({
    storage: _attachmentStorage,
    limits: { fileSize: 50 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
        if (_ALLOWED_ATTACHMENT_TYPES.has(file.mimetype)) cb(null, true);
        else cb(new Error('File type not allowed'));
    },
}).single('file');

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
    if (!existingSet.has('qa_answers')) {
      await database_1.default.execute(`ALTER TABLE company_interviews ADD COLUMN qa_answers JSON NULL`);
      console.log('[field] added column: qa_answers');
    }
    if (!existingSet.has('location_pin')) {
      await database_1.default.execute(`ALTER TABLE company_interviews ADD COLUMN location_pin JSON NULL`);
      console.log('[field] added column: location_pin');
    }
    if (!existingSet.has('attachments')) {
      await database_1.default.execute(`ALTER TABLE company_interviews ADD COLUMN attachments JSON NULL`);
      console.log('[field] added column: attachments');
    }
    if (!existingSet.has('filled_by')) {
      await database_1.default.execute(`ALTER TABLE company_interviews ADD COLUMN filled_by VARCHAR(120) NULL`);
      console.log('[field] added column: filled_by');
    }
    // 公开问卷无外勤人员：interviewer_id 允许为空
    const [nullCheck] = await database_1.default.execute(
      `SELECT IS_NULLABLE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'company_interviews' AND COLUMN_NAME = 'interviewer_id'`
    );
    if (nullCheck[0] && nullCheck[0].IS_NULLABLE === 'NO') {
      await database_1.default.execute(`ALTER TABLE company_interviews MODIFY interviewer_id INT NULL`);
      console.log('[field] interviewer_id -> nullable');
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
        if (!iv || iv.schema_version === verification.VERSION) return;

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

// V7 public draft mutations require a secret returned only at creation.
async function fetchAccessibleInterview(req, res, status, db=database_1.default, lock=false) {
    const [rows] = await db.execute('SELECT * FROM company_interviews WHERE id = ? LIMIT 1'+(lock?' FOR UPDATE':''), [req.params.id || req.query.id]);
    const row = rows[0];
    if (!row || (status && row.status !== status)) { res.status(404).json({error:'Interview not found.'}); return null; }
    if (!verification.canAccessCountry(req, row.country)) { res.status(404).json({error:'Interview not found.'}); return null; }
    if (!req.admin && (row.schema_version === verification.VERSION || row.draft_token_hash) && !verification.matchesToken(req.headers?.['x-interview-token'], row.draft_token_hash)) {
        res.status(403).json({error:'This draft requires its private access token.'}); return null;
    }
    return row;
}
async function guardDraftUpload(req,res,next) {
    try { const row=await fetchAccessibleInterview(req,res,req.admin ? null : 'draft'); if(!row) return; req.interview=row; next(); }
    catch(e) { console.error('guardDraftUpload:',e); res.status(500).json({error:'Unable to verify draft access.'}); }
}
exports.guardDraftUpload=guardDraftUpload;
async function createDraft(req, res) {
    try {
        const interviewerId=req.adminId || null;
        const country=verification.requestCountry(req);
        if(req.body.country && req.body.country !== country) return res.status(400).json({error:'Country does not match the current site.'});
        const schema=await verification.loadSchema(database_1.default,country,req.body.schema_version);
        const version=schema?.version || 'legacy';
        if(req.body.schema_version && req.body.schema_version !== version) return res.status(409).json({error:'The requested survey version is no longer available. Please reload.'});
        const token=version===verification.VERSION ? verification.createToken() : null;
        const [result]=await database_1.default.execute(
            `INSERT INTO company_interviews (status, interviewer_id, country, schema_version, schema_snapshot, draft_token_hash) VALUES ('draft', ?, ?, ?, ?, ?)`,
            [interviewerId,country,version,schema ? JSON.stringify(schema) : null,token ? verification.hashToken(token) : null]);
        res.status(201).json({id:result.insertId,country,schema_version:version,schema_snapshot:schema,...(token?{draft_token:token}:{})});
    } catch(e) { console.error('createDraft error:',e); res.status(500).json({error:'Failed to create draft.'}); }
}
async function getMyDraft(req,res) {
    const id=Number(req.query.id);
    if(!Number.isSafeInteger(id)||id<=0) return res.json({draft:null});
    try { const row=await fetchAccessibleInterview(req,res,'draft'); if(row) res.json({draft:verification.sanitizeInterview(row)}); }
    catch(e) { res.status(500).json({error:'Failed to fetch draft.'}); }
}
// 根据关联公司（profile = company_profiles / uae = uae_companies）查国家，查不到返回 null
async function resolveCompanyRefCountry(refId, refSource) {
    try {
        const table = refSource === 'profile' ? 'company_profiles' : 'uae_companies';
        const [rows] = await database_1.default.execute(`SELECT country FROM ${table} WHERE id = ? LIMIT 1`, [refId]);
        const c = rows[0]?.country;
        return c === 'vn' || c === 'sa' || c === 'ae' ? c : null;
    }
    catch {
        return null;
    }
}
async function saveDraft(req, res) {
    const { id } = req.params;
    const { company_name, company_ref_id, company_ref_source, section_1, section_2, section_3, section_4, section_5, section_6, section_7, section_8, section_9, photos, qa_answers, location_pin, filled_by, } = req.body;
    let db,committed=false;
    try {
        db=await database_1.default.getConnection();
        await db.beginTransaction();
        const current = await fetchAccessibleInterview(req,res,'draft',db,true);
        if(!current) return;
        const v7 = current.schema_version === verification.VERSION;
        if(req.body.removed_attachment_urls!==undefined) {
            if(!v7) return res.status(400).json({error:'Evidence removal deltas require the V7 survey.'});
            if(req.body.attachments!==undefined) return res.status(400).json({error:'Send evidence removal URLs without replacing the attachment list.'});
        }
        if(req.body.verification_data !== undefined && !v7) return res.status(400).json({error:'This record uses the legacy survey.'});
        const fields = {};
        if(v7) {
            if(Object.keys(req.body).some(k=>/^section_[1-9]$/.test(k))) return res.status(400).json({error:'V7 answers must use verification_data.'});
            if(req.body.verification_data !== undefined) {
                const snapshot=verification.parseJSON(current.schema_snapshot);
                const previous=verification.parseJSON(current.verification_data)||{};
                if(!req.body.verification_data || typeof req.body.verification_data!=='object' || Array.isArray(req.body.verification_data)) return res.status(400).json({error:'Verification answers must be an object.'});
                const merged={...previous,...req.body.verification_data};
                const error=verification.validateAnswersDetailed(merged,snapshot,false);
                if(error) return res.status(400).json(error);
                fields.verification_data=JSON.stringify(merged);
                const companyField=snapshot.sections.flatMap(s=>s.fields).find(f=>f.role==='company_name');
                if(companyField && merged[companyField.key]!==undefined) fields.company_name=String(merged[companyField.key]).slice(0,200);
            }
        }
        if(v7 && req.body.attachments!==undefined) {
            const result=verification.validateEvidence(req.body.attachments,current.attachments);
            if(result.error) return res.status(400).json({error:result.error});
            fields.attachments=JSON.stringify(result.attachments);
        }
        if(v7 && req.body.removed_attachment_urls!==undefined) {
            const result=verification.removeEvidence(req.body.removed_attachment_urls,current.attachments);
            if(result.error) return res.status(400).json({error:result.error});
            fields.attachments=JSON.stringify(result.attachments);
        }
        if (filled_by !== undefined)
            fields.filled_by = filled_by ? String(filled_by).slice(0, 120) : null;
        if (!v7 && company_name !== undefined)
            fields.company_name = String(company_name).slice(0, 200);
        if (company_ref_id !== undefined)
            fields.company_ref_id = company_ref_id || null;
        if (company_ref_source !== undefined)
            fields.company_ref_source = company_ref_source || null;
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
        if (!v7 && photos !== undefined)
            fields.photos = JSON.stringify(photos);
        if (qa_answers !== undefined)
            fields.qa_answers = JSON.stringify(qa_answers);
        if (location_pin !== undefined)
            fields.location_pin = location_pin ? JSON.stringify(location_pin) : null;
        const refId=company_ref_id === undefined ? current.company_ref_id : company_ref_id;
        const refSource=company_ref_source === undefined ? current.company_ref_source : company_ref_source;
        if(refId && (company_ref_id !== undefined || company_ref_source !== undefined)) {
            if(!['uae','profile'].includes(refSource)) return res.status(400).json({error:'Company reference source is required.'});
            const refCountry=await resolveCompanyRefCountry(refId,refSource);
            if(refCountry!==current.country) return res.status(400).json({error:'Company belongs to a different country or does not exist.'});
        }
        if (Object.keys(fields).length === 0)
            return res.json({ ok: true });
        const setClauses = Object.keys(fields).map(k => `${k} = ?`).join(', ');
        const values = [...Object.values(fields), id];
        await db.execute(`UPDATE company_interviews SET ${setClauses} WHERE id = ?`, values);
        await db.commit(); committed=true;
        res.json({ ok: true });
    }
    catch (e) {
        console.error('saveDraft error:', e);
        res.status(500).json({ error: 'Failed to save.' });
    } finally { if(db) {if(!committed) await db.rollback();db.release();} }
}
// 提交时自动绑定：公司名在同国家内精确匹配（忽略大小写）且唯一 → 写入 company_ref；
// 匹配不上的留空，由管理员在后台手动绑定
async function autoBindCompanyRef(interviewId) {
    try {
        const [rows] = await database_1.default.execute(
            `SELECT company_name, company_ref_id, country FROM company_interviews WHERE id = ? LIMIT 1`, [interviewId]);
        const iv = rows[0];
        if (!iv || iv.company_ref_id || !iv.company_name || !iv.company_name.trim()) return;
        const name = iv.company_name.trim();
        const country = iv.country || 'ae';
        const [matches] = await database_1.default.execute(
            `(SELECT id, 'uae' AS source FROM uae_companies WHERE LOWER(name_en) = LOWER(?) AND country = ?)
             UNION ALL
             (SELECT id, 'profile' AS source FROM company_profiles WHERE LOWER(company_name) = LOWER(?) AND deleted_at IS NULL AND country = ?)
             LIMIT 2`,
            [name, country, name, country]);
        if (matches.length === 1) {
            await database_1.default.execute(
                `UPDATE company_interviews SET company_ref_id = ?, company_ref_source = ? WHERE id = ?`,
                [matches[0].id, matches[0].source, interviewId]);
            console.log(`[field] auto-bound interview #${interviewId} -> ${matches[0].source}#${matches[0].id} (${name})`);
        }
    }
    catch (e) {
        console.error('[field] autoBindCompanyRef:', e.message);
    }
}
async function submitInterview(req, res) {
    const { id } = req.params;
    try {
        const current=await fetchAccessibleInterview(req,res,'draft');
        if(!current) return;
        if(current.schema_version===verification.VERSION) {
            const error=verification.validateAnswersDetailed(verification.parseJSON(current.verification_data)||{},verification.parseJSON(current.schema_snapshot),true);
            if(error) return res.status(400).json(error);
        }
        await autoBindCompanyRef(parseInt(id, 10));
        const db=await database_1.default.getConnection();
        try {
            await db.beginTransaction();
            const [locked]=await db.execute("SELECT * FROM company_interviews WHERE id = ? AND status = 'draft' FOR UPDATE",[id]);
            if(!locked.length) {await db.rollback();return res.status(409).json({error:'This record has already been submitted.'});}
            if(locked[0].schema_version===verification.VERSION) {
                const error=verification.validateAnswersDetailed(verification.parseJSON(locked[0].verification_data)||{},verification.parseJSON(locked[0].schema_snapshot),true);
                if(error) {await db.rollback();return res.status(400).json(error);}
            }
            await db.execute("UPDATE company_interviews SET status = 'submitted', submitted_at = NOW() WHERE id = ?",[id]);
            const editorId=req.adminId||0;
            const [editors]=await db.execute('SELECT full_name FROM admin_users WHERE id = ?',[editorId]);
            await db.execute(`INSERT INTO interview_edit_logs (interview_id,editor_id,editor_name,snapshot_before,edit_summary) VALUES (?,?,?,NULL,'Initial submission')`,[id,editorId,editors[0]?.full_name||'—']);
            await db.commit();
        } catch(error) {await db.rollback();throw error;} finally {db.release();}
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
            field_key: req.body.field_key || undefined,
        };
        await database_1.default.execute("UPDATE company_interviews SET photos = JSON_ARRAY_APPEND(COALESCE(photos, JSON_ARRAY()), '$', CAST(? AS JSON)) WHERE id = ?", [JSON.stringify(meta), id]);
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
async function uploadAttachment(req, res) {
    const { id } = req.params;
    if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
    }
    try {
        if(req.interview?.schema_version===verification.VERSION) {
            const snapshot=verification.parseJSON(req.interview.schema_snapshot);
            const field=snapshot.sections.flatMap(s=>s.fields).find(f=>f.key===req.body.field_key && f.type==='attachment');
            const error=!field ? 'Select an evidence category from the survey.' : verification.validateEvidenceFile(req.file);
            if(error) { fs_1.default.unlinkSync(req.file.path); return res.status(400).json({error}); }
        }
        const [rows] = await database_1.default.execute('SELECT attachments FROM company_interviews WHERE id = ?', [id]);
        if (rows.length === 0) {
            fs_1.default.unlinkSync(req.file.path);
            return res.status(404).json({ error: 'Interview not found' });
        }
        await fs_1.default.promises.chmod(req.file.path, 0o644);
        const url = `/uploads/field-attachments/${req.file.filename}`;
        const meta = {
            url,
            name: req.file.originalname,
            type: req.file.mimetype,
            size: req.file.size,
            field_key: req.body.field_key || undefined,
            uploaded_at: new Date().toISOString(),
        };
        await database_1.default.execute("UPDATE company_interviews SET attachments = JSON_ARRAY_APPEND(COALESCE(attachments, JSON_ARRAY()), '$', CAST(? AS JSON)) WHERE id = ?", [JSON.stringify(meta), id]);
        res.json(meta);
    }
    catch (e) {
        console.error('uploadAttachment error:', e);
        if (req.file?.path) {
            try { fs_1.default.unlinkSync(req.file.path); } catch {}
        }
        res.status(500).json({ error: 'Upload failed' });
    }
}
exports.uploadAttachment = uploadAttachment;
async function getSurveySchema(req,res) {
    try { const schema=await verification.loadSchema(database_1.default,verification.requestCountry(req),req.query.version || req.query.schema_version); res.json({schema}); }
    catch(e) { console.error('getSurveySchema:',e); res.status(500).json({error:'Failed to load survey schema.'}); }
}
async function searchCompanies(req, res) {
  const q = String(req.query.q || '').trim().slice(0, 100);
  if (!q) return res.json({ results: [] });
  const like = `%${q}%`;
  // 国家数据隔离：外勤只能搜到本人所属国家的公司；超管可用 ?country= 指定（后台按访谈国家绑定）
  const VALID = ['ae', 'vn', 'sa'];
  const requested = String(req.query.country || '');
  const staffCountry = (req.admin?.role === 'super_admin' && VALID.includes(requested))
      ? requested
      : (VALID.includes(req.admin?.country) ? req.admin.country : 'ae');
  try {
    const [rows] = await database_1.default.execute(
      `(SELECT id, name_en AS name, city, 'uae' AS source FROM uae_companies WHERE name_en LIKE ? AND name_en IS NOT NULL AND country = ?)
       UNION
       (SELECT id, company_name AS name, city, 'profile' AS source FROM company_profiles WHERE company_name LIKE ? AND deleted_at IS NULL AND country = ?)
       ORDER BY name
       LIMIT 20`,
      [like, staffCountry, like, staffCountry]
    );

    // For each company, fetch recent submitted interviews
    const results = await Promise.all(rows.map(async (company) => {
      const [ivRows] = await database_1.default.execute(
        `SELECT ci.id, ci.submitted_at, COALESCE(au.full_name, '—') AS interviewer_name
         FROM company_interviews ci
         LEFT JOIN admin_users au ON au.id = ci.interviewer_id
         WHERE ci.company_ref_id = ? AND ci.company_ref_source = ? AND ci.status = 'submitted' AND ci.country = ?
         ORDER BY ci.submitted_at DESC
         LIMIT 5`,
        [company.id, company.source, staffCountry]
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
        if (rows.length === 0 || !verification.canAccessCountry(req,rows[0].country)) return res.status(404).json({ error: 'Interview not found.' });
        res.json({ interview: verification.sanitizeInterview(rows[0]) });
    } catch(e) {
        res.status(500).json({ error: 'Failed to load interview.' });
    }
}
exports.loadInterview = loadInterview;
async function reSubmitInterview(req, res) {
  const { id } = req.params;
  const allowed = ['company_name','company_ref_id','company_ref_source',
    'section_1','section_2','section_3','section_4','section_5',
    'section_6','section_7','section_8','section_9','verification_data','attachments','filled_by','location_pin','qa_answers'];

  let db,committed=false;
  try {
    db=await database_1.default.getConnection();
    await db.beginTransaction();
    // Fetch current state for snapshot
    const [rows] = await db.execute(
      'SELECT * FROM company_interviews WHERE id = ? AND status = ? FOR UPDATE',
      [id, 'submitted']
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Submitted interview not found.' });
    const current = rows[0];
    if(!verification.canAccessCountry(req,current.country)) return res.status(404).json({error:'Interview not found.'});
    if(current.schema_version === verification.VERSION) {
        if(Object.keys(req.body).some(k=>/^section_[1-9]$/.test(k))) return res.status(400).json({error:'V7 answers must use verification_data.'});
        if(req.body.verification_data !== undefined) {
            if(!req.body.verification_data || typeof req.body.verification_data!=='object' || Array.isArray(req.body.verification_data)) return res.status(400).json({error:'Verification answers must be an object.'});
            req.body.verification_data={...(verification.parseJSON(current.verification_data)||{}),...req.body.verification_data};
            const error=verification.validateAnswersDetailed(req.body.verification_data,verification.parseJSON(current.schema_snapshot),true);
            if(error) return res.status(400).json(error);
        }
    } else if(req.body.verification_data!==undefined) return res.status(400).json({error:'This record uses the legacy survey.'});

    if(req.body.attachments!==undefined) {
        const result=verification.validateEvidence(req.body.attachments,current.attachments);
        if(result.error) return res.status(400).json({error:result.error});
        req.body.attachments=result.attachments;
    }
    // Build update fields
    const fields = {};
    for (const key of allowed) {
      if (req.body[key] !== undefined && !(current.schema_version===verification.VERSION && key==='company_name')) {
        fields[key] = typeof req.body[key] === 'object' ? JSON.stringify(req.body[key]) : req.body[key];
      }
    }
    const refId=req.body.company_ref_id===undefined?current.company_ref_id:req.body.company_ref_id;
    const refSource=req.body.company_ref_source===undefined?current.company_ref_source:req.body.company_ref_source;
    if(refId && (req.body.company_ref_id!==undefined || req.body.company_ref_source!==undefined)) {
        if(!['uae','profile'].includes(refSource)) return res.status(400).json({error:'Company reference source is required.'});
        if(await resolveCompanyRefCountry(refId,refSource)!==current.country) return res.status(400).json({error:'Company belongs to a different country or does not exist.'});
    }
    if(current.schema_version===verification.VERSION && req.body.verification_data) {
        const companyField=verification.parseJSON(current.schema_snapshot).sections.flatMap(s=>s.fields).find(f=>f.role==='company_name');
        if(companyField && req.body.verification_data[companyField.key]!==undefined) fields.company_name=String(req.body.verification_data[companyField.key]).slice(0,200);
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
    {
        if(Object.keys(fields).length) {
            const setClauses=Object.keys(fields).map(k=>`${k} = ?`).join(', ');
            await db.execute(`UPDATE company_interviews SET ${setClauses}, submitted_at = NOW() WHERE id = ?`,[...Object.values(fields),id]);
        }
        await db.execute(`INSERT INTO interview_edit_logs (interview_id,editor_id,editor_name,snapshot_before,edit_summary) VALUES (?,?,?,?,?)`,[id,editorId,editorName,JSON.stringify(snapshotBefore),editSummary]);
        await db.commit(); committed=true;
    }


    res.json({ ok: true });
    // Re-run merge in case data changed
    mergeInterviewToProfile(parseInt(id, 10)).catch(() => {});
  } catch(e) {
    console.error('reSubmitInterview error:', e);
    res.status(500).json({ error: 'Failed to re-submit.' });
  } finally {if(db) {if(!committed) await db.rollback();db.release();}}
}
exports.reSubmitInterview = reSubmitInterview;
