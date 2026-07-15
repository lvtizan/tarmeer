// AE 首页策展产品区 — 精选新材料产品流（改版 spec §5 ②，AE 专用，不进 i18n）
// 产品由 page.tsx SSR 传入（fetchMaterialProducts）；为空时整个 section 返回 null。
'use client';

import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { resolveVariantUrl, resolveImageUrl } from '@/lib/imageUrl';
import type { PublicMaterialProduct } from '@/lib/materialsApi';

function formatCategory(category: string | null): string {
  if (!category) return '';
  return category.replace(/[-_]+/g, ' ').replace(/\b\w/g, (ch) => ch.toUpperCase());
}

export default function HomeMaterialsShowcase({ products }: { products: PublicMaterialProduct[] }) {
  if (!products || products.length === 0) return null;
  const items = products.slice(0, 8);

  return (
    <section className="bg-white py-10 sm:py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="flex items-end justify-between mb-6">
          <div>
            <p className="text-[10px] uppercase tracking-[0.22em] text-stone-400 mb-1.5">Curated Materials</p>
            <h2 className="font-serif text-[24px] leading-tight tracking-[-0.01em] text-[#1c1917] sm:text-[28px]">
              New Materials, First in the UAE
            </h2>
          </div>
          <Link href="/materials" className="hidden sm:inline-flex items-center gap-2 text-sm font-medium text-[#b8864a] hover:text-[#9a7040] transition">
            View All Materials <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
          {items.map((p) => (
            <Link
              key={p.id}
              href={`/materials/products/${p.id}`}
              className="group flex flex-col overflow-hidden rounded-2xl border border-stone-200 bg-white transition hover:border-stone-300 hover:shadow-[0_12px_32px_rgba(28,25,23,0.08)]"
            >
              <div className="relative aspect-video overflow-hidden bg-stone-100">
                {p.image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={resolveVariantUrl(p.image_url, 'thumb')}
                    onError={(e) => {
                      const fallback = resolveImageUrl(p.image_url);
                      if (fallback && !e.currentTarget.src.endsWith(fallback)) {
                        e.currentTarget.src = fallback;
                      }
                    }}
                    alt={p.title || formatCategory(p.category) || 'Material product'}
                    loading="lazy"
                    className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-stone-100 to-stone-200">
                    <span className="font-serif text-3xl text-stone-300">{(p.title || p.supplier_name || 'M').charAt(0)}</span>
                  </div>
                )}
                {p.category && (
                  <span className="absolute top-2.5 left-2.5 rounded-full bg-black/50 px-2 py-0.5 text-[10px] text-white/90 backdrop-blur-sm">
                    {formatCategory(p.category)}
                  </span>
                )}
              </div>
              <div className="flex flex-col flex-1 p-3.5 sm:p-4">
                <h3 className="font-medium text-[14px] leading-snug text-[#1c1917] group-hover:text-[#b8864a] transition sm:text-[15px] line-clamp-2">
                  {p.title || formatCategory(p.category) || 'New Material'}
                </h3>
                {p.supplier_name && (
                  <p className="mt-1 line-clamp-1 text-[12px] leading-5 text-stone-500 sm:text-[13px]">{p.supplier_name}</p>
                )}
              </div>
            </Link>
          ))}
        </div>

        <div className="mt-5 flex justify-center sm:hidden">
          <Link href="/materials" className="inline-flex items-center gap-2 rounded-full border border-stone-300 px-5 py-2.5 text-sm font-medium text-[#1c1917] transition hover:border-[#b8864a] hover:text-[#b8864a]">
            View All Materials <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </section>
  );
}
