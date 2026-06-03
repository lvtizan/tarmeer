"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizeCompanyProfilePayload = normalizeCompanyProfilePayload;
exports.validateCompanyProfilePayload = validateCompanyProfilePayload;
const enumCache_1 = require("./enumCache");
const VALID_SPECIALTIES = [
    // Legacy values (backward compat)
    'Villa', 'Apartment', 'Commercial', 'Hospitality', 'Retail', 'Office',
    'Education', 'Healthcare', 'F&B', 'Mixed-Use',
    // New space type values
    'Public Institutional', 'Outdoor Landscape',
];
function normalizeString(value) {
    return typeof value === 'string' ? value.trim() : '';
}
function normalizeStringOrNull(value) {
    const normalized = normalizeString(value);
    return normalized || null;
}
function normalizeStringArray(value) {
    if (!Array.isArray(value)) {
        return [];
    }
    return value
        .map((item) => normalizeString(item))
        .filter(Boolean);
}
function normalizeEstablishmentYear(value) {
    if (value === null || value === undefined || value === '') {
        return null;
    }
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) {
        return null;
    }
    return Math.trunc(parsed);
}
function normalizeCompanyProfilePayload(body) {
    // Accept company_types (preferred) OR company_type as array (signup form backward compat)
    const company_types = normalizeStringArray(Array.isArray(body?.company_types) && body.company_types.length > 0
        ? body.company_types
        : Array.isArray(body?.company_type)
            ? body.company_type
            : []);
    // Derive legacy company_type from company_types[0] if provided
    const company_type = company_types.length > 0
        ? company_types[0]
        : normalizeString(body?.company_type);
    return {
        company_name: normalizeString(body?.company_name),
        description: normalizeString(body?.description),
        contact_person: normalizeString(body?.contact_person),
        phone: normalizeString(body?.phone),
        website: normalizeStringOrNull(body?.website),
        city: normalizeString(body?.city),
        address: normalizeString(body?.address),
        logo_url: normalizeStringOrNull(body?.logo_url),
        services: normalizeStringArray(body?.services),
        company_type,
        company_types,
        trade_license_number: normalizeStringOrNull(body?.trade_license_number),
        establishment_year: normalizeEstablishmentYear(body?.establishment_year),
        specialties: normalizeStringArray(body?.specialties),
        emirates_served: normalizeStringArray(body?.emirates_served),
    };
}
async function validateCompanyProfilePayload(payload) {
    if (!payload.company_name) {
        return 'Company name is required to save your profile.';
    }
    // Validate company_type only if provided (company_types multiselect may override it)
    if (payload.company_type) {
        const validTypes = await (0, enumCache_1.getValidTypes)();
        if (!validTypes.includes(payload.company_type)) {
            return `Company type must be one of: ${validTypes.join(', ')}`;
        }
    }
    // Services validation: accept any non-empty strings (new 9-category system has more values)
    // Specialties validation: accept known space type values (expanded list)
    const invalidSpecialties = payload.specialties.filter((specialty) => !VALID_SPECIALTIES.includes(specialty));
    if (invalidSpecialties.length > 0) {
        return `Invalid specialties: ${invalidSpecialties.join(', ')}`;
    }
    return null;
}
