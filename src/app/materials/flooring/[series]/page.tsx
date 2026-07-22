// /materials/flooring/[series] — L2 系列产品网格（AE 专属）
// 目录名 [series]，params 键必须叫 series（与目录一致，铁律）。
import type { Metadata } from 'next';
import Link from 'next/link';
import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import { getCountry } from '@/lib/country';
import { jsonLdHtml } from '@/lib/schema/jsonLdScript';
import { BRAND, getSeries, productsOf } from '@/lib/flooring';
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
  const title = `${s.nameEn} — ${BRAND.nameEn} Art Parquet | Tarmeer`;
  const description = `${s.blurb} ${productsOf(series).length} designs, sourced direct from China through Tarmeer.`;
  return {
    title,
    description,
    openGraph: {
      title,
      description,
      images: [{ url: `${c.baseUrl}${s.cover}`, width: 1000, height: 1000 }],
      url: `${c.baseUrl}/materials/flooring/${series}`,
      type: 'website',
    },
    alternates: { canonical: `${c.baseUrl}/materials/flooring/${series}` },
    robots: 'index, follow, max-image-preview:large',
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

  return (
    <div>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdHtml(breadcrumbJsonLd) }}
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
            {BRAND.nameEn} · {s.nameZh}
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
    </div>
  );
}
