import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Helmet } from 'react-helmet-async';
import { useNavigate } from 'react-router-dom';
import { resolveImageUrl } from '../lib/imageUrl';
import { fetchPortfolioFeed, type PortfolioProject } from '../lib/publicApi';

const GAP = 10;
const COLS_MOBILE = 2;
const COLS_DESKTOP = 4;
const MAX_IMAGES_PER_GROUP = 10;

interface ImageSlot {
  src: string;
  ratio: number;
  loaded: boolean;
  hidden: boolean;
  x: number;
  y: number;
  w: number;
  h: number;
}

/* ------------------------------------------------------------------ */
/*  MasonryGroup — one project's images in shortest-column masonry     */
/* ------------------------------------------------------------------ */

function MasonryGroup({
  project,
  images,
  totalCount,
}: {
  project: PortfolioProject;
  images: string[];
  totalCount: number;
}) {
  const navigate = useNavigate();
  const containerRef = useRef<HTMLDivElement>(null);
  const [slots, setSlots] = useState<ImageSlot[]>([]);
  const [height, setHeight] = useState(0);

  // Measure container + compute layout
  const layout = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    const cw = el.clientWidth;
    if (cw <= 0) return;

    const cols = cw >= 768 ? COLS_DESKTOP : COLS_MOBILE;
    const colW = (cw - GAP * (cols - 1)) / cols;
    const colH = new Array(cols).fill(0);

    setSlots(prev => {
      const next = prev.length === images.length ? [...prev] : images.map((src, i) =>
        prev[i] || { src, ratio: 0.75 + Math.random() * 0.5, loaded: false, hidden: false, x: 0, y: 0, w: 0, h: 0 }
      );

      for (let i = 0; i < next.length; i++) {
        if (next[i].hidden) continue;
        const ratio = next[i].ratio;
        const h = colW / ratio;
        const minIdx = colH.indexOf(Math.min(...colH));
        next[i] = {
          ...next[i],
          x: minIdx * (colW + GAP),
          y: colH[minIdx],
          w: colW,
          h,
        };
        colH[minIdx] += h + GAP;
      }

      setHeight(Math.max(...colH));
      return next;
    });
  }, [images]);

  // Initial layout
  useEffect(() => {
    // Initialize slots with varied default ratios for visual interest
    const initial: ImageSlot[] = images.map(src => ({
      src,
      ratio: 0.75 + Math.random() * 0.5, // random between 0.75 and 1.25
      loaded: false,
      hidden: false,
      x: 0, y: 0, w: 0, h: 0,
    }));
    setSlots(initial);
  }, [images]);

  // Layout when slots change or container resizes
  useEffect(() => {
    layout();
    const ro = new ResizeObserver(() => layout());
    if (containerRef.current) ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, [layout, slots.length]);

  // Preload images and update with real ratios
  useEffect(() => {
    images.forEach((src, i) => {
      const img = new Image();
      img.onload = () => {
        const w = img.naturalWidth;
        const h = img.naturalHeight;
        const ratio = w / h;
        const hidden = w < 200 || h < 150 || ratio > 3.5 || ratio < 0.25;
        setSlots(prev => {
          const next = [...prev];
          if (next[i]) next[i] = { ...next[i], ratio: hidden ? 1 : ratio, loaded: true, hidden };
          return next;
        });
      };
      img.onerror = () => {
        setSlots(prev => {
          const next = [...prev];
          if (next[i]) next[i] = { ...next[i], loaded: true, hidden: true };
          return next;
        });
      };
      img.src = resolveImageUrl(src);
    });
  }, [images]);

  // Re-layout when a slot's ratio changes
  useEffect(() => { layout(); }, [slots.map(s => `${s.ratio}:${s.hidden}`).join(',')]);

  const projectUrl = project.slug
    ? `/companies/${project.companySlug}/${project.slug}`
    : `/companies/${project.companySlug}`;

  const shownCount = slots.filter(s => !s.hidden).length;
  const remaining = totalCount - shownCount;

  return (
    <section className="mb-10">
      {/* Project header */}
      <div
        className="flex items-baseline gap-3 mb-3 cursor-pointer group/header"
        onClick={() => navigate(projectUrl)}
      >
        <h3 className="text-[15px] font-medium text-[#1c1917] group-hover/header:text-[var(--color-tarmeer-primary)] transition">
          {project.title || 'Project'}
        </h3>
        <span className="text-sm text-stone-400">
          {project.companyName}
          {project.companyCity ? ` \u00b7 ${project.companyCity}` : ''}
        </span>
        <span className="text-xs text-stone-300">{totalCount} photos</span>
      </div>

      {/* Masonry container */}
      <div ref={containerRef} className="relative" style={{ height }}>
        {slots.map((slot, i) => {
          if (slot.hidden) return null;
          const isLast = i === slots.length - 1 && remaining > 0;
          return (
            <div
              key={i}
              className="absolute rounded-xl overflow-hidden cursor-pointer group"
              style={{
                left: slot.x,
                top: slot.y,
                width: slot.w,
                height: slot.h,
                transition: 'top 0.3s ease, height 0.3s ease, left 0.3s ease',
              }}
              onClick={() => navigate(projectUrl)}
            >
              {/* Shimmer placeholder */}
              <div
                className={`absolute inset-0 rounded-xl transition-opacity duration-300 ${slot.loaded ? 'opacity-0' : 'opacity-100'}`}
                style={{
                  backgroundImage: 'linear-gradient(90deg, #e7e5e4 25%, #d6d3d1 50%, #e7e5e4 75%)',
                  backgroundSize: '200% 100%',
                  animation: 'shimmer 1.5s infinite',
                }}
              />

              {/* Real image */}
              {slot.loaded && (
                <img
                  src={resolveImageUrl(slot.src)}
                  alt={`${project.title || 'Interior Design'} by ${project.companyName}${project.companyCity ? ` in ${project.companyCity}` : ''}`}
                  className="absolute inset-0 w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                  style={{ animation: 'fadeIn 0.3s ease-out' }}
                />
              )}

              {/* Hover overlay */}
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors duration-300" />
              <div className="absolute inset-0 flex flex-col justify-end p-3 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                <p className="text-white text-sm font-medium line-clamp-1">{project.title || 'Project'}</p>
                <p className="text-[#c6a065] text-xs mt-0.5">
                  {project.companyName}{project.companyCity ? ` \u00b7 ${project.companyCity}` : ''}
                </p>
              </div>

              {/* +N more badge */}
              {isLast && (
                <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                  <span className="text-white text-lg font-semibold">+{remaining} more</span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/*  Main page                                                          */
/* ------------------------------------------------------------------ */

export default function PortfolioPage() {
  const [projects, setProjects] = useState<PortfolioProject[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const observerRef = useRef<HTMLDivElement>(null);
  const loadedRef = useRef(false);
  const seedRef = useRef(Math.floor(Math.random() * 1000000));

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

  // Merge singles into a fake "project" for masonry rendering
  const singlesAsProject: PortfolioProject | null = useMemo(() => {
    if (singles.length === 0) return null;
    return {
      id: -1,
      title: '',
      description: '',
      style: '',
      location: '',
      year: null,
      images: singles.map(s => s.images[0]),
      companyId: 0,
      companyName: '',
      companySlug: '',
      companyLogo: '',
      companyCity: '',
      source: 'registered' as const,
    };
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

        {/* Grouped projects — masonry per project */}
        {grouped.map(project => (
          <MasonryGroup
            key={`g-${project.id}`}
            project={project}
            images={project.images.slice(0, MAX_IMAGES_PER_GROUP)}
            totalCount={project.images.length}
          />
        ))}

        {/* Single-image projects — mixed masonry */}
        {singles.length > 0 && singlesAsProject && (
          <section className="mb-10" style={{ marginTop: grouped.length > 0 ? 32 : 0 }}>
            {grouped.length > 0 && (
              <div className="flex items-baseline gap-3 mb-3">
                <h3 className="text-[15px] font-medium text-stone-400">More projects</h3>
              </div>
            )}
            {/* Render singles individually with hover info */}
            <SinglesMasonry singles={singles} />
          </section>
        )}

        <div ref={observerRef} className="h-20 flex items-center justify-center">
          {loading && !initialLoading && (
            <div className="w-8 h-8 rounded-full border-2 border-[var(--color-tarmeer-primary)]/20 border-t-[var(--color-tarmeer-primary)] animate-spin" />
          )}
        </div>
      </div>

      <style>{`
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }
      `}</style>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  SinglesMasonry — individual project cards in masonry                */
/* ------------------------------------------------------------------ */

function SinglesMasonry({ singles }: { singles: PortfolioProject[] }) {
  const navigate = useNavigate();
  const containerRef = useRef<HTMLDivElement>(null);
  const [slots, setSlots] = useState<(ImageSlot & { projectIdx: number })[]>([]);
  const [height, setHeight] = useState(0);

  const images = useMemo(() => singles.map(s => s.images[0]), [singles]);

  const layout = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    const cw = el.clientWidth;
    if (cw <= 0) return;
    const cols = cw >= 768 ? COLS_DESKTOP : COLS_MOBILE;
    const colW = (cw - GAP * (cols - 1)) / cols;
    const colH = new Array(cols).fill(0);

    setSlots(prev => {
      const next = prev.length === images.length ? [...prev] : images.map((src, i) =>
        prev[i] || { src, ratio: 0.75 + Math.random() * 0.5, loaded: false, hidden: false, x: 0, y: 0, w: 0, h: 0, projectIdx: i }
      );
      for (let i = 0; i < next.length; i++) {
        if (next[i].hidden) continue;
        const h = colW / next[i].ratio;
        const minIdx = colH.indexOf(Math.min(...colH));
        next[i] = { ...next[i], x: minIdx * (colW + GAP), y: colH[minIdx], w: colW, h };
        colH[minIdx] += h + GAP;
      }
      setHeight(Math.max(...colH));
      return next;
    });
  }, [images]);

  useEffect(() => {
    setSlots(images.map((src, i) => ({
      src, ratio: 0.75 + Math.random() * 0.5, loaded: false, hidden: false, x: 0, y: 0, w: 0, h: 0, projectIdx: i,
    })));
  }, [images]);

  useEffect(() => {
    layout();
    const ro = new ResizeObserver(() => layout());
    if (containerRef.current) ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, [layout, slots.length]);

  useEffect(() => {
    images.forEach((src, i) => {
      const img = new Image();
      img.onload = () => {
        const w = img.naturalWidth, h = img.naturalHeight, ratio = w / h;
        const hidden = w < 200 || h < 150 || ratio > 3.5 || ratio < 0.25;
        setSlots(prev => {
          const next = [...prev];
          if (next[i]) next[i] = { ...next[i], ratio: hidden ? 1 : ratio, loaded: true, hidden };
          return next;
        });
      };
      img.onerror = () => {
        setSlots(prev => { const next = [...prev]; if (next[i]) next[i] = { ...next[i], loaded: true, hidden: true }; return next; });
      };
      img.src = resolveImageUrl(src);
    });
  }, [images]);

  useEffect(() => { layout(); }, [slots.map(s => `${s.ratio}:${s.hidden}`).join(',')]);

  return (
    <div ref={containerRef} className="relative" style={{ height }}>
      {slots.map((slot) => {
        if (slot.hidden) return null;
        const proj = singles[slot.projectIdx];
        if (!proj) return null;
        const url = proj.slug ? `/companies/${proj.companySlug}/${proj.slug}` : `/companies/${proj.companySlug}`;
        return (
          <div
            key={`s-${proj.id}`}
            className="absolute rounded-xl overflow-hidden cursor-pointer group"
            style={{ left: slot.x, top: slot.y, width: slot.w, height: slot.h, transition: 'top 0.3s ease, height 0.3s ease, left 0.3s ease' }}
            onClick={() => navigate(url)}
          >
            <div
              className={`absolute inset-0 rounded-xl transition-opacity duration-300 ${slot.loaded ? 'opacity-0' : 'opacity-100'}`}
              style={{ backgroundImage: 'linear-gradient(90deg, #e7e5e4 25%, #d6d3d1 50%, #e7e5e4 75%)', backgroundSize: '200% 100%', animation: 'shimmer 1.5s infinite' }}
            />
            {slot.loaded && (
              <img src={resolveImageUrl(slot.src)} alt={`${proj.title || 'Project'} by ${proj.companyName}`}
                className="absolute inset-0 w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                style={{ animation: 'fadeIn 0.3s ease-out' }} />
            )}
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors duration-300" />
            <div className="absolute inset-0 flex flex-col justify-end p-3 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
              <p className="text-white text-sm font-medium line-clamp-1">{proj.title || 'Project'}</p>
              <p className="text-[#c6a065] text-xs mt-0.5">{proj.companyName}{proj.companyCity ? ` \u00b7 ${proj.companyCity}` : ''}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
