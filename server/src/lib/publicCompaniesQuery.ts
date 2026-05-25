/** L1 space id → L2 specialty tags (mirrors src/lib/tagTaxonomy.ts SPACE_TAXONOMY) */
const SPACE_L2_MAP: Record<string, string[]> = {
  villa: ['Villa', 'Luxury Villa', 'Townhouse'],
  apartment: ['Apartment', 'Penthouse', 'Studio'],
  commercial: ['Retail', 'Office', 'Restaurant', 'Hotel', 'Hospitality', 'Showroom', 'Mall'],
  public: ['School', 'Education', 'Healthcare', 'Hospital', 'Club', 'Factory', 'ADU', 'Mixed-Use'],
  outdoor: ['Garden', 'Terrace', 'Pool', 'Fence', 'Driveway', 'Landscape'],
};

export function buildPublicCompaniesListQuery(input: { limit: number; offset: number; orderMode: 'home' | 'list'; spaceTags?: string[] }) {
  const primary = input.orderMode === 'home' ? 'home_display_order' : 'list_display_order';
  const orderBy = `weight_score DESC, CASE WHEN COALESCE(${primary}, 0) > 0 THEN 0 ELSE 1 END, ${primary} ASC, google_rating DESC, google_reviews_count DESC, name_en ASC`;

  const spaceWhere = input.spaceTags && input.spaceTags.length > 0
    ? `AND JSON_OVERLAPS(COALESCE(specialties, '[]'), ?)`
    : '';
  const params: any[] = [];
  if (input.spaceTags && input.spaceTags.length > 0) {
    params.push(JSON.stringify(input.spaceTags));
  }

  return {
    sql: `SELECT
         id,
         slug,
         name_en,
         description,
         city,
         address,
         year_established,
         website,
         instagram,
         phone,
         email,
         services,
         specialties,
         logo_url,
         portfolio_images,
         portfolio_images AS portfolio_categories,
         home_display_order,
         list_display_order,
         google_reviews_count,
         owner_user_id,
         is_signed
       FROM uae_companies
       WHERE is_active = 1 AND is_published = 1 ${spaceWhere}
       ORDER BY ${orderBy}
       LIMIT ${input.limit} OFFSET ${input.offset}`,
    params,
  };
}

export { SPACE_L2_MAP };

export function buildPublicCompanyDetailQuery(slug: string) {
  return {
    sql: `SELECT
         uae_companies.id,
         uae_companies.slug,
         uae_companies.name_en,
         uae_companies.description,
         uae_companies.city,
         uae_companies.address,
         uae_companies.year_established,
         uae_companies.website,
         uae_companies.instagram,
         uae_companies.phone,
         uae_companies.email,
         uae_companies.services,
         uae_companies.specialties,
         uae_companies.logo_url,
         uae_companies.portfolio_images,
         uae_companies.portfolio_images AS portfolio_categories,
         uae_companies.google_reviews_count,
         uae_companies.owner_user_id,
         uae_companies.is_signed,
         cp.id AS company_profile_id
       FROM uae_companies
       LEFT JOIN company_profiles cp
         ON cp.user_id = uae_companies.owner_user_id
         AND cp.deleted_at IS NULL
       WHERE uae_companies.slug = ?
         AND uae_companies.is_active = 1
         AND uae_companies.is_published = 1
       LIMIT 1`,
    params: [slug],
  };
}
