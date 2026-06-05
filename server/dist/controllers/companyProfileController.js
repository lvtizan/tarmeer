"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.upsertProfile = upsertProfile;
exports.getProfile = getProfile;
exports.getCompanyProjects = getCompanyProjects;
exports.getServiceOptions = getServiceOptions;
const database_1 = __importDefault(require("../config/database"));
const analyticsEvents_1 = require("../lib/analyticsEvents");
const notificationService_1 = require("../services/notificationService");
const companyProfileDraft_1 = require("../lib/companyProfileDraft");
const slugify_1 = require("../lib/slugify");
const parseJsonField_1 = require("../lib/parseJsonField");
const activityLogger_1 = require("../lib/activityLogger");
const enumCache_1 = require("../lib/enumCache");
const crmIntegrationService_1 = require("../lib/crmIntegrationService");

// Ensure branch_addresses column exists
(async () => {
  try {
    const [cols] = await database_1.default.execute(
      `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'company_profiles' AND COLUMN_NAME = 'branch_addresses'`
    );
    if (cols.length === 0) {
      await database_1.default.execute(`ALTER TABLE company_profiles ADD COLUMN branch_addresses JSON NULL`);
      console.log('[profile] added branch_addresses column');
    }
  } catch(e) { console.error('[profile] ensureColumn branch_addresses:', e.message); }
})();

/**
 * POST /api/company/profile
 * Create or update company profile
 */
async function upsertProfile(req, res) {
    try {
        const userId = req.user.userId;
        // Only company-role users may create/update a company profile
        if (req.user.role !== 'company' && req.user.active_role !== 'company') {
            return res.status(403).json({ error: 'Only company accounts can create a company profile.' });
        }
        const payload = (0, companyProfileDraft_1.normalizeCompanyProfilePayload)(req.body);
        const validationError = await (0, companyProfileDraft_1.validateCompanyProfilePayload)(payload);
        if (validationError) {
            return res.status(400).json({ error: validationError });
        }
        const servicesJson = JSON.stringify(payload.services);
        const specialtiesJson = JSON.stringify(payload.specialties);
        const companyTypesJson = JSON.stringify(payload.company_types);
        const emiratesServedJson = JSON.stringify(payload.emirates_served);
        const branchAddressesJson = Array.isArray(req.body.branch_addresses)
            ? JSON.stringify(req.body.branch_addresses.slice(0, 10).map(a => String(a).slice(0, 300)).filter(Boolean))
            : null;
        const onboardingStep = typeof req.body.onboarding_step === 'number' ? req.body.onboarding_step : null;
        const signupSource = typeof req.body.signup_source === 'string' ? req.body.signup_source.slice(0, 64) : null;
        // Check if profile exists (fetch old onboarding_step for notification trigger)
        const [existing] = await database_1.default.execute('SELECT id, onboarding_step, signup_source FROM company_profiles WHERE user_id = ?', [userId]);
        const oldStep = existing[0]?.onboarding_step ?? -1;
        const existingSource = existing[0]?.signup_source;
        if (existing.length > 0) {
            // UPDATE: preserve existing slug so public URLs don't break
            await database_1.default.execute(`UPDATE company_profiles SET company_name = ?, description = ?, contact_person = ?, phone = ?, website = ?, city = ?, address = ?, logo_url = ?, services = ?, company_type = ?, company_types = ?, trade_license_number = ?, establishment_year = ?, specialties = ?, emirates_served = ?, branch_addresses = ?, onboarding_step = GREATEST(COALESCE(onboarding_step, 0), ?), signup_source = COALESCE(signup_source, ?) WHERE user_id = ?`, [
                payload.company_name,
                payload.description,
                payload.contact_person,
                payload.phone,
                payload.website,
                payload.city,
                payload.address,
                payload.logo_url,
                servicesJson,
                payload.company_type,
                companyTypesJson,
                payload.trade_license_number,
                payload.establishment_year,
                specialtiesJson,
                emiratesServedJson,
                branchAddressesJson,
                onboardingStep || 0,
                signupSource,
                userId,
            ]);
        }
        else {
            // INSERT: generate slug from user's email prefix, with collision handling
            const [userRows] = await database_1.default.execute('SELECT email FROM users WHERE id = ?', [userId]);
            const userEmail = userRows[0]?.email || '';
            const baseHandle = (0, slugify_1.generateEmailHandle)(userEmail);
            let slug = baseHandle;
            let suffix = 2;
            while (true) {
                const [conflict] = await database_1.default.execute('SELECT id FROM company_profiles WHERE slug = ?', [slug]);
                if (conflict.length === 0)
                    break;
                slug = `${baseHandle}-${suffix++}`;
            }
            await database_1.default.execute(`INSERT INTO company_profiles (user_id, company_name, description, contact_person, phone, website, city, address, logo_url, services, company_type, company_types, trade_license_number, establishment_year, specialties, emirates_served, branch_addresses, slug, status, onboarding_step, signup_source)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)`, [
                userId,
                payload.company_name,
                payload.description,
                payload.contact_person,
                payload.phone,
                payload.website,
                payload.city,
                payload.address,
                payload.logo_url,
                servicesJson,
                payload.company_type,
                companyTypesJson,
                payload.trade_license_number,
                payload.establishment_year,
                specialtiesJson,
                emiratesServedJson,
                branchAddressesJson,
                slug,
                onboardingStep || 0,
                signupSource,
            ]);
        }
        // Sync phone back to users table if not already set (PhoneRequiredModal reads users.phone)
        if (payload.phone) {
            await database_1.default.execute("UPDATE users SET phone = ? WHERE id = ? AND (phone IS NULL OR phone = '')", [payload.phone, userId]);
        }
        // Notify admins when onboarding reaches step 2+ (user has filled all info + uploaded project)
        const newStep = Math.max(onboardingStep || 0, oldStep);
        if (oldStep < 2 && newStep >= 2) {
            const effectiveSource = signupSource || existingSource || undefined;
            setImmediate(() => {
                (0, notificationService_1.notifyCompanyRegistration)({
                    companyName: payload.company_name, contactPerson: payload.contact_person,
                    phone: payload.phone, city: payload.city, companyType: payload.company_type, services: payload.services,
                    signupSource: effectiveSource,
                }).catch(() => { });
            });
        }
        // Push to admin SSE subscribers (map dashboard real-time animation)
        analyticsEvents_1.analyticsEvents.notifyChange('company');
        // Ensure active_role is set
        await database_1.default.execute('UPDATE users SET active_role = ?, onboarding_completed = 1 WHERE id = ?', ['company', userId]);
        const [rows] = await database_1.default.execute('SELECT * FROM company_profiles WHERE user_id = ?', [userId]);
        const profile = rows[0];
        // CRM profile sync (fire-and-forget, only if already provisioned)
        if (profile?.crm_tenant_id)
            (0, crmIntegrationService_1.partnerSync)(profile.id);
        setImmediate(() => {
            (0, activityLogger_1.logActivity)({
                userId, userName: payload.company_name, userRole: 'company',
                action: existing.length > 0 ? 'update' : 'create', targetType: 'company_profile',
                targetName: payload.company_name, description: existing.length > 0 ? `编辑了公司资料「${payload.company_name}」` : `创建了公司资料「${payload.company_name}」`,
                ip: (0, activityLogger_1.getClientIp)(req),
            }).catch(() => { });
        });
        res.json({ profile });
    }
    catch (error) {
        console.error('Upsert company profile error:', error);
        res.status(500).json({ error: 'Failed to save company profile.' });
    }
}
/**
 * GET /api/company/profile
 */
async function getProfile(req, res) {
    try {
        const userId = req.user.userId;
        let [rows] = await database_1.default.execute('SELECT * FROM company_profiles WHERE user_id = ?', [userId]);
        // Auto-create profile from company_leads if user has no profile yet
        if (rows.length === 0) {
            const [userRows] = await database_1.default.execute('SELECT phone, email FROM users WHERE id = ?', [userId]);
            const userPhone = userRows[0]?.phone;
            const userEmail = userRows[0]?.email;
            // Match by phone first, then by email as fallback (covers Google OAuth without phone)
            let lead = null;
            if (userPhone) {
                const [leadRows] = await database_1.default.execute('SELECT contact_name, phone, company_name, company_type, city, year_established FROM company_leads WHERE phone = ? ORDER BY created_at DESC LIMIT 1', [userPhone]);
                lead = leadRows[0];
            }
            if (!lead && userEmail) {
                const [leadRows] = await database_1.default.execute('SELECT contact_name, phone, company_name, company_type, city, year_established FROM company_leads WHERE email = ? ORDER BY created_at DESC LIMIT 1', [userEmail]);
                lead = leadRows[0];
            }
            if (lead) {
                const leadSlug = (0, slugify_1.slugify)(lead.company_name || '');
                await database_1.default.execute(`INSERT INTO company_profiles (user_id, company_name, contact_person, phone, city, address, company_type, establishment_year, slug, status, description, services, specialties, onboarding_step, signup_source)
           VALUES (?, ?, ?, ?, ?, '', ?, ?, ?, 'pending', '', '["Interior Design"]', '[]', 0, 'company-lead-backfill')`, [userId, lead.company_name, lead.contact_name, lead.phone, lead.city || null, lead.company_type || null, lead.year_established || null, leadSlug]);
                await database_1.default.execute("UPDATE users SET active_role = 'company' WHERE id = ?", [userId]);
                [rows] = await database_1.default.execute('SELECT * FROM company_profiles WHERE user_id = ?', [userId]);
                // Lead-backfill creates a real company_profile row → push event
                analyticsEvents_1.analyticsEvents.notifyChange('company');
            }
        }
        if (rows.length === 0) {
            return res.json({ profile: null, projectCount: 0 });
        }
        const profile = rows[0];
        const [countRows] = await database_1.default.execute('SELECT COUNT(*) as cnt FROM projects WHERE company_profile_id = ? AND deleted_at IS NULL', [profile.id]);
        const projectCount = countRows[0]?.cnt || 0;
        res.json({ profile, projectCount });
    }
    catch (error) {
        console.error('Get company profile error:', error);
        res.status(500).json({ error: 'Failed to get company profile.' });
    }
}
/**
 * GET /api/company/projects
 * List projects owned by this company
 */
async function getCompanyProjects(req, res) {
    try {
        const userId = req.user.userId;
        const [companyRows] = await database_1.default.execute('SELECT id FROM company_profiles WHERE user_id = ?', [userId]);
        if (companyRows.length === 0) {
            return res.json({ projects: [] });
        }
        const companyProfileId = companyRows[0].id;
        const [projects] = await database_1.default.execute(`SELECT * FROM projects WHERE company_profile_id = ? ORDER BY created_at DESC`, [companyProfileId]);
        const normalized = projects.map((p) => ({
            ...p,
            images: (0, parseJsonField_1.parseJsonField)(p.images) || [],
            tags: (0, parseJsonField_1.parseJsonField)(p.tags) || [],
        }));
        res.json({ projects: normalized });
    }
    catch (error) {
        console.error('Get company projects error:', error);
        res.status(500).json({ error: 'Failed to get projects.' });
    }
}
/**
 * GET /api/company/services
 * Return available service options
 */
async function getServiceOptions(_req, res) {
    try {
        const services = await (0, enumCache_1.getValidServices)();
        res.json({ services });
    }
    catch {
        res.status(500).json({ error: 'Failed to load services.' });
    }
}
