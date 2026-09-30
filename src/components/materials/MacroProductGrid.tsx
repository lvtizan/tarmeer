'use client';

// 分类产品直达详情，保留独立供应商与图片放大入口。
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, ZoomIn } from 'lucide-react';
import { countryFromLang } from '@/lib/country';
import { useSiteLocale } from '@/contexts/SiteLocaleContext';
import { fetchMacroProducts, PREMIUM_MATERIALS, type MacroProduct } from '@/lib/materialMacros';
import Lightbox from '@/components/Lightbox';
import ProductPriceLine from './ProductPriceLine';
import MaterialImage from './MaterialImage';
import { materialProductTitle } from '@/lib/materialsProcurement';
import { supplierFromProductsHref } from '@/lib/materialsNavigation';

export default function MacroProductGrid({ macroKey, label }: { macroKey: string; label: string }) {
  const country = countryFromLang(useSiteLocale().lang).code;
  const [products, setProducts] = useState<MacroProduct[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const isPremium = PREMIUM_MATERIALS.some((p) => p.key === macroKey);
  // 独立放大按钮打开该产品全部图片。
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
            ? `Tell us your project and we'll share ${label.toLowerCase()} options, specs and trade pricing through Tarmeer. Availability, delivery and service scope will be confirmed in your quote.`
            : 'Tell Tarmeer what you need. Our team will review sourcing options and confirm availability.'}
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
      <p className="mb-6 text-[13px] text-stone-400">{total} product{total !== 1 ? 's' : ''} · Sourcing coordinated by Tarmeer</p>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {products.map((p) => (
          <div
            key={p.id}
            className="group mb-4 block break-inside-avoid overflow-hidden rounded-2xl border border-stone-200 bg-white transition hover:border-[#b8864a]/40 hover:shadow-sm"
          >
            <div className="relative aspect-[4/3] overflow-hidden bg-white">
              <MaterialImage key={p.image_url} src={p.image_url} alt={materialProductTitle(p)} />
              <Link href={`/materials/products/${p.id}?returnTo=${encodeURIComponent(`/materials?category=${macroKey}`)}`} aria-label={`View ${materialProductTitle(p)}`} className="absolute inset-0 focus-visible:ring-2 focus-visible:ring-[#b8864a]" />
              <button type="button" onClick={() => openGallery(p)} aria-label={`Enlarge ${materialProductTitle(p)}`} className="absolute right-2 top-2 rounded-full bg-white/95 p-2 text-stone-800 shadow-sm"><ZoomIn className="h-4 w-4" /></button>
            </div>
            <div className="p-3">
              <Link href={`/materials/products/${p.id}?returnTo=${encodeURIComponent(`/materials?category=${macroKey}`)}`} className="line-clamp-2 text-sm font-medium text-[#1c1917] hover:text-[#92652e]">{materialProductTitle(p)}</Link>
              <ProductPriceLine product={p} />
              <p className="mt-1 text-xs text-stone-600">Via Tarmeer · Supplier #{p.supplier_id}</p>
              {p.supplier_slug && (
                <Link
                  href={supplierFromProductsHref(p.supplier_slug)}
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
