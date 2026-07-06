import type { MetadataRoute } from 'next';
import { headers } from 'next/headers';
import { getCountry } from '@/lib/country';

export const dynamic = 'force-dynamic';

const API_BASE = process.env.NEXT_PUBLIC_API_URL?.trim() ?? process.env.API_INTERNAL_URL?.trim() ?? 'http://localhost:3002/api';

// ── AE-only SEO landing content (VN 站对应路由走 notFound，故仅 AE 收录) ──
const GUIDE_SLUGS = [
  'renovation-cost-dubai',
  'best-interior-designers-dubai',
  'apartment-renovation-uae',
  'villa-renovation-dubai',
  'how-to-choose-interior-designer-uae',
];

const SERVICE_SLUGS = ['interior-design', 'renovation', 'kitchen-renovation', 'bathroom-renovation', 'villa-renovation', 'apartment-design', 'office-design', 'fit-out'];
const CITY_SLUGS = ['dubai', 'abu-dhabi', 'sharjah', 'ajman', 'ras-al-khaimah', 'fujairah'];
// slug → 后端 by-service-city 需要的城市 label
const CITY_LABELS: Record<string, string> = {
  'dubai': 'Dubai', 'abu-dhabi': 'Abu Dhabi', 'sharjah': 'Sharjah',
  'ajman': 'Ajman', 'ras-al-khaimah': 'Ras Al Khaimah', 'fujairah': 'Fujairah',
};

// country-aware fetch：把国家同时作为 query 与 x-country header 传给后端
// （后端各接口读法不一：companies/portfolio 读 query，articles 读 header）
async function fetchJson<T>(path: string, country: string): Promise<T | null> {
  try {
    const sep = path.includes('?') ? '&' : '?';
    const res = await fetch(`${API_BASE}${path}${sep}country=${country}`, {
      next: { revalidate: 3600 },
      headers: { 'Content-Type': 'application/json', 'x-country': country },
    });
    if (!res.ok) return null;
    return res.json() as Promise<T>;
  } catch {
    return null;
  }
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // 按子域名取国家配置：vn.tarmeer.com → VN，www.tarmeer.com → AE。
  // 加新国家只需在 country.ts 加项，本文件零改动。
  const c = getCountry((await headers()).get('x-country'));
  const BASE = c.baseUrl;
  const country = c.code;
  const isAe = country === 'ae';
  const now = new Date();

  // ── 通用静态页（AE + VN 都存在且可索引）──────────────────────
  const staticRoutes: MetadataRoute.Sitemap = [
    { url: `${BASE}/`, lastModified: now, changeFrequency: 'daily', priority: 1.0 },
    { url: `${BASE}/companies`, lastModified: now, changeFrequency: 'hourly', priority: 0.9 },
    { url: `${BASE}/portfolio`, lastModified: now, changeFrequency: 'daily', priority: 0.8 },
    { url: `${BASE}/experts`, lastModified: now, changeFrequency: 'daily', priority: 0.8 },
    { url: `${BASE}/blog`, lastModified: now, changeFrequency: 'daily', priority: 0.8 },
    { url: `${BASE}/insights`, lastModified: now, changeFrequency: 'weekly', priority: 0.8 },
    { url: `${BASE}/about`, lastModified: now, changeFrequency: 'monthly', priority: 0.6 },
    { url: `${BASE}/contact`, lastModified: now, changeFrequency: 'monthly', priority: 0.5 },
    { url: `${BASE}/for-homeowners`, lastModified: now, changeFrequency: 'monthly', priority: 0.6 },
    { url: `${BASE}/for-companies`, lastModified: now, changeFrequency: 'monthly', priority: 0.6 },
    { url: `${BASE}/faq`, lastModified: now, changeFrequency: 'monthly', priority: 0.5 },
    { url: `${BASE}/privacy`, lastModified: now, changeFrequency: 'yearly', priority: 0.3 },
  ];

  // ── AE-only 静态页（建材供应商功能 + 服务落地页为 AE 专属）──────
  if (isAe) {
    staticRoutes.push(
      { url: `${BASE}/materials`, lastModified: now, changeFrequency: 'weekly', priority: 0.7 },
      { url: `${BASE}/for-suppliers`, lastModified: now, changeFrequency: 'monthly', priority: 0.6 },
      { url: `${BASE}/services/soft-decoration`, lastModified: now, changeFrequency: 'monthly', priority: 0.6 },
      { url: `${BASE}/services/new-home-design`, lastModified: now, changeFrequency: 'monthly', priority: 0.6 },
      { url: `${BASE}/services/house-exterior`, lastModified: now, changeFrequency: 'monthly', priority: 0.6 },
    );
  }

  // ── 公司详情页（按国家）──────────────────────────────────────
  const companiesData = await fetchJson<{ companies: Array<{ id: number; slug?: string; updated_at?: string }> }>(
    '/companies?limit=500',
    country,
  );
  const companyRoutes: MetadataRoute.Sitemap = (companiesData?.companies ?? [])
    .filter((c) => c.id && c.slug)
    .map((c) => ({
      url: `${BASE}/companies/${c.slug}`,
      lastModified: c.updated_at ? new Date(c.updated_at) : now,
      changeFrequency: 'weekly' as const,
      priority: 0.8,
    }));

  // ── 专家详情页（按国家）──────────────────────────────────────
  const expertsData = await fetchJson<{ experts: Array<{ slug?: string; updated_at?: string }> }>(
    '/experts?limit=500',
    country,
  );
  const expertRoutes: MetadataRoute.Sitemap = (expertsData?.experts ?? [])
    .filter((e) => e.slug)
    .map((e) => ({
      url: `${BASE}/experts/${e.slug}`,
      lastModified: e.updated_at ? new Date(e.updated_at) : now,
      changeFrequency: 'weekly' as const,
      priority: 0.7,
    }));

  // ── 博客文章（按国家）────────────────────────────────────────
  const articlesData = await fetchJson<{ articles: Array<{ slug: string; updated_at?: string }> }>(
    '/articles/public?page=1&limit=200',
    country,
  );
  const blogRoutes: MetadataRoute.Sitemap = (articlesData?.articles ?? [])
    .filter((a) => a.slug)
    .map((a) => ({
      url: `${BASE}/blog/${a.slug}`,
      lastModified: a.updated_at ? new Date(a.updated_at) : now,
      changeFrequency: 'monthly' as const,
      priority: 0.6,
    }));

  // ── 指南详情页（按国家）─ /insights/[slug] ──────────────────
  const guidesData = await fetchJson<{ guides: Array<{ slug: string; published_at?: string }> }>(
    '/guides/public?page=1&limit=200',
    country,
  );
  const insightRoutes: MetadataRoute.Sitemap = (guidesData?.guides ?? [])
    .filter((g) => g.slug)
    .map((g) => ({
      url: `${BASE}/insights/${g.slug}`,
      lastModified: g.published_at ? new Date(g.published_at) : now,
      changeFrequency: 'monthly' as const,
      priority: 0.7,
    }));

  // ── 项目详情页（按国家）──────────────────────────────────────
  const projectRoutes: MetadataRoute.Sitemap = [];
  try {
    let page = 1;
    while (true) {
      const batch = await fetchJson<{
        projects: Array<{ slug: string; companySlug: string; updated_at?: string }>;
        pagination: { total: number };
      }>(`/companies/portfolio?page=${page}&limit=100`, country);
      if (!batch?.projects?.length) break;
      for (const p of batch.projects) {
        if (p.companySlug && p.slug) {
          projectRoutes.push({
            url: `${BASE}/companies/${p.companySlug}/${p.slug}`,
            lastModified: p.updated_at ? new Date(p.updated_at) : now,
            changeFrequency: 'monthly' as const,
            priority: 0.7,
          });
        }
      }
      if (projectRoutes.length >= (batch.pagination?.total ?? 0)) break;
      page++;
    }
  } catch { /* skip */ }

  // ── AE-only 动态/SEO 内容 ────────────────────────────────────
  let supplierRoutes: MetadataRoute.Sitemap = [];
  let guideRoutes: MetadataRoute.Sitemap = [];
  let serviceCityRoutes: MetadataRoute.Sitemap = [];

  if (isAe) {
    // 建材供应商详情页（AE 专属功能）
    const suppliersData = await fetchJson<{ suppliers: Array<{ slug: string; updated_at?: string }> }>(
      '/suppliers?limit=200',
      country,
    );
    supplierRoutes = (suppliersData?.suppliers ?? [])
      .filter((s) => s.slug)
      .map((s) => ({
        url: `${BASE}/materials/suppliers/${s.slug}`,
        lastModified: s.updated_at ? new Date(s.updated_at) : now,
        changeFrequency: 'monthly' as const,
        priority: 0.5,
      }));

    // 迪拜专属装修指南
    guideRoutes = GUIDE_SLUGS.map((slug) => ({
      url: `${BASE}/guide/${slug}`,
      lastModified: new Date('2026-05-28'),
      changeFrequency: 'monthly' as const,
      priority: 0.7,
    }));

    // 服务 × 城市落地页：只收录「有公司」的组合。空组合页走 noindex（见页面 generateMetadata），
    // 不进 sitemap，避免 GSC 报「提交了 noindex URL」。有公司后自动进 sitemap。
    const combos = SERVICE_SLUGS.flatMap((service) => CITY_SLUGS.map((city) => ({ service, city })));
    const coverage = await Promise.all(
      combos.map(async ({ service, city }) => {
        const data = await fetchJson<{ companies?: unknown[] }>(
          `/companies/by-service-city?service=${service}&city=${encodeURIComponent(CITY_LABELS[city] ?? city)}`,
          country,
        );
        return { service, city, has: (data?.companies?.length ?? 0) > 0 };
      }),
    );
    serviceCityRoutes = coverage
      .filter((x) => x.has)
      .map(({ service, city }) => ({
        url: `${BASE}/services/${service}/${city}`,
        lastModified: now,
        changeFrequency: 'weekly' as const,
        priority: 0.7,
      }));
  }

  return [
    ...staticRoutes,
    ...guideRoutes,
    ...serviceCityRoutes,
    ...companyRoutes,
    ...expertRoutes,
    ...projectRoutes,
    ...blogRoutes,
    ...insightRoutes,
    ...supplierRoutes,
  ];
}
