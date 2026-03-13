import { sanitizeAvatarUrl, sanitizeImageUrls } from './imageCleanup';

const API_BASE = import.meta.env.VITE_API_URL || (
  import.meta.env.PROD
    ? `${window.location.origin}/api`
    : 'http://localhost:3002/api'
);

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
