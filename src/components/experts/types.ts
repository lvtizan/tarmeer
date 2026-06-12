export interface ExpertListItem {
  id: number;
  slug: string;
  full_name: string;
  avatar_url?: string | null;
  cover_image?: string | null;
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

export interface ExpertProjectItem {
  id: number;
  title: string;
  description?: string | null;
  style?: string | null;
  location?: string | null;
  area?: string | null;
  year?: number | null;
  cost?: string | null;
  images: string[];
  tags?: string[];
  slug?: string | null;
}

export interface ExpertDetail extends ExpertListItem {
  bio?: string | null;
  skills: string[];
  work_history: ExpertWorkHistoryItem[];
  certificates: string[];
  license_verified?: boolean | number;
  projects?: ExpertProjectItem[];
}

export interface ExpertsPagination {
  page: number;
  limit: number;
  total: number;
}
