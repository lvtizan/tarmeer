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
