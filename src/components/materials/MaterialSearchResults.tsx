'use client';

// 材料关键词搜索结果网格：命中产品 → 点图弹画廊 + View Supplier 按钮。
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import Lightbox from '@/components/Lightbox';
import { fetchMaterialProducts, type PublicMaterialProduct } from '@/lib/materialsApi';
import { resolveImageUrl } from '@/lib/imageUrl';
import { countryFromLang } from '@/lib/country';
import { useSiteLocale } from '@/contexts/SiteLocaleContext';

export default function MaterialSearchResults({ query }: { query: string }) {
  const country = countryFromLang(useSiteLocale().lang).code;
  const [products, setProducts] = useState<PublicMaterialProduct[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [gallery, setGallery] = useState<{ images: { url: string; title: string }[]; index: number; title: string } | null>(null);

  useEffect(() => {
    const q = query.trim();
    if (!q) { setProducts([]); setTotal(0); return; }
    let on = true;
    setLoading(true);
    const timer = setTimeout(() => {
      fetchMaterialProducts({ q, limit: 48 }, country).then((r) => {
        if (!on) return;
        setProducts(r.products);
        setTotal(r.pagination.total);
        setLoading(false);
      });
    }, 300);
    return () => { on = false; clearTimeout(timer); };
  }, [query, country]);

  const openGallery = (p: PublicMaterialProduct) => {
    const urls = p.image_urls?.length ? p.image_urls : [p.image_url];
    const title = p.title || 'Material';
    setGallery({ images: urls.map((u) => ({ url: u, title })), index: 0, title });
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      {loading ? (
        <div className="flex justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#b8864a]/30 border-t-[#b8864a]" />
        </div>
      ) : products.length === 0 ? (
        <p className="py-20 text-center text-stone-400">No materials found for “{query.trim()}”.</p>
      ) : (
        <>
          <p className="mb-6 text-[13px] text-stone-400">{total} results for “{query.trim()}”</p>
          <div className="columns-2 gap-4 sm:columns-3 lg:columns-4 [column-fill:_balance]">
            {products.map((p) => (
              <div
                key={p.id}
                className="group mb-4 block break-inside-avoid overflow-hidden rounded-2xl border border-stone-200 bg-white transition hover:border-[#b8864a]/40 hover:shadow-sm"
              >
                <button
                  type="button"
                  onClick={() => openGallery(p)}
                  className="block w-full cursor-zoom-in overflow-hidden bg-white"
                  aria-label={`View ${p.title} gallery`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={resolveImageUrl(p.image_url)}
                    alt={`${p.title} — ${p.supplier_name || 'a China supplier'}, sourced through Tarmeer UAE`}
                    loading="lazy"
                    className="h-auto w-full transition duration-500 group-hover:scale-105"
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
        </>
      )}

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
