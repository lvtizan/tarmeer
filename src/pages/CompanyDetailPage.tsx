import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { useParams, useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Helmet } from 'react-helmet-async';
import {
  ArrowLeft, Globe, Instagram, MapPin, Briefcase,
  Calendar, FolderOpen, Mail, ChevronLeft, ChevronRight,
  Share2, ExternalLink, X, BadgeCheck, Link2, CheckCircle2,
} from 'lucide-react';
import type { Company, CompanyProjectCard, PortfolioItem } from '../lib/companyData';
import { getCompanyTypeLabel } from '../lib/companyData';
import { trackViewContent } from '../lib/analytics';
import { trackEvent } from '../lib/trackEvent';
import { fetchCompanyPreviewDetail, fetchPublicCompanyDetail, fetchPublicCompanies, fetchAdminCompanyPreview } from '../lib/publicApi';
import { resolveImageUrl } from '../lib/imageUrl';
import { normalizePortfolioCategories } from '../lib/categoryNormalize';
import MasonryGallery from '../components/MasonryGallery';
import CompanyProjectsSection from '../components/CompanyProjectsSection';
import Lightbox from '../components/Lightbox';
import ServiceInquiryCard from '../components/services/ServiceInquiryCard';
import SmartImage from '../components/ui/SmartImage';

export default function CompanyDetailPage() {
  const { id: _paramId } = useParams<{ id?: string }>();
  const _loc = useLocation();
  const id = _paramId ?? (_loc.pathname.startsWith('/@') ? _loc.pathname.slice(2) : undefined);
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const previewMode = searchParams.get('preview') === '1';
  const adminPreview = searchParams.get('admin_preview') === '1';
  const from = searchParams.get('from');
  // Special contexts have explicit back destinations (admin panel, company dashboard)
  const isSpecialContext = adminPreview || previewMode || from === 'company-dashboard';
  const backTo = adminPreview
    ? `/admin/profile-companies/${id}?tab=companies`
    : previewMode || from === 'company-dashboard' ? '/company/dashboard' : '/companies';
  const backLabel = adminPreview
    ? 'Back to Admin'
    : previewMode || from === 'company-dashboard' ? 'Back to Company Dashboard' : 'Back';
  // Dynamic back: special contexts use their explicit destination; otherwise use
  // browser history (return to wherever the user came from), falling back to /companies.
  const handleBack = () => {
    if (isSpecialContext) {
      navigate(backTo);
    } else if (window.history.length > 1) {
      navigate(-1);
    } else {
      navigate('/companies');
    }
  };
  const [company, setCompany] = useState<Company | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [similarCompanies, setSimilarCompanies] = useState<Company[]>([]);
  const [heroIndex, setHeroIndex] = useState(0);
  const [aboutExpanded, setAboutExpanded] = useState(false);

  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const portfolioMode: 'project' | 'style' = 'project';
  const [showFloatingForm, setShowFloatingForm] = useState(false);
  const [floatingFormDismissed, setFloatingFormDismissed] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const shareRef = useRef<HTMLDivElement>(null);
  const [shareOpen, setShareOpen] = useState(false);
  const [copyNote, setCopyNote] = useState('');

  // Close share dropdown on outside click
  useEffect(() => {
    if (!shareOpen) return;
    const handler = (e: MouseEvent) => {
      if (shareRef.current && !shareRef.current.contains(e.target as Node)) {
        setShareOpen(false);
        setCopyNote('');
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [shareOpen]);

  const copyAndNotify = (note: string) => {
    navigator.clipboard?.writeText(window.location.href);
    setCopyNote(note);
    setTimeout(() => setCopyNote(''), 2500);
  };

  const handleShareClick = () => {
    setShareOpen(prev => !prev);
  };

  // Show floating form when sidebar scrolls out of view
  useEffect(() => {
    if (!sidebarRef.current) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!floatingFormDismissed) {
          setShowFloatingForm(!entry.isIntersecting);
        }
      },
      { threshold: 0 }
    );
    observer.observe(sidebarRef.current);
    return () => observer.disconnect();
  }, [floatingFormDismissed]);

  useEffect(() => {
    if (!id) { setLoadError('Company not found'); setLoading(false); return; }
    let active = true;
    setLoading(true);
    setLoadError('');
    setHeroIndex(0);
    setAboutExpanded(false);
    window.scrollTo(0, 0);

    const detailRequest = adminPreview
      ? fetchAdminCompanyPreview(id)
      : previewMode
        ? fetchCompanyPreviewDetail(id)
        : fetchPublicCompanyDetail(id);

    detailRequest
      .then((item) => {
        if (!active) return;
        setCompany(item);
        trackViewContent({ content_name: item.name, content_id: item.id || id });
        if (!previewMode && !adminPreview) {
          trackEvent({ event_type: 'view_company', target_id: item.id ? Number(item.id) : null, target_name: (item as any).name_en || item.name, target_type: 'company' });
        }
        // Redirect to canonical /companies/:slug when response ID differs from URL identifier
        // (covers numeric IDs, dead/renamed slugs, and alias resolution)
        if (id && item.id && item.id !== id) {
          navigate(`/companies/${item.id}`, { replace: true });
        }
        // Redirect dead/alias slugs via explicit canonical slug field
        if (id && item.slug && item.slug !== id) {
          navigate(`/companies/${item.slug}`, { replace: true });
        }
      })
      .catch((error) => { if (active) setLoadError(error instanceof Error ? error.message : 'Failed to load'); })
      .finally(() => { if (active) setLoading(false); });

    if (!previewMode && !adminPreview) {
      fetchPublicCompanies(100)
        .then((all) => { if (active) setSimilarCompanies(all); })
        .catch(() => {});
    } else if (active) {
      setSimilarCompanies([]);
    }

    return () => { active = false; };
  }, [id, searchParams]);

  const normalizedStyleCategories = useMemo(() => {
    if (!company?.portfolioCategories) return {};
    return normalizePortfolioCategories(company.portfolioCategories);
  }, [company]);

  const normalizedProjectCategories = useMemo(() => {
    if (!company?.portfolioCategoriesByProject) return {};
    // By-project categories don't need normalization (already clean titles)
    return company.portfolioCategoriesByProject;
  }, [company]);

  const hasProjectCategories = Object.keys(normalizedProjectCategories).length > 1;
  const activeCategories = portfolioMode === 'project' && hasProjectCategories
    ? normalizedProjectCategories
    : normalizedStyleCategories;

  // Directory companies: convert portfolioCategoriesByProject → CompanyProjectCard[]
  const directoryProjects = useMemo<CompanyProjectCard[]>(() => {
    if (company?.isClaimed) return [];
    return Object.entries(normalizedProjectCategories).map(([title, items]) => ({
      title,
      slug: '',
      description: '',
      style: '',
      location: '',
      images: items.map((i) => i.url),
    }));
  }, [company?.isClaimed, normalizedProjectCategories]);

  const allLightboxImages: PortfolioItem[] = useMemo(() => {
    return Object.values(activeCategories).flat();
  }, [activeCategories]);

  // Build image-to-project lookup for claimed companies
  const imageToProjectSlug = useMemo(() => {
    if (!company?.isClaimed || !company.projects?.length) return {};
    const map: Record<string, string> = {};
    for (const proj of company.projects) {
      for (const img of proj.images) {
        // Normalize URL for matching
        const resolved = resolveImageUrl(img);
        map[resolved] = proj.slug;
        map[img] = proj.slug;
      }
    }
    return map;
  }, [company]);

  const handleImageClick = useCallback(
    (url: string, categoryName: string, indexInCategory: number) => {
      // For claimed companies with projects, navigate to project detail page
      if (company?.isClaimed && company.projects?.length) {
        const resolved = resolveImageUrl(url);
        const projectSlug = imageToProjectSlug[resolved] || imageToProjectSlug[url];
        if (projectSlug) {
          navigate(`/companies/${company.id}/${projectSlug}`);
          return;
        }
      }

      // Fallback: open Lightbox
      const categories = Object.entries(activeCategories);
      let globalIndex = 0;
      for (const [catName, items] of categories) {
        if (catName === categoryName) {
          globalIndex += indexInCategory;
          break;
        }
        globalIndex += items.length;
      }
      setLightboxIndex(globalIndex);
      setLightboxOpen(true);
    }, [activeCategories, company, imageToProjectSlug, navigate]
  );

  if (loading) {
    return (
      <>
        {id && <Helmet><link rel="canonical" href={`https://www.tarmeer.com/companies/${id}`} /></Helmet>}
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--color-tarmeer-bg)]">
          <div className="w-8 h-8 rounded-full border-2 border-[var(--color-tarmeer-primary)]/20 border-t-[var(--color-tarmeer-primary)] animate-spin" />
        </div>
      </>
    );
  }

  if (!company) {
    return (
      <>
        <Helmet><meta name="robots" content="noindex" /></Helmet>
        <div className="min-h-screen bg-white flex items-center justify-center">
          <div className="text-center">
            <h1 className="font-serif text-2xl text-[#2c2c2c] mb-4">{loadError || 'Company not found'}</h1>
            <button onClick={handleBack} className="text-[#c6a065] hover:underline">{backLabel}</button>
          </div>
        </div>
      </>
    );
  }

  const heroImages = company.projectImages.filter(Boolean).slice(0, 10);
  const instagramLabel = company.instagram
    ? company.instagram.replace(/^https?:\/\/(www\.)?instagram\.com\//, '').replace(/\/$/, '')
    : '';
  const yearsExp = 2026 - company.foundedYear;
  const description = company.description || '';
  const shouldTruncate = description.length > 300;

  const similar = similarCompanies
    .filter(c => c.city === company.city && c.id !== company.id && c.projectImages.length > 0)
    .slice(0, 4);

  const heroPrev = () => setHeroIndex(i => (i > 0 ? i - 1 : heroImages.length - 1));
  const heroNext = () => setHeroIndex(i => (i < heroImages.length - 1 ? i + 1 : 0));

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    "name": company.name,
    "description": description || company.shortDescription,
    "address": { "@type": "PostalAddress", "addressLocality": company.city, "addressCountry": "AE" },
    ...(company.phone ? { "telephone": company.phone } : {}),
    "url": company.website || `https://www.tarmeer.com/companies/${company.id}`,
    ...(heroImages[0] ? { "image": `https://www.tarmeer.com${heroImages[0]}` } : {}),
    "priceRange": "$$",
    "areaServed": [
      { "@type": "City", "name": "Dubai" },
      { "@type": "City", "name": "Abu Dhabi" },
      { "@type": "City", "name": "Sharjah" },
      { "@type": "City", "name": "Ajman" },
      { "@type": "City", "name": "Ras Al Khaimah" },
      { "@type": "City", "name": "Fujairah" },
      { "@type": "City", "name": "Umm Al Quwain" },
    ],
    "knowsAbout": company.services.length > 0 ? company.services : ['Interior Design', 'Renovation', 'Fit-out'],
    ...(company.companyType ? { "additionalType": getCompanyTypeLabel(company.companyType) } : {}),
  };

  const faqJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: [
      {
        '@type': 'Question',
        name: `What services does ${company.name} offer in ${company.city}?`,
        acceptedAnswer: {
          '@type': 'Answer',
          text: `${company.name} offers professional interior design and renovation services in ${company.city}, UAE.${company.services.length > 0 ? ` Their specialties include ${company.services.slice(0, 5).join(', ')}.` : ' They serve residential and commercial clients.'}`,
        },
      },
      {
        '@type': 'Question',
        name: `How can I view ${company.name}'s portfolio?`,
        acceptedAnswer: {
          '@type': 'Answer',
          text: `You can browse ${company.name}'s complete portfolio on their Tarmeer profile, featuring ${company.projectCount > 0 ? company.projectCount + '+ completed projects with professional photos' : 'their work and services'}.`,
        },
      },
      {
        '@type': 'Question',
        name: `How do I contact ${company.name} for a consultation?`,
        acceptedAnswer: {
          '@type': 'Answer',
          text: `You can request a free consultation with ${company.name} directly through their Tarmeer profile. Fill out the inquiry form and their team will contact you.`,
        },
      },
    ],
  };

  const ogImage = heroImages[0]
    ? `https://www.tarmeer.com${heroImages[0]}`
    : 'https://www.tarmeer.com/images/tarmeer_logo.svg';

  return (
    <div className="min-h-screen bg-white">
      <Helmet>
        <title>{company.name} - {getCompanyTypeLabel(company.companyType) || 'Interior Design'} in {company.city} - Tarmeer</title>
        <meta name="description" content={`${company.name}${company.companyType ? ` (${getCompanyTypeLabel(company.companyType)})` : ''} provides ${company.services.slice(0, 3).join(', ')} services in ${company.city}, UAE. ${company.shortDescription}`} />
        <meta property="og:title" content={`${company.name} - ${company.city} - Tarmeer`} />
        <meta property="og:description" content={company.shortDescription} />
        <meta property="og:image" content={ogImage} />
        <meta property="og:url" content={`https://www.tarmeer.com/companies/${company.id}`} />
        <meta property="og:type" content="website" />
        <link rel="canonical" href={`https://www.tarmeer.com/companies/${company.id}`} />
        <script type="application/ld+json">{JSON.stringify(jsonLd)}</script>
        <script type="application/ld+json">{JSON.stringify({
          '@context': 'https://schema.org',
          '@type': 'BreadcrumbList',
          itemListElement: [
            { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://www.tarmeer.com/' },
            { '@type': 'ListItem', position: 2, name: 'Companies', item: 'https://www.tarmeer.com/companies' },
            { '@type': 'ListItem', position: 3, name: company.name, item: `https://www.tarmeer.com/companies/${company.id}` },
          ],
        })}</script>
        <script type="application/ld+json">{JSON.stringify(faqJsonLd)}</script>
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={`${company.name} - ${company.city} - Tarmeer`} />
        <meta name="twitter:description" content={company.shortDescription} />
        <meta name="twitter:image" content={ogImage} />
        <meta name="keywords" content={`${company.name}, interior design ${company.city}, renovation ${company.city}, ${company.services.slice(0, 5).join(', ')}, UAE, Tarmeer`} />
        <meta name="robots" content="index, follow, max-image-preview:large" />
      </Helmet>
      {/* Back nav */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-4 pb-2">
        <button onClick={handleBack} className="inline-flex items-center gap-1.5 text-sm text-stone-500 hover:text-[#b8864a] transition">
          <ArrowLeft className="w-4 h-4" /> {backLabel}
        </button>
      </div>

      {/* ===== Top Section: Hero + Inquiry Form ===== */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="flex gap-6">

          {/* Left: Image Carousel */}
          <div className="flex-1 min-w-0">
            <div className="relative rounded-lg overflow-hidden bg-stone-100 aspect-[16/10]">
              {heroImages.length > 0 ? (
                <>
                  <SmartImage
                    src={heroImages[heroIndex]}
                    alt={`${company.name} project ${heroIndex + 1}`}
                    className="w-full h-full object-cover"
                  />
                  {heroImages.length > 1 && (
                    <>
                      <button onClick={heroPrev}
                        className="absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/80 hover:bg-white shadow flex items-center justify-center transition">
                        <ChevronLeft className="w-5 h-5 text-stone-700" />
                      </button>
                      <button onClick={heroNext}
                        className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/80 hover:bg-white shadow flex items-center justify-center transition">
                        <ChevronRight className="w-5 h-5 text-stone-700" />
                      </button>
                      {/* Dots */}
                      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
                        {heroImages.slice(0, 8).map((_, i) => (
                          <button key={i} onClick={() => setHeroIndex(i)}
                            className={`w-2 h-2 rounded-full transition ${i === heroIndex ? 'bg-white' : 'bg-white/50'}`} />
                        ))}
                      </div>
                    </>
                  )}
                </>
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-stone-200 to-stone-300">
                  <span className="font-serif text-6xl text-stone-400">{company.name.charAt(0)}</span>
                </div>
              )}
            </div>

            {/* Company Header - Below carousel */}
            <div className="flex items-start gap-4 mt-5">
              {company.coverImage && company.coverImage.includes('/logos/') && (
                <SmartImage src={company.coverImage} alt={`${company.name} logo`}
                  className="w-16 h-16 rounded-lg object-contain bg-white border border-stone-100 p-1.5 flex-shrink-0"
                  onError={(e) => { e.currentTarget.style.display = 'none'; }}
                />
              )}
              <div className="flex-1 min-w-0">
                <h1 className="font-serif text-2xl font-semibold text-[#1c1917]">
                  {company.isSigned && (
                    <span className="inline-flex items-center mr-2 px-2 py-[3px] rounded bg-gradient-to-b from-[#d4a853] to-[#b8864a] text-white text-[12px] font-bold tracking-wider leading-none shrink-0 align-middle">Gold</span>
                  )}
                  {company.name}
                  {!company.isSigned && company.isClaimed && (
                    <BadgeCheck className="inline w-5 h-5 ml-1.5 text-[#b8864a]/70 shrink-0" />
                  )}
                </h1>
                <div className="flex items-center flex-wrap gap-x-3 gap-y-1 mt-1 text-sm">
                  {company.companyType && getCompanyTypeLabel(company.companyType) && (
                    <>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-[#f5f0e8] text-[#8b6914] font-medium">
                        {getCompanyTypeLabel(company.companyType)}
                      </span>
                      <span className="text-stone-300">&middot;</span>
                    </>
                  )}
                  <span className="text-[#b8864a] font-medium">{company.projectCount}+ projects</span>
                  <span className="text-stone-300">&middot;</span>
                  <span className="text-stone-500">{company.city}, UAE</span>
                  {company.foundedYear > 0 && <><span className="text-stone-300">&middot;</span>
                  <span className="text-stone-500">Since {company.foundedYear}</span></>}
                </div>
                {/* Stats row */}
                <div className="flex items-center gap-4 mt-2 text-xs text-stone-500">
                  <span className="flex items-center gap-1"><FolderOpen className="w-3.5 h-3.5 text-[#c6a065]" />{company.projectCount}+ Projects</span>
                  {company.foundedYear > 0 && <span className="flex items-center gap-1"><Calendar className="w-3.5 h-3.5 text-[#c6a065]" />{yearsExp} Years</span>}
                  <span className="flex items-center gap-1"><Briefcase className="w-3.5 h-3.5 text-[#c6a065]" />{company.services.length} Services</span>
                </div>
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex gap-3 mt-4 pb-5 border-b border-stone-200">
              {company.website && (
                <a href={company.website} target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-4 py-2 border border-stone-200 rounded-lg text-sm text-stone-700 hover:border-stone-400 transition">
                  <Globe className="w-4 h-4" /> Website
                </a>
              )}
              <button
                onClick={handleShareClick}
                className="inline-flex items-center gap-2 px-4 py-2 border border-stone-200 rounded-lg text-sm text-stone-700 hover:border-stone-400 transition cursor-pointer">
                <Share2 className="w-4 h-4" /> Share
              </button>

              {/* Bottom sheet — fixed overlay */}
              {shareOpen && (
                <div className="fixed inset-0 z-50">
                  <div className="absolute inset-0 bg-black/50" onClick={() => { setShareOpen(false); setCopyNote(''); }} />
                  <div ref={shareRef} className="absolute bottom-0 left-0 right-0 bg-white rounded-t-3xl overflow-hidden sm:absolute sm:bottom-auto sm:left-1/2 sm:top-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 sm:w-[400px] sm:rounded-2xl sm:shadow-xl" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
                    {/* Handle — mobile only */}
                    <div className="flex justify-center pt-3 pb-1 sm:hidden">
                      <div className="w-10 h-1 rounded-full bg-stone-200" />
                    </div>
                    {/* Title */}
                    <div className="flex items-center justify-between px-5 py-3">
                      <span className="text-base font-semibold text-[#2c2c2c]">Share</span>
                      <button onClick={() => { setShareOpen(false); setCopyNote(''); }} className="p-1.5 rounded-full hover:bg-stone-100 transition cursor-pointer">
                        <X className="w-5 h-5 text-stone-500" />
                      </button>
                    </div>

                    {/* Platform grid — 2 rows × 3 */}
                    <div className="grid grid-cols-3 gap-y-5 sm:gap-y-3 px-6 sm:px-5 pt-1 pb-5 sm:pb-4">

                      {/* WhatsApp */}
                      <a href={`https://wa.me/?text=${encodeURIComponent((company?.name || '') + ' ' + window.location.href)}`}
                        target="_blank" rel="noopener noreferrer"
                        className="flex flex-col items-center gap-1.5">
                        <div className="w-16 h-16 sm:w-11 sm:h-11 rounded-full flex items-center justify-center" style={{ backgroundColor: '#25D36618' }}>
                          <svg className="w-8 h-8 sm:w-5 sm:h-5" viewBox="0 0 24 24" fill="#25D366"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                        </div>
                        <span className="text-xs text-stone-500">WhatsApp</span>
                      </a>

                      {/* Facebook */}
                      <a href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(window.location.href)}`}
                        target="_blank" rel="noopener noreferrer"
                        className="flex flex-col items-center gap-1.5">
                        <div className="w-16 h-16 sm:w-11 sm:h-11 rounded-full flex items-center justify-center" style={{ backgroundColor: '#1877F218' }}>
                          <svg className="w-8 h-8 sm:w-5 sm:h-5" viewBox="0 0 24 24" fill="#1877F2"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
                        </div>
                        <span className="text-xs text-stone-500">Facebook</span>
                      </a>

                      {/* Instagram — copy only */}
                      <button onClick={() => copyAndNotify('ig')} className="flex flex-col items-center gap-1.5 cursor-pointer">
                        <div className="w-16 h-16 sm:w-11 sm:h-11 rounded-full flex items-center justify-center" style={{ backgroundColor: '#E4405F18' }}>
                          <svg className="w-8 h-8 sm:w-5 sm:h-5" viewBox="0 0 24 24" fill="#E4405F"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 1 0 0 12.324 6.162 6.162 0 0 0 0-12.324zM12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm6.406-11.845a1.44 1.44 0 1 0 0 2.881 1.44 1.44 0 0 0 0-2.881z"/></svg>
                        </div>
                        <span className="text-xs text-stone-500">{copyNote === 'ig' ? '✓ Copied' : 'Instagram'}</span>
                      </button>

                      {/* X */}
                      <a href={`https://x.com/intent/tweet?url=${encodeURIComponent(window.location.href)}&text=${encodeURIComponent(company?.name || '')}`}
                        target="_blank" rel="noopener noreferrer"
                        className="flex flex-col items-center gap-1.5">
                        <div className="w-16 h-16 sm:w-11 sm:h-11 rounded-full flex items-center justify-center bg-stone-100">
                          <svg className="w-7 h-7 sm:w-5 sm:h-5" viewBox="0 0 24 24" fill="#000"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.748l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
                        </div>
                        <span className="text-xs text-stone-500">X</span>
                      </a>

                      {/* LinkedIn */}
                      <a href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(window.location.href)}`}
                        target="_blank" rel="noopener noreferrer"
                        className="flex flex-col items-center gap-1.5">
                        <div className="w-16 h-16 sm:w-11 sm:h-11 rounded-full flex items-center justify-center" style={{ backgroundColor: '#0A66C218' }}>
                          <svg className="w-8 h-8 sm:w-5 sm:h-5" viewBox="0 0 24 24" fill="#0A66C2"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>
                        </div>
                        <span className="text-xs text-stone-500">LinkedIn</span>
                      </a>

                      {/* Email */}
                      <a href={`mailto:?subject=${encodeURIComponent(company?.name || 'Interior Design')}&body=${encodeURIComponent(window.location.href)}`}
                        className="flex flex-col items-center gap-1.5">
                        <div className="w-16 h-16 sm:w-11 sm:h-11 rounded-full flex items-center justify-center" style={{ backgroundColor: '#b8864a18' }}>
                          <Mail className="w-7 h-7 sm:w-5 sm:h-5 text-[#b8864a]" />
                        </div>
                        <span className="text-xs text-stone-500">Email</span>
                      </a>

                    </div>

                    {/* Copy link — full width bar */}
                    <div className="px-4 pb-6 border-t border-stone-100 pt-3">
                      <button
                        onClick={() => copyAndNotify('Link copied!')}
                        className="w-full flex items-center justify-center gap-2.5 h-12 rounded-2xl bg-stone-100 hover:bg-stone-200 transition cursor-pointer">
                        {copyNote === 'Link copied!'
                          ? <CheckCircle2 className="w-5 h-5 text-green-600" />
                          : <Link2 className="w-5 h-5 text-stone-500" />}
                        <span className={`text-sm font-medium ${copyNote === 'Link copied!' ? 'text-green-600' : 'text-[#2c2c2c]'}`}>
                          {copyNote === 'Link copied!' ? 'Link copied!' : 'Copy link'}
                        </span>
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* ===== Tab Content ===== */}

            {/* About Section - only show if has description or styles */}
            {(description || company.styles.length > 0) && (
              <section className="py-6 border-b border-stone-100">
                {description && (
                  <>
                    <h2 className="text-lg font-semibold text-[#1c1917] mb-3">About Us</h2>
                    <div className="text-sm text-stone-600 leading-relaxed mb-4">
                      <p>{aboutExpanded || !shouldTruncate ? description : description.slice(0, 300) + '...'}</p>
                      {shouldTruncate && (
                        <button onClick={() => setAboutExpanded(!aboutExpanded)}
                          className="text-[#1c1917] font-medium mt-1 hover:underline">
                          {aboutExpanded ? 'Show Less' : 'Read More'} &darr;
                        </button>
                      )}
                    </div>
                  </>
                )}

                {company.styles.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {company.styles.map(s => (
                      <span key={s} className="px-3 py-1 bg-stone-50 border border-stone-200 rounded-full text-xs text-stone-600">{s}</span>
                    ))}
                  </div>
                )}
              </section>
            )}

            {/* Services Section */}
            {company.services.length > 0 && (
              <section className="py-6 border-b border-stone-100">
                <h2 className="text-lg font-semibold text-[#1c1917] mb-3">Services</h2>
                <div className="flex flex-wrap gap-2">
                  {company.services.map(svc => (
                    <span key={svc} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-stone-50 border border-stone-200 rounded-lg text-sm text-stone-700">
                      <Briefcase className="w-3.5 h-3.5 text-[#c6a065]" /> {svc}
                    </span>
                  ))}
                </div>
              </section>
            )}

            {/* Contact Info (visible on mobile, hidden on desktop - shown in sidebar)
                Hidden for claimed/registered companies — they acquire leads through the platform. */}
            {!company.isClaimed && (company.phone || company.email || company.website || company.instagram || company.address) && (
              <section className="py-6 border-b border-stone-100 lg:hidden">
                <h2 className="text-lg font-semibold text-[#1c1917] mb-3">Contact</h2>
                <div className="space-y-2.5 text-sm">
                  {company.email && (
                    <a href={`mailto:${company.email}`} className="flex items-center gap-2.5 text-stone-600 hover:text-[#b8864a]">
                      <Mail className="w-4 h-4 text-[#c6a065]" /> {company.email}
                    </a>
                  )}
                  {company.website && (
                    <a href={company.website} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2.5 text-[#b8864a] hover:underline">
                      <Globe className="w-4 h-4" /> Visit website <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                  {company.instagram && (
                    <a href={company.instagram} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2.5 text-[#b8864a] hover:underline">
                      <Instagram className="w-4 h-4" /> {instagramLabel ? `@${instagramLabel}` : 'Instagram'}
                    </a>
                  )}
                  {company.address && (
                    <div className="flex items-start gap-2.5 text-stone-600 pt-2 border-t border-stone-100">
                      <MapPin className="w-4 h-4 text-[#c6a065] mt-0.5 flex-shrink-0" /> {company.address}
                    </div>
                  )}
                </div>
              </section>
            )}

            {/* ===== Projects Section (inside left column so sidebar stays sticky alongside) =====
                 锁死布局：项目网格只有一个唯一的渲染入口（CompanyProjectsSection）。
                 任何 detail 数据来源（public 直访 / admin preview / company-dashboard preview）
                 只要喂出 isClaimed=true + projects[]，就走这块。不要再在这里 inline 重写一份。 */}
            <div className="mt-2">
              {company.isClaimed && company.projects && company.projects.length > 0 ? (
                <CompanyProjectsSection company={company} projects={company.projects} />
              ) : directoryProjects.length > 0 ? (
                <CompanyProjectsSection
                  company={company}
                  projects={directoryProjects}
                  onProjectClick={(proj) => {
                    const flat = Object.values(normalizedProjectCategories).flat();
                    const idx = flat.findIndex((item) => item.url === proj.images[0]);
                    setLightboxIndex(Math.max(0, idx));
                    setLightboxOpen(true);
                  }}
                />
              ) : (
                <MasonryGallery
                  categories={normalizedStyleCategories}
                  onImageClick={handleImageClick}
                  externalWebsite={company.isClaimed ? undefined : (company.website || undefined)}
                />
              )}
            </div>
          </div>

          {/* Right: Sticky Inquiry Sidebar */}
          <div ref={sidebarRef} className="hidden lg:block w-[320px] flex-shrink-0">
            <div className="sticky top-20 space-y-4">
              <ServiceInquiryCard title={`Get in touch with ${company.name}`} companyName={company.name} companySlug={company.id} />

              {/* Contact Info Card — hidden for claimed/registered companies */}
              {!company.isClaimed && (company.phone || company.email || company.website || company.instagram || company.address) && (
                <div className="border border-stone-200 rounded-xl p-5">
                  <h3 className="text-sm font-semibold text-[#1c1917] mb-3">Contact Info</h3>
                  <div className="space-y-2.5 text-sm">
                    {company.email && (
                      <a href={`mailto:${company.email}`} className="flex items-center gap-2.5 text-stone-600 hover:text-[#b8864a] transition">
                        <Mail className="w-4 h-4 text-stone-400" /> {company.email}
                      </a>
                    )}
                    {company.website && (
                      <a href={company.website} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2.5 text-stone-600 hover:text-[#b8864a] transition">
                        <Globe className="w-4 h-4 text-stone-400" /> Website <ExternalLink className="w-3 h-3 text-stone-300" />
                      </a>
                    )}
                    {company.instagram && (
                      <a href={company.instagram} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2.5 text-stone-600 hover:text-[#b8864a] transition">
                        <Instagram className="w-4 h-4 text-stone-400" /> {instagramLabel ? `@${instagramLabel}` : 'Instagram'}
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

              {/* Business Details */}
              <div className="border border-stone-200 rounded-xl p-5">
                <h3 className="text-sm font-semibold text-[#1c1917] mb-3">Business Details</h3>
                <dl className="space-y-2 text-sm">
                  {company.companyType && getCompanyTypeLabel(company.companyType) && (
                    <div className="flex justify-between">
                      <dt className="text-stone-500">Type</dt>
                      <dd className="text-[#1c1917]">{getCompanyTypeLabel(company.companyType)}</dd>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <dt className="text-stone-500">Location</dt>
                    <dd className="text-[#1c1917]">{company.city}, UAE</dd>
                  </div>
                  {company.foundedYear > 0 && (
                  <div className="flex justify-between">
                    <dt className="text-stone-500">Established</dt>
                    <dd className="text-[#1c1917]">{company.foundedYear}</dd>
                  </div>
                  )}
                  <div className="flex justify-between">
                    <dt className="text-stone-500">Projects</dt>
                    <dd className="text-[#1c1917]">{company.projectCount}+</dd>
                  </div>
                </dl>
              </div>
            </div>
          </div>
        </div>
      </div>


      {/* ===== Similar Companies ===== */}
      {similar.length > 0 && (
        <section className="border-t border-stone-200 bg-stone-50 py-10 mt-8">
          <div className="max-w-6xl mx-auto px-4 sm:px-6">
            <h2 className="font-serif text-xl font-semibold text-[#1c1917] mb-5">
              Similar Companies in {company.city}
            </h2>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {similar.map(c => (
                <div key={c.id} onClick={() => navigate(`/companies/${c.id}`)}
                  className="group cursor-pointer rounded-lg overflow-hidden border border-stone-200 bg-white hover:shadow-md transition">
                  <div className="h-32 bg-stone-100 overflow-hidden">
                    {c.projectImages[0] ? (
                      <SmartImage src={c.projectImages[0]} alt={c.name} className="w-full h-full object-cover group-hover:scale-105 transition duration-500" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <span className="font-serif text-3xl text-stone-200">{c.name.charAt(0)}</span>
                      </div>
                    )}
                  </div>
                  <div className="p-3">
                    <h3 className="font-medium text-sm text-[#1c1917] group-hover:text-[#b8864a] transition truncate">{c.name}</h3>
                    <p className="text-xs text-stone-500 mt-0.5">{c.projectCount}+ projects</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Floating Inquiry Form - appears when sidebar scrolls out */}
      <AnimatePresence>
        {showFloatingForm && !floatingFormDismissed && !lightboxOpen && (
          <motion.div
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="fixed bottom-0 right-0 z-40 w-full sm:w-[380px] sm:bottom-4 sm:right-4"
          >
            <div className="bg-white border border-stone-200 sm:rounded-xl shadow-2xl shadow-stone-300/50 p-5 overflow-hidden">
              {/* Header */}
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold text-sm text-[#1c1917]">{company.name}</p>
                  <p className="text-xs text-[#b8864a]">{company.projectCount}+ projects</p>
                </div>
                <button onClick={() => setFloatingFormDismissed(true)}
                  className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-stone-100 transition">
                  <X className="w-4 h-4 text-stone-400" />
                </button>
              </div>
              <ServiceInquiryCard
                title={`Get in touch with ${company.name}`}
                companyName={company.name}
                companySlug={company.id}
                inline
                className="mt-4"
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Lightbox */}
      <Lightbox
        open={lightboxOpen}
        images={allLightboxImages}
        currentIndex={lightboxIndex}
        categoryName="Portfolio"
        onClose={() => setLightboxOpen(false)}
        onNavigate={(i) => setLightboxIndex(i)}
      />

      {/* Footer */}
      <div className="border-t border-stone-200 py-6 text-center">
        <button onClick={handleBack} className="text-sm text-stone-500 hover:text-[#b8864a] transition">
          <ArrowLeft className="w-4 h-4 inline mr-1" /> {backLabel}
        </button>
      </div>
    </div>
  );
}
