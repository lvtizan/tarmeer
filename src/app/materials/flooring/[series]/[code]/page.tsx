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
import { BRAND, getSeries, getProduct, productsOf, imgOf } from '@/lib/flooring';
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
  const title = `${BRAND.nameEn} ${p.code} — ${p.wood} Parquet | Tarmeer`;
  const description = `${BRAND.nameEn} ${p.code}: ${p.wood}, ${p.size}, ${p.finish} finish. Art parquet flooring sourced direct from China through Tarmeer.`;
  return {
    title,
    description,
    openGraph: {
      title,
      description,
      images: [{ url: `${c.baseUrl}${imgOf(p, 'board')}`, width: 1000, height: 1000 }],
      url: `${c.baseUrl}/materials/flooring/${series}/${p.code}`,
      type: 'website',
    },
    alternates: { canonical: `${c.baseUrl}/materials/flooring/${series}/${p.code}` },
    robots: 'index, follow, max-image-preview:large',
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

  const shots = [
    { kind: 'board', src: imgOf(p, 'board'), label: 'Panel' },
    { kind: 'room', src: imgOf(p, 'room'), label: 'In situ' },
    { kind: 'detail', src: imgOf(p, 'detail'), label: 'Grain detail' },
  ];

  const specs = [
    { label: 'Model', value: p.code },
    { label: 'Wood surface', value: p.wood },
    { label: 'Size', value: p.size },
    { label: 'Finish', value: p.finish },
    { label: 'Collection', value: s ? `${s.nameEn} · ${s.nameZh}` : series },
    { label: 'Brand', value: `${BRAND.nameEn} · ${BRAND.nameZh}` },
  ];

  const related = productsOf(series)
    .filter((x) => x.code !== p.code)
    .slice(0, 4);

  const productJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: `${BRAND.nameEn} ${p.code} ${p.wood}`,
    sku: p.code,
    brand: { '@type': 'Brand', name: BRAND.nameEn },
    category: 'Parquet flooring',
    image: shots.map((sh) => `${c.baseUrl}${sh.src}`),
    description: `${p.wood} art parquet, ${p.size}, ${p.finish} finish.`,
    url: `${c.baseUrl}/materials/flooring/${series}/${p.code}`,
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
          <FlooringGallery shots={shots} alt={`${BRAND.nameEn} ${p.code} ${p.wood}`} />

          <div>
            <p className="text-sm font-semibold uppercase tracking-wider text-[#b8864a]">
              {BRAND.nameEn} · {s?.nameZh ?? '拼花系列'}
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
