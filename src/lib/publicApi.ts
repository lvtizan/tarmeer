import { sanitizeAvatarUrl, sanitizeImageUrls } from './imageCleanup';
import { normalizeFoundedYear, summarizeCompanyDescription, type Company, type PortfolioCategories } from './companyData';
import { companies as localCompanies } from '../data/companies';
import { api } from './api';

const API_BASE = import.meta.env.VITE_API_URL || '/api';
const ALLOW_LOCAL_FALLBACK = import.meta.env.DEV;

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
  slug?: string;
  name_en?: string;
  company_name?: string;
  description?: string;
  city?: string;
  address?: string;
  year_established?: string | number;
  website?: string;
  instagram?: string;
  phone?: string;
  email?: string;
  services?: string[] | string;
  specialties?: string[] | string;
  logo_url?: string;
  portfolio_images?: string[] | string;
  project_count?: number;
  display_order?: number;
  home_display_order?: number;
  list_display_order?: number;
  projects?: any[];
  portfolio_categories?: Record<string, { url: string; title: string }[]>;
  is_claimed?: boolean;
  is_signed?: boolean;
  weight_score?: number;
}

function sanitizePortfolioCategories(
  categories: unknown
): Record<string, { url: string; title: string }[]> {
  if (!categories || typeof categories !== 'object' || Array.isArray(categories)) return {};
  const output: Record<string, { url: string; title: string }[]> = {};
  for (const [key, rawItems] of Object.entries(categories as Record<string, unknown>)) {
    if (!Array.isArray(rawItems)) continue;
    const items = rawItems
      .map((item) => {
        if (!item || typeof item !== 'object') return null;
        const rawUrl = (item as any).url;
        const [safeUrl] = sanitizeImageUrls([rawUrl]);
        if (!safeUrl) return null;
        return {
          url: safeUrl,
          title: typeof (item as any).title === 'string' ? (item as any).title : '',
        };
      })
      .filter(Boolean) as { url: string; title: string }[];
    if (items.length) output[key] = items;
  }
  return output;
}

function parseJsonArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((item) => String(item || '')).filter(Boolean);
  }
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed.map((item) => String(item || '')).filter(Boolean) : [];
    } catch {
      return [];
    }
  }
  return [];
}

function parseUnknownStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((item) => String(item || '')).filter(Boolean);
  }
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) return parsed.map((item) => String(item || '')).filter(Boolean);
    } catch {
      // ignore
    }
  }
  return [];
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
    portfolioCategories = sanitizePortfolioCategories(company.portfolio_categories);
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

  // Fallback: profile detail returns projects[]; extract categorized images from projects
  let portfolioCategoriesByProject: PortfolioCategories = {};
  if (projectImages.length === 0 && Array.isArray(company.projects) && company.projects.length > 0) {
    const byStyle: PortfolioCategories = {};
    const byProject: PortfolioCategories = {};
    company.projects.forEach((project: any) => {
      const imgs = sanitizeImageUrls(parseJsonArray(project?.images));
      if (!imgs.length) return;
      const style = String(project?.style || 'Projects');
      const title = String(project?.title || 'Project');
      const items = imgs.map((url: string, idx: number) => ({
        url,
        title: imgs.length > 1 ? `${title} ${idx + 1}` : title,
      }));
      byStyle[style] = [...(byStyle[style] || []), ...items];
      byProject[title] = [...(byProject[title] || []), ...items];
    });

    if (Object.keys(byStyle).length > 0) {
      portfolioCategories = byStyle;
      portfolioCategoriesByProject = byProject;
      projectImages = Object.values(byStyle).flatMap((items) => items.map((item) => item.url));
    }
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
    name: company.name_en || company.company_name || 'Tarmeer Company',
    description,
    shortDescription: summarizeCompanyDescription(description),
    city: company.city || 'UAE',
    address: company.address || 'UAE',
    foundedYear: normalizeFoundedYear(company.year_established),
    website: company.website || '',
    instagram: company.instagram || '',
    phone: company.phone || '',
    email: company.email || '',
    styles: parseUnknownStringArray(company.specialties),
    projectCount: company.project_count || (Array.isArray(company.projects) ? company.projects.length : projectImages.length),
    services: parseUnknownStringArray(company.services),
    featured: false,
    coverImage: sanitizeImageUrls([company.logo_url])[0] || '', // logo for small badge
    projectImages, // flat list from all categories for listing/card display
    portfolioCategories,
    portfolioCategoriesByProject: Object.keys(portfolioCategoriesByProject).length > 0 ? portfolioCategoriesByProject : undefined,
    isClaimed: !!company.is_claimed,
    isSigned: !!company.is_signed,
    weightScore: company.weight_score ?? undefined,
    projects: Array.isArray(company.projects)
      ? company.projects
          .map((p: any) => ({
            title: String(p.title || ''),
            slug: String(p.slug || ''),
            description: String(p.description || ''),
            style: String(p.style || ''),
            location: String(p.location || ''),
            images: sanitizeImageUrls(parseJsonArray(p.images)),
          }))
          .filter((p: { title: string; slug: string; images: string[] }) => p.slug && p.images.length > 0)
      : undefined,
  };
}

export interface PortfolioProject {
  id: number;
  title: string;
  slug?: string;
  description: string;
  style: string;
  location: string;
  year: number | null;
  images: string[];
  tags?: string[];
  companyId: number;
  companyName: string;
  companySlug: string;
  companyLogo: string;
  companyCity: string;
  source: 'registered' | 'directory';
}

export interface PublicProjectDetailData {
  project: {
    id: number;
    title: string;
    slug: string;
    description: string;
    style: string;
    location: string;
    year: number;
    images: string[];
    tags: string[];
  };
  company: {
    id: number;
    name: string;
    slug: string;
    logo: string;
    city: string;
  };
  siblings: Array<{ id: number; title: string; slug: string }>;
}

export async function fetchPublicProjectDetail(companySlug: string, projectSlug: string): Promise<PublicProjectDetailData> {
  return request(`/companies/${companySlug}/projects/${projectSlug}`);
}

export async function fetchPortfolioFeed(page = 1, limit = 30, seed?: number, tag?: string): Promise<{
  projects: PortfolioProject[];
  pagination: { page: number; limit: number; total: number };
}> {
  const seedParam = seed ? `&seed=${seed}` : '';
  const tagParam = tag ? `&tag=${encodeURIComponent(tag)}` : '';
  return request(`/companies/portfolio?page=${page}&limit=${limit}${seedParam}${tagParam}`);
}

export async function fetchPublicCompanies(limit = 50, orderMode: 'home' | 'list' = 'list'): Promise<Company[]> {
  try {
    const [directoryResult, approvedResult] = await Promise.all([
      request<{ companies: PublicCompanyRecord[] }>(`/companies?limit=${limit}&order=${orderMode}`).catch(() => ({ companies: [] as PublicCompanyRecord[] })),
      request<{ companies: PublicCompanyRecord[] }>(`/public/companies?limit=${limit}`).catch(() => ({ companies: [] as PublicCompanyRecord[] })),
    ]);

    const directoryRaw = directoryResult.companies || [];
    const approvedRaw = approvedResult.companies || [];

    const directoryCompanies = directoryRaw.map((r, i) => ({ company: toCompany(r), homeOrder: r.home_display_order || 0, listOrder: r.list_display_order || 0, apiIndex: i }));
    const approvedCompanies = approvedRaw.map((r, i) => ({ company: toCompany(r), homeOrder: r.home_display_order || 0, listOrder: r.list_display_order || 0, apiIndex: i }));

    // Merge: deduplicate by name, then sort by display order
    const seenNames = new Set(directoryCompanies.map(c => c.company.name.toLowerCase()));
    const merged = [
      ...directoryCompanies,
      ...approvedCompanies.filter(c => !seenNames.has(c.company.name.toLowerCase())),
    ];

    // Sort: companies with display order > 0 go first (1=first, 2=second...), then the rest keep original order
    const orderKey = orderMode === 'home' ? 'homeOrder' : 'listOrder';
    merged.sort((a, b) => {
      const oa = a[orderKey], ob = b[orderKey];
      // Both have order > 0: smaller number first (1=first)
      if (oa > 0 && ob > 0) return oa - ob;
      // Only one has order: it goes first
      if (oa > 0) return -1;
      if (ob > 0) return 1;
      // Neither has order: keep original position
      return 0;
    });

    if (merged.length > 0) return merged.slice(0, limit).map(m => m.company);
    throw new Error('No company source available');
  } catch (error) {
    if (ALLOW_LOCAL_FALLBACK) {
      console.warn('[publicApi] API unavailable in DEV, using local data:', error instanceof Error ? error.message : error);
      return localCompanies.slice(0, limit);
    }
    throw error instanceof Error ? error : new Error('Failed to load companies.');
  }
}

export async function fetchPublicCompanyDetail(slug: string): Promise<Company> {
  try {
    const directoryResult = await request<{ company: PublicCompanyRecord }>(`/companies/${slug}`);
    return toCompany(directoryResult.company);
  } catch (error) {
    try {
      const approvedResult = await request<{ company: PublicCompanyRecord }>(`/public/companies/${slug}`);
      return toCompany(approvedResult.company);
    } catch {
      if (ALLOW_LOCAL_FALLBACK) {
        const normalizedSlug = String(slug || '').trim().toLowerCase();
        const fallback = localCompanies.find((company) => company.id.toLowerCase() === normalizedSlug);
        if (fallback) {
          console.warn('[publicApi] Company detail API unavailable in DEV, using local data:', normalizedSlug);
          return fallback;
        }
      }
      throw error;
    }
  }
}

export async function fetchCompanyPreviewDetail(profileId: string): Promise<Company> {
  const token = api.getToken();
  if (!token) {
    throw new Error('Login required for preview.');
  }

  const headers: HeadersInit = {
    Authorization: `Bearer ${token}`,
  };

  const [profileRes, projectsRes] = await Promise.all([
    fetch(`${API_BASE}/auth/company/profile`, { headers }),
    fetch(`${API_BASE}/auth/company/projects`, { headers }),
  ]);

  if (!profileRes.ok) {
    throw new Error('Failed to load company profile preview.');
  }

  const profileBody = await profileRes.json();
  const profile = profileBody?.profile || profileBody;
  if (!profile || !profile.id) {
    throw new Error('Company profile not found.');
  }
  if (String(profile.id) !== String(profileId)) {
    throw new Error('Preview is only available for your own company profile.');
  }

  const projectsBody = projectsRes.ok ? await projectsRes.json() : { projects: [] };
  const projects = Array.isArray(projectsBody?.projects) ? projectsBody.projects : [];

  const categories: PortfolioCategories = {};
  const allImages: string[] = [];

  projects.forEach((project: any) => {
    const projectImages = sanitizeImageUrls(parseJsonArray(project.images));
    if (!projectImages.length) return;
    const category = String(project.style || 'Projects');
    const titleBase = String(project.title || 'Project');
    const items = projectImages.map((url: string, idx: number) => ({
      url,
      title: projectImages.length > 1 ? `${titleBase} ${idx + 1}` : titleBase,
    }));
    categories[category] = [...(categories[category] || []), ...items];
    allImages.push(...projectImages);
  });

  const services = parseJsonArray(profile.services);
  const specialties = parseJsonArray(profile.specialties);

  return {
    id: String(profile.id),
    name: String(profile.company_name || 'Company'),
    description: String(profile.description || ''),
    shortDescription: summarizeCompanyDescription(String(profile.description || '')),
    city: String(profile.city || 'UAE'),
    address: String(profile.address || 'UAE'),
    foundedYear: normalizeFoundedYear(profile.establishment_year),
    website: String(profile.website || ''),
    instagram: '',
    phone: String(profile.phone || ''),
    email: '',
    styles: specialties,
    projectCount: projects.length || allImages.length,
    services,
    featured: false,
    coverImage: String(profile.logo_url || ''),
    projectImages: allImages,
    portfolioCategories: categories,
    isClaimed: true,
  };
}

export async function fetchAdminCompanyPreview(profileId: string): Promise<Company> {
  const adminToken = localStorage.getItem('admin_token');
  if (!adminToken) {
    throw new Error('Admin login required for preview.');
  }

  const res = await fetch(`${API_BASE}/admin/roles/companies/${profileId}/full-detail`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });

  if (!res.ok) {
    throw new Error('Failed to load company preview.');
  }

  const { company: profile, projects } = await res.json();

  const categories: PortfolioCategories = {};
  const allImages: string[] = [];

  (projects || []).forEach((project: any) => {
    const projectImages = sanitizeImageUrls(parseJsonArray(project.images));
    if (!projectImages.length) return;
    const category = String(project.style || 'Projects');
    const titleBase = String(project.title || 'Project');
    const items = projectImages.map((url: string, idx: number) => ({
      url,
      title: projectImages.length > 1 ? `${titleBase} ${idx + 1}` : titleBase,
    }));
    categories[category] = [...(categories[category] || []), ...items];
    allImages.push(...projectImages);
  });

  const services = parseJsonArray(profile.services);
  const specialties = parseJsonArray(profile.specialties);

  return {
    id: String(profile.id),
    name: String(profile.company_name || 'Company'),
    description: String(profile.description || ''),
    shortDescription: summarizeCompanyDescription(String(profile.description || '')),
    city: String(profile.city || 'UAE'),
    address: String(profile.address || 'UAE'),
    foundedYear: normalizeFoundedYear(profile.establishment_year),
    website: String(profile.website || ''),
    instagram: '',
    phone: String(profile.phone || ''),
    email: '',
    styles: specialties,
    projectCount: projects?.length || allImages.length,
    services,
    featured: false,
    coverImage: String(profile.logo_url || ''),
    projectImages: allImages,
    portfolioCategories: categories,
    isClaimed: true,
  };
}
