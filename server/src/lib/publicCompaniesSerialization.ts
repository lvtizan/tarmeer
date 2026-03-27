import { parseJsonField } from './parseJsonField';
import { sanitizeImageUrls } from './publicImageCleanup';

function toPublicString(value: unknown) {
  return typeof value === 'string' ? value : '';
}

function sanitizeCompanyImage(value: unknown) {
  const url = toPublicString(value).trim();
  if (!url) return '';
  return url.startsWith('http://') || url.startsWith('https://') || url.startsWith('/') ? url : '';
}

export function sanitizePublicCompany(company: any) {
  const portfolioImages = sanitizeImageUrls(parseJsonField(company.portfolio_images) || []);

  return {
    id: company.id,
    slug: toPublicString(company.slug),
    name_en: toPublicString(company.name_en),
    description: toPublicString(company.description),
    city: toPublicString(company.city),
    address: toPublicString(company.address),
    year_established: toPublicString(company.year_established),
    website: toPublicString(company.website),
    instagram: toPublicString(company.instagram),
    phone: toPublicString(company.phone),
    email: toPublicString(company.email),
    services: parseJsonField(company.services) || [],
    specialties: parseJsonField(company.specialties) || [],
    logo_url: sanitizeCompanyImage(company.logo_url),
    portfolio_images: portfolioImages,
    project_count: portfolioImages.length,
  };
}
