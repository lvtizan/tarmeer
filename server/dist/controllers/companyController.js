"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getCompanies = getCompanies;
exports.getActiveServices = getActiveServices;
exports.getPortfolioFeed = getPortfolioFeed;
exports.getPublicProjectDetail = getPublicProjectDetail;
exports.getPortfolioImage = getPortfolioImage;
exports.getCompanyBySlug = getCompanyBySlug;
exports.toggleProjectPortfolioHidden = toggleProjectPortfolioHidden;
exports.toggleDirectoryImagePortfolioHidden = toggleDirectoryImagePortfolioHidden;
exports.getPortfolioTags = getPortfolioTags;
exports.getCompaniesByServiceCity = getCompaniesByServiceCity;
const database_1 = __importDefault(require("../config/database"));
const publicCompaniesSerialization_1 = require("../lib/publicCompaniesSerialization");
const publicCompaniesQuery_1 = require("../lib/publicCompaniesQuery");
const slugify_1 = require("../lib/slugify");
const projectImagesSerialization_1 = require("../lib/projectImagesSerialization");
/**
 * Parses the raw `images` JSON blob from a project row and returns an array of
 * { url, tags } objects — one per image.  Handles both legacy string-array and
 * Gemini-tagged object-array shapes.
 */
function extractImageEntries(raw) {
    let parsed = raw;
    if (typeof raw === 'string') {
        try {
            parsed = JSON.parse(raw);
        }
        catch {
            return [];
        }
    }
    if (!Array.isArray(parsed))
        return [];
    const result = [];
    let imageIndex = 0;
    for (const item of parsed) {
        if (typeof item === 'string') {
            if (item) {
                result.push({ url: item, tags: [], imageIndex });
                imageIndex++;
            }
        }
        else if (item && typeof item === 'object') {
            const obj = item;
            const url = typeof obj.url === 'string' ? obj.url : '';
            if (!url)
                continue;
            // ai_category = merged B+C taxonomy tags (authoritative for filtering)
            // ai_tags = CLIP-only tags (fallback for images not yet retagged by B+C)
            const aiCategory = Array.isArray(obj.ai_category)
                ? obj.ai_category.filter((t) => typeof t === 'string')
                : [];
            const aiTags = Array.isArray(obj.ai_tags)
                ? obj.ai_tags.filter((t) => typeof t === 'string')
                : [];
            const tags = aiCategory.length > 0 ? aiCategory : aiTags;
            result.push({ url, tags, imageIndex });
            imageIndex++;
        }
    }
    return result;
}
const PUBLIC_COMPANY_WHERE = `WHERE is_active = 1`;
async function getCompanies(req, res) {
    try {
        const page = parseInt(req.query.page, 10) || 1;
        const limit = Math.min(parseInt(req.query.limit, 10) || 26, 100);
        const offset = (page - 1) * limit;
        const orderMode = req.query?.order === 'home' ? 'home' : 'list';
        // ?space=residential|commercial|public|outdoor → filter by L2 specialties
        const spaceParam = typeof req.query.space === 'string' ? req.query.space.toLowerCase().trim() : '';
        const spaceTags = spaceParam && publicCompaniesQuery_1.SPACE_L2_MAP[spaceParam] ? publicCompaniesQuery_1.SPACE_L2_MAP[spaceParam] : undefined;
        const spaceWhere = spaceTags && spaceTags.length > 0
            ? ` AND JSON_OVERLAPS(COALESCE(specialties, '[]'), '${JSON.stringify(spaceTags)}')`
            : '';
        const countryQP = typeof req.query.country === 'string' && ['ae', 'vn'].includes(req.query.country) ? req.query.country : null;
        const country = countryQP || req.country || 'ae';
        const [countResult] = await database_1.default.execute(`SELECT COUNT(*) as total FROM uae_companies WHERE is_active = 1 AND is_published = 1${spaceWhere} AND country = ?`, [country]);
        const total = countResult[0]?.total || 0;
        const listQuery = (0, publicCompaniesQuery_1.buildPublicCompaniesListQuery)({ limit, offset, orderMode, spaceTags, country });
        const [companies] = await database_1.default.execute(listQuery.sql, listQuery.params);
        res.json({
            companies: companies.map(publicCompaniesSerialization_1.sanitizePublicCompany),
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
            },
        });
    }
    catch (error) {
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
async function getActiveServices(req, res) {
    try {
        const [rows] = await database_1.default.execute('SELECT name FROM company_services WHERE active = 1 ORDER BY sort_order, name');
        const services = rows.map((r) => r.name);
        res.setHeader('Cache-Control', 'public, max-age=300'); // 5-min CDN cache
        res.json({ services });
    }
    catch (error) {
        console.error('getActiveServices error:', error);
        res.status(500).json({ error: 'Failed to load active services.' });
    }
}
/**
 * GET /api/companies/portfolio?page=1&limit=30
 * Returns a paginated list of projects from all companies for the portfolio feed.
 * Combines registered company projects and directory company portfolio images.
 */
async function getPortfolioFeed(req, res) {
    try {
        const page = Math.max(1, parseInt(req.query.page, 10) || 1);
        const limit = Math.min(Math.max(1, parseInt(req.query.limit, 10) || 12), 60);
        const offset = (page - 1) * limit;
        const seed = parseInt(req.query.seed, 10) || Math.floor(Math.random() * 1000000);
        const tagFilter = typeof req.query.tag === 'string' ? req.query.tag.trim() : '';
        // Build project-level tag pre-filter clause (used as coarse filter; image-level match done below)
        const safeTag = tagFilter.replace(/['"\\]/g, '');
        const tagClause = tagFilter ? `AND JSON_CONTAINS(p.tags, '"${safeTag}"')` : '';
        // Fetch portfolio-hidden image URLs for directory companies
        const [hiddenRows] = await database_1.default.execute('SELECT image_url FROM portfolio_hidden_images');
        const hiddenUrls = new Set(hiddenRows.map((r) => r.image_url));
        // 1. Registered company projects (from company_profiles + projects tables)
        const [rows] = await database_1.default.execute(`
      SELECT
        p.id, p.title, p.slug as project_slug, p.description, p.style, p.location, p.year, p.images, p.tags,
        cp.id as company_id, cp.company_name, cp.slug as company_slug, cp.logo_url, cp.city
      FROM projects p
      JOIN company_profiles cp ON p.company_profile_id = cp.id
      WHERE cp.status = 'approved' AND cp.deleted_at IS NULL AND p.deleted_at IS NULL
        AND p.is_portfolio_hidden = 0
        AND p.images IS NOT NULL AND p.images != '[]'
        ${tagClause}
      ORDER BY RAND(${Number(seed)})
      LIMIT ${Number(limit)} OFFSET ${Number(offset)}
    `);
        const registeredProjects = rows.flatMap(row => {
            const allEntries = extractImageEntries(row.images);
            let tags = [];
            try {
                const parsed = typeof row.tags === 'string' ? JSON.parse(row.tags) : row.tags;
                if (Array.isArray(parsed))
                    tags = parsed;
            }
            catch { /* skip */ }
            const base = {
                id: row.id,
                title: row.title || '',
                slug: row.project_slug || '',
                description: row.description || '',
                style: row.style || '',
                location: row.location || '',
                year: row.year || null,
                tags,
                companyId: row.company_id,
                companyName: row.company_name || '',
                companySlug: row.company_slug || '',
                companyLogo: row.logo_url || '',
                companyCity: row.city || '',
                source: 'registered',
            };
            if (tagFilter) {
                // Image-level tag match: find the first image whose ai_category includes the tag
                const matchedEntry = allEntries.find(e => e.tags.includes(tagFilter));
                if (!matchedEntry)
                    return [];
                return [{ ...base, images: [matchedEntry.url] }];
            }
            const images = allEntries.map(e => e.url).filter(Boolean);
            if (images.length === 0)
                return [];
            return [{ ...base, images }];
        });
        // 2. Directory company portfolio images (from uae_companies)
        const [dirRows] = await database_1.default.execute(`
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
        const directoryProjects = dirRows.flatMap(row => {
            let categories = {};
            try {
                const parsed = typeof row.portfolio_images === 'string' ? JSON.parse(row.portfolio_images) : row.portfolio_images;
                if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
                    categories = parsed;
                }
            }
            catch { /* skip malformed JSON */ }
            return Object.entries(categories).map(([catName, entry], idx) => {
                let items = [];
                let description = '';
                let year = null;
                let location = '';
                if (Array.isArray(entry)) {
                    items = entry;
                }
                else if (entry && typeof entry === 'object' && Array.isArray(entry.items)) {
                    items = entry.items;
                    description = typeof entry.description === 'string' ? entry.description : '';
                    year = typeof entry.year === 'number' ? entry.year : null;
                    location = typeof entry.location === 'string' ? entry.location : '';
                }
                // Filter out portfolio-hidden images
                const imageUrls = items.map((item) => item?.url || '').filter(u => u && !hiddenUrls.has(u));
                if (imageUrls.length === 0)
                    return null;
                return {
                    id: row.company_id * 10000 + idx,
                    title: catName,
                    slug: (0, slugify_1.slugify)(catName),
                    description,
                    style: catName,
                    location,
                    year,
                    images: imageUrls,
                    companyId: row.company_id,
                    companyName: row.company_name || '',
                    companySlug: row.company_slug || '',
                    companyLogo: row.logo_url || '',
                    companyCity: row.city || '',
                    source: 'directory',
                };
            }).filter(Boolean);
        });
        // Merge: registered first, then directory (deduplicate by company name)
        const seenCompanyNames = new Set(registeredProjects.map(p => p.companyName.toLowerCase()));
        const dedupedDirectory = directoryProjects.filter((p) => p !== null && !seenCompanyNames.has(p.companyName.toLowerCase()));
        // When tag filter is active, exclude directory projects (they have no image-level tags)
        const allProjects = tagFilter
            ? registeredProjects
            : [...registeredProjects, ...dedupedDirectory];
        const paginatedProjects = allProjects.slice(0, limit);
        const [countResult] = await database_1.default.execute(`
      SELECT COUNT(*) as total FROM projects p
      JOIN company_profiles cp ON p.company_profile_id = cp.id
      WHERE cp.status = 'approved' AND cp.deleted_at IS NULL AND p.deleted_at IS NULL
        AND p.images IS NOT NULL AND p.images != '[]'
        ${tagClause}
    `);
        const registeredTotal = countResult[0]?.total || 0;
        res.json({
            projects: paginatedProjects,
            images: paginatedProjects, // backward compat key
            pagination: {
                page,
                limit,
                total: tagFilter ? registeredTotal : registeredTotal + dedupedDirectory.length,
            },
        });
    }
    catch (error) {
        console.error('Get portfolio feed error:', error);
        res.status(500).json({ error: 'Failed to load portfolio.' });
    }
}
/**
 * GET /api/companies/:companySlug/projects/:projectSlug
 * Public project detail page
 */
async function getPublicProjectDetail(req, res) {
    try {
        const { companySlug, projectSlug } = req.params;
        // Find company (try both tables)
        let company = null;
        let companySource = '';
        // Try uae_companies
        const [uaeRows] = await database_1.default.execute(`SELECT id, name_en as company_name, slug, logo_url, city, address,
              phone, email, website, instagram, year_established
         FROM uae_companies WHERE slug = ?`, [companySlug]);
        if (uaeRows.length > 0) {
            company = uaeRows[0];
            companySource = 'directory';
        }
        // Try company_profiles.
        // NOTE: Do NOT select contact fields (address, phone, website, email) —
        // self-registered company contact info is admin-only by policy.
        if (!company) {
            const [cpRows] = await database_1.default.execute(`SELECT id, company_name, slug, logo_url, city
           FROM company_profiles
          WHERE slug = ? AND status = ? AND deleted_at IS NULL`, [companySlug, 'approved']);
            if (cpRows.length > 0) {
                company = cpRows[0];
                companySource = 'registered';
            }
        }
        if (!company) {
            return res.status(404).json({ error: 'Company not found' });
        }
        // Find project by slug
        let project = null;
        if (companySource === 'registered') {
            const [projRows] = await database_1.default.execute('SELECT * FROM projects WHERE company_profile_id = ? AND (slug = ? OR id = ?) AND deleted_at IS NULL', [company.id, projectSlug, isNaN(Number(projectSlug)) ? 0 : Number(projectSlug)]);
            if (projRows.length > 0) {
                project = projRows[0];
                // Normalize images: supports legacy ["url",...] and Gemini-tagged
                // [{url, ai_tags, ...},...] shapes. Tags are always plain strings.
                project.images = (0, projectImagesSerialization_1.extractImageUrls)(project.images);
                if (typeof project.tags === 'string') {
                    try {
                        project.tags = JSON.parse(project.tags);
                    }
                    catch {
                        project.tags = [];
                    }
                }
                if (!Array.isArray(project.tags))
                    project.tags = [];
            }
        }
        // For directory companies, "projects" live as portfolio_categories on the
        // uae_companies row (one entry per category name). Build a synthetic
        // project record by matching slugify(categoryName) against projectSlug.
        // Entries can be either the legacy array form or the new object form
        // ({ items, description, year, location, sourceUrl }).
        let directorySiblings = [];
        if (!project && companySource === 'directory') {
            const [ucRows] = await database_1.default.execute('SELECT portfolio_images FROM uae_companies WHERE id = ?', [company.id]);
            const ucRow = ucRows[0];
            if (ucRow?.portfolio_images) {
                let categories = {};
                try {
                    const parsed = typeof ucRow.portfolio_images === 'string'
                        ? JSON.parse(ucRow.portfolio_images)
                        : ucRow.portfolio_images;
                    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
                        categories = parsed;
                    }
                }
                catch { /* skip malformed JSON */ }
                const getItems = (entry) => Array.isArray(entry) ? entry : (Array.isArray(entry?.items) ? entry.items : []);
                // Build sibling list for nav (all categories with non-empty image arrays)
                directorySiblings = Object.entries(categories)
                    .filter(([, entry]) => getItems(entry).length > 0)
                    .map(([catName]) => ({
                    id: `${company.id}-${(0, slugify_1.slugify)(catName)}`,
                    title: catName,
                    slug: (0, slugify_1.slugify)(catName),
                }));
                // Find the category matching projectSlug
                for (const [catName, entry] of Object.entries(categories)) {
                    if ((0, slugify_1.slugify)(catName) !== projectSlug)
                        continue;
                    const items = getItems(entry);
                    if (items.length === 0)
                        continue;
                    const imageUrls = items.map((it) => it?.url || '').filter(Boolean);
                    const meta = Array.isArray(entry) ? null : entry;
                    project = {
                        id: `${company.id}-${(0, slugify_1.slugify)(catName)}`,
                        title: catName,
                        slug: (0, slugify_1.slugify)(catName),
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
        let siblings;
        if (companySource === 'registered') {
            const [projRows] = await database_1.default.execute('SELECT id, title, slug FROM projects WHERE company_profile_id = ? AND deleted_at IS NULL ORDER BY created_at DESC', [company.id]);
            siblings = projRows;
        }
        else {
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
                // 完整电话只从 POST /api/phone-reveals 返回（点击计数）
                phone: null,
                has_phone: !!(company.phone),
                company_source: companySource,
                email: company.email || null,
                website: company.website || null,
                instagram: company.instagram || null,
                yearEstablished: company.year_established || null,
                projectCount,
            },
            siblings: siblings.map((s) => ({ id: s.id, title: s.title, slug: s.slug })),
        });
    }
    catch (error) {
        console.error('Get public project detail error:', error);
        res.status(500).json({ error: 'Failed to load project.' });
    }
}
/**
 * GET /api/companies/portfolio/image/:companySlug/:projectSlug/:imageIndex
 * Returns data for a single image SEO page.
 */
async function getPortfolioImage(req, res) {
    try {
        const { companySlug, projectSlug, imageIndex: imageIndexStr } = req.params;
        const imageIndex = parseInt(imageIndexStr, 10);
        if (isNaN(imageIndex) || imageIndex < 0) {
            return res.status(400).json({ error: 'Invalid imageIndex' });
        }
        const [rows] = await database_1.default.execute(`SELECT
         p.id, p.title, p.slug as project_slug, p.images, p.style, p.description, p.location,
         cp.id as company_id, cp.company_name, cp.slug as company_slug,
         cp.logo_url, cp.city
       FROM projects p
       JOIN company_profiles cp ON p.company_profile_id = cp.id
       WHERE cp.slug = ? AND p.slug = ?
         AND cp.status = 'approved' AND cp.deleted_at IS NULL AND p.deleted_at IS NULL
       LIMIT 1`, [companySlug, projectSlug]);
        if (!rows.length) {
            return res.status(404).json({ error: 'Not found' });
        }
        const row = rows[0];
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
    }
    catch (error) {
        console.error('Get portfolio image error:', error);
        res.status(500).json({ error: 'Failed to load image.' });
    }
}
async function getCompanyBySlug(req, res) {
    try {
        const { slug } = req.params;
        // 1. Try uae_companies (directory) first
        const query = (0, publicCompaniesQuery_1.buildPublicCompanyDetailQuery)(slug);
        const [rows] = await database_1.default.execute(query.sql, query.params);
        let company = rows[0];
        // 2. Fallback to company_profiles (registered companies)
        if (!company) {
            const [cpRows] = await database_1.default.execute(`SELECT cp.id, cp.slug, cp.company_name AS name_en, cp.description, cp.city,
                cp.phone, cp.website, cp.services, cp.specialties, cp.logo_url,
                cp.status, cp.linked_uae_company_id, cp.is_signed, cp.is_certified,
                u.email
         FROM company_profiles cp
         JOIN users u ON u.id = cp.user_id
         WHERE cp.slug = ? AND cp.status = 'approved' AND cp.deleted_at IS NULL
         LIMIT 1`, [slug]);
            company = cpRows[0];
            if (company) {
                // Fetch projects with full metadata for both portfolio_images and the projects[] array
                const [projRows] = await database_1.default.execute(`SELECT id, title, slug, description, style, location, year, images
           FROM projects WHERE company_profile_id = ? AND status = 'published' AND deleted_at IS NULL
           ORDER BY created_at DESC`, [company.id]);
                // Build object-format portfolio_images for the masonry/style-tab fallback
                const categoriesObj = {};
                // Build projects[] array so CompanyDetailPage shows one card per project
                const registeredProjects = [];
                for (const row of projRows) {
                    const parsed = typeof row.images === 'string' ? JSON.parse(row.images) : row.images;
                    const imageUrls = [];
                    const items = [];
                    if (Array.isArray(parsed)) {
                        for (const img of parsed) {
                            const url = typeof img === 'string' ? img : img?.url;
                            if (url) {
                                imageUrls.push(url);
                                items.push({ url, title: '' });
                            }
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
                company.is_certified = !!(company.is_certified);
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
            const [aliasRows] = await database_1.default.execute(`SELECT slug FROM company_profiles
         WHERE LOWER(company_name) = LOWER(?)
           AND status = 'approved' AND deleted_at IS NULL
         LIMIT 1`, [nameFromSlug]);
            if (aliasRows.length > 0) {
                const canonicalSlug = aliasRows[0].slug;
                return res.redirect(301, `/api/companies/${canonicalSlug}`);
            }
            // Check if this slug was deleted/rejected in company_profiles — return 410 Gone so Google de-indexes it
            const [deletedRows] = await database_1.default.execute('SELECT id FROM company_profiles WHERE slug = ? AND (deleted_at IS NOT NULL OR status = ?) LIMIT 1', [slug, 'rejected']);
            if (deletedRows.length > 0) {
                return res.status(410).json({ error: 'This company page has been removed.' });
            }
            // Check if this slug exists in uae_companies but is unpublished/inactive (taken down)
            // These are "removed from display" directory companies — 410 tells Google to de-index faster
            const [hiddenUaeRows] = await database_1.default.execute('SELECT id FROM uae_companies WHERE slug = ? AND (is_active = 0 OR is_published = 0) LIMIT 1', [slug]);
            if (hiddenUaeRows.length > 0) {
                return res.status(410).json({ error: 'This company page has been removed.' });
            }
            return res.status(404).json({ error: 'Company not found.' });
        }
        const sanitized = (0, publicCompaniesSerialization_1.sanitizePublicCompany)(company);
        res.json({
            company: {
                ...sanitized,
                // Registered companies: expose projects[] for card-per-project view + set is_claimed=true
                ...(company.is_registered && {
                    is_claimed: true,
                    projects: company._registeredProjects || [],
                    company_profile_id: company.id, // cp.id = company_profiles.id, needed for lead linking
                }),
            },
        });
    }
    catch (error) {
        console.error('Get company detail error:', error);
        res.status(500).json({ error: 'Failed to load company.' });
    }
}
/**
 * PUT /api/admin/projects/:projectId/toggle-portfolio-hidden
 * Toggles is_portfolio_hidden for a registered company project.
 */
async function toggleProjectPortfolioHidden(req, res) {
    try {
        const projectId = parseInt(req.params.projectId, 10);
        if (!projectId)
            return res.status(400).json({ error: 'Invalid project id' });
        const [rows] = await database_1.default.execute('SELECT is_portfolio_hidden FROM projects WHERE id = ? AND deleted_at IS NULL', [projectId]);
        const row = rows[0];
        if (!row)
            return res.status(404).json({ error: 'Project not found' });
        const next = row.is_portfolio_hidden ? 0 : 1;
        await database_1.default.execute('UPDATE projects SET is_portfolio_hidden = ? WHERE id = ?', [next, projectId]);
        res.json({ ok: true, is_portfolio_hidden: next });
    }
    catch (error) {
        console.error('Toggle portfolio hidden error:', error);
        res.status(500).json({ error: 'Failed to toggle' });
    }
}
/**
 * PUT /api/admin/directory-companies/:companyId/images/toggle-portfolio-hidden
 * Toggles portfolio visibility for a directory company image URL.
 * Body: { imageUrl: string }
 */
async function toggleDirectoryImagePortfolioHidden(req, res) {
    try {
        const { imageUrl } = req.body;
        if (!imageUrl || typeof imageUrl !== 'string') {
            return res.status(400).json({ error: 'imageUrl is required' });
        }
        const [existing] = await database_1.default.execute('SELECT 1 FROM portfolio_hidden_images WHERE image_url = ?', [imageUrl]);
        if (existing.length > 0) {
            await database_1.default.execute('DELETE FROM portfolio_hidden_images WHERE image_url = ?', [imageUrl]);
            res.json({ ok: true, is_portfolio_hidden: false });
        }
        else {
            await database_1.default.execute('INSERT INTO portfolio_hidden_images (image_url) VALUES (?)', [imageUrl]);
            res.json({ ok: true, is_portfolio_hidden: true });
        }
    }
    catch (error) {
        console.error('Toggle directory image portfolio hidden error:', error);
        res.status(500).json({ error: 'Failed to toggle' });
    }
}
/**
 * GET /api/companies/portfolio/tags
 * Returns distinct AI-tagged style and room categories from project images.
 */
async function getPortfolioTags(req, res) {
    try {
        const [rows] = await database_1.default.query(`SELECT CAST(images AS CHAR) as images FROM projects
       WHERE deleted_at IS NULL AND images IS NOT NULL AND images != '[]'
         AND images LIKE '%ai_category%'`);
        const counts = {};
        for (const row of rows) {
            const txt = String(row.images || '');
            const re = /"ai_category"\s*:\s*\[([^\]]+)\]/g;
            let m;
            while ((m = re.exec(txt)) !== null) {
                const matches = m[1].match(/"([^"]+)"/g) || [];
                matches.forEach((v) => {
                    const c = v.replace(/"/g, '');
                    counts[c] = (counts[c] || 0) + 1;
                });
            }
        }
        const ROOM_SET = new Set(['Living Room', 'Home Office', 'Bathroom', 'Dining Room', 'Hallway', 'Kitchen', 'Bedroom', 'Majlis', 'Nursery', 'Outdoor']);
        const MIN_COUNT = 3;
        const sorted = Object.entries(counts)
            .filter(([, n]) => n >= MIN_COUNT)
            .sort((a, b) => b[1] - a[1])
            .map(([k]) => k);
        res.setHeader('Cache-Control', 'public, max-age=3600');
        res.json({
            style: sorted.filter(t => !ROOM_SET.has(t)),
            room: sorted.filter(t => ROOM_SET.has(t)),
        });
    }
    catch (error) {
        console.error('getPortfolioTags error:', error);
        res.status(500).json({ error: 'Failed to load portfolio tags.' });
    }
}
async function getCompaniesByServiceCity(req, res) {
    try {
        res.setHeader('Cache-Control', 'public, max-age=3600');
        const service = typeof req.query.service === 'string' ? req.query.service.trim() : '';
        const city = typeof req.query.city === 'string' ? req.query.city.trim() : '';
        if (!service || !city) {
            return res.status(400).json({ error: 'service and city are required' });
        }
        if (service.length > 100 || city.length > 100) {
            return res.status(400).json({ error: 'service and city parameters are too long' });
        }
        // Escape SQL wildcard chars to prevent injection via LIKE patterns
        const safeService = service.toLowerCase().replace(/%/g, '\\%').replace(/_/g, '\\_');
        // Match directory companies (uae_companies) — services is a JSON array, use JSON_CONTAINS
        const [dirRows] = await database_1.default.query(`SELECT uc.slug, uc.name_en AS name, uc.city, uc.description,
              uc.weight_score, uc.portfolio_images, uc.logo_url,
              uc.owner_user_id, uc.is_signed, uc.is_certified
       FROM uae_companies uc
       WHERE uc.is_active = 1
         AND LOWER(uc.city) = LOWER(?)
         AND (
           JSON_CONTAINS(LOWER(uc.services), LOWER(JSON_QUOTE(?)), '$')
           OR LOWER(uc.services) LIKE ? ESCAPE '\\\\'
         )
       ORDER BY uc.weight_score DESC
       LIMIT 30`, [city, service, `%${safeService}%`]);
        // Match registered companies (company_profiles) — services is a JSON array, use JSON_CONTAINS
        const [regRows] = await database_1.default.query(`SELECT cp.slug, cp.company_name AS name, cp.city, cp.description, cp.company_type,
              cp.weight_score, cp.is_signed, cp.is_certified
       FROM company_profiles cp
       WHERE cp.status = 'approved'
         AND cp.deleted_at IS NULL
         AND LOWER(cp.city) = LOWER(?)
         AND (
           JSON_CONTAINS(LOWER(cp.services), LOWER(JSON_QUOTE(?)), '$')
           OR LOWER(cp.services) LIKE ? ESCAPE '\\\\'
         )
       ORDER BY cp.weight_score DESC
       LIMIT 30`, [city, service, `%${safeService}%`]);
        const dirMapped = (Array.isArray(dirRows) ? dirRows : []).map((r) => ({
            slug: r.slug,
            name: r.name,
            city: r.city,
            description: r.description,
            portfolio_images: r.portfolio_images,
            logo_url: r.logo_url,
            is_claimed: !!(r.owner_user_id),
            is_signed: !!(r.is_signed),
            is_certified: !!(r.is_certified),
            weight_score: r.weight_score,
        }));
        const regMapped = (Array.isArray(regRows) ? regRows : []).map((r) => ({
            slug: r.slug,
            name: r.name,
            city: r.city,
            description: r.description,
            portfolio_images: null,
            logo_url: null,
            is_claimed: true,
            is_signed: !!(r.is_signed),
            is_certified: !!(r.is_certified),
            weight_score: r.weight_score,
        }));
        // Combine, sort by weight_score, deduplicate by slug (dirRows take priority)
        const sorted = [...dirMapped, ...regMapped]
            .sort((a, b) => (b.weight_score || 0) - (a.weight_score || 0));
        const seen = new Set();
        const deduped = sorted.filter(c => {
            if (!c.slug || seen.has(c.slug))
                return false;
            seen.add(c.slug);
            return true;
        });
        // Strip internal ranking signal from response
        const companies = deduped.slice(0, 30).map(({ weight_score: _w, ...rest }) => rest);
        res.json({ companies, service, city });
    }
    catch (err) {
        console.error('getCompaniesByServiceCity error:', err);
        res.status(500).json({ error: 'server error' });
    }
}
