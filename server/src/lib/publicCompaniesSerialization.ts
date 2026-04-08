import { parseJsonField } from './parseJsonField';
import { sanitizeImageUrls } from './publicImageCleanup';

function toPublicString(value: unknown) {
  return typeof value === 'string' ? value : '';
}

function sanitizeCompanyImage(value: unknown) {
  const url = toPublicString(value).trim();
  if (!url) return '';
  if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:')) return url;
  if (url.startsWith('//')) return `https:${url}`;
  if (url.startsWith('/')) {
    // Hotfix known historical wrong extensions in scraped dataset
    if (url === '/images/uae-companies/portfolio/hba-hirsch-bedner/general/1.png') {
      return '/images/uae-companies/portfolio/hba-hirsch-bedner/general/1.jpg';
    }
    if (url === '/images/uae-companies/portfolio/appello-interiors/interior/1.png') {
      return '/images/uae-companies/portfolio/appello-interiors/interior/1.jpg';
    }
    if (url === '/images/uae-companies/portfolio/appello-interiors/cafe/1.png') {
      return '/images/uae-companies/portfolio/appello-interiors/cafe/1.jpg';
    }
    if (url === '/images/uae-companies/portfolio/eminent-interio/office/1.png') {
      return '/images/uae-companies/portfolio/eminent-interio/office/1.jpg';
    }
    return url;
  }
  if (url.startsWith('./')) return `/${url.replace(/^\.\/+/, '')}`;
  if (url.startsWith('www.')) return `https://${url}`;
  if (url.startsWith('public/images/')) return `/${url.replace(/^public\//, '')}`;
  if (url.startsWith('public/uploads/')) return `/${url.replace(/^public\//, '')}`;
  if (url.startsWith('images/') || url.startsWith('uploads/')) return `/${url}`;
  return '';
}

type PortfolioCategoryItem = { url: string; title: string };
type PortfolioCategories = Record<string, PortfolioCategoryItem[]>;

export function extractPortfolioData(rawField: unknown): {
  portfolio_images: string[];
  portfolio_categories: PortfolioCategories;
} {
  const parsed = parseJsonField(rawField);

  // New format: object with category keys mapping to arrays of { url, title }
  if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
    const categories: PortfolioCategories = {};
    const flatUrls: string[] = [];

    for (const [category, items] of Object.entries(parsed as Record<string, unknown>)) {
      if (!Array.isArray(items)) continue;
      const sanitizedItems: PortfolioCategoryItem[] = [];
      for (const item of items) {
        if (item && typeof item === 'object' && 'url' in item) {
          const url = sanitizeCompanyImage((item as any).url);
          if (url) {
            const title = typeof (item as any).title === 'string' ? (item as any).title : '';
            sanitizedItems.push({ url, title });
            flatUrls.push(url);
          }
        }
      }
      categories[category] = sanitizedItems;
    }

    return { portfolio_images: flatUrls, portfolio_categories: categories };
  }

  // Legacy format: flat array of URL strings
  const flatUrls = sanitizeImageUrls(Array.isArray(parsed) ? parsed : []);
  const categories: PortfolioCategories = {
    Projects: flatUrls.map((url) => ({ url, title: '' })),
  };

  return { portfolio_images: flatUrls, portfolio_categories: categories };
}

export function sanitizePublicCompany(company: any) {
  const { portfolio_images, portfolio_categories } = extractPortfolioData(company.portfolio_images);

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
    portfolio_images,
    portfolio_categories,
    project_count: portfolio_images.length,
    is_claimed: !!(company.owner_user_id),
    is_signed: !!(company.is_signed),
  };
}
