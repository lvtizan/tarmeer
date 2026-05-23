import { useState, useEffect, useLayoutEffect, useCallback, useRef, useMemo } from 'react';
import { Helmet } from 'react-helmet-async';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { X } from 'lucide-react';
import { resolveImageUrl, resolveVariantUrl } from '../lib/imageUrl';
import { fetchPortfolioFeed, type PortfolioProject } from '../lib/publicApi';
import { DEFAULT_RATIO, GAP, TARGET_ROW_HEIGHT, justifyRows } from '../lib/justifyRows';


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
/*  MosaicGallery — varied-size collage layout                         */
/* ================================================================== */

interface MosaicPattern {
  n: number;    // number of images this pattern displays
  tpl: string;  // CSS grid-template value (areas + track sizes)
  h: number;    // fixed block height in px
}

// Each pattern creates a complete rectangle from images of different sizes.
// Area letters a,b,c... map to images[0], images[1], images[2]...
// Design rules:
//   - No single cell may span the full width (no "a a a" across all columns)
//   - Every cell height ≥ 160px so images never become flat strips
//   - Target cell aspect ratio between 0.6:1 (portrait) and 2.5:1 (landscape)
const MOSAIC_PATTERNS: MosaicPattern[] = [
  // ── 3-image patterns ──────────────────────────────────────────────
  // Big left (2/3 w) + 2 small stacked right (1/3 w each)
  { n: 3, tpl: '"a b" 1fr "a c" 1fr / 2fr 1fr', h: 420 },
  // 2 small stacked left + big right (2/3 w)
  { n: 3, tpl: '"b a" 1fr "c a" 1fr / 1fr 2fr', h: 420 },
  // Three equal columns
  { n: 3, tpl: '"a b c" 1fr / 1fr 1fr 1fr', h: 380 },

  // ── 4-image patterns ──────────────────────────────────────────────
  // 2×2 grid
  { n: 4, tpl: '"a b" 1fr "c d" 1fr / 1fr 1fr', h: 560 },
  // Big top-left (spans 2 rows left col) + 3 right
  { n: 4, tpl: '"a b c" 1fr "a d d" 1fr / 1fr 1fr 1fr', h: 440 },
  // Big bottom-right (spans 2 rows right col) + 3 left
  { n: 4, tpl: '"a a b" 1fr "c c b" 1fr / 1fr 1fr 1fr', h: 440 },

  // ── 5-image patterns ──────────────────────────────────────────────
  // Tall left (2 cols) + 2×2 right (1 col each)
  { n: 5, tpl: '"a b c" 1fr "a d e" 1fr / 2fr 1fr 1fr', h: 460 },
  // 2×2 left + tall right (2 cols)
  { n: 5, tpl: '"b c a" 1fr "d e a" 1fr / 1fr 1fr 2fr', h: 460 },
  // 3 top row + 2 bottom (wider)
  { n: 5, tpl: '"a b c" 1fr "d d e" 1fr / 1fr 1fr 1fr', h: 460 },

  // ── 6-image patterns ──────────────────────────────────────────────
  // 2 rows × 3 cols
  { n: 6, tpl: '"a b c" 1fr "d e f" 1fr / 1fr 1fr 1fr', h: 480 },
  // Big left (spans 2 rows) + 2×2 mid + 2 right stacked
  { n: 6, tpl: '"a b c" 1fr "a d e" 1fr / 2fr 1fr 1fr', h: 460 },
];

const MOSAIC_GAP = 4;

function MosaicGallery({
  images,
  patternIndex,
  totalImages,
  onImageClick,
  renderOverlay,
}: {
  images: string[];
  patternIndex: number;
  totalImages: number;
  onImageClick: (idx: number) => void;
  renderOverlay?: (idx: number) => React.ReactNode;
}) {
  const viable = MOSAIC_PATTERNS.filter(p => p.n <= images.length);

  // Fallback for 1–2 images: simple flex row
  if (!viable.length) {
    const imgs = images.slice(0, 2);
    return (
      <div className="flex overflow-hidden rounded-xl" style={{ gap: MOSAIC_GAP, height: 300 }}>
        {imgs.map((url, i) => (
          <div key={i} className="relative flex-1 cursor-pointer group overflow-hidden rounded-xl" onClick={() => onImageClick(i)}>
            <img src={resolveVariantUrl(url, 'medium')} alt="" loading="lazy" decoding="async"
              className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
              onError={(e) => { const t = e.currentTarget; if (!t.dataset.fb) { t.dataset.fb='1'; t.src=resolveImageUrl(url); } }} />
            <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            {renderOverlay?.(i)}
          </div>
        ))}
      </div>
    );
  }

  const pattern = viable[patternIndex % viable.length];
  const displayImages = images.slice(0, pattern.n);
  const remaining = Math.max(0, totalImages - pattern.n);

  return (
    <div
      className="w-full overflow-hidden rounded-xl"
      style={{ display: 'grid', gridTemplate: pattern.tpl, gap: MOSAIC_GAP, height: pattern.h }}
    >
      {displayImages.map((url, i) => {
        const area = String.fromCharCode(97 + i); // a, b, c, d, e, f
        const isLast = i === displayImages.length - 1;
        return (
          <div
            key={i}
            style={{ gridArea: area }}
            className="relative cursor-pointer group overflow-hidden bg-stone-200"
            onClick={() => onImageClick(i)}
          >
            {/* Shimmer placeholder — hidden once image loads */}
            <div className="absolute inset-0 pointer-events-none" style={{ backgroundImage: 'linear-gradient(90deg,#e7e5e4 25%,#d6d3d1 50%,#e7e5e4 75%)', backgroundSize: '200% 100%', animation: 'shimmer 1.5s infinite' }} />
            <img
              src={resolveVariantUrl(url, 'medium')}
              alt=""
              loading="lazy"
              decoding="async"
              className="relative w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
              onLoad={(e) => {
                const shimmer = e.currentTarget.previousElementSibling as HTMLElement | null;
                if (shimmer) shimmer.style.display = 'none';
              }}
              onError={(e) => {
                const img = e.currentTarget;
                const retries = parseInt(img.dataset.retry || '0');
                if (retries === 0) {
                  img.dataset.retry = '1';
                  img.src = resolveImageUrl(url);
                } else if (retries === 1) {
                  img.dataset.retry = '2';
                  setTimeout(() => { img.src = resolveImageUrl(url) + '?r=2'; }, 2000);
                } else {
                  // All retries failed — hide img, shimmer stays as neutral placeholder
                  img.style.display = 'none';
                }
              }}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            {renderOverlay?.(i)}
            {isLast && remaining > 0 && (
              <div className="absolute inset-0 bg-black/55 flex items-center justify-center">
                <span className="text-white text-2xl font-semibold">+{remaining}</span>
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
  patternIndex,
  onBeforeNavigate,
}: {
  project: PortfolioProject;
  patternIndex: number;
  onBeforeNavigate?: (projectId: string, imageIdx: number) => void;
}) {
  const navigate = useNavigate();
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

  const renderOverlay = useCallback((_idx: number) => (
    <div className="absolute inset-0 flex flex-col justify-end p-3 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none">
      <p className="text-white text-sm font-medium line-clamp-1">{project.title || 'Project'}</p>
      <p className="text-[#c6a065] text-xs mt-0.5">
        {project.companyName}{project.companyCity ? ` \u00b7 ${project.companyCity}` : ''}
      </p>
    </div>
  ), [project]);

  if (!project.images.length) return null;

  // Normalize images to string URLs (handles both legacy string[] and object[] shapes)
  const imageUrls: string[] = project.images.map((img: any) =>
    typeof img === 'string' ? img : (img?.url || '')
  ).filter(Boolean);

  return (
    <section className="mb-10" data-project-id={project.id}>
      <div className="flex items-baseline gap-3 mb-3 cursor-pointer group/hdr" onClick={handleHeaderClick}>
        <h3 className="text-[15px] font-medium text-[#1c1917] group-hover/hdr:text-[var(--color-tarmeer-primary)] transition">
          {project.title || 'Project'}
        </h3>
        <span className="text-sm text-stone-400">
          {project.companyName}{project.companyCity ? ` \u00b7 ${project.companyCity}` : ''}
        </span>
        <span className="text-xs text-stone-300">{project.images.length} photos</span>
      </div>
      <MosaicGallery
        images={imageUrls}
        patternIndex={patternIndex}
        totalImages={project.images.length}
        onImageClick={handleClick}
        renderOverlay={renderOverlay}
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
  const loadedRef = useRef(!!cached); // skip initial load if we have cache
  const seedRef = useRef(cached?.seed || Math.floor(Math.random() * 1000000));
  const navigate = useNavigate();

  // Per-project ratio cache. Hydrated from sessionStorage; children report up via onRatios.
  const ratiosCacheRef = useRef<Map<string, number[]>>(
    new Map(cached?.projectRatios ? Object.entries(cached.projectRatios) : [])
  );

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
    <div className="min-h-screen bg-white">
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

        {!initialLoading && projects.length === 0 && (
          <div className="text-center py-20">
            <p className="text-[var(--color-tarmeer-muted)]">No portfolio projects available yet.</p>
          </div>
        )}

        {grouped.map((project, index) => (
          <ProjectGroup
            key={`g-${project.id}`}
            project={project}
            patternIndex={index}
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
