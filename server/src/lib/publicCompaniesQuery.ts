export function buildPublicCompaniesListQuery(input: { limit: number; offset: number; orderMode: 'home' | 'list' }) {
  const primary = input.orderMode === 'home' ? 'home_display_order' : 'list_display_order';
  const orderBy = `CASE WHEN COALESCE(${primary}, 0) > 0 THEN 0 ELSE 1 END, ${primary} ASC, google_rating DESC, google_reviews_count DESC, name_en ASC`;
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
         owner_user_id
       FROM uae_companies
       WHERE is_active = 1
       ORDER BY ${orderBy}
       LIMIT ${input.limit} OFFSET ${input.offset}`,
    params: [],
  };
}

export function buildPublicCompanyDetailQuery(slug: string) {
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
         google_reviews_count,
         owner_user_id
       FROM uae_companies
       WHERE slug = ?
         AND is_active = 1
       LIMIT 1`,
    params: [slug],
  };
}
