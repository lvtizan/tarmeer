export interface PortfolioItem {
  url: string;
  title: string;
}

export type PortfolioCategories = Record<string, PortfolioItem[]>;

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
  projects?: Array<{ title: string; slug: string; description: string; style: string; location: string; images: string[] }>;
  /** Company type (design_studio, renovation_company, etc.) */
  companyType?: string;
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
  return Number.isFinite(numeric) && numeric > 0 ? numeric : 2000;
}
