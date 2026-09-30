'use client';

// Hub 右侧默认内容（未搜索时）：宽屏自适应商品网格。
import { useCallback, useEffect, useRef, useState } from 'react';
import { countryFromLang } from '@/lib/country';
import { useSiteLocale } from '@/contexts/SiteLocaleContext';
import { type MegaCategory } from '@/lib/materialMacros';
import { fetchMaterialProducts, type PublicMaterialProduct } from '@/lib/materialsApi';
import {
  createAutoLoadRequestGuard,
  hasAnotherAutoLoadPage,
  mergeAutoLoadPage,
  observeAutoLoad,
  requestAutoLoadPage,
} from '@/lib/materialAutoLoad';
import { materialsPositionKey, restoreDirectoryPages, type ProcurementFilters } from '@/lib/materialsProcurement';
import HubProductCard from './HubProductCard';

const MATERIAL_PAGE_SIZE = 24;
const directoryCache = new Map<string, { products: PublicMaterialProduct[]; total: number; page: number; hasMore: boolean; time: number }>();

function buildProductRequest(page: number, category?: string, filters: ProcurementFilters = {}) {
  return {
    page,
    limit: MATERIAL_PAGE_SIZE,
    category,
    balanced: !category && !Object.keys(filters).length,
    ...filters,
  };
}

export default function HubFeatured({
  selectedCategory,
  onShowAll,
  filters = {},
  returnTo,
}: {
  selectedCategory: MegaCategory | null;
  onShowAll: () => void;
  filters?: ProcurementFilters;
  returnTo?: string;
}) {
  const filterKey = JSON.stringify(filters);
  const country = countryFromLang(useSiteLocale().lang).code;
  const cacheKey = `${country}:${filterKey}`;
  const [products, setProducts] = useState<PublicMaterialProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadMoreError, setLoadMoreError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [displayedCategory, setDisplayedCategory] = useState<MegaCategory | null>(null);
  const [displayedFilterKey, setDisplayedFilterKey] = useState(filterKey);
  const [displayedCountry, setDisplayedCountry] = useState(country);
  const [retryNonce, setRetryNonce] = useState(0);
  const requestVersionRef = useRef(0);
  const loadMoreGuardRef = useRef(createAutoLoadRequestGuard());
  const loadMoreSentinelRef = useRef<HTMLDivElement>(null);

  const hasVisibleProducts = displayedCountry === country && products.length > 0;
  const hidesStaleCountryProducts = displayedCountry !== country;
  const displayedMatchesSelection = displayedFilterKey === filterKey && displayedCountry === country && displayedCategory?.key === selectedCategory?.key;
  const canLoadMore = hasVisibleProducts && displayedMatchesSelection && !refreshing && !error;

  useEffect(() => {
    let on = true;
    const cached = directoryCache.get(cacheKey);
    if (cached && Date.now() - cached.time < 300000 && retryNonce === 0) {
      setProducts(cached.products); setTotal(cached.total); setPage(cached.page); setHasMore(cached.hasMore);
      setDisplayedFilterKey(filterKey); setDisplayedCountry(country); setDisplayedCategory(selectedCategory); setLoading(false); setRefreshing(false); setError(null);
      requestVersionRef.current += 1; loadMoreGuardRef.current.reset(); setLoadingMore(false); setLoadMoreError(null);
      return () => { on = false; };
    }
    const requestVersion = requestVersionRef.current + 1;
    requestVersionRef.current = requestVersion;
    const canKeepVisibleProducts = false;
    setLoading(!canKeepVisibleProducts);
    setRefreshing(canKeepVisibleProducts);
    setLoadingMore(false);
    loadMoreGuardRef.current.reset();
    setLoadMoreError(null);
    setError(null);
    if (!canKeepVisibleProducts) {
      setProducts([]);
      setTotal(0);
      setHasMore(false);
      setDisplayedCategory(null);
      setDisplayedCountry(country);
    }
    let restorePage = 1;
    try {
      if (sessionStorage.getItem(materialsPositionKey(window.location.search)) !== null) {
        restorePage = Number(sessionStorage.getItem(`materials-pages:${cacheKey}`)) || 1;
      }
    } catch { /* Storage is optional; ordinary first-page loading still works. */ }
    restoreDirectoryPages(
      nextPage => fetchMaterialProducts(buildProductRequest(nextPage, selectedCategory?.key, filters), country),
      restorePage,
      () => on && requestVersionRef.current === requestVersion,
    ).then((result) => {
      if (on && requestVersionRef.current === requestVersion) {
        setError(result.error ?? null);
        if (!result.error) {
          setProducts(result.products);
          setTotal(result.pagination.total);
          setHasMore(result.pagination.page < result.pagination.totalPages);
          setPage(result.pagination.page);
          setDisplayedFilterKey(filterKey);
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
  }, [country, selectedCategory?.key, filterKey, retryNonce]);

  useEffect(() => {
    if (!loading && !refreshing && !error && displayedCountry === country && displayedFilterKey === filterKey && products.length) {
      directoryCache.set(cacheKey, { products, total, page, hasMore, time: Date.now() });
      try { sessionStorage.setItem(`materials-pages:${cacheKey}`, String(page)); } catch { /* optional storage */ }
      if (directoryCache.size > 12) directoryCache.delete(directoryCache.keys().next().value!);
    }
  }, [products, total, page, hasMore, loading, refreshing, error, country, displayedCountry, displayedFilterKey, filterKey, cacheKey]);
  useEffect(() => {
    if (loading || refreshing || error || !products.length) return;
    let y = 0;
    try { y = Number(sessionStorage.getItem(materialsPositionKey(window.location.search))); sessionStorage.removeItem(materialsPositionKey(window.location.search)); } catch { return; }
    if (y > 0) requestAnimationFrame(() => window.scrollTo({ top: y, behavior: 'instant' }));
  }, [loading, refreshing, error, products.length]);
  const loadMore = useCallback(async () => {
    if (!canLoadMore || !hasMore) return;
    const nextPage = page + 1;
    const outcome = await requestAutoLoadPage({
      guard: loadMoreGuardRef.current,
      onStart: () => {
        setLoadingMore(true);
        setLoadMoreError(null);
      },
      load: () => fetchMaterialProducts(
        buildProductRequest(nextPage, selectedCategory?.key, filters),
        country,
      ),
    });
    if (outcome.status === 'success') {
      const result = outcome.value;
      if (result.error) {
        setLoadMoreError(result.error);
      } else {
        setProducts((current) => mergeAutoLoadPage(current, result.products));
        setPage(nextPage);
        setTotal(result.pagination.total);
        setHasMore(hasAnotherAutoLoadPage(
          result.products.length,
          result.pagination.page,
          result.pagination.totalPages,
        ));
      }
    } else if (outcome.status === 'error') {
      setLoadMoreError('Products could not be loaded.');
    }
    if (outcome.status !== 'busy' && outcome.lockReleased) setLoadingMore(false);
  }, [canLoadMore, country, hasMore, page, selectedCategory, filterKey]);

  const shouldLoadMore = canLoadMore && hasMore;

  useEffect(() => {
    const target = loadMoreSentinelRef.current;
    if (!target || !shouldLoadMore || loadingMore || loadMoreError) return;
    return observeAutoLoad(target, () => void loadMore());
  }, [loadMore, loadMoreError, loadingMore, products.length, shouldLoadMore]);

  return (
    <div className="relative">
      <div className="mb-3 flex flex-col items-start justify-between gap-3 border-b border-stone-200/80 pb-3 sm:flex-row sm:items-end sm:gap-6">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#a8773e]">Product directory</p>
          <h2 className="mt-1.5 break-words font-serif text-3xl leading-none text-[#1c1917] sm:text-[2rem]">
            {displayedCategory ? displayedCategory.label : 'All products'}
            {!loading && !hidesStaleCountryProducts && (
              <span className="ml-2 align-middle font-sans text-sm font-normal text-stone-600">({total})</span>
            )}
          </h2>
        </div>
        {selectedCategory ? (
          <button type="button" onClick={onShowAll} className="shrink-0 rounded-full border border-[#d6b98e] bg-white px-4 py-2 text-[13px] font-semibold text-[#9a6d36] transition hover:border-[#b8864a] hover:bg-[#faf6ef]">
            Show all products
          </button>
        ) : (
          <span className="hidden text-[13px] text-stone-600 sm:block">Supplier sourcing coordinated by Tarmeer</span>
        )}
      </div>

      {loading || hidesStaleCountryProducts ? (
        <div className="flex justify-center py-16">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#b8864a]/30 border-t-[#b8864a]" />
        </div>
      ) : !hasVisibleProducts ? (
        <div className="py-12 text-center text-sm text-stone-600">
          <p>{error ? 'Products could not be loaded.' : 'No matching products. Try a broader search or clear your filters.'}</p>
          {!error && <button type="button" onClick={onShowAll} className="mt-3 font-semibold text-[#92652e] underline">Clear filters and show all</button>}
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
            {products.map((product) => <HubProductCard key={product.id} product={product} returnTo={returnTo} />)}
          </div>
          {shouldLoadMore && !loadMoreError && (
            <div
              ref={loadMoreSentinelRef}
              className="mt-6 flex h-16 items-center justify-center"
              role="status"
              aria-live="polite"
              aria-busy={loadingMore}
            >
              {loadingMore ? (
                <span className="inline-flex items-center gap-2 text-sm text-stone-500">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-[#b8864a]/30 border-t-[#b8864a]" />
                  Loading more products…
                </span>
              ) : (
                <span className="sr-only">More products load automatically as you scroll.</span>
              )}
            </div>
          )}
          {loadMoreError && (
            <div className="mt-6 text-center text-sm text-red-600" role="alert">
              <p>Could not load more products.</p>
              <button type="button" onClick={() => void loadMore()} className="mt-1 font-semibold text-[#b8864a] hover:text-[#a07640]">
                Retry
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
