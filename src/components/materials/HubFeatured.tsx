'use client';

// Hub 右侧默认内容（未搜索时）：按热度展示单品(popular products)。
// 大类浏览已在左侧目录，这里不再重复类目——改成热门单品瀑布流，点进供应商。
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { countryFromLang } from '@/lib/country';
import { useSiteLocale } from '@/contexts/SiteLocaleContext';
import { fetchPopularProducts, type PopularProduct } from '@/lib/materialMacros';
import ProductPriceLine from './ProductPriceLine';

export default function HubFeatured() {
  const country = countryFromLang(useSiteLocale().lang).code;
  const [products, setProducts] = useState<PopularProduct[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let on = true;
    setLoading(true);
    fetchPopularProducts(country, 16).then((p) => {
      if (on) {
        setProducts(p);
        setLoading(false);
      }
    });
    return () => {
      on = false;
    };
  }, [country]);

  return (
    <div>
      <div className="mb-5 flex items-center justify-between">
        <h3 className="text-sm font-semibold uppercase tracking-[0.16em] text-stone-500">Popular products</h3>
        <span className="text-[13px] text-stone-400">Sourced from China · seen in Dubai</span>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#b8864a]/30 border-t-[#b8864a]" />
        </div>
      ) : products.length === 0 ? (
        <p className="py-12 text-center text-sm text-stone-400">No products yet.</p>
      ) : (
        <div className="columns-2 gap-4 sm:columns-3 lg:columns-4 [column-fill:_balance]">
          {products.map((p) => (
            <div
              key={p.id}
              className="group mb-4 block break-inside-avoid overflow-hidden rounded-2xl border border-stone-200 bg-white transition hover:border-[#b8864a]/40 hover:shadow-sm"
            >
              <Link href={p.supplier_slug ? `/materials/suppliers/${p.supplier_slug}` : '#'} className="block overflow-hidden bg-white">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={p.image_url}
                  alt={`${p.title}${p.supplier_name ? ' — ' + p.supplier_name : ''}, sourced from China through Tarmeer UAE`}
                  loading="lazy"
                  className="aspect-[4/3] w-full object-cover transition duration-500 group-hover:scale-105"
                />
              </Link>
              <div className="p-3">
                <p className="line-clamp-1 text-sm font-medium text-[#1c1917]">{p.title}</p>
                <ProductPriceLine product={p} />
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
      )}
    </div>
  );
}
