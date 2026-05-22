import { useState, useEffect, useLayoutEffect, useCallback, useRef, useMemo } from 'react';
import { Helmet } from 'react-helmet-async';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { X } from 'lucide-react';
import { resolveImageUrl, resolveVariantUrl } from '../lib/imageUrl';
import { fetchPortfolioFeed, type PortfolioImage } from '../lib/publicApi';
import { DEFAULT_RATIO, GAP, TARGET_ROW_HEIGHT, justifyRows } from '../lib/justifyRows';

// Removed MAX_IMAGES_PER_GROUP — no longer grouping by project

/* ================================================================== */
/*  Image preloader with RAF batching                                  */
/* ================================================================== */

interface ImgMeta {
  src: string;
  ratio: number;    // 0 = hidden/error
  loaded: boolean;
}

function useImagePreloader(
  urls: string[],
  initialRatios?: number[],
  onRatios?: (ratios: number[]) => void,
): ImgMeta[] {
  // Snapshot initialRatios on first mount; subsequent re-renders must not
  // "un-load" already-loaded items.
  const initialRef = useRef(initialRatios);
  const onRatiosRef = useRef(onRatios);
  useEffect(() => { onRatiosRef.current = onRatios; }, [onRatios]);

  const [items, setItems] = useState<ImgMeta[]>(() =>
    urls.map((src, i) => {
      const r = initialRef.current?.[i];
      if (typeof r === 'number') {
        // r === 0 means hidden (filtered previously)
        return { src, ratio: r, loaded: true };
      }
      return { src, ratio: DEFAULT_RATIO, loaded: false };
    })
  );
  const pendingRef = useRef<Map<number, { ratio: number; hidden: boolean }>>(new Map());
  const rafRef = useRef(0);

  const flush = useCallback(() => {
    const batch = new Map(pendingRef.current);
    pendingRef.current.clear();
    if (batch.size === 0) return;

    setItems(prev => {
      const next = [...prev];
      for (const [idx, u] of batch) {
        if (next[idx]) next[idx] = { src: next[idx].src, ratio: u.hidden ? 0 : u.ratio, loaded: true };
      }
      // All loaded? report ratios up
      if (onRatiosRef.current && next.every(it => it.loaded)) {
        onRatiosRef.current(next.map(it => it.ratio));
      }
      return next;
    });
  }, []);

  useEffect(() => {
    pendingRef.current.clear();

    // Re-initialize items if the URL list changed (new project/page)
    const cached = initialRef.current;
    const nextItems = urls.map((src, i) => {
      const r = cached?.[i];
      if (typeof r === 'number') return { src, ratio: r, loaded: true };
      return { src, ratio: DEFAULT_RATIO, loaded: false };
    });
    setItems(nextItems);

    // If every item has a cached ratio, we're done — report and skip network
    if (nextItems.every(it => it.loaded)) {
      onRatiosRef.current?.(nextItems.map(it => it.ratio));
      return;
    }

    // Per-image 10s safety timeout — if the browser never fires onload/onerror
    // (stalled connection, CORS hang, etc.), we mark the image as hidden so the
    // group can finish loading and decide whether to render.
    const timeouts: number[] = [];

    urls.forEach((src, i) => {
      // Skip items that already have a cached ratio
      if (typeof cached?.[i] === 'number') return;

      const img = new Image();
      let settled = false;
      const settle = (ratio: number, hidden: boolean) => {
        if (settled) return;
        settled = true;
        pendingRef.current.set(i, { ratio, hidden });
        cancelAnimationFrame(rafRef.current);
        rafRef.current = requestAnimationFrame(flush);
      };
      img.onload = () => {
        const w = img.naturalWidth, h = img.naturalHeight, ratio = w / h;
        const hidden = w < 200 || h < 150 || ratio > 3.5 || ratio < 0.25;
        settle(ratio, hidden);
      };
      img.onerror = () => settle(0, true);
      img.src = resolveVariantUrl(src, 'thumb'); // Use thumb for fast dimension detection

      // Safety timeout (10s). Marks the image as hidden so the group resolves.
      const t = window.setTimeout(() => {
        if (!settled) {
          img.onload = null;
          img.onerror = null;
          settle(0, true);
        }
      }, 10000);
      timeouts.push(t);
    });

    return () => {
      cancelAnimationFrame(rafRef.current);
      timeouts.forEach(t => clearTimeout(t));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urls.join('|')]);

  return items;
}

/* ================================================================== */
/*  JustifiedGallery component                                         */
/* ================================================================== */

function JustifiedGallery({
  items,
  onItemClick,
  renderOverlay,
  remainingCount,
}: {
  items: ImgMeta[];
  onItemClick: (index: number) => void;
  renderOverlay?: (index: number) => React.ReactNode;
  remainingCount?: number;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(0);

  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    setContainerWidth(el.offsetWidth);
    const ro = new ResizeObserver(() => setContainerWidth(el.offsetWidth));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const visibleItems = useMemo(() => items.filter(it => it.ratio > 0), [items]);
  const ratios = useMemo(() => visibleItems.map(it => it.ratio), [visibleItems]);
  const rows = useMemo(
    () => containerWidth > 0 ? justifyRows(ratios, containerWidth, TARGET_ROW_HEIGHT) : [],
    [ratios, containerWidth],
  );

  return (
    <div ref={containerRef} style={{ display: 'flex', flexDirection: 'column', gap: `${GAP}px` }}>
      {rows.map((row, ri) => (
        <div key={ri} style={{ display: 'flex', gap: `${GAP}px` }}>
          {Array.from({ length: row.count }, (_, wi) => {
            const vi = row.startIdx + wi;
            const item = visibleItems[vi];
            if (!item) return null;
            const origIdx = items.indexOf(item);
            const isLast = vi === visibleItems.length - 1 && (remainingCount || 0) > 0;

            return (
              <div
                key={wi}
                className="relative rounded-xl overflow-hidden cursor-pointer group flex-shrink-0"
                style={{ width: row.widths[wi], height: row.height }}
                onClick={() => onItemClick(origIdx)}
              >
                {!item.loaded && (
                  <div
                    className="absolute inset-0"
                    style={{
                      backgroundImage: 'linear-gradient(90deg, #e7e5e4 25%, #d6d3d1 50%, #e7e5e4 75%)',
                      backgroundSize: '200% 100%',
                      animation: 'shimmer 1.5s infinite',
                    }}
                  />
                )}
                <img
                  src={resolveVariantUrl(item.src, 'thumb')}
                  alt="Interior design project"
                  loading="lazy"
                  decoding="async"
                  onError={(e) => {
                    const img = e.currentTarget as HTMLImageElement;
                    if (img.dataset.fallback !== '1') {
                      img.dataset.fallback = '1';
                      img.src = resolveImageUrl(item.src);
                    }
                  }}
                  className={`w-full h-full object-cover transition-all duration-300 group-hover:scale-105 ${item.loaded ? 'opacity-100' : 'opacity-0'}`}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                {renderOverlay?.(origIdx)}
                {isLast && (
                  <div className="absolute inset-0 bg-black/50 flex items-center justify-center rounded-xl">
                    <span className="text-white text-lg font-semibold">+{remainingCount} more</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

/* ================================================================== */
/*  Main page                                                          */
/* ================================================================== */

// ── Tag taxonomy for filter UI ──
const ROOM_FILTERS = ['Living Room', 'Bedroom', 'Kitchen', 'Bathroom', 'Dining Room', 'Home Office', 'Majlis', 'Hallway', 'Nursery', 'Outdoor'];
const STYLE_FILTERS = ['Modern', 'Luxury', 'Minimalist', 'Classical', 'Arabic', 'Industrial', 'Scandinavian', 'Coastal', 'Art Deco', 'Bohemian'];

// ── Portfolio state cache (survives back navigation) ──
const CACHE_KEY = 'portfolio-state';
interface CachedState {
  images: PortfolioImage[];
  page: number;
  hasMore: boolean;
  activeTag: string;
  seed: number;
  scrollY: number;
  imageRatios: number[];   // flat ratios[] parallel to images[] (0 = hidden)
  savedAt: number;
}

function readCache(): CachedState | null {
  try {
    const raw = sessionStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedState;
    // Expire cache after 30 min
    if (Date.now() - parsed.savedAt > 30 * 60 * 1000) return null;
    return parsed;
  } catch { return null; }
}

function writeCache(state: Omit<CachedState, 'savedAt'>) {
  try {
    sessionStorage.setItem(CACHE_KEY, JSON.stringify({ ...state, savedAt: Date.now() }));
  } catch { /* sessionStorage may be full */ }
}

function clearCache() {
  try { sessionStorage.removeItem(CACHE_KEY); } catch { /* ignore */ }
}

export default function PortfolioPage() {
  const [searchParams] = useSearchParams();
  const urlTag = searchParams.get('tag') || '';

  // Restore cache ONLY if URL tag matches cached tag (otherwise filter changed)
  const cached = useMemo(() => {
    const c = readCache();
    return c && c.activeTag === urlTag ? c : null;
  }, []); // Only read once on mount

  const [images, setImages] = useState<PortfolioImage[]>(cached?.images || []);
  const [page, setPage] = useState(cached?.page || 1);
  const [hasMore, setHasMore] = useState(cached?.hasMore ?? true);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(!cached);
  const [activeTag, setActiveTag] = useState(urlTag);
  const [isFilterSticky, setIsFilterSticky] = useState(false);
  const [filterBarHeight, setFilterBarHeight] = useState(88);
  const headingRef = useRef<HTMLDivElement>(null);
  const filterBarRef = useRef<HTMLDivElement>(null);
  const observerRef = useRef<HTMLDivElement>(null);
  const loadedRef = useRef(!!cached); // skip initial load if we have cache
  const seedRef = useRef(cached?.seed || Math.floor(Math.random() * 1000000));
  const navigate = useNavigate();

  // Flat ratio cache for the single gallery. Hydrated from sessionStorage; updated by onRatios.
  const imageRatiosCacheRef = useRef<number[]>(cached?.imageRatios || []);

  const handleRatiosUpdate = useCallback((ratios: number[]) => {
    imageRatiosCacheRef.current = ratios;
  }, []);

  // Latest state refs for saveCacheNow (avoids stale closures on click)
  const stateRef = useRef({ images, page, hasMore, activeTag });
  useEffect(() => { stateRef.current = { images, page, hasMore, activeTag }; }, [images, page, hasMore, activeTag]);

  const saveCacheNow = useCallback(() => {
    const s = stateRef.current;
    writeCache({
      images: s.images,
      page: s.page,
      hasMore: s.hasMore,
      activeTag: s.activeTag,
      seed: seedRef.current,
      scrollY: window.scrollY,
      imageRatios: imageRatiosCacheRef.current,
    });
  }, []);

  const handleBeforeNavigate = useCallback(() => {
    saveCacheNow();
  }, [saveCacheNow]);

  // ── Scroll restore: jump to saved position WITHOUT a visible top-of-page flash ──
  // useLayoutEffect runs after React commits the DOM but before the browser
  // paints. Combined with the cached image ratios + initial container width
  // guess in JustifiedGallery, the document already has its full height on
  // first commit, so scrollTo(targetY) lands at the right spot — no flash, no
  // animated scroll-down. Global scroll-behavior is `auto` (see index.css).
  useLayoutEffect(() => {
    if (!cached) return;
    const targetY = cached.scrollY;
    if (targetY <= 0) return;
    window.scrollTo(0, targetY);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Safety net: if the document height grows after first paint (late images,
  // fonts) and we still haven't reached the target, retry quietly. Aborts on
  // any user-initiated scroll so we never fight the user.
  useEffect(() => {
    if (!cached) return;
    const targetY = cached.scrollY;
    if (targetY <= 0) return;

    let stopped = false;
    const tryScroll = () => {
      if (stopped) return;
      if (Math.abs(window.scrollY - targetY) > 2) {
        window.scrollTo(0, targetY);
      }
    };

    const ro = new ResizeObserver(() => { if (!stopped) tryScroll(); });
    ro.observe(document.body);

    const abort = () => { stopped = true; };
    window.addEventListener('wheel', abort, { once: true, passive: true });
    window.addEventListener('touchstart', abort, { once: true, passive: true });
    window.addEventListener('keydown', abort, { once: true });

    const timeout = setTimeout(() => { stopped = true; ro.disconnect(); }, 1500);

    return () => {
      stopped = true;
      ro.disconnect();
      clearTimeout(timeout);
      window.removeEventListener('wheel', abort);
      window.removeEventListener('touchstart', abort);
      window.removeEventListener('keydown', abort);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Save state to cache on unmount as well (fallback for navigations that
  // don't go through handleBeforeNavigate, e.g. browser back button)
  useEffect(() => {
    return () => { saveCacheNow(); };
  }, [saveCacheNow]);

  // Sync tag from URL
  useEffect(() => { if (urlTag !== activeTag) setActiveTag(urlTag); }, [urlTag]);

  // Measure filter bar height (for spacer when fixed)
  useLayoutEffect(() => {
    const el = filterBarRef.current;
    if (!el) return;
    setFilterBarHeight(el.offsetHeight);
    const ro = new ResizeObserver(() => setFilterBarHeight(el.offsetHeight));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Sticky filter bar: watch when heading scrolls past navbar bottom
  useEffect(() => {
    const check = () => {
      if (!headingRef.current) return;
      const navH = window.innerWidth >= 640 ? 64 : 56;
      setIsFilterSticky(headingRef.current.getBoundingClientRect().bottom <= navH);
    };
    window.addEventListener('scroll', check, { passive: true });
    check();
    return () => window.removeEventListener('scroll', check);
  }, []);

  const selectTag = useCallback((tag: string) => {
    const newTag = tag === activeTag ? '' : tag;
    setActiveTag(newTag);
    // Update URL without full reload
    navigate(newTag ? `/portfolio?tag=${encodeURIComponent(newTag)}` : '/portfolio', { replace: true });
    // Clear cache — user wants a fresh filtered view
    clearCache();
    imageRatiosCacheRef.current = [];
    setImages([]);
    setPage(1);
    setHasMore(true);
    setLoading(false);
    setInitialLoading(true);
    loadedRef.current = false;
    seedRef.current = Math.floor(Math.random() * 1000000);
    window.scrollTo(0, 0);
  }, [activeTag, navigate]);

  const loadMore = useCallback(async () => {
    if (loading || !hasMore) return;
    setLoading(true);
    try {
      const result = await fetchPortfolioFeed(page, 30, seedRef.current, activeTag || undefined);
      setImages(prev => [...prev, ...result.images]);
      setHasMore(result.images.length === 30);
      setPage(prev => prev + 1);
    } catch (err) {
      console.error('Portfolio load error:', err);
    } finally {
      setLoading(false);
      setInitialLoading(false);
    }
  }, [page, loading, hasMore, activeTag]);

  useEffect(() => { if (!loadedRef.current) { loadedRef.current = true; loadMore(); } }, [activeTag]);

  // Use refs to avoid recreating observer on every state change
  const loadMoreRef = useRef(loadMore);
  loadMoreRef.current = loadMore;
  const hasMoreRef = useRef(hasMore);
  hasMoreRef.current = hasMore;
  const loadingRef = useRef(loading);
  loadingRef.current = loading;

  useEffect(() => {
    if (!observerRef.current) return;
    const target = observerRef.current;
    const observer = new IntersectionObserver(
      entries => {
        if (entries[0].isIntersecting && hasMoreRef.current && !loadingRef.current) {
          loadMoreRef.current();
        }
      },
      { threshold: 0.1, rootMargin: '0px 0px 1200px 0px' },
    );
    observer.observe(target);
    return () => observer.disconnect();
  }, []); // Stable — never recreated

  // Flat URL list for the single unified gallery
  const imageUrls = useMemo(() => images.map(img => img.url), [images]);
  const imageInitialRatios = useMemo(
    () => imageRatiosCacheRef.current.length > 0 ? imageRatiosCacheRef.current : undefined,
    // Re-read when image count changes so cache hit works across pagination
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [images.length]
  );
  const galleryItems = useImagePreloader(imageUrls, imageInitialRatios, handleRatiosUpdate);

  const handleImageClick = useCallback((idx: number) => {
    const img = images[idx];
    if (!img) return;
    handleBeforeNavigate();
    navigate(`/companies/${img.companySlug}/${img.projectSlug}?from=portfolio`);
  }, [images, navigate, handleBeforeNavigate]);

  const renderImageOverlay = useCallback((idx: number) => {
    const img = images[idx];
    if (!img) return null;
    return (
      <div className="absolute inset-0 flex flex-col justify-end p-3 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none">
        <p className="text-white text-sm font-medium line-clamp-1">{img.projectTitle || 'Project'}</p>
        <p className="text-[#c6a065] text-xs mt-0.5">
          {img.companyName}{img.companyCity ? ` \u00b7 ${img.companyCity}` : ''}
        </p>
      </div>
    );
  }, [images]);

  return (
    <div className="min-h-screen bg-[var(--color-tarmeer-bg)]">
      <Helmet>
        <title>{urlTag ? `${urlTag} Interior Design Projects - Tarmeer UAE` : 'Interior Design Portfolio & Inspiration - Tarmeer UAE'}</title>
        <meta name="description" content={urlTag ? `Browse ${urlTag.toLowerCase()} interior design projects from top UAE designers. Explore ${urlTag} style inspirations on Tarmeer.` : 'Browse stunning interior design projects from top UAE designers. Get inspired by luxury villas, modern apartments, commercial spaces and more.'} />
        <link rel="canonical" href={urlTag ? `https://www.tarmeer.com/portfolio?tag=${encodeURIComponent(urlTag)}` : 'https://www.tarmeer.com/portfolio'} />
        <script type="application/ld+json">
          {JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'CollectionPage',
            name: urlTag ? `${urlTag} Interior Design Projects - Tarmeer UAE` : 'Interior Design Portfolio - Tarmeer UAE',
            description: urlTag ? `Browse ${urlTag.toLowerCase()} interior design projects from top UAE designers.` : 'Browse stunning interior design projects from top UAE designers.',
            url: urlTag ? `https://www.tarmeer.com/portfolio?tag=${encodeURIComponent(urlTag)}` : 'https://www.tarmeer.com/portfolio',
            mainEntity: {
              '@type': 'ItemList',
              itemListElement: images.slice(0, 20).map((img, i) => ({
                '@type': 'ListItem',
                position: i + 1,
                item: {
                  '@type': 'CreativeWork',
                  name: img.projectTitle || 'Interior Design Project',
                  creator: { '@type': 'Organization', name: img.companyName },
                  image: `https://www.tarmeer.com${img.url}`,
                  url: `https://www.tarmeer.com/companies/${img.companySlug}/${img.projectSlug}`,
                },
              })),
            },
          })}
        </script>
        <meta property="og:title" content={urlTag ? `${urlTag} Interior Design Projects - Tarmeer UAE` : 'Interior Design Portfolio & Inspiration - Tarmeer UAE'} />
        <meta property="og:description" content={urlTag ? `Browse ${urlTag.toLowerCase()} interior design projects from top UAE designers.` : 'Browse stunning interior design projects from top UAE designers. Get inspired by luxury villas, modern apartments, commercial spaces and more.'} />
        <meta property="og:image" content="https://www.tarmeer.com/images/tarmeer_logo.svg" />
        <meta property="og:url" content={urlTag ? `https://www.tarmeer.com/portfolio?tag=${encodeURIComponent(urlTag)}` : 'https://www.tarmeer.com/portfolio'} />
        <meta property="og:type" content="website" />
        <meta property="og:site_name" content="Tarmeer" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={urlTag ? `${urlTag} Interior Design Projects - Tarmeer UAE` : 'Interior Design Portfolio & Inspiration - Tarmeer UAE'} />
        <meta name="twitter:description" content={urlTag ? `Browse ${urlTag.toLowerCase()} interior design projects from top UAE designers.` : 'Browse stunning interior design projects from top UAE designers.'} />
        <meta name="twitter:image" content="https://www.tarmeer.com/images/tarmeer_logo.svg" />
        <meta name="keywords" content="interior design portfolio, UAE interior design, luxury villas, modern apartments, renovation projects, Tarmeer, Dubai, Abu Dhabi, design inspiration" />
        <meta name="robots" content="index, follow, max-image-preview:large" />
      </Helmet>

      {/* Page heading — visible at top, scrolls away; ref triggers sticky */}
      <div ref={headingRef} className="max-w-[1400px] mx-auto px-4 pt-8 pb-5">
        <h1 className="font-serif text-3xl font-semibold text-[var(--color-tarmeer-text)] mb-1">Portfolio</h1>
        <p className="text-[var(--color-tarmeer-muted)]">Explore interior design projects from UAE&apos;s top professionals</p>
      </div>

      {/* Spacer: preserves filter bar height in document flow when it goes fixed */}
      {isFilterSticky && <div style={{ height: filterBarHeight }} />}

      {/* Filter bar — fixed below Navbar once heading scrolls away; relative otherwise */}
      <div
        ref={filterBarRef}
        className={`${isFilterSticky ? 'fixed top-14 sm:top-16 left-0 right-0 z-40' : 'relative'} bg-white/95 backdrop-blur-sm border-b border-stone-200 shadow-sm`}
      >
        <div className="max-w-[1400px] mx-auto px-4 py-2.5 flex flex-col gap-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-semibold text-stone-400 uppercase tracking-wider w-16 shrink-0">By Room</span>
            {ROOM_FILTERS.map(tag => (
              <button key={tag} onClick={() => selectTag(tag)}
                className={`px-3 py-1 rounded-full text-xs font-medium border transition ${activeTag === tag ? 'bg-[var(--color-tarmeer-primary)] text-white border-[var(--color-tarmeer-primary)]' : 'bg-white text-stone-600 border-stone-200 hover:border-stone-400'}`}>
                {tag}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-semibold text-stone-400 uppercase tracking-wider w-16 shrink-0">By Style</span>
            {STYLE_FILTERS.map(tag => (
              <button key={tag} onClick={() => selectTag(tag)}
                className={`px-3 py-1 rounded-full text-xs font-medium border transition ${activeTag === tag ? 'bg-[var(--color-tarmeer-primary)] text-white border-[var(--color-tarmeer-primary)]' : 'bg-white text-stone-600 border-stone-200 hover:border-stone-400'}`}>
                {tag}
              </button>
            ))}
            {activeTag && (
              <button onClick={() => selectTag(activeTag)} className="ml-auto text-xs text-stone-400 hover:text-stone-600 inline-flex items-center gap-1">
                <X className="w-3.5 h-3.5" /> Clear
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-[1400px] mx-auto px-4 pt-6 pb-8">

        {initialLoading && (
          <div className="flex items-center justify-center py-20">
            <div className="w-10 h-10 rounded-full border-2 border-[var(--color-tarmeer-primary)]/20 border-t-[var(--color-tarmeer-primary)] animate-spin" />
          </div>
        )}

        {!initialLoading && images.length === 0 && (
          <div className="text-center py-20">
            <p className="text-[var(--color-tarmeer-muted)]">No portfolio projects available yet.</p>
          </div>
        )}

        {images.length > 0 && (
          <JustifiedGallery
            items={galleryItems}
            onItemClick={handleImageClick}
            renderOverlay={renderImageOverlay}
          />
        )}

        <div ref={observerRef} className="flex flex-col items-center justify-center py-6">
          {loading && !initialLoading && (
            <>
              {/* Skeleton placeholder grid */}
              <div className="w-full grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 mb-6">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div
                    key={i}
                    className="rounded-xl overflow-hidden"
                    style={{
                      height: `${180 + (i % 3) * 40}px`,
                      backgroundImage: 'linear-gradient(90deg, #e7e5e4 25%, #d6d3d1 50%, #e7e5e4 75%)',
                      backgroundSize: '200% 100%',
                      animation: 'shimmer 1.5s infinite',
                    }}
                  />
                ))}
              </div>
              <div className="w-8 h-8 rounded-full border-2 border-[var(--color-tarmeer-primary)]/20 border-t-[var(--color-tarmeer-primary)] animate-spin" />
            </>
          )}
          {!hasMore && images.length > 0 && (
            <p className="text-sm text-stone-400 py-4">All images loaded</p>
          )}
        </div>
      </div>

      <style>{`
        @keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }
      `}</style>
    </div>
  );
}
