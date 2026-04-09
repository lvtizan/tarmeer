import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Helmet } from 'react-helmet-async';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { X } from 'lucide-react';
import { resolveImageUrl } from '../lib/imageUrl';
import { fetchPortfolioFeed, type PortfolioProject } from '../lib/publicApi';

/* ================================================================== */
/*  Justified-row layout engine (Google Photos / 500px algorithm)      */
/*                                                                      */
/*  Each row fills full container width. Images in a row share the same */
/*  height but different widths based on their aspect ratios.           */
/*  Rows have DIFFERENT heights → visual variety, zero gaps.            */
/* ================================================================== */

const GAP = 6;
const TARGET_ROW_HEIGHT = 280;     // ideal row height (will flex ±30%)
const MAX_ROW_HEIGHT = 380;        // prevent oversized rows for few images
const MIN_ROW_HEIGHT = 180;        // prevent crushed rows
const MAX_IMAGES_PER_GROUP = 12;
const MAX_ROWS_PER_GROUP = 2;
const DEFAULT_RATIO = 1.33;        // 4:3

interface RowLayout {
  startIdx: number;
  count: number;
  height: number;
  widths: number[];  // per-image width in this row
}

/**
 * Partition images into justified rows.
 * Each row's images are scaled to the same height so total width = containerWidth.
 */
function justifyRows(
  ratios: number[],
  containerWidth: number,
  targetH: number,
): RowLayout[] {
  if (containerWidth <= 0 || ratios.length === 0) return [];

  const rows: RowLayout[] = [];
  let cursor = 0;

  while (cursor < ratios.length) {
    let bestEnd = cursor + 1;
    let bestDiff = Infinity;

    // Try adding images until row is full or overshooting
    let sumRatio = 0;
    for (let end = cursor; end < ratios.length; end++) {
      sumRatio += ratios[end] || DEFAULT_RATIO;
      const gaps = (end - cursor) * GAP;
      const rowH = (containerWidth - gaps) / sumRatio;

      // How far is this row height from our target?
      const diff = Math.abs(rowH - targetH);
      if (diff < bestDiff) {
        bestDiff = diff;
        bestEnd = end + 1;
      }

      // Once we've passed the target height going down, stop searching
      if (rowH < targetH * 0.7) break;
    }

    // Compute final row height
    const count = bestEnd - cursor;
    let rowRatioSum = 0;
    for (let i = cursor; i < bestEnd; i++) {
      rowRatioSum += ratios[i] || DEFAULT_RATIO;
    }
    const gaps = (count - 1) * GAP;
    let rowH = (containerWidth - gaps) / rowRatioSum;

    // Clamp row height
    rowH = Math.max(MIN_ROW_HEIGHT, Math.min(MAX_ROW_HEIGHT, rowH));

    // Last row: don't stretch to fill width — left-align at target height
    // This prevents 1-2 images from being cropped beyond recognition
    const isLastRow = bestEnd >= ratios.length;
    const rowFillsWidth = !isLastRow || count >= 3;

    if (isLastRow && !rowFillsWidth) {
      rowH = Math.min(rowH, targetH);
    }

    // Compute widths based on ratio × height
    const widths: number[] = [];
    let usedWidth = 0;
    for (let i = cursor; i < bestEnd; i++) {
      const r = ratios[i] || DEFAULT_RATIO;
      const w = r * rowH;
      widths.push(w);
      usedWidth += w;
    }

    // Only distribute rounding error if the row should fill the container
    if (rowFillsWidth) {
      const totalGaps = gaps;
      const remainder = containerWidth - usedWidth - totalGaps;
      if (widths.length > 0 && Math.abs(remainder) > 0.5) {
        const adj = remainder / widths.length;
        for (let i = 0; i < widths.length; i++) widths[i] += adj;
      }
    }

    rows.push({ startIdx: cursor, count, height: rowH, widths });
    cursor = bestEnd;
  }

  return rows;
}

/* ================================================================== */
/*  Image preloader with RAF batching                                  */
/* ================================================================== */

interface ImgMeta {
  src: string;
  ratio: number;    // 0 = hidden/error
  loaded: boolean;
}

function useImagePreloader(urls: string[]): ImgMeta[] {
  const [items, setItems] = useState<ImgMeta[]>(() =>
    urls.map(src => ({ src, ratio: DEFAULT_RATIO, loaded: false }))
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
      return next;
    });
  }, []);

  useEffect(() => {
    setItems(urls.map(src => ({ src, ratio: DEFAULT_RATIO, loaded: false })));
    pendingRef.current.clear();

    urls.forEach((src, i) => {
      const img = new Image();
      img.onload = () => {
        const w = img.naturalWidth, h = img.naturalHeight, ratio = w / h;
        const hidden = w < 200 || h < 150 || ratio > 3.5 || ratio < 0.25;
        pendingRef.current.set(i, { ratio, hidden });
        cancelAnimationFrame(rafRef.current);
        rafRef.current = requestAnimationFrame(flush);
      };
      img.onerror = () => {
        pendingRef.current.set(i, { ratio: 0, hidden: true });
        cancelAnimationFrame(rafRef.current);
        rafRef.current = requestAnimationFrame(flush);
      };
      img.src = resolveImageUrl(src);
    });

    return () => cancelAnimationFrame(rafRef.current);
  }, [urls.join('|'), flush]);

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
  maxRows,
}: {
  items: ImgMeta[];
  onItemClick: (index: number) => void;
  renderOverlay?: (index: number) => React.ReactNode;
  remainingCount?: number;
  maxRows?: number;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(0);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const measure = () => setContainerWidth(el.clientWidth);
    measure();
    const ro = new ResizeObserver(measure);
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

  const allRows = useMemo(
    () => justifyRows(ratios, containerWidth, TARGET_ROW_HEIGHT),
    [ratios, containerWidth]
  );
  const rows = maxRows ? allRows.slice(0, maxRows) : allRows;

  // Count images truncated by row limit for "+N more"
  const shownInRows = rows.reduce((sum, r) => sum + r.count, 0);
  const truncatedCount = visibleIndices.length - shownInRows;
  const effectiveRemaining = (remainingCount || 0) + truncatedCount;

  // Total height
  const totalHeight = useMemo(() => {
    let h = 0;
    for (const row of rows) h += row.height + GAP;
    return h > 0 ? h - GAP : 0;
  }, [rows]);

  // Find the very last image shown across all rows
  const lastRow = rows[rows.length - 1];
  const lastShownVisIdx = lastRow ? lastRow.startIdx + lastRow.count - 1 : -1;

  return (
    <div ref={containerRef} className="w-full" style={{ minHeight: containerWidth > 0 ? totalHeight : TARGET_ROW_HEIGHT }}>
      {rows.map((row, ri) => (
        <div key={ri} className="flex" style={{ gap: GAP, marginBottom: ri < rows.length - 1 ? GAP : 0 }}>
          {row.widths.map((w, ci) => {
            const visIdx = row.startIdx + ci;
            const origIdx = visibleIndices[visIdx];
            if (origIdx === undefined) return null;
            const item = items[origIdx];
            const isLastWithMore = effectiveRemaining > 0 && visIdx === lastShownVisIdx;

            return (
              <div
                key={origIdx}
                className="relative rounded-xl overflow-hidden cursor-pointer group flex-shrink-0"
                style={{ width: w, height: row.height }}
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

                {/* Image */}
                <img
                  src={resolveImageUrl(item.src)}
                  alt=""
                  loading="lazy"
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
      ))}
    </div>
  );
}

/* ================================================================== */
/*  ProjectGroup                                                        */
/* ================================================================== */

function ProjectGroup({ project, maxImages }: { project: PortfolioProject; maxImages: number }) {
  const navigate = useNavigate();
  const visibleImages = useMemo(() => project.images.slice(0, maxImages), [project.images, maxImages]);
  const items = useImagePreloader(visibleImages);
  const remaining = project.images.length - visibleImages.length;

  const projectUrl = project.slug
    ? `/companies/${project.companySlug}/${project.slug}?from=portfolio`
    : `/companies/${project.companySlug}`;

  const handleClick = useCallback(() => navigate(projectUrl), [navigate, projectUrl]);

  const renderOverlay = useCallback(() => (
    <div className="absolute inset-0 flex flex-col justify-end p-3 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none">
      <p className="text-white text-sm font-medium line-clamp-1">{project.title || 'Project'}</p>
      <p className="text-[#c6a065] text-xs mt-0.5">
        {project.companyName}{project.companyCity ? ` \u00b7 ${project.companyCity}` : ''}
      </p>
    </div>
  ), [project]);

  return (
    <section className="mb-10">
      <div className="flex items-baseline gap-3 mb-3 cursor-pointer group/hdr" onClick={handleClick}>
        <h3 className="text-[15px] font-medium text-[#1c1917] group-hover/hdr:text-[var(--color-tarmeer-primary)] transition">
          {project.title || 'Project'}
        </h3>
        <span className="text-sm text-stone-400">
          {project.companyName}{project.companyCity ? ` \u00b7 ${project.companyCity}` : ''}
        </span>
        <span className="text-xs text-stone-300">{project.images.length} photos</span>
      </div>
      <JustifiedGallery items={items} onItemClick={handleClick} renderOverlay={renderOverlay} remainingCount={remaining} maxRows={MAX_ROWS_PER_GROUP} />
    </section>
  );
}

/* ================================================================== */
/*  Main page                                                          */
/* ================================================================== */

// ── Tag taxonomy for filter UI ──
const ROOM_FILTERS = ['Living Room', 'Bedroom', 'Kitchen', 'Bathroom', 'Dining Room', 'Home Office', 'Majlis', 'Hallway', 'Nursery', 'Patio'];
const STYLE_FILTERS = ['Modern', 'Luxury', 'Minimalist', 'Classical', 'Arabic', 'Industrial', 'Scandinavian', 'Coastal', 'Art Deco', 'Bohemian'];

// ── Portfolio state cache (survives back navigation) ──
const CACHE_KEY = 'portfolio-state';
interface CachedState {
  projects: PortfolioProject[];
  page: number;
  hasMore: boolean;
  activeTag: string;
  seed: number;
  scrollY: number;
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
  const [scrolledPastHeader, setScrolledPastHeader] = useState(false);
  const headerRef = useRef<HTMLDivElement>(null);
  const observerRef = useRef<HTMLDivElement>(null);
  const loadedRef = useRef(!!cached); // skip initial load if we have cache
  const seedRef = useRef(cached?.seed || Math.floor(Math.random() * 1000000));
  const navigate = useNavigate();

  // Restore scroll position after mount
  useEffect(() => {
    if (cached) {
      // Wait for layout to settle then scroll
      const t = setTimeout(() => window.scrollTo(0, cached.scrollY), 50);
      return () => clearTimeout(t);
    }
  }, []);

  // Save state to cache when leaving the page
  useEffect(() => {
    return () => {
      writeCache({
        projects,
        page,
        hasMore,
        activeTag,
        seed: seedRef.current,
        scrollY: window.scrollY,
      });
    };
  }, [projects, page, hasMore, activeTag]);

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

  useEffect(() => {
    if (!observerRef.current) return;
    const target = observerRef.current;
    const observer = new IntersectionObserver(
      entries => { if (entries[0].isIntersecting && hasMore && !loading) loadMore(); },
      { threshold: 0.1, rootMargin: '0px 0px 800px 0px' },
    );
    observer.observe(target);
    return () => observer.disconnect();
  }, [hasMore, loading, loadMore]);

  const { grouped, singles } = useMemo(() => {
    const g: PortfolioProject[] = [];
    const s: PortfolioProject[] = [];
    for (const p of projects) {
      if (p.images.length > 1) g.push(p);
      else if (p.images.length === 1) s.push(p);
    }
    return { grouped: g, singles: s };
  }, [projects]);

  const singlesUrls = useMemo(() => singles.map(s => s.images[0]), [singles]);
  const singlesItems = useImagePreloader(singlesUrls);

  const handleSingleClick = useCallback((idx: number) => {
    const proj = singles[idx];
    if (!proj) return;
    navigate(proj.slug ? `/companies/${proj.companySlug}/${proj.slug}` : `/companies/${proj.companySlug}`);
  }, [singles, navigate]);

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
                  ...(p.images[0] ? { image: `https://www.tarmeer.com${p.images[0]}` } : {}),
                  ...(p.companySlug && p.slug ? { url: `https://www.tarmeer.com/companies/${p.companySlug}/${p.slug}` } : {}),
                },
              })),
            },
          })}
        </script>
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
          <ProjectGroup key={`g-${project.id}`} project={project} maxImages={MAX_IMAGES_PER_GROUP} />
        ))}

        {singles.length > 0 && (
          <section className="mb-10" style={{ marginTop: grouped.length > 0 ? 32 : 0 }}>
            {grouped.length > 0 && (
              <div className="flex items-baseline gap-3 mb-3">
                <h3 className="text-[15px] font-medium text-stone-400">More projects</h3>
              </div>
            )}
            <JustifiedGallery items={singlesItems} onItemClick={handleSingleClick} renderOverlay={renderSingleOverlay} />
          </section>
        )}

        <div ref={observerRef} className="h-20 flex items-center justify-center">
          {loading && !initialLoading && (
            <div className="w-8 h-8 rounded-full border-2 border-[var(--color-tarmeer-primary)]/20 border-t-[var(--color-tarmeer-primary)] animate-spin" />
          )}
        </div>
      </div>

      <style>{`
        @keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }
      `}</style>
    </div>
  );
}
