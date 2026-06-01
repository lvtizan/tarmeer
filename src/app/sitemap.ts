import type { MetadataRoute } from 'next';

export const dynamic = 'force-dynamic';

const BASE = 'https://www.tarmeer.com';
const API_BASE = process.env.NEXT_PUBLIC_API_URL?.trim() ?? process.env.API_INTERNAL_URL?.trim() ?? '/api';

const GUIDE_SLUGS = [
  'renovation-cost-dubai',
  'best-interior-designers-dubai',
  'apartment-renovation-uae',
  'villa-renovation-dubai',
  'how-to-choose-interior-designer-uae',
];

const SERVICE_SLUGS = ['interior-design', 'renovation', 'kitchen-renovation', 'bathroom-renovation', 'villa-renovation', 'apartment-design', 'office-design', 'fit-out'];
const CITY_SLUGS = ['dubai', 'abu-dhabi', 'sharjah', 'ajman', 'ras-al-khaimah', 'fujairah'];

async function fetchJson<T>(path: string): Promise<T | null> {
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      next: { revalidate: 3600 },
      headers: { 'Content-Type': 'application/json' },
    });
    if (!res.ok) return null;
    return res.json() as Promise<T>;
  } catch {
    return null;
  }
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();

  // ── Static pages ──────────────────────────────────────────────
  const staticRoutes: MetadataRoute.Sitemap = [
    { url: `${BASE}/`, lastModified: now, changeFrequency: 'daily', priority: 1.0 },
    { url: `${BASE}/companies`, lastModified: now, changeFrequency: 'hourly', priority: 0.9 },
    { url: `${BASE}/portfolio`, lastModified: now, changeFrequency: 'daily', priority: 0.8 },
    { url: `${BASE}/blog`, lastModified: now, changeFrequency: 'daily', priority: 0.8 },
    { url: `${BASE}/materials`, lastModified: now, changeFrequency: 'weekly', priority: 0.7 },
    { url: `${BASE}/for-companies`, lastModified: now, changeFrequency: 'monthly', priority: 0.6 },
    { url: `${BASE}/faq`, lastModified: now, changeFrequency: 'monthly', priority: 0.5 },
    { url: `${BASE}/privacy`, lastModified: now, changeFrequency: 'yearly', priority: 0.3 },
  ];

  // ── Company pages ─────────────────────────────────────────────
  const companiesData = await fetchJson<{ companies: Array<{ id: number; slug?: string; updated_at?: string }> }>(
    '/companies?limit=500'
  );
  const companyRoutes: MetadataRoute.Sitemap = (companiesData?.companies ?? [])
    .filter((c) => c.id)
    .map((c) => ({
      url: `${BASE}/companies/${c.slug ?? c.id}`,
      lastModified: c.updated_at ? new Date(c.updated_at) : now,
      changeFrequency: 'weekly' as const,
      priority: 0.8,
    }));

  // ── Blog posts ────────────────────────────────────────────────
  const articlesData = await fetchJson<{ articles: Array<{ slug: string; updated_at?: string }> }>(
    '/articles/public?page=1&limit=200'
  );
  const blogRoutes: MetadataRoute.Sitemap = (articlesData?.articles ?? [])
    .filter((a) => a.slug)
    .map((a) => ({
      url: `${BASE}/blog/${a.slug}`,
      lastModified: a.updated_at ? new Date(a.updated_at) : now,
      changeFrequency: 'monthly' as const,
      priority: 0.6,
    }));

  // ── Material supplier pages ───────────────────────────────────
  const suppliersData = await fetchJson<{ suppliers: Array<{ slug: string; updated_at?: string }> }>(
    '/suppliers/public?limit=200'
  );
  const supplierRoutes: MetadataRoute.Sitemap = (suppliersData?.suppliers ?? [])
    .filter((s) => s.slug)
    .map((s) => ({
      url: `${BASE}/materials/suppliers/${s.slug}`,
      lastModified: s.updated_at ? new Date(s.updated_at) : now,
      changeFrequency: 'monthly' as const,
      priority: 0.5,
    }));

  // ── Guide pages ───────────────────────────────────────────────
  const guideRoutes: MetadataRoute.Sitemap = GUIDE_SLUGS.map((slug) => ({
    url: `${BASE}/guide/${slug}`,
    lastModified: new Date('2026-05-28'),
    changeFrequency: 'monthly' as const,
    priority: 0.7,
  }));

  // ── Service/city landing pages ────────────────────────────────
  const serviceCityRoutes: MetadataRoute.Sitemap = SERVICE_SLUGS.flatMap((service) =>
    CITY_SLUGS.map((city) => ({
      url: `${BASE}/services/${service}/${city}`,
      lastModified: now,
      changeFrequency: 'weekly' as const,
      priority: 0.7,
    }))
  );

  return [...staticRoutes, ...guideRoutes, ...serviceCityRoutes, ...companyRoutes, ...blogRoutes, ...supplierRoutes];
}
