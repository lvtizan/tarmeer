import pool from '../config/database';

interface WeightConfig {
  base_profile_score: number;
  per_project_score: number;
  per_article_score: number;
  signed_score: number;
}

async function getWeightConfig(): Promise<WeightConfig> {
  const defaults: WeightConfig = { base_profile_score: 50, per_project_score: 10, per_article_score: 10, signed_score: 500 };
  try {
    const [rows] = await pool.execute('SELECT config_key, config_value FROM weight_config');
    for (const row of rows as any[]) {
      if (row.config_key in defaults) {
        (defaults as any)[row.config_key] = Number(row.config_value);
      }
    }
  } catch { /* table may not exist yet */ }
  return defaults;
}

export async function calculateAllWeights(): Promise<{ updated: number }> {
  const config = await getWeightConfig();
  let updated = 0;

  // 1. Calculate for company_profiles (registered companies)
  const [profiles] = await pool.execute(
    `SELECT cp.id, cp.company_name, cp.phone, cp.city, cp.description, cp.is_signed,
       (SELECT COUNT(*) FROM projects p WHERE p.company_profile_id = cp.id AND p.deleted_at IS NULL) as project_count,
       (SELECT COUNT(*) FROM articles a WHERE a.company_profile_id = cp.id AND a.status = 'published') as article_count
     FROM company_profiles cp WHERE cp.deleted_at IS NULL`
  );

  for (const company of profiles as any[]) {
    let score = config.base_profile_score;
    score += (Number(company.project_count) || 0) * config.per_project_score;
    score += (Number(company.article_count) || 0) * config.per_article_score;
    if (company.is_signed) score += config.signed_score;

    await pool.execute('UPDATE company_profiles SET weight_score = ? WHERE id = ?', [score, company.id]);
    updated++;
  }

  // 2. Calculate for uae_companies (directory companies).
  // project_count is derived from portfolio_images JSON length (no DB column).
  const [directories] = await pool.execute(
    `SELECT id, name_en, phone, city, description, is_signed,
       COALESCE(
         JSON_LENGTH(CAST(portfolio_images AS JSON)),
         0
       ) as project_count
     FROM uae_companies`
  );

  for (const company of directories as any[]) {
    let score = config.base_profile_score;
    score += (Number(company.project_count) || 0) * config.per_project_score;
    if (company.is_signed) score += config.signed_score;

    await pool.execute('UPDATE uae_companies SET weight_score = ? WHERE id = ?', [score, company.id]);
    updated++;
  }

  // 3. Calculate for supplier_profiles
  const [suppliers] = await pool.execute(
    `SELECT sp.id,
       (SELECT COUNT(*) FROM supplier_products WHERE supplier_profile_id = sp.id) as product_count,
       (SELECT COUNT(*) FROM supplier_catalogs WHERE supplier_profile_id = sp.id) as catalog_count
     FROM supplier_profiles sp WHERE sp.status = 'approved'`
  );

  for (const supplier of suppliers as any[]) {
    let score = config.base_profile_score;
    score += (Number(supplier.product_count) || 0) * config.per_project_score;
    score += (Number(supplier.catalog_count) || 0) * config.per_article_score;

    await pool.execute('UPDATE supplier_profiles SET weight_score = ? WHERE id = ?', [score, supplier.id]);
    updated++;
  }

  console.log(`[Weight] Calculated weights for ${updated} companies/suppliers`);
  return { updated };
}
