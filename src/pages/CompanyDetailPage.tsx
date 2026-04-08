import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { useParams, Link, useNavigate, useSearchParams } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ArrowLeft, Globe, Instagram, MapPin, Briefcase,
  Calendar, FolderOpen, Phone, Mail, ChevronLeft, ChevronRight,
  Share2, ExternalLink, X,
} from 'lucide-react';
import type { Company, PortfolioItem } from '../lib/companyData';
import { fetchCompanyPreviewDetail, fetchPublicCompanyDetail, fetchPublicCompanies, fetchAdminCompanyPreview } from '../lib/publicApi';
import { normalizePortfolioCategories } from '../lib/categoryNormalize';
import MasonryGallery from '../components/MasonryGallery';
import Lightbox from '../components/Lightbox';
import ServiceInquiryCard from '../components/services/ServiceInquiryCard';
import SmartImage from '../components/ui/SmartImage';

export default function CompanyDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const previewMode = searchParams.get('preview') === '1';
  const adminPreview = searchParams.get('admin_preview') === '1';
  const from = searchParams.get('from');
  const backTo = adminPreview
    ? `/admin/profile-companies/${id}?tab=companies`
    : previewMode || from === 'company-dashboard' ? '/company/dashboard' : '/companies';
  const backLabel = adminPreview
    ? 'Back to Admin'
    : previewMode || from === 'company-dashboard' ? 'Back to Company Dashboard' : 'Back to Companies';
  const [company, setCompany] = useState<Company | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [similarCompanies, setSimilarCompanies] = useState<Company[]>([]);
  const [heroIndex, setHeroIndex] = useState(0);
  const [aboutExpanded, setAboutExpanded] = useState(false);

  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [portfolioMode, setPortfolioMode] = useState<'project' | 'style'>('project');
  const [showFloatingForm, setShowFloatingForm] = useState(false);
  const [floatingFormDismissed, setFloatingFormDismissed] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);

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
      .then((item) => { if (active) setCompany(item); })
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

  const allLightboxImages: PortfolioItem[] = useMemo(() => {
    return Object.values(activeCategories).flat();
  }, [activeCategories]);

  const handleImageClick = useCallback(
    (_url: string, categoryName: string, indexInCategory: number) => {
      // Convert category-relative index to global index
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
    }, [activeCategories]
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="w-12 h-12 rounded-full border-4 border-[#c6a065]/20 border-t-[#c6a065] animate-spin" />
      </div>
    );
  }

  if (!company) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <h1 className="font-serif text-2xl text-[#2c2c2c] mb-4">{loadError || 'Company not found'}</h1>
          <Link to={backTo} className="text-[#c6a065] hover:underline">{backLabel}</Link>
        </div>
      </div>
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

  return (
    <div className="min-h-screen bg-white">
      {/* Back nav */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-4 pb-2">
        <Link to={backTo} className="inline-flex items-center gap-1.5 text-sm text-stone-500 hover:text-[#b8864a] transition">
          <ArrowLeft className="w-4 h-4" /> {backLabel}
        </Link>
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
                <h1 className="font-serif text-2xl font-semibold text-[#1c1917]">{company.name}</h1>
                <div className="flex items-center flex-wrap gap-x-3 gap-y-1 mt-1 text-sm">
                  <span className="text-[#b8864a] font-medium">{company.projectCount}+ projects</span>
                  <span className="text-stone-300">&middot;</span>
                  <span className="text-stone-500">{company.city}, UAE</span>
                  <span className="text-stone-300">&middot;</span>
                  <span className="text-stone-500">Since {company.foundedYear}</span>
                </div>
                {/* Stats row */}
                <div className="flex items-center gap-4 mt-2 text-xs text-stone-500">
                  <span className="flex items-center gap-1"><FolderOpen className="w-3.5 h-3.5 text-[#c6a065]" />{company.projectCount}+ Projects</span>
                  <span className="flex items-center gap-1"><Calendar className="w-3.5 h-3.5 text-[#c6a065]" />{yearsExp} Years</span>
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
              <button onClick={() => navigator.clipboard?.writeText(window.location.href)}
                className="inline-flex items-center gap-2 px-4 py-2 border border-stone-200 rounded-lg text-sm text-stone-700 hover:border-stone-400 transition">
                <Share2 className="w-4 h-4" /> Share
              </button>
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

            {/* Contact Info (visible on mobile, hidden on desktop - shown in sidebar) */}
            <section className="py-6 border-b border-stone-100 lg:hidden">
              <h2 className="text-lg font-semibold text-[#1c1917] mb-3">Contact</h2>
              <div className="space-y-2.5 text-sm">
                {company.phone && (
                  <a href={`tel:${company.phone}`} className="flex items-center gap-2.5 text-stone-600 hover:text-[#b8864a]">
                    <Phone className="w-4 h-4 text-[#c6a065]" /> {company.phone}
                  </a>
                )}
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
          </div>

          {/* Right: Sticky Inquiry Sidebar */}
          <div ref={sidebarRef} className="hidden lg:block w-[320px] flex-shrink-0">
            <div className="sticky top-4 space-y-4">
              <ServiceInquiryCard title={`Get in touch with ${company.name}`} companyName={company.name} companySlug={company.id} />

              {/* Contact Info Card */}
              <div className="border border-stone-200 rounded-xl p-5">
                <h3 className="text-sm font-semibold text-[#1c1917] mb-3">Contact Info</h3>
                <div className="space-y-2.5 text-sm">
                  {company.phone && (
                    <a href={`tel:${company.phone}`} className="flex items-center gap-2.5 text-stone-600 hover:text-[#b8864a] transition">
                      <Phone className="w-4 h-4 text-stone-400" /> {company.phone}
                    </a>
                  )}
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

              {/* Business Details */}
              <div className="border border-stone-200 rounded-xl p-5">
                <h3 className="text-sm font-semibold text-[#1c1917] mb-3">Business Details</h3>
                <dl className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <dt className="text-stone-500">Location</dt>
                    <dd className="text-[#1c1917]">{company.city}, UAE</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-stone-500">Established</dt>
                    <dd className="text-[#1c1917]">{company.foundedYear}</dd>
                  </div>
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

      {/* ===== Projects Section - Full Width ===== */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 mt-2">
        {hasProjectCategories && (
          <div className="flex gap-2 mb-4">
            <button
              onClick={() => setPortfolioMode('project')}
              className={`px-4 py-1.5 rounded-2xl text-sm font-medium transition ${
                portfolioMode === 'project'
                  ? 'bg-[#b8864a] text-white'
                  : 'border border-stone-200 text-stone-600 hover:bg-stone-50'
              }`}
            >
              By Project ({Object.keys(normalizedProjectCategories).length})
            </button>
            <button
              onClick={() => setPortfolioMode('style')}
              className={`px-4 py-1.5 rounded-2xl text-sm font-medium transition ${
                portfolioMode === 'style'
                  ? 'bg-[#b8864a] text-white'
                  : 'border border-stone-200 text-stone-600 hover:bg-stone-50'
              }`}
            >
              By Style ({Object.keys(normalizedStyleCategories).length})
            </button>
          </div>
        )}
        <MasonryGallery
          categories={activeCategories}
          onImageClick={handleImageClick}
          externalWebsite={company.isClaimed ? undefined : (company.website || undefined)}
        />
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
        <Link to={backTo} className="text-sm text-stone-500 hover:text-[#b8864a] transition">
          <ArrowLeft className="w-4 h-4 inline mr-1" /> {backLabel}
        </Link>
      </div>
    </div>
  );
}
