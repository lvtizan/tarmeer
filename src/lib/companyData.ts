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
