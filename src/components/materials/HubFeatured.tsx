'use client';

// Hub 右侧默认内容（未搜索时）：宽屏自适应商品网格。
import { useEffect, useRef, useState } from 'react';
import { countryFromLang } from '@/lib/country';
import { useSiteLocale } from '@/contexts/SiteLocaleContext';
import { type MegaCategory } from '@/lib/materialMacros';
import { fetchMaterialProducts, type PublicMaterialProduct } from '@/lib/materialsApi';
import HubProductCard from './HubProductCard';

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
  const productRequest = { page: 1, limit: 24, category: selectedCategory?.key, balanced: !selectedCategory };

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
    fetchMaterialProducts(productRequest, country).then((result) => {
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
    const result = await fetchMaterialProducts({ ...productRequest, page: nextPage }, country);
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
      <div className="mb-6 flex flex-col items-start justify-between gap-3 border-b border-stone-200/80 pb-5 sm:flex-row sm:items-end sm:gap-6">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#a8773e]">Product directory</p>
          <h2 className="mt-1.5 break-words font-serif text-3xl leading-none text-[#1c1917] sm:text-[2rem]">
            {displayedCategory ? displayedCategory.label : 'All products'}
            {!loading && !hidesStaleCountryProducts && (
              <span className="ml-2 align-middle font-sans text-sm font-normal text-stone-400">({total})</span>
            )}
          </h2>
        </div>
        {selectedCategory ? (
          <button type="button" onClick={onShowAll} className="shrink-0 rounded-full border border-[#d6b98e] bg-white px-4 py-2 text-[13px] font-semibold text-[#9a6d36] transition hover:border-[#b8864a] hover:bg-[#faf6ef]">
            Show all products
          </button>
        ) : (
          <span className="hidden text-[13px] text-stone-400 sm:block">Curated from verified suppliers</span>
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
          <div className="grid grid-cols-2 gap-x-4 gap-y-7 sm:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
            {products.map((product) => <HubProductCard key={product.id} product={product} />)}
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
