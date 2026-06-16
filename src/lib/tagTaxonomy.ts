/**
 * Tag Taxonomy — single source of truth for all project and company tags.
 * All components import from here.
 */

export const SPACE_TAXONOMY = [
  {
    id: 'villa',
    label: 'Villa',
    tags: ['Villa', 'Luxury Villa', 'Townhouse'],
  },
  {
    id: 'apartment',
    label: 'Apartment',
    tags: ['Apartment', 'Penthouse', 'Studio'],
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

/**
 * Vietnamese DISPLAY labels for space taxonomy (group labels + L2 tags).
 * Stored values stay English — this map is display-only. Loanwords commonly
 * used as-is in Vietnamese (Penthouse, Studio, Showroom, ADU) are intentionally
 * omitted so they fall back to the English term.
 */
const SPACE_TAXONOMY_VI: Record<string, string> = {
  // group labels
  Villa: 'Biệt thự',
  Apartment: 'Căn hộ',
  Commercial: 'Thương mại',
  'Public / Institutional': 'Công cộng',
  'Outdoor / Landscape': 'Sân vườn',
  // L2 tags
  'Luxury Villa': 'Biệt thự cao cấp',
  Townhouse: 'Nhà phố',
  Retail: 'Bán lẻ',
  Office: 'Văn phòng',
  Restaurant: 'Nhà hàng',
  Hotel: 'Khách sạn',
  Hospitality: 'Nghỉ dưỡng',
  Mall: 'Trung tâm thương mại',
  School: 'Trường học',
  Education: 'Giáo dục',
  Healthcare: 'Y tế',
  Hospital: 'Bệnh viện',
  Club: 'Câu lạc bộ',
  Factory: 'Nhà máy',
  'Mixed-Use': 'Phức hợp',
  Garden: 'Vườn',
  Terrace: 'Sân thượng',
  Pool: 'Hồ bơi',
  Fence: 'Hàng rào',
  Driveway: 'Lối xe',
  Landscape: 'Cảnh quan',
};

/** Localize a space taxonomy label/tag for display. Stored value is unchanged. */
export function localizeSpaceTag(value: string, lang: string): string {
  return lang === 'vi' ? (SPACE_TAXONOMY_VI[value] ?? value) : value;
}
