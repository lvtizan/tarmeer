"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.verifyCrmRequest = verifyCrmRequest;
exports.provision = provision;
exports.passwordSync = passwordSync;
exports.emailSync = emailSync;
exports.partnerSync = partnerSync;
exports.ssoIssue = ssoIssue;
/**
 * crmIntegrationService.ts
 * Mall→CRM integration: HMAC signing, API calls, retry logic.
 * Also exports verifiers for CRM→Mall reverse direction.
 */
const crypto_1 = __importDefault(require("crypto"));
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const database_1 = __importDefault(require("../config/database"));
const SECRET = process.env.MALL_INTEGRATION_SECRET || '';
const CRM_BASE = (process.env.CRM_BASE_URL || 'https://crm.tarmeer.com').replace(/\/+$/, '');
const TIMEOUT_MS = 10000;
// ── HMAC helpers ──────────────────────────────────────────────────────────────
function signMallRequest(timestamp, rawBody) {
    return crypto_1.default
        .createHmac('sha256', SECRET)
        .update(`${timestamp}\n${rawBody}`)
        .digest('hex');
}
/** Verify CRM→Mall direction: X-Crm-Timestamp + X-Crm-Signature */
function verifyCrmRequest(timestamp, rawBody, sig) {
    const drift = Math.abs(Date.now() / 1000 - Number(timestamp));
    if (drift > 300)
        return false;
    const expected = signMallRequest(timestamp, rawBody);
    const a = Buffer.from(expected, 'hex');
    const b = Buffer.from(sig.length === expected.length ? sig : '', 'hex');
    if (a.length !== b.length)
        return false;
    return crypto_1.default.timingSafeEqual(a, b);
}
// ── HTTP helper ───────────────────────────────────────────────────────────────
async function crmPost(path, body) {
    const rawBody = JSON.stringify(body);
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const sig = signMallRequest(timestamp, rawBody);
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
    try {
        const res = await fetch(`${CRM_BASE}${path}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Mall-Timestamp': timestamp,
                'X-Mall-Signature': sig,
            },
            body: rawBody,
            signal: ctrl.signal,
        });
        clearTimeout(timer);
        if (!res.ok) {
            const text = await res.text().catch(() => '');
            throw new Error(`CRM ${path} → ${res.status}: ${text}`);
        }
        return await res.json();
    }
    catch (err) {
        clearTimeout(timer);
        throw err;
    }
}
// ── Retry wrapper ─────────────────────────────────────────────────────────────
async function withRetry(fn, maxAttempts = 5) {
    const delays = [1000, 2000, 4000, 8000, 16000];
    let lastErr;
    for (let i = 0; i < maxAttempts; i++) {
        try {
            return await fn();
        }
        catch (err) {
            lastErr = err;
            if (i < maxAttempts - 1) {
                await new Promise(r => setTimeout(r, delays[i] ?? 16000));
            }
        }
    }
    throw lastErr;
}
// ── DB helpers ────────────────────────────────────────────────────────────────
async function getCompanyForCRM(companyId) {
    const [rows] = await database_1.default.execute(`SELECT cp.id, cp.company_name, cp.description, cp.contact_person,
            cp.phone, cp.website, cp.city, cp.address, cp.trade_license_number,
            cp.establishment_year, cp.company_type, cp.company_types,
            cp.services, cp.emirates_served, cp.crm_tenant_id,
            u.id AS user_id, u.email, u.password AS password_hash,
            u.full_name, u.phone AS user_phone,
            COALESCE(u.google_id, d.google_id) AS google_id
     FROM company_profiles cp
     JOIN users u ON u.id = cp.user_id
     LEFT JOIN designers d ON d.user_id = u.id AND d.deleted_at IS NULL
     WHERE cp.id = ?`, [companyId]);
    const row = rows[0];
    if (!row)
        throw new Error(`Company ${companyId} not found`);
    return row;
}
function parseJsonSafe(v) {
    if (!v)
        return [];
    if (Array.isArray(v))
        return v;
    try {
        return JSON.parse(v);
    }
    catch {
        return [];
    }
}
// ── Public API ────────────────────────────────────────────────────────────────
/**
 * Provision a company into CRM (synchronous — awaited by admin route).
 * Saves crm_tenant_id + crm_provisioned_at + crm_mall_partner_id on success.
 * Idempotent by mallPartnerId on the CRM side.
 */
/**
 * Normalize phone to E.164.
 * Handles UAE mobile (05x/5x) and landlines (04x/02x/06x/07x),
 * as well as 00971 prefix and already-formatted +971 numbers with spaces.
 */
function normalizePhone(raw) {
    if (!raw) return '';
    const digits = raw.replace(/[\s\-().+]/g, '');
    if (!digits) return '';
    // 00971 international prefix
    if (digits.startsWith('00971')) return '+971' + digits.slice(5);
    // Already has 971 country code: mobile (12 digits) or landline (11 digits)
    if (digits.startsWith('971') && (digits.length === 12 || digits.length === 11)) return '+' + digits;
    // UAE mobile: 05x + 7 digits = 10 digits
    if (digits.startsWith('05') && digits.length === 10) return '+971' + digits.slice(1);
    // UAE mobile without leading zero: 5x + 7 digits = 9 digits
    if (digits.startsWith('5') && digits.length === 9) return '+971' + digits;
    // UAE landline: 0[2-9] + 7 or 8 digits = 9 or 10 digits (04=Dubai, 02=Abu Dhabi, 06=Sharjah, 07=RAK…)
    if (/^0[2-9]/.test(digits) && (digits.length === 9 || digits.length === 10)) return '+971' + digits.slice(1);
    // Already E.164 or explicit + prefix — strip formatting from original
    if (raw.startsWith('+')) return '+' + digits;
    // Unknown format — prepend + to digit string
    return '+' + digits;
}
async function provision(companyId) {
    const row = await getCompanyForCRM(companyId);
    const companyTypes = parseJsonSafe(row.company_types);
    const services = parseJsonSafe(row.services);
    const emiratesServed = parseJsonSafe(row.emirates_served);
    // If neither password_hash nor google_id is set (e.g. manually-created or migrated accounts),
    // generate a temporary random bcrypt hash so CRM can provision the account.
    // The company user will need to use "forgot password" to set a real password.
    let passwordHash = row.password_hash || null;
    const googleId = row.google_id || null;
    if (!passwordHash && !googleId) {
        const tempPassword = crypto_1.default.randomBytes(32).toString('hex');
        passwordHash = await bcryptjs_1.default.hash(tempPassword, 10);
        console.warn(`[CRM] provision: user ${row.user_id} has no password/googleId — using temp hash for CRM account creation`);
    }
    const payload = {
        mallPartnerId: String(row.id),
        partnerName: row.company_name || '',
        adminEmail: (row.email || '').trim().toLowerCase(),
        adminPasswordHash: passwordHash,
        adminGoogleId: googleId,
        adminName: row.full_name || '',
        adminPhone: normalizePhone(row.phone || row.user_phone || ''),
        companyName: row.company_name || '',
        businessType: companyTypes[0] || row.company_type || '',
        city: row.city || '',
        address: row.address || '',
        tradeRegistrationNo: row.trade_license_number || '',
        website: row.website || '',
        description: row.description || '',
        emiratesServed,
        services,
    };
    const resp = await withRetry(() => crmPost('/api/integration/mall/partner/provision', payload));
    // CRM wraps response: { code: 0, data: { tenantId, ... }, message: "..." }
    const data = resp.data ?? resp;
    if (!data.tenantId)
        throw new Error(`CRM provision response missing tenantId. Got: ${JSON.stringify(resp)}`);
    await database_1.default.execute(`UPDATE company_profiles
     SET crm_tenant_id = ?, crm_provisioned_at = NOW(), crm_mall_partner_id = ?
     WHERE id = ?`, [data.tenantId, String(companyId), companyId]);
    return { crm_tenant_id: data.tenantId };
}
/**
 * Async fire-and-forget: sync password hash to CRM after company changes password.
 * Only fires if company has crm_tenant_id.
 */
function passwordSync(userId, newHash) {
    database_1.default.execute('SELECT crm_tenant_id FROM company_profiles WHERE user_id = ?', [userId]).then(([rows]) => {
        const row = rows[0];
        if (!row?.crm_tenant_id)
            return;
        return withRetry(() => crmPost('/api/integration/mall/user/password-sync', {
            tenantId: row.crm_tenant_id,
            passwordHash: newHash,
        }));
    }).catch(err => console.error('[CRM] passwordSync error:', err));
}
/**
 * Async fire-and-forget: sync new email to CRM after company changes email.
 */
function emailSync(userId, newEmail) {
    database_1.default.execute('SELECT crm_tenant_id FROM company_profiles WHERE user_id = ?', [userId]).then(([rows]) => {
        const row = rows[0];
        if (!row?.crm_tenant_id)
            return;
        return withRetry(() => crmPost('/api/integration/mall/user/email-sync', {
            tenantId: row.crm_tenant_id,
            newEmail,
        }));
    }).catch(err => console.error('[CRM] emailSync error:', err));
}
/**
 * Async fire-and-forget: sync company profile to CRM after profile update.
 * Field-absent = no change; null = clear (per PRD MALL-006).
 */
function partnerSync(companyId) {
    database_1.default.execute(`SELECT cp.crm_tenant_id, cp.company_name, cp.description, cp.phone,
            u.phone AS user_phone,
            cp.website, cp.city, cp.address, cp.trade_license_number,
            cp.company_type, cp.company_types, cp.services, cp.emirates_served,
            cp.establishment_year, cp.office_type, cp.one_stop_service,
            cp.has_construction_permit, cp.total_employees, cp.pm_team_size,
            cp.design_team_size, cp.construction_team, cp.owner_nationality,
            cp.main_project_types, cp.min_project_value, cp.max_project_value,
            cp.material_sources, cp.latest_interview_id, cp.last_interviewed_at
     FROM company_profiles cp JOIN users u ON u.id = cp.user_id WHERE cp.id = ?`, [companyId]).then(([rows]) => {
        const row = rows[0];
        if (!row?.crm_tenant_id)
            return;
        const companyTypes = parseJsonSafe(row.company_types);
        const services = parseJsonSafe(row.services);
        const emiratesServed = parseJsonSafe(row.emirates_served);
        const payload = {
            tenantId: row.crm_tenant_id,
            businessName: row.company_name,
            businessType: companyTypes[0] || row.company_type || undefined,
            phone: normalizePhone(row.phone || row.user_phone || ''),
            city: row.city,
            address: row.address,
            tradeRegistrationNo: row.trade_license_number,
            website: row.website,
            description: row.description,
            emiratesServed,
            services,
        };
        // 问卷采集字段（有值才带，避免覆盖 CRM 侧已有数据）
        if (row.establishment_year != null) payload.establishmentYear = row.establishment_year;
        if (row.office_type)              payload.officeType = row.office_type;
        if (row.one_stop_service)         payload.oneStopService = row.one_stop_service;
        if (row.has_construction_permit != null) payload.hasConstructionPermit = !!row.has_construction_permit;
        if (row.total_employees)          payload.totalEmployees = row.total_employees;
        if (row.pm_team_size)             payload.pmTeamSize = row.pm_team_size;
        if (row.design_team_size)         payload.designTeamSize = row.design_team_size;
        if (row.construction_team)        payload.constructionTeam = row.construction_team;
        if (row.owner_nationality)        payload.ownerNationality = parseJsonSafe(row.owner_nationality);
        if (row.main_project_types)       payload.mainProjectTypes = parseJsonSafe(row.main_project_types);
        if (row.min_project_value)        payload.minProjectValue = row.min_project_value;
        if (row.max_project_value)        payload.maxProjectValue = row.max_project_value;
        if (row.material_sources)         payload.materialSources = parseJsonSafe(row.material_sources);
        if (row.latest_interview_id)      payload.latestInterviewId = row.latest_interview_id;
        if (row.last_interviewed_at)      payload.lastInterviewedAt = row.last_interviewed_at;
        return withRetry(() => crmPost('/api/integration/mall/partner/sync', payload));
    }).catch(err => console.error('[CRM] partnerSync error:', err));
}
/**
 * Synchronous: issue SSO token from CRM (Mall→CRM direction).
 * Returns consumeUrl to redirect company user to CRM.
 */
async function ssoIssue(companyId) {
    const [rows] = await database_1.default.execute(`SELECT cp.crm_tenant_id, u.email
     FROM company_profiles cp JOIN users u ON u.id = cp.user_id
     WHERE cp.id = ?`, [companyId]);
    const row = rows[0];
    if (!row?.crm_tenant_id)
        throw new Error('Company not provisioned in CRM');
    const resp = await withRetry(() => crmPost('/api/integration/mall/sso/issue', {
        tenantId: row.crm_tenant_id,
        mallPartnerId: String(companyId),
        adminEmail: (row.email || '').trim().toLowerCase(),
    }), 3);
    // CRM wraps response: { code: 0, data: { consumeUrl, ... } }
    const data = resp.data ?? resp;
    if (!data.consumeUrl)
        throw new Error('CRM SSO issue: missing consumeUrl');
    return { consumeUrl: data.consumeUrl };
}
