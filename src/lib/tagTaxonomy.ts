/**
 * Tag Taxonomy — single source of truth for all project and company tags.
 * All components import from here.
 */

export const SPACE_TAXONOMY = [
  {
    id: 'residential',
    label: 'Residential',
    tags: ['Apartment', 'Villa', 'Luxury Residential', 'Townhouse'],
  },
  {
    id: 'commercial',
    label: 'Commercial',
    tags: ['Retail', 'Office', 'Restaurant', 'Hotel', 'Hospitality', 'Showroom', 'Mall'],
  },
  {
    id: 'public',
    label: 'Public / Institutional',
    tags: ['School', 'Education', 'Healthcare', 'Hospital', 'Club', 'Factory', 'ADU', 'Mixed-Use'],
  },
  {
    id: 'outdoor',
    label: 'Outdoor / Landscape',
    tags: ['Garden', 'Terrace', 'Pool', 'Fence', 'Driveway', 'Landscape'],
  },
] as const;

export const SERVICE_GROUPS = [
  {
    group: 'Design',
    tags: ['Design & Planning', 'General Contracting'],
  },
  {
    group: 'Renovation',
    tags: ['Kitchen & Bath Renovation', 'Wall & Ceiling Renovation', 'Balcony & Terrace'],
  },
  {
    group: 'Finishes',
    tags: ['Flooring & Carpet', 'Tile Installation', 'Painting & Wall Finishes', 'Stone & Countertops', 'Doors & Windows'],
  },
  {
    group: 'Joinery & Furniture',
    tags: ['Joinery & Custom Cabinetry', 'Stairs & Railings'],
  },
  {
    group: 'Systems',
    tags: ['Plumbing & Electrical', 'HVAC & Fresh Air', 'Waterproofing', 'Water Purification', 'Smart Home'],
  },
  {
    group: 'Outdoor',
    tags: ['Pools & Water Features', 'Sunroom & Canopy', 'Garden & Landscaping'],
  },
] as const;

export const ALL_SPACE_TAGS: string[] = SPACE_TAXONOMY.flatMap(g => [...g.tags]);
export const ALL_SERVICES: string[] = SERVICE_GROUPS.flatMap(g => [...g.tags]);

/** Returns the L1 category id for a given L2 space tag, or null if not found. */
export function getL1ForTag(tag: string): string | null {
  const group = SPACE_TAXONOMY.find(g => (g.tags as readonly string[]).includes(tag));
  return group ? group.id : null;
}
