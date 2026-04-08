import { useState, useEffect, useCallback, useRef } from 'react';
import { Helmet } from 'react-helmet-async';
import { useNavigate } from 'react-router-dom';
import { resolveImageUrl } from '../lib/imageUrl';
import { fetchPortfolioFeed, type PortfolioProject } from '../lib/publicApi';

interface FlatItem extends PortfolioProject {
  image: string;
  imageIndex: number;
}

export default function PortfolioPage() {
  const [projects, setProjects] = useState<PortfolioProject[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const navigate = useNavigate();
  const observerRef = useRef<HTMLDivElement>(null);
  const loadedRef = useRef(false);

  const loadMore = useCallback(async () => {
    if (loading || !hasMore) return;
    setLoading(true);
    try {
      const result = await fetchPortfolioFeed(page, 30);
      setProjects(prev => [...prev, ...result.projects]);
      setHasMore(result.projects.length === 30);
      setPage(prev => prev + 1);
    } catch (err) {
      console.error('Portfolio load error:', err);
    } finally {
      setLoading(false);
      setInitialLoading(false);
    }
  }, [page, loading, hasMore]);

  // Initial load
  useEffect(() => {
    if (!loadedRef.current) {
      loadedRef.current = true;
      loadMore();
    }
  }, []);

  // Infinite scroll observer
  useEffect(() => {
    if (!observerRef.current) return;
    const target = observerRef.current;
    const observer = new IntersectionObserver(
      entries => {
        if (entries[0].isIntersecting && hasMore && !loading) loadMore();
      },
      { threshold: 0.1 }
    );
    observer.observe(target);
    return () => observer.disconnect();
  }, [hasMore, loading, loadMore]);

  // Flatten projects into individual image items for masonry
  const items: FlatItem[] = projects.flatMap(project =>
    project.images.map((img, idx) => ({
      ...project,
      image: img,
      imageIndex: idx,
    }))
  );

  return (
    <div className="min-h-screen bg-[var(--color-tarmeer-bg)]">
      <Helmet>
        <title>Interior Design Portfolio & Inspiration - Tarmeer UAE</title>
        <meta
          name="description"
          content="Browse stunning interior design projects from top UAE designers. Get inspired by luxury villas, modern apartments, commercial spaces and more."
        />
        <link rel="canonical" href="https://www.tarmeer.com/portfolio" />
      </Helmet>

      <div className="max-w-7xl mx-auto px-4 py-8">
        <h1 className="font-serif text-3xl font-semibold text-[var(--color-tarmeer-text)] mb-2">
          Portfolio
        </h1>
        <p className="text-[var(--color-tarmeer-muted)] mb-8">
          Explore interior design projects from UAE&apos;s top professionals
        </p>

        {/* Initial loading state */}
        {initialLoading && (
          <div className="flex items-center justify-center py-20">
            <div className="w-10 h-10 rounded-full border-2 border-[var(--color-tarmeer-primary)]/20 border-t-[var(--color-tarmeer-primary)] animate-spin" />
          </div>
        )}

        {/* Empty state */}
        {!initialLoading && items.length === 0 && (
          <div className="text-center py-20">
            <p className="text-[var(--color-tarmeer-muted)] text-[15px]">
              No portfolio projects available yet.
            </p>
          </div>
        )}

        {/* Masonry Grid */}
        {items.length > 0 && (
          <div className="columns-2 md:columns-3 gap-4 space-y-4">
            {items.map((item) => (
              <div
                key={`${item.id}-${item.imageIndex}`}
                className="break-inside-avoid rounded-xl overflow-hidden group cursor-pointer relative"
                onClick={() => navigate(`/companies/${item.companySlug}`)}
              >
                <img
                  src={resolveImageUrl(item.image)}
                  alt={`${item.title || 'Project'} by ${item.companyName}`}
                  loading="lazy"
                  className="w-full h-auto object-cover transition-transform duration-300 group-hover:scale-105"
                  onError={(e) => {
                    const container = (e.currentTarget.closest('.break-inside-avoid') as HTMLElement | null);
                    if (container) container.classList.add('hidden');
                  }}
                  onLoad={(e) => {
                    const img = e.currentTarget;
                    const w = img.naturalWidth;
                    const h = img.naturalHeight;
                    const ratio = w / h;
                    const container = img.closest('.break-inside-avoid') as HTMLElement | null;
                    if (!container) return;
                    // Hide: too small or extreme aspect ratio
                    if (w < 200 || h < 150 || ratio > 3.5 || ratio < 0.25) {
                      container.classList.add('hidden');
                    }
                  }}
                />
                {/* Desktop hover overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 hidden sm:flex flex-col justify-end p-4">
                  <h3 className="text-white font-medium text-sm">
                    {item.title || 'Project'}
                  </h3>
                  <p className="text-white/80 text-xs mt-1">
                    {item.companyName}{item.companyCity ? ` \u00B7 ${item.companyCity}` : ''}
                  </p>
                  {item.style && (
                    <p className="text-white/60 text-xs mt-0.5">{item.style}</p>
                  )}
                </div>
                {/* Mobile text below image */}
                <div className="sm:hidden p-3 bg-white">
                  <h3 className="text-sm font-medium text-[var(--color-tarmeer-text)] truncate">
                    {item.title || 'Project'}
                  </h3>
                  <p className="text-xs text-[var(--color-tarmeer-muted)] mt-0.5">
                    {item.companyName}{item.companyCity ? ` \u00B7 ${item.companyCity}` : ''}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Infinite scroll trigger */}
        <div ref={observerRef} className="h-20 flex items-center justify-center">
          {loading && !initialLoading && (
            <div className="w-8 h-8 rounded-full border-2 border-[var(--color-tarmeer-primary)]/20 border-t-[var(--color-tarmeer-primary)] animate-spin" />
          )}
        </div>
      </div>
    </div>
  );
}
