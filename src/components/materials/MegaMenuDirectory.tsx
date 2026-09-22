'use client';

import { useCallback, useState, useEffect, useRef } from 'react';
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
import { getMegaMenuFlyoutPlacement } from '@/lib/megaMenuFlyout';
import { shouldCloseMegaMenu, shouldReturnToCategoryFromFlyout } from '@/lib/megaMenuFocus';
import { supplierFromProductsHref } from '@/lib/materialsNavigation';
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
  selectedKey,
  onSelectCategory,
}: {
  categories: MegaCategory[];
  loading: boolean;
  selectedKey: string | null;
  onSelectCategory: (category: MegaCategory) => void;
}) {
  const country = countryFromLang(useSiteLocale().lang).code;

  // Desktop: which row is hovered → drives the floating mega panel
  const [activeKey, setActiveKey] = useState<string | null>(null);
  // Mobile: which row is expanded (accordion)
  const [openKey, setOpenKey] = useState<string | null>(null);
  const [isDesktop, setIsDesktop] = useState(false);

  // Hovered-category products, cached by key to avoid re-fetching
  const [products, setProducts] = useState<Record<string, MacroProduct[]>>({});
  const [productsLoading, setProductsLoading] = useState<string | null>(null);
  const fetchedRef = useRef<Set<string>>(new Set());
  const menuRef = useRef<HTMLDivElement>(null);
  const activeRowRef = useRef<HTMLDivElement>(null);
  const flyoutRef = useRef<HTMLDivElement>(null);
  const suppressNextFocusRef = useRef(false);
  const activeCategory = categories.find((category) => category.key === activeKey) ?? null;
  const [flyoutPlacement, setFlyoutPlacement] = useState({ top: 0, maxHeight: 0, minHeight: 0 });

  const repositionActiveFlyout = useCallback(() => {
    const row = activeRowRef.current;
    const menuRect = menuRef.current?.getBoundingClientRect();
    if (!row || !menuRect) return;
    setFlyoutPlacement(getMegaMenuFlyoutPlacement({
      menuTop: menuRect.top,
      rowTop: row.getBoundingClientRect().top,
      viewportHeight: window.innerHeight,
    }));
  }, []);

  const activateCategory = (key: string, row: HTMLDivElement) => {
    setActiveKey(key);
    activeRowRef.current = row;
    repositionActiveFlyout();
  };

  const closeFlyout = (isFocusMove: boolean, nextFocusWithin = false) => {
    const hasFocusWithin = Boolean(menuRef.current?.contains(document.activeElement));
    if (shouldCloseMegaMenu({ isFocusMove, hasFocusWithin, nextFocusWithin })) setActiveKey(null);
  };

  useEffect(() => {
    const desktopQuery = window.matchMedia('(min-width: 1024px)');
    const syncViewport = () => {
      setIsDesktop(desktopQuery.matches);
      if (!desktopQuery.matches) setActiveKey(null);
    };
    syncViewport();
    desktopQuery.addEventListener('change', syncViewport);
    return () => desktopQuery.removeEventListener('change', syncViewport);
  }, []);

  useEffect(() => {
    if (!activeKey || !activeRowRef.current) return;
    window.addEventListener('resize', repositionActiveFlyout);
    return () => window.removeEventListener('resize', repositionActiveFlyout);
  }, [activeKey, repositionActiveFlyout]);

  useEffect(() => {
    if (!activeKey) return;
    const cacheKey = `${country}:${activeKey}`;
    if (fetchedRef.current.has(cacheKey)) return;
    fetchedRef.current.add(cacheKey);
    setProductsLoading(cacheKey);
    fetchMacroProducts(activeKey, country)
      .then((res) => {
        setProducts((prev) => ({ ...prev, [cacheKey]: res.products.slice(0, 6) }));
      })
      .catch(() => {
        setProducts((prev) => ({ ...prev, [cacheKey]: [] }));
      })
      .finally(() => {
        setProductsLoading((cur) => (cur === cacheKey ? null : cur));
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

  return (
    <div
      ref={menuRef}
      className="relative"
      onMouseLeave={() => closeFlyout(false)}
      onBlurCapture={(event) => closeFlyout(true, event.currentTarget.contains(event.relatedTarget))}
    >
      <div
        className="rounded-2xl border border-stone-200 bg-white p-2"
        style={{ backgroundColor: CREAM }}
      >
        <ul
          className="space-y-1 lg:max-h-[calc(100vh-8rem)] lg:overflow-y-auto lg:pr-1"
          onScroll={repositionActiveFlyout}
        >
          {categories.map((c) => {
            const isActive = activeKey === c.key;
            const isOpen = openKey === c.key;
            const cover = c.image;
            return (
              <li key={c.key} className="relative">
                {/* Row */}
                <div
                  role="button"
                  tabIndex={0}
                  onMouseEnter={(event) => {
                    if (isDesktop) activateCategory(c.key, event.currentTarget);
                  }}
                  onFocus={(event) => {
                    if (!isDesktop) return;
                    if (suppressNextFocusRef.current) {
                      suppressNextFocusRef.current = false;
                      return;
                    }
                    activateCategory(c.key, event.currentTarget);
                  }}
                  onClick={() => {
                    onSelectCategory(c);
                    setOpenKey(isOpen ? null : c.key);
                  }}
                  onKeyDown={(e) => {
                    if (isDesktop && e.key === 'ArrowRight') {
                      e.preventDefault();
                      activateCategory(c.key, e.currentTarget);
                      requestAnimationFrame(() => flyoutRef.current?.focus());
                      return;
                    }
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      onSelectCategory(c);
                      setOpenKey(isOpen ? null : c.key);
                    }
                    if (e.key === 'Escape') setActiveKey(null);
                  }}
                  aria-expanded={isDesktop ? activeKey === c.key : isOpen}
                  aria-controls={
                    isDesktop
                      ? (activeKey === c.key ? 'material-category-flyout' : undefined)
                      : (isOpen ? `material-category-mobile-${c.key}` : undefined)
                  }
                  className="group flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 transition-colors"
                  style={
                    isActive || selectedKey === c.key
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
                  <div id={`material-category-mobile-${c.key}`} className="lg:hidden">
                    <MobilePanel category={c} />
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </div>
      {/* Keep the scrollable category list separate from the desktop flyout: overflow on the
          list must never clip the preview panel. The panel stays inside this hover boundary. */}
      {activeCategory && (
        <div
          className="absolute left-full z-30 hidden pl-4 lg:block"
          onMouseEnter={() => setActiveKey(activeCategory.key)}
          style={{ top: flyoutPlacement.top }}
        >
          <div
            ref={flyoutRef}
            id="material-category-flyout"
            role="region"
            aria-label={`${activeCategory.label} category preview`}
            tabIndex={-1}
            className="w-[720px] max-w-[760px] overflow-y-auto rounded-2xl border border-stone-200 bg-white p-6 shadow-2xl"
            style={{ maxHeight: flyoutPlacement.maxHeight, minHeight: flyoutPlacement.minHeight }}
            onKeyDown={(event) => {
              if (shouldReturnToCategoryFromFlyout({
                isShiftTab: event.key === 'Tab' && event.shiftKey,
                isFlyoutRoot: event.target === event.currentTarget,
              })) {
                event.preventDefault();
                setActiveKey(null);
                suppressNextFocusRef.current = true;
                activeRowRef.current?.focus();
                return;
              }
              if (event.key !== 'Escape') return;
              event.preventDefault();
              setActiveKey(null);
              suppressNextFocusRef.current = true;
              activeRowRef.current?.focus();
            }}
          >
            <MegaPanel
              category={activeCategory}
              products={products[`${country}:${activeCategory.key}`]}
              loadingProducts={productsLoading === `${country}:${activeCategory.key}`}
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
                  href={supplierFromProductsHref(p.supplier_slug)}
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
