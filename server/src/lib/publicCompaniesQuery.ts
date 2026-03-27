export function buildPublicCompaniesListQuery(input: { limit: number; offset: number }) {
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
         google_reviews_count
       FROM uae_companies
       WHERE is_active = 1
         AND logo_url IS NOT NULL
         AND logo_url <> ''
       ORDER BY google_rating DESC, google_reviews_count DESC, name_en ASC
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
         google_reviews_count
       FROM uae_companies
       WHERE slug = ?
         AND is_active = 1
         AND logo_url IS NOT NULL
         AND logo_url <> ''
       LIMIT 1`,
    params: [slug],
  };
}
