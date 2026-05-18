export interface PortfolioItem {
  url: string;
  title: string;
}

export type PortfolioCategories = Record<string, PortfolioItem[]>;

/** Per-project card shown in CompanyProjectsSection. Shared by all detail-page entry paths. */
export interface CompanyProjectCard {
  title: string;
  slug: string;
  description: string;
  style: string;
  location: string;
  images: string[];
}

export interface Company {
  id: string;
  name: string;
  description: string;
  shortDescription: string;
  city: string;
  address: string;
  foundedYear: number;
  website?: string;
  instagram?: string;
  phone?: string;
  email?: string;
  styles: string[];
  projectCount: number;
  services: string[];
  featured: boolean;
  coverImage: string;
  projectImages: string[];
  portfolioCategories: PortfolioCategories;
  /** Same images grouped by project title instead of style */
  portfolioCategoriesByProject?: PortfolioCategories;
  /** true if a real user has claimed and manages this company */
  isClaimed: boolean;
  /** true if the company has signed a contract with Tarmeer */
  isSigned?: boolean;
  /** computed weight score for sorting */
  weightScore?: number;
  /** Project list for project cards (claimed companies only) */
  projects?: CompanyProjectCard[];
  /** Company type (design_studio, renovation_company, etc.) */
  companyType?: string;
  /** Canonical URL slug (used to redirect legacy directory slugs after claiming) */
  slug?: string;
}

export const COMPANY_TYPE_LABELS: Record<string, string> = {
  design_studio: 'Design Studio',
  renovation_company: 'Renovation & Fit-out',
  general_contractor: 'General Contractor',
  mep_contractor: 'MEP Contractor',
  maintenance_company: 'Maintenance Company',
  specialty_trade: 'Specialty Trade',
  landscaping: 'Landscaping & Pools',
  furnishing: 'Furnishing',
  fitout_contractor: 'Fit-Out Contractor',
  glass_aluminium: 'Glass & Aluminium',
  waterproofing: 'Waterproofing',
  smart_home: 'Smart Home & IT',
  fire_fighting: 'Fire Fighting & Safety',
  carpentry_joinery: 'Carpentry & Joinery',
  stone_marble: 'Stone, Marble & Tile',
  steel_fabrication: 'Steel & Metal Works',
  cleaning_services: 'Cleaning Services',
  manpower_supply: 'Manpower Supply',
  swimming_pool: 'Swimming Pool Contractor',
};

export function getCompanyTypeLabel(type?: string): string {
  if (!type) return '';
  return COMPANY_TYPE_LABELS[type] || '';
}

export function summarizeCompanyDescription(description: string): string {
  const trimmed = description.trim();
  if (!trimmed) return 'UAE renovation and interior design company.';
  if (trimmed.length <= 120) return trimmed;
  return `${trimmed.slice(0, 117).trimEnd()}...`;
}

export function normalizeFoundedYear(value: string | number | null | undefined): number {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric >= 1900 && numeric <= 2100 ? numeric : 0;
}
