export interface ServiceCategory {
  name: string;
  subs: string[];
}

export const SERVICE_CATEGORIES: ServiceCategory[] = [
  { name: 'Design & Planning', subs: ['Interior Design', 'Architecture', 'Spatial Planning', 'Project Management'] },
  { name: 'Construction', subs: ['Construction', 'Fit-Out', 'Civil Works'] },
  { name: 'Design & Build', subs: ['Design & Build', 'Turnkey Solutions', 'Full Package'] },
  { name: 'Renovation', subs: ['Full Renovation', 'Kitchen Renovation', 'Bathroom Renovation', 'Partial Renovation'] },
  { name: 'Outdoor & Pools', subs: ['Landscape Design', 'Pool Construction', 'Garden Design', 'Outdoor Lighting'] },
  { name: 'Home Systems', subs: ['MEP', 'Smart Home & Automation', 'HVAC & Ducting', 'Electrical', 'Plumbing'] },
  { name: 'Interiors & Furniture', subs: ['Furniture Supply', 'Custom Joinery', 'Curtains & Blinds', 'Flooring', 'Wallpaper & Finishes'] },
  { name: 'Maintenance', subs: ['General Maintenance', 'Deep Cleaning', 'Handyman Services', 'AC Maintenance'] },
  { name: 'Specialty Works', subs: ['Glass & Aluminium', 'Stone & Marble', 'Steel Works', 'Waterproofing', 'Fire Fighting & Safety'] },
];

export const SPACE_TYPES = ['Villa', 'Apartment', 'Commercial', 'Public Institutional', 'Outdoor Landscape'];

export const MAX_SERVICE_CATEGORIES = 5;

/**
 * 服务名别名映射：标准词 → 公司库里的旧值。
 * 历史上公司用旧服务词（Renovation/Fit-Out/Architecture…），后来筛选/导航换成新标准词，
 * 二者对不上导致按服务筛选大面积查空。此处让标准词同时匹配旧值，零改公司数据即可生效。
 */
export const SERVICE_ALIASES: Record<string, string[]> = {
  'Architecture Design': ['Architecture'],
  'Architecture & Interior Design': ['Architecture', 'Interior Design'],
  'Landscape & Outdoor Design': ['Landscape'],
  'Landscaping & Irrigation': ['Landscape', 'Garden Design'],
  'MEP & Technical Drawings': ['MEP'],
  'General Contracting': ['Construction'],
  'Civil & Structural Works': ['Construction'],
  'Structural Works': ['Construction'],
  'Interior Fit-out Execution': ['Fit-Out'],
  'Commercial Fit-out Execution': ['Fit-Out'],
  'Interior Design & Build': ['Design & Build'],
  'Full Turnkey (Architecture + Interior)': ['Turnkey Solutions', 'Full Package'],
  'Full Renovation': ['Renovation'],
  'Partial Renovation': ['Renovation'],
  'Other Partial Renovation': ['Renovation'],
  'Kitchen Remodeling': ['Kitchen Renovation'],
  'Bathroom Remodeling': ['Bathroom Renovation'],
  'Flooring & Wall': ['Flooring', 'Flooring & Tiling'],
  'Pool & Water Features': ['Pools'],
  'HVAC Upgrade': ['HVAC & Ducting'],
  'Waterproofing & Insulation': ['Waterproofing'],
  'Custom Cabinetry': ['Custom Joinery', 'Furniture'],
  'Rugs & Soft Decor': ['Furniture Sourcing'],
  'Deep Cleaning': ['Cleaning Services'],
};

/** 公司是否提供某服务（含旧值别名）。companyServices 为公司的 services 数组，selected 为标准词。 */
export function companyHasService(companyServices: string[], selected: string): boolean {
  if (companyServices.includes(selected)) return true;
  const aliases = SERVICE_ALIASES[selected];
  return !!aliases && aliases.some((a) => companyServices.includes(a));
}

/**
 * 空间类型 → specialties 旧值映射。跨运行时复刻后端 server/dist/lib/publicCompaniesQuery.js
 * 的 SPACE_L2_MAP；任一侧改动须同步另一侧。
 */
export const SPACE_TYPE_MAP: Record<string, string[]> = {
  villa: ['Villa', 'Luxury Villa', 'Townhouse'],
  apartment: ['Apartment', 'Penthouse', 'Studio'],
  commercial: ['Retail', 'Office', 'Restaurant', 'Hotel', 'Hospitality', 'Showroom', 'Mall', 'Commercial'],
  public: ['School', 'Education', 'Healthcare', 'Hospital', 'Club', 'Factory', 'ADU', 'Mixed-Use'],
  outdoor: ['Garden', 'Terrace', 'Pool', 'Fence', 'Driveway', 'Landscape'],
};

export const SPACE_TYPE_KEYS = ['villa', 'apartment', 'commercial', 'public', 'outdoor'] as const;

export const SPACE_TYPE_LABELS: Record<string, string> = {
  villa: 'Villa',
  apartment: 'Apartment',
  commercial: 'Commercial',
  public: 'Public / Institutional',
  outdoor: 'Outdoor / Landscape',
};

/** 公司 specialties 是否覆盖某空间类型（大小写不敏感 + 别名 + 关键词子串）。 */
export function companyHasSpaceType(specialties: string[], spaceKey: string): boolean {
  const key = spaceKey.toLowerCase();
  const tags = SPACE_TYPE_MAP[key];
  if (!tags) return false;
  const lc = specialties.map((s) => s.toLowerCase());
  return lc.some((sp) =>
    sp.includes(key) || tags.some((t) => {
      const tl = t.toLowerCase();
      return sp === tl || sp.includes(tl);
    })
  );
}

/** Get the parent category name for a given subcategory string */
export function getCategoryForSub(sub: string): string | null {
  for (const cat of SERVICE_CATEGORIES) {
    if (cat.subs.includes(sub)) return cat.name;
  }
  return null;
}

/** Get all unique parent categories active in a list of subcategories */
export function getActiveParents(subs: string[]): string[] {
  const parents = new Set<string>();
  for (const sub of subs) {
    const parent = getCategoryForSub(sub);
    if (parent) parents.add(parent);
  }
  return Array.from(parents);
}
