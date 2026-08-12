'use client';

import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import type { SearchProduct, SearchSupplier } from '@/lib/materialMacros';
import ProductPriceLine from './ProductPriceLine';

export default function HubSearchResults({
  type,
  results,
  total,
  query,
  loading,
}: {
  type: 'products' | 'suppliers';
  results: (SearchProduct | SearchSupplier)[];
  total: number;
  query: string;
  loading: boolean;
}) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#b8864a]/30 border-t-[#b8864a]" />
      </div>
    );
  }

  return (
    <div>
      <p className="mb-4 text-sm text-stone-500">
        {total} results for “{query}”
      </p>

      {total === 0 ? (
        <div className="py-16 text-center">
          <p className="text-base font-medium text-[#1c1917]">
            No {type} match “{query}”.
          </p>
          <p className="mt-1 text-sm text-stone-500">
            Try a different keyword or broaden your search.
          </p>
        </div>
      ) : type === 'products' ? (
        <div className="columns-2 gap-4 sm:columns-3 lg:columns-4 [column-fill:_balance]">
          {results.map((item) => {
            const r = item as SearchProduct;
            return (
              <div
                key={r.id}
                className="group mb-4 block break-inside-avoid overflow-hidden rounded-2xl border border-stone-200 bg-white transition hover:border-[#b8864a]/40 hover:shadow-sm"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={r.image_url}
                  alt={r.title}
                  className="aspect-[4/3] w-full object-cover transition-transform duration-300 group-hover:scale-105"
                />
                <div className="p-3">
                  <p className="line-clamp-1 text-sm font-medium text-[#1c1917]">{r.title}</p>
                  <ProductPriceLine product={r} />
                  {r.supplier_name && (
                    <p className="mt-0.5 text-xs text-stone-500">{r.supplier_name}</p>
                  )}
                  {r.supplier_slug && (
                    <Link
                      href={`/materials/suppliers/${r.supplier_slug}`}
                      className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-[#b8864a] transition hover:text-[#a07640]"
                    >
                      View Supplier
                      <ArrowRight className="h-3 w-3" />
                    </Link>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {results.map((item) => {
            const s = item as SearchSupplier;
            const img = s.cover_image_url || s.first_product_image || s.logo_url;
            return (
              <Link
                key={s.id}
                href={`/materials/suppliers/${s.slug}`}
                className="group block overflow-hidden rounded-2xl border border-stone-200 bg-white transition hover:border-[#b8864a]/40 hover:shadow-sm"
              >
                <div className="relative">
                  {img ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={img}
                      alt={s.company_name}
                      className="aspect-video w-full object-cover transition-transform duration-300 group-hover:scale-105"
                    />
                  ) : (
                    <div className="aspect-video w-full bg-gradient-to-br from-stone-100 to-stone-200" />
                  )}
                  <span
                    className={`absolute left-2 top-2 rounded-full px-2 py-0.5 text-[10px] font-semibold text-white ${
                      s.origin === 'china' ? 'bg-red-600' : 'bg-[#b8864a]'
                    }`}
                  >
                    {s.origin === 'china' ? 'China' : 'Dubai'}
                  </span>
                </div>
                <div className="p-3">
                  <p className="line-clamp-1 text-sm font-medium text-[#1c1917]">{s.company_name}</p>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
