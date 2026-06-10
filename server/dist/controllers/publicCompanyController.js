"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.listApprovedCompanies = listApprovedCompanies;
exports.getCompanyDetail = getCompanyDetail;
exports.getServiceCategories = getServiceCategories;
const database_1 = __importDefault(require("../config/database"));
const VALID_SERVICES = [
    'Interior Design', 'Architecture', 'Fit-Out', 'Renovation', 'Construction', 'Landscape',
    'Furniture', 'Joinery', 'MEP', 'Project Management', 'Design & Build', 'Turnkey Solutions', 'Maintenance'
];
const SERVICE_CATEGORIES = {
    categories: [
        {
            group: 'Design',
            services: ['Interior Design', 'Architecture', 'Design & Build']
        },
        {
            group: 'Renovation',
            services: ['Fit-Out', 'Renovation', 'Construction', 'MEP']
        },
        {
            group: 'Furnishing',
            services: ['Furniture', 'Joinery', 'Turnkey Solutions']
        },
        {
            group: 'Services',
            services: ['Project Management', 'Landscape', 'Maintenance']
        }
    ]
};
/**
 * GET /api/public/companies
 * List approved companies with filtering
 * Query params: service, city, company_type, page, limit, q (search by company name)
 */
async function listApprovedCompanies(req, res) {
    try {
        const { service, city, company_type, page = '1', limit = '20', q } = req.query;
        const pageNum = Math.max(1, parseInt(page, 10) || 1);
        const limitNum = Math.min(Math.max(1, parseInt(limit, 10) || 20), 100);
        const offset = (pageNum - 1) * limitNum;
        // Build WHERE clause
        const conditions = [
            'cp.status = ?',
            'cp.is_published = 1',
            '(SELECT COUNT(*) FROM projects p WHERE p.company_profile_id = cp.id AND p.deleted_at IS NULL AND p.is_published = 1) > 0',
        ];
        const params = ['approved'];
        if (service) {
            conditions.push(`JSON_CONTAINS(cp.services, JSON_QUOTE(?))`);
            params.push(service);
        }
        if (city) {
            conditions.push(`cp.city = ?`);
            params.push(city);
        }
        if (company_type) {
            const validTypes = ['design_studio', 'renovation_company', 'general_contractor', 'mep_contractor', 'maintenance_company', 'specialty_trade', 'landscaping', 'swimming_pool', 'furnishing'];
            if (!validTypes.includes(company_type)) {
                return res.status(400).json({ error: `Invalid company_type. Must be one of: ${validTypes.join(', ')}` });
            }
            conditions.push(`cp.company_type = ?`);
            params.push(company_type);
        }
        if (q) {
            conditions.push(`cp.company_name LIKE ?`);
            params.push(`%${q}%`);
        }
        const whereClause = conditions.join(' AND ');
        // Count total
        const countQuery = `SELECT COUNT(*) as total FROM company_profiles cp WHERE ${whereClause}`;
        const [countResult] = await database_1.default.execute(countQuery, params);
        const total = countResult[0]?.total || 0;
        // Fetch companies
        // NOTE: contact fields (contact_person, phone, website, email, address) are
        // intentionally NOT selected here — self-registered company contact info is
        // admin-only. Admin endpoints (companyAdminController) still return them.
        const listQuery = `
      SELECT
        cp.id,
        cp.slug,
        cp.company_name,
        cp.company_type,
        cp.description,
        cp.city,
        cp.services,
        cp.logo_url,
        cp.display_order,
        cp.home_display_order,
        cp.list_display_order,
        cp.is_signed,
        cp.cover_image_url,
        cp.establishment_year,
        (SELECT COUNT(*) FROM projects p WHERE p.company_profile_id = cp.id) as project_count
      FROM company_profiles cp
      WHERE ${whereClause}
      ORDER BY cp.weight_score DESC, CASE WHEN cp.home_display_order > 0 THEN 0 ELSE 1 END, cp.home_display_order ASC, cp.display_order DESC, cp.created_at DESC
      LIMIT ${Number(limitNum)} OFFSET ${Number(offset)}
    `;
        const [companies] = await database_1.default.execute(listQuery, params);
        // Batch-fetch project images for all companies (avoids GROUP_CONCAT truncation)
        const companyIds = companies.map((c) => c.id);
        const imageMap = {};
        if (companyIds.length > 0) {
            const placeholders = companyIds.map(() => '?').join(',');
            const [imgRows] = await database_1.default.execute(`SELECT company_profile_id, images FROM projects
         WHERE company_profile_id IN (${placeholders})
         AND images IS NOT NULL AND images != '[]' AND images != ''
         ORDER BY created_at DESC`, companyIds);
            for (const row of imgRows) {
                try {
                    const imgs = typeof row.images === 'string' ? JSON.parse(row.images) : row.images;
                    if (Array.isArray(imgs)) {
                        if (!imageMap[row.company_profile_id])
                            imageMap[row.company_profile_id] = [];
                        imageMap[row.company_profile_id].push(...imgs);
                    }
                }
                catch { /* skip malformed JSON */ }
            }
        }
        // Format response
        const formattedCompanies = companies.map((company) => {
            const services = typeof company.services === 'string'
                ? JSON.parse(company.services)
                : company.services;
            // Admin-pinned cover overrides natural ordering — bring it to images[0] so
            // any consumer that just takes the first image gets the chosen cover.
            const rawImages = imageMap[company.id] || [];
            const portfolio_images = company.cover_image_url
                ? [company.cover_image_url, ...rawImages.filter((u) => u !== company.cover_image_url)]
                : rawImages;
            return {
                id: company.id,
                slug: company.slug || '',
                company_name: company.company_name,
                company_type: company.company_type,
                description: company.description,
                city: company.city,
                services: services,
                logo_url: company.logo_url,
                display_order: company.display_order,
                home_display_order: company.home_display_order || 0,
                list_display_order: company.list_display_order || 0,
                project_count: company.project_count || 0,
                portfolio_images,
                cover_image_url: company.cover_image_url || null,
                is_claimed: true,
                is_registered: true,
                is_signed: !!(company.is_signed),
                establishment_year: company.establishment_year || null,
            };
        });
        res.json({
            companies: formattedCompanies,
            pagination: {
                page: pageNum,
                limit: limitNum,
                total,
                totalPages: Math.ceil(total / limitNum),
            },
        });
    }
    catch (error) {
        console.error('List approved companies error:', error);
        res.status(500).json({ error: 'Failed to load companies.' });
    }
}
/**
 * GET /api/public/companies/:id
 * Get full company profile with projects
 */
async function getCompanyDetail(req, res) {
    try {
        const { id } = req.params;
        // Fetch company profile - try by slug first, then by ID
        const [companyRows] = await database_1.default.execute(`SELECT cp.* FROM company_profiles cp WHERE (cp.slug = ? OR cp.id = ?) AND cp.status = ? AND cp.is_published = 1`, [id, isNaN(Number(id)) ? 0 : Number(id), 'approved']);
        if (companyRows.length === 0) {
            return res.status(404).json({ error: 'Company not found.' });
        }
        const company = companyRows[0];
        // Fetch projects (use company.id, not URL param which may be a slug)
        const [projects] = await database_1.default.execute(`SELECT * FROM projects WHERE company_profile_id = ? AND deleted_at IS NULL AND is_published = 1 ORDER BY created_at DESC`, [company.id]);
        // Parse JSON fields
        const services = typeof company.services === 'string'
            ? JSON.parse(company.services)
            : company.services;
        // NOTE: contact fields (contact_person, phone, website, email, address) are
        // intentionally omitted — self-registered company contact info is admin-only.
        const formattedCompany = {
            id: company.id,
            slug: company.slug || '',
            company_name: company.company_name,
            company_type: company.company_type,
            description: company.description,
            city: company.city,
            services: services,
            logo_url: company.logo_url,
            display_order: company.display_order,
            created_at: company.created_at,
            projects: projects,
            cover_image_url: company.cover_image_url || null,
            is_claimed: true,
            is_registered: true,
            is_signed: !!(company.is_signed),
            company_profile_id: company.id,
        };
        res.json({ company: formattedCompany });
    }
    catch (error) {
        console.error('Get company detail error:', error);
        res.status(500).json({ error: 'Failed to load company.' });
    }
}
/**
 * GET /api/public/companies/categories
 * Get service categories
 */
async function getServiceCategories(_req, res) {
    res.json(SERVICE_CATEGORIES);
}
