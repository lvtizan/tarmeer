import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Helmet } from 'react-helmet-async';
import { useNavigate } from 'react-router-dom';
import { resolveImageUrl } from '../lib/imageUrl';
import { fetchPortfolioFeed, type PortfolioProject } from '../lib/publicApi';

const GAP = 12;
const COLS_MOBILE = 2;
const COLS_DESKTOP = 4;
const DEFAULT_RATIO = 0.75; // 3:4 portrait default for interior photos

interface FlatItem extends PortfolioProject {
  image: string;
  imageIndex: number;
}

interface PlacedItem {
  item: FlatItem;
  x: number;
  y: number;
  width: number;
  height: number;
  imageLoaded: boolean;
  hidden: boolean;
}

export default function PortfolioPage() {
  const [projects, setProjects] = useState<PortfolioProject[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [placed, setPlaced] = useState<PlacedItem[]>([]);
  const [containerHeight, setContainerHeight] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const observerRef = useRef<HTMLDivElement>(null);
  const loadedRef = useRef(false);
  const seedRef = useRef(Math.floor(Math.random() * 1000000));
  const placedCountRef = useRef(0);
  const colHeightsRef = useRef<number[]>([]);
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
      { threshold: 0.1, rootMargin: '0px 0px 800px 0px' }
    );
    observer.observe(target);
    return () => observer.disconnect();
  }, [hasMore, loading, loadMore]);

  const items: FlatItem[] = useMemo(() =>
    projects.flatMap(project =>
      project.images.map((img, idx) => ({ ...project, image: img, imageIndex: idx }))
    ), [projects]);

  const getCols = useCallback(() => {
    const w = containerRef.current?.offsetWidth || 800;
    return w >= 768 ? COLS_DESKTOP : COLS_MOBILE;
  }, []);

  const getColWidth = useCallback(() => {
    const w = containerRef.current?.offsetWidth || 800;
    const cols = getCols();
    return (w - GAP * (cols - 1)) / cols;
  }, [getCols]);

  // Place new items as placeholders (default ratio), then update when image loads
  useEffect(() => {
    const startIdx = placedCountRef.current;
    const newItems = items.slice(startIdx);
    if (newItems.length === 0) return;

    const cols = getCols();
    const colWidth = getColWidth();
    if (colHeightsRef.current.length !== cols) {
      colHeightsRef.current = new Array(cols).fill(0);
    }

    const newPlaced: PlacedItem[] = [];
    for (const item of newItems) {
      const defaultHeight = colWidth / DEFAULT_RATIO;
      const minH = Math.min(...colHeightsRef.current);
      const colIdx = colHeightsRef.current.indexOf(minH);
      const x = colIdx * (colWidth + GAP);
      const y = minH;

      colHeightsRef.current[colIdx] = y + defaultHeight + GAP;

      newPlaced.push({
        item,
        x, y,
        width: colWidth,
        height: defaultHeight,
        imageLoaded: false,
        hidden: false,
      });
    }

    placedCountRef.current = items.length;
    setContainerHeight(Math.max(...colHeightsRef.current));
    setPlaced(prev => [...prev, ...newPlaced]);

    // Now pre-load images in background and update real dimensions
    newPlaced.forEach((p, offset) => {
      const img = new Image();
      const globalIdx = startIdx + offset;
      img.onload = () => {
        const ratio = img.naturalWidth / img.naturalHeight;
        // Filter bad images
        if (img.naturalWidth < 200 || img.naturalHeight < 150 || ratio > 3.5 || ratio < 0.25) {
          setPlaced(prev => prev.map((it, i) =>
            i === globalIdx ? { ...it, hidden: true } : it
          ));
          return;
        }
        const realHeight = colWidth / ratio;
        const heightDiff = realHeight - p.height;

        setPlaced(prev => {
          const updated = [...prev];
          updated[globalIdx] = { ...updated[globalIdx], height: realHeight, imageLoaded: true };
          // Shift items below in the same column down/up by the height difference
          if (Math.abs(heightDiff) > 1) {
            for (let j = globalIdx + 1; j < updated.length; j++) {
              if (Math.abs(updated[j].x - p.x) < 2) {
                updated[j] = { ...updated[j], y: updated[j].y + heightDiff };
              }
            }
          }
          return updated;
        });

        // Update column height
        if (Math.abs(heightDiff) > 1) {
          const colIdx = Math.round(p.x / (colWidth + GAP));
          if (colIdx < colHeightsRef.current.length) {
            colHeightsRef.current[colIdx] += heightDiff;
            setContainerHeight(Math.max(...colHeightsRef.current));
          }
        }
      };
      img.onerror = () => {
        setPlaced(prev => prev.map((it, i) =>
          i === globalIdx ? { ...it, hidden: true } : it
        ));
      };
      img.src = resolveImageUrl(p.item.image);
    });
  }, [items, getCols, getColWidth]);

  // Re-layout on resize
  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout>;
    const handleResize = () => {
      clearTimeout(timeout);
      timeout = setTimeout(() => {
        colHeightsRef.current = [];
        placedCountRef.current = 0;
        setPlaced([]);
        setContainerHeight(0);
        setProjects(prev => [...prev]);
      }, 200);
    };
    window.addEventListener('resize', handleResize);
    return () => { window.removeEventListener('resize', handleResize); clearTimeout(timeout); };
  }, []);

  return (
    <div className="min-h-screen bg-[var(--color-tarmeer-bg)]">
      <Helmet>
        <title>Interior Design Portfolio & Inspiration - Tarmeer UAE</title>
        <meta name="description" content="Browse stunning interior design projects from top UAE designers. Get inspired by luxury villas, modern apartments, commercial spaces and more." />
        <link rel="canonical" href="https://www.tarmeer.com/portfolio" />
      </Helmet>

      <div className="max-w-[1400px] mx-auto px-4 py-8">
        <h1 className="font-serif text-3xl font-semibold text-[var(--color-tarmeer-text)] mb-2">Portfolio</h1>
        <p className="text-[var(--color-tarmeer-muted)] mb-8">Explore interior design projects from UAE&apos;s top professionals</p>

        {initialLoading && (
          <div className="flex items-center justify-center py-20">
            <div className="w-10 h-10 rounded-full border-2 border-[var(--color-tarmeer-primary)]/20 border-t-[var(--color-tarmeer-primary)] animate-spin" />
          </div>
        )}

        {!initialLoading && items.length === 0 && (
          <div className="text-center py-20">
            <p className="text-[var(--color-tarmeer-muted)]">No portfolio projects available yet.</p>
          </div>
        )}

        <div ref={containerRef} className="relative" style={{ height: containerHeight }}>
          {placed.map((p, i) => {
            if (p.hidden) return null;
            return (
              <div
                key={`${p.item.id}-${p.item.imageIndex}-${i}`}
                className="absolute rounded-xl overflow-hidden cursor-pointer group"
                style={{
                  left: p.x,
                  top: p.y,
                  width: p.width,
                  height: p.height + (p.imageLoaded ? 0 : 0),
                  transition: 'top 0.3s ease, height 0.3s ease',
                }}
                onClick={() => navigate(p.item.slug ? `/companies/${p.item.companySlug}/${p.item.slug}` : `/companies/${p.item.companySlug}`)}
              >
                {/* Gray placeholder (always rendered, image covers it) */}
                <div
                  className="absolute inset-0 bg-stone-200 rounded-xl"
                  style={{
                    animation: 'shimmer 1.5s infinite',
                    backgroundImage: 'linear-gradient(90deg, #e7e5e4 25%, #d6d3d1 50%, #e7e5e4 75%)',
                    backgroundSize: '200% 100%',
                  }}
                />

                {/* Real image (fade in when loaded) */}
                {p.imageLoaded && (
                  <img
                    src={resolveImageUrl(p.item.image)}
                    alt={`${p.item.title || 'Project'} by ${p.item.companyName}`}
                    className="absolute inset-0 w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                    style={{ animation: 'fadeIn 0.3s ease-out' }}
                  />
                )}

                {/* Desktop hover overlay */}
                {p.imageLoaded && (
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 hidden sm:flex flex-col justify-end p-4">
                    <h3 className="text-white font-medium text-sm">{p.item.title || 'Project'}</h3>
                    <p className="text-white/80 text-xs mt-1">
                      {p.item.companyName}{p.item.companyCity ? ` · ${p.item.companyCity}` : ''}
                    </p>
                    {p.item.style && <p className="text-white/60 text-xs mt-0.5">{p.item.style}</p>}
                  </div>
                )}

                {/* Mobile text */}
                {p.imageLoaded && (
                  <div className="sm:hidden absolute bottom-0 left-0 right-0 p-3 bg-white/90 backdrop-blur-sm">
                    <h3 className="text-sm font-medium text-[var(--color-tarmeer-text)] truncate">{p.item.title || 'Project'}</h3>
                    <p className="text-xs text-[var(--color-tarmeer-muted)] mt-0.5">
                      {p.item.companyName}{p.item.companyCity ? ` · ${p.item.companyCity}` : ''}
                    </p>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div ref={observerRef} className="h-20 flex items-center justify-center">
          {loading && !initialLoading && (
            <div className="w-8 h-8 rounded-full border-2 border-[var(--color-tarmeer-primary)]/20 border-t-[var(--color-tarmeer-primary)] animate-spin" />
          )}
        </div>
      </div>

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes shimmer {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
      `}</style>
    </div>
  );
}
