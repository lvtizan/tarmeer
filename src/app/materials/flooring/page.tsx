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
import { BRAND, SERIES, PRODUCTS, productsOf, coverAltOf, FLOOR_KEYWORDS } from '@/lib/flooring';
import FlooringGrid from '@/components/flooring/FlooringGrid';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const c = getCountry((await headers()).get('x-country'));
  if (c.code !== 'ae') notFound();
  const title =
    'Building Materials from China for the UAE — Art Parquet & Wood Flooring | Tarmeer';
  const description =
    "New building materials from China for the UAE — PARBRO art parquet and engineered wood flooring in oak, walnut and teak. See, touch and specify every design at Tarmeer's Dubai material selection center, then we source and deliver across the Middle East.";
  return {
    title,
    description,
    keywords: FLOOR_KEYWORDS,
    openGraph: {
      title,
      description,
      images: [
        {
          url: `${c.baseUrl}${SERIES[0].cover}`,
          width: 1000,
          height: 1000,
          alt: 'PARBRO art parquet flooring from China at Tarmeer Dubai',
        },
      ],
      url: `${c.baseUrl}/materials/flooring`,
      type: 'website',
      siteName: 'Tarmeer',
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [`${c.baseUrl}${SERIES[0].cover}`],
    },
    alternates: { canonical: `${c.baseUrl}/materials/flooring` },
    robots: {
      index: true,
      follow: true,
      googleBot: { index: true, follow: true, 'max-image-preview': 'large', 'max-snippet': -1 },
    },
  };
}

const HIGHLIGHTS = [
  { icon: Layers, label: `${PRODUCTS.length} art flooring designs` },
  { icon: Ruler, label: `${SERIES.length} collections — parquet & puzzle` },
  { icon: Sparkles, label: 'Oak, walnut & teak, with brass inlays' },
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

  // 系列 ItemList（帮助 Google 理解页面为集合页）
  const collectionsJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: 'PARBRO art flooring collections',
    numberOfItems: SERIES.length,
    itemListElement: SERIES.map((s, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: `${s.nameEn} — ${BRAND.displayName}`,
      url: `${c.baseUrl}/materials/flooring/${s.slug}`,
      image: `${c.baseUrl}${s.cover}`,
    })),
  };

  // 集合页本体
  const collectionPageJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: 'Art Parquet & Wood Flooring from China — Tarmeer UAE',
    description:
      "New building materials from China for the UAE: PARBRO art parquet and engineered wood flooring, seen and specified at Tarmeer's Dubai material selection center.",
    url: `${c.baseUrl}/materials/flooring`,
    isPartOf: { '@type': 'WebSite', name: 'Tarmeer', url: c.baseUrl },
    about: ['building materials', 'wood flooring', 'parquet', 'China sourcing', 'UAE'],
  };

  // FAQ（面向搜索意图 + rich result）
  const faqJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: [
      {
        '@type': 'Question',
        name: 'Where can I see these China building materials in the UAE?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: "You can see, touch and specify every flooring design in person at Tarmeer's material selection center in Dubai. A bilingual consultant walks you through the range and prepares a quotation with lead times.",
        },
      },
      {
        '@type': 'Question',
        name: 'Do you source materials other than flooring from China?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Yes. Alongside art parquet and wood flooring we source a full range of new building materials from China for Middle East projects — tiles, stone, sanitary ware, lighting and more. Browse the full material library or ask a consultant.',
        },
      },
      {
        '@type': 'Question',
        name: 'How is the flooring delivered to the UAE?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Orders are sourced factory-direct in China, quality-checked, consolidated and shipped to the UAE. Tarmeer handles sourcing, logistics and after-sales so you deal with one partner from selection to delivery.',
        },
      },
      {
        '@type': 'Question',
        name: 'What wood species and sizes are available?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: `The range covers oak, walnut, teak, ash and more across ${PRODUCTS.length} designs in two collections — geometric Floral parquet and irregular Alien Puzzle panels, including brass-inlaid pieces, in sizes from small parquet tiles up to 750×750mm panels.`,
        },
      },
    ],
  };

  return (
    <div>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdHtml(breadcrumbJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdHtml(collectionPageJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdHtml(collectionsJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdHtml(faqJsonLd) }}
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
                    alt={coverAltOf(s)}
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
              Every design
            </h2>
            <p className="mt-3 text-stone-500">Search by model number, wood or finish.</p>
          </div>
          <FlooringGrid products={PRODUCTS} />
        </div>
      </section>

      {/* SEO 内容区：关键词丰富的可爬取正文 + 内链（中东/中国建材、新材料、瓷砖、上门选材） */}
      <section className="bg-white py-14 lg:py-20">
        <div className="mx-auto max-w-3xl px-4 sm:px-6">
          <h2 className="font-serif text-2xl font-bold text-[#1c1917] [text-wrap:balance] lg:text-3xl">
            New building materials from China, specified in the UAE
          </h2>
          <div className="mt-5 space-y-4 text-[15px] leading-relaxed text-stone-600">
            <p>
              Tarmeer brings the newest building materials from China to the Middle East. This
              collection covers {PRODUCTS.length} designs of art parquet and engineered wood
              flooring — oak, walnut and teak, from classic herringbone and Versailles parquet to
              irregular puzzle panels inlaid with solid brass. Every design is sourced
              factory-direct and can be seen, touched and specified at our{' '}
              <Link href="/materials/showroom" className="font-semibold text-[#b8864a] hover:text-[#a07640]">
                material selection center in Dubai
              </Link>
              .
            </p>
            <p>
              Wood flooring is one part of a much wider range. Through Tarmeer you can source new
              materials from China for any UAE project — floor and wall tiles, sintered stone,
              sanitary ware, lighting and more. Browse the full{' '}
              <Link href="/materials" className="font-semibold text-[#b8864a] hover:text-[#a07640]">
                building material library
              </Link>{' '}
              or read how our{' '}
              <Link href="/services/china-sourcing" className="font-semibold text-[#b8864a] hover:text-[#a07640]">
                China sourcing service
              </Link>{' '}
              handles selection, quality control, shipping and after-sales to your door.
            </p>
          </div>

          {/* 可见 FAQ（呼应 FAQPage schema） */}
          <div className="mt-10 space-y-6">
            <h3 className="font-serif text-xl font-bold text-[#1c1917]">Frequently asked questions</h3>
            {[
              {
                q: 'Where can I see these China building materials in the UAE?',
                a: "See, touch and specify every flooring design in person at Tarmeer's material selection center in Dubai, guided by a bilingual consultant who prepares a quotation with lead times.",
              },
              {
                q: 'Do you source materials other than flooring from China?',
                a: 'Yes — alongside parquet and wood flooring we source tiles, stone, sanitary ware and lighting, all new building materials from China for Middle East projects.',
              },
              {
                q: 'How is the flooring delivered to the UAE?',
                a: 'Sourced factory-direct in China, quality-checked, consolidated and shipped to the UAE — one partner from selection to delivery and after-sales.',
              },
            ].map((f) => (
              <div key={f.q}>
                <h4 className="text-[15px] font-semibold text-[#1c1917]">{f.q}</h4>
                <p className="mt-1.5 text-[15px] leading-relaxed text-stone-600">{f.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-[#faf8f5] py-14 lg:py-20">
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
