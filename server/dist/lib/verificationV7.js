'use strict';
const crypto = require('crypto');
const VERSION = 'tarmeer-verification-v7';
const COUNTRIES = new Set(['ae','vn','sa']);
function parseJSON(value) { return typeof value === 'string' ? JSON.parse(value) : value; }
function requestCountry(req) {
    if (req.admin && req.admin.role !== 'super_admin') return COUNTRIES.has(req.admin.country) ? req.admin.country : 'ae';
    return COUNTRIES.has(req.query?.country) ? req.query.country : COUNTRIES.has(req.country) ? req.country : 'ae';
}
function canAccessCountry(req, country) {
    if(!req.admin) return requestCountry(req)===country;
    if(req.admin.role!=='super_admin') return req.admin.country===country;
    return !COUNTRIES.has(req.query?.country) || req.query.country===country;
}
function createToken() { return crypto.randomBytes(32).toString('hex'); }
function hashToken(token) { return crypto.createHash('sha256').update(String(token)).digest('hex'); }
function matchesToken(token, hash) {
    if (typeof token !== 'string' || token.length !== 64 || typeof hash !== 'string' || hash.length !== 64) return false;
    return crypto.timingSafeEqual(Buffer.from(hashToken(token)),Buffer.from(hash));
}
function sanitizeInterview(row) { const {draft_token_hash, ...safe}=row; return safe; }
function fieldsOf(schema) { return (schema?.sections || []).flatMap(s=>s.fields || []); }
function validateAnswers(data, schema, complete = false) {
    if (!data || typeof data !== 'object' || Array.isArray(data)) return 'Verification answers must be an object.';
    if (Buffer.byteLength(JSON.stringify(data)) > 512*1024) return 'Verification answers exceed the size limit.';
    const fields = fieldsOf(schema); const known = new Set(fields.map(f=>f.key));
    for (const key of Object.keys(data)) if (!known.has(key)) return `Unknown verification field: ${key}`;
    for (const field of fields) {
        const value = data[field.key];
        const blank = value === undefined || value === null || value === '' || (Array.isArray(value) && !value.length);
        if (complete && field.required && (blank || (typeof value === 'string' && !value.trim()))) return `${field.label} is required.`;
        if (blank) continue;
        if (field.type === 'repeat') {
            if (!Array.isArray(value) || value.length > (field.maxItems || 30)) return `${field.label}: invalid number of rows.`;
            for (const row of value) { const error=validateAnswers(row,{sections:[{fields:field.fields}]},false); if(error) return error; }
        } else if (field.type === 'checkbox') {
            if (!Array.isArray(value) || value.some(v=>!field.options.includes(v))) return `${field.label}: invalid selection.`;
            if (field.exclusiveValue && value.includes(field.exclusiveValue) && value.length > 1) return `${field.label}: select None separately.`;
        } else if (field.type === 'radio') {
            if (!field.options.includes(value)) return `${field.label}: invalid selection.`;
        } else if (field.type === 'number') {
            if (!['string','number'].includes(typeof value) || !String(value).trim() || !Number.isFinite(Number(value)) || Number(value) < (field.min ?? 0) || (field.max !== undefined && Number(value)>field.max) || (field.step === 1 && !Number.isInteger(Number(value)))) return `${field.label}: invalid number.`;
        } else if (field.type === 'attachment') {
            return 'Evidence must be uploaded using the attachment endpoint.';
        } else {
            if (typeof value !== 'string' || value.length > 10000) return `${field.label}: invalid text.`;
            if (field.type === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return `${field.label}: invalid email.`;
            if (field.type === 'url') { try { const url=new URL(value); if(!['http:','https:'].includes(url.protocol)) return `${field.label}: use an HTTP(S) link.`; } catch { return `${field.label}: invalid link.`; } }
            if (field.type === 'date' && (!/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(Date.parse(value)) || new Date(value).toISOString().slice(0,10)!==value)) return `${field.label}: invalid date.`;
        }
    }
    if (!complete) return null;
    const present = k => data[k] !== undefined && data[k] !== null && data[k] !== '';
    if (present('typicalMin') && present('typicalMax') && Number(data.typicalMin)>Number(data.typicalMax)) return 'Minimum typical contract value exceeds maximum.';
    if (present('employees') && ['designers','managers','workers'].reduce((s,k)=>s+Number(data[k]||0),0)>Number(data.employees)) return 'Total by role exceeds direct employee count.';
    let directTotal=0;
    for(let i=0;i<18;i++) {
        const direct=`trade_direct_${i}`, available=`trade_available_${i}`;
        if(present(direct)&&present(available)&&Number(data[available])>Number(data[direct])) return 'Available in-house employees exceed direct employees.';
        directTotal+=Number(data[direct]||0);
    }
    if(present('employees') && directTotal>Number(data.employees)) return 'Direct employees by trade exceed total direct employees.';
    const workSelected=fields.some(f=>(f.key.startsWith('specialist_') && (f.type==='checkbox' ? data[f.key]?.length : typeof data[f.key]==='string' && data[f.key].trim())) || (f.key==='specializations' && data[f.key]?.length));
    if(!workSelected) return 'Select at least one contractor work or describe an additional work.';
    if(data.specializations?.includes('Other Specialist Works') && !data.otherSpecialization?.trim()) return 'Describe the scope of other specialist works.';
    return null;
}
function validateEvidence(next, current) {
    if(!Array.isArray(next) || next.length>100) return {error:'Invalid evidence list.'};
    const known=new Map((parseJSON(current)||[]).map(item=>[item.url,item]));
    const selected=[];
    for(const item of next) { if(!item || !known.has(item.url)) return {error:'Evidence must reference previously uploaded files.'}; selected.push(known.get(item.url)); }
    if(new Set(selected.map(x=>x.url)).size!==selected.length) return {error:'Duplicate evidence file.'};
    return {attachments:selected};
}
function validateEvidenceFile(file) {
    if(file.size>15*1024*1024) return 'Each evidence file must be at most 15 MB.';
    const fd=require('fs').openSync(file.path,'r'); const data=Buffer.alloc(12);
    try {require('fs').readSync(fd,data,0,12,0);} finally {require('fs').closeSync(fd);}
    const mime=file.mimetype;
    const valid=(mime==='application/pdf' && data.subarray(0,5).toString()==='%PDF-') || (mime==='image/jpeg' && data[0]===255 && data[1]===216 && data[2]===255) || (mime==='image/png' && data.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))) || (mime==='image/webp' && data.subarray(0,4).toString()==='RIFF' && data.subarray(8,12).toString()==='WEBP');
    const extensions={'application/pdf':['.pdf'],'image/jpeg':['.jpg','.jpeg'],'image/png':['.png'],'image/webp':['.webp']};
    if(!valid || !extensions[mime]?.includes(require('path').extname(file.originalname).toLowerCase())) return 'Evidence must be a valid JPG, PNG, WebP or PDF file with the correct extension.';
    return null;
}
async function ensureVerificationSchema(pool) {
    const [rows] = await pool.execute("SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'company_interviews'");
    const cols = new Set(rows.map(r=>r.COLUMN_NAME));
    for (const [name,type] of Object.entries({verification_data:'JSON NULL',schema_version:'VARCHAR(60) NULL',schema_snapshot:'JSON NULL',draft_token_hash:'CHAR(64) NULL'})) {
        if(!cols.has(name)) await pool.execute(`ALTER TABLE company_interviews ADD COLUMN \`${name}\` ${type}`);
    }
}
async function loadSchema(pool, country, version) {
    // Cached legacy forms omit version: keep their array schema and legacy drafts compatible.
    const id=country==='ae' && version===VERSION ? 7 : 1;
    const [rows]=await pool.execute('SELECT schema_json FROM survey_schema WHERE id = ?', [id]);
    if(rows.length) return parseJSON(rows[0].schema_json);
    if(id===7) { const [legacy]=await pool.execute('SELECT schema_json FROM survey_schema WHERE id = ?', [1]); return legacy.length ? parseJSON(legacy[0].schema_json) : null; }
    return null;
}
module.exports={VERSION,parseJSON,requestCountry,canAccessCountry,createToken,hashToken,matchesToken,sanitizeInterview,validateAnswers,validateEvidence,validateEvidenceFile,ensureVerificationSchema,loadSchema};
