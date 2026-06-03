"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.calculateAllWeights = calculateAllWeights;
const database_1 = __importDefault(require("../config/database"));
async function getWeightConfig() {
    const defaults = { base_profile_score: 50, per_project_score: 10, per_article_score: 10, signed_score: 500 };
    try {
        const [rows] = await database_1.default.execute('SELECT config_key, config_value FROM weight_config');
        for (const row of rows) {
            if (row.config_key in defaults) {
                defaults[row.config_key] = Number(row.config_value);
            }
        }
    }
    catch { /* table may not exist yet */ }
    return defaults;
}
async function calculateAllWeights() {
    const config = await getWeightConfig();
    let updated = 0;
    // 1. Calculate for company_profiles (registered companies)
    const [profiles] = await database_1.default.execute(`SELECT cp.id, cp.company_name, cp.phone, cp.city, cp.description, cp.is_signed,
       (SELECT COUNT(*) FROM projects p WHERE p.company_profile_id = cp.id AND p.deleted_at IS NULL) as project_count,
       (SELECT COUNT(*) FROM articles a WHERE a.company_profile_id = cp.id AND a.status = 'published') as article_count
     FROM company_profiles cp WHERE cp.deleted_at IS NULL`);
    for (const company of profiles) {
        let score = config.base_profile_score;
        score += (Number(company.project_count) || 0) * config.per_project_score;
        score += (Number(company.article_count) || 0) * config.per_article_score;
        if (company.is_signed)
            score += config.signed_score;
        await database_1.default.execute('UPDATE company_profiles SET weight_score = ? WHERE id = ?', [score, company.id]);
        updated++;
    }
    // 2. Calculate for uae_companies (directory companies).
    // project_count is derived from portfolio_images JSON length (no DB column).
    const [directories] = await database_1.default.execute(`SELECT id, name_en, phone, city, description, is_signed,
       COALESCE(
         JSON_LENGTH(CAST(portfolio_images AS JSON)),
         0
       ) as project_count
     FROM uae_companies`);
    for (const company of directories) {
        let score = config.base_profile_score;
        score += (Number(company.project_count) || 0) * config.per_project_score;
        if (company.is_signed)
            score += config.signed_score;
        await database_1.default.execute('UPDATE uae_companies SET weight_score = ? WHERE id = ?', [score, company.id]);
        updated++;
    }
    // 3. Calculate for supplier_profiles
    const [suppliers] = await database_1.default.execute(`SELECT sp.id,
       (SELECT COUNT(*) FROM supplier_products WHERE supplier_profile_id = sp.id) as product_count,
       (SELECT COUNT(*) FROM supplier_catalogs WHERE supplier_profile_id = sp.id) as catalog_count
     FROM supplier_profiles sp WHERE sp.status = 'approved'`);
    for (const supplier of suppliers) {
        let score = config.base_profile_score;
        score += (Number(supplier.product_count) || 0) * config.per_project_score;
        score += (Number(supplier.catalog_count) || 0) * config.per_article_score;
        await database_1.default.execute('UPDATE supplier_profiles SET weight_score = ? WHERE id = ?', [score, supplier.id]);
        updated++;
    }
    console.log(`[Weight] Calculated weights for ${updated} companies/suppliers`);
    return { updated };
}
