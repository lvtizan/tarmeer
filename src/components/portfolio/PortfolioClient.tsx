'use client';

import { useState, useEffect, useLayoutEffect, useCallback, useRef, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { X } from 'lucide-react';
import { resolveImageUrl, resolveVariantUrl } from '@/lib/imageUrl';
import { fetchPortfolioFeed, type PortfolioProject } from '@/lib/publicApi';
import { DEFAULT_RATIO, GAP, TARGET_ROW_HEIGHT, justifyRows } from '@/lib/justifyRows';
import { useSiteLocale } from '@/contexts/SiteLocaleContext';
import { countryFromLang } from '@/lib/country';

const MAX_IMAGES_PER_GROUP = 12;

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
  const initialRef = useRef(initialRatios);
  const onRatiosRef = useRef(onRatios);
  useEffect(() => { onRatiosRef.current = onRatios; }, [onRatios]);

  const [items, setItems] = useState<ImgMeta[]>(() =>
    urls.map((src, i) => {
      const r = initialRef.current?.[i];
      if (typeof r === 'number') {
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
      if (onRatiosRef.current && next.every(it => it.loaded)) {
        onRatiosRef.current(next.map(it => it.ratio));
      }
      return next;
    });
  }, []);

  useEffect(() => {
    pendingRef.current.clear();

    const cached = initialRef.current;
    const nextItems = urls.map((src, i) => {
      const r = cached?.[i];
      if (typeof r === 'number') return { src, ratio: r, loaded: true };
      return { src, ratio: DEFAULT_RATIO, loaded: false };
    });
    setItems(nextItems);

    if (nextItems.every(it => it.loaded)) {
      onRatiosRef.current?.(nextItems.map(it => it.ratio));
      return;
    }

    const timeouts: number[] = [];

    urls.forEach((src, i) => {
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
      img.src = resolveVariantUrl(src, 'thumb');

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
/*  ProjectGroup                                                        */
/* ================================================================== */

function ProjectGroup({
  project,
  maxImages,
  initialRatios,
  onRatios,
  onBeforeNavigate,
}: {
  project: PortfolioProject;
  maxImages: number;
  initialRatios?: number[];
  onRatios?: (ratios: number[]) => void;
  onBeforeNavigate?: (projectId: string, imageIdx: number) => void;
}) {
  const router = useRouter();
  const visibleImages = useMemo(() => project.images.slice(0, maxImages), [project.images, maxImages]);
  const items = useImagePreloader(visibleImages, initialRatios, onRatios);

  const allLoaded = items.length > 0 && items.every(it => it.loaded);
  const visibleCount = items.filter(it => it.ratio > 0).length;
  const shouldHide = allLoaded && visibleCount === 0;

  const displayCount = allLoaded ? visibleCount : project.images.length;
  const remaining = Math.max(0, project.images.length - visibleImages.length - (items.length - visibleCount));

  const projectRouteKey = project.slug || String(project.id);
  const baseUrl = `/companies/${project.companySlug}/${projectRouteKey}`;

  const handleClick = useCallback((imageIdx: number) => {
    onBeforeNavigate?.(String(project.id), imageIdx);
    router.push(`${baseUrl}?from=portfolio&img=${imageIdx}`);
  }, [router, baseUrl, project.id, onBeforeNavigate]);

  const handleHeaderClick = useCallback(() => {
    onBeforeNavigate?.(String(project.id), -1);
    router.push(`${baseUrl}?from=portfolio`);
  }, [router, baseUrl, project.id, onBeforeNavigate]);

  const renderOverlay = useCallback(() => (
    <div className="absolute inset-0 flex flex-col justify-end p-3 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none">
      <p className="text-white text-sm font-medium line-clamp-1">{project.title || 'Project'}</p>
      <p className="text-[#c6a065] text-xs mt-0.5">
        {project.companyName}{project.companyCity ? ` · ${project.companyCity}` : ''}
      </p>
    </div>
  ), [project]);

  if (shouldHide) return null;

  return (
    <section className="mb-10" data-project-id={project.id}>
      <div className="flex items-baseline gap-3 mb-3 cursor-pointer group/hdr" onClick={handleHeaderClick}>
        <h3 className="text-[15px] font-medium text-[#1c1917] group-hover/hdr:text-[var(--color-tarmeer-primary)] transition">
          {project.title || 'Project'}
        </h3>
        <span className="text-sm text-stone-400">
          {project.companyName}{project.companyCity ? ` · ${project.companyCity}` : ''}
        </span>
        <span className="text-xs text-stone-300">{displayCount} photos</span>
      </div>
      <JustifiedGallery
        items={items}
        onItemClick={handleClick}
        renderOverlay={renderOverlay}
        remainingCount={remaining}
      />
    </section>
  );
}

/* ================================================================== */
/*  Main client component                                              */
/* ================================================================== */

const ROOM_FILTERS = ['Living Room', 'Bedroom', 'Kitchen', 'Bathroom', 'Dining Room', 'Home Office', 'Majlis', 'Hallway', 'Nursery', 'Outdoor'];
const STYLE_FILTERS = ['Modern', 'Luxury', 'Minimalist', 'Classical', 'Arabic', 'Industrial', 'Scandinavian', 'Coastal', 'Art Deco', 'Bohemian'];

const CACHE_KEY = 'portfolio-state';
const SINGLES_RATIO_KEY = '__singles__';

interface CachedState {
  projects: PortfolioProject[];
  page: number;
  hasMore: boolean;
  activeTag: string;
  seed: number;
  scrollY: number;
  projectRatios: Record<string, number[]>;
  clickedProjectId?: string;
  clickedImageIdx?: number;
  savedAt: number;
}

function readCache(): CachedState | null {
  try {
    const raw = sessionStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedState;
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

export default function PortfolioClient() {
  const { lang } = useSiteLocale();
  const c = countryFromLang(lang);
  const searchParams = useSearchParams();
  const urlTag = searchParams.get('tag') || '';

  const cached = useMemo(() => {
    const c = readCache();
    return c && c.activeTag === urlTag ? c : null;
  }, []); // Only read once on mount

  const [projects, setProjects] = useState<PortfolioProject[]>(cached?.projects || []);
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
  const loadedRef = useRef(!!cached);
  const seedRef = useRef(cached?.seed || Math.floor(Math.random() * 1000000));
  const router = useRouter();

  const ratiosCacheRef = useRef<Map<string, number[]>>(
    new Map(cached?.projectRatios ? Object.entries(cached.projectRatios) : [])
  );

  const handleRatiosUpdate = useCallback((projectId: string, ratios: number[]) => {
    ratiosCacheRef.current.set(projectId, ratios);
  }, []);

  const stateRef = useRef({ projects, page, hasMore, activeTag });
  useEffect(() => { stateRef.current = { projects, page, hasMore, activeTag }; }, [projects, page, hasMore, activeTag]);

  const saveCacheNow = useCallback((clickedProjectId?: string, clickedImageIdx?: number) => {
    const ratiosObj: Record<string, number[]> = {};
    ratiosCacheRef.current.forEach((v, k) => { ratiosObj[k] = v; });
    const s = stateRef.current;
    writeCache({
      projects: s.projects,
      page: s.page,
      hasMore: s.hasMore,
      activeTag: s.activeTag,
      seed: seedRef.current,
      scrollY: window.scrollY,
      projectRatios: ratiosObj,
      clickedProjectId,
      clickedImageIdx,
    });
  }, []);

  const handleBeforeNavigate = useCallback((projectId: string, imageIdx: number) => {
    saveCacheNow(projectId, imageIdx);
  }, [saveCacheNow]);

  useLayoutEffect(() => {
    if (!cached) return;
    const targetY = cached.scrollY;
    if (targetY <= 0) return;
    window.scrollTo(0, targetY);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  useEffect(() => {
    return () => { saveCacheNow(); };
  }, [saveCacheNow]);

  useEffect(() => { if (urlTag !== activeTag) setActiveTag(urlTag); }, [urlTag]);

  useLayoutEffect(() => {
    const el = filterBarRef.current;
    if (!el) return;
    setFilterBarHeight(el.offsetHeight);
    const ro = new ResizeObserver(() => setFilterBarHeight(el.offsetHeight));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

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
    router.replace(newTag ? `/portfolio?tag=${encodeURIComponent(newTag)}` : '/portfolio');
    clearCache();
    ratiosCacheRef.current.clear();
    setProjects([]);
    setPage(1);
    setHasMore(true);
    setLoading(false);
    setInitialLoading(true);
    loadedRef.current = false;
    seedRef.current = Math.floor(Math.random() * 1000000);
    window.scrollTo(0, 0);
  }, [activeTag, router]);

  const loadMore = useCallback(async () => {
    if (loading || !hasMore) return;
    setLoading(true);
    try {
      const result = await fetchPortfolioFeed(page, 12, seedRef.current, activeTag || undefined);
      setProjects(prev => [...prev, ...result.projects]);
      setHasMore(result.projects.length === 12);
      setPage(prev => prev + 1);
    } catch (err) {
      console.error('Portfolio load error:', err);
    } finally {
      setLoading(false);
      setInitialLoading(false);
    }
  }, [page, loading, hasMore, activeTag]);

  useEffect(() => { if (!loadedRef.current) { loadedRef.current = true; loadMore(); } }, [activeTag]);

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
  }, []);

  const { grouped, singles } = useMemo(() => {
    const g: PortfolioProject[] = [];
    const s: PortfolioProject[] = [];
    for (const p of projects) {
      if (p.images.length > 1) g.push(p);
      else if (p.images.length === 1) s.push(p);
    }
    return { grouped: g, singles: s };
  }, [projects]);

  const singlesUrls = useMemo(() => singles.map(s => {
    const first = s.images[0];
    if (typeof first === 'string') return first;
    if (first && typeof first === 'object' && typeof (first as unknown as { url: string }).url === 'string') return (first as unknown as { url: string }).url;
    return '';
  }), [singles]);
  const singlesInitialRatios = useMemo(
    () => ratiosCacheRef.current.get(SINGLES_RATIO_KEY),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [singles.length]
  );
  const handleSinglesRatios = useCallback((rs: number[]) => {
    ratiosCacheRef.current.set(SINGLES_RATIO_KEY, rs);
  }, []);
  const singlesItems = useImagePreloader(singlesUrls, singlesInitialRatios, handleSinglesRatios);

  const handleSingleClick = useCallback((idx: number) => {
    const proj = singles[idx];
    if (!proj) return;
    saveCacheNow(String(proj.id), idx);
    const routeKey = proj.slug || String(proj.id);
    router.push(`/companies/${proj.companySlug}/${routeKey}?from=portfolio&img=0`);
  }, [singles, router, saveCacheNow]);

  const renderSingleOverlay = useCallback((idx: number) => {
    const proj = singles[idx];
    if (!proj) return null;
    return (
      <div className="absolute inset-0 flex flex-col justify-end p-3 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none">
        <p className="text-white text-sm font-medium line-clamp-1">{proj.title || 'Project'}</p>
        <p className="text-[#c6a065] text-xs mt-0.5">
          {proj.companyName}{proj.companyCity ? ` · ${proj.companyCity}` : ''}
        </p>
      </div>
    );
  }, [singles]);

  return (
    <div className="min-h-screen bg-white">
      <div ref={headingRef} className="max-w-[1400px] mx-auto px-4 pt-8 pb-5">
        <h1 className="font-serif text-3xl font-semibold text-[var(--color-tarmeer-text)] mb-1">Portfolio</h1>
        <p className="text-[var(--color-tarmeer-muted)]">Explore interior design projects from {c.name}&apos;s top professionals</p>
      </div>

      {isFilterSticky && <div style={{ height: filterBarHeight }} />}

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

        {!initialLoading && projects.length === 0 && (
          <div className="text-center py-20">
            <p className="text-[var(--color-tarmeer-muted)]">No portfolio projects available yet.</p>
          </div>
        )}

        {grouped.map(project => (
          <ProjectGroup
            key={`g-${project.id}`}
            project={project}
            maxImages={MAX_IMAGES_PER_GROUP}
            initialRatios={ratiosCacheRef.current.get(String(project.id))}
            onRatios={rs => handleRatiosUpdate(String(project.id), rs)}
            onBeforeNavigate={handleBeforeNavigate}
          />
        ))}

        {singles.length > 0 && (
          <section className="mb-10" style={{ marginTop: grouped.length > 0 ? 32 : 0 }}>
            {grouped.length > 0 && (
              <div className="flex items-baseline gap-3 mb-3">
                <h3 className="text-[15px] font-medium text-stone-400">More projects</h3>
              </div>
            )}
            <JustifiedGallery
              items={singlesItems}
              onItemClick={handleSingleClick}
              renderOverlay={renderSingleOverlay}
            />
          </section>
        )}

        <div ref={observerRef} className="flex flex-col items-center justify-center py-6">
          {loading && !initialLoading && (
            <>
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
          {!hasMore && projects.length > 0 && (
            <p className="text-sm text-stone-400 py-4">All projects loaded</p>
          )}
        </div>
      </div>

      <style>{`
        @keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }
      `}</style>
    </div>
  );
}
