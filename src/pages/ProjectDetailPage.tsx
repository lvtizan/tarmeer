import { useEffect, useState, useMemo } from 'react';
import { useParams, Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import {
  ArrowLeft, ChevronLeft, ChevronRight, X,
  Share2, Heart, MapPin, Calendar, DollarSign, BadgeCheck,
  Phone, Mail, Globe, Instagram, ExternalLink, FolderOpen,
} from 'lucide-react';
import { fetchPublicProjectDetail, type PublicProjectDetailData } from '../lib/publicApi';
import SmartImage from '../components/ui/SmartImage';
import ServiceInquiryCard from '../components/services/ServiceInquiryCard';

const SAVED_PROJECTS_KEY = 'saved-projects';

function readSavedProjects(): Set<string> {
  try {
    const raw = localStorage.getItem(SAVED_PROJECTS_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw);
    return new Set(Array.isArray(arr) ? arr.map(String) : []);
  } catch { return new Set(); }
}

function writeSavedProjects(set: Set<string>) {
  try {
    localStorage.setItem(SAVED_PROJECTS_KEY, JSON.stringify([...set]));
  } catch { /* localStorage full */ }
}

export default function ProjectDetailPage() {
  const { companySlug, projectSlug } = useParams<{ companySlug: string; projectSlug: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const fromPortfolio = searchParams.get('from') === 'portfolio';
  const initialImgParam = Number(searchParams.get('img') || '0');
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
  const [currentIndex, setCurrentIndex] = useState(
    Number.isFinite(initialImgParam) && initialImgParam >= 0 ? initialImgParam : 0
  );
  const [descExpanded, setDescExpanded] = useState(false);
  const [saved, setSaved] = useState<Set<string>>(() => readSavedProjects());
  const [shareToast, setShareToast] = useState('');

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
        if (active) {
          setData(result);
          // Clamp image index to valid range for the new project
          const len = result.project.images.length;
          setCurrentIndex(i => (len > 0 ? Math.min(Math.max(0, i), len - 1) : 0));
        }
      })
      .catch((err) => {
        if (active) setError(err instanceof Error ? err.message : 'Failed to load project');
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => { active = false; };
  }, [companySlug, projectSlug]);

  // When switching to a different project (via sibling nav), reset to first image
  useEffect(() => { setCurrentIndex(0); }, [projectSlug]);

  // Keyboard navigation for portfolio mode
  useEffect(() => {
    if (!fromPortfolio || !data) return;
    const len = data.project.images.length;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') setCurrentIndex(i => (i > 0 ? i - 1 : len - 1));
      else if (e.key === 'ArrowRight') setCurrentIndex(i => (i < len - 1 ? i + 1 : 0));
      else if (e.key === 'Escape') handleBack();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fromPortfolio, data]);

  const heroImage = data?.project.images[0] || '';

  // Find prev/next siblings
  const siblingNav = useMemo(() => {
    if (!data?.siblings || data.siblings.length === 0) return { prev: null, next: null };
    // Filter out siblings with no slug (would produce /companies/xxx/null URLs)
    const valid = data.siblings.filter(s => s.slug);
    const currentIdx = valid.findIndex(s => s.slug === projectSlug);
    return {
      prev: currentIdx > 0 ? valid[currentIdx - 1] : null,
      next: currentIdx < valid.length - 1 ? valid[currentIdx + 1] : null,
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
          <button onClick={handleBack} className="text-[#c6a065] hover:underline">Back</button>
        </div>
      </div>
    );
  }

  const { project, company } = data;
  const metaTags: string[] = [];
  if (project.style) metaTags.push(project.style);
  if (project.location) metaTags.push(project.location);
  if (project.year) metaTags.push(String(project.year));

  const companyHref = `/companies/${company.slug || company.id}`;
  const projectKey = `${company.id}-${project.id}`;
  const isSaved = saved.has(projectKey);

  const handleShare = async () => {
    const shareData = {
      title: `${project.title} by ${company.name}`,
      text: project.description?.slice(0, 160) || `${project.title} - interior design project`,
      url: window.location.href,
    };
    try {
      if (navigator.share) {
        await navigator.share(shareData);
      } else if (navigator.clipboard) {
        await navigator.clipboard.writeText(window.location.href);
        setShareToast('Link copied');
        setTimeout(() => setShareToast(''), 2000);
      }
    } catch { /* user cancelled */ }
  };

  const handleSave = () => {
    const next = new Set(saved);
    if (next.has(projectKey)) next.delete(projectKey);
    else next.add(projectKey);
    setSaved(next);
    writeSavedProjects(next);
  };

  const openGalleryImage = (idx: number) => {
    navigate(`/companies/${companySlug}/${projectSlug}?from=portfolio&img=${idx}`);
  };

  const description = project.description || '';
  const shouldTruncateDesc = description.length > 380;
  const activeImage = project.images[currentIndex] || heroImage;
  const goPrev = () => setCurrentIndex(i => (i > 0 ? i - 1 : project.images.length - 1));
  const goNext = () => setCurrentIndex(i => (i < project.images.length - 1 ? i + 1 : 0));

  // ── SEO: maximise crawlable info on the portfolio image viewer page ──
  //
  // Title + description weave in project tags (room types, style) so search
  // queries like "modern living room design Dubai" can land directly on this
  // page. Tags are also emitted as JSON-LD keywords and og:article:tag.
  //
  // Two JSON-LD blocks:
  //   1. ImageGallery — the photo browser itself (images, count, author)
  //   2. BreadcrumbList — Home > Portfolio > Company > Project
  //
  // Canonical strips ?from=portfolio&img=N so all photo variants fold
  // into a single SEO target.
  const portfolioPageUrl = `https://www.tarmeer.com/companies/${companySlug}/${projectSlug}`;
  const portfolioOgImage = project.images[currentIndex]
    ? `https://www.tarmeer.com${project.images[currentIndex]}`
    : heroImage
      ? `https://www.tarmeer.com${heroImage}`
      : 'https://www.tarmeer.com/images/tarmeer_logo.svg';

  // Build a tag string like "Modern Living Room" from project.tags + style.
  // Dedup + limit to 3 so the title stays readable.
  const tagPool: string[] = [];
  if (project.style) tagPool.push(project.style);
  for (const t of (project.tags || [])) {
    if (!tagPool.some(x => x.toLowerCase() === t.toLowerCase())) tagPool.push(t);
    if (tagPool.length >= 3) break;
  }
  const tagLabel = tagPool.join(' ') || 'Interior Design';
  const locationLabel = project.location || company.city || 'UAE';

  // Title: "{Project} - Modern Living Room Design in Dubai by {Company} | Tarmeer"
  const portfolioTitle = `${project.title} - ${tagLabel} Design in ${locationLabel} by ${company.name} | Tarmeer`;

  // Description: natural sentence packing in company, location, tags, photo count, year
  const yearSnippet = project.year ? ` (${project.year})` : '';
  const costSnippet = project.cost ? ` Budget: ${project.cost}.` : '';
  const descSnippet = description ? `${description.slice(0, 160)}` : '';
  const portfolioDescription = [
    `${project.title}${yearSnippet} — a ${tagLabel.toLowerCase()} project by ${company.name} in ${locationLabel}, UAE.`,
    costSnippet,
    descSnippet || `Browse ${project.images.length} high-quality photos.`,
    project.tags?.length ? `Tags: ${project.tags.join(', ')}.` : '',
  ].filter(Boolean).join(' ').slice(0, 320);

  // Keywords: comprehensive, deduped
  const portfolioKeywords = [...new Set([
    project.title,
    ...tagPool,
    project.location,
    company.city,
    company.name,
    'interior design',
    'renovation',
    'fit-out',
    'UAE',
    'Dubai',
    'Abu Dhabi',
    'Tarmeer',
    'project photos',
    ...(project.tags || []),
  ].filter(Boolean).map(k => k.toLowerCase()))].join(', ');

  const portfolioHelmet = (
    <Helmet>
      <title>{portfolioTitle}</title>
      <meta name="description" content={portfolioDescription} />
      <meta name="keywords" content={portfolioKeywords} />
      <meta name="robots" content="index, follow, max-image-preview:large" />
      {/* Open Graph */}
      <meta property="og:type" content="article" />
      <meta property="og:title" content={portfolioTitle} />
      <meta property="og:description" content={portfolioDescription} />
      <meta property="og:url" content={portfolioPageUrl} />
      <meta property="og:image" content={portfolioOgImage} />
      <meta property="og:image:width" content="1200" />
      <meta property="og:image:height" content="630" />
      <meta property="og:site_name" content="Tarmeer" />
      <meta property="og:locale" content="en_US" />
      {/* og:article:tag — one per tag, helps Google discover topic clusters */}
      {(project.tags || []).map((tag) => (
        <meta key={tag} property="article:tag" content={tag} />
      ))}
      {/* Twitter */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={portfolioTitle} />
      <meta name="twitter:description" content={portfolioDescription} />
      <meta name="twitter:image" content={portfolioOgImage} />
      {/* Canonical — same as default layout so photo variants fold in */}
      <link rel="canonical" href={portfolioPageUrl} />
      {/* JSON-LD #1: ImageGallery */}
      <script type="application/ld+json">{JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'ImageGallery',
        name: project.title,
        description: portfolioDescription,
        url: portfolioPageUrl,
        author: {
          '@type': 'Organization',
          name: company.name,
          url: `https://www.tarmeer.com/companies/${company.slug || company.id}`,
          ...(company.logo ? { logo: `https://www.tarmeer.com${company.logo}` } : {}),
        },
        locationCreated: {
          '@type': 'Place',
          name: locationLabel,
          address: { '@type': 'PostalAddress', addressCountry: 'AE', addressLocality: locationLabel },
        },
        genre: project.style,
        keywords: (project.tags || []).join(', '),
        dateCreated: project.year ? `${project.year}` : undefined,
        numberOfItems: project.images.length,
        image: project.images.slice(0, 20).map((img, i) => ({
          '@type': 'ImageObject',
          contentUrl: `https://www.tarmeer.com${img}`,
          name: `${project.title} — photo ${i + 1}`,
          caption: `${project.title} by ${company.name}`,
          representativeOfPage: i === 0,
        })),
      })}</script>
      {/* JSON-LD #2: BreadcrumbList for site hierarchy */}
      <script type="application/ld+json">{JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://www.tarmeer.com/' },
          { '@type': 'ListItem', position: 2, name: 'Portfolio', item: 'https://www.tarmeer.com/portfolio' },
          { '@type': 'ListItem', position: 3, name: company.name, item: `https://www.tarmeer.com/companies/${company.slug || company.id}` },
          { '@type': 'ListItem', position: 4, name: project.title, item: portfolioPageUrl },
        ],
      })}</script>
    </Helmet>
  );

  // ============================================================
  //  Portfolio-entry layout (Houzz-style): image + form sidebar
  // ============================================================
  if (fromPortfolio) {
    return (
      <div className="min-h-screen bg-[var(--color-tarmeer-bg)]">
        {portfolioHelmet}

        {/* Top bar */}
        <div className="sticky top-0 z-20 bg-white border-b border-stone-200">
          <div className="px-4 sm:px-6 h-14 flex items-center justify-between">
            <button
              onClick={handleBack}
              className="inline-flex items-center gap-1.5 text-sm text-stone-600 hover:text-[#b8864a] transition"
            >
              <ArrowLeft className="w-4 h-4" /> Back
            </button>
            <button
              onClick={handleBack}
              aria-label="Close"
              className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-stone-100 transition"
            >
              <X className="w-5 h-5 text-stone-500" />
            </button>
          </div>
        </div>

        {/* Main grid — near full-width to let the hero breathe */}
        <div className="px-4 sm:px-6 py-5">
          <div className="flex flex-col lg:flex-row gap-6">

            {/* ========== Left: Image + Gallery + Info ========== */}
            <div className="flex-1 min-w-0">
              {/* Big hero image */}
              <div className="relative rounded-xl overflow-hidden bg-stone-100 flex items-center justify-center" style={{ minHeight: '60vh' }}>
                <SmartImage
                  src={activeImage}
                  alt={`${project.title} — photo ${currentIndex + 1}`}
                  className="w-full h-auto object-contain"
                  style={{ maxHeight: 'calc(100vh - 120px)' }}
                />
                {project.images.length > 1 && (
                  <>
                    <button
                      onClick={goPrev}
                      aria-label="Previous photo"
                      className="absolute left-3 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-white/85 hover:bg-white shadow-md flex items-center justify-center transition"
                    >
                      <ChevronLeft className="w-5 h-5 text-stone-700" />
                    </button>
                    <button
                      onClick={goNext}
                      aria-label="Next photo"
                      className="absolute right-3 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-white/85 hover:bg-white shadow-md flex items-center justify-center transition"
                    >
                      <ChevronRight className="w-5 h-5 text-stone-700" />
                    </button>
                    <div className="absolute bottom-3 right-3 px-2.5 py-1 rounded-full bg-black/60 text-white text-xs font-medium backdrop-blur-sm tabular-nums">
                      {currentIndex + 1} / {project.images.length}
                    </div>
                  </>
                )}
              </div>

              {/* Thumbnail strip */}
              {project.images.length > 1 && (
                <div className="mt-5">
                  <h3 className="text-sm font-medium text-[#2c2c2c] mb-3">
                    Other Photos in {project.title}
                  </h3>
                  <div className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1">
                    {project.images.map((url, i) => (
                      <button
                        key={i}
                        onClick={() => setCurrentIndex(i)}
                        aria-label={`Show photo ${i + 1}`}
                        className={`flex-shrink-0 w-28 h-20 rounded-lg overflow-hidden border-2 transition ${
                          i === currentIndex
                            ? 'border-[#b8864a]'
                            : 'border-transparent hover:border-stone-300'
                        }`}
                      >
                        <SmartImage
                          src={url}
                          alt={`Thumbnail ${i + 1}`}
                          className="w-full h-full object-cover"
                        />
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Project info */}
              <div className="mt-8">
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

              {/* Sibling nav */}
              {(siblingNav.prev || siblingNav.next) && (
                <div className="mt-10 pt-6 border-t border-stone-200 flex items-center justify-between">
                  {siblingNav.prev ? (
                    <button
                      onClick={() => navigate(`/companies/${companySlug}/${siblingNav.prev!.slug}?from=portfolio`)}
                      className="flex items-center gap-2 text-sm text-stone-600 hover:text-[#b8864a] transition group"
                    >
                      <ChevronLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
                      <div className="text-left">
                        <p className="text-xs text-stone-400">Prev Project</p>
                        <p className="font-medium">{siblingNav.prev.title}</p>
                      </div>
                    </button>
                  ) : <div />}
                  {siblingNav.next ? (
                    <button
                      onClick={() => navigate(`/companies/${companySlug}/${siblingNav.next!.slug}?from=portfolio`)}
                      className="flex items-center gap-2 text-sm text-stone-600 hover:text-[#b8864a] transition group text-right"
                    >
                      <div>
                        <p className="text-xs text-stone-400">Next Project</p>
                        <p className="font-medium">{siblingNav.next.title}</p>
                      </div>
                      <ChevronRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                    </button>
                  ) : <div />}
                </div>
              )}
            </div>

            {/* ========== Right: Form + Company info ========== */}
            <div className="w-full lg:w-[360px] lg:flex-shrink-0">
              <div className="lg:sticky lg:top-[72px] space-y-4">
                {/* Inquiry form — reused from company detail */}
                <ServiceInquiryCard
                  title={`Get in touch with ${company.name}`}
                  companyName={company.name}
                  companySlug={company.slug || String(company.id)}
                />

                {/* Company header card */}
                <div className="bg-white border border-stone-200 rounded-2xl p-5 shadow-sm">
                  <div className="flex items-center gap-3">
                    {company.logo ? (
                      <SmartImage
                        src={company.logo}
                        alt={`${company.name} logo`}
                        className="w-12 h-12 rounded-lg object-contain bg-white border border-stone-100 p-1 flex-shrink-0"
                        onError={(e) => { e.currentTarget.style.display = 'none'; }}
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-lg bg-stone-100 flex items-center justify-center flex-shrink-0">
                        <span className="font-serif text-lg text-stone-400">{company.name.charAt(0)}</span>
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <Link
                        to={companyHref}
                        className="font-serif text-[16px] text-[#1c1917] hover:text-[#b8864a] transition truncate block"
                      >
                        {company.name}
                      </Link>
                      {company.city && (
                        <p className="text-xs text-stone-500 mt-0.5">{company.city}, UAE</p>
                      )}
                    </div>
                  </div>
                  <Link
                    to={companyHref}
                    className="mt-4 inline-flex w-full items-center justify-center px-4 py-2 border border-stone-200 rounded-2xl text-sm font-medium text-[#2c2c2c] hover:border-[#b8864a] hover:text-[#b8864a] transition"
                  >
                    View Profile
                  </Link>
                  {projectSlug && (
                    <Link
                      to={`/companies/${companySlug}/${projectSlug}`}
                      className="mt-2 inline-flex w-full items-center justify-center gap-1.5 px-4 py-2 border border-stone-200 rounded-2xl text-sm font-medium text-[#2c2c2c] hover:border-[#b8864a] hover:text-[#b8864a] transition"
                    >
                      <FolderOpen className="w-4 h-4" />
                      View Project
                    </Link>
                  )}
                </div>

                {/* Contact Info card */}
                {(company.phone || company.email || company.website || company.instagram || company.address) && (
                  <div className="bg-white border border-stone-200 rounded-2xl p-5 shadow-sm">
                    <h3 className="text-sm font-semibold text-[#1c1917] mb-3">Contact Info</h3>
                    <div className="space-y-2.5 text-sm">
                      {company.phone && (
                        <a href={`tel:${company.phone}`} className="flex items-center gap-2.5 text-stone-600 hover:text-[#b8864a] transition">
                          <Phone className="w-4 h-4 text-stone-400 flex-shrink-0" /> {company.phone}
                        </a>
                      )}
                      {company.email && (
                        <a href={`mailto:${company.email}`} className="flex items-center gap-2.5 text-stone-600 hover:text-[#b8864a] transition truncate">
                          <Mail className="w-4 h-4 text-stone-400 flex-shrink-0" /> <span className="truncate">{company.email}</span>
                        </a>
                      )}
                      {company.website && (
                        <a href={company.website} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2.5 text-stone-600 hover:text-[#b8864a] transition">
                          <Globe className="w-4 h-4 text-stone-400 flex-shrink-0" /> Website <ExternalLink className="w-3 h-3 text-stone-300" />
                        </a>
                      )}
                      {company.instagram && (
                        <a href={company.instagram} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2.5 text-stone-600 hover:text-[#b8864a] transition">
                          <Instagram className="w-4 h-4 text-stone-400 flex-shrink-0" /> Instagram
                        </a>
                      )}
                      {company.address && (
                        <div className="flex items-start gap-2.5 text-stone-500 pt-2 border-t border-stone-100">
                          <MapPin className="w-4 h-4 text-stone-400 mt-0.5 flex-shrink-0" />
                          <span className="text-xs leading-relaxed">{company.address}</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Business Details card */}
                {(company.yearEstablished || company.projectCount || company.city) && (
                  <div className="bg-white border border-stone-200 rounded-2xl p-5 shadow-sm">
                    <h3 className="text-sm font-semibold text-[#1c1917] mb-3">Business Details</h3>
                    <dl className="space-y-2 text-sm">
                      {company.city && (
                        <div className="flex justify-between">
                          <dt className="text-stone-500 flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5" /> Location</dt>
                          <dd className="text-[#1c1917]">{company.city}, UAE</dd>
                        </div>
                      )}
                      {company.yearEstablished && (
                        <div className="flex justify-between">
                          <dt className="text-stone-500 flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5" /> Established</dt>
                          <dd className="text-[#1c1917]">{company.yearEstablished}</dd>
                        </div>
                      )}
                      {typeof company.projectCount === 'number' && company.projectCount > 0 && (
                        <div className="flex justify-between">
                          <dt className="text-stone-500 flex items-center gap-1.5"><FolderOpen className="w-3.5 h-3.5" /> Projects</dt>
                          <dd className="text-[#1c1917]">{company.projectCount}+</dd>
                        </div>
                      )}
                    </dl>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ============================================================
  //  Default layout (direct navigation / from company detail page)
  // ============================================================
  return (
    <div className="min-h-screen bg-[var(--color-tarmeer-bg)]">
      <Helmet>
        <title>{project.title} by {company.name} - {project.style || 'Interior Design'} in {project.location || company.city || 'UAE'} - Tarmeer</title>
        <meta name="description" content={`${project.title} - ${project.style || 'Interior Design'} project by ${company.name} in ${project.location || company.city || 'UAE'}. ${description ? description.slice(0, 120) : `Browse ${project.images.length} project photos.`}`} />
        <meta name="keywords" content={[project.style, project.location, company.city, 'interior design', 'renovation', 'UAE', 'Tarmeer', company.name, ...(project.tags || [])].filter(Boolean).join(', ')} />
        <meta property="og:title" content={`${project.title} by ${company.name} - Tarmeer`} />
        <meta property="og:description" content={description || `${project.style || 'Interior Design'} project by ${company.name}`} />
        {heroImage && <meta property="og:image" content={`https://www.tarmeer.com${heroImage}`} />}
        <link rel="canonical" href={`https://www.tarmeer.com/companies/${companySlug}/${projectSlug}`} />
        <script type="application/ld+json">{JSON.stringify({
          "@context": "https://schema.org",
          "@type": "CreativeWork",
          "name": project.title,
          "description": description,
          "image": heroImage ? `https://www.tarmeer.com${heroImage}` : undefined,
          "author": { "@type": "Organization", "name": company.name },
          "locationCreated": project.location || company.city,
          "genre": project.style,
          "url": `https://www.tarmeer.com/companies/${companySlug}/${projectSlug}`,
        })}</script>
      </Helmet>

      {/* Back nav */}
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 pt-5 pb-3">
        <button
          onClick={handleBack}
          className="inline-flex items-center gap-1.5 text-sm text-stone-500 hover:text-[#b8864a] transition"
        >
          <ArrowLeft className="w-4 h-4" /> Back
        </button>
      </div>

      {/* Main two-column layout */}
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 pb-10">
        <div className="flex flex-col lg:flex-row gap-8">

          {/* ========== Left: Company header + project info + gallery ========== */}
          <div className="flex-1 min-w-0">
            {/* Company header row */}
            <div className="flex items-center gap-4 pb-5 border-b border-stone-200">
              {company.logo ? (
                <SmartImage
                  src={company.logo}
                  alt={`${company.name} logo`}
                  className="w-14 h-14 rounded-xl object-contain bg-white border border-stone-100 p-1.5 flex-shrink-0"
                  onError={(e) => { e.currentTarget.style.display = 'none'; }}
                />
              ) : (
                <div className="w-14 h-14 rounded-xl bg-stone-100 flex items-center justify-center flex-shrink-0">
                  <span className="font-serif text-xl text-stone-400">{company.name.charAt(0)}</span>
                </div>
              )}
              <div className="flex-1 min-w-0">
                <Link
                  to={companyHref}
                  className="font-serif text-2xl font-semibold text-[#1c1917] hover:text-[#b8864a] transition inline-flex items-center gap-1.5"
                >
                  {company.name}
                  <BadgeCheck className="w-5 h-5 text-[#b8864a]/70" />
                </Link>
                {company.city && (
                  <p className="text-sm text-stone-500 mt-0.5 flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5" /> {company.city}, UAE
                  </p>
                )}
              </div>

              {/* Share + Save */}
              <div className="flex items-center gap-2 flex-shrink-0">
                <button
                  onClick={handleShare}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-2xl border border-stone-200 text-sm text-[#2c2c2c] hover:border-[#b8864a] hover:text-[#b8864a] transition"
                >
                  <Share2 className="w-4 h-4" /> Share
                </button>
                <button
                  onClick={handleSave}
                  aria-pressed={isSaved}
                  className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-2xl border text-sm transition ${
                    isSaved
                      ? 'border-[#b8864a] bg-[#b8864a]/10 text-[#b8864a]'
                      : 'border-stone-200 text-[#2c2c2c] hover:border-[#b8864a] hover:text-[#b8864a]'
                  }`}
                >
                  <Heart className={`w-4 h-4 ${isSaved ? 'fill-current' : ''}`} /> {isSaved ? 'Saved' : 'Save'}
                </button>
              </div>
            </div>

            {/* Project title */}
            <h1 className="font-serif text-3xl sm:text-4xl font-semibold text-[#1c1917] mt-8">
              {project.title}
            </h1>

            {/* Style / top tags as small chips */}
            {project.style && (
              <div className="flex flex-wrap gap-2 mt-4">
                <span className="border border-stone-200 text-stone-600 rounded-2xl px-3 py-1 text-sm">
                  {project.style}
                </span>
              </div>
            )}

            {/* Description with Read More */}
            {description && (
              <div className="mt-5 text-[15px] text-[#2c2c2c] leading-relaxed">
                <p className="whitespace-pre-line">
                  {descExpanded || !shouldTruncateDesc ? description : `${description.slice(0, 380)}…`}
                </p>
                {shouldTruncateDesc && (
                  <button
                    onClick={() => setDescExpanded(!descExpanded)}
                    className="mt-2 text-[#1c1917] font-medium hover:text-[#b8864a] transition inline-flex items-center gap-1"
                  >
                    {descExpanded ? 'Read Less' : 'Read More'}
                    <span className="text-xs">{descExpanded ? '↑' : '↓'}</span>
                  </button>
                )}
              </div>
            )}

            {/* Metadata list */}
            <dl className="mt-6 space-y-2 text-[15px]">
              {project.year && (
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-[#c6a065] flex-shrink-0" />
                  <dt className="text-stone-500">Project Year:</dt>
                  <dd className="text-[#2c2c2c]">{project.year}</dd>
                </div>
              )}
              {(project.location || company.city) && (
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-[#c6a065] flex-shrink-0" />
                  <dt className="text-stone-500">Location:</dt>
                  <dd className="text-[#2c2c2c]">{project.location || company.city}, UAE</dd>
                </div>
              )}
              {project.cost && (
                <div className="flex items-center gap-2">
                  <DollarSign className="w-4 h-4 text-[#c6a065] flex-shrink-0" />
                  <dt className="text-stone-500">Project Cost:</dt>
                  <dd className="text-[#2c2c2c]">{project.cost}</dd>
                </div>
              )}
            </dl>

            {/* Other tags */}
            {project.tags && project.tags.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-6">
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

            {/* Share Project button */}
            <div className="mt-6">
              <button
                onClick={handleShare}
                className="inline-flex items-center gap-2 px-4 py-2 border border-stone-200 rounded-2xl text-sm font-medium text-[#2c2c2c] hover:border-[#b8864a] hover:text-[#b8864a] transition"
              >
                <Share2 className="w-4 h-4" /> Share Project
              </button>
            </div>

            {/* Gallery */}
            {project.images.length > 0 && (
              <div className="mt-10">
                <h2 className="font-serif text-xl font-semibold text-[#1c1917] mb-4">
                  Project Gallery
                  <span className="ml-2 text-sm font-normal text-stone-500">
                    ({project.images.length} {project.images.length === 1 ? 'photo' : 'photos'})
                  </span>
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {project.images.map((url, i) => (
                    <button
                      key={i}
                      onClick={() => openGalleryImage(i)}
                      className="group relative rounded-xl overflow-hidden bg-stone-100 aspect-[4/3] text-left"
                    >
                      <SmartImage
                        src={url}
                        alt={`${project.title} ${i + 1}`}
                        className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Sibling nav */}
            {(siblingNav.prev || siblingNav.next) && (
              <div className="mt-12 pt-6 border-t border-stone-200 flex items-center justify-between">
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
                ) : <div />}
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
                ) : <div />}
              </div>
            )}
          </div>

          {/* ========== Right: Sticky inquiry form ========== */}
          <div className="w-full lg:w-[340px] lg:flex-shrink-0">
            <div className="lg:sticky lg:top-6">
              <ServiceInquiryCard
                title={`Get in touch with ${company.name}`}
                companyName={company.name}
                companySlug={company.slug || String(company.id)}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Share toast */}
      {shareToast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-full bg-[#1c1917] text-white text-sm shadow-lg">
          {shareToast}
        </div>
      )}
    </div>
  );
}
