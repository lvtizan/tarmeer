import pool from '../config/database';

// Hardcoded fallbacks — used if DB tables don't exist yet
const FALLBACK_TYPES = [
  'design_studio', 'renovation_company', 'general_contractor',
  'mep_contractor', 'maintenance_company', 'specialty_trade', 'landscaping', 'furnishing',
  'fitout_contractor', 'glass_aluminium', 'waterproofing', 'smart_home', 'fire_fighting',
  'carpentry_joinery', 'stone_marble', 'steel_fabrication', 'cleaning_services',
  'manpower_supply', 'swimming_pool',
];

const FALLBACK_SERVICES = [
  'Interior Design', 'Architecture', 'Fit-Out', 'Renovation', 'Construction', 'Landscape',
  'Furniture', 'Joinery', 'MEP', 'Project Management', 'Design & Build', 'Turnkey Solutions',
  'Maintenance', 'Glass & Aluminium', 'Painting & Finishing', 'Flooring & Tiling', 'Demolition',
  'Steel & Fabrication', 'Curtains & Blinds', 'Cleaning Services', 'Pools', 'HVAC & Ducting',
  'Fire Fighting', 'Smart Home & Automation', 'Waterproofing', 'Solar Systems',
  'Epoxy & PU Flooring', 'Scaffolding', 'Lighting Installation', 'Stone & Marble Fixing',
  'Gypsum & Partitions', 'Deep Cleaning',
];

let typesCache: string[] | null = null;
let servicesCache: string[] | null = null;

export function invalidateEnumCache() {
  typesCache = null;
  servicesCache = null;
}

export async function getValidTypes(): Promise<string[]> {
  if (typesCache) return typesCache;
  try {
    const [rows] = await pool.execute('SELECT slug FROM company_types ORDER BY sort_order, slug');
    const slugs = (rows as any[]).map((r) => r.slug as string);
    if (slugs.length > 0) {
      typesCache = slugs;
      return typesCache;
    }
  } catch { /* table not yet created */ }
  return FALLBACK_TYPES;
}

export async function getValidServices(): Promise<string[]> {
  if (servicesCache) return servicesCache;
  try {
    const [rows] = await pool.execute('SELECT name FROM company_services ORDER BY sort_order, name');
    const names = (rows as any[]).map((r) => r.name as string);
    if (names.length > 0) {
      servicesCache = names;
      return servicesCache;
    }
  } catch { /* table not yet created */ }
  return FALLBACK_SERVICES;
}
