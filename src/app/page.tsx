import type { Metadata } from 'next';
import { headers } from 'next/headers';
import Banner from '@/components/home/Banner';
import HomeDesignSection from '@/components/home/HomeDesignSection';
import HomeSpaceSection from '@/components/home/HomeSpaceSection';
import HomeSupplierSection from '@/components/home/HomeSupplierSection';
import HomeInsightsSection from '@/components/home/HomeInsightsSection';
import HomeMaterialsHero from '@/components/home/HomeMaterialsHero';
import HomeHowItWorks from '@/components/home/HomeHowItWorks';
import HomeApplicationTiles from '@/components/home/HomeApplicationTiles';
import HomeChinaTeam from '@/components/home/HomeChinaTeam';
import HomeSourcingStrip from '@/components/home/HomeSourcingStrip';
import HomeGuaranteeStrip from '@/components/home/HomeGuaranteeStrip';
import HomePartnersSection from '@/components/home/HomePartnersSection';
import HomeCaseStudySection from '@/components/home/HomeCaseStudySection';
import { fetchPublicCompanies, fetchGuides } from '@/lib/publicApi';
import { getCountry } from '@/lib/country';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const countryHeader = (await headers()).get('x-country');
  const c = getCountry(countryHeader);
  const isAe = !countryHeader || countryHeader === 'ae';

  if (!isAe) {
    // VN（及其他非 AE 国家）：metadata 与改版前完全一致，零变化（P0 保护）。
    const cityList = c.cities.slice(0, 2).join(', ');
    return {
      title: `Tarmeer - Find Interior Design & Renovation Companies in ${c.name}`,
      description:
        `Connect with top interior designers, renovation companies, and fit-out professionals across ${cityList}, and ${c.name}. Browse portfolios, compare services, get personalized quotes.`,
      openGraph: {
        title: `Tarmeer - Find Interior Design & Renovation Companies in ${c.name}`,
        description: `Connect with top interior designers and renovation companies in ${c.name}.`,
        url: `${c.baseUrl}/`,
        images: [{ url: `${c.baseUrl}/images/hero/hero-living-1.jpg`, width: 1200, height: 630 }],
      },
      alternates: { canonical: `${c.baseUrl}/` },
      keywords:
        `interior design ${c.name}, renovation companies ${c.cities[0]}, fit-out ${c.cities[1] ?? c.defaultCity}, interior designer, home renovation, Tarmeer, villa design, apartment renovation`,
    };
  }

  // AE：中国新材料新主张（改版 spec §5）
  const title = "Tarmeer — China's Newest Building Materials in the UAE | Curated & Guaranteed";
  const description =
    'Discover the newest building materials from leading Chinese factories — curated, imported and guaranteed by a local UAE building-materials mall. Browse materials, book a showroom visit, and get local delivery with after-sales warranty.';
  return {
    title,
    description,
    openGraph: {
      title,
      description:
        "China's newest building materials, curated for the UAE — sourced direct from factories, delivered and guaranteed locally.",
      url: `${c.baseUrl}/`,
      images: [{ url: `${c.baseUrl}/images/sourcing/hero-home.webp`, width: 1200, height: 630 }],
    },
    alternates: { canonical: `${c.baseUrl}/` },
    keywords:
      'building materials UAE, Chinese building materials Dubai, china sourcing UAE, sintered stone Dubai, materials showroom Dubai, building materials mall, Tarmeer',
  };
}

export default async function HomePage() {
  const headersList = await headers();
  const country = headersList.get('x-country') ?? 'ae';
  const c = getCountry(country);

  const websiteJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: 'Tarmeer',
    url: c.baseUrl,
    description: `Find and compare interior design and renovation companies across ${c.name}.`,
    potentialAction: {
      '@type': 'SearchAction',
      target: `${c.baseUrl}/companies?q={search_term_string}`,
      'query-input': 'required name=search_term_string',
    },
  };

  // Organization 实体由根 layout 全站统一发出(src/lib/schema/organization.ts),
  // 首页不再单独发,避免同 @id 双节点属性冲突 + AE 社媒硬编码泄进 VN。
  const isAe = !country || country === 'ae';

  if (!isAe) {
    // VN（及其他非 AE 国家）：渲染树与改版前完全一致，零变化（P0 保护）。
    // 改版前 VN 的 suppliers 恒为 []（isAe=false → Promise.resolve([])），此处直传 []。
    const [companiesResult, guidesResult] = await Promise.allSettled([
      fetchPublicCompanies(30, 'home', country),
      fetchGuides(country),
    ]);
    const companies = companiesResult.status === 'fulfilled' ? companiesResult.value : [];
    const guides = guidesResult.status === 'fulfilled' ? guidesResult.value : [];

    return (
      <>
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteJsonLd) }} />
        <Banner />
        <HomeDesignSection initialCompanies={companies} />
        <HomeSpaceSection />
        <HomeSupplierSection suppliers={[]} />
        <HomeInsightsSection guides={guides} />
      </>
    );
  }

  // AE：中国新材料首页（改版 spec §5 + 2026-07-16 反馈：首页不再堆廉价产品，改策展入口+接待故事）
  const [companiesResult, guidesResult] = await Promise.allSettled([
    fetchPublicCompanies(12, 'home', country),
    fetchGuides(country),
  ]);

  const companies = companiesResult.status === 'fulfilled' ? companiesResult.value : [];
  const guides = guidesResult.status === 'fulfilled' ? guidesResult.value : [];
  // ⑤ 标杆案例位（spec §5）：取 story 栏目第一篇；无则整节隐藏
  const caseStudyGuide = guides.find((g) => g.category === 'story') ?? null;

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteJsonLd) }} />
      <HomeMaterialsHero />
      <HomeHowItWorks />
      <HomeChinaTeam />
      <HomeApplicationTiles />
      <HomeSourcingStrip />
      <HomeGuaranteeStrip />
      <HomeCaseStudySection guide={caseStudyGuide} />
      <HomePartnersSection companies={companies} />
      <HomeInsightsSection guides={guides} />
    </>
  );
}
