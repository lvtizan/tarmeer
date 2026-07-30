export const dynamic = 'force-dynamic';

import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { headers } from 'next/headers';
import HomeMaterialsHero from '@/components/home/HomeMaterialsHero';
import HomeApplicationTiles from '@/components/home/HomeApplicationTiles';
import HomeHowItWorks from '@/components/home/HomeHowItWorks';
import HomeShowroom from '@/components/home/HomeShowroom';
import HomeNewMaterials from '@/components/home/HomeNewMaterials';
import HomeClientVisits from '@/components/home/HomeClientVisits';
import HomeCaseStudySection from '@/components/home/HomeCaseStudySection';
import HomeContactForm from '@/components/home/HomeContactForm';
import { fetchGuides } from '@/lib/publicApi';
import { getCountry } from '@/lib/country';

export async function generateMetadata(): Promise<Metadata> {
  const c = getCountry((await headers()).get('x-country'));
  // AE 专属路由：中国材料 Mall。非 AE 站 metadata 与页面体同口径 notFound（禁软 404）。
  if (c.code !== 'ae') notFound();
  const title = "Tarmeer Mall — China's Newest Building Materials in the UAE | Curated & Guaranteed";
  const description =
    'Discover the newest building materials from leading Chinese factories — curated, imported and guaranteed by a local UAE building-materials mall. Browse materials, book a showroom visit, and get local delivery with after-sales warranty.';
  return {
    title,
    description,
    openGraph: {
      title,
      description:
        "China's newest building materials, curated for the UAE — sourced direct from factories, delivered and guaranteed locally.",
      url: `${c.baseUrl}/mall`,
      images: [{ url: `${c.baseUrl}/images/sourcing/hero-home.webp`, width: 1200, height: 630 }],
    },
    alternates: { canonical: `${c.baseUrl}/mall` },
    keywords:
      'building materials UAE, Chinese building materials Dubai, china sourcing UAE, sintered stone Dubai, materials showroom Dubai, building materials mall, Tarmeer',
  };
}

export default async function MallPage() {
  const c = getCountry((await headers()).get('x-country'));
  // 国家隔离铁律：AE 专属，非 AE 站一律 notFound（禁软 404）。
  if (c.code !== 'ae') notFound();
  // 中国新材料单页叙事 8 段（原 / 首页内容整体迁到 /mall；Hero → 品类 → 三步 → 价值 → 团队 → 到访 → 案例 → 表单收口）。
  const [guidesResult] = await Promise.allSettled([fetchGuides(c.code)]);
  const guides = guidesResult.status === 'fulfilled' ? guidesResult.value : [];
  // 标杆案例位：取 story 栏目第一篇；无则整节隐藏。
  const caseStudyGuide = guides.find((g) => g.category === 'story') ?? null;

  return (
    <>
      <HomeMaterialsHero />
      <HomeApplicationTiles />
      <HomeHowItWorks />
      <HomeShowroom />
      <HomeNewMaterials />
      <HomeClientVisits />
      <HomeCaseStudySection guide={caseStudyGuide} />
      <HomeContactForm />
    </>
  );
}
