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

export const dynamic = 'force-dynamic';

const FLOOR_KEYWORDS = [
  'building materials UAE',
  'China building materials',
  'material selection center Dubai',
];

// 分类 label 来自 product_categories（经后端 /suppliers/macro-categories/:key/products 解析）——
// 不再硬编码 MACRO_LABELS。
// 返回 null 仅代表「未知 key」(后端 404) → 调用方 notFound()。
// 后端 500 / 网络错误 → throw（交给 Next 错误边界渲染可重试的 500），绝不误判成硬 404。
async function resolveCategoryLabel(key: string, country: string): Promise<string | null> {
  const API_BASE =
    process.env.NEXT_PUBLIC_API_URL?.trim() || process.env.API_URL?.trim() || 'http://localhost:3002/api';
  const res = await fetch(
    `${API_BASE}/suppliers/macro-categories/${encodeURIComponent(key)}/products?country=${country}&limit=1`,
    { headers: { 'x-country': country } },
  );
  if (res.status === 404) return null; // 未知/未启用分类 → 真 404
  if (!res.ok) throw new Error(`resolveCategoryLabel: backend returned HTTP ${res.status}`);
  const d = await res.json();
  // 有效分类（含空分类）后端恒返回 200 + label；缺 label 视为异常，宁可 throw 也不误判 404
  if (typeof d.label === 'string' && d.label) return d.label;
  throw new Error('resolveCategoryLabel: valid response missing label');
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ key: string }>;
}): Promise<Metadata> {
  const c = getCountry((await headers()).get('x-country'));
  if (c.code !== 'ae') notFound();
  const { key } = await params;
  const label = await resolveCategoryLabel(key, c.code);
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
  const label = await resolveCategoryLabel(key, c.code);
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
            {`${label} sourced from China for UAE projects.`}
          </p>
        </div>
      </section>

      <div className="px-4 py-10 sm:px-6 lg:px-10 lg:py-14">
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
