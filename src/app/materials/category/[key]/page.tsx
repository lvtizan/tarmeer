// /materials/category/[key] — By Material 大类产品展示页（AE 专属）。
// 大类 → 该类聚合产品(供应商图库) → 穿透到公司。Premium 类引导询价。
// params 键必须叫 key（与目录 [key] 一致，铁律）。
import type { Metadata } from 'next';
import Link from 'next/link';
import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { getCountry } from '@/lib/country';
import Breadcrumb from '@/components/common/Breadcrumb';
import MacroProductGrid from '@/components/materials/MacroProductGrid';
import { MACRO_LABELS, MACRO_BLURB } from '@/lib/materialMacros';

export const dynamic = 'force-dynamic';

const FLOOR_KEYWORDS = [
  'building materials UAE',
  'China building materials',
  'material selection center Dubai',
];

export async function generateMetadata({
  params,
}: {
  params: Promise<{ key: string }>;
}): Promise<Metadata> {
  const c = getCountry((await headers()).get('x-country'));
  if (c.code !== 'ae') notFound();
  const { key } = await params;
  const label = MACRO_LABELS[key];
  if (!label) notFound();
  const title = `${label} from China for the UAE | Tarmeer`;
  const description = `Source ${label.toLowerCase()} from vetted China suppliers, delivered across the UAE. See products and specify with Tarmeer's Dubai material selection center.`;
  return {
    title,
    description,
    keywords: [`${label} UAE`, `${label} China`, ...FLOOR_KEYWORDS],
    openGraph: { title, description, url: `${c.baseUrl}/materials/category/${key}`, type: 'website', siteName: 'Tarmeer' },
    twitter: { card: 'summary_large_image', title, description },
    alternates: { canonical: `${c.baseUrl}/materials/category/${key}` },
    robots: {
      index: true,
      follow: true,
      googleBot: { index: true, follow: true, 'max-image-preview': 'large', 'max-snippet': -1 },
    },
  };
}

export default async function MaterialCategoryPage({
  params,
}: {
  params: Promise<{ key: string }>;
}) {
  const c = getCountry((await headers()).get('x-country'));
  if (c.code !== 'ae') notFound();
  const { key } = await params;
  const label = MACRO_LABELS[key];
  if (!label) notFound();

  const crumbs = [
    { name: 'Home', href: '/' },
    { name: 'Materials', href: '/materials' },
    { name: label },
  ];

  return (
    <div className="min-h-screen bg-[#faf9f7]">
      <section className="bg-[#1c1917]">
        <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:py-16">
          <div className="mb-6">
            <Breadcrumb items={crumbs} baseUrl={c.baseUrl} variant="dark" />
          </div>
          <p className="text-sm font-semibold uppercase tracking-wider text-[#c6a065]">Material</p>
          <h1 className="mt-2 font-serif text-4xl font-bold text-white [text-wrap:balance] lg:text-5xl">
            {label}
          </h1>
          <p className="mt-4 max-w-xl text-lg leading-relaxed text-white/70">
            {MACRO_BLURB[key] ?? `${label} sourced from China for UAE projects.`}
          </p>
        </div>
      </section>

      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:py-14">
        <Link
          href="/materials"
          className="mb-6 inline-flex items-center gap-1.5 text-sm font-medium text-stone-500 transition hover:text-[#b8864a]"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Materials
        </Link>
        <MacroProductGrid macroKey={key} label={label} />
      </div>
    </div>
  );
}
