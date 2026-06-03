"use strict";
/**
 * SEO Meta Injector
 *
 * For search engine bots (Googlebot, Bingbot, etc.), replaces the default
 * SPA index.html meta tags with page-specific title, description, canonical,
 * og:title, og:description, og:image, and JSON-LD structured data.
 *
 * This is NOT SSR — the page content is still rendered client-side.
 * We only inject correct <head> meta so crawlers get unique signals per page.
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getPageMeta = getPageMeta;
exports.injectMeta = injectMeta;
const database_1 = __importDefault(require("../config/database"));
const BASE_URL = 'https://www.tarmeer.com';
const SITE_NAME = 'Tarmeer';
const DEFAULT_IMAGE = `${BASE_URL}/images/og-default.jpg`;
function escapeHtml(str) {
    return str.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
async function getPageMeta(pathname) {
    // Static pages
    const staticMeta = {
        '/': {
            title: 'Tarmeer | Interior Design & Build — UAE',
            description: 'Find top renovation companies in UAE. Browse portfolios, compare services, and get quotes.',
            canonical: BASE_URL,
            ogImage: DEFAULT_IMAGE,
            jsonLd: {
                '@context': 'https://schema.org',
                '@type': 'WebSite',
                name: SITE_NAME,
                url: `${BASE_URL}/`,
                potentialAction: {
                    '@type': 'SearchAction',
                    target: `${BASE_URL}/companies?search={search_term_string}`,
                    'query-input': 'required name=search_term_string',
                },
            },
        },
        '/companies': {
            title: 'Renovation Companies in UAE | Tarmeer',
            description: 'Browse 100+ renovation and interior design companies across UAE. Compare portfolios, services, and reviews.',
            canonical: `${BASE_URL}/companies`,
            ogImage: DEFAULT_IMAGE,
            jsonLd: {
                '@context': 'https://schema.org',
                '@type': 'CollectionPage',
                name: 'Renovation Companies in UAE',
                url: `${BASE_URL}/companies`,
                description: 'Browse renovation and interior design companies across the UAE.',
            },
        },
        '/portfolio': {
            title: 'Interior Design Portfolio | Tarmeer',
            description: 'Explore stunning interior design projects from top UAE companies. Residential, commercial, hospitality.',
            canonical: `${BASE_URL}/portfolio`,
            ogImage: DEFAULT_IMAGE,
            jsonLd: {
                '@context': 'https://schema.org',
                '@type': 'CollectionPage',
                name: 'Interior Design Portfolio',
                url: `${BASE_URL}/portfolio`,
                description: 'Interior design and renovation project inspiration from UAE companies.',
            },
        },
        '/faq': {
            title: 'FAQ — Tarmeer',
            description: 'Frequently asked questions about interior design and renovation in UAE.',
            canonical: `${BASE_URL}/faq`,
            ogImage: DEFAULT_IMAGE,
            jsonLd: {
                '@context': 'https://schema.org',
                '@type': 'FAQPage',
                mainEntity: [
                    {
                        '@type': 'Question',
                        name: 'How does Tarmeer help homeowners in the UAE?',
                        acceptedAnswer: {
                            '@type': 'Answer',
                            text: 'Tarmeer helps homeowners browse portfolios, compare renovation companies, and send project inquiries to relevant providers in the UAE.',
                        },
                    },
                    {
                        '@type': 'Question',
                        name: 'Can companies and suppliers join Tarmeer?',
                        acceptedAnswer: {
                            '@type': 'Answer',
                            text: 'Approved renovation companies and material suppliers can create profiles, publish work, and receive relevant inquiries through Tarmeer.',
                        },
                    },
                ],
            },
        },
        '/contact': {
            title: 'Contact Us — Tarmeer',
            description: 'Get in touch with the Tarmeer team for renovation inquiries.',
            canonical: `${BASE_URL}/contact`,
            ogImage: DEFAULT_IMAGE,
            jsonLd: {
                '@context': 'https://schema.org',
                '@type': 'ContactPage',
                name: 'Contact Tarmeer',
                url: `${BASE_URL}/contact`,
                mainEntity: { '@type': 'Organization', name: SITE_NAME, url: BASE_URL },
            },
        },
        '/blog': {
            title: 'Interior Design Blog | Tarmeer',
            description: 'Tips, trends, and insights on interior design and renovation in UAE.',
            canonical: `${BASE_URL}/blog`,
            ogImage: DEFAULT_IMAGE,
            jsonLd: {
                '@context': 'https://schema.org',
                '@type': 'CollectionPage',
                name: 'Interior Design Blog',
                url: `${BASE_URL}/blog`,
                description: 'Interior design and renovation articles for UAE homeowners and companies.',
            },
        },
        '/for-companies': {
            title: 'Join Tarmeer — Get More Clients in UAE',
            description: 'Create a company page with GEO and SEO optimization, smart photo tagging, and portfolio discovery on Tarmeer.',
            canonical: `${BASE_URL}/for-companies`,
            ogImage: DEFAULT_IMAGE,
            jsonLd: {
                '@context': 'https://schema.org',
                '@type': 'WebPage',
                name: 'Join Tarmeer for Companies',
                url: `${BASE_URL}/for-companies`,
                description: 'Tarmeer helps UAE renovation and design companies publish profiles, portfolios, and service pages for customer discovery.',
            },
        },
        '/for-homeowners': {
            title: 'Find Renovation Companies in UAE | Tarmeer',
            description: 'Compare verified renovation companies, browse real portfolios, and send your project inquiry through Tarmeer.',
            canonical: `${BASE_URL}/for-homeowners`,
            ogImage: DEFAULT_IMAGE,
            jsonLd: {
                '@context': 'https://schema.org',
                '@type': 'WebPage',
                name: 'Tarmeer for Homeowners',
                url: `${BASE_URL}/for-homeowners`,
                description: 'Compare UAE renovation companies and start a home renovation inquiry with Tarmeer.',
            },
        },
        '/for-suppliers': {
            title: 'List Your Showroom on Tarmeer — Supplier Portal',
            description: 'List your furniture, stone, lighting, or materials showroom on Tarmeer and get discovered by interior designers across UAE.',
            canonical: `${BASE_URL}/for-suppliers`,
            ogImage: DEFAULT_IMAGE,
            jsonLd: {
                '@context': 'https://schema.org',
                '@type': 'WebPage',
                name: 'Tarmeer Supplier Portal',
                url: `${BASE_URL}/for-suppliers`,
                description: 'Material suppliers can list products, catalogs, and showroom information for UAE design firms on Tarmeer.',
            },
        },
        '/start': {
            title: 'How to Start a Renovation Project in UAE | Tarmeer',
            description: 'A step-by-step guide for homeowners starting a renovation or interior design project with Tarmeer in the UAE.',
            canonical: `${BASE_URL}/start`,
            ogImage: DEFAULT_IMAGE,
            jsonLd: {
                '@context': 'https://schema.org',
                '@type': 'HowTo',
                name: 'How to start a renovation project with Tarmeer',
                description: 'A practical guide for homeowners planning renovation and design work in the UAE.',
            },
        },
        '/start-suppliers': {
            title: 'How to Get Started as a Supplier on Tarmeer | Material Supplier Onboarding',
            description: 'Step-by-step guide for material suppliers joining Tarmeer UAE. List products and catalogs, get matched to design firms, and receive verified inquiries.',
            canonical: `${BASE_URL}/start-suppliers`,
            ogImage: DEFAULT_IMAGE,
            jsonLd: {
                '@context': 'https://schema.org',
                '@type': 'HowTo',
                name: 'How to join Tarmeer as a material supplier',
                description: 'Step-by-step onboarding guide for material suppliers joining Tarmeer UAE.',
            },
        },
        '/materials': {
            title: 'Material Suppliers in UAE — Furniture, Stone, Lighting | Tarmeer',
            description: 'Browse verified building material suppliers from China and Dubai. Furniture, marble, lighting, flooring and more for UAE renovation projects.',
            canonical: `${BASE_URL}/materials`,
            ogImage: DEFAULT_IMAGE,
            jsonLd: {
                '@context': 'https://schema.org',
                '@type': 'CollectionPage',
                name: 'Material Suppliers in UAE',
                url: `${BASE_URL}/materials`,
                description: 'Browse furniture, stone, lighting, flooring, and building material suppliers for UAE renovation projects.',
            },
        },
        '/services/new-home-design': {
            title: 'New Home Design Service - Floor Plans & 3D Renderings | Tarmeer',
            description: 'Explore Tarmeer new home design packages with floor plans, visuals, construction drawings, and UAE renovation company matching.',
            canonical: `${BASE_URL}/services/new-home-design`,
            ogImage: DEFAULT_IMAGE,
            jsonLd: {
                '@context': 'https://schema.org',
                '@type': 'Service',
                name: 'New Home Design Service',
                provider: { '@type': 'Organization', name: SITE_NAME, url: BASE_URL },
                areaServed: { '@type': 'Country', name: 'United Arab Emirates' },
            },
        },
        '/services/soft-decoration': {
            title: 'Soft Decoration & Furniture Design Service | Tarmeer',
            description: 'Explore soft decoration, furniture selection, and interior styling services for villas, apartments, and family homes in the UAE.',
            canonical: `${BASE_URL}/services/soft-decoration`,
            ogImage: DEFAULT_IMAGE,
            jsonLd: {
                '@context': 'https://schema.org',
                '@type': 'Service',
                name: 'Soft Decoration Design Service',
                provider: { '@type': 'Organization', name: SITE_NAME, url: BASE_URL },
                areaServed: { '@type': 'Country', name: 'United Arab Emirates' },
            },
        },
        '/services/house-exterior': {
            title: 'House Exterior Design Service - Facade & Landscape | Tarmeer',
            description: 'Explore exterior design services for UAE villas and standalone homes, including facade direction and landscape-ready documentation.',
            canonical: `${BASE_URL}/services/house-exterior`,
            ogImage: DEFAULT_IMAGE,
            jsonLd: {
                '@context': 'https://schema.org',
                '@type': 'Service',
                name: 'House Exterior Design Service',
                provider: { '@type': 'Organization', name: SITE_NAME, url: BASE_URL },
                areaServed: { '@type': 'Country', name: 'United Arab Emirates' },
            },
        },
        '/privacy': {
            title: 'Privacy Policy | Tarmeer',
            description: 'Tarmeer privacy policy covering personal data, cookies, contact information, and service inquiry data.',
            canonical: `${BASE_URL}/privacy`,
            ogImage: DEFAULT_IMAGE,
            jsonLd: {
                '@context': 'https://schema.org',
                '@type': 'WebPage',
                name: 'Privacy Policy',
                url: `${BASE_URL}/privacy`,
            },
        },
    };
    if (staticMeta[pathname])
        return staticMeta[pathname];
    // Company detail: /companies/:slug
    const companyMatch = pathname.match(/^\/companies\/([a-z0-9-]+)$/);
    if (companyMatch) {
        const slug = companyMatch[1];
        // Try uae_companies — active/published first
        const [rows] = await database_1.default.execute('SELECT name_en, description, city, logo_url FROM uae_companies WHERE slug = ? AND is_active = 1 AND is_published = 1 LIMIT 1', [slug]);
        let company = rows[0];
        if (!company) {
            // Try company_profiles (registered companies)
            const [cpRows] = await database_1.default.execute("SELECT company_name AS name_en, description, city, logo_url FROM company_profiles WHERE slug = ? AND status = 'approved' AND deleted_at IS NULL LIMIT 1", [slug]);
            company = cpRows[0];
        }
        if (company) {
            const name = company.name_en || slug;
            const desc = (company.description || '').slice(0, 160) || `${name} — Interior design and renovation company in ${company.city || 'UAE'}`;
            const image = company.logo_url ? `${BASE_URL}${company.logo_url}` : DEFAULT_IMAGE;
            return {
                title: `${name} | Tarmeer`,
                description: desc,
                canonical: `${BASE_URL}/companies/${slug}`,
                ogImage: image,
                jsonLd: {
                    '@context': 'https://schema.org',
                    '@type': 'LocalBusiness',
                    name,
                    description: desc,
                    url: `${BASE_URL}/companies/${slug}`,
                    image,
                    address: { '@type': 'PostalAddress', addressLocality: company.city || 'UAE', addressCountry: 'AE' },
                },
            };
        }
        // Company slug exists but is taken down (inactive/unpublished in uae_companies, or
        // deleted/rejected in company_profiles) — signal 410 Gone to caller
        const [hiddenUaeRows] = await database_1.default.execute('SELECT id FROM uae_companies WHERE slug = ? AND (is_active = 0 OR is_published = 0) LIMIT 1', [slug]);
        if (hiddenUaeRows.length > 0) {
            return {
                title: 'Page Removed | Tarmeer',
                description: 'This company page has been removed.',
                canonical: `${BASE_URL}/`,
                ogImage: DEFAULT_IMAGE,
                robots: 'noindex',
                gone: true,
            };
        }
        const [deletedCpRows] = await database_1.default.execute('SELECT id FROM company_profiles WHERE slug = ? AND (deleted_at IS NOT NULL OR status = ?) LIMIT 1', [slug, 'rejected']);
        if (deletedCpRows.length > 0) {
            return {
                title: 'Page Removed | Tarmeer',
                description: 'This company page has been removed.',
                canonical: `${BASE_URL}/`,
                ogImage: DEFAULT_IMAGE,
                robots: 'noindex',
                gone: true,
            };
        }
    }
    // Project detail: /companies/:companySlug/:projectSlug
    const projectMatch = pathname.match(/^\/companies\/([a-z0-9-]+)\/([a-z0-9-]+)$/);
    if (projectMatch) {
        const [companySlug, projectSlug] = [projectMatch[1], projectMatch[2]];
        // Look up project
        const [rows] = await database_1.default.execute(`SELECT p.title, p.description, p.style, p.location, p.images,
              cp.company_name, cp.slug AS company_slug
       FROM projects p
       JOIN company_profiles cp ON p.company_profile_id = cp.id
       WHERE cp.slug = ? AND p.slug = ? AND p.status = 'published' AND p.deleted_at IS NULL AND cp.deleted_at IS NULL
       LIMIT 1`, [companySlug, projectSlug]);
        const proj = rows[0];
        if (proj) {
            const title = proj.title || 'Project';
            const company = proj.company_name || companySlug;
            const desc = (proj.description || '').slice(0, 160) || `${title} by ${company}`;
            let image = DEFAULT_IMAGE;
            try {
                const images = typeof proj.images === 'string' ? JSON.parse(proj.images) : proj.images;
                const firstImg = Array.isArray(images) ? (typeof images[0] === 'string' ? images[0] : images[0]?.url) : null;
                if (firstImg)
                    image = firstImg.startsWith('http') ? firstImg : `${BASE_URL}${firstImg}`;
            }
            catch { /* use default */ }
            return {
                title: `${title} — ${company} | Tarmeer`,
                description: desc,
                canonical: `${BASE_URL}/companies/${companySlug}/${projectSlug}`,
                ogImage: image,
                jsonLd: {
                    '@context': 'https://schema.org',
                    '@type': 'CreativeWork',
                    name: title,
                    description: desc,
                    url: `${BASE_URL}/companies/${companySlug}/${projectSlug}`,
                    image,
                    author: { '@type': 'Organization', name: company },
                },
            };
        }
    }
    // Supplier detail: /materials/suppliers/:slug
    const supplierMatch = pathname.match(/^\/materials\/suppliers\/([a-z0-9-]+)$/);
    if (supplierMatch) {
        const slug = supplierMatch[1];
        const [rows] = await database_1.default.execute("SELECT company_name, description, logo_url, origin, store_address, has_physical_store FROM supplier_profiles WHERE slug = ? AND status IN ('approved', 'active') LIMIT 1", [slug]);
        const sup = rows[0];
        if (sup) {
            const name = sup.company_name || slug;
            const desc = (sup.description || '').slice(0, 160) || `${name} — building material supplier in UAE`;
            const image = sup.logo_url ? `${BASE_URL}${sup.logo_url}` : DEFAULT_IMAGE;
            return {
                title: `${name} — Material Supplier UAE | Tarmeer`,
                description: desc,
                canonical: `${BASE_URL}/materials/suppliers/${slug}`,
                ogImage: image,
                jsonLd: {
                    '@context': 'https://schema.org',
                    '@type': sup.has_physical_store ? 'LocalBusiness' : 'Organization',
                    name,
                    description: desc,
                    url: `${BASE_URL}/materials/suppliers/${slug}`,
                    image,
                    ...(sup.store_address && {
                        address: { '@type': 'PostalAddress', streetAddress: sup.store_address, addressCountry: 'AE' },
                    }),
                },
            };
        }
    }
    return null;
}
function injectMeta(html, meta) {
    const title = escapeHtml(meta.title);
    const desc = escapeHtml(meta.description);
    const canonical = escapeHtml(meta.canonical);
    const ogImage = escapeHtml(meta.ogImage);
    const robots = escapeHtml(meta.robots || 'index,follow,max-image-preview:large');
    let result = html;
    const upsertHeadTag = (pattern, tag) => {
        if (pattern.test(result)) {
            result = result.replace(pattern, tag);
            return;
        }
        result = result.replace('</head>', `  ${tag}\n</head>`);
    };
    // Replace or insert crawler-visible head tags.
    upsertHeadTag(/<title>[^<]*<\/title>/, `<title>${title}</title>`);
    upsertHeadTag(/<meta name="description"[^>]*>/, `<meta name="description" content="${desc}" />`);
    upsertHeadTag(/<meta name="robots"[^>]*>/, `<meta name="robots" content="${robots}" />`);
    upsertHeadTag(/<link rel="canonical"[^>]*>/, `<link rel="canonical" href="${canonical}" />`);
    upsertHeadTag(/<meta property="og:title"[^>]*>/, `<meta property="og:title" content="${title}" />`);
    upsertHeadTag(/<meta property="og:description"[^>]*>/, `<meta property="og:description" content="${desc}" />`);
    upsertHeadTag(/<meta property="og:url"[^>]*>/, `<meta property="og:url" content="${canonical}" />`);
    upsertHeadTag(/<meta property="og:image"[^>]*>/, `<meta property="og:image" content="${ogImage}" />`);
    upsertHeadTag(/<meta name="twitter:title"[^>]*>/, `<meta name="twitter:title" content="${title}" />`);
    upsertHeadTag(/<meta name="twitter:description"[^>]*>/, `<meta name="twitter:description" content="${desc}" />`);
    upsertHeadTag(/<meta name="twitter:image"[^>]*>/, `<meta name="twitter:image" content="${ogImage}" />`);
    // Inject JSON-LD if present
    if (meta.jsonLd) {
        const jsonLd = `<script type="application/ld+json">${JSON.stringify(meta.jsonLd)}</script>`;
        result = result.replace('</head>', `${jsonLd}\n</head>`);
    }
    return result;
}
