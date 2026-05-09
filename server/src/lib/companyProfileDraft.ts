import { getValidTypes, getValidServices } from './enumCache';

const VALID_SPECIALTIES = [
  'Villa', 'Apartment', 'Commercial', 'Hospitality', 'Retail', 'Office',
  'Education', 'Healthcare', 'F&B', 'Mixed-Use',
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
  trade_license_number: string | null;
  establishment_year: number | null;
  specialties: string[];
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
    company_type: normalizeString(body?.company_type),
    trade_license_number: normalizeStringOrNull(body?.trade_license_number),
    establishment_year: normalizeEstablishmentYear(body?.establishment_year),
    specialties: normalizeStringArray(body?.specialties),
  };
}

export async function validateCompanyProfilePayload(payload: CompanyProfilePayload): Promise<string | null> {
  if (!payload.company_name) {
    return 'Company name is required to save your profile.';
  }

  const validTypes = await getValidTypes();
  if (!validTypes.includes(payload.company_type)) {
    return `Company type must be one of: ${validTypes.join(', ')}`;
  }

  const validServices = await getValidServices();
  const invalidServices = payload.services.filter((service) => !validServices.includes(service));
  if (invalidServices.length > 0) {
    return `Invalid services: ${invalidServices.join(', ')}`;
  }

  const invalidSpecialties = payload.specialties.filter((specialty) => !VALID_SPECIALTIES.includes(specialty));
  if (invalidSpecialties.length > 0) {
    return `Invalid specialties: ${invalidSpecialties.join(', ')}`;
  }

  return null;
}
