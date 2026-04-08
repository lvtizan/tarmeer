import pool from '../config/database';
import { sanitizePublicCompany } from '../lib/publicCompaniesSerialization';
import {
  buildPublicCompaniesListQuery,
  buildPublicCompanyDetailQuery,
} from '../lib/publicCompaniesQuery';

const PUBLIC_COMPANY_WHERE = `WHERE is_active = 1`;

export async function getCompanies(req: any, res: any) {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = Math.min(parseInt(req.query.limit, 10) || 26, 100);
    const offset = (page - 1) * limit;
    const orderMode = req.query?.order === 'home' ? 'home' : 'list';

    const [countResult] = await pool.execute(
      `SELECT COUNT(*) as total FROM uae_companies ${PUBLIC_COMPANY_WHERE}`
    );
    const total = (countResult as any[])[0]?.total || 0;

    const listQuery = buildPublicCompaniesListQuery({ limit, offset, orderMode });
    const [companies] = await pool.execute(listQuery.sql, listQuery.params);

    res.json({
      companies: (companies as any[]).map(sanitizePublicCompany),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Get companies error:', error);
    res.status(500).json({ error: 'Failed to load companies.' });
  }
}

/**
 * GET /api/companies/portfolio?page=1&limit=30
 * Returns a flat list of project images from all companies for the portfolio feed.
 * Combines registered company projects and directory company portfolio images.
 */
export async function getPortfolioFeed(req: any, res: any) {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(Math.max(1, parseInt(req.query.limit, 10) || 30), 60);
    const offset = (page - 1) * limit;

    // 1. Registered company projects (from company_profiles + projects tables)
    const [rows] = await pool.execute(`
      SELECT
        p.id, p.title, p.description, p.style, p.location, p.year, p.images,
        cp.id as company_id, cp.company_name, cp.slug as company_slug, cp.logo_url, cp.city
      FROM projects p
      JOIN company_profiles cp ON p.company_profile_id = cp.id
      WHERE cp.status = 'approved' AND cp.deleted_at IS NULL AND p.deleted_at IS NULL
        AND p.images IS NOT NULL AND p.images != '[]'
      ORDER BY cp.weight_score DESC, p.created_at DESC
      LIMIT ${Number(limit)} OFFSET ${Number(offset)}
    `);

    // Format registered company projects
    const registeredProjects = (rows as any[]).map(row => {
      let images: string[] = [];
      try {
        const parsed = typeof row.images === 'string' ? JSON.parse(row.images) : row.images;
        if (Array.isArray(parsed)) images = parsed.filter(Boolean);
      } catch { /* skip malformed JSON */ }
      return {
        id: row.id,
        title: row.title || '',
        description: row.description || '',
        style: row.style || '',
        location: row.location || '',
        year: row.year || null,
        images,
        companyId: row.company_id,
        companyName: row.company_name || '',
        companySlug: row.company_slug || '',
        companyLogo: row.logo_url || '',
        companyCity: row.city || '',
        source: 'registered' as const,
      };
    }).filter(p => p.images.length > 0);

    // 2. Directory company portfolio images (from uae_companies)
    const [dirRows] = await pool.execute(`
      SELECT
        uc.id as company_id, uc.name_en as company_name, uc.slug as company_slug,
        uc.logo_url, uc.city, uc.portfolio_images
      FROM uae_companies uc
      WHERE uc.is_active = 1
        AND uc.portfolio_images IS NOT NULL
        AND uc.portfolio_images != '[]'
        AND uc.portfolio_images != ''
      ORDER BY uc.weight_score DESC
      LIMIT 30
    `);

    // Parse directory company portfolio images into project-like items
    const directoryProjects = (dirRows as any[]).flatMap(row => {
      let categories: Record<string, { url: string; title: string }[]> = {};
      try {
        const parsed = typeof row.portfolio_images === 'string' ? JSON.parse(row.portfolio_images) : row.portfolio_images;
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
          categories = parsed;
        }
      } catch { /* skip malformed JSON */ }

      return Object.entries(categories).map(([catName, items], idx) => {
        const imageUrls = Array.isArray(items) ? items.map((item: any) => item?.url || '').filter(Boolean) : [];
        if (imageUrls.length === 0) return null;
        return {
          id: row.company_id * 10000 + idx,
          title: catName,
          description: '',
          style: catName,
          location: '',
          year: null,
          images: imageUrls,
          companyId: row.company_id,
          companyName: row.company_name || '',
          companySlug: row.company_slug || '',
          companyLogo: row.logo_url || '',
          companyCity: row.city || '',
          source: 'directory' as const,
        };
      }).filter(Boolean);
    });

    // Merge: registered first, then directory (deduplicate by company name)
    const seenCompanyNames = new Set(registeredProjects.map(p => p.companyName.toLowerCase()));
    const dedupedDirectory = directoryProjects.filter(
      (p): p is NonNullable<typeof p> => p !== null && !seenCompanyNames.has(p.companyName.toLowerCase())
    );

    const allProjects = [...registeredProjects, ...dedupedDirectory];

    // Count total for pagination
    const [countResult] = await pool.execute(`
      SELECT COUNT(*) as total FROM projects p
      JOIN company_profiles cp ON p.company_profile_id = cp.id
      WHERE cp.status = 'approved' AND cp.deleted_at IS NULL AND p.deleted_at IS NULL
        AND p.images IS NOT NULL AND p.images != '[]'
    `);
    const registeredTotal = (countResult as any[])[0]?.total || 0;

    res.json({
      projects: allProjects,
      pagination: {
        page,
        limit,
        total: registeredTotal + dedupedDirectory.length,
      },
    });
  } catch (error) {
    console.error('Get portfolio feed error:', error);
    res.status(500).json({ error: 'Failed to load portfolio.' });
  }
}

export async function getCompanyBySlug(req: any, res: any) {
  try {
    const { slug } = req.params;
    const query = buildPublicCompanyDetailQuery(slug);
    const [rows] = await pool.execute(query.sql, query.params);
    const company = (rows as any[])[0];

    if (!company) {
      return res.status(404).json({ error: 'Company not found.' });
    }

    res.json({
      company: sanitizePublicCompany(company),
    });
  } catch (error) {
    console.error('Get company detail error:', error);
    res.status(500).json({ error: 'Failed to load company.' });
  }
}
