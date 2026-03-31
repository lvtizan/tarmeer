import { sanitizeAvatarUrl, sanitizeImageUrls } from './imageCleanup';
import { normalizeFoundedYear, summarizeCompanyDescription, type Company, type PortfolioCategories } from './companyData';
import { companies as localCompanies } from '../data/companies';

const API_BASE = import.meta.env.VITE_API_URL || '/api';

export interface PublicDesignerCardData {
  id: string;
  slug: string;
  name: string;
  firstName: string;
  location: string;
  style: string;
  bioShort: string;
  bioLong?: string;
  avatar: string;
  projectImages: string[];
  projectCount: number;
  expertise: string[];
  title?: string;
}

export interface PublicProjectData {
  id: string;
  title: string;
  coverImage: string;
  images: string[];
  year?: number | string;
  location?: string;
  address: string;
  cost: string;
  description: string;
  tags?: string[];
}

export interface PublicDesignerDetailData extends PublicDesignerCardData {
  projects: PublicProjectData[];
}

interface PublicCompanyRecord {
  id: string | number;
  slug: string;
  name_en: string;
  description: string;
  city: string;
  address: string;
  year_established: string;
  website: string;
  instagram: string;
  phone: string;
  email: string;
  services: string[];
  specialties: string[];
  logo_url: string;
  portfolio_images: string[];
  project_count: number;
  portfolio_categories?: Record<string, { url: string; title: string }[]>;
}

async function request<T>(endpoint: string): Promise<T> {
  const response = await fetch(`${API_BASE}${endpoint}`);
  if (!response.ok) {
    let message = 'Request failed';
    try {
      const body = await response.json();
      message = body.error || message;
    } catch {
      message = response.statusText || message;
    }
    throw new Error(message);
  }
  return response.json();
}

function formatDesignerName(fullName: string) {
  const trimmed = (fullName || '').trim();
  if (!trimmed) return { name: 'Tarmeer Designer', firstName: 'Designer' };
  const parts = trimmed.split(/\s+/);
  return {
    name: trimmed,
    firstName: parts[0] || trimmed,
  };
}

function formatLocation(city?: string | null) {
  return city ? `${city}, UAE` : 'UAE';
}

function toCardDesigner(designer: any): PublicDesignerCardData {
  const { name, firstName } = formatDesignerName(designer.full_name);
  const featuredImages = Array.isArray(designer.featured_project_images)
    ? designer.featured_project_images
    : Array.isArray(designer.featured_images)
      ? designer.featured_images
      : [];
  return {
    id: String(designer.id),
    slug: String(designer.id),
    name,
    firstName,
    location: formatLocation(designer.city),
    style: designer.style || designer.title || 'Interior Design',
    bioShort: designer.bio || 'Tarmeer approved designer.',
    bioLong: designer.bio || '',
    avatar: sanitizeAvatarUrl(designer.avatar_url),
    projectImages: sanitizeImageUrls(featuredImages),
    projectCount: designer.project_count || 0,
    expertise: Array.isArray(designer.expertise) ? designer.expertise : [],
    title: designer.title || '',
  };
}

function toProject(project: any, fallbackLocation?: string): PublicProjectData {
  const images = sanitizeImageUrls(Array.isArray(project.images) ? project.images : []);
  return {
    id: String(project.id),
    title: project.title || 'Untitled Project',
    coverImage: images[0] || '',
    images,
    year: project.year,
    location: project.location || fallbackLocation || '',
    address: project.location || fallbackLocation || 'UAE',
    cost: project.cost || 'Contact for budget',
    description: project.description || 'Project details coming soon.',
    tags: Array.isArray(project.tags) ? project.tags : [],
  };
}

export async function fetchPublicDesigners(limit = 50): Promise<PublicDesignerCardData[]> {
  const result = await request<{ designers: any[] }>(`/designers?limit=${limit}`);
  return (result.designers || []).map(toCardDesigner);
}

export async function fetchPublicDesignerDetail(id: string): Promise<PublicDesignerDetailData> {
  const result = await request<{ designer: any; projects: any[] }>(`/designers/${id}`);
  const designer = toCardDesigner(result.designer);
  return {
    ...designer,
    projects: (result.projects || []).map((project) => toProject(project, designer.location)),
  };
}

export async function fetchPublicProject(projectId: string): Promise<PublicProjectData> {
  const result = await request<{ project: any }>(`/projects/${projectId}`);
  return toProject(result.project, result.project?.designer_city ? `${result.project.designer_city}, UAE` : 'UAE');
}

function toCompany(company: PublicCompanyRecord): Company {
  const description = company.description || '';

  // Build portfolioCategories from API data or fall back to flat images
  let portfolioCategories: PortfolioCategories = {};
  let projectImages: string[] = [];

  if (company.portfolio_categories && typeof company.portfolio_categories === 'object' && !Array.isArray(company.portfolio_categories)) {
    portfolioCategories = company.portfolio_categories;
    // Extract flat image list from categories for listing pages, filtering low-quality
    projectImages = Object.values(portfolioCategories)
      .flatMap(items => items.map(item => item.url))
      .filter(url => {
        if (!url) return false;
        const lower = url.toLowerCase();
        // Filter out logos, icons, SVGs, tiny thumbnails
        if (/logo|icon|favicon|brand|badge/i.test(lower)) return false;
        if (/[_-](150x150|100x100|thumb|small|mini)/i.test(lower)) return false;
        if (/placeholder|spacer|blank|pixel/i.test(lower)) return false;
        if (/\.svg(\?|$)/i.test(lower)) return false;
        if (/facebook|twitter|linkedin|youtube|instagram/i.test(lower)) return false;
        if (/\/wp-includes\/|\/plugins\//i.test(lower)) return false;
        return true;
      });
  }

  // Fallback: legacy flat array format
  if (projectImages.length === 0) {
    projectImages = sanitizeImageUrls(Array.isArray(company.portfolio_images) ? company.portfolio_images : []);
    if (projectImages.length > 0 && Object.keys(portfolioCategories).length === 0) {
      portfolioCategories = { Projects: projectImages.map((url) => ({
        url,
        title: decodeURIComponent(url.split('/').pop()?.replace(/\.[^.]+$/, '') || '')
          .replace(/[-_]+/g, ' ')
          .replace(/\b\d{3,}x\d{3,}\b/g, '')
          .replace(/\b(min|scaled|11zon|webp|jpg|png)\b/gi, '')
          .replace(/\s{2,}/g, ' ')
          .trim(),
      })) };
    }
  }

  return {
    id: String(company.slug || company.id),
    name: company.name_en || 'Tarmeer Company',
    description,
    shortDescription: summarizeCompanyDescription(description),
    city: company.city || 'UAE',
    address: company.address || 'UAE',
    foundedYear: normalizeFoundedYear(company.year_established),
    website: company.website || '',
    instagram: company.instagram || '',
    phone: company.phone || '',
    email: company.email || '',
    styles: Array.isArray(company.specialties) ? company.specialties : [],
    projectCount: company.project_count || projectImages.length,
    services: Array.isArray(company.services) ? company.services : [],
    featured: false,
    coverImage: company.logo_url || '', // logo for small badge
    projectImages, // flat list from all categories for listing/card display
    portfolioCategories,
  };
}

export async function fetchPublicCompanies(limit = 50): Promise<Company[]> {
  try {
    const result = await request<{ companies: PublicCompanyRecord[] }>(`/companies?limit=${limit}`);
    return (result.companies || []).map(toCompany);
  } catch (error) {
    console.warn('[publicApi] API unavailable, using local data:', error instanceof Error ? error.message : error);
    // Fallback to local static data
    return localCompanies.slice(0, limit);
  }
}

export async function fetchPublicCompanyDetail(slug: string): Promise<Company> {
  try {
    const result = await request<{ company: PublicCompanyRecord }>(`/companies/${slug}`);
    return toCompany(result.company);
  } catch (error) {
    const normalizedSlug = String(slug || '').trim().toLowerCase();
    const fallback = localCompanies.find((company) => company.id.toLowerCase() === normalizedSlug);
    if (fallback) {
      console.warn('[publicApi] Company detail API unavailable, using local data:', normalizedSlug);
      return fallback;
    }
    throw error;
  }
}
