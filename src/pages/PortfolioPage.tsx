import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Helmet } from 'react-helmet-async';
import { useNavigate } from 'react-router-dom';
import { resolveImageUrl } from '../lib/imageUrl';
import { fetchPortfolioFeed, type PortfolioProject } from '../lib/publicApi';

/* ================================================================== */
/*  Pure masonry layout engine (no React, no side effects)             */
/*  Algorithm: greedy shortest-column — same as Pinterest & Masonry.js */
/* ================================================================== */

const GAP = 10;
const DEFAULT_RATIO = 1.33; // 4:3 — stable default, minimal reflow
const MAX_IMAGES_PER_GROUP = 10;

interface Pos { x: number; y: number; w: number; h: number }

function computeMasonry(
  ratios: number[],       // width/height per item (0 = hidden)
  containerWidth: number,
  cols: number,
): { positions: Pos[]; height: number } {
  if (containerWidth <= 0 || cols <= 0) return { positions: ratios.map(() => ({ x: 0, y: 0, w: 0, h: 0 })), height: 0 };

  const colW = (containerWidth - GAP * (cols - 1)) / cols;
  const colH = new Float64Array(cols); // typed array for perf
  const positions: Pos[] = [];

  for (let i = 0; i < ratios.length; i++) {
    const ratio = ratios[i];
    if (ratio <= 0) { positions.push({ x: 0, y: 0, w: 0, h: 0 }); continue; }

    const h = colW / ratio;

    // Find shortest column
    let minIdx = 0;
    for (let c = 1; c < cols; c++) {
      if (colH[c] < colH[minIdx]) minIdx = c;
    }

    positions.push({
      x: minIdx * (colW + GAP),
      y: colH[minIdx],
      w: colW,
      h,
    });
    colH[minIdx] += h + GAP;
  }

  let maxH = 0;
  for (let c = 0; c < cols; c++) { if (colH[c] > maxH) maxH = colH[c]; }

  return { positions, height: maxH > 0 ? maxH - GAP : 0 };
}

function getColCount(width: number): number {
  if (width >= 1024) return 4;
  if (width >= 768) return 3;
  return 2;
}

/* ================================================================== */
/*  Masonry component — shared by groups and singles                   */
/* ================================================================== */

interface MasonryItem {
  src: string;
  ratio: number;    // 0 = hidden
  loaded: boolean;
}

function Masonry({
  items,
  onItemClick,
  renderOverlay,
  remainingCount,
}: {
  items: MasonryItem[];
  onItemClick: (index: number) => void;
  renderOverlay?: (index: number) => React.ReactNode;
  remainingCount?: number;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(0);

  // Measure container via ResizeObserver
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const measure = () => setContainerWidth(el.clientWidth);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Pure layout computation
  const { positions, height } = useMemo(() => {
    const cols = getColCount(containerWidth);
    const ratios = items.map(it => it.ratio);
    return computeMasonry(ratios, containerWidth, cols);
  }, [items, containerWidth]);

  return (
    <div ref={containerRef} className="relative w-full" style={{ height }}>
      {items.map((item, i) => {
        if (item.ratio <= 0) return null;
        const pos = positions[i];
        if (!pos || pos.w === 0) return null;

        const isLastWithMore = remainingCount && remainingCount > 0 && i === items.length - 1;

        return (
          <div
            key={i}
            className="absolute rounded-xl overflow-hidden cursor-pointer group"
            style={{
              transform: `translate3d(${pos.x}px, ${pos.y}px, 0)`,
              width: pos.w,
              height: pos.h,
              willChange: 'transform',
              transition: 'transform 0.35s cubic-bezier(0.4,0,0.2,1), width 0.35s, height 0.35s',
            }}
            onClick={() => onItemClick(i)}
          >
            {/* Shimmer placeholder */}
            <div
              className={`absolute inset-0 rounded-xl transition-opacity duration-300 ${item.loaded ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}
              style={{
                backgroundImage: 'linear-gradient(90deg, #e7e5e4 25%, #d6d3d1 50%, #e7e5e4 75%)',
                backgroundSize: '200% 100%',
                animation: 'shimmer 1.5s infinite',
              }}
            />

            {/* Image — always in DOM for faster paint, opacity controls visibility */}
            <img
              src={resolveImageUrl(item.src)}
              alt=""
              loading="lazy"
              className={`absolute inset-0 w-full h-full object-cover transition-all duration-300 group-hover:scale-105 ${item.loaded ? 'opacity-100' : 'opacity-0'}`}
            />

            {/* Hover overlay */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            {renderOverlay?.(i)}

            {/* +N more badge */}
            {isLastWithMore && (
              <div className="absolute inset-0 bg-black/50 flex items-center justify-center rounded-xl">
                <span className="text-white text-lg font-semibold">+{remainingCount} more</span>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ================================================================== */
/*  Image preloader — batches updates via requestAnimationFrame        */
/* ================================================================== */

function useImagePreloader(urls: string[]): MasonryItem[] {
  const [items, setItems] = useState<MasonryItem[]>(() =>
    urls.map(src => ({ src, ratio: DEFAULT_RATIO, loaded: false }))
  );
  const pendingRef = useRef<Map<number, { ratio: number; hidden: boolean }>>(new Map());
  const rafRef = useRef(0);

  // Flush batched updates
  const flush = useCallback(() => {
    const pending = pendingRef.current;
    if (pending.size === 0) return;
    const batch = new Map(pending);
    pending.clear();

    setItems(prev => {
      const next = [...prev];
      for (const [idx, update] of batch) {
        if (next[idx]) {
          next[idx] = {
            src: next[idx].src,
            ratio: update.hidden ? 0 : update.ratio,
            loaded: true,
          };
        }
      }
      return next;
    });
  }, []);

  useEffect(() => {
    // Reset when URLs change
    setItems(urls.map(src => ({ src, ratio: DEFAULT_RATIO, loaded: false })));
    pendingRef.current.clear();

    urls.forEach((src, i) => {
      const img = new Image();
      img.onload = () => {
        const w = img.naturalWidth;
        const h = img.naturalHeight;
        const ratio = w / h;
        const hidden = w < 200 || h < 150 || ratio > 3.5 || ratio < 0.25;
        pendingRef.current.set(i, { ratio, hidden });

        // Batch with RAF — one flush per frame
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
/*  ProjectMasonry — one project group                                 */
/* ================================================================== */

function ProjectMasonry({
  project,
  maxImages,
}: {
  project: PortfolioProject;
  maxImages: number;
}) {
  const navigate = useNavigate();
  const visibleImages = useMemo(() => project.images.slice(0, maxImages), [project.images, maxImages]);
  const items = useImagePreloader(visibleImages);
  const remaining = project.images.length - visibleImages.length;

  const projectUrl = project.slug
    ? `/companies/${project.companySlug}/${project.slug}`
    : `/companies/${project.companySlug}`;

  const handleClick = useCallback(() => navigate(projectUrl), [navigate, projectUrl]);

  const renderOverlay = useCallback(
    () => (
      <div className="absolute inset-0 flex flex-col justify-end p-3 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none">
        <p className="text-white text-sm font-medium line-clamp-1">{project.title || 'Project'}</p>
        <p className="text-[#c6a065] text-xs mt-0.5">
          {project.companyName}{project.companyCity ? ` \u00b7 ${project.companyCity}` : ''}
        </p>
      </div>
    ),
    [project],
  );

  return (
    <section className="mb-10">
      {/* Project header */}
      <div
        className="flex items-baseline gap-3 mb-3 cursor-pointer group/header"
        onClick={handleClick}
      >
        <h3 className="text-[15px] font-medium text-[#1c1917] group-hover/header:text-[var(--color-tarmeer-primary)] transition">
          {project.title || 'Project'}
        </h3>
        <span className="text-sm text-stone-400">
          {project.companyName}{project.companyCity ? ` \u00b7 ${project.companyCity}` : ''}
        </span>
        <span className="text-xs text-stone-300">{project.images.length} photos</span>
      </div>

      <Masonry
        items={items}
        onItemClick={handleClick}
        renderOverlay={renderOverlay}
        remainingCount={remaining}
      />
    </section>
  );
}

/* ================================================================== */
/*  Main page                                                          */
/* ================================================================== */

export default function PortfolioPage() {
  const [projects, setProjects] = useState<PortfolioProject[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const observerRef = useRef<HTMLDivElement>(null);
  const loadedRef = useRef(false);
  const seedRef = useRef(Math.floor(Math.random() * 1000000));
  const navigate = useNavigate();

  const loadMore = useCallback(async () => {
    if (loading || !hasMore) return;
    setLoading(true);
    try {
      const result = await fetchPortfolioFeed(page, 12, seedRef.current);
      setProjects(prev => [...prev, ...result.projects]);
      setHasMore(result.projects.length === 12);
      setPage(prev => prev + 1);
    } catch (err) {
      console.error('Portfolio load error:', err);
    } finally {
      setLoading(false);
      setInitialLoading(false);
    }
  }, [page, loading, hasMore]);

  useEffect(() => {
    if (!loadedRef.current) { loadedRef.current = true; loadMore(); }
  }, []);

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

  // Singles masonry items
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
        <p className="text-[var(--color-tarmeer-muted)] mb-8">Explore interior design projects from UAE&apos;s top professionals</p>

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

        {/* Grouped projects */}
        {grouped.map(project => (
          <ProjectMasonry
            key={`g-${project.id}`}
            project={project}
            maxImages={MAX_IMAGES_PER_GROUP}
          />
        ))}

        {/* Single-image projects */}
        {singles.length > 0 && (
          <section className="mb-10" style={{ marginTop: grouped.length > 0 ? 32 : 0 }}>
            {grouped.length > 0 && (
              <div className="flex items-baseline gap-3 mb-3">
                <h3 className="text-[15px] font-medium text-stone-400">More projects</h3>
              </div>
            )}
            <Masonry
              items={singlesItems}
              onItemClick={handleSingleClick}
              renderOverlay={renderSingleOverlay}
            />
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
