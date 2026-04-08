import pool from '../config/database';

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
export async function listApprovedCompanies(req: any, res: any) {
  try {
    const { service, city, company_type, page = '1', limit = '20', q } = req.query;
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(Math.max(1, parseInt(limit, 10) || 20), 100);
    const offset = (pageNum - 1) * limitNum;

    // Build WHERE clause
    const conditions = ['cp.status = ?'];
    const params: any[] = ['approved'];

    if (service) {
      conditions.push(`JSON_CONTAINS(cp.services, JSON_QUOTE(?))`);
      params.push(service);
    }

    if (city) {
      conditions.push(`cp.city = ?`);
      params.push(city);
    }

    if (company_type) {
      if (!['design_studio', 'renovation_company'].includes(company_type)) {
        return res.status(400).json({ error: 'Invalid company_type. Must be design_studio or renovation_company.' });
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
    const [countResult] = await pool.execute(countQuery, params);
    const total = (countResult as any[])[0]?.total || 0;

    // Fetch companies
    const listQuery = `
      SELECT
        cp.id,
        cp.company_name,
        cp.company_type,
        cp.description,
        cp.contact_person,
        cp.phone,
        cp.website,
        cp.city,
        cp.services,
        cp.logo_url,
        cp.display_order,
        cp.home_display_order,
        cp.list_display_order,
        cp.is_signed,
        u.email,
        (SELECT COUNT(*) FROM projects p WHERE p.company_profile_id = cp.id) as project_count
      FROM company_profiles cp
      JOIN users u ON cp.user_id = u.id
      WHERE ${whereClause}
      ORDER BY cp.weight_score DESC, CASE WHEN cp.home_display_order > 0 THEN 0 ELSE 1 END, cp.home_display_order ASC, cp.display_order DESC, cp.created_at DESC
      LIMIT ${Number(limitNum)} OFFSET ${Number(offset)}
    `;

    const [companies] = await pool.execute(listQuery, params);

    // Batch-fetch project images for all companies (avoids GROUP_CONCAT truncation)
    const companyIds = (companies as any[]).map((c: any) => c.id);
    const imageMap: Record<number, string[]> = {};
    if (companyIds.length > 0) {
      const placeholders = companyIds.map(() => '?').join(',');
      const [imgRows] = await pool.execute(
        `SELECT company_profile_id, images FROM projects
         WHERE company_profile_id IN (${placeholders})
         AND images IS NOT NULL AND images != '[]' AND images != ''
         ORDER BY created_at DESC`,
        companyIds
      );
      for (const row of imgRows as any[]) {
        try {
          const imgs = typeof row.images === 'string' ? JSON.parse(row.images) : row.images;
          if (Array.isArray(imgs)) {
            if (!imageMap[row.company_profile_id]) imageMap[row.company_profile_id] = [];
            imageMap[row.company_profile_id].push(...imgs);
          }
        } catch { /* skip malformed JSON */ }
      }
    }

    // Format response
    const formattedCompanies = (companies as any[]).map((company) => {
      const services = typeof company.services === 'string'
        ? JSON.parse(company.services)
        : company.services;

      return {
        id: company.id,
        company_name: company.company_name,
        company_type: company.company_type,
        description: company.description,
        contact_person: company.contact_person,
        phone: company.phone,
        website: company.website,
        city: company.city,
        services: services,
        logo_url: company.logo_url,
        display_order: company.display_order,
        home_display_order: company.home_display_order || 0,
        list_display_order: company.list_display_order || 0,
        project_count: company.project_count || 0,
        portfolio_images: imageMap[company.id] || [],
        is_signed: !!(company.is_signed),
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
  } catch (error) {
    console.error('List approved companies error:', error);
    res.status(500).json({ error: 'Failed to load companies.' });
  }
}

/**
 * GET /api/public/companies/:id
 * Get full company profile with projects
 */
export async function getCompanyDetail(req: any, res: any) {
  try {
    const { id } = req.params;

    // Fetch company profile
    const [companyRows] = await pool.execute(
      `SELECT cp.* FROM company_profiles cp WHERE cp.id = ? AND cp.status = ?`,
      [id, 'approved']
    );

    if ((companyRows as any[]).length === 0) {
      return res.status(404).json({ error: 'Company not found.' });
    }

    const company = (companyRows as any[])[0];

    // Fetch projects
    const [projects] = await pool.execute(
      `SELECT * FROM projects WHERE company_profile_id = ? ORDER BY created_at DESC`,
      [id]
    );

    // Parse JSON fields
    const services = typeof company.services === 'string'
      ? JSON.parse(company.services)
      : company.services;

    const formattedCompany = {
      id: company.id,
      company_name: company.company_name,
      company_type: company.company_type,
      description: company.description,
      contact_person: company.contact_person,
      phone: company.phone,
      website: company.website,
      city: company.city,
      address: company.address,
      services: services,
      logo_url: company.logo_url,
      display_order: company.display_order,
      created_at: company.created_at,
      projects: projects,
      is_claimed: true, // 注册公司永远是 claimed（用户自己创建的）
      is_signed: !!(company.is_signed),
    };

    res.json({ company: formattedCompany });
  } catch (error) {
    console.error('Get company detail error:', error);
    res.status(500).json({ error: 'Failed to load company.' });
  }
}

/**
 * GET /api/public/companies/categories
 * Get service categories
 */
export async function getServiceCategories(_req: any, res: any) {
  res.json(SERVICE_CATEGORIES);
}
