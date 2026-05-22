import pool from '../config/database';
import { sanitizePublicCompany } from '../lib/publicCompaniesSerialization';
import {
  buildPublicCompaniesListQuery,
  buildPublicCompanyDetailQuery,
  SPACE_L2_MAP,
} from '../lib/publicCompaniesQuery';
import { slugify } from '../lib/slugify';
import { extractImageUrls } from '../lib/projectImagesSerialization';

/**
 * Parses the raw `images` JSON blob from a project row and returns an array of
 * { url, tags } objects — one per image.  Handles both legacy string-array and
 * Gemini-tagged object-array shapes.
 */
function extractImageEntries(raw: unknown): Array<{ url: string; tags: string[]; imageIndex: number }> {
  let parsed: unknown = raw;
  if (typeof raw === 'string') {
    try { parsed = JSON.parse(raw); } catch { return []; }
  }
  if (!Array.isArray(parsed)) return [];

  const result: Array<{ url: string; tags: string[]; imageIndex: number }> = [];
  let imageIndex = 0;
  for (const item of parsed as unknown[]) {
    if (typeof item === 'string') {
      if (item) { result.push({ url: item, tags: [], imageIndex }); imageIndex++; }
    } else if (item && typeof item === 'object') {
      const obj = item as Record<string, unknown>;
      const url = typeof obj.url === 'string' ? obj.url : '';
      if (!url) continue;
      // ai_tags is a string[] array written by the tag engine
      const tags: string[] = Array.isArray(obj.ai_tags)
        ? (obj.ai_tags as unknown[]).filter((t): t is string => typeof t === 'string')
        : [];
      result.push({ url, tags, imageIndex });
      imageIndex++;
    }
  }
  return result;
}

const PUBLIC_COMPANY_WHERE = `WHERE is_active = 1`;

export async function getCompanies(req: any, res: any) {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = Math.min(parseInt(req.query.limit, 10) || 26, 100);
    const offset = (page - 1) * limit;
    const orderMode = req.query?.order === 'home' ? 'home' : 'list';

    // ?space=residential|commercial|public|outdoor → filter by L2 specialties
    const spaceParam = typeof req.query.space === 'string' ? req.query.space.toLowerCase().trim() : '';
    const spaceTags = spaceParam && SPACE_L2_MAP[spaceParam] ? SPACE_L2_MAP[spaceParam] : undefined;

    const spaceWhere = spaceTags && spaceTags.length > 0
      ? ` AND JSON_OVERLAPS(COALESCE(specialties, '[]'), '${JSON.stringify(spaceTags)}')`
      : '';

    const [countResult] = await pool.execute(
      `SELECT COUNT(*) as total FROM uae_companies WHERE is_active = 1 AND is_published = 1${spaceWhere}`
    );
    const total = (countResult as any[])[0]?.total || 0;

    const listQuery = buildPublicCompaniesListQuery({ limit, offset, orderMode, spaceTags });
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
 * GET /api/companies/active-services
 * Returns all active service types from the company_services master table,
 * ordered by sort_order. Includes all 32 (or however many) admin-configured
 * services regardless of whether companies currently use them — new services
 * added in /admin/enums will automatically appear here with no extra config.
 */
export async function getActiveServices(req: any, res: any) {
  try {
    const [rows] = await pool.execute(
      'SELECT name FROM company_services WHERE active = 1 ORDER BY sort_order, name'
    );
    const services = (rows as any[]).map((r) => r.name as string);
    res.setHeader('Cache-Control', 'public, max-age=300'); // 5-min CDN cache
    res.json({ services });
  } catch (error) {
    console.error('getActiveServices error:', error);
    res.status(500).json({ error: 'Failed to load active services.' });
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
    const seed = parseInt(req.query.seed, 10) || Math.floor(Math.random() * 1000000);
    const tagFilter = typeof req.query.tag === 'string' ? req.query.tag.trim() : '';

    // 1. Registered company projects (from company_profiles + projects tables)
    // We fetch projects without a DB-level tag filter here because filtering now
    // happens at the image level (each image carries its own ai_category tag).
    const [rows] = await pool.execute(`
      SELECT
        p.id, p.title, p.slug as project_slug, p.images,
        cp.id as company_id, cp.company_name, cp.slug as company_slug, cp.logo_url, cp.city
      FROM projects p
      JOIN company_profiles cp ON p.company_profile_id = cp.id
      WHERE cp.status = 'approved' AND cp.deleted_at IS NULL AND p.deleted_at IS NULL
        AND p.images IS NOT NULL AND p.images != '[]'
      ORDER BY RAND(${Number(seed)})
      LIMIT ${Number(limit * 10)} OFFSET ${Number(offset)}
    `);

    // Expand each project into one item per image. Filter by tag at image level.
    const registeredImages = (rows as any[]).flatMap(row => {
      const entries = extractImageEntries(row.images);
      return entries
        .filter(entry => !tagFilter || entry.tags.includes(tagFilter))
        .map(entry => ({
          url: entry.url,
          tags: entry.tags,
          imageIndex: entry.imageIndex,
          projectId: row.id as number,
          projectTitle: row.title || '',
          projectSlug: row.project_slug || '',
          companyId: row.company_id as number,
          companyName: row.company_name || '',
          companySlug: row.company_slug || '',
          companyLogo: row.logo_url || '',
          companyCity: row.city || '',
          source: 'registered' as const,
        }));
    });

    // 2. Directory company portfolio images (from uae_companies)
    // Directory images don't have ai_category yet, so skip them when a tag filter
    // is active to avoid flooding the feed with untagged images.
    let directoryImages: Array<{
      url: string;
      tags: string[];
      projectId: number;
      projectTitle: string;
      projectSlug: string;
      companyId: number;
      companyName: string;
      companySlug: string;
      companyLogo: string;
      companyCity: string;
      source: 'directory';
    }> = [];

    if (!tagFilter) {
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

      directoryImages = (dirRows as any[]).flatMap(row => {
        let categories: Record<string, any> = {};
        try {
          const parsed = typeof row.portfolio_images === 'string' ? JSON.parse(row.portfolio_images) : row.portfolio_images;
          if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
            categories = parsed;
          }
        } catch { /* skip malformed JSON */ }

        return Object.entries(categories).flatMap(([catName, entry], idx) => {
          let items: Array<{ url: string; title: string }> = [];
          if (Array.isArray(entry)) {
            items = entry;
          } else if (entry && typeof entry === 'object' && Array.isArray((entry as any).items)) {
            items = (entry as any).items;
          }
          return items
            .map((item: any) => item?.url || '')
            .filter(Boolean)
            .map((url: string) => ({
              url,
              tags: [] as string[],
              projectId: row.company_id * 10000 + idx,
              projectTitle: catName,
              projectSlug: slugify(catName),
              companyId: row.company_id as number,
              companyName: row.company_name || '',
              companySlug: row.company_slug || '',
              companyLogo: row.logo_url || '',
              companyCity: row.city || '',
              source: 'directory' as const,
            }));
        });
      });
    }

    // Merge: registered first, then directory (deduplicate by company name)
    const seenCompanyNames = new Set(registeredImages.map(img => img.companyName.toLowerCase()));
    const dedupedDirectoryImages = directoryImages.filter(
      img => !seenCompanyNames.has(img.companyName.toLowerCase())
    );

    const allImages = [...registeredImages, ...dedupedDirectoryImages];

    // Apply pagination
    const paginatedImages = allImages.slice(0, limit);

    // Count total registered images for pagination (approximate — counts projects,
    // not individual images, but keeps the number meaningful for page math)
    const [countResult] = await pool.execute(`
      SELECT COUNT(*) as total FROM projects p
      JOIN company_profiles cp ON p.company_profile_id = cp.id
      WHERE cp.status = 'approved' AND cp.deleted_at IS NULL AND p.deleted_at IS NULL
        AND p.images IS NOT NULL AND p.images != '[]'
    `);
    const registeredProjectCount = (countResult as any[])[0]?.total || 0;
    const estimatedTotal = tagFilter
      ? registeredImages.length
      : registeredProjectCount * 3 + dedupedDirectoryImages.length; // rough estimate

    res.json({
      images: paginatedImages,
      // Keep `projects` key for backward compat during Task 8→9 transition
      projects: paginatedImages,
      pagination: {
        page,
        limit,
        total: estimatedTotal,
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
      `SELECT id, name_en as company_name, slug, logo_url, city, address,
              phone, email, website, instagram, year_established
         FROM uae_companies WHERE slug = ?`,
      [companySlug]
    );
    if ((uaeRows as any[]).length > 0) {
      company = (uaeRows as any[])[0];
      companySource = 'directory';
    }

    // Try company_profiles.
    // NOTE: Do NOT select contact fields (address, phone, website, email) —
    // self-registered company contact info is admin-only by policy.
    if (!company) {
      const [cpRows] = await pool.execute(
        `SELECT id, company_name, slug, logo_url, city
           FROM company_profiles
          WHERE slug = ? AND status = ? AND deleted_at IS NULL`,
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
        // Normalize images: supports legacy ["url",...] and Gemini-tagged
        // [{url, ai_tags, ...},...] shapes. Tags are always plain strings.
        project.images = extractImageUrls(project.images);
        if (typeof project.tags === 'string') {
          try { project.tags = JSON.parse(project.tags); } catch { project.tags = []; }
        }
        if (!Array.isArray(project.tags)) project.tags = [];
      }
    }

    // For directory companies, "projects" live as portfolio_categories on the
    // uae_companies row (one entry per category name). Build a synthetic
    // project record by matching slugify(categoryName) against projectSlug.
    // Entries can be either the legacy array form or the new object form
    // ({ items, description, year, location, sourceUrl }).
    let directorySiblings: Array<{ id: string; title: string; slug: string }> = [];
    if (!project && companySource === 'directory') {
      const [ucRows] = await pool.execute(
        'SELECT portfolio_images FROM uae_companies WHERE id = ?',
        [company.id]
      );
      const ucRow = (ucRows as any[])[0];
      if (ucRow?.portfolio_images) {
        let categories: Record<string, any> = {};
        try {
          const parsed = typeof ucRow.portfolio_images === 'string'
            ? JSON.parse(ucRow.portfolio_images)
            : ucRow.portfolio_images;
          if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
            categories = parsed;
          }
        } catch { /* skip malformed JSON */ }

        const getItems = (entry: any): Array<{ url: string; title: string }> =>
          Array.isArray(entry) ? entry : (Array.isArray(entry?.items) ? entry.items : []);

        // Build sibling list for nav (all categories with non-empty image arrays)
        directorySiblings = Object.entries(categories)
          .filter(([, entry]) => getItems(entry).length > 0)
          .map(([catName]) => ({
            id: `${company.id}-${slugify(catName)}`,
            title: catName,
            slug: slugify(catName),
          }));

        // Find the category matching projectSlug
        for (const [catName, entry] of Object.entries(categories)) {
          if (slugify(catName) !== projectSlug) continue;
          const items = getItems(entry);
          if (items.length === 0) continue;

          const imageUrls = items.map((it: any) => it?.url || '').filter(Boolean);
          const meta = Array.isArray(entry) ? null : entry;
          project = {
            id: `${company.id}-${slugify(catName)}`,
            title: catName,
            slug: slugify(catName),
            description: (meta && typeof meta.description === 'string') ? meta.description : '',
            style: catName,
            location: (meta && typeof meta.location === 'string') ? meta.location : '',
            area: null,
            year: (meta && typeof meta.year === 'number') ? meta.year : null,
            cost: null,
            images: imageUrls,
            tags: [],
          };
          break;
        }
      }
    }

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    // Get sibling projects for prev/next navigation + total count.
    // Registered company → query projects table. Directory company → use the
    // synthetic sibling list built above from portfolio_categories.
    let siblings: any[];
    if (companySource === 'registered') {
      const [projRows] = await pool.execute(
        'SELECT id, title, slug FROM projects WHERE company_profile_id = ? AND deleted_at IS NULL ORDER BY created_at DESC',
        [company.id]
      );
      siblings = projRows as any[];
    } else {
      siblings = directorySiblings;
    }
    const projectCount = siblings.length;

    res.json({
      project: {
        id: project.id,
        title: project.title,
        slug: project.slug,
        description: project.description,
        style: project.style,
        location: project.location,
        area: project.area,
        year: project.year,
        cost: project.cost,
        images: project.images,
        tags: project.tags,
      },
      company: {
        id: company.id,
        name: company.company_name,
        slug: company.slug,
        logo: company.logo_url,
        city: company.city,
        address: company.address || null,
        phone: company.phone || null,
        email: company.email || null,
        website: company.website || null,
        instagram: company.instagram || null,
        yearEstablished: company.year_established || null,
        projectCount,
      },
      siblings: (siblings as any[]).map((s: any) => ({ id: s.id, title: s.title, slug: s.slug })),
    });
  } catch (error) {
    console.error('Get public project detail error:', error);
    res.status(500).json({ error: 'Failed to load project.' });
  }
}

/**
 * GET /api/companies/portfolio/image/:companySlug/:projectSlug/:imageIndex
 * Returns data for a single image SEO page.
 */
export async function getPortfolioImage(req: any, res: any) {
  try {
    const { companySlug, projectSlug, imageIndex: imageIndexStr } = req.params;
    const imageIndex = parseInt(imageIndexStr, 10);
    if (isNaN(imageIndex) || imageIndex < 0) {
      return res.status(400).json({ error: 'Invalid imageIndex' });
    }

    const [rows] = await pool.execute(
      `SELECT
         p.id, p.title, p.slug as project_slug, p.images, p.style, p.description, p.location,
         cp.id as company_id, cp.company_name, cp.slug as company_slug,
         cp.logo_url, cp.city
       FROM projects p
       JOIN company_profiles cp ON p.company_profile_id = cp.id
       WHERE cp.slug = ? AND p.slug = ?
         AND cp.status = 'approved' AND cp.deleted_at IS NULL AND p.deleted_at IS NULL
       LIMIT 1`,
      [companySlug, projectSlug]
    );

    if (!(rows as any[]).length) {
      return res.status(404).json({ error: 'Not found' });
    }

    const row = (rows as any[])[0];
    const entries = extractImageEntries(row.images);

    if (imageIndex >= entries.length) {
      return res.status(404).json({ error: 'Image index out of range' });
    }

    const targetEntry = entries[imageIndex];
    const siblings = entries
      .filter((_, i) => i !== imageIndex)
      .map(e => ({ url: e.url, tags: e.tags, imageIndex: e.imageIndex }))
      .slice(0, 8);

    res.json({
      image: {
        url: targetEntry.url,
        tags: targetEntry.tags,
        imageIndex,
      },
      project: {
        id: row.id,
        title: row.title || '',
        slug: row.project_slug || '',
        style: row.style || '',
        description: row.description || '',
        location: row.location || '',
      },
      company: {
        id: row.company_id,
        name: row.company_name || '',
        slug: row.company_slug || '',
        logo: row.logo_url || '',
        city: row.city || '',
      },
      siblings,
    });
  } catch (error) {
    console.error('Get portfolio image error:', error);
    res.status(500).json({ error: 'Failed to load image.' });
  }
}

export async function getCompanyBySlug(req: any, res: any) {
  try {
    const { slug } = req.params;

    // 1. Try uae_companies (directory) first
    const query = buildPublicCompanyDetailQuery(slug);
    const [rows] = await pool.execute(query.sql, query.params);
    let company = (rows as any[])[0];

    // 2. Fallback to company_profiles (registered companies)
    if (!company) {
      const [cpRows] = await pool.execute(
        `SELECT cp.id, cp.slug, cp.company_name AS name_en, cp.description, cp.city,
                cp.phone, cp.website, cp.services, cp.specialties, cp.logo_url,
                cp.status, cp.linked_uae_company_id, cp.is_signed,
                u.email
         FROM company_profiles cp
         JOIN users u ON u.id = cp.user_id
         WHERE cp.slug = ? AND cp.status = 'approved' AND cp.deleted_at IS NULL
         LIMIT 1`,
        [slug]
      );
      company = (cpRows as any[])[0];
      if (company) {
        // Fetch projects with full metadata for both portfolio_images and the projects[] array
        const [projRows] = await pool.execute(
          `SELECT id, title, slug, description, style, location, year, images
           FROM projects WHERE company_profile_id = ? AND status = 'published' AND deleted_at IS NULL
           ORDER BY created_at DESC`,
          [company.id]
        );

        // Build object-format portfolio_images for the masonry/style-tab fallback
        const categoriesObj: Record<string, any> = {};
        // Build projects[] array so CompanyDetailPage shows one card per project
        const registeredProjects: any[] = [];

        for (const row of projRows as any[]) {
          const parsed = typeof row.images === 'string' ? JSON.parse(row.images) : row.images;
          const imageUrls: string[] = [];
          const items: { url: string; title: string }[] = [];
          if (Array.isArray(parsed)) {
            for (const img of parsed) {
              const url = typeof img === 'string' ? img : img?.url;
              if (url) { imageUrls.push(url); items.push({ url, title: '' }); }
            }
          }
          if (items.length > 0) {
            const key = String(row.title || `Project ${row.id}`);
            categoriesObj[key] = {
              items,
              description: row.description || '',
              year: row.year ? parseInt(String(row.year), 10) : null,
              location: row.location || '',
              sourceUrl: '',
            };
          }
          if (imageUrls.length > 0) {
            registeredProjects.push({
              title: row.title || '',
              slug: row.slug || `project-${row.id}`,
              description: row.description || '',
              style: row.style || '',
              location: row.location || '',
              images: imageUrls,
            });
          }
        }

        company.is_signed = !!(company.is_signed);
        company.portfolio_images = JSON.stringify(categoriesObj);
        company.portfolio_categories = null;
        // Hide contact info for registered companies — business rule:
        // registered companies pay for leads, showing contact lets homeowners bypass platform
        company.phone = null;
        company.email = null;
        company.website = null;
        company.is_registered = true;
        company._registeredProjects = registeredProjects;
      }
    }

    if (!company) {
      // 3. Slug-to-name fallback: convert "rana-matloob-design-studio" → "rana matloob design studio"
      //    and match against company_name. Handles cases where the uae_companies record was deleted
      //    after a company claimed their listing, leaving the old slug URL as a dead 404.
      const nameFromSlug = slug.replace(/-/g, ' ');
      const [aliasRows] = await pool.execute(
        `SELECT slug FROM company_profiles
         WHERE LOWER(company_name) = LOWER(?)
           AND status = 'approved' AND deleted_at IS NULL
         LIMIT 1`,
        [nameFromSlug]
      );
      if ((aliasRows as any[]).length > 0) {
        const canonicalSlug = (aliasRows as any[])[0].slug;
        return res.redirect(301, `/api/companies/${canonicalSlug}`);
      }

      // Check if this slug was deleted/rejected in company_profiles — return 410 Gone so Google de-indexes it
      const [deletedRows] = await pool.execute(
        'SELECT id FROM company_profiles WHERE slug = ? AND (deleted_at IS NOT NULL OR status = ?) LIMIT 1',
        [slug, 'rejected']
      );
      if ((deletedRows as any[]).length > 0) {
        return res.status(410).json({ error: 'This company page has been removed.' });
      }

      // Check if this slug exists in uae_companies but is unpublished/inactive (taken down)
      // These are "removed from display" directory companies — 410 tells Google to de-index faster
      const [hiddenUaeRows] = await pool.execute(
        'SELECT id FROM uae_companies WHERE slug = ? AND (is_active = 0 OR is_published = 0) LIMIT 1',
        [slug]
      );
      if ((hiddenUaeRows as any[]).length > 0) {
        return res.status(410).json({ error: 'This company page has been removed.' });
      }

      return res.status(404).json({ error: 'Company not found.' });
    }

    const sanitized = sanitizePublicCompany(company);
    res.json({
      company: {
        ...sanitized,
        // Registered companies: expose projects[] for card-per-project view + set is_claimed=true
        ...(company.is_registered && {
          is_claimed: true,
          projects: company._registeredProjects || [],
        }),
      },
    });
  } catch (error) {
    console.error('Get company detail error:', error);
    res.status(500).json({ error: 'Failed to load company.' });
  }
}
