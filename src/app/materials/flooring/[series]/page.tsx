// /materials/flooring/[series] — L2 系列产品网格（AE 专属）
// 目录名 [series]，params 键必须叫 series（与目录一致，铁律）。
import type { Metadata } from 'next';
import Link from 'next/link';
import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import { getCountry } from '@/lib/country';
import { jsonLdHtml } from '@/lib/schema/jsonLdScript';
import { BRAND, getSeries, productsOf, coverAltOf, FLOOR_KEYWORDS, imgOf } from '@/lib/flooring';
import FlooringGrid from '@/components/flooring/FlooringGrid';

export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ series: string }>;
}): Promise<Metadata> {
  const c = getCountry((await headers()).get('x-country'));
  if (c.code !== 'ae') notFound();
  const { series } = await params;
  const s = getSeries(series);
  if (!s) notFound();
  const n = productsOf(series).length;
  const title = `${s.nameEn} Parquet Flooring from China — ${n} Designs | Tarmeer UAE`;
  const description = `${s.blurb} ${n} art wood flooring designs sourced direct from China — see and specify them at Tarmeer's Dubai material selection center, with delivery across the UAE and Middle East.`;
  return {
    title,
    description,
    keywords: [`${s.nameEn} parquet`, `${s.nameEn} flooring`, ...FLOOR_KEYWORDS],
    openGraph: {
      title,
      description,
      images: [{ url: `${c.baseUrl}${s.cover}`, width: 1000, height: 1000, alt: coverAltOf(s) }],
      url: `${c.baseUrl}/materials/flooring/${series}`,
      type: 'website',
      siteName: 'Tarmeer',
    },
    twitter: { card: 'summary_large_image', title, description, images: [`${c.baseUrl}${s.cover}`] },
    alternates: { canonical: `${c.baseUrl}/materials/flooring/${series}` },
    robots: {
      index: true,
      follow: true,
      googleBot: { index: true, follow: true, 'max-image-preview': 'large', 'max-snippet': -1 },
    },
  };
}

export default async function FlooringSeriesPage({
  params,
}: {
  params: Promise<{ series: string }>;
}) {
  const c = getCountry((await headers()).get('x-country'));
  if (c.code !== 'ae') notFound();
  const { series } = await params;
  const s = getSeries(series);
  if (!s) notFound();
  const products = productsOf(series);

  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: `${c.baseUrl}/` },
      { '@type': 'ListItem', position: 2, name: 'Materials', item: `${c.baseUrl}/materials` },
      { '@type': 'ListItem', position: 3, name: 'Flooring', item: `${c.baseUrl}/materials/flooring` },
      {
        '@type': 'ListItem',
        position: 4,
        name: s.nameEn,
        item: `${c.baseUrl}/materials/flooring/${series}`,
      },
    ],
  };

  // 系列内所有产品 ItemList（每个是可点进的 Product URL + 图）
  const itemListJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: `${s.nameEn} — ${BRAND.displayName}`,
    numberOfItems: products.length,
    itemListElement: products.map((p, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: `${BRAND.nameEn} ${p.code} ${p.wood}`,
      url: `${c.baseUrl}/materials/flooring/${series}/${p.code}`,
      image: `${c.baseUrl}${imgOf(p, 'board')}`,
    })),
  };

  return (
    <div>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdHtml(breadcrumbJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdHtml(itemListJsonLd) }}
      />

      <section className="bg-[#1c1917]">
        <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 lg:py-20">
          <nav className="mb-6 flex flex-wrap items-center gap-2 text-[13px] text-white/50">
            <Link href="/materials" className="hover:text-white/80">Materials</Link>
            <span>/</span>
            <Link href="/materials/flooring" className="hover:text-white/80">Flooring</Link>
            <span>/</span>
            <span className="text-white/80">{s.nameEn}</span>
          </nav>
          <p className="text-sm font-semibold uppercase tracking-wider text-[#c6a065]">
            {BRAND.nameEn} · {s.nameEn} Collection
          </p>
          <h1 className="mt-3 font-serif text-4xl font-bold text-white [text-wrap:balance] lg:text-5xl">
            {s.nameEn}
          </h1>
          <p className="mt-5 max-w-xl text-lg leading-relaxed text-white/70">{s.blurb}</p>
        </div>
      </section>

      <section className="bg-[#faf8f5] py-12 lg:py-16">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <FlooringGrid products={products} />
        </div>
      </section>

      {/* SEO 内容区：系列说明 + 关键词 + 内链 */}
      <section className="bg-white py-14 lg:py-20">
        <div className="mx-auto max-w-3xl px-4 sm:px-6">
          <h2 className="font-serif text-2xl font-bold text-[#1c1917] [text-wrap:balance] lg:text-3xl">
            {s.nameEn} art flooring, sourced from China for the UAE
          </h2>
          <p className="mt-5 text-[15px] leading-relaxed text-stone-600">
            The {s.nameEn} collection is part of {BRAND.displayName} — {products.length} designs of
            art parquet and engineered wood flooring in oak, walnut and teak, brought from China to
            the Middle East by Tarmeer. See and compare every panel in person at our{' '}
            <Link href="/materials/showroom" className="font-semibold text-[#b8864a] hover:text-[#a07640]">
              Dubai material selection center
            </Link>
            , or explore the{' '}
            <Link href="/materials/flooring" className="font-semibold text-[#b8864a] hover:text-[#a07640]">
              full flooring range
            </Link>{' '}
            and the wider{' '}
            <Link href="/materials" className="font-semibold text-[#b8864a] hover:text-[#a07640]">
              China building material library
            </Link>{' '}
            — tiles, stone, sanitary ware and more.
          </p>
        </div>
      </section>
    </div>
  );
}
