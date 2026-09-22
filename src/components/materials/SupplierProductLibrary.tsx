'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Grid2X2, LayoutGrid, PackageSearch, Play, Search, X } from 'lucide-react';
import SmartImage from '@/components/ui/SmartImage';
import FilterSidebar from '@/components/shared/FilterSidebar';
import { sanitizeDescription } from '@/lib/materialDescription';
import {
  filterIndexedSupplierProducts,
  indexSupplierProducts,
} from '@/lib/supplierProductLibrary';
import type { Product } from './SupplierDetailClient';

type Density = 'comfortable' | 'compact';

interface SupplierProductLibraryProps {
  products: Product[];
  categoryLabel: (category: string) => string;
  onOpenProduct: (product: Product) => void;
}

export default function SupplierProductLibrary({ products, categoryLabel, onOpenProduct }: SupplierProductLibraryProps) {
  const [query, setQuery] = useState('');
  const [selectedSeries, setSelectedSeries] = useState<string | null>(null);
  const [density, setDensity] = useState<Density>('comfortable');

  const indexedProducts = useMemo(() => indexSupplierProducts(products, categoryLabel), [products, categoryLabel]);

  const seriesOptions = useMemo(() => {
    const counts = new Map<string, number>();
    for (const item of indexedProducts) counts.set(item.series, (counts.get(item.series) || 0) + 1);
    return [...counts.entries()].map(([label, count]) => ({ label, count }));
  }, [indexedProducts]);

  const visibleProducts = useMemo(
    () => filterIndexedSupplierProducts(indexedProducts, selectedSeries, query),
    [indexedProducts, query, selectedSeries],
  );
  const seriesByProductId = useMemo(
    () => new Map(indexedProducts.map((item) => [item.product.id, item.series])),
    [indexedProducts],
  );

  useEffect(() => {
    if (selectedSeries && !seriesOptions.some((option) => option.label === selectedSeries)) {
      setSelectedSeries(null);
    }
  }, [selectedSeries, seriesOptions]);

  const clearFilters = () => {
    setQuery('');
    setSelectedSeries(null);
  };

  const renderSeriesFilters = (compact: boolean) => (
    <div className="space-y-1">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-stone-400">Collections</p>
          {!compact && <p className="mt-1 text-xs text-stone-500">Browse by material series</p>}
        </div>
      </div>
      <button
        type="button"
        onClick={() => setSelectedSeries(null)}
        aria-pressed={selectedSeries === null}
        className={`flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left text-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#b8864a] ${
          selectedSeries === null ? 'bg-[#f3eadc] font-semibold text-[#8c6333]' : 'text-stone-600 hover:bg-stone-50'
        }`}
      >
        <span>All materials</span>
        <span className="tabular-nums text-xs text-stone-400">{products.length}</span>
      </button>
      {seriesOptions.map((option) => (
        <button
          type="button"
          key={option.label}
          onClick={() => setSelectedSeries(option.label)}
          aria-pressed={selectedSeries === option.label}
          className={`flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left text-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#b8864a] ${
            selectedSeries === option.label ? 'bg-[#f3eadc] font-semibold text-[#8c6333]' : 'text-stone-600 hover:bg-stone-50'
          }`}
        >
          <span className="min-w-0 truncate pr-3">{option.label}</span>
          <span className="shrink-0 tabular-nums text-xs text-stone-400">{option.count}</span>
        </button>
      ))}
    </div>
  );

  return (
    <div className="w-full border-y border-stone-200/80 bg-[#f8f7f4] px-4 py-5 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1920px]">
        <div className="sticky top-[7.125rem] z-30 mb-5 rounded-2xl border border-stone-200/80 bg-white/95 p-3 backdrop-blur-md sm:p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <div className="min-w-0 flex-1">
              <label className="relative block">
                <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
                <input
                  type="search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  aria-label="Search materials"
                  name="material-search"
                  autoComplete="off"
                  placeholder="Search material name, series, colour or code"
                  className="h-11 w-full rounded-xl border border-stone-200 bg-white pl-11 pr-10 text-sm text-stone-800 outline-none transition placeholder:text-stone-400 focus:border-[#b8864a] focus:ring-2 focus:ring-[#b8864a]/10"
                />
                {query && (
                  <button
                    type="button"
                    onClick={() => setQuery('')}
                    aria-label="Clear search"
                    className="absolute right-2 top-1/2 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-stone-400 hover:bg-stone-100 hover:text-stone-700"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </label>
            </div>

            <div className="flex items-center justify-between gap-3 lg:justify-end">
              <p className="whitespace-nowrap text-xs text-stone-500">
                <span className="font-semibold tabular-nums text-stone-800">{visibleProducts.length}</span> of {products.length} materials
              </p>
              <div className="flex items-center rounded-xl border border-stone-200 bg-stone-50 p-1" role="group" aria-label="Grid density">
                <button
                  type="button"
                  onClick={() => setDensity('comfortable')}
                  aria-label="Comfortable grid"
                  aria-pressed={density === 'comfortable'}
                  className={`inline-flex h-8 w-8 items-center justify-center rounded-lg transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#b8864a] ${density === 'comfortable' ? 'bg-white text-[#b8864a]' : 'text-stone-400 hover:text-stone-700'}`}
                >
                  <Grid2X2 className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setDensity('compact')}
                  aria-label="Compact grid"
                  aria-pressed={density === 'compact'}
                  className={`inline-flex h-8 w-8 items-center justify-center rounded-lg transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#b8864a] ${density === 'compact' ? 'bg-white text-[#b8864a]' : 'text-stone-400 hover:text-stone-700'}`}
                >
                  <LayoutGrid className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="lg:flex lg:items-start lg:gap-5 xl:gap-7">
          <FilterSidebar
            hasActiveFilters={selectedSeries !== null || query.length > 0}
            onClearAll={clearFilters}
            renderFilters={renderSeriesFilters}
            filtersLabel="Material collections"
            clearLabel="Show all materials"
            desktopStickyTopClass="lg:top-[12.5rem]"
            desktopMaxHeightClass="lg:max-h-[calc(100vh-13.5rem)]"
            desktopFixed
            desktopFixedTop={200}
            mobileTriggerWrapperClass="sticky top-[11.75rem] z-30 mb-3 flex justify-end"
            closeOnMobileSelection
          />

          <div className="min-w-0 flex-1 lg:mt-0">
            {selectedSeries && (
              <div className="mb-4 flex items-center gap-2 text-sm">
                <span className="text-stone-500">Collection</span>
                <button
                  type="button"
                  onClick={() => setSelectedSeries(null)}
                  className="inline-flex min-w-0 max-w-full items-center gap-1.5 rounded-full bg-[#f3eadc] px-3 py-1.5 font-medium text-[#8c6333] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#b8864a]"
                >
                  <span className="truncate">{selectedSeries}</span><X className="h-3.5 w-3.5 shrink-0" />
                </button>
              </div>
            )}

            {visibleProducts.length > 0 ? (
              <div className={`grid gap-x-4 gap-y-6 ${
                density === 'compact'
                  ? 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6'
                  : 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5'
              }`}>
                {visibleProducts.map((product) => {
                  const series = seriesByProductId.get(product.id)!;
                  return (
                    <article
                      key={product.id}
                      className="group min-w-0 [content-visibility:auto] [contain-intrinsic-size:auto_210px] sm:[contain-intrinsic-size:auto_280px] lg:[contain-intrinsic-size:auto_320px]"
                    >
                      <button
                        type="button"
                        onClick={() => onOpenProduct(product)}
                        className="block w-full overflow-hidden rounded-xl border border-stone-200 bg-[#efede8] text-left transition-colors hover:border-[#c99a5f] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#b8864a] focus-visible:ring-offset-2"
                      >
                        <div className="relative aspect-[4/3] overflow-hidden">
                          <SmartImage
                            src={product.image_url}
                            variant="thumb"
                            alt={product.title_translated || product.title || 'Material'}
                            loading="lazy"
                            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.025]"
                          />
                          {product.video_url && (
                            <span className="absolute right-2 top-2 inline-flex items-center gap-1 rounded-full bg-black/65 px-2 py-1 text-[10px] font-semibold text-white backdrop-blur-sm">
                              <Play className="h-3 w-3 fill-current" /> Video
                            </span>
                          )}
                        </div>
                      </button>
                      <div className="pt-2.5">
                        <p className="truncate text-[10px] font-semibold uppercase tracking-[0.14em] text-[#a8773e]">{series}</p>
                        <Link
                          href={`/materials/products/${product.id}`}
                          className="mt-0.5 block truncate rounded-sm text-sm font-medium text-stone-800 transition-colors hover:text-[#b8864a] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#b8864a]"
                        >
                          {product.title_translated || product.title || 'Material'}
                        </Link>
                        {density === 'comfortable' && (() => {
                          const description = sanitizeDescription(product.description_translated || product.description);
                          return description ? <p className="mt-1 line-clamp-1 text-xs text-stone-500">{description}</p> : null;
                        })()}
                      </div>
                    </article>
                  );
                })}
              </div>
            ) : (
              <div className="flex min-h-[360px] flex-col items-center justify-center rounded-2xl border border-stone-200 bg-white px-6 text-center">
                <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-[#f3eadc] text-[#a8773e]">
                  <PackageSearch className="h-5 w-5" />
                </span>
                <h3 className="mt-4 text-base font-semibold text-stone-800">No matching materials</h3>
                <p className="mt-1 max-w-sm text-sm text-stone-500">Try another keyword or clear the selected collection.</p>
                <button type="button" onClick={clearFilters} className="mt-4 rounded-sm text-sm font-medium text-[#a8773e] hover:text-[#8c6333] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#b8864a]">
                  Show all materials
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
