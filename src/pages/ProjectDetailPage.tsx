import { useEffect, useState, useMemo, useCallback } from 'react';
import { useParams, Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { ArrowLeft, ChevronLeft, ChevronRight } from 'lucide-react';
import { fetchPublicProjectDetail, type PublicProjectDetailData } from '../lib/publicApi';
import Lightbox from '../components/Lightbox';
import SmartImage from '../components/ui/SmartImage';
import type { PortfolioItem } from '../lib/companyData';

export default function ProjectDetailPage() {
  const { companySlug, projectSlug } = useParams<{ companySlug: string; projectSlug: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const fromPortfolio = searchParams.get('from') === 'portfolio';
  // Back behavior: if there's history, go back; otherwise fallback to portfolio
  const handleBack = () => {
    if (window.history.length > 1) {
      navigate(-1);
    } else {
      navigate('/portfolio');
    }
  };
  const [data, setData] = useState<PublicProjectDetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);

  useEffect(() => {
    if (!companySlug || !projectSlug) {
      setError('Project not found');
      setLoading(false);
      return;
    }
    let active = true;
    setLoading(true);
    setError('');
    window.scrollTo(0, 0);

    fetchPublicProjectDetail(companySlug, projectSlug)
      .then((result) => {
        if (active) setData(result);
      })
      .catch((err) => {
        if (active) setError(err instanceof Error ? err.message : 'Failed to load project');
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => { active = false; };
  }, [companySlug, projectSlug]);

  const heroImage = data?.project.images[0] || '';
  const relatedImages = useMemo(() => data?.project.images.slice(1) || [], [data]);

  const lightboxItems: PortfolioItem[] = useMemo(() => {
    if (!data) return [];
    return relatedImages.map((url, i) => ({
      url,
      title: `${data.project.title} ${i + 2}`,
    }));
  }, [data, relatedImages]);

  const handleRelatedClick = useCallback((index: number) => {
    setLightboxIndex(index);
    setLightboxOpen(true);
  }, []);

  // Find prev/next siblings
  const siblingNav = useMemo(() => {
    if (!data?.siblings || data.siblings.length === 0) return { prev: null, next: null };
    const currentIdx = data.siblings.findIndex(s => s.slug === projectSlug);
    return {
      prev: currentIdx > 0 ? data.siblings[currentIdx - 1] : null,
      next: currentIdx < data.siblings.length - 1 ? data.siblings[currentIdx + 1] : null,
    };
  }, [data, projectSlug]);

  if (loading) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--color-tarmeer-bg)]">
        <div className="w-8 h-8 rounded-full border-2 border-[var(--color-tarmeer-primary)]/20 border-t-[var(--color-tarmeer-primary)] animate-spin" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <h1 className="font-serif text-2xl text-[#2c2c2c] mb-4">{error || 'Project not found'}</h1>
          <Link to="/companies" className="text-[#c6a065] hover:underline">Back to Companies</Link>
        </div>
      </div>
    );
  }

  const { project, company } = data;
  const metaTags: string[] = [];
  if (project.style) metaTags.push(project.style);
  if (project.location) metaTags.push(project.location);
  if (project.year) metaTags.push(String(project.year));

  return (
    <div className="min-h-screen bg-white">
      <Helmet>
        <title>{project.title} by {company.name} - {project.style || 'Interior Design'} in {project.location || company.city || 'UAE'} - Tarmeer</title>
        <meta name="description" content={`${project.title} - ${project.style || 'Interior Design'} project by ${company.name} in ${project.location || company.city || 'UAE'}. ${project.description ? project.description.slice(0, 120) : `Browse ${project.images.length} project photos.`}`} />
        <meta name="keywords" content={[project.style, project.location, company.city, 'interior design', 'renovation', 'UAE', 'Tarmeer', company.name, ...(project.tags || [])].filter(Boolean).join(', ')} />
        <meta property="og:title" content={`${project.title} by ${company.name} - Tarmeer`} />
        <meta property="og:description" content={project.description || `${project.style || 'Interior Design'} project by ${company.name}`} />
        {heroImage && <meta property="og:image" content={`https://www.tarmeer.com${heroImage}`} />}
        <link rel="canonical" href={`https://www.tarmeer.com/companies/${companySlug}/${projectSlug}`} />
        <script type="application/ld+json">{JSON.stringify({
          "@context": "https://schema.org",
          "@type": "CreativeWork",
          "name": project.title,
          "description": project.description,
          "image": heroImage ? `https://www.tarmeer.com${heroImage}` : undefined,
          "author": { "@type": "Organization", "name": company.name },
          "locationCreated": project.location || company.city,
          "genre": project.style,
          "url": `https://www.tarmeer.com/companies/${companySlug}/${projectSlug}`,
        })}</script>
      </Helmet>

      {/* Back nav */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 pt-4 pb-2">
        <button
          onClick={handleBack}
          className="inline-flex items-center gap-1.5 text-sm text-stone-500 hover:text-[#b8864a] transition"
        >
          <ArrowLeft className="w-4 h-4" /> {fromPortfolio ? 'Back to Portfolio' : 'Back'}
        </button>
      </div>

      {/* Hero Image */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6">
        <div className="rounded-xl overflow-hidden bg-stone-100">
          <SmartImage
            src={heroImage}
            alt={project.title}
            className="w-full h-auto object-cover"
            style={{ maxHeight: '70vh' }}
          />
        </div>
      </div>

      {/* Designed by section */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 mt-6">
        <div className="flex items-center gap-3 pb-5 border-b border-stone-100">
          {company.logo && (
            <SmartImage
              src={company.logo}
              alt={`${company.name} logo`}
              className="w-10 h-10 rounded-full object-contain bg-white border border-stone-100 p-1 flex-shrink-0"
              onError={(e) => { e.currentTarget.style.display = 'none'; }}
            />
          )}
          <div>
            <p className="text-xs text-stone-500">Designed by</p>
            <Link
              to={`/companies/${companySlug}`}
              className="font-serif text-[15px] text-[#b8864a] hover:underline"
            >
              {company.name}
            </Link>
            {company.city && (
              <p className="text-xs text-stone-500">{company.city}, UAE</p>
            )}
          </div>
        </div>
      </div>

      {/* Project info */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 mt-6">
        <h1 className="font-serif text-2xl font-semibold text-[#1c1917]">
          {project.title}
        </h1>

        {metaTags.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-3">
            {metaTags.map((tag) => (
              <span
                key={tag}
                className="border border-stone-200 text-stone-600 rounded-2xl px-3 py-1 text-sm"
              >
                {tag}
              </span>
            ))}
          </div>
        )}

        {project.description && (
          <p className="text-[15px] text-[#2c2c2c] leading-relaxed mt-4">
            {project.description}
          </p>
        )}

        {project.tags && project.tags.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-4">
            {project.tags.map((tag) => (
              <span
                key={tag}
                className="border border-stone-200 text-stone-600 rounded-2xl px-3 py-1 text-sm"
              >
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Related Images */}
      {relatedImages.length > 0 && (
        <div className="max-w-5xl mx-auto px-4 sm:px-6 mt-8">
          <h2 className="text-lg font-semibold text-[#1c1917] mb-4">Related Images</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {relatedImages.map((url, i) => (
              <div
                key={i}
                className="rounded-xl overflow-hidden cursor-pointer group"
                onClick={() => handleRelatedClick(i)}
              >
                <SmartImage
                  src={url}
                  alt={`${project.title} ${i + 2}`}
                  className="w-full h-48 object-cover group-hover:scale-105 transition duration-300"
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Prev/Next navigation */}
      {(siblingNav.prev || siblingNav.next) && (
        <div className="max-w-5xl mx-auto px-4 sm:px-6 mt-10 pb-8">
          <div className="flex items-center justify-between border-t border-stone-200 pt-6">
            {siblingNav.prev ? (
              <button
                onClick={() => navigate(`/companies/${companySlug}/${siblingNav.prev!.slug}`)}
                className="flex items-center gap-2 text-sm text-stone-600 hover:text-[#b8864a] transition group"
              >
                <ChevronLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
                <div className="text-left">
                  <p className="text-xs text-stone-400">Prev Project</p>
                  <p className="font-medium">{siblingNav.prev.title}</p>
                </div>
              </button>
            ) : (
              <div />
            )}
            {siblingNav.next ? (
              <button
                onClick={() => navigate(`/companies/${companySlug}/${siblingNav.next!.slug}`)}
                className="flex items-center gap-2 text-sm text-stone-600 hover:text-[#b8864a] transition group text-right"
              >
                <div>
                  <p className="text-xs text-stone-400">Next Project</p>
                  <p className="font-medium">{siblingNav.next.title}</p>
                </div>
                <ChevronRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
              </button>
            ) : (
              <div />
            )}
          </div>
        </div>
      )}

      {/* Lightbox for related images */}
      <Lightbox
        open={lightboxOpen}
        images={lightboxItems}
        currentIndex={lightboxIndex}
        categoryName={project.title}
        onClose={() => setLightboxOpen(false)}
        onNavigate={(i) => setLightboxIndex(i)}
      />
    </div>
  );
}
