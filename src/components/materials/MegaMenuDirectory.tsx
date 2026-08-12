'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { ArrowRight, ChevronRight } from 'lucide-react';
import {
  MACRO_DEDICATED_PAGE,
  fetchMacroProducts,
  type MegaCategory,
  type MacroProduct,
} from '@/lib/materialMacros';
import { countryFromLang } from '@/lib/country';
import { useSiteLocale } from '@/contexts/SiteLocaleContext';
import ProductPriceLine from './ProductPriceLine';

const GOLD = '#b8864a';
const GOLD_DARK = '#a07640';
const INK = '#1c1917';
const CREAM = '#faf9f7';

function categoryHref(c: MegaCategory): string {
  return MACRO_DEDICATED_PAGE[c.key] ?? `/materials/category/${c.key}`;
}

export default function MegaMenuDirectory({
  categories,
  loading,
}: {
  categories: MegaCategory[];
  loading: boolean;
}) {
  const country = countryFromLang(useSiteLocale().lang).code;

  // Desktop: which row is hovered → drives the floating mega panel
  const [activeKey, setActiveKey] = useState<string | null>(null);
  // Mobile: which row is expanded (accordion)
  const [openKey, setOpenKey] = useState<string | null>(null);

  // Hovered-category products, cached by key to avoid re-fetching
  const [products, setProducts] = useState<Record<string, MacroProduct[]>>({});
  const [productsLoading, setProductsLoading] = useState<string | null>(null);
  const fetchedRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!activeKey) return;
    if (fetchedRef.current.has(activeKey)) return;
    fetchedRef.current.add(activeKey);
    const key = activeKey;
    setProductsLoading(key);
    fetchMacroProducts(key, country)
      .then((res) => {
        setProducts((prev) => ({ ...prev, [key]: res.products.slice(0, 6) }));
      })
      .catch(() => {
        setProducts((prev) => ({ ...prev, [key]: [] }));
      })
      .finally(() => {
        setProductsLoading((cur) => (cur === key ? null : cur));
      });
  }, [activeKey, country]);

  if (loading) {
    return (
      <div className="rounded-2xl border border-stone-200 bg-white p-3">
        <ul className="space-y-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <li
              key={i}
              className="flex items-center gap-3 rounded-xl px-3 py-2.5"
            >
              <div className="h-10 w-10 animate-pulse rounded-lg bg-stone-200" />
              <div className="flex-1">
                <div className="mb-2 h-3 w-32 animate-pulse rounded bg-stone-200" />
                <div className="h-2.5 w-20 animate-pulse rounded bg-stone-100" />
              </div>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  const active = categories.find((c) => c.key === activeKey) ?? null;

  return (
    <div className="relative" onMouseLeave={() => setActiveKey(null)}>
      <div
        className="rounded-2xl border border-stone-200 bg-white p-2"
        style={{ backgroundColor: CREAM }}
      >
        <ul className="space-y-1">
          {categories.map((c) => {
            const isActive = activeKey === c.key;
            const isOpen = openKey === c.key;
            const cover = c.image;
            return (
              <li key={c.key}>
                {/* Row */}
                <div
                  role="button"
                  tabIndex={0}
                  onMouseEnter={() => setActiveKey(c.key)}
                  onClick={() => setOpenKey(isOpen ? null : c.key)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setOpenKey(isOpen ? null : c.key);
                    }
                  }}
                  className="group flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 transition-colors"
                  style={
                    isActive
                      ? { backgroundColor: 'rgba(184,134,74,0.10)' }
                      : undefined
                  }
                >
                  {/* Thumbnail */}
                  {cover ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={cover}
                      alt={c.label}
                      width={40}
                      height={40}
                      loading="lazy"
                      className="h-10 w-10 flex-none rounded-lg object-cover"
                      onError={(e) => {
                        e.currentTarget.style.visibility = 'hidden';
                      }}
                    />
                  ) : (
                    <div className="h-10 w-10 flex-none rounded-lg bg-stone-200" />
                  )}

                  {/* Label + count */}
                  <div className="min-w-0 flex-1">
                    <div
                      className="truncate text-sm font-medium"
                      style={{ color: isActive ? GOLD_DARK : INK }}
                    >
                      {c.label}
                    </div>
                    <div className="text-xs text-stone-500">
                      {c.productCount} products
                    </div>
                  </div>

                  {/* Chevron */}
                  <ChevronRight
                    className={`h-4 w-4 flex-none transition-transform lg:group-hover:translate-x-0.5 ${
                      isOpen ? 'rotate-90 lg:rotate-0' : ''
                    }`}
                    style={{ color: isActive ? GOLD : '#a8a29e' }}
                  />
                </div>

                {/* Mobile accordion (below lg) */}
                {isOpen && (
                  <div className="lg:hidden">
                    <MobilePanel category={c} />
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </div>

      {/* Desktop floating mega panel */}
      {active && (
        <div
          className="absolute left-full top-0 z-30 hidden lg:block"
          onMouseEnter={() => setActiveKey(active.key)}
        >
          <div className="ml-4 w-[720px] max-w-[760px] rounded-2xl border border-stone-200 bg-white p-6 shadow-2xl">
            <MegaPanel
              category={active}
              products={products[active.key]}
              loadingProducts={productsLoading === active.key}
            />
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------------- Desktop mega panel ---------------- */

function MegaPanel({
  category: c,
  products,
  loadingProducts,
}: {
  category: MegaCategory;
  products: MacroProduct[] | undefined;
  loadingProducts: boolean;
}) {
  const href = categoryHref(c);

  return (
    <div>
      {/* Header */}
      <div className="mb-4 flex items-end justify-between gap-4 border-b border-stone-100 pb-3">
        <div>
          <h3
            className="font-serif text-2xl leading-tight"
            style={{ color: INK }}
          >
            {c.label}
          </h3>
          <p className="mt-1 text-sm text-stone-500">
            {c.supplierCount} suppliers · {c.productCount} products
          </p>
        </div>
        <Link
          href={href}
          className="flex flex-none items-center gap-1 text-sm font-medium transition-colors"
          style={{ color: GOLD }}
          onMouseOver={(e) => (e.currentTarget.style.color = GOLD_DARK)}
          onMouseOut={(e) => (e.currentTarget.style.color = GOLD)}
        >
          View all in {c.label}
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>

      {/* Subcategory chips */}
      {c.subcategories.length > 0 && (
        <div className="mb-5">
          <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-stone-400">
            Browse by type
          </div>
          <div className="flex flex-wrap gap-2">
            {c.subcategories.map((s) => (
              <Link
                key={s.tag}
                href={href}
                className="inline-flex items-center gap-1.5 rounded-lg border border-stone-200 bg-white px-3 py-1.5 text-sm text-stone-700 transition-colors hover:border-transparent"
                style={{ backgroundColor: CREAM }}
                onMouseOver={(e) => {
                  e.currentTarget.style.backgroundColor = 'rgba(184,134,74,0.12)';
                  e.currentTarget.style.color = GOLD_DARK;
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.backgroundColor = CREAM;
                  e.currentTarget.style.color = '';
                }}
              >
                {s.label}
                {s.count > 0 && (
                  <span className="text-xs text-stone-400">{s.count}</span>
                )}
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Popular products */}
      <div className="mb-5">
        <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-stone-400">
          Popular products
        </div>
        <div className="flex gap-2">
          {loadingProducts || products === undefined ? (
            Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="h-20 w-20 flex-none animate-pulse rounded-lg bg-stone-100"
              />
            ))
          ) : products.length === 0 ? (
            <p className="text-sm text-stone-400">No products yet.</p>
          ) : (
            products.map((p) => {
              const content = (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={p.image_url}
                    alt={p.title}
                    width={80}
                    height={80}
                    loading="lazy"
                    className="h-20 w-20 flex-none rounded-lg object-cover ring-1 ring-stone-200 transition-transform hover:scale-[1.03]"
                  />
                  <ProductPriceLine product={p} compact />
                </>
              );
              return p.supplier_slug ? (
                <Link
                  key={p.id}
                  href={`/materials/suppliers/${p.supplier_slug}`}
                  className="w-20 flex-none"
                >
                  {content}
                </Link>
              ) : (
                <div key={p.id} className="w-20 flex-none">
                  {content}
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Featured suppliers */}
      {c.featuredSuppliers.length > 0 && (
        <div>
          <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-stone-400">
            Featured suppliers
          </div>
          <div className="flex flex-wrap gap-4">
            {c.featuredSuppliers.slice(0, 3).map((s) => (
              <Link
                key={s.slug}
                href={`/materials/suppliers/${s.slug}`}
                className="group flex items-center gap-2.5"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={s.image}
                  alt={s.name}
                  width={40}
                  height={40}
                  loading="lazy"
                  className="h-10 w-10 flex-none rounded-full object-cover ring-1 ring-stone-200"
                />
                <span
                  className="text-sm font-medium text-stone-700 transition-colors"
                  style={{ color: INK }}
                  onMouseOver={(e) => (e.currentTarget.style.color = GOLD_DARK)}
                  onMouseOut={(e) => (e.currentTarget.style.color = INK)}
                >
                  {s.name}
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------------- Mobile accordion panel ---------------- */

function MobilePanel({ category: c }: { category: MegaCategory }) {
  const href = categoryHref(c);
  return (
    <div className="mx-1 mb-2 mt-1 rounded-xl border border-stone-100 bg-white p-4">
      {/* Subcategory chips */}
      {c.subcategories.length > 0 && (
        <div className="mb-4 flex flex-wrap gap-2">
          {c.subcategories.map((s) => (
            <Link
              key={s.tag}
              href={href}
              className="inline-flex items-center gap-1.5 rounded-lg border border-stone-200 px-3 py-1.5 text-sm text-stone-700"
              style={{ backgroundColor: CREAM }}
            >
              {s.label}
              {s.count > 0 && (
                <span className="text-xs text-stone-400">{s.count}</span>
              )}
            </Link>
          ))}
        </div>
      )}

      {/* Featured suppliers */}
      {c.featuredSuppliers.length > 0 && (
        <div className="mb-3 space-y-3">
          {c.featuredSuppliers.slice(0, 3).map((s) => (
            <Link
              key={s.slug}
              href={`/materials/suppliers/${s.slug}`}
              className="flex items-center gap-2.5"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={s.image}
                alt={s.name}
                width={36}
                height={36}
                loading="lazy"
                className="h-9 w-9 flex-none rounded-full object-cover ring-1 ring-stone-200"
              />
              <span className="text-sm font-medium" style={{ color: INK }}>
                {s.name}
              </span>
            </Link>
          ))}
        </div>
      )}

      <Link
        href={href}
        className="inline-flex items-center gap-1 text-sm font-medium"
        style={{ color: GOLD }}
      >
        View all in {c.label}
        <ArrowRight className="h-4 w-4" />
      </Link>
    </div>
  );
}
