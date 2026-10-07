'use strict';
const crypto = require('crypto');
const {inputPolicyError}=require('./verificationInputPolicy');
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
// Business bounds are part of the DB schema contract. Enrich pre-policy V7
// snapshots without modifying their labels, choices, custom fields or answers.
const canonicalFields = new Map(require('./verificationV7Schema.json').sections.flatMap(section=>section.fields).map(field=>[field.key,field]));
function withValidationPolicies(schema) {
    if(!schema || Array.isArray(schema) || schema.version!==VERSION || schema.country!=='ae') return schema;
    return {...schema,sections:(schema.sections||[]).map(section=>({...section,fields:(section.fields||[]).map(field=> {
        const canonical=canonicalFields.get(field.key);
        if(!canonical || canonical.type!==field.type) return field;
        const policies={};
        if(canonical.datePolicy) policies.datePolicy={...canonical.datePolicy};
        if(canonical.yearPolicy) policies.yearPolicy={...canonical.yearPolicy};
        if(canonical.inputPolicy) policies.inputPolicy={...canonical.inputPolicy};
        if(['amount','area'].includes(canonical.inputPolicy?.kind)) policies.step=canonical.step;
        if(canonical.fields && field.fields) policies.fields=field.fields.map(child=> {
            const source=canonical.fields.find(candidate=>candidate.key===child.key && candidate.type===child.type);
            return source?.inputPolicy ? {...child,inputPolicy:{...source.inputPolicy}} : child;
        });
        return Object.keys(policies).length ? {...field,...policies} : field;
    })}))};
}
function withDatePolicies(schema) {return withValidationPolicies(schema);}
function leapYear(year) {return year%4===0 && (year%100!==0 || year%400===0);}
function daysInMonth(year,month) {return [31,leapYear(year)?29:28,31,30,31,30,31,31,30,31,30,31][month-1];}
function calendarDate(value) {
    if(typeof value!=='string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const [year,month,day]=value.split('-').map(Number);
    return year>=1 && month>=1 && month<=12 && day>=1 && day<=daysInMonth(year,month);
}
function dateParts(now,timeZone) {
    const parts=new Intl.DateTimeFormat('en-CA',{timeZone,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(now);
    const get=name=>Number(parts.find(part=>part.type===name).value);
    return {year:get('year'),month:get('month'),day:get('day')};
}
function dateBounds(policy,now=new Date()) {
    const today=dateParts(now,policy.timeZone||'Asia/Dubai');
    const year=today.year+policy.maxYearsFromToday;
    const day=Math.min(today.day,daysInMonth(year,today.month));
    const iso=(y,m,d)=>`${String(y).padStart(4,'0')}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    return {min:iso(policy.minYear,1,1),max:iso(year,today.month,day)};
}
function sanitizeInterview(row) {
    const {draft_token_hash,...safe}=row;
    if(row.schema_version===VERSION && row.schema_snapshot) safe.schema_snapshot=withDatePolicies(parseJSON(row.schema_snapshot));
    return safe;
}
function fieldsOf(schema) { return (schema?.sections || []).flatMap(s=>s.fields || []); }
function validateAnswersDetailed(data, schema, complete = false, now = new Date()) {
    schema=withDatePolicies(schema);
    const schemaKeys=new Set(fieldsOf(schema).map(field=>field.key));
    const failure=(error,fieldKey)=>({error,...(schemaKeys.has(fieldKey)?{field_key:fieldKey}:{})});
    if (!data || typeof data !== 'object' || Array.isArray(data)) return failure('Verification answers must be an object.');
    if (Buffer.byteLength(JSON.stringify(data)) > 512*1024) return failure('Verification answers exceed the size limit.');
    const fields = fieldsOf(schema); const known = new Set(fields.map(f=>f.key));
    for (const key of Object.keys(data)) if (!known.has(key)) return failure(`Unknown verification field: ${key}`,key);
    for (const field of fields) {
        const value = data[field.key];
        const blank = value === undefined || value === null || (typeof value === 'string' && !value.trim()) || (Array.isArray(value) && !value.length);
        if (complete && field.required && (blank || (typeof value === 'string' && !value.trim()))) return failure(`${field.label} is required.`,field.key);
        if (blank) continue;
        const policyError=inputPolicyError(value,field.inputPolicy);
        if(policyError) return failure(`${field.label}: ${policyError}`,field.key);
        if (field.type === 'repeat') {
            if (!Array.isArray(value) || value.length > (field.maxItems || 30)) return failure(`${field.label}: invalid number of rows.`,field.key);
            for (const row of value) { const error=validateAnswersDetailed(row,{sections:[{fields:field.fields}]},false,now); if(error) return {...error,field_key:field.key}; }
        } else if (field.type === 'checkbox') {
            if (!Array.isArray(value) || new Set(value).size!==value.length || value.some(v=>!field.options.includes(v))) return failure(`${field.label}: invalid selection.`,field.key);
            if (field.exclusiveValue && value.includes(field.exclusiveValue) && value.length > 1) return failure(`${field.label}: select None separately.`,field.key);
        } else if (field.type === 'radio') {
            if (!field.options.includes(value)) return failure(`${field.label}: invalid selection.`,field.key);
        } else if (field.type === 'number') {
            if (!['string','number'].includes(typeof value) || !String(value).trim() || !Number.isFinite(Number(value)) || Number(value) < (field.min ?? 0) || (field.max !== undefined && Number(value)>field.max) || (field.step === 1 && !Number.isInteger(Number(value)))) return failure(`${field.label}: invalid number.`,field.key);
            if(field.yearPolicy) {
                const max=field.yearPolicy.maxCurrentYear ? dateParts(now,field.yearPolicy.timeZone||'Asia/Dubai').year : field.max;
                if(!/^\d{4}$/.test(String(value)) || !Number.isInteger(Number(value)) || Number(value)<field.yearPolicy.min || (max!==undefined && Number(value)>max)) return failure(`${field.label}: enter a year between ${field.yearPolicy.min} and ${max}.`,field.key);
            }
        } else if (field.type === 'attachment') {
            return failure('Evidence must be uploaded using the attachment endpoint.',field.key);
        } else {
            if (typeof value !== 'string' || Array.from(value).length > 10000) return failure(`${field.label}: invalid text.`,field.key);
            if (field.type === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return failure(`${field.label}: invalid email.`,field.key);
            if (field.type === 'url') { try { const url=new URL(value); if(!['http:','https:'].includes(url.protocol)) return failure(`${field.label}: use an HTTP(S) link.`,field.key); } catch { return failure(`${field.label}: invalid link.`,field.key); } }
            if(field.type==='date') {
                if(!calendarDate(value)) return failure(`${field.label}: enter a valid calendar date (YYYY-MM-DD).`,field.key);
                if(field.datePolicy) {
                    const bounds=dateBounds(field.datePolicy,now);
                    if(value<bounds.min || value>bounds.max) return failure(`${field.label}: choose a date between ${bounds.min} and ${bounds.max}.`,field.key);
                }
            }
        }
    }
    if (!complete) return null;
    const present = k => data[k] !== undefined && data[k] !== null && data[k] !== '';
    if (present('typicalMin') && present('typicalMax') && Number(data.typicalMin)>Number(data.typicalMax)) return failure('Minimum typical contract value exceeds maximum.','typicalMin');
    if (present('employees') && ['designers','managers','workers'].reduce((s,k)=>s+Number(data[k]||0),0)>Number(data.employees)) return failure('Total by role exceeds direct employee count.','employees');
    let directTotal=0;
    for(let i=0;i<18;i++) {
        const direct=`trade_direct_${i}`, available=`trade_available_${i}`;
        if(present(direct)&&present(available)&&Number(data[available])>Number(data[direct])) return failure('Available in-house employees exceed direct employees.',available);
        directTotal+=Number(data[direct]||0);
    }
    if(present('employees') && directTotal>Number(data.employees)) return failure('Direct employees by trade exceed total direct employees.','employees');
    const workSelected=fields.some(f=>(f.key.startsWith('specialist_') && (f.type==='checkbox' ? data[f.key]?.length : typeof data[f.key]==='string' && data[f.key].trim())) || (f.key==='specializations' && data[f.key]?.length));
    if(!workSelected) return failure('Select at least one contractor work or describe an additional work.',fields.find(field=>field.type==='checkbox' && field.key.startsWith('specialist_'))?.key || 'specializations');
    if(data.specializations?.includes('Other Specialist Works') && !data.otherSpecialization?.trim()) return failure('Describe the scope of other specialist works.','otherSpecialization');
    return null;
}
function validateAnswers(data,schema,complete=false,now=new Date()) {return validateAnswersDetailed(data,schema,complete,now)?.error || null;}
function validateEvidence(next, current) {
    if(!Array.isArray(next) || next.length>100) return {error:'Invalid evidence list.'};
    const known=new Map((parseJSON(current)||[]).map(item=>[item.url,item]));
    const selected=[];
    for(const item of next) { if(!item || !known.has(item.url)) return {error:'Evidence must reference previously uploaded files.'}; selected.push(known.get(item.url)); }
    if(new Set(selected.map(x=>x.url)).size!==selected.length) return {error:'Duplicate evidence file.'};
    return {attachments:selected};
}
// Called only after the interview row is locked. Filtering the current list,
// rather than replacing a client snapshot, preserves concurrent upload appends.
function removeEvidence(urls,current) {
    if(!Array.isArray(urls) || urls.length>100 || urls.some(url=>typeof url!=='string' || !url || url.length>2000) || new Set(urls).size!==urls.length) return {error:'Invalid evidence removal list.'};
    const removed=new Set(urls);
    return {attachments:(parseJSON(current)||[]).filter(item=>!removed.has(item.url))};
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
    if(rows.length) return withDatePolicies(parseJSON(rows[0].schema_json));
    if(id===7) { const [legacy]=await pool.execute('SELECT schema_json FROM survey_schema WHERE id = ?', [1]); return legacy.length ? parseJSON(legacy[0].schema_json) : null; }
    return null;
}
module.exports={VERSION,parseJSON,withValidationPolicies,withDatePolicies,calendarDate,dateBounds,requestCountry,canAccessCountry,createToken,hashToken,matchesToken,sanitizeInterview,validateAnswers,validateAnswersDetailed,validateEvidence,removeEvidence,validateEvidenceFile,ensureVerificationSchema,loadSchema};
