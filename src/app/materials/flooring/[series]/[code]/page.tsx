// /materials/flooring/[series]/[code] — L3 产品详情（AE 专属）
// 图廊(拼花板/场景/细节) + 规格表 + 询价 CTA + 同系列推荐。
// params 键必须叫 series/code（与目录 [series]/[code] 一致，铁律）。
import type { Metadata } from 'next';
import Link from 'next/link';
import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import { ArrowRight, ArrowLeft } from 'lucide-react';
import { getCountry } from '@/lib/country';
import { jsonLdHtml } from '@/lib/schema/jsonLdScript';
import {
  BRAND,
  getSeries,
  getProduct,
  productsOf,
  imgOf,
  shotsOf,
  altOf,
  seoDescOf,
  FLOOR_KEYWORDS,
} from '@/lib/flooring';
import FlooringGallery from '@/components/flooring/FlooringGallery';
import FloorCard from '@/components/flooring/FloorCard';

export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ series: string; code: string }>;
}): Promise<Metadata> {
  const c = getCountry((await headers()).get('x-country'));
  if (c.code !== 'ae') notFound();
  const { series, code } = await params;
  const p = getProduct(series, code);
  if (!p) notFound();
  const title = `${BRAND.nameEn} ${p.code} ${p.wood} Flooring from China | Tarmeer UAE`;
  const description = seoDescOf(p);
  return {
    title,
    description,
    keywords: [`${p.wood} flooring`, `${p.code} parquet`, `${BRAND.nameEn} ${p.code}`, ...FLOOR_KEYWORDS],
    openGraph: {
      title,
      description,
      images: [{ url: `${c.baseUrl}${imgOf(p, 'board')}`, width: 1000, height: 1000, alt: altOf(p, 'board') }],
      url: `${c.baseUrl}/materials/flooring/${series}/${p.code}`,
      type: 'website',
      siteName: 'Tarmeer',
    },
    twitter: { card: 'summary_large_image', title, description, images: [`${c.baseUrl}${imgOf(p, 'board')}`] },
    alternates: { canonical: `${c.baseUrl}/materials/flooring/${series}/${p.code}` },
    robots: {
      index: true,
      follow: true,
      googleBot: { index: true, follow: true, 'max-image-preview': 'large', 'max-snippet': -1 },
    },
  };
}

export default async function FlooringDetailPage({
  params,
}: {
  params: Promise<{ series: string; code: string }>;
}) {
  const c = getCountry((await headers()).get('x-country'));
  if (c.code !== 'ae') notFound();
  const { series, code } = await params;
  const p = getProduct(series, code);
  if (!p) notFound();
  const s = getSeries(series);

  const shots = shotsOf(p);

  const specs = [
    { label: 'Model', value: p.code },
    { label: 'Wood surface', value: p.wood },
    { label: 'Size', value: p.size },
    { label: 'Finish', value: p.finish },
    { label: 'Collection', value: s ? s.nameEn : series },
    { label: 'Brand', value: BRAND.displayName },
  ];

  const related = productsOf(series)
    .filter((x) => x.code !== p.code)
    .slice(0, 4);

  const productJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: `${BRAND.nameEn} ${p.code} ${p.wood} Flooring`,
    sku: p.code,
    mpn: p.code,
    brand: { '@type': 'Brand', name: BRAND.nameEn },
    manufacturer: { '@type': 'Organization', name: BRAND.displayName },
    category: 'Wood flooring > Art parquet',
    material: p.wood,
    countryOfOrigin: 'CN',
    image: shots.map((sh) => `${c.baseUrl}${sh.src}`),
    description: seoDescOf(p),
    url: `${c.baseUrl}/materials/flooring/${series}/${p.code}`,
    additionalProperty: [
      { '@type': 'PropertyValue', name: 'Wood surface', value: p.wood },
      { '@type': 'PropertyValue', name: 'Size', value: p.size },
      { '@type': 'PropertyValue', name: 'Finish', value: p.finish },
      { '@type': 'PropertyValue', name: 'Collection', value: s ? s.nameEn : series },
    ],
    // 贸易价不公开（去标识铁律）→ 不输出 offers.price，改用 Service 询价语义在页面 CTA 承接
  };

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
        name: s?.nameEn ?? series,
        item: `${c.baseUrl}/materials/flooring/${series}`,
      },
      {
        '@type': 'ListItem',
        position: 5,
        name: p.code,
        item: `${c.baseUrl}/materials/flooring/${series}/${p.code}`,
      },
    ],
  };

  return (
    <div className="bg-white">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdHtml(productJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdHtml(breadcrumbJsonLd) }}
      />

      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:py-12">
        <nav className="mb-8 flex flex-wrap items-center gap-2 text-[13px] text-stone-400">
          <Link href="/materials" className="hover:text-[#b8864a]">Materials</Link>
          <span>/</span>
          <Link href="/materials/flooring" className="hover:text-[#b8864a]">Flooring</Link>
          <span>/</span>
          <Link href={`/materials/flooring/${series}`} className="hover:text-[#b8864a]">
            {s?.nameEn ?? series}
          </Link>
          <span>/</span>
          <span className="text-stone-600">{p.code}</span>
        </nav>

        <div className="grid gap-10 lg:grid-cols-2 lg:gap-14">
          <FlooringGallery shots={shots} alt={`${BRAND.nameEn} ${p.code} ${p.wood} art flooring from China`} />

          <div>
            <p className="text-sm font-semibold uppercase tracking-wider text-[#b8864a]">
              {BRAND.nameEn} · {s?.nameEn ?? 'Flooring'}
            </p>
            <h1 className="mt-2 font-serif text-3xl font-bold text-[#1c1917] lg:text-4xl">
              {p.code}
            </h1>
            <p className="mt-2 text-lg text-stone-500">{p.wood}</p>

            <dl className="mt-8 divide-y divide-stone-100 rounded-2xl border border-stone-200">
              {specs.map((row) => (
                <div key={row.label} className="flex items-baseline justify-between gap-4 px-5 py-3.5">
                  <dt className="text-sm text-stone-400">{row.label}</dt>
                  <dd className="text-right text-[15px] font-medium text-[#1c1917]">{row.value}</dd>
                </div>
              ))}
            </dl>

            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/materials/showroom"
                className="inline-flex h-12 items-center gap-2 rounded-lg bg-[#b8864a] px-6 text-sm font-semibold text-white transition hover:bg-[#a07640]"
              >
                See it at our selection center <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href={`/materials/flooring/${series}`}
                className="inline-flex h-12 items-center gap-2 rounded-lg border border-stone-300 px-6 text-sm font-semibold text-[#1c1917] transition hover:border-[#b8864a] hover:text-[#b8864a]"
              >
                <ArrowLeft className="h-4 w-4" /> Back to {s?.nameEn ?? 'collection'}
              </Link>
            </div>
            <p className="mt-4 text-[13px] leading-relaxed text-stone-400">
              Sourced factory-direct from China. Trade pricing and lead times are shared with
              visiting designers and trade partners.
            </p>
          </div>
        </div>

        {/* SEO 内容区：产品说明 + 关键词 + 内链 */}
        <div className="mt-14 max-w-3xl border-t border-stone-100 pt-10">
          <h2 className="font-serif text-xl font-bold text-[#1c1917]">
            About {BRAND.nameEn} {p.code}
          </h2>
          <p className="mt-4 text-[15px] leading-relaxed text-stone-600">
            {BRAND.nameEn} {p.code} — {p.wood} — is part of the {s?.nameEn ?? 'PARBRO'} art flooring
            collection, measuring {p.size} with a {p.finish.toLowerCase()} finish. It is one of the
            new building materials Tarmeer brings from China to the UAE and the wider Middle East.
            See this parquet in person at our{' '}
            <Link href="/materials/showroom" className="font-semibold text-[#b8864a] hover:text-[#a07640]">
              Dubai material selection center
            </Link>
            , compare it with the rest of the{' '}
            <Link href={`/materials/flooring/${series}`} className="font-semibold text-[#b8864a] hover:text-[#a07640]">
              {s?.nameEn ?? 'flooring'} collection
            </Link>
            , or browse the full{' '}
            <Link href="/materials" className="font-semibold text-[#b8864a] hover:text-[#a07640]">
              China building material range
            </Link>{' '}
            — wood flooring, tiles, stone and more, delivered across the UAE.
          </p>
        </div>

        {/* 同系列推荐 */}
        {related.length > 0 && (
          <div className="mt-16 border-t border-stone-100 pt-12">
            <h2 className="font-serif text-2xl font-bold text-[#1c1917]">More from {s?.nameEn ?? 'this collection'}</h2>
            <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
              {related.map((r) => (
                <FloorCard key={r.code} product={r} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
