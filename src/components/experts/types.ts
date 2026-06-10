export interface ExpertListItem {
  id: number;
  slug: string;
  full_name: string;
  avatar_url?: string | null;
  services: string[];
  birth_year?: number | null;
  experience_years?: number | null;
  city?: string | null;
  country?: string;
  is_certified?: boolean | number;
  is_signed?: boolean | number;
  has_phone?: boolean | number;
}

export interface ExpertWorkHistoryItem {
  from?: string;
  to?: string;
  org?: string;
  role?: string;
}

export interface ExpertDetail extends ExpertListItem {
  bio?: string | null;
  skills: string[];
  work_history: ExpertWorkHistoryItem[];
  certificates: string[];
  license_verified?: boolean | number;
}

export interface ExpertsPagination {
  page: number;
  limit: number;
  total: number;
}
