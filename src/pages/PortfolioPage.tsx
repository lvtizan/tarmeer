import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Helmet } from 'react-helmet-async';
import { useNavigate } from 'react-router-dom';
import { resolveImageUrl } from '../lib/imageUrl';
import { fetchPortfolioFeed, type PortfolioProject } from '../lib/publicApi';

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
      { threshold: 0.1, rootMargin: '0px 0px 800px 0px' }
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

  const handleImageLoad = useCallback((e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    const w = img.naturalWidth;
    const h = img.naturalHeight;
    const ratio = w / h;
    const container = img.closest('.portfolio-card') as HTMLElement | null;
    if (!container) return;
    // Hide bad images: too small or extreme aspect ratio
    if (w < 200 || h < 150 || ratio > 3.5 || ratio < 0.25) {
      container.classList.add('hidden');
      return;
    }
    // Show image, hide shimmer
    img.classList.remove('opacity-0');
    const shimmer = container.querySelector('.shimmer-bg') as HTMLElement | null;
    if (shimmer) shimmer.classList.add('opacity-0');
  }, []);

  const handleImageError = useCallback((e: React.SyntheticEvent<HTMLImageElement>) => {
    const container = e.currentTarget.closest('.portfolio-card') as HTMLElement | null;
    if (container) container.classList.add('hidden');
  }, []);

  return (
    <div className="min-h-screen bg-[var(--color-tarmeer-bg)]">
      <Helmet>
        <title>Interior Design Portfolio & Inspiration - Tarmeer UAE</title>
        <meta name="description" content="Browse stunning interior design projects from top UAE designers. Get inspired by luxury villas, modern apartments, commercial spaces and more." />
        <link rel="canonical" href="https://www.tarmeer.com/portfolio" />
        <script type="application/ld+json">{JSON.stringify({
          "@context": "https://schema.org",
          "@type": "CollectionPage",
          "name": "Interior Design Portfolio - Tarmeer UAE",
          "description": "Browse stunning interior design projects from top UAE designers.",
          "url": "https://www.tarmeer.com/portfolio",
          "mainEntity": {
            "@type": "ItemList",
            "itemListElement": projects.slice(0, 20).map((p, i) => ({
              "@type": "ListItem",
              "position": i + 1,
              "item": {
                "@type": "CreativeWork",
                "name": p.title || 'Interior Design Project',
                "description": p.description || `${p.style || 'Interior design'} project by ${p.companyName}`,
                "creator": { "@type": "Organization", "name": p.companyName },
                ...(p.images[0] ? { "image": `https://www.tarmeer.com${p.images[0]}` } : {}),
                ...(p.companySlug && p.slug ? { "url": `https://www.tarmeer.com/companies/${p.companySlug}/${p.slug}` } : {}),
              },
            })),
          },
        })}</script>
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

        {/* Grouped projects — each project in its own masonry band */}
        {grouped.map(project => {
          const projectUrl = project.slug
            ? `/companies/${project.companySlug}/${project.slug}`
            : `/companies/${project.companySlug}`;
          return (
            <section key={`g-${project.id}`} className="mb-10">
              {/* Project group header */}
              <div
                className="flex items-baseline gap-3 mb-4 cursor-pointer group/header"
                onClick={() => navigate(projectUrl)}
              >
                <h3 className="text-[15px] font-medium text-[#1c1917] group-hover/header:text-[#b8864a] transition">
                  {project.title || 'Project'}
                </h3>
                <span className="text-sm text-stone-400">
                  {project.companyName}{project.companyCity ? ` · ${project.companyCity}` : ''}
                </span>
                <span className="text-xs text-stone-300">{project.images.length} photos</span>
              </div>
              {/* Masonry within group */}
              <div className="columns-2 sm:columns-3 lg:columns-4 gap-3">
                {project.images.map((img, idx) => (
                  <div
                    key={idx}
                    className="portfolio-card break-inside-avoid mb-3 rounded-xl overflow-hidden cursor-pointer group relative"
                    onClick={() => navigate(projectUrl)}
                  >
                    {/* Shimmer placeholder */}
                    <div className="shimmer-bg absolute inset-0 rounded-xl transition-opacity duration-300" style={{
                      backgroundImage: 'linear-gradient(90deg, #e7e5e4 25%, #d6d3d1 50%, #e7e5e4 75%)',
                      backgroundSize: '200% 100%',
                      animation: 'shimmer 1.5s infinite',
                    }} />
                    <img
                      src={resolveImageUrl(img)}
                      alt={`${project.title || 'Interior Design Project'} by ${project.companyName}${project.companyCity ? ` in ${project.companyCity}` : ''}${project.style ? ` - ${project.style}` : ''}`}
                      title={project.title || undefined}
                      loading="lazy"
                      className="relative w-full h-auto object-cover opacity-0 transition-all duration-300 group-hover:scale-105"
                      onLoad={handleImageLoad}
                      onError={handleImageError}
                    />
                    {/* Hover overlay */}
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors duration-300 rounded-xl" />
                    <div className="absolute inset-0 flex flex-col justify-end p-4 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                      <p className="text-white text-sm font-medium leading-snug line-clamp-2">
                        {project.title || 'Project'}
                      </p>
                      <p className="text-[#c6a065] text-xs mt-0.5">
                        {project.companyName}{project.companyCity ? ` · ${project.companyCity}` : ''}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          );
        })}

        {/* Single-image projects — mixed together */}
        {singles.length > 0 && (
          <section className="mb-10">
            {grouped.length > 0 && (
              <div className="flex items-baseline gap-3 mb-4">
                <h3 className="text-[15px] font-medium text-stone-400">More projects</h3>
              </div>
            )}
            <div className="columns-2 sm:columns-3 lg:columns-4 gap-3">
              {singles.map(project => {
                const projectUrl = project.slug
                  ? `/companies/${project.companySlug}/${project.slug}`
                  : `/companies/${project.companySlug}`;
                return (
                  <div
                    key={`s-${project.id}`}
                    className="portfolio-card break-inside-avoid mb-3 rounded-xl overflow-hidden cursor-pointer group relative"
                    onClick={() => navigate(projectUrl)}
                  >
                    <div className="shimmer-bg absolute inset-0 rounded-xl transition-opacity duration-300" style={{
                      backgroundImage: 'linear-gradient(90deg, #e7e5e4 25%, #d6d3d1 50%, #e7e5e4 75%)',
                      backgroundSize: '200% 100%',
                      animation: 'shimmer 1.5s infinite',
                    }} />
                    <img
                      src={resolveImageUrl(project.images[0])}
                      alt={`${project.title || 'Interior Design Project'} by ${project.companyName}${project.companyCity ? ` in ${project.companyCity}` : ''}${project.style ? ` - ${project.style}` : ''}`}
                      title={project.title || undefined}
                      loading="lazy"
                      className="relative w-full h-auto object-cover opacity-0 transition-all duration-300 group-hover:scale-105"
                      onLoad={handleImageLoad}
                      onError={handleImageError}
                    />
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors duration-300 rounded-xl" />
                    <div className="absolute inset-0 flex flex-col justify-end p-4 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                      <p className="text-white text-sm font-medium leading-snug line-clamp-2">
                        {project.title || 'Project'}
                      </p>
                      <p className="text-[#c6a065] text-xs mt-0.5">
                        {project.companyName}{project.companyCity ? ` · ${project.companyCity}` : ''}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

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
