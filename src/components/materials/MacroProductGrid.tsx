'use client';

// 大类产品展示（从供应商图库聚合）→ 点产品穿透到供应商。Premium/空类 → 引导询价。
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { countryFromLang } from '@/lib/country';
import { useSiteLocale } from '@/contexts/SiteLocaleContext';
import { fetchMacroProducts, PREMIUM_MATERIALS, type MacroProduct } from '@/lib/materialMacros';
import Lightbox from '@/components/Lightbox';

export default function MacroProductGrid({ macroKey, label }: { macroKey: string; label: string }) {
  const country = countryFromLang(useSiteLocale().lang).code;
  const [products, setProducts] = useState<MacroProduct[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const isPremium = PREMIUM_MATERIALS.some((p) => p.key === macroKey);
  // 点产品 → 弹画廊（该产品全部图）；「查看供应商」按钮才跳供应商页
  const [gallery, setGallery] = useState<{ images: { url: string; title: string }[]; index: number; title: string } | null>(null);
  const openGallery = (p: MacroProduct) => {
    const urls = p.image_urls?.length ? p.image_urls : [p.image_url];
    setGallery({ images: urls.map((u) => ({ url: u, title: p.title })), index: 0, title: p.title });
  };

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
      {/* 瀑布流(masonry)：每张图按自然比例(w-full h-auto)，高图高/宽图宽，无上下留白——算法自适应 */}
      <div className="columns-2 gap-4 sm:columns-3 lg:columns-4 [column-fill:_balance]">
        {products.map((p) => (
          <div
            key={p.id}
            className="group mb-4 block break-inside-avoid overflow-hidden rounded-2xl border border-stone-200 bg-white transition hover:border-[#b8864a]/40 hover:shadow-sm"
          >
            {/* 点图 → 弹画廊 */}
            <button
              type="button"
              onClick={() => openGallery(p)}
              className="block w-full cursor-zoom-in overflow-hidden bg-white"
              aria-label={`View ${p.title} gallery`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={p.image_url}
                alt={`${p.title} — ${label} from ${p.supplier_name ?? 'a China supplier'}, sourced through Tarmeer UAE`}
                loading="lazy"
                className="w-full h-auto transition duration-500 group-hover:scale-105"
              />
            </button>
            <div className="p-3">
              <p className="line-clamp-1 text-sm font-medium text-[#1c1917]">{p.title}</p>
              {p.supplier_name && (
                <p className="mt-0.5 line-clamp-1 text-[12px] text-stone-500">{p.supplier_name}</p>
              )}
              {p.supplier_slug && (
                <Link
                  href={`/materials/suppliers/${p.supplier_slug}`}
                  className="mt-2 inline-flex items-center gap-1 text-[12px] font-semibold text-[#b8864a] transition hover:text-[#a07640]"
                >
                  View Supplier <ArrowRight className="h-3 w-3" />
                </Link>
              )}
            </div>
          </div>
        ))}
      </div>

      {gallery && (
        <Lightbox
          open
          images={gallery.images}
          currentIndex={gallery.index}
          categoryName={gallery.title}
          onClose={() => setGallery(null)}
          onNavigate={(i) => setGallery((g) => (g ? { ...g, index: i } : g))}
        />
      )}
    </div>
  );
}
