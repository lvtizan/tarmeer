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
    // Random seed: same seed = same order within one session, different seed on refresh
    const seed = parseInt(req.query.seed, 10) || Math.floor(Math.random() * 1000000);

    // 1. Registered company projects (from company_profiles + projects tables)
    const [rows] = await pool.execute(`
      SELECT
        p.id, p.title, p.slug as project_slug, p.description, p.style, p.location, p.year, p.images,
        cp.id as company_id, cp.company_name, cp.slug as company_slug, cp.logo_url, cp.city
      FROM projects p
      JOIN company_profiles cp ON p.company_profile_id = cp.id
      WHERE cp.status = 'approved' AND cp.deleted_at IS NULL AND p.deleted_at IS NULL
        AND p.images IS NOT NULL AND p.images != '[]'
      ORDER BY RAND(${Number(seed)})
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
        slug: row.project_slug || '',
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

/**
 * GET /api/companies/:companySlug/projects/:projectSlug
 * Public project detail page
 */
export async function getPublicProjectDetail(req: any, res: any) {
  try {
    const { companySlug, projectSlug } = req.params;

    // Find company (try both tables)
    let company: any = null;
    let companySource = '';

    // Try uae_companies
    const [uaeRows] = await pool.execute(
      'SELECT id, name_en as company_name, slug, logo_url, city, website FROM uae_companies WHERE slug = ?',
      [companySlug]
    );
    if ((uaeRows as any[]).length > 0) {
      company = (uaeRows as any[])[0];
      companySource = 'directory';
    }

    // Try company_profiles
    if (!company) {
      const [cpRows] = await pool.execute(
        'SELECT id, company_name, slug, logo_url, city, website FROM company_profiles WHERE slug = ? AND status = ? AND deleted_at IS NULL',
        [companySlug, 'approved']
      );
      if ((cpRows as any[]).length > 0) {
        company = (cpRows as any[])[0];
        companySource = 'registered';
      }
    }

    if (!company) {
      return res.status(404).json({ error: 'Company not found' });
    }

    // Find project by slug
    let project: any = null;

    if (companySource === 'registered') {
      const [projRows] = await pool.execute(
        'SELECT * FROM projects WHERE company_profile_id = ? AND (slug = ? OR id = ?) AND deleted_at IS NULL',
        [company.id, projectSlug, isNaN(Number(projectSlug)) ? 0 : Number(projectSlug)]
      );
      if ((projRows as any[]).length > 0) {
        project = (projRows as any[])[0];
        // Parse images/tags - handle both string and already-parsed array
        if (typeof project.images === 'string') {
          try { project.images = JSON.parse(project.images); } catch { project.images = []; }
        }
        if (!Array.isArray(project.images)) project.images = [];
        if (typeof project.tags === 'string') {
          try { project.tags = JSON.parse(project.tags); } catch { project.tags = []; }
        }
        if (!Array.isArray(project.tags)) project.tags = [];
      }
    }

    // For directory companies, projects come from portfolio_categories
    // We can match by slug against category names
    if (!project && companySource === 'directory') {
      // Directory companies don't have individual project records in the projects table
      // Return 404 for now — directory company images use Lightbox, not project pages
      return res.status(404).json({ error: 'Project not found' });
    }

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    // Get sibling projects for prev/next navigation
    const [siblings] = await pool.execute(
      'SELECT id, title, slug FROM projects WHERE company_profile_id = ? AND deleted_at IS NULL ORDER BY created_at DESC',
      [company.id]
    );

    res.json({
      project: {
        id: project.id,
        title: project.title,
        slug: project.slug,
        description: project.description,
        style: project.style,
        location: project.location,
        year: project.year,
        images: project.images,
        tags: project.tags,
      },
      company: {
        id: company.id,
        name: company.company_name,
        slug: company.slug,
        logo: company.logo_url,
        city: company.city,
      },
      siblings: (siblings as any[]).map((s: any) => ({ id: s.id, title: s.title, slug: s.slug })),
    });
  } catch (error) {
    console.error('Get public project detail error:', error);
    res.status(500).json({ error: 'Failed to load project.' });
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
