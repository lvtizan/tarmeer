// 「Classic Home」— 旧 AE 首页完整保留（materials-revamp 合并 M3）。
// 背景：M4 会把 AE `/` 切换为新材料叙事首页；用户要求旧首页不删，保留在 /classic。
// 组成与数据获取 1:1 复刻自切换前的 src/app/page.tsx AE 分支：
//   Banner → HomeDesignSection(companies) → HomeSpaceSection → HomeSupplierSection(suppliers) → HomeInsightsSection(guides)
// 国家门禁：AE 专属，非 AE 站 metadata 与页面体统一 notFound()（VN 的 `/` 本就是这套内容，禁软 404）。
// SEO：self-canonical /classic + 独立 title（避免与 `/`、/companies 竞争）；WebSite JSON-LD 属于 `/`，此页不发。

import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import Banner from '@/components/home/Banner';
import HomeDesignSection from '@/components/home/HomeDesignSection';
import HomeSpaceSection from '@/components/home/HomeSpaceSection';
import HomeSupplierSection from '@/components/home/HomeSupplierSection';
import HomeInsightsSection from '@/components/home/HomeInsightsSection';
import { fetchPublicCompanies, fetchGuides } from '@/lib/publicApi';
import { getCountry } from '@/lib/country';

export const dynamic = 'force-dynamic';

const PAGE_PATH = '/classic';

export async function generateMetadata(): Promise<Metadata> {
  const c = getCountry((await headers()).get('x-country'));
  // AE 专属路由：非 AE 站 metadata 与页面体同口径 notFound（全站新页面统一写法）
  if (c.code !== 'ae') notFound();
  const cityList = c.cities.slice(0, 2).join(', ');
  const canonical = `${c.baseUrl}${PAGE_PATH}`;
  const title = `Find Interior Design & Renovation Companies in the UAE | Tarmeer`;
  const description =
    `Connect with top interior designers, renovation companies, and fit-out professionals across ${cityList}, and ${c.name}. Browse portfolios, compare services, get personalized quotes.`;
  return {
    title,
    description,
    robots: { index: true, follow: true },
    alternates: { canonical },
    openGraph: {
      title,
      description: `Connect with top interior designers and renovation companies in ${c.name}.`,
      url: canonical,
      images: [{ url: `${c.baseUrl}/images/hero/hero-living-1.jpg`, width: 1200, height: 630 }],
    },
    keywords:
      `interior design ${c.name}, renovation companies ${c.cities[0]}, fit-out ${c.cities[1] ?? c.defaultCity}, interior designer, home renovation, Tarmeer, villa design, apartment renovation`,
  };
}

interface Supplier {
  id: number;
  company_name: string;
  slug: string;
  description: string;
  cover_image_url: string | null;
  logo_url: string | null;
  origin: 'china' | 'dubai';
}

async function fetchSuppliers(): Promise<Supplier[]> {
  const API_BASE = process.env.NEXT_PUBLIC_API_URL?.trim() || process.env.API_INTERNAL_URL?.trim() || 'http://localhost:3002/api';
  try {
    const res = await fetch(`${API_BASE}/suppliers?limit=4&order=home`, {
      next: { revalidate: 3600 },
    });
    if (!res.ok) return [];
    const data = (await res.json()) as { suppliers?: Supplier[] } | Supplier[];
    return (Array.isArray(data) ? data : ((data as { suppliers?: Supplier[] }).suppliers ?? [])).slice(0, 4);
  } catch (e) {
    console.error('[classic] fetchSuppliers failed:', e);
    return [];
  }
}

export default async function ClassicHomePage() {
  const c = getCountry((await headers()).get('x-country'));
  // 国家隔离铁律：本页 AE 专属，非 AE 站一律 notFound（禁软 404）
  if (c.code !== 'ae') notFound();
  const country = c.code;

  const [companiesResult, suppliersResult, guidesResult] = await Promise.allSettled([
    fetchPublicCompanies(30, 'home', country),
    fetchSuppliers(),
    fetchGuides(country),
  ]);

  const companies = companiesResult.status === 'fulfilled' ? companiesResult.value : [];
  const suppliers = suppliersResult.status === 'fulfilled' ? suppliersResult.value : [];
  const guides = guidesResult.status === 'fulfilled' ? guidesResult.value : [];

  return (
    <>
      <Banner />
      <HomeDesignSection initialCompanies={companies} />
      <HomeSpaceSection />
      <HomeSupplierSection suppliers={suppliers} />
      <HomeInsightsSection guides={guides} />
    </>
  );
}
