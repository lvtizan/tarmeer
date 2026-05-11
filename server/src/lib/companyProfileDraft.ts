import { getValidTypes } from './enumCache';

const VALID_SPECIALTIES = [
  // Legacy values (backward compat)
  'Villa', 'Apartment', 'Commercial', 'Hospitality', 'Retail', 'Office',
  'Education', 'Healthcare', 'F&B', 'Mixed-Use',
  // New space type values
  'Public Institutional', 'Outdoor Landscape',
];

export type CompanyProfilePayload = {
  company_name: string;
  description: string;
  contact_person: string;
  phone: string;
  website: string | null;
  city: string;
  address: string;
  logo_url: string | null;
  services: string[];
  company_type: string;
  company_types: string[];
  trade_license_number: string | null;
  establishment_year: number | null;
  specialties: string[];
  emirates_served: string[];
};

function normalizeString(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeStringOrNull(value: unknown) {
  const normalized = normalizeString(value);
  return normalized || null;
}

function normalizeStringArray(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => normalizeString(item))
    .filter(Boolean);
}

function normalizeEstablishmentYear(value: unknown) {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return null;
  }

  return Math.trunc(parsed);
}

export function normalizeCompanyProfilePayload(body: any): CompanyProfilePayload {
  const company_types = normalizeStringArray(body?.company_types);
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

export async function validateCompanyProfilePayload(payload: CompanyProfilePayload): Promise<string | null> {
  if (!payload.company_name) {
    return 'Company name is required to save your profile.';
  }

  // Validate company_type only if provided (company_types multiselect may override it)
  if (payload.company_type) {
    const validTypes = await getValidTypes();
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
