export interface Designer {
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
}

export interface DesignerProject {
  id: string;
  title: string;
  coverImage: string;
  images: string[];
  year?: number;
  location?: string;
  address: string;
  cost: string;
  description: string;
  /** Tags for filtering on profile (e.g. Kitchen, Full renovation, Luxury) */
  tags?: string[];
}

const projectImagePool = [
  'https://images.unsplash.com/photo-1616486029423-aa4789e82961?w=800&q=85',
  'https://images.unsplash.com/photo-1618221195710-dd6b41faaea6?w=800&q=85',
  'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=800&q=85',
  'https://images.unsplash.com/photo-1600566753190-17f0baa2a6c3?w=800&q=85',
  'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=800&q=85',
  'https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?w=800&q=85',
  'https://images.unsplash.com/photo-1600047509807-ba8f99d2cdde?w=800&q=85',
  'https://images.unsplash.com/photo-1600121848594-d8644e57abab?w=800&q=85',
  'https://images.unsplash.com/photo-1613490493576-7fde63acd811?w=800&q=80',
  'https://images.unsplash.com/photo-1556911220-bff31c812dba?w=800&q=80',
  'https://images.unsplash.com/photo-1600566753086-00f18fb6b3ea?w=800&q=80',
  'https://images.unsplash.com/photo-1600573472592-401b489a3cdc?w=800&q=80',
];

const avatarPool = [
  'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=200&h=200&fit=crop',
  'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&h=200&fit=crop',
  'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200&h=200&fit=crop',
  'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=200&h=200&fit=crop',
  'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=200&h=200&fit=crop',
  'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=200&h=200&fit=crop',
];

const names: [string, string, string][] = [
  ['Ahmed', 'K.', 'Dubai'],
  ['Lena', 'M.', 'Sharjah'],
  ['Omar', 'S.', 'Abu Dhabi'],
  ['Cristina', 'L.', 'Dubai'],
  ['Youssef', 'A.', 'Sharjah'],
  ['Sara', 'H.', 'Abu Dhabi'],
  ['Karim', 'M.', 'Dubai'],
  ['Nadia', 'F.', 'Ajman'],
  ['Hassan', 'R.', 'Dubai'],
  ['Layla', 'K.', 'Sharjah'],
  ['Tariq', 'B.', 'Ras Al Khaimah'],
  ['Maya', 'N.', 'Dubai'],
];

const styles = [
  'Modern, Minimal',
  'Contemporary, Coastal',
  'Luxury, Traditional',
  'Organic Modern, Transitional',
  'Mid-century, Scandinavian',
  'Industrial, Eclectic',
  'Classic, Glam',
  'Bohemian, Warm',
];

const expertisePool = [
  ['Custom Cabinets', 'Whole-house Furnishing', 'Kitchen & Bath', 'Lighting Design'],
  ['Residential Interiors', 'Soft Decoration', 'Color & Materials', 'Space Planning'],
  ['Luxury Fit-out', 'Doors & Windows', 'Flooring', 'Wall Finishes'],
  ['Full-case Renovation', 'Furniture Selection', 'Window Treatments', 'Art & Accessories'],
];

/** Flat list for apply form and tag selection */
export const EXPERTISE_OPTIONS = Array.from(
  new Set(expertisePool.flat())
).sort();

const projectTypes = [
  'Full home renovation including living room, bedrooms, kitchen and bathrooms. Custom joinery and premium finishes throughout.',
  'Door and window replacement with modern aluminium frames and double glazing. Updated entrance and balcony access.',
  'Soft decoration: furniture, lighting, textiles and accessories. No structural changes.',
  'Kitchen and bathroom refurbishment with new cabinetry, tiles and fixtures.',
  'Whole-house interior design and fit-out from concept to handover.',
  'Living and dining area makeover with new flooring, paint and built-in storage.',
];

function pick<T>(arr: T[], i: number): T {
  return arr[i % arr.length];
}

function projectImagesFor(slug: string, baseIndex: number, count: number): string[] {
  const out: string[] = [];
  for (let i = 0; i < count; i++) {
    out.push(pick(projectImagePool, baseIndex + i + slug.length));
  }
  return out;
}

export const designersList: Designer[] = names.map(([first, last, location], i) => ({
  slug: `${first.toLowerCase()}-${last.toLowerCase()}`,
  name: `${first} ${last}.`,
  firstName: first,
  location: `${location}, UAE`,
  style: pick(styles, i),
  bioShort:
    'Specializing in luxury residential and commercial interiors across the UAE. I bring a blend of European refinement and local sensibility to every project.',
  bioLong:
    'With over 8 years of experience, I focus on creating spaces that are both functional and visually striking. From concept to handover, I work closely with clients and Tarmeer’s technical team to deliver premium finishes and seamless execution.',
  avatar: pick(avatarPool, i),
  projectImages: i === 0
    ? ['https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=800&q=85', pick(projectImagePool, 1), pick(projectImagePool, 2)]
    : [pick(projectImagePool, i), pick(projectImagePool, i + 1), pick(projectImagePool, i + 2)],
  projectCount: 5 + (i % 8),
  expertise: pick(expertisePool, i),
}));

const projectCache: Record<string, DesignerProject[]> = {};

export function getDesignerBySlug(slug: string): Designer | undefined {
  return designersList.find((d) => d.slug === slug);
}

export function getDesignerProjects(slug: string): DesignerProject[] {
  if (projectCache[slug]) return projectCache[slug];
  const d = getDesignerBySlug(slug);
  if (!d) return [];
  const projects: DesignerProject[] = [];
  const numProjects = Math.min(6, Math.max(4, d.projectCount));
  const allTags = ['Kitchen', 'Full renovation', 'Luxury', 'Soft decoration', 'Bathroom', 'Living', 'Doors & Windows'];
  for (let i = 0; i < numProjects; i++) {
    const base = i * 3 + slug.length;
    const images = projectImagesFor(slug, base, 2 + (i % 3));
    const typeIndex = i % projectTypes.length;
    projects.push({
      id: `${slug}-project-${i + 1}`,
      title: `Project ${i + 1}`,
      coverImage: images[0],
      images,
      year: 2023 + (i % 3),
      location: d.location,
      address: `${10 + i} Palm Street, ${d.location}`,
      cost: i % 2 === 0 ? '45,000 – 75,000 AED' : '28,000 – 52,000 AED',
      description: pick(projectTypes, typeIndex),
      tags: [pick(allTags, i), pick(allTags, i + 2)].filter((t, idx, arr) => arr.indexOf(t) === idx),
    });
  }
  projectCache[slug] = projects;
  return projects;
}

export function getProject(slug: string, projectId: string): DesignerProject | undefined {
  return getDesignerProjects(slug).find((p) => p.id === projectId);
}
