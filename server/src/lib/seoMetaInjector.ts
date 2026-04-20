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

import pool from '../config/database';

const BASE_URL = 'https://www.tarmeer.com';
const SITE_NAME = 'Tarmeer';
const DEFAULT_IMAGE = `${BASE_URL}/images/og-default.jpg`;

interface PageMeta {
  title: string;
  description: string;
  canonical: string;
  ogImage: string;
  jsonLd?: Record<string, unknown>;
}

function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export async function getPageMeta(pathname: string): Promise<PageMeta | null> {
  // Static pages
  const staticMeta: Record<string, PageMeta> = {
    '/': {
      title: 'Tarmeer | Interior Design & Build — UAE',
      description: 'Find top renovation companies in UAE. Browse portfolios, compare services, and get quotes.',
      canonical: BASE_URL,
      ogImage: DEFAULT_IMAGE,
    },
    '/companies': {
      title: 'Renovation Companies in UAE | Tarmeer',
      description: 'Browse 100+ renovation and interior design companies across UAE. Compare portfolios, services, and reviews.',
      canonical: `${BASE_URL}/companies`,
      ogImage: DEFAULT_IMAGE,
    },
    '/portfolio': {
      title: 'Interior Design Portfolio | Tarmeer',
      description: 'Explore stunning interior design projects from top UAE companies. Residential, commercial, hospitality.',
      canonical: `${BASE_URL}/portfolio`,
      ogImage: DEFAULT_IMAGE,
    },
    '/faq': {
      title: 'FAQ — Tarmeer',
      description: 'Frequently asked questions about interior design and renovation in UAE.',
      canonical: `${BASE_URL}/faq`,
      ogImage: DEFAULT_IMAGE,
    },
    '/contact': {
      title: 'Contact Us — Tarmeer',
      description: 'Get in touch with the Tarmeer team for renovation inquiries.',
      canonical: `${BASE_URL}/contact`,
      ogImage: DEFAULT_IMAGE,
    },
    '/blog': {
      title: 'Interior Design Blog | Tarmeer',
      description: 'Tips, trends, and insights on interior design and renovation in UAE.',
      canonical: `${BASE_URL}/blog`,
      ogImage: DEFAULT_IMAGE,
    },
    '/for-companies': {
      title: 'Join Tarmeer — Get More Clients in UAE',
      description: 'Free company page, GEO & SEO optimization, smart photo tagging — all included.',
      canonical: `${BASE_URL}/for-companies`,
      ogImage: DEFAULT_IMAGE,
    },
  };

  if (staticMeta[pathname]) return staticMeta[pathname];

  // Company detail: /companies/:slug
  const companyMatch = pathname.match(/^\/companies\/([a-z0-9-]+)$/);
  if (companyMatch) {
    const slug = companyMatch[1];
    // Try uae_companies
    const [rows] = await pool.execute(
      'SELECT name_en, description, city, logo_url FROM uae_companies WHERE slug = ? AND is_active = 1 LIMIT 1',
      [slug]
    );
    let company = (rows as any[])[0];
    if (!company) {
      // Try company_profiles
      const [cpRows] = await pool.execute(
        "SELECT company_name AS name_en, description, city, logo_url FROM company_profiles WHERE slug = ? AND status = 'approved' AND deleted_at IS NULL LIMIT 1",
        [slug]
      );
      company = (cpRows as any[])[0];
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
  }

  // Project detail: /companies/:companySlug/:projectSlug
  const projectMatch = pathname.match(/^\/companies\/([a-z0-9-]+)\/([a-z0-9-]+)$/);
  if (projectMatch) {
    const [companySlug, projectSlug] = [projectMatch[1], projectMatch[2]];
    // Look up project
    const [rows] = await pool.execute(
      `SELECT p.title, p.description, p.style, p.location, p.images,
              cp.company_name, cp.slug AS company_slug
       FROM projects p
       JOIN company_profiles cp ON p.company_profile_id = cp.id
       WHERE cp.slug = ? AND p.slug = ? AND p.status = 'published' AND p.deleted_at IS NULL AND cp.deleted_at IS NULL
       LIMIT 1`,
      [companySlug, projectSlug]
    );
    const proj = (rows as any[])[0];
    if (proj) {
      const title = proj.title || 'Project';
      const company = proj.company_name || companySlug;
      const desc = (proj.description || '').slice(0, 160) || `${title} by ${company}`;
      let image = DEFAULT_IMAGE;
      try {
        const images = typeof proj.images === 'string' ? JSON.parse(proj.images) : proj.images;
        const firstImg = Array.isArray(images) ? (typeof images[0] === 'string' ? images[0] : images[0]?.url) : null;
        if (firstImg) image = firstImg.startsWith('http') ? firstImg : `${BASE_URL}${firstImg}`;
      } catch { /* use default */ }
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

  return null;
}

export function injectMeta(html: string, meta: PageMeta): string {
  const title = escapeHtml(meta.title);
  const desc = escapeHtml(meta.description);
  const canonical = escapeHtml(meta.canonical);
  const ogImage = escapeHtml(meta.ogImage);

  let result = html;

  // Replace title
  result = result.replace(/<title>[^<]*<\/title>/, `<title>${title}</title>`);

  // Replace canonical
  result = result.replace(
    /<link rel="canonical"[^>]*>/,
    `<link rel="canonical" href="${canonical}" />`
  );

  // Replace og tags
  result = result.replace(/(<meta property="og:title" content=")[^"]*(")/,  `$1${title}$2`);
  result = result.replace(/(<meta property="og:description" content=")[^"]*(")/,  `$1${desc}$2`);
  result = result.replace(/(<meta property="og:url" content=")[^"]*(")/,  `$1${canonical}$2`);
  result = result.replace(/(<meta property="og:image" content=")[^"]*(")/,  `$1${ogImage}$2`);
  result = result.replace(/(<meta name="description" content=")[^"]*(")/,  `$1${desc}$2`);

  // Inject JSON-LD if present
  if (meta.jsonLd) {
    const jsonLd = `<script type="application/ld+json">${JSON.stringify(meta.jsonLd)}</script>`;
    result = result.replace('</head>', `${jsonLd}\n</head>`);
  }

  return result;
}
