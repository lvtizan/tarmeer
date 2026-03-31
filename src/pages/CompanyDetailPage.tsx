import { useEffect, useState, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ArrowLeft, Globe, Instagram, MapPin, Briefcase, ExternalLink,
  Calendar, FolderOpen,
} from 'lucide-react';
import type { Company, PortfolioItem } from '../lib/companyData';
import { fetchPublicCompanyDetail } from '../lib/publicApi';
import MasonryGallery from '../components/MasonryGallery';
import Lightbox from '../components/Lightbox';
import InquiryForm from '../components/InquiryForm';

export default function CompanyDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [company, setCompany] = useState<Company | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxCategory, setLightboxCategory] = useState('');
  const [lightboxIndex, setLightboxIndex] = useState(0);

  useEffect(() => {
    if (!id) {
      setLoadError('Company not found');
      setLoading(false);
      return;
    }

    let active = true;
    setLoading(true);
    setLoadError('');

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

  const handleImageClick = useCallback(
    (_url: string, categoryName: string, indexInCategory: number) => {
      setLightboxCategory(categoryName);
      setLightboxIndex(indexInCategory);
      setLightboxOpen(true);
    },
    []
  );

  const handleLightboxNavigate = useCallback((index: number) => {
    setLightboxIndex(index);
  }, []);

  const handleLightboxClose = useCallback(() => {
    setLightboxOpen(false);
  }, []);

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
          <Link to="/companies" className="text-[#c6a065] hover:underline">
            Back to companies
          </Link>
        </div>
      </div>
    );
  }

  const heroImage = company.projectImages[0] || company.coverImage;
  const instagramHref = company.instagram || '';
  const instagramLabel = instagramHref
    ? instagramHref.replace(/^https?:\/\/(www\.)?instagram\.com\//, '').replace(/\/$/, '')
    : '';
  const yearsExp = 2026 - company.foundedYear;

  const lightboxImages: PortfolioItem[] =
    company.portfolioCategories[lightboxCategory] ?? [];

  return (
    <div className="min-h-screen bg-[#faf9f7]">
      {/* Hero - Cover Image */}
      <section className="relative">
        <div className="relative h-[280px] sm:h-[380px] overflow-hidden">
          <Link to="/companies"
            className="absolute top-4 left-4 z-10 inline-flex items-center gap-2 px-3 py-1.5 bg-black/30 hover:bg-black/50 text-white text-sm rounded-full backdrop-blur-sm transition">
            <ArrowLeft className="w-4 h-4" /> Companies
          </Link>
          {heroImage ? (
            <img src={heroImage} alt={company.name} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-stone-300 to-stone-400" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />
        </div>
      </section>

      {/* Main Content - Left/Right Layout */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 -mt-16 relative z-10 pb-10">
        <div className="flex flex-col lg:flex-row gap-8">

          {/* Left Column - Company Info */}
          <div className="flex-1 min-w-0 space-y-6">
            {/* Company Header Card */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
              className="bg-white rounded-2xl shadow-lg p-6 sm:p-8"
            >
              <div className="flex flex-wrap gap-2 mb-3">
                {company.styles.slice(0, 3).map((style) => (
                  <span key={style} className="px-3 py-1 bg-[#c6a065]/10 text-[#c6a065] rounded-full text-xs font-medium">
                    {style}
                  </span>
                ))}
              </div>
              <h1 className="font-serif text-2xl sm:text-3xl font-semibold text-[#1c1917] mb-2">
                {company.name}
              </h1>
              <p className="text-[#6b6b6b] leading-relaxed">
                {company.shortDescription}
              </p>

              {/* Stats Row */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6 pt-6 border-t border-stone-100">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-[#c6a065]/10 flex items-center justify-center">
                    <FolderOpen className="w-4 h-4 text-[#c6a065]" />
                  </div>
                  <div>
                    <div className="text-lg font-semibold text-[#1c1917]">{company.projectCount}+</div>
                    <div className="text-xs text-[#6b6b6b]">Projects</div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-[#c6a065]/10 flex items-center justify-center">
                    <Calendar className="w-4 h-4 text-[#c6a065]" />
                  </div>
                  <div>
                    <div className="text-lg font-semibold text-[#1c1917]">{yearsExp}</div>
                    <div className="text-xs text-[#6b6b6b]">Years Exp.</div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-[#c6a065]/10 flex items-center justify-center">
                    <Briefcase className="w-4 h-4 text-[#c6a065]" />
                  </div>
                  <div>
                    <div className="text-lg font-semibold text-[#1c1917]">{company.services.length}</div>
                    <div className="text-xs text-[#6b6b6b]">Services</div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-[#c6a065]/10 flex items-center justify-center">
                    <MapPin className="w-4 h-4 text-[#c6a065]" />
                  </div>
                  <div>
                    <div className="text-lg font-semibold text-[#1c1917]">{company.city}</div>
                    <div className="text-xs text-[#6b6b6b]">Location</div>
                  </div>
                </div>
              </div>
            </motion.div>

            {/* About + Services */}
            <div className="bg-white rounded-2xl p-6 sm:p-8 border border-stone-100">
              {company.description && (
                <>
                  <h2 className="font-serif text-xl font-semibold text-[#1c1917] mb-4">About</h2>
                  <p className="text-[#44403c] leading-relaxed mb-6">{company.description}</p>
                </>
              )}
              <h2 className="font-serif text-xl font-semibold text-[#1c1917] mb-4">Services</h2>
              <div className="flex flex-wrap gap-2">
                {company.services.map((service) => (
                  <span key={service} className="inline-flex items-center gap-2 px-4 py-2 bg-stone-50 rounded-lg text-sm text-[#1c1917] border border-stone-100">
                    <Briefcase className="w-3.5 h-3.5 text-[#c6a065]" />
                    {service}
                  </span>
                ))}
              </div>
            </div>

            {/* Links Card */}
            {(company.website || company.instagram || company.address) && (
              <div className="bg-white rounded-2xl p-6 sm:p-8 border border-stone-100">
                <h2 className="font-serif text-xl font-semibold text-[#1c1917] mb-4">Contact</h2>
                <div className="space-y-4">
                  {company.website && (
                    <div className="flex items-center gap-3">
                      <Globe className="w-4 h-4 text-[#c6a065] flex-shrink-0" />
                      <a href={company.website} target="_blank" rel="noopener noreferrer"
                        className="text-sm text-[#c6a065] hover:underline flex items-center gap-1">
                        Visit website <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                  )}
                  {company.instagram && (
                    <div className="flex items-center gap-3">
                      <Instagram className="w-4 h-4 text-[#c6a065] flex-shrink-0" />
                      <a href={company.instagram} target="_blank" rel="noopener noreferrer"
                        className="text-sm text-[#c6a065] hover:underline">
                        {instagramLabel ? `@${instagramLabel}` : 'Follow us'}
                      </a>
                    </div>
                  )}
                  {company.address && (
                    <div className="flex items-start gap-3">
                      <MapPin className="w-4 h-4 text-[#c6a065] mt-0.5 flex-shrink-0" />
                      <p className="text-sm text-[#44403c] leading-relaxed">{company.address}</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Right Column - Sticky Inquiry Form */}
          <div className="w-full lg:w-[340px] flex-shrink-0">
            <div className="lg:sticky lg:top-20">
              <InquiryForm companyId={company.id} recipientName={company.name} />
            </div>
          </div>
        </div>
      </section>

      {/* Portfolio - Full Width */}
      <MasonryGallery
        categories={company.portfolioCategories}
        onImageClick={handleImageClick}
      />

      <Lightbox
        open={lightboxOpen}
        images={lightboxImages}
        currentIndex={lightboxIndex}
        categoryName={lightboxCategory}
        onClose={handleLightboxClose}
        onNavigate={handleLightboxNavigate}
      />

      {/* Footer */}
      <section className="border-t border-stone-200 bg-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 text-center">
          <Link to="/companies"
            className="inline-flex items-center gap-2 text-sm text-[#6b6b6b] hover:text-[#c6a065] transition">
            <ArrowLeft className="w-4 h-4" /> Back to Companies
          </Link>
        </div>
      </section>
    </div>
  );
}
