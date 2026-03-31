import { useEffect, useState, useCallback, useMemo } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Globe, Instagram, MapPin, Briefcase, ExternalLink,
  Calendar, FolderOpen, Phone, Mail,
} from 'lucide-react';
import type { Company, PortfolioItem } from '../lib/companyData';
import { fetchPublicCompanyDetail, fetchPublicCompanies } from '../lib/publicApi';
import { normalizePortfolioCategories } from '../lib/categoryNormalize';
import MasonryGallery from '../components/MasonryGallery';
import Lightbox from '../components/Lightbox';

export default function CompanyDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [company, setCompany] = useState<Company | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [similarCompanies, setSimilarCompanies] = useState<Company[]>([]);
  const [activeSection, setActiveSection] = useState('about');

  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxCategory, setLightboxCategory] = useState('');
  const [lightboxIndex, setLightboxIndex] = useState(0);

  useEffect(() => {
    if (!id) { setLoadError('Company not found'); setLoading(false); return; }
    let active = true;
    setLoading(true);
    setLoadError('');

    fetchPublicCompanyDetail(id)
      .then((item) => { if (active) setCompany(item); })
      .catch((error) => { if (active) setLoadError(error instanceof Error ? error.message : 'Failed to load'); })
      .finally(() => { if (active) setLoading(false); });

    // Load similar companies
    fetchPublicCompanies(100)
      .then((all) => { if (active) setSimilarCompanies(all); })
      .catch(() => {});

    return () => { active = false; };
  }, [id]);

  // Normalize categories
  const normalizedCategories = useMemo(() => {
    if (!company?.portfolioCategories) return {};
    return normalizePortfolioCategories(company.portfolioCategories);
  }, [company]);

  const handleImageClick = useCallback(
    (_url: string, categoryName: string, indexInCategory: number) => {
      setLightboxCategory(categoryName);
      setLightboxIndex(indexInCategory);
      setLightboxOpen(true);
    }, []
  );

  const handleLightboxNavigate = useCallback((index: number) => setLightboxIndex(index), []);
  const handleLightboxClose = useCallback(() => setLightboxOpen(false), []);

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
          <Link to="/companies" className="text-[#c6a065] hover:underline">Back to companies</Link>
        </div>
      </div>
    );
  }

  const heroImages = company.projectImages.slice(0, 5);
  const instagramLabel = company.instagram
    ? company.instagram.replace(/^https?:\/\/(www\.)?instagram\.com\//, '').replace(/\/$/, '')
    : '';
  const yearsExp = 2026 - company.foundedYear;
  const lightboxImages: PortfolioItem[] = normalizedCategories[lightboxCategory] ?? [];

  // Similar companies: same city, exclude self
  const similar = similarCompanies
    .filter(c => c.city === company.city && c.id !== company.id && c.projectImages.length > 0)
    .slice(0, 4);

  const tabs = [
    { id: 'about', label: 'About' },
    { id: 'projects', label: `Projects (${company.projectCount})` },
    ...(company.services.length > 0 ? [{ id: 'services', label: 'Services' }] : []),
    { id: 'contact', label: 'Contact' },
  ];

  return (
    <div className="min-h-screen bg-[#faf9f7]">
      {/* 1. Hero - Cover Photo Gallery */}
      <section className="relative">
        <div className="relative h-[300px] sm:h-[400px] overflow-hidden bg-stone-200">
          <Link to="/companies"
            className="absolute top-4 left-4 z-10 inline-flex items-center gap-2 px-3 py-1.5 bg-black/30 hover:bg-black/50 text-white text-sm rounded-full backdrop-blur-sm transition">
            <ArrowLeft className="w-4 h-4" /> Companies
          </Link>

          {heroImages.length > 0 ? (
            <div className="flex h-full">
              {/* Main large image */}
              <div className="flex-1 h-full">
                <img src={heroImages[0]} alt={company.name} className="w-full h-full object-cover" />
              </div>
              {/* Side thumbnails grid */}
              {heroImages.length > 1 && (
                <div className="hidden sm:grid grid-cols-2 w-[360px] gap-0.5 ml-0.5">
                  {heroImages.slice(1, 5).map((img, i) => (
                    <img key={i} src={img} alt="" className="w-full h-full object-cover" />
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-stone-300 to-stone-400 flex items-center justify-center">
              <span className="font-serif text-6xl text-white/30">{company.name.charAt(0)}</span>
            </div>
          )}

          <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent pointer-events-none" />

          {/* Company name overlay */}
          <div className="absolute bottom-0 left-0 right-0 p-6 sm:p-8">
            <div className="max-w-6xl mx-auto flex items-end justify-between">
              <div>
                <h1 className="font-serif text-2xl sm:text-4xl font-semibold text-white drop-shadow-lg mb-1">
                  {company.name}
                </h1>
                <div className="flex items-center gap-3 text-white/80 text-sm">
                  <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5" />{company.city}, UAE</span>
                  <span>&middot;</span>
                  <span>{company.projectCount}+ projects</span>
                  <span>&middot;</span>
                  <span>Since {company.foundedYear}</span>
                </div>
              </div>
              {company.coverImage && (
                <img src={company.coverImage} alt="" className="w-12 h-12 rounded-lg bg-white/10 backdrop-blur object-cover hidden sm:block" />
              )}
            </div>
          </div>
        </div>
      </section>

      {/* 2. Tab Navigation - Sticky */}
      <nav className="sticky top-0 z-20 bg-white border-b border-stone-200 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="flex gap-0 overflow-x-auto">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveSection(tab.id);
                  document.getElementById(`section-${tab.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }}
                className={`px-5 py-3.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                  activeSection === tab.id
                    ? 'border-[#b8864a] text-[#b8864a]'
                    : 'border-transparent text-stone-500 hover:text-[#1c1917]'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </nav>

      {/* 3. Main Content */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        <div className="flex flex-col lg:flex-row gap-8">

          {/* Left Column */}
          <div className="flex-1 min-w-0 space-y-8">

            {/* About Section */}
            <section id="section-about">
              <h2 className="font-serif text-2xl font-semibold text-[#1c1917] mb-4">About {company.name}</h2>

              {/* Stats Bar */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
                {[
                  { icon: FolderOpen, value: `${company.projectCount}+`, label: 'Projects' },
                  { icon: Calendar, value: String(yearsExp), label: 'Years Exp.' },
                  { icon: Briefcase, value: String(company.services.length), label: 'Services' },
                  { icon: MapPin, value: company.city, label: 'Location' },
                ].map(stat => (
                  <div key={stat.label} className="flex items-center gap-3 bg-white rounded-xl p-4 border border-stone-100">
                    <div className="w-9 h-9 rounded-lg bg-[#c6a065]/10 flex items-center justify-center flex-shrink-0">
                      <stat.icon className="w-4 h-4 text-[#c6a065]" />
                    </div>
                    <div>
                      <div className="text-lg font-semibold text-[#1c1917] leading-tight">{stat.value}</div>
                      <div className="text-xs text-[#6b6b6b]">{stat.label}</div>
                    </div>
                  </div>
                ))}
              </div>

              {company.description && (
                <div className="bg-white rounded-xl p-6 border border-stone-100">
                  <p className="text-[#44403c] leading-relaxed">{company.description}</p>
                </div>
              )}

              {/* Specialties */}
              {company.styles.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-4">
                  {company.styles.map(style => (
                    <span key={style} className="px-3 py-1.5 bg-[#c6a065]/10 text-[#c6a065] rounded-full text-xs font-medium">
                      {style}
                    </span>
                  ))}
                </div>
              )}
            </section>

            {/* Projects Section - Normalized Categories */}
            <section id="section-projects">
              <MasonryGallery
                categories={normalizedCategories}
                onImageClick={handleImageClick}
              />
            </section>

            {/* Services Section */}
            {company.services.length > 0 && (
              <section id="section-services">
                <h2 className="font-serif text-2xl font-semibold text-[#1c1917] mb-4">Services</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {company.services.map(service => (
                    <div key={service} className="flex items-center gap-3 bg-white rounded-xl p-4 border border-stone-100">
                      <Briefcase className="w-4 h-4 text-[#c6a065] flex-shrink-0" />
                      <span className="text-sm text-[#1c1917]">{service}</span>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Contact Section */}
            <section id="section-contact" className="lg:hidden">
              <h2 className="font-serif text-2xl font-semibold text-[#1c1917] mb-4">Contact</h2>
              <div className="bg-white rounded-xl p-6 border border-stone-100 space-y-3">
                {company.phone && (
                  <a href={`tel:${company.phone}`} className="flex items-center gap-3 text-sm text-[#44403c] hover:text-[#b8864a]">
                    <Phone className="w-4 h-4 text-[#c6a065]" /> {company.phone}
                  </a>
                )}
                {company.email && (
                  <a href={`mailto:${company.email}`} className="flex items-center gap-3 text-sm text-[#44403c] hover:text-[#b8864a]">
                    <Mail className="w-4 h-4 text-[#c6a065]" /> {company.email}
                  </a>
                )}
                {company.website && (
                  <a href={company.website} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 text-sm text-[#c6a065] hover:underline">
                    <Globe className="w-4 h-4" /> Visit website <ExternalLink className="w-3 h-3" />
                  </a>
                )}
                {company.instagram && (
                  <a href={company.instagram} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 text-sm text-[#c6a065] hover:underline">
                    <Instagram className="w-4 h-4" /> {instagramLabel ? `@${instagramLabel}` : 'Instagram'}
                  </a>
                )}
                {company.address && (
                  <div className="flex items-start gap-3 text-sm text-[#44403c] pt-2 border-t border-stone-100">
                    <MapPin className="w-4 h-4 text-[#c6a065] mt-0.5 flex-shrink-0" />
                    <span>{company.address}</span>
                  </div>
                )}
              </div>
            </section>
          </div>

          {/* Right Column - Sticky Sidebar */}
          <div className="w-full lg:w-[340px] flex-shrink-0 hidden lg:block">
            <div className="lg:sticky lg:top-16 space-y-4">
              {/* Contact Card */}
              <div className="bg-white rounded-xl p-6 border border-stone-100">
                <h3 className="font-semibold text-[#1c1917] mb-4">Contact {company.name}</h3>
                <div className="space-y-3">
                  {company.phone && (
                    <a href={`tel:${company.phone}`} className="flex items-center gap-3 text-sm text-[#44403c] hover:text-[#b8864a] transition">
                      <Phone className="w-4 h-4 text-[#c6a065]" /> {company.phone}
                    </a>
                  )}
                  {company.email && (
                    <a href={`mailto:${company.email}`} className="flex items-center gap-3 text-sm text-[#44403c] hover:text-[#b8864a] transition">
                      <Mail className="w-4 h-4 text-[#c6a065]" /> {company.email}
                    </a>
                  )}
                  {company.website && (
                    <a href={company.website} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 text-sm text-[#c6a065] hover:underline">
                      <Globe className="w-4 h-4" /> Visit website <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                  {company.instagram && (
                    <a href={company.instagram} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 text-sm text-[#c6a065] hover:underline">
                      <Instagram className="w-4 h-4" /> {instagramLabel ? `@${instagramLabel}` : 'Instagram'}
                    </a>
                  )}
                </div>
                {company.address && (
                  <div className="flex items-start gap-3 text-sm text-[#44403c] pt-3 mt-3 border-t border-stone-100">
                    <MapPin className="w-4 h-4 text-[#c6a065] mt-0.5 flex-shrink-0" />
                    <span>{company.address}</span>
                  </div>
                )}
              </div>

              {/* Quick Info */}
              <div className="bg-white rounded-xl p-6 border border-stone-100">
                <h3 className="font-semibold text-[#1c1917] mb-3">Business Details</h3>
                <dl className="space-y-2.5 text-sm">
                  <div className="flex justify-between">
                    <dt className="text-stone-500">Location</dt>
                    <dd className="text-[#1c1917] font-medium">{company.city}, UAE</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-stone-500">Established</dt>
                    <dd className="text-[#1c1917] font-medium">{company.foundedYear}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-stone-500">Projects</dt>
                    <dd className="text-[#1c1917] font-medium">{company.projectCount}+</dd>
                  </div>
                  {company.styles.length > 0 && (
                    <div className="flex justify-between">
                      <dt className="text-stone-500">Specialty</dt>
                      <dd className="text-[#1c1917] font-medium text-right">{company.styles.slice(0, 2).join(', ')}</dd>
                    </div>
                  )}
                </dl>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 7. Similar Companies */}
      {similar.length > 0 && (
        <section className="border-t border-stone-200 bg-white py-10">
          <div className="max-w-6xl mx-auto px-4 sm:px-6">
            <h2 className="font-serif text-2xl font-semibold text-[#1c1917] mb-6">
              Similar Companies in {company.city}
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {similar.map(c => (
                <div
                  key={c.id}
                  onClick={() => navigate(`/companies/${c.id}`)}
                  className="group cursor-pointer rounded-xl overflow-hidden border border-stone-100 hover:border-[#c6a065]/30 hover:shadow-md transition"
                >
                  <div className="h-36 bg-stone-100 overflow-hidden">
                    {c.projectImages[0] ? (
                      <img src={c.projectImages[0]} alt={c.name} className="w-full h-full object-cover group-hover:scale-105 transition duration-500" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <span className="font-serif text-3xl text-stone-200">{c.name.charAt(0)}</span>
                      </div>
                    )}
                  </div>
                  <div className="p-4">
                    <h3 className="font-semibold text-sm text-[#1c1917] group-hover:text-[#b8864a] transition truncate">{c.name}</h3>
                    <p className="text-xs text-stone-500 mt-1">{c.projectCount}+ projects &middot; {c.city}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Lightbox */}
      <Lightbox
        open={lightboxOpen}
        images={lightboxImages}
        currentIndex={lightboxIndex}
        categoryName={lightboxCategory}
        onClose={handleLightboxClose}
        onNavigate={handleLightboxNavigate}
      />

      {/* Back Footer */}
      <section className="border-t border-stone-200 bg-[#faf9f7]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 text-center">
          <Link to="/companies" className="inline-flex items-center gap-2 text-sm text-[#6b6b6b] hover:text-[#c6a065] transition">
            <ArrowLeft className="w-4 h-4" /> Back to Companies
          </Link>
        </div>
      </section>
    </div>
  );
}
