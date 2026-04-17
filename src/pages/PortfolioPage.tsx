import { useState, useEffect, useLayoutEffect, useCallback, useRef, useMemo } from 'react';
import { Helmet } from 'react-helmet-async';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { X } from 'lucide-react';
import { resolveImageUrl, resolveVariantUrl } from '../lib/imageUrl';
import { fetchPortfolioFeed, type PortfolioProject } from '../lib/publicApi';
import { DEFAULT_RATIO } from '../lib/justifyRows';
import { computeLayout, type LayoutMode } from '../lib/portfolioLayout';

const MAX_IMAGES_PER_GROUP = 12;
// Max height for grouped projects (used to truncate DP mode with "+N more").
// Blocks mode produces a fixed-aspect container and ignores this cap.
const MAX_GROUP_HEIGHT_DP = 640;

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
  maxHeight,
  mode,
}: {
  items: ImgMeta[];
  onItemClick: (index: number) => void;
  renderOverlay?: (index: number) => React.ReactNode;
  remainingCount?: number;
  /** Optional pixel cap — cells with (y + h) above this are shown; others cut. Only applies to DP mode. */
  maxHeight?: number;
  mode: LayoutMode;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  // Initialize with a best-guess width so the FIRST render already produces
  // the correct cell heights → document height is correct → scroll restore
  // works without a clamped jump.
  const [containerWidth, setContainerWidth] = useState(() => {
    if (typeof window === 'undefined') return 1200;
    // Page wrapper is max-w-[1400px] with px-4 (16px each side)
    return Math.min(window.innerWidth - 32, 1400 - 32);
  });

  // Synchronous measurement before paint to correct any guess.
  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const w = el.clientWidth;
    if (w > 0 && w !== containerWidth) setContainerWidth(w);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Watch for resizes after mount.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      if (el.clientWidth > 0) setContainerWidth(el.clientWidth);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Filter visible items, build ratios array
  const visibleIndices = useMemo(() => {
    const indices: number[] = [];
    for (let i = 0; i < items.length; i++) {
      if (items[i].ratio > 0) indices.push(i);
    }
    return indices;
  }, [items]);

  const ratios = useMemo(
    () => visibleIndices.map(i => items[i].loaded ? items[i].ratio : DEFAULT_RATIO),
    [items, visibleIndices]
  );

  const fullLayout = useMemo(
    () => computeLayout(mode, ratios, containerWidth),
    [mode, ratios, containerWidth]
  );

  // Apply max height cap (DP mode only — blocks/mosaic are already sized)
  const { cells, totalHeight, truncatedCount } = useMemo(() => {
    if (mode !== 'dp' || !maxHeight || fullLayout.height <= maxHeight) {
      return { cells: fullLayout.cells, totalHeight: fullLayout.height, truncatedCount: 0 };
    }
    // Keep cells whose top is within maxHeight; drop the rest
    const kept = fullLayout.cells.filter(c => c.y + c.h <= maxHeight + 1);
    const dropped = fullLayout.cells.length - kept.length;
    const h = kept.reduce((m, c) => Math.max(m, c.y + c.h), 0);
    return { cells: kept, totalHeight: h, truncatedCount: dropped };
  }, [fullLayout, mode, maxHeight]);

  const effectiveRemaining = (remainingCount || 0) + truncatedCount;

  // Find the last rendered cell (bottom-right-most) for "+N more" overlay
  const lastCellKey = useMemo(() => {
    if (cells.length === 0 || effectiveRemaining <= 0) return -1;
    let bestI = 0;
    let bestScore = -Infinity;
    for (let i = 0; i < cells.length; i++) {
      const c = cells[i];
      // Bottom-right priority: weigh y more than x
      const score = c.y * 2 + c.x;
      if (score > bestScore) { bestScore = score; bestI = i; }
    }
    return cells[bestI].idx;
  }, [cells, effectiveRemaining]);

  return (
    <div
      ref={containerRef}
      className="w-full relative"
      style={{
        height: containerWidth > 0 ? totalHeight : 280,
      }}
    >
      {cells.map(cell => {
        const visIdx = cell.idx;
        const origIdx = visibleIndices[visIdx];
        if (origIdx === undefined) return null;
        const item = items[origIdx];
        const isLastWithMore = cell.idx === lastCellKey;

        return (
          <div
            key={origIdx}
            className="absolute rounded-xl overflow-hidden cursor-pointer group"
            style={{ left: cell.x, top: cell.y, width: cell.w, height: cell.h }}
            onClick={() => onItemClick(origIdx)}
          >
            {/* Shimmer */}
            <div
              className={`absolute inset-0 rounded-xl transition-opacity duration-300 ${item.loaded ? 'opacity-0 pointer-events-none' : ''}`}
              style={{
                backgroundImage: 'linear-gradient(90deg, #e7e5e4 25%, #d6d3d1 50%, #e7e5e4 75%)',
                backgroundSize: '200% 100%',
                animation: 'shimmer 1.5s infinite',
              }}
            />

            {/* Image — thumb variant is ~12KB vs medium ~45KB. If the thumb is
                missing (older upload pre-variant-generation) fall back once to
                the original; the dataset guard prevents an onError loop when
                the original is also unreachable. */}
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
              className={`absolute inset-0 w-full h-full object-cover transition-all duration-300 group-hover:scale-105 ${item.loaded ? 'opacity-100' : 'opacity-0'}`}
            />

            {/* Hover gradient + overlay */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            {renderOverlay?.(origIdx)}

            {/* +N more */}
            {isLastWithMore && (
              <div className="absolute inset-0 bg-black/50 flex items-center justify-center rounded-xl">
                <span className="text-white text-lg font-semibold">+{effectiveRemaining} more</span>
              </div>
            )}
          </div>
        );
      })}
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
  layoutMode,
}: {
  project: PortfolioProject;
  maxImages: number;
  initialRatios?: number[];
  onRatios?: (ratios: number[]) => void;
  onBeforeNavigate?: (projectId: string, imageIdx: number) => void;
  layoutMode: LayoutMode;
}) {
  const navigate = useNavigate();
  const visibleImages = useMemo(() => project.images.slice(0, maxImages), [project.images, maxImages]);
  const items = useImagePreloader(visibleImages, initialRatios, onRatios);

  // Compute load state. If every image has finished loading and none are
  // visible (all failed / filtered), hide the whole group — otherwise we'd
  // render an empty gap under the header.
  const allLoaded = items.length > 0 && items.every(it => it.loaded);
  const visibleCount = items.filter(it => it.ratio > 0).length;
  const shouldHide = allLoaded && visibleCount === 0;

  // Photo count in the header: once loading is done, show the real visible
  // count; while loading, optimistically show the project's total.
  const displayCount = allLoaded ? visibleCount : project.images.length;
  const remaining = Math.max(0, project.images.length - visibleImages.length - (items.length - visibleCount));

  // Prefer the real slug; fall back to the numeric id so the project detail
  // page still opens even when the DB slug column is empty. The backend
  // getPublicProjectDetail query matches either `slug = ?` or `id = ?`, so
  // both forms resolve to the same project.
  const projectRouteKey = project.slug || String(project.id);
  const baseUrl = `/companies/${project.companySlug}/${projectRouteKey}`;

  const handleClick = useCallback((imageIdx: number) => {
    onBeforeNavigate?.(String(project.id), imageIdx);
    navigate(`${baseUrl}?from=portfolio&img=${imageIdx}`);
  }, [navigate, baseUrl, project.id, onBeforeNavigate]);

  const handleHeaderClick = useCallback(() => {
    onBeforeNavigate?.(String(project.id), -1);
    navigate(`${baseUrl}?from=portfolio`);
  }, [navigate, baseUrl, project.id, onBeforeNavigate]);

  const renderOverlay = useCallback(() => (
    <div className="absolute inset-0 flex flex-col justify-end p-3 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none">
      <p className="text-white text-sm font-medium line-clamp-1">{project.title || 'Project'}</p>
      <p className="text-[#c6a065] text-xs mt-0.5">
        {project.companyName}{project.companyCity ? ` \u00b7 ${project.companyCity}` : ''}
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
          {project.companyName}{project.companyCity ? ` \u00b7 ${project.companyCity}` : ''}
        </span>
        <span className="text-xs text-stone-300">{displayCount} photos</span>
      </div>
      <JustifiedGallery
        items={items}
        onItemClick={handleClick}
        renderOverlay={renderOverlay}
        remainingCount={remaining}
        maxHeight={MAX_GROUP_HEIGHT_DP}
        mode={layoutMode}
      />
    </section>
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
const SINGLES_RATIO_KEY = '__singles__';
interface CachedState {
  projects: PortfolioProject[];
  page: number;
  hasMore: boolean;
  activeTag: string;
  seed: number;
  scrollY: number;
  projectRatios: Record<string, number[]>;   // projectId → ratios[] (0 = hidden)
  clickedProjectId?: string;                  // anchor target for scroll restore
  clickedImageIdx?: number;
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

  // Layout mode is fixed to 'blocks' — the justified/dp mode is hidden.
  const layoutMode: LayoutMode = 'blocks';

  const [projects, setProjects] = useState<PortfolioProject[]>(cached?.projects || []);
  const [page, setPage] = useState(cached?.page || 1);
  const [hasMore, setHasMore] = useState(cached?.hasMore ?? true);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(!cached);
  const [activeTag, setActiveTag] = useState(urlTag);
  const [scrolledPastHeader, setScrolledPastHeader] = useState(false);
  const headerRef = useRef<HTMLDivElement>(null);
  const observerRef = useRef<HTMLDivElement>(null);
  const loadedRef = useRef(!!cached); // skip initial load if we have cache
  const seedRef = useRef(cached?.seed || Math.floor(Math.random() * 1000000));
  const navigate = useNavigate();

  // Per-project ratio cache. Hydrated from sessionStorage; children report up via onRatios.
  const ratiosCacheRef = useRef<Map<string, number[]>>(
    new Map(cached?.projectRatios ? Object.entries(cached.projectRatios) : [])
  );

  const handleRatiosUpdate = useCallback((projectId: string, ratios: number[]) => {
    ratiosCacheRef.current.set(projectId, ratios);
  }, []);

  // Latest state refs for saveCacheNow (avoids stale closures on click)
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

  // Track scroll past header for sticky bar
  useEffect(() => {
    const el = headerRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => setScrolledPastHeader(!entry.isIntersecting),
      { threshold: 0 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  const selectTag = useCallback((tag: string) => {
    const newTag = tag === activeTag ? '' : tag;
    setActiveTag(newTag);
    // Update URL without full reload
    navigate(newTag ? `/portfolio?tag=${encodeURIComponent(newTag)}` : '/portfolio', { replace: true });
    // Clear cache — user wants a fresh filtered view
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
  }, [activeTag, navigate]);

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
    if (first && typeof first === 'object' && typeof (first as any).url === 'string') return (first as any).url;
    return '';
  }), [singles]);
  const singlesInitialRatios = useMemo(
    () => ratiosCacheRef.current.get(SINGLES_RATIO_KEY),
    // Re-read when singles set changes so cache hit still works across pagination
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
    // Fall back to numeric id when slug is missing (backend accepts either).
    const routeKey = proj.slug || String(proj.id);
    navigate(`/companies/${proj.companySlug}/${routeKey}?from=portfolio&img=0`);
  }, [singles, navigate, saveCacheNow]);

  const renderSingleOverlay = useCallback((idx: number) => {
    const proj = singles[idx];
    if (!proj) return null;
    return (
      <div className="absolute inset-0 flex flex-col justify-end p-3 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none">
        <p className="text-white text-sm font-medium line-clamp-1">{proj.title || 'Project'}</p>
        <p className="text-[#c6a065] text-xs mt-0.5">
          {proj.companyName}{proj.companyCity ? ` \u00b7 ${proj.companyCity}` : ''}
        </p>
      </div>
    );
  }, [singles]);

  return (
    <div className="min-h-screen bg-[var(--color-tarmeer-bg)]">
      <Helmet>
        <title>Interior Design Portfolio & Inspiration - Tarmeer UAE</title>
        <meta name="description" content="Browse stunning interior design projects from top UAE designers. Get inspired by luxury villas, modern apartments, commercial spaces and more." />
        <link rel="canonical" href="https://www.tarmeer.com/portfolio" />
        <script type="application/ld+json">
          {JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'CollectionPage',
            name: 'Interior Design Portfolio - Tarmeer UAE',
            description: 'Browse stunning interior design projects from top UAE designers.',
            url: 'https://www.tarmeer.com/portfolio',
            mainEntity: {
              '@type': 'ItemList',
              itemListElement: projects.slice(0, 20).map((p, i) => ({
                '@type': 'ListItem',
                position: i + 1,
                item: {
                  '@type': 'CreativeWork',
                  name: p.title || 'Interior Design Project',
                  description: p.description || `${p.style || 'Interior design'} project by ${p.companyName}`,
                  creator: { '@type': 'Organization', name: p.companyName },
                  ...(p.images[0] ? { image: `https://www.tarmeer.com${typeof p.images[0] === 'string' ? p.images[0] : ((p.images[0] as any)?.url || '')}` } : {}),
                  ...(p.companySlug && p.slug ? { url: `https://www.tarmeer.com/companies/${p.companySlug}/${p.slug}` } : {}),
                },
              })),
            },
          })}
        </script>
        <meta property="og:title" content="Interior Design Portfolio & Inspiration - Tarmeer UAE" />
        <meta property="og:description" content="Browse stunning interior design projects from top UAE designers. Get inspired by luxury villas, modern apartments, commercial spaces and more." />
        <meta property="og:image" content="https://www.tarmeer.com/images/tarmeer_logo.svg" />
        <meta property="og:url" content="https://www.tarmeer.com/portfolio" />
        <meta property="og:type" content="website" />
        <meta property="og:site_name" content="Tarmeer" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="Interior Design Portfolio & Inspiration - Tarmeer UAE" />
        <meta name="twitter:description" content="Browse stunning interior design projects from top UAE designers." />
        <meta name="twitter:image" content="https://www.tarmeer.com/images/tarmeer_logo.svg" />
        <meta name="keywords" content="interior design portfolio, UAE interior design, luxury villas, modern apartments, renovation projects, Tarmeer, Dubai, Abu Dhabi, design inspiration" />
        <meta name="robots" content="index, follow, max-image-preview:large" />
      </Helmet>

      {/* ── Sticky filter bar (appears when scrolled past header) ── */}
      {scrolledPastHeader && (
        <div className="fixed top-[64px] left-0 right-0 z-30 bg-white/95 backdrop-blur-sm border-b border-stone-200 shadow-sm">
          <div className="max-w-[1400px] mx-auto px-4 py-2.5 flex flex-col gap-1.5">
            {/* By Room row */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[11px] font-semibold text-stone-400 uppercase tracking-wider w-16 shrink-0">By Room</span>
              {ROOM_FILTERS.map(tag => (
                <button
                  key={tag}
                  onClick={() => selectTag(tag)}
                  className={`px-3 py-1 rounded-full text-xs font-medium border transition ${
                    activeTag === tag
                      ? 'bg-[var(--color-tarmeer-primary)] text-white border-[var(--color-tarmeer-primary)]'
                      : 'bg-white text-stone-600 border-stone-200 hover:border-stone-400'
                  }`}
                >
                  {tag}
                </button>
              ))}
            </div>
            {/* By Style row */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[11px] font-semibold text-stone-400 uppercase tracking-wider w-16 shrink-0">By Style</span>
              {STYLE_FILTERS.map(tag => (
                <button
                  key={tag}
                  onClick={() => selectTag(tag)}
                  className={`px-3 py-1 rounded-full text-xs font-medium border transition ${
                    activeTag === tag
                      ? 'bg-[var(--color-tarmeer-primary)] text-white border-[var(--color-tarmeer-primary)]'
                      : 'bg-white text-stone-600 border-stone-200 hover:border-stone-400'
                  }`}
                >
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
      )}

      <div className="max-w-[1400px] mx-auto px-4 py-8">
        <div ref={headerRef} className="mb-6">
          <h1 className="font-serif text-3xl font-semibold text-[var(--color-tarmeer-text)] mb-2">Portfolio</h1>
          <p className="text-[var(--color-tarmeer-muted)]">Explore interior design projects from UAE&apos;s top professionals</p>
        </div>

        {/* Persistent filter bar at top of page */}
        <div className="mb-8 flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-semibold text-stone-400 uppercase tracking-wider w-16 shrink-0">By Room</span>
            {ROOM_FILTERS.map(tag => (
              <button
                key={tag}
                onClick={() => selectTag(tag)}
                className={`px-3 py-1 rounded-full text-xs font-medium border transition ${
                  activeTag === tag
                    ? 'bg-[var(--color-tarmeer-primary)] text-white border-[var(--color-tarmeer-primary)]'
                    : 'bg-white text-stone-600 border-stone-200 hover:border-stone-400'
                }`}
              >
                {tag}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-semibold text-stone-400 uppercase tracking-wider w-16 shrink-0">By Style</span>
            {STYLE_FILTERS.map(tag => (
              <button
                key={tag}
                onClick={() => selectTag(tag)}
                className={`px-3 py-1 rounded-full text-xs font-medium border transition ${
                  activeTag === tag
                    ? 'bg-[var(--color-tarmeer-primary)] text-white border-[var(--color-tarmeer-primary)]'
                    : 'bg-white text-stone-600 border-stone-200 hover:border-stone-400'
                }`}
              >
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
            layoutMode={layoutMode}
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
              mode="dp"
            />
          </section>
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
