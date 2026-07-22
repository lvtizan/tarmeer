// /materials/flooring — L1 艺术地板落地页（AE 专属）
// PARBRO 巴博罗艺术地板：品牌介绍 + 系列卡片（进 L2）+ 全量产品搜索网格。
// 图片来自 pdf-catalog-extract 技能扒出的厂家画册；细节图保原尺不糊。
import type { Metadata } from 'next';
import Link from 'next/link';
import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import { ArrowRight, Layers, Ruler, Sparkles } from 'lucide-react';
import { getCountry } from '@/lib/country';
import { jsonLdHtml } from '@/lib/schema/jsonLdScript';
import { BRAND, SERIES, PRODUCTS, productsOf } from '@/lib/flooring';
import FlooringGrid from '@/components/flooring/FlooringGrid';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const c = getCountry((await headers()).get('x-country'));
  if (c.code !== 'ae') notFound();
  const title = 'Art Parquet Flooring from China — PARBRO | Tarmeer';
  const description =
    "PARBRO art parquet and engineered wood flooring, sourced direct from China. Oak, walnut and teak geometric panels — see every design, spec and finish, then source it through Tarmeer's UAE selection center.";
  return {
    title,
    description,
    openGraph: {
      title,
      description,
      images: [{ url: `${c.baseUrl}${SERIES[0].cover}`, width: 1000, height: 1000 }],
      url: `${c.baseUrl}/materials/flooring`,
      type: 'website',
    },
    twitter: { card: 'summary_large_image', title, description },
    alternates: { canonical: `${c.baseUrl}/materials/flooring` },
    robots: 'index, follow, max-image-preview:large',
  };
}

const HIGHLIGHTS = [
  { icon: Layers, label: `${PRODUCTS.length} parquet designs` },
  { icon: Ruler, label: '600×600 engineered panels' },
  { icon: Sparkles, label: 'Brushed, grooved & metal finishes' },
];

export default async function FlooringLandingPage() {
  const c = getCountry((await headers()).get('x-country'));
  if (c.code !== 'ae') notFound();

  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: `${c.baseUrl}/` },
      { '@type': 'ListItem', position: 2, name: 'Materials', item: `${c.baseUrl}/materials` },
      { '@type': 'ListItem', position: 3, name: 'Flooring', item: `${c.baseUrl}/materials/flooring` },
    ],
  };

  return (
    <div>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdHtml(breadcrumbJsonLd) }}
      />

      {/* Hero */}
      <section className="bg-[#1c1917]">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:py-24">
          <nav className="mb-6 flex items-center gap-2 text-[13px] text-white/50">
            <Link href="/materials" className="hover:text-white/80">Materials</Link>
            <span>/</span>
            <span className="text-white/80">Flooring</span>
          </nav>
          <p className="text-sm font-semibold uppercase tracking-wider text-[#c6a065]">
            {BRAND.nameEn} · Art Flooring
          </p>
          <h1 className="mt-4 max-w-2xl font-serif text-4xl font-bold leading-tight text-white [text-wrap:balance] lg:text-5xl">
            China&apos;s art parquet, <span className="text-[#c6a065]">specified in the UAE</span>
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-relaxed text-white/70">
            {BRAND.tagline}. Oak, walnut and teak geometric panels — see every design and finish
            here, then source it factory-direct through Tarmeer.
          </p>
          <div className="mt-8 flex flex-wrap gap-x-6 gap-y-3">
            {HIGHLIGHTS.map(({ icon: Icon, label }) => (
              <div key={label} className="flex items-center gap-2">
                <Icon className="h-4 w-4 shrink-0 text-[#c6a065]" />
                <span className="text-[15px] text-white/80">{label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 系列卡片（L2 入口） */}
      <section className="bg-white py-14 lg:py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <p className="text-sm font-semibold uppercase tracking-wider text-[#b8864a]">Collections</p>
          <h2 className="mt-3 font-serif text-3xl font-bold text-[#1c1917] lg:text-4xl">
            Browse by collection
          </h2>

          <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {SERIES.map((s) => (
              <Link
                key={s.slug}
                href={`/materials/flooring/${s.slug}`}
                className="group overflow-hidden rounded-2xl border border-stone-200 bg-white transition hover:border-[#b8864a]/40 hover:shadow-sm"
              >
                <div className="aspect-[4/3] overflow-hidden bg-stone-100">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={s.cover}
                    alt={`${s.nameEn} parquet collection`}
                    loading="lazy"
                    className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                  />
                </div>
                <div className="p-5">
                  <div className="flex items-center justify-between">
                    <h3 className="font-serif text-xl font-bold text-[#1c1917]">{s.nameEn}</h3>
                    <span className="text-[13px] text-stone-400">{productsOf(s.slug).length} designs</span>
                  </div>
                  <p className="mt-2 text-sm leading-relaxed text-stone-500">{s.blurb}</p>
                  <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-[#b8864a]">
                    View collection <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* 全量产品 + 搜索 */}
      <section className="bg-[#faf8f5] py-14 lg:py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-sm font-semibold uppercase tracking-wider text-[#b8864a]">All Designs</p>
            <h2 className="mt-3 font-serif text-3xl font-bold text-[#1c1917] lg:text-4xl">
              Every parquet design
            </h2>
            <p className="mt-3 text-stone-500">Search by model number, wood or finish.</p>
          </div>
          <FlooringGrid products={PRODUCTS} />
        </div>
      </section>

      {/* CTA */}
      <section className="bg-white py-14 lg:py-20">
        <div className="mx-auto max-w-3xl px-4 text-center sm:px-6">
          <h2 className="font-serif text-2xl font-bold text-[#1c1917] [text-wrap:balance] lg:text-3xl">
            Found a design you like?
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-stone-500">
            See it in person at our UAE selection center, or send us the model numbers for a quote.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link
              href="/materials/showroom"
              className="inline-flex h-12 items-center gap-2 rounded-lg bg-[#b8864a] px-6 text-sm font-semibold text-white transition hover:bg-[#a07640]"
            >
              Visit the selection center <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/materials"
              className="inline-flex h-12 items-center gap-2 rounded-lg border border-stone-300 px-6 text-sm font-semibold text-[#1c1917] transition hover:border-[#b8864a] hover:text-[#b8864a]"
            >
              Browse all materials
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
