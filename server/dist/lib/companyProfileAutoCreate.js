"use strict";
/**
 * companyProfileAutoCreate.ts
 *
 * Single server-side path for auto-creating a company_profiles row from
 * carried-over signup data (users.pending_actions) or a matched company_lead.
 *
 * Guarantees that callers can't violate NOT NULL constraints:
 *   - company_type falls back to the column default ('renovation_company')
 *   - country is detected from the phone prefix (+84 → vn, +966 → sa, else ae)
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createCompanyProfileIfMissing = createCompanyProfileIfMissing;
const database_1 = __importDefault(require("../config/database"));
const slugify_1 = require("./slugify");
const analyticsEvents_1 = require("./analyticsEvents");
// Matches the company_profiles.company_type column default
const FALLBACK_COMPANY_TYPE = 'renovation_company';
function detectCountryFromPhone(phone) {
    const p = String(phone || '');
    if (p.startsWith('+84') || p.startsWith('084'))
        return 'vn';
    if (p.startsWith('+966') || p.startsWith('00966'))
        return 'sa';
    return 'ae';
}
/**
 * Create a pending company profile for the user if they don't have one yet.
 * Returns the profile id (existing or newly created), or null if data is unusable.
 */
async function createCompanyProfileIfMissing(userId, data) {
    const [existing] = await database_1.default.execute('SELECT id FROM company_profiles WHERE user_id = ?', [userId]);
    if (existing.length > 0)
        return existing[0].id;
    const companyName = String(data?.company_name || '').trim().slice(0, 200);
    if (!companyName)
        return null;
    const phone = data.phone ? String(data.phone).slice(0, 32) : null;
    const baseSlug = (0, slugify_1.slugify)(companyName) || `company-${userId}`;
    let slug = baseSlug;
    let suffix = 2;
    while (true) {
        const [conflict] = await database_1.default.execute('SELECT id FROM company_profiles WHERE slug = ?', [slug]);
        if (conflict.length === 0)
            break;
        slug = `${baseSlug}-${suffix++}`;
    }
    const services = Array.isArray(data.services) ? data.services.slice(0, 30).map((s) => String(s).slice(0, 100)) : [];
    const year = Number(data.establishment_year);
    await database_1.default.execute(`INSERT INTO company_profiles (user_id, company_name, contact_person, phone, city, address, company_type, establishment_year, slug, status, description, services, specialties, onboarding_step, signup_source, country)
     VALUES (?, ?, ?, ?, ?, '', ?, ?, ?, 'pending', ?, ?, '[]', 0, ?, ?)`, [
        userId,
        companyName,
        data.contact_person ? String(data.contact_person).slice(0, 100) : null,
        phone,
        data.city ? String(data.city).slice(0, 100) : null,
        data.company_type ? String(data.company_type).slice(0, 100) : FALLBACK_COMPANY_TYPE,
        Number.isFinite(year) && year > 1900 ? year : null,
        slug,
        String(data.description || '').slice(0, 2000),
        JSON.stringify(services),
        data.signup_source ? String(data.signup_source).slice(0, 64) : null,
        detectCountryFromPhone(phone),
    ]);
    await database_1.default.execute("UPDATE users SET active_role = 'company' WHERE id = ?", [userId]);
    const [rows] = await database_1.default.execute('SELECT id FROM company_profiles WHERE user_id = ?', [userId]);
    analyticsEvents_1.analyticsEvents.notifyChange('company');
    return rows[0]?.id ?? null;
}
