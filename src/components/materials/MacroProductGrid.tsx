'use client';

// 大类产品展示（从供应商图库聚合）→ 点产品穿透到供应商。Premium/空类 → 引导询价。
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { countryFromLang } from '@/lib/country';
import { useSiteLocale } from '@/contexts/SiteLocaleContext';
import { fetchMacroProducts, PREMIUM_MATERIALS, type MacroProduct } from '@/lib/materialMacros';

export default function MacroProductGrid({ macroKey, label }: { macroKey: string; label: string }) {
  const country = countryFromLang(useSiteLocale().lang).code;
  const [products, setProducts] = useState<MacroProduct[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const isPremium = PREMIUM_MATERIALS.some((p) => p.key === macroKey);

  useEffect(() => {
    let on = true;
    setLoading(true);
    fetchMacroProducts(macroKey, country).then((r) => {
      if (on) {
        setProducts(r.products);
        setTotal(r.total);
        setLoading(false);
      }
    });
    return () => {
      on = false;
    };
  }, [macroKey, country]);

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#b8864a]/30 border-t-[#b8864a]" />
      </div>
    );
  }

  // Premium 或暂无产品 → 引导询价
  if (products.length === 0) {
    return (
      <div className="rounded-2xl border border-[#b8864a]/25 bg-[#faf6ef] p-8 text-center sm:p-12">
        <h2 className="font-serif text-2xl font-bold text-[#1c1917]">
          {isPremium ? `${label} — a premium line we source from China` : `${label} is being curated`}
        </h2>
        <p className="mx-auto mt-3 max-w-xl text-[15px] leading-relaxed text-stone-600">
          {isPremium
            ? `Tell us your project and we'll share ${label.toLowerCase()} options, specs and trade pricing from our vetted China suppliers, delivered across the UAE.`
            : 'New products land every month. Send us what you need and a specialist will source it.'}
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
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
    );
  }

  return (
    <div>
      <p className="mb-6 text-[13px] text-stone-400">{total} products from our China suppliers</p>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {products.map((p) => (
          <Link
            key={p.id}
            href={p.supplier_slug ? `/materials/suppliers/${p.supplier_slug}` : '#'}
            className="group overflow-hidden rounded-2xl border border-stone-200 bg-white transition hover:border-[#b8864a]/40 hover:shadow-sm"
          >
            <div className="aspect-square overflow-hidden bg-stone-100">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={p.image_url}
                alt={`${p.title} — ${label} from ${p.supplier_name ?? 'a China supplier'}, sourced through Tarmeer UAE`}
                loading="lazy"
                className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
              />
            </div>
            <div className="p-3">
              <p className="line-clamp-1 text-sm font-medium text-[#1c1917]">{p.title}</p>
              {p.supplier_name && (
                <p className="mt-0.5 line-clamp-1 text-[12px] text-stone-500">{p.supplier_name}</p>
              )}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
