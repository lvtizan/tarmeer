import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Helmet } from 'react-helmet-async';
import { useNavigate } from 'react-router-dom';
import { SlidersHorizontal, X } from 'lucide-react';
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
    ? `/companies/${project.companySlug}/${project.slug}`
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

export default function PortfolioPage() {
  const [projects, setProjects] = useState<PortfolioProject[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [activeTag, setActiveTag] = useState('');
  const [filterOpen, setFilterOpen] = useState(false);
  const observerRef = useRef<HTMLDivElement>(null);
  const loadedRef = useRef(false);
  const seedRef = useRef(Math.floor(Math.random() * 1000000));
  const navigate = useNavigate();

  // Reset and reload when tag changes
  const selectTag = useCallback((tag: string) => {
    const newTag = tag === activeTag ? '' : tag;
    setActiveTag(newTag);
    setProjects([]);
    setPage(1);
    setHasMore(true);
    setLoading(false);
    loadedRef.current = false;
    seedRef.current = Math.floor(Math.random() * 1000000);
  }, [activeTag]);

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

      <div className="max-w-[1400px] mx-auto px-4 py-8">
        <h1 className="font-serif text-3xl font-semibold text-[var(--color-tarmeer-text)] mb-2">Portfolio</h1>
        <div className="flex items-center gap-3 mb-8">
          <p className="text-[var(--color-tarmeer-muted)]">Explore interior design projects from UAE&apos;s top professionals</p>
          {activeTag && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[var(--color-tarmeer-primary)] text-white text-sm">
              {activeTag}
              <button onClick={() => selectTag(activeTag)} className="hover:opacity-70"><X className="w-3.5 h-3.5" /></button>
            </span>
          )}
        </div>

        {/* ── Floating filter toggle button ── */}
        <button
          onClick={() => setFilterOpen(!filterOpen)}
          className={`fixed right-4 top-1/2 -translate-y-1/2 z-40 w-10 h-10 rounded-full shadow-lg flex items-center justify-center transition-colors ${
            filterOpen || activeTag
              ? 'bg-[var(--color-tarmeer-primary)] text-white'
              : 'bg-white text-stone-600 border border-stone-200 hover:border-stone-400'
          }`}
        >
          <SlidersHorizontal className="w-4.5 h-4.5" />
        </button>

        {/* ── Floating filter panel (right side) ── */}
        <div className={`fixed right-0 top-0 h-full z-30 transition-transform duration-300 ${filterOpen ? 'translate-x-0' : 'translate-x-full'}`}>
          <div className="h-full w-64 bg-white/95 backdrop-blur-sm border-l border-stone-200 shadow-2xl overflow-y-auto pt-20 pb-8 px-5">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-sm font-semibold text-[var(--color-tarmeer-text)]">Filters</h2>
              <button onClick={() => setFilterOpen(false)} className="w-7 h-7 rounded-full hover:bg-stone-100 flex items-center justify-center">
                <X className="w-4 h-4 text-stone-400" />
              </button>
            </div>

            <div className="mb-6">
              <h3 className="text-xs font-semibold text-stone-400 uppercase tracking-wider mb-3">By Room</h3>
              <div className="flex flex-col gap-1.5">
                {ROOM_FILTERS.map(tag => (
                  <button
                    key={tag}
                    onClick={() => { selectTag(tag); }}
                    className={`text-left px-3 py-1.5 rounded-lg text-sm transition ${
                      activeTag === tag
                        ? 'bg-[var(--color-tarmeer-primary)] text-white font-medium'
                        : 'text-stone-600 hover:bg-stone-100'
                    }`}
                  >
                    {tag}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <h3 className="text-xs font-semibold text-stone-400 uppercase tracking-wider mb-3">By Style</h3>
              <div className="flex flex-col gap-1.5">
                {STYLE_FILTERS.map(tag => (
                  <button
                    key={tag}
                    onClick={() => { selectTag(tag); }}
                    className={`text-left px-3 py-1.5 rounded-lg text-sm transition ${
                      activeTag === tag
                        ? 'bg-[var(--color-tarmeer-primary)] text-white font-medium'
                        : 'text-stone-600 hover:bg-stone-100'
                    }`}
                  >
                    {tag}
                  </button>
                ))}
              </div>
            </div>

            {activeTag && (
              <button
                onClick={() => selectTag(activeTag)}
                className="mt-6 w-full py-2 text-sm text-stone-500 border border-stone-200 rounded-lg hover:bg-stone-50 transition"
              >
                Clear filter
              </button>
            )}
          </div>
        </div>

        {/* Backdrop */}
        {filterOpen && (
          <div className="fixed inset-0 z-20 bg-black/20" onClick={() => setFilterOpen(false)} />
        )}

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
