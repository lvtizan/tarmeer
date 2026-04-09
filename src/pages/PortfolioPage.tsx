import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Helmet } from 'react-helmet-async';
import { useNavigate } from 'react-router-dom';
import { resolveImageUrl } from '../lib/imageUrl';
import { fetchPortfolioFeed, type PortfolioProject } from '../lib/publicApi';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface ImageMeta {
  src: string;
  ratio: number;        // width / height
  loaded: boolean;
  hidden: boolean;       // filtered out (too small / extreme ratio)
}

interface RowItem {
  meta: ImageMeta;
  width: number;         // computed px width in justified row
  height: number;        // computed px height in justified row
  index: number;         // original index within the image list
}

interface JustifiedRow {
  items: RowItem[];
  height: number;
}

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const GAP = 8;
const DEFAULT_RATIO = 4 / 3;
const TARGET_HEIGHT_DESKTOP = 250;
const TARGET_HEIGHT_MOBILE = 180;
const MAX_ROWS = 2;
const MAX_IMAGES_PER_GROUP = 8;

/* ------------------------------------------------------------------ */
/*  Justified-row algorithm                                            */
/* ------------------------------------------------------------------ */

function computeJustifiedRows(
  metas: ImageMeta[],
  containerWidth: number,
  targetHeight: number,
  maxRows: number,
): JustifiedRow[] {
  // Filter to only visible (non-hidden) images
  const visible = metas
    .map((m, i) => ({ meta: m, index: i }))
    .filter(({ meta }) => !meta.hidden);

  if (visible.length === 0 || containerWidth <= 0) return [];

  const rows: JustifiedRow[] = [];
  let cursor = 0;

  while (cursor < visible.length && rows.length < maxRows) {
    // Accumulate items until row width (at targetHeight) >= containerWidth
    const rowStart = cursor;
    let totalRatioSum = 0;

    while (cursor < visible.length) {
      const ratio = visible[cursor].meta.loaded
        ? visible[cursor].meta.ratio
        : DEFAULT_RATIO;
      totalRatioSum += ratio;
      cursor++;

      // Available width after subtracting gaps
      const gaps = (cursor - rowStart - 1) * GAP;
      const naturalWidth = totalRatioSum * targetHeight + gaps;
      if (naturalWidth >= containerWidth) break;
    }

    // Now compute actual height so all items fit exactly in containerWidth
    const count = cursor - rowStart;
    const gaps = (count - 1) * GAP;
    const availableWidth = containerWidth - gaps;

    let ratioSum = 0;
    for (let i = rowStart; i < cursor; i++) {
      const r = visible[i].meta.loaded ? visible[i].meta.ratio : DEFAULT_RATIO;
      ratioSum += r;
    }

    // rowHeight = availableWidth / ratioSum
    const rowHeight = Math.min(availableWidth / ratioSum, targetHeight * 1.8);

    const items: RowItem[] = [];
    for (let i = rowStart; i < cursor; i++) {
      const ratio = visible[i].meta.loaded ? visible[i].meta.ratio : DEFAULT_RATIO;
      items.push({
        meta: visible[i].meta,
        width: ratio * rowHeight,
        height: rowHeight,
        index: visible[i].index,
      });
    }

    rows.push({ items, height: rowHeight });
  }

  return rows;
}

/* ------------------------------------------------------------------ */
/*  useContainerWidth hook                                             */
/* ------------------------------------------------------------------ */

function useContainerWidth(ref: React.RefObject<HTMLDivElement | null>): number {
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const measure = () => setWidth(el.clientWidth);
    measure();

    const ro = new ResizeObserver(() => measure());
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);

  return width;
}

/* ------------------------------------------------------------------ */
/*  Image preloader hook                                               */
/* ------------------------------------------------------------------ */

function useImageMetas(urls: string[]): ImageMeta[] {
  const [metas, setMetas] = useState<ImageMeta[]>(() =>
    urls.map(src => ({ src, ratio: DEFAULT_RATIO, loaded: false, hidden: false })),
  );
  const prevUrlsRef = useRef<string>('');

  useEffect(() => {
    const key = urls.join('|');
    if (key === prevUrlsRef.current) return;
    prevUrlsRef.current = key;

    const initial: ImageMeta[] = urls.map(src => ({
      src,
      ratio: DEFAULT_RATIO,
      loaded: false,
      hidden: false,
    }));
    setMetas(initial);

    urls.forEach((src, i) => {
      const img = new Image();
      img.onload = () => {
        const w = img.naturalWidth;
        const h = img.naturalHeight;
        const ratio = w / h;
        const hidden = w < 200 || h < 150 || ratio > 3.5 || ratio < 0.25;
        setMetas(prev => {
          const next = [...prev];
          if (next[i]) {
            next[i] = { src, ratio: hidden ? DEFAULT_RATIO : ratio, loaded: true, hidden };
          }
          return next;
        });
      };
      img.onerror = () => {
        setMetas(prev => {
          const next = [...prev];
          if (next[i]) {
            next[i] = { ...next[i], loaded: true, hidden: true };
          }
          return next;
        });
      };
      img.src = resolveImageUrl(src);
    });
  }, [urls]);

  return metas;
}

/* ------------------------------------------------------------------ */
/*  JustifiedGroup component                                           */
/* ------------------------------------------------------------------ */

function JustifiedGroup({
  project,
  images,
  totalCount,
}: {
  project: PortfolioProject;
  images: string[];
  totalCount: number;
}) {
  const navigate = useNavigate();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const containerWidth = useContainerWidth(containerRef);
  const metas = useImageMetas(images);

  const isMobile = containerWidth > 0 && containerWidth < 640;
  const targetHeight = isMobile ? TARGET_HEIGHT_MOBILE : TARGET_HEIGHT_DESKTOP;

  const rows = useMemo(
    () => computeJustifiedRows(metas, containerWidth, targetHeight, MAX_ROWS),
    [metas, containerWidth, targetHeight],
  );

  const projectUrl = project.slug
    ? `/companies/${project.companySlug}/${project.slug}`
    : `/companies/${project.companySlug}`;

  const shownCount = rows.reduce(
    (acc, row) => acc + row.items.filter(it => !it.meta.hidden).length,
    0,
  );
  const remaining = totalCount - shownCount;

  return (
    <section className="mb-8">
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
      </div>

      {/* Justified rows */}
      <div ref={containerRef} className="w-full">
        {rows.map((row, ri) => (
          <div
            key={ri}
            className="flex"
            style={{ gap: GAP, marginBottom: ri < rows.length - 1 ? GAP : 0 }}
          >
            {row.items.map((item, ci) => {
              const isLast = ri === rows.length - 1 && ci === row.items.length - 1 && remaining > 0;
              return (
                <div
                  key={item.index}
                  className="relative rounded-xl overflow-hidden cursor-pointer group flex-shrink-0"
                  style={{ width: item.width, height: item.height }}
                  onClick={() => navigate(projectUrl)}
                >
                  {/* Shimmer placeholder */}
                  <div
                    className={`absolute inset-0 rounded-xl transition-opacity duration-300 ${item.meta.loaded && !item.meta.hidden ? 'opacity-0' : 'opacity-100'}`}
                    style={{
                      backgroundImage:
                        'linear-gradient(90deg, #e7e5e4 25%, #d6d3d1 50%, #e7e5e4 75%)',
                      backgroundSize: '200% 100%',
                      animation: 'shimmer 1.5s infinite',
                    }}
                  />

                  {/* Actual image */}
                  {!item.meta.hidden && (
                    <img
                      src={resolveImageUrl(item.meta.src)}
                      alt={`${project.title || 'Interior Design Project'} by ${project.companyName}${project.companyCity ? ` in ${project.companyCity}` : ''}${project.style ? ` - ${project.style}` : ''}`}
                      title={project.title || undefined}
                      loading="lazy"
                      className={`absolute inset-0 w-full h-full object-cover transition-all duration-300 group-hover:scale-105 ${item.meta.loaded ? 'opacity-100' : 'opacity-0'}`}
                    />
                  )}

                  {/* Hover overlay */}
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors duration-300 rounded-xl" />
                  <div className="absolute inset-0 flex flex-col justify-end p-3 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                    <p className="text-white text-sm font-medium leading-snug line-clamp-2">
                      {project.title || 'Project'}
                    </p>
                    <p className="text-[#c6a065] text-xs mt-0.5">
                      {project.companyName}
                      {project.companyCity ? ` \u00b7 ${project.companyCity}` : ''}
                    </p>
                  </div>

                  {/* "+N more" indicator */}
                  {isLast && (
                    <div className="absolute inset-0 bg-black/50 flex items-center justify-center rounded-xl">
                      <span className="text-white text-lg font-semibold">+{remaining} more</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ))}

        {/* Fallback when container hasn't measured yet */}
        {containerWidth === 0 && (
          <div className="flex gap-2">
            {images.slice(0, 4).map((_, i) => (
              <div
                key={i}
                className="rounded-xl flex-1"
                style={{
                  height: TARGET_HEIGHT_DESKTOP,
                  backgroundImage:
                    'linear-gradient(90deg, #e7e5e4 25%, #d6d3d1 50%, #e7e5e4 75%)',
                  backgroundSize: '200% 100%',
                  animation: 'shimmer 1.5s infinite',
                }}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/*  JustifiedSingles — mixed single-image projects in justified rows   */
/* ------------------------------------------------------------------ */

function JustifiedSingles({ projects }: { projects: PortfolioProject[] }) {
  const navigate = useNavigate();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const containerWidth = useContainerWidth(containerRef);

  const urls = useMemo(() => projects.map(p => p.images[0]), [projects]);
  const metas = useImageMetas(urls);

  const isMobile = containerWidth > 0 && containerWidth < 640;
  const targetHeight = isMobile ? TARGET_HEIGHT_MOBILE : TARGET_HEIGHT_DESKTOP;

  // No max-rows limit for singles — show all
  const rows = useMemo(
    () => computeJustifiedRows(metas, containerWidth, targetHeight, 999),
    [metas, containerWidth, targetHeight],
  );

  return (
    <div ref={containerRef} className="w-full">
      {rows.map((row, ri) => (
        <div
          key={ri}
          className="flex"
          style={{ gap: GAP, marginBottom: ri < rows.length - 1 ? GAP : 0 }}
        >
          {row.items.map(item => {
            const project = projects[item.index];
            if (!project) return null;
            const projectUrl = project.slug
              ? `/companies/${project.companySlug}/${project.slug}`
              : `/companies/${project.companySlug}`;

            return (
              <div
                key={`s-${project.id}`}
                className="relative rounded-xl overflow-hidden cursor-pointer group flex-shrink-0"
                style={{ width: item.width, height: item.height }}
                onClick={() => navigate(projectUrl)}
              >
                {/* Shimmer */}
                <div
                  className={`absolute inset-0 rounded-xl transition-opacity duration-300 ${item.meta.loaded && !item.meta.hidden ? 'opacity-0' : 'opacity-100'}`}
                  style={{
                    backgroundImage:
                      'linear-gradient(90deg, #e7e5e4 25%, #d6d3d1 50%, #e7e5e4 75%)',
                    backgroundSize: '200% 100%',
                    animation: 'shimmer 1.5s infinite',
                  }}
                />

                {!item.meta.hidden && (
                  <img
                    src={resolveImageUrl(item.meta.src)}
                    alt={`${project.title || 'Interior Design Project'} by ${project.companyName}${project.companyCity ? ` in ${project.companyCity}` : ''}${project.style ? ` - ${project.style}` : ''}`}
                    title={project.title || undefined}
                    loading="lazy"
                    className={`absolute inset-0 w-full h-full object-cover transition-all duration-300 group-hover:scale-105 ${item.meta.loaded ? 'opacity-100' : 'opacity-0'}`}
                  />
                )}

                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors duration-300 rounded-xl" />
                <div className="absolute inset-0 flex flex-col justify-end p-3 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                  <p className="text-white text-sm font-medium leading-snug line-clamp-2">
                    {project.title || 'Project'}
                  </p>
                  <p className="text-[#c6a065] text-xs mt-0.5">
                    {project.companyName}
                    {project.companyCity ? ` \u00b7 ${project.companyCity}` : ''}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      ))}

      {containerWidth === 0 && (
        <div className="flex gap-2">
          {projects.slice(0, 4).map((_, i) => (
            <div
              key={i}
              className="rounded-xl flex-1"
              style={{
                height: TARGET_HEIGHT_DESKTOP,
                backgroundImage:
                  'linear-gradient(90deg, #e7e5e4 25%, #d6d3d1 50%, #e7e5e4 75%)',
                backgroundSize: '200% 100%',
                animation: 'shimmer 1.5s infinite',
              }}
            />
          ))}
        </div>
      )}
    </div>
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
    if (!loadedRef.current) {
      loadedRef.current = true;
      loadMore();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!observerRef.current) return;
    const target = observerRef.current;
    const observer = new IntersectionObserver(
      entries => {
        if (entries[0].isIntersecting && hasMore && !loading) loadMore();
      },
      { threshold: 0.1, rootMargin: '0px 0px 800px 0px' },
    );
    observer.observe(target);
    return () => observer.disconnect();
  }, [hasMore, loading, loadMore]);

  // Separate multi-image projects (grouped) from single-image (mixed)
  const { grouped, singles } = useMemo(() => {
    const g: PortfolioProject[] = [];
    const s: PortfolioProject[] = [];
    for (const p of projects) {
      if (p.images.length > 1) g.push(p);
      else if (p.images.length === 1) s.push(p);
    }
    return { grouped: g, singles: s };
  }, [projects]);

  return (
    <div className="min-h-screen bg-[var(--color-tarmeer-bg)]">
      <Helmet>
        <title>Interior Design Portfolio & Inspiration - Tarmeer UAE</title>
        <meta
          name="description"
          content="Browse stunning interior design projects from top UAE designers. Get inspired by luxury villas, modern apartments, commercial spaces and more."
        />
        <link rel="canonical" href="https://www.tarmeer.com/portfolio" />
        <script type="application/ld+json">
          {JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'CollectionPage',
            name: 'Interior Design Portfolio - Tarmeer UAE',
            description:
              'Browse stunning interior design projects from top UAE designers.',
            url: 'https://www.tarmeer.com/portfolio',
            mainEntity: {
              '@type': 'ItemList',
              itemListElement: projects.slice(0, 20).map((p, i) => ({
                '@type': 'ListItem',
                position: i + 1,
                item: {
                  '@type': 'CreativeWork',
                  name: p.title || 'Interior Design Project',
                  description:
                    p.description ||
                    `${p.style || 'Interior design'} project by ${p.companyName}`,
                  creator: { '@type': 'Organization', name: p.companyName },
                  ...(p.images[0]
                    ? { image: `https://www.tarmeer.com${p.images[0]}` }
                    : {}),
                  ...(p.companySlug && p.slug
                    ? {
                        url: `https://www.tarmeer.com/companies/${p.companySlug}/${p.slug}`,
                      }
                    : {}),
                },
              })),
            },
          })}
        </script>
      </Helmet>

      <div className="max-w-[1400px] mx-auto px-4 py-8">
        <h1 className="font-serif text-3xl font-semibold text-[var(--color-tarmeer-text)] mb-2">
          Portfolio
        </h1>
        <p className="text-[var(--color-tarmeer-muted)] mb-8">
          Explore interior design projects from UAE&apos;s top professionals
        </p>

        {/* Initial loading spinner */}
        {initialLoading && (
          <div className="flex items-center justify-center py-20">
            <div className="w-10 h-10 rounded-full border-2 border-[var(--color-tarmeer-primary)]/20 border-t-[var(--color-tarmeer-primary)] animate-spin" />
          </div>
        )}

        {/* Empty state */}
        {!initialLoading && projects.length === 0 && (
          <div className="text-center py-20">
            <p className="text-[var(--color-tarmeer-muted)]">
              No portfolio projects available yet.
            </p>
          </div>
        )}

        {/* Grouped projects — justified rows per project */}
        {grouped.map(project => (
          <JustifiedGroup
            key={`g-${project.id}`}
            project={project}
            images={project.images.slice(0, MAX_IMAGES_PER_GROUP)}
            totalCount={project.images.length}
          />
        ))}

        {/* Single-image projects — mixed together in justified rows */}
        {singles.length > 0 && (
          <section className="mb-8" style={{ marginTop: grouped.length > 0 ? 32 : 0 }}>
            {grouped.length > 0 && (
              <div className="flex items-baseline gap-3 mb-3">
                <h3 className="text-[15px] font-medium text-stone-400">More projects</h3>
              </div>
            )}
            <JustifiedSingles projects={singles} />
          </section>
        )}

        {/* Infinite scroll sentinel */}
        <div ref={observerRef} className="h-20 flex items-center justify-center">
          {loading && !initialLoading && (
            <div className="w-8 h-8 rounded-full border-2 border-[var(--color-tarmeer-primary)]/20 border-t-[var(--color-tarmeer-primary)] animate-spin" />
          )}
        </div>
      </div>

      <style>{`
        @keyframes shimmer {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
      `}</style>
    </div>
  );
}
