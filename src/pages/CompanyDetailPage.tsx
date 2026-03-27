import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Globe, Instagram, Phone, Mail, MapPin, Briefcase, X, ChevronLeft, ChevronRight, ExternalLink } from 'lucide-react';
import type { Company } from '../lib/companyData';
import { fetchPublicCompanyDetail } from '../lib/publicApi';
import { getNextRenderableImageIndex } from '../lib/imageCleanup';

export default function CompanyDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [company, setCompany] = useState<Company | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [imgIndex, setImgIndex] = useState(0);
  const [failedIndices, setFailedIndices] = useState<number[]>([]);
  const [lightboxOpen, setLightboxOpen] = useState(false);

  useEffect(() => {
    if (!id) {
      setLoadError('Company not found');
      setLoading(false);
      return;
    }

    let active = true;
    setLoading(true);
    setLoadError('');
    setFailedIndices([]);
    setImgIndex(0);

    fetchPublicCompanyDetail(id)
      .then((item) => {
        if (!active) return;
        setCompany(item);
      })
      .catch((error) => {
        if (!active) return;
        setLoadError(error instanceof Error ? error.message : 'Failed to load company');
      })
      .finally(() => {
        if (!active) return;
        setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#faf9f7] flex items-center justify-center">
        <div className="w-12 h-12 rounded-full border-4 border-[#c6a065]/20 border-t-[#c6a065] animate-spin" />
      </div>
    );
  }

  if (!company) {
    return (
      <div className="min-h-screen bg-[#faf9f7] flex items-center justify-center">
        <div className="text-center">
          <h1 className="font-serif text-2xl text-[#2c2c2c] mb-4">{loadError || 'Company not found'}</h1>
          <Link to="/companies" className="text-[#c6a065] hover:underline">
            Back to companies
          </Link>
        </div>
      </div>
    );
  }

  const images = company.projectImages;
  const activeIndex = getNextRenderableImageIndex(images, imgIndex, failedIndices);
  const currentSrc = activeIndex === -1 ? '' : images[activeIndex];
  const hasMultiple = images.length > 1;
  const instagramHref = company.instagram || '';
  const instagramLabel = instagramHref
    ? instagramHref.replace(/^https?:\/\/(www\.)?instagram\.com\//, '').replace(/\/$/, '')
    : '';

  const handleImageError = () => {
    if (activeIndex === -1) return;
    const nextFailed = [...failedIndices, activeIndex];
    setFailedIndices(nextFailed);
    const nextIndex = getNextRenderableImageIndex(images, activeIndex + 1, nextFailed);
    if (nextIndex !== -1) setImgIndex(nextIndex);
  };

  const goNext = () => {
    const nextIndex = getNextRenderableImageIndex(images, activeIndex + 1, failedIndices);
    if (nextIndex !== -1) setImgIndex(nextIndex);
  };

  const goPrev = () => {
    const newIndex = activeIndex - 1;
    if (newIndex >= 0 && !failedIndices.includes(newIndex)) {
      setImgIndex(newIndex);
      return;
    }

    for (let index = images.length - 1; index >= 0; index -= 1) {
      if (index !== activeIndex && !failedIndices.includes(index)) {
        setImgIndex(index);
        break;
      }
    }
  };

  const openLightbox = (index: number) => {
    setImgIndex(index);
    setLightboxOpen(true);
  };

  return (
    <div className="min-h-screen bg-white">
      {/* Minimal Top Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-md border-b border-stone-100/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <Link
            to="/companies"
            className="inline-flex items-center gap-2 text-sm text-[#6b6b6b] hover:text-[#2c2c2c] transition"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Companies
          </Link>
          <div className="flex items-center gap-3">
            {company.website && (
              <a
                href={company.website}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-sm text-[#6b6b6b] hover:text-[#c6a065] transition"
              >
                <Globe className="w-4 h-4" />
                Website
              </a>
            )}
            {company.instagram && (
              <a
                href={company.instagram}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-sm text-[#6b6b6b] hover:text-[#c6a065] transition"
              >
                <Instagram className="w-4 h-4" />
                Instagram
              </a>
            )}
          </div>
        </div>
      </nav>

      {/* Hero Section with Full-Width Image */}
      <section className="relative pt-16">
        {currentSrc && (
          <div className="relative aspect-[16/9] lg:aspect-[21/8] bg-stone-100">
            <img
              src={currentSrc}
              alt={`${company.name} portfolio`}
              className="w-full h-full object-cover"
              onError={handleImageError}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />

            {/* Image Navigation */}
            {hasMultiple && (
              <>
                <button
                  onClick={goPrev}
                  className="absolute left-4 sm:left-8 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-white/10 backdrop-blur-sm hover:bg-white/20 flex items-center justify-center border border-white/20 transition z-20"
                  aria-label="Previous image"
                >
                  <ChevronLeft className="w-6 h-6 text-white" />
                </button>
                <button
                  onClick={goNext}
                  className="absolute right-4 sm:right-8 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-white/10 backdrop-blur-sm hover:bg-white/20 flex items-center justify-center border border-white/20 transition z-20"
                  aria-label="Next image"
                >
                  <ChevronRight className="w-6 h-6 text-white" />
                </button>
                <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-2 z-20">
                  {images.map((_, index) => (
                    <button
                      key={index}
                      onClick={() => setImgIndex(index)}
                      className={`w-2 h-2 rounded-full transition-all ${
                        index === activeIndex ? 'bg-white w-8' : 'bg-white/50 hover:bg-white/80'
                      }`}
                      aria-label={`Go to image ${index + 1}`}
                    />
                  ))}
                </div>
              </>
            )}

            {/* Company Info Overlay */}
            <div className="absolute bottom-0 left-0 right-0 p-6 sm:p-12 lg:p-16 text-white">
              <div className="max-w-7xl mx-auto">
                <div className="flex flex-wrap gap-2 mb-4">
                  {company.styles.slice(0, 3).map((style) => (
                    <span
                      key={style}
                      className="px-4 py-1.5 bg-white/10 backdrop-blur-sm rounded-full text-sm font-medium border border-white/20"
                    >
                      {style}
                    </span>
                  ))}
                </div>
                <h1 className="font-serif text-4xl sm:text-5xl lg:text-6xl font-semibold mb-4 tracking-tight">
                  {company.name}
                </h1>
                <p className="text-white/90 text-lg sm:text-xl max-w-2xl leading-relaxed">
                  {company.shortDescription}
                </p>
              </div>
            </div>
          </div>
        )}
      </section>

      {/* Key Stats Bar */}
      <section className="bg-[#1c1917] text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 sm:gap-8">
            <div className="text-center">
              <div className="font-serif text-3xl sm:text-4xl font-semibold text-[#c6a065] mb-1">
                {company.projectCount}+
              </div>
              <div className="text-sm text-white/60">Projects Completed</div>
            </div>
            <div className="text-center">
              <div className="font-serif text-3xl sm:text-4xl font-semibold text-[#c6a065] mb-1">
                {2026 - company.foundedYear}
              </div>
              <div className="text-sm text-white/60">Years Experience</div>
            </div>
            <div className="text-center">
              <div className="font-serif text-3xl sm:text-4xl font-semibold text-[#c6a065] mb-1">
                {company.services.length}
              </div>
              <div className="text-sm text-white/60">Services Offered</div>
            </div>
            <div className="text-center">
              <div className="font-serif text-3xl sm:text-4xl font-semibold text-[#c6a065] mb-1">
                {company.city}
              </div>
              <div className="text-sm text-white/60">Based In</div>
            </div>
          </div>
        </div>
      </section>

      {/* Main Content */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 py-16 lg:py-24">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-12 lg:gap-16">
          {/* Left Content */}
          <div className="lg:col-span-2 space-y-16">
            {/* About Section */}
            <div>
              <h2 className="font-serif text-3xl text-[#1c1917] font-semibold mb-6">About</h2>
              <p className="text-[#44403c] leading-relaxed text-lg">
                {company.description}
              </p>
            </div>

            {/* Services Section */}
            <div>
              <h2 className="font-serif text-3xl text-[#1c1917] font-semibold mb-6">Services</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {company.services.map((service) => (
                  <div
                    key={service}
                    className="flex items-center gap-4 p-4 bg-stone-50 rounded-lg border border-stone-100"
                  >
                    <div className="w-10 h-10 rounded-full bg-[#c6a065]/10 flex items-center justify-center flex-shrink-0">
                      <Briefcase className="w-5 h-5 text-[#c6a065]" />
                    </div>
                    <span className="font-medium text-[#1c1917]">{service}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Portfolio Gallery */}
            <div>
              <div className="flex items-center justify-between mb-6">
                <h2 className="font-serif text-3xl text-[#1c1917] font-semibold">Featured Projects</h2>
                <span className="text-sm text-[#6b6b6b]">{images.length} projects</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {images.map((image, index) => (
                  <button
                    key={index}
                    onClick={() => openLightbox(index)}
                    className="group relative aspect-[4/3] rounded-xl overflow-hidden bg-stone-100"
                  >
                    <img
                      src={image}
                      alt={`Project ${index + 1}`}
                      className="w-full h-full object-cover group-hover:scale-105 transition duration-500"
                    />
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition duration-300 flex items-center justify-center">
                      <ExternalLink className="w-8 h-8 text-white opacity-0 group-hover:opacity-100 transition" />
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Right Sidebar - Contact */}
          <div className="lg:col-span-1">
            <div className="lg:sticky lg:top-24">
              <div className="bg-[#faf9f7] rounded-2xl p-8 border border-stone-100">
                <h3 className="font-serif text-2xl text-[#1c1917] font-semibold mb-6">Get in Touch</h3>

                <div className="space-y-6">
                  {company.address && (
                    <div className="flex items-start gap-4">
                      <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center flex-shrink-0 shadow-sm">
                        <MapPin className="w-5 h-5 text-[#c6a065]" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-[#1c1917] mb-1">Address</p>
                        <p className="text-sm text-[#6b6b6b] leading-relaxed">{company.address}</p>
                      </div>
                    </div>
                  )}

                  {company.phone && (
                    <div className="flex items-start gap-4">
                      <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center flex-shrink-0 shadow-sm">
                        <Phone className="w-5 h-5 text-[#c6a065]" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-[#1c1917] mb-1">Phone</p>
                        <a
                          href={`tel:${company.phone}`}
                          className="text-sm text-[#c6a065] hover:underline"
                        >
                          {company.phone}
                        </a>
                      </div>
                    </div>
                  )}

                  {company.email && (
                    <div className="flex items-start gap-4">
                      <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center flex-shrink-0 shadow-sm">
                        <Mail className="w-5 h-5 text-[#c6a065]" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-[#1c1917] mb-1">Email</p>
                        <a
                          href={`mailto:${company.email}`}
                          className="text-sm text-[#c6a065] hover:underline break-all"
                        >
                          {company.email}
                        </a>
                      </div>
                    </div>
                  )}

                  {company.website && (
                    <div className="flex items-start gap-4">
                      <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center flex-shrink-0 shadow-sm">
                        <Globe className="w-5 h-5 text-[#c6a065]" />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium text-[#1c1917] mb-1">Website</p>
                        <a
                          href={company.website}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-[#c6a065] hover:underline flex items-center gap-1"
                        >
                          Visit site
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                    </div>
                  )}

                  {company.instagram && (
                    <div className="flex items-start gap-4">
                      <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center flex-shrink-0 shadow-sm">
                        <Instagram className="w-5 h-5 text-[#c6a065]" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-[#1c1917] mb-1">Instagram</p>
                        <a
                          href={company.instagram}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-[#c6a065] hover:underline"
                        >
                          {instagramLabel ? `@${instagramLabel}` : 'Follow us'}
                        </a>
                      </div>
                    </div>
                  )}
                </div>

                {/* CTA Button */}
                <div className="mt-8 pt-8 border-t border-stone-200">
                  {company.phone && (
                    <a
                      href={`tel:${company.phone}`}
                      className="w-full py-4 rounded-xl bg-[#1c1917] text-white font-medium hover:bg-[#c6a065] transition flex items-center justify-center gap-2"
                    >
                      <Phone className="w-5 h-5" />
                      Request Consultation
                    </a>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Lightbox */}
      {lightboxOpen && currentSrc && (
        <div
          className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center"
          onClick={() => setLightboxOpen(false)}
        >
          <button
            onClick={() => setLightboxOpen(false)}
            className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition"
          >
            <X className="w-6 h-6 text-white" />
          </button>

          <button
            onClick={(e) => {
              e.stopPropagation();
              goPrev();
            }}
            className="absolute left-4 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition"
          >
            <ChevronLeft className="w-6 h-6 text-white" />
          </button>

          <button
            onClick={(e) => {
              e.stopPropagation();
              goNext();
            }}
            className="absolute right-4 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition"
          >
            <ChevronRight className="w-6 h-6 text-white" />
          </button>

          <img
            src={currentSrc}
            alt={`${company.name} project`}
            className="max-w-[90vw] max-h-[90vh] object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}
