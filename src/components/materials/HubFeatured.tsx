'use client';

// Hub 右侧默认内容（未搜索时）：最新上架商品瀑布流。
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { countryFromLang } from '@/lib/country';
import { useSiteLocale } from '@/contexts/SiteLocaleContext';
import { resolveImageUrl } from '@/lib/imageUrl';
import { supplierFromProductsHref } from '@/lib/materialsNavigation';
import { type MegaCategory } from '@/lib/materialMacros';
import { fetchMaterialProducts, type PublicMaterialProduct } from '@/lib/materialsApi';
import ProductPriceLine from './ProductPriceLine';

function isValidSupplierSlug(slug: string | null): slug is string {
  return typeof slug === 'string' && /^[a-zA-Z0-9_-]+$/.test(slug);
}

export default function HubFeatured({
  selectedCategory,
  onShowAll,
}: {
  selectedCategory: MegaCategory | null;
  onShowAll: () => void;
}) {
  const country = countryFromLang(useSiteLocale().lang).code;
  const [products, setProducts] = useState<PublicMaterialProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [displayedCategory, setDisplayedCategory] = useState<MegaCategory | null>(null);
  const [displayedCountry, setDisplayedCountry] = useState(country);
  const [retryNonce, setRetryNonce] = useState(0);
  const requestVersionRef = useRef(0);

  const hasVisibleProducts = displayedCountry === country && products.length > 0;
  const hidesStaleCountryProducts = displayedCountry !== country;
  const displayedMatchesSelection = displayedCountry === country && displayedCategory?.key === selectedCategory?.key;
  const canLoadMore = hasVisibleProducts && displayedMatchesSelection && !refreshing && !error;

  useEffect(() => {
    let on = true;
    const requestVersion = requestVersionRef.current + 1;
    requestVersionRef.current = requestVersion;
    const canKeepVisibleProducts = displayedCountry === country && products.length > 0;
    setLoading(!canKeepVisibleProducts);
    setRefreshing(canKeepVisibleProducts);
    setLoadingMore(false);
    setError(null);
    if (!canKeepVisibleProducts) {
      setProducts([]);
      setTotal(0);
      setDisplayedCategory(null);
      setDisplayedCountry(country);
    }
    fetchMaterialProducts({ page: 1, limit: 24, category: selectedCategory?.key }, country).then((result) => {
      if (on && requestVersionRef.current === requestVersion) {
        setError(result.error ?? null);
        if (!result.error) {
          setProducts(result.products);
          setTotal(result.pagination.total);
          setPage(1);
          setDisplayedCategory(selectedCategory);
          setDisplayedCountry(country);
        }
        setLoading(false);
        setRefreshing(false);
      }
    });
    return () => {
      on = false;
    };
  }, [country, selectedCategory?.key, retryNonce]);

  const loadMore = async () => {
    if (!canLoadMore || loadingMore) return;
    const nextPage = page + 1;
    const requestVersion = requestVersionRef.current;
    setLoadingMore(true);
    setError(null);
    const result = await fetchMaterialProducts({ page: nextPage, limit: 24, category: selectedCategory?.key }, country);
    if (requestVersionRef.current !== requestVersion) return;
    if (result.error) {
      setError(result.error);
      setLoadingMore(false);
      return;
    }
    setProducts((current) => [...current, ...result.products]);
    setPage(nextPage);
    setTotal(result.pagination.total);
    setLoadingMore(false);
  };

  return (
    <div className="relative">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold uppercase tracking-[0.16em] text-stone-500">
            {displayedCategory ? displayedCategory.label : 'All products'}
          </h3>
          {!loading && !hidesStaleCountryProducts && <p className="mt-1 text-[13px] text-stone-400">{total} products</p>}
        </div>
        {selectedCategory ? (
          <button type="button" onClick={onShowAll} className="text-[13px] font-semibold text-[#b8864a] hover:text-[#a07640]">
            Show all products
          </button>
        ) : (
          <span className="text-[13px] text-stone-400">Sourced from China · seen in Dubai</span>
        )}
      </div>

      {loading || hidesStaleCountryProducts ? (
        <div className="flex justify-center py-16">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#b8864a]/30 border-t-[#b8864a]" />
        </div>
      ) : !hasVisibleProducts ? (
        <div className="py-12 text-center text-sm text-stone-400">
          <p>{error ? 'Products could not be loaded.' : 'No products yet.'}</p>
          {error && (
            <button type="button" onClick={() => setRetryNonce((value) => value + 1)} className="mt-3 font-semibold text-[#b8864a] hover:text-[#a07640]">
              Retry
            </button>
          )}
        </div>
      ) : (
        <>
          {refreshing && (
            <div className="pointer-events-none absolute right-0 top-0 z-10 rounded-full border border-stone-200 bg-white/95 px-3 py-1 text-xs font-medium text-stone-500 shadow-sm" aria-live="polite" aria-busy="true">
              Updating products…
            </div>
          )}
          <div className="columns-2 gap-4 sm:columns-3 lg:columns-4 [column-fill:_balance]">
            {products.map((p) => {
            const supplierSlug = isValidSupplierSlug(p.supplier_slug) ? p.supplier_slug : null;
            const card = (
              <>
                <div className="block overflow-hidden bg-white">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={resolveImageUrl(p.image_url)}
                    alt={`${p.title}${p.supplier_name ? ' — ' + p.supplier_name : ''}, sourced from China through Tarmeer UAE`}
                    loading="lazy"
                    className="aspect-[4/3] w-full object-cover transition duration-500 group-hover:scale-105"
                  />
                </div>
                <div className="p-3">
                  <p className="line-clamp-1 text-sm font-medium text-[#1c1917]">{p.title}</p>
                  <ProductPriceLine product={p} />
                  {p.supplier_name && (
                    <p className="mt-0.5 line-clamp-1 text-[12px] text-stone-500">{p.supplier_name}</p>
                  )}
                  {supplierSlug && (
                    <span className="mt-2 inline-flex items-center gap-1 text-[12px] font-semibold text-[#b8864a] transition group-hover:text-[#a07640]">
                      View Supplier <ArrowRight className="h-3 w-3" />
                    </span>
                  )}
                </div>
              </>
            );
            const className = 'group mb-4 block break-inside-avoid overflow-hidden rounded-2xl border border-stone-200 bg-white transition hover:border-[#b8864a]/40 hover:shadow-sm';
            if (supplierSlug) {
              return (
                <Link key={p.id} href={supplierFromProductsHref(supplierSlug)} className={`${className} cursor-pointer`}>
                  {card}
                </Link>
              );
            }
            return (
              <div key={p.id} className={className}>
                {card}
              </div>
            );
            })}
          </div>
          {canLoadMore && products.length < total && (
            <div className="mt-7 flex justify-center">
              <button type="button" onClick={loadMore} disabled={loadingMore} className="rounded-xl border border-[#b8864a] px-5 py-2.5 text-sm font-semibold text-[#b8864a] transition hover:bg-[#faf6ef] disabled:opacity-40">
                {loadingMore ? 'Loading…' : 'Load more products'}
              </button>
            </div>
          )}
          {error && (
            <div className="mt-3 text-center text-sm text-red-600">
              <p>Could not update products.</p>
              <button type="button" onClick={() => setRetryNonce((value) => value + 1)} className="mt-1 font-semibold text-[#b8864a] hover:text-[#a07640]">Retry</button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
