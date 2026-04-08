import { useEffect, useMemo, useState } from 'react';
import { X, MapPin, Check, Phone, Globe, ClipboardList, Users, Handshake, Mail } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { Company } from '../lib/companyData';
import { fetchPublicCompanies } from '../lib/publicApi';
import { getImageFallbackCandidates, getNextRenderableImageIndex } from '../lib/imageCleanup';
import { resolveImageUrl } from '../lib/imageUrl';

function ActiveFilterChip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-stone-100 rounded-full text-sm text-[#1c1917]">
      {label}
      <button onClick={onRemove} className="hover:bg-stone-200 rounded-full p-0.5 transition">
        <X className="w-3 h-3" />
      </button>
    </span>
  );
}

function FilterOption({
  selected,
  onClick,
  children,
}: {
  selected: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full text-left px-4 py-2.5 rounded-lg text-sm transition-all duration-200 ${
        selected
          ? 'bg-[#f5f0e8] border border-[#d4c4a8] text-[#1c1917]'
          : 'text-stone-500 hover:bg-stone-50'
      }`}
    >
      <div className="flex items-center gap-3">
        <div className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 ${
          selected ? 'border-[#b8860b] bg-white' : 'border-stone-300'
        }`}>
          {selected && <Check className="w-3 h-3 text-[#b8860b]" strokeWidth={3} />}
        </div>
        {children}
      </div>
    </button>
  );
}

// List Card - Project First
function CompanyCard({ company, onClick }: { company: Company; onClick: () => void }) {
  const [imgIndex, setImgIndex] = useState(0);
  const [imgRetryIndex, setImgRetryIndex] = useState(0);
  const [failedIndices, setFailedIndices] = useState<number[]>([]);
  const images = company.projectImages;
  const activeIndex = getNextRenderableImageIndex(images, imgIndex, failedIndices);
  const currentSrc = activeIndex === -1 ? '' : resolveImageUrl(images[activeIndex]);
  const currentCandidates = getImageFallbackCandidates(currentSrc);
  const displaySrc = currentCandidates[imgRetryIndex] || currentSrc;

  useEffect(() => {
    setImgRetryIndex(0);
  }, [activeIndex]);

  const skipToNext = () => {
    if (activeIndex === -1) return;
    const nextFailed = [...failedIndices, activeIndex];
    setFailedIndices(nextFailed);
    const nextIndex = getNextRenderableImageIndex(images, activeIndex + 1, nextFailed);
    if (nextIndex !== -1) setImgIndex(nextIndex);
  };

  const handleImageError = () => {
    if (imgRetryIndex < currentCandidates.length - 1) {
      setImgRetryIndex((prev) => prev + 1);
      return;
    }
    skipToNext();
  };

  // Skip small/low-quality/banner images after they load
  const handleImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    const w = img.naturalWidth;
    const h = img.naturalHeight;
    const ratio = w / h;
    if (w < 200 || h < 150 || ratio > 3.5 || ratio < 0.25) {
      skipToNext();
    }
  };

  return (
    <div
      onClick={onClick}
      className="group flex border-b border-stone-200/60 hover:bg-[#faf8f5] transition-colors duration-150 cursor-pointer py-5 gap-5"
    >
      {/* Left - Project Image */}
      <div className="w-[316px] h-[200px] flex-shrink-0 overflow-hidden bg-stone-100">
        {currentSrc ? (
          <img
            src={displaySrc}
            alt={`${company.name} project`}
            className="w-full h-full object-cover group-hover:brightness-95 transition duration-300"
            onError={handleImageError}
            onLoad={handleImageLoad}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-stone-50 to-stone-100">
            <span className="font-serif text-4xl text-stone-200">{company.name.charAt(0)}</span>
          </div>
        )}
      </div>

      {/* Right - Company Info */}
      <div className="flex-1 min-w-0 flex flex-col justify-between">
        <div>
          <div className="flex items-center gap-2.5 mb-1">
            {company.coverImage && company.coverImage.includes('/logos/') && (
              <img src={resolveImageUrl(company.coverImage)} alt="" className="w-6 h-6 rounded object-contain bg-white flex-shrink-0"
                onError={(e) => { e.currentTarget.style.display = 'none'; }} />
            )}
            <h3 className="font-semibold text-[17px] text-[#1c1917] group-hover:text-[#b8860b] transition-colors truncate">
              {company.name}
            </h3>
          </div>

          {/* Rating + Reviews placeholder */}
          <div className="flex items-center gap-2 mb-2 text-sm">
            <span className="text-[#b8860b] font-medium">{company.projectCount}+ projects</span>
            <span className="text-stone-300">&middot;</span>
            <span className="text-stone-400">{company.city}, UAE</span>
            <span className="text-stone-300">&middot;</span>
            <span className="text-stone-400">Since {company.foundedYear}</span>
          </div>

          <p className="text-stone-500 text-[13px] leading-relaxed line-clamp-2 mb-2.5">
            {company.shortDescription}
          </p>

          {/* Services / Styles */}
          <div className="flex flex-wrap gap-1.5">
            {company.services.slice(0, 4).map((svc) => (
              <span key={svc} className="px-2.5 py-0.5 text-[11px] text-stone-500 border border-stone-200 rounded">
                {svc}
              </span>
            ))}
          </div>
        </div>

        {/* Bottom row: contact hints */}
        <div className="flex items-center gap-4 mt-3 text-xs text-stone-400">
          {company.phone && (
            <span className="flex items-center gap-1">
              <Phone className="w-3 h-3" /> {company.phone}
            </span>
          )}
          {company.website && (
            <span className="flex items-center gap-1">
              <Globe className="w-3 h-3" /> Website
            </span>
          )}
        </div>

        {/* Mobile: Send Message & Location (stacked below on small screens) */}
        <div className="flex sm:hidden items-center gap-3 mt-3 pt-3 border-t border-stone-100">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onClick();
            }}
            className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-[#b8860b] text-[#b8860b] font-semibold text-xs whitespace-nowrap hover:bg-[#b8860b] hover:text-white transition-colors duration-200"
          >
            <Mail className="w-3.5 h-3.5" />
            Send Message
          </button>
          <span className="flex items-center gap-1 text-xs text-stone-400">
            <MapPin className="w-3 h-3 flex-shrink-0" />
            {company.city}, UAE
          </span>
        </div>
      </div>

      {/* Right - Send Message & Location (Houzz-style) */}
      <div className="hidden sm:flex flex-col items-center justify-center flex-shrink-0 w-[160px] pl-4 border-l border-stone-100">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onClick();
          }}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border border-[#b8860b] text-[#b8860b] font-semibold text-sm whitespace-nowrap hover:bg-[#b8860b] hover:text-white transition-colors duration-200"
        >
          <Mail className="w-4 h-4" />
          Send Message
        </button>
        <div className="mt-3 flex items-start gap-1.5 text-xs text-stone-400 text-center leading-snug">
          <MapPin className="w-3.5 h-3.5 flex-shrink-0 mt-0.5 text-stone-400" />
          <span>
            {company.projectCount}+ projects in the {company.city} area
          </span>
        </div>
      </div>
    </div>
  );
}

// Hover Preview Popup - Landscape
export default function CompaniesPage() {
  const navigate = useNavigate();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCity, setSelectedCity] = useState<string>('');
  const [selectedStyles, setSelectedStyles] = useState<string[]>([]);
  const [selectedServices, setSelectedServices] = useState<string[]>([]);
  const [foundedRange, setFoundedRange] = useState<string>('');

  useEffect(() => {
    let active = true;
    fetchPublicCompanies(100)
      .then((items) => {
        if (!active) return;
        setCompanies(items);
      })
      .catch((error) => {
        if (!active) return;
        setLoadError(error instanceof Error ? error.message : 'Failed to load companies');
      })
      .finally(() => {
        if (!active) return;
        setLoading(false);
      });
    return () => { active = false; };
  }, []);

  const cityOptions = useMemo(
    () => [...new Set(companies.map((c) => c.city).filter(Boolean))].sort(),
    [companies]
  );
  const styleOptions = useMemo(
    () => [...new Set(companies.flatMap((c) => c.styles).filter(Boolean))].sort(),
    [companies]
  );
  const serviceOptions = useMemo(
    () => [...new Set(companies.flatMap((c) => c.services).filter(Boolean))].sort(),
    [companies]
  );

  const filteredCompanies = useMemo(() => {
    return companies.filter((company) => {
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        if (
          !company.name.toLowerCase().includes(q) &&
          !company.description.toLowerCase().includes(q) &&
          !company.city.toLowerCase().includes(q)
        ) return false;
      }
      if (selectedCity && company.city !== selectedCity) return false;
      if (selectedStyles.length > 0 && !selectedStyles.some((s) => company.styles.includes(s))) return false;
      if (selectedServices.length > 0 && !selectedServices.some((s) => company.services.includes(s))) return false;
      if (foundedRange) {
        const [min, max] = foundedRange.split('-').map(Number);
        if (max) {
          if (company.foundedYear < min || company.foundedYear > max) return false;
        } else if (company.foundedYear < min) return false;
      }
      return true;
    });
  }, [companies, searchQuery, selectedCity, selectedStyles, selectedServices, foundedRange]);

  const clearAllFilters = () => {
    setSearchQuery('');
    setSelectedCity('');
    setSelectedStyles([]);
    setSelectedServices([]);
    setFoundedRange('');
  };

  const hasActiveFilters = useMemo(() => {
    return searchQuery || selectedCity || selectedStyles.length > 0 || selectedServices.length > 0 || foundedRange;
  }, [searchQuery, selectedCity, selectedStyles, selectedServices, foundedRange]);

  const getFoundedLabel = (range: string) => {
    const labels: Record<string, string> = {
      '2015-2026': '10+ years',
      '2010-2014': '15+ years',
      '2000-2009': '25+ years',
    };
    return labels[range] || range;
  };

  return (
    <div className="min-h-screen bg-[#faf9f7]">
      {/* Hero - Match with Professionals */}
      <section className="relative bg-[#2c2620] overflow-hidden">
        {/* Subtle pattern overlay */}
        <div className="absolute inset-0 opacity-[0.04] [background-image:radial-gradient(circle_at_1px_1px,rgba(255,255,255,0.8)_1px,transparent_0)] [background-size:32px_32px]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_0%,rgba(184,134,74,0.12),transparent_70%)]" />
        <div className="relative max-w-4xl mx-auto px-4 sm:px-6 py-12 sm:py-16 text-center">
          <h1 className="font-serif text-[28px] sm:text-[36px] text-white font-medium leading-tight mb-10">
            Find the Right Design & Renovation Pro in UAE
          </h1>

          {/* 3-Step Flow */}
          <div className="flex items-center justify-center gap-0 mb-10">
            {[
              { icon: ClipboardList, label: 'Tell us about your project' },
              { icon: Users, label: 'Get matched with local professionals' },
              { icon: Handshake, label: 'Hire the right pro with confidence' },
            ].map((step, i) => (
              <div key={i} className="flex items-center">
                {i > 0 && <div className="w-16 sm:w-24 h-px bg-white/25" />}
                <div className="flex flex-col items-center gap-2.5">
                  <div className="w-12 h-12 rounded-full border border-white/30 flex items-center justify-center">
                    <step.icon className="w-5 h-5 text-white/80" />
                  </div>
                  <p className="text-white/70 text-xs sm:text-sm leading-snug text-center max-w-[140px]">
                    {step.label}
                  </p>
                </div>
              </div>
            ))}
          </div>

          {/* Search Bar */}
          <div className="max-w-md mx-auto flex gap-0">
            <div className="relative flex-1">
              <MapPin className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
              <input
                type="text"
                placeholder="Search by city or company name"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full h-12 pl-10 pr-4 bg-white rounded-l-lg text-sm text-[#1c1917] placeholder:text-stone-400 focus:outline-none"
              />
            </div>
            <button className="h-12 px-6 bg-[#b8864a] hover:bg-[#a67c47] text-white text-sm font-semibold rounded-r-lg transition whitespace-nowrap">
              Get Started
            </button>
          </div>

        </div>
      </section>

      {/* Active Filters */}
      {hasActiveFilters && (
        <div className="bg-white border-b border-stone-100">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium text-[#1c1917]">Active Filters</span>
              <button onClick={clearAllFilters} className="text-sm text-stone-500 hover:text-[#b8860b] transition">
                Clear all
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {searchQuery && <ActiveFilterChip label={`"${searchQuery}"`} onRemove={() => setSearchQuery('')} />}
              {selectedCity && <ActiveFilterChip label={selectedCity} onRemove={() => setSelectedCity('')} />}
              {foundedRange && <ActiveFilterChip label={getFoundedLabel(foundedRange)} onRemove={() => setFoundedRange('')} />}
              {selectedStyles.map((s) => (
                <ActiveFilterChip key={s} label={s} onRemove={() => setSelectedStyles((prev) => prev.filter((v) => v !== s))} />
              ))}
              {selectedServices.map((s) => (
                <ActiveFilterChip key={s} label={s} onRemove={() => setSelectedServices((prev) => prev.filter((v) => v !== s))} />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Main Content - Two Column (Sidebar + List) */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        <div className="flex gap-8">
          {/* Left Sidebar - Filters */}
          <aside className="w-60 flex-shrink-0 hidden lg:block">
            <div className="lg:sticky lg:top-24">
              <div className="bg-white rounded-[22px] border border-stone-100 p-5 shadow-sm shadow-stone-100/50 space-y-6">
                {/* City */}
                <div>
                  <h4 className="text-xs font-medium text-[#1c1917] uppercase tracking-wider mb-3">City</h4>
                  <div className="space-y-1">
                    <FilterOption selected={!selectedCity} onClick={() => setSelectedCity('')}>All Cities</FilterOption>
                    {cityOptions.map((city) => (
                      <FilterOption key={city} selected={selectedCity === city} onClick={() => setSelectedCity(city)}>
                        {city}
                      </FilterOption>
                    ))}
                  </div>
                </div>

                <hr className="border-stone-100" />

                {/* Founded */}
                <div>
                  <h4 className="text-xs font-medium text-[#1c1917] uppercase tracking-wider mb-3">Founded</h4>
                  <div className="space-y-1">
                    <FilterOption selected={!foundedRange} onClick={() => setFoundedRange('')}>Any</FilterOption>
                    <FilterOption selected={foundedRange === '2015-2026'} onClick={() => setFoundedRange('2015-2026')}>10+ years</FilterOption>
                    <FilterOption selected={foundedRange === '2010-2014'} onClick={() => setFoundedRange('2010-2014')}>15+ years</FilterOption>
                    <FilterOption selected={foundedRange === '2000-2009'} onClick={() => setFoundedRange('2000-2009')}>25+ years</FilterOption>
                  </div>
                </div>

                <hr className="border-stone-100" />

                {/* Style */}
                <div>
                  <h4 className="text-xs font-medium text-[#1c1917] uppercase tracking-wider mb-3">Style</h4>
                  <div className="space-y-1 max-h-48 overflow-y-auto pr-1 custom-scrollbar">
                    {styleOptions.map((style) => (
                      <FilterOption
                        key={style}
                        selected={selectedStyles.includes(style)}
                        onClick={() => setSelectedStyles((prev) =>
                          prev.includes(style) ? prev.filter((v) => v !== style) : [...prev, style]
                        )}
                      >
                        {style}
                      </FilterOption>
                    ))}
                  </div>
                </div>

                <hr className="border-stone-100" />

                {/* Services */}
                <div>
                  <h4 className="text-xs font-medium text-[#1c1917] uppercase tracking-wider mb-3">Services</h4>
                  <div className="space-y-1 max-h-40 overflow-y-auto pr-1 custom-scrollbar">
                    {serviceOptions.map((service) => (
                      <FilterOption
                        key={service}
                        selected={selectedServices.includes(service)}
                        onClick={() => setSelectedServices((prev) =>
                          prev.includes(service) ? prev.filter((v) => v !== service) : [...prev, service]
                        )}
                      >
                        {service}
                      </FilterOption>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </aside>

          {/* Main - Company List (full remaining width) */}
          <div className="flex-1 min-w-0">
            {loading ? (
              <div className="text-center py-20 bg-white rounded-[22px] border border-stone-100">
                <div className="w-12 h-12 rounded-full border-4 border-stone-100 border-t-[#b8860b] animate-spin mx-auto mb-4" />
                <p className="text-stone-400">Loading designers...</p>
              </div>
            ) : loadError ? (
              <div className="text-center py-20 bg-white rounded-[22px] border border-stone-100">
                <h3 className="font-serif text-xl text-[#1c1917] mb-2">Unable to load designers</h3>
                <p className="text-stone-400">{loadError}</p>
              </div>
            ) : filteredCompanies.length > 0 ? (
              <div className="space-y-5">
                {filteredCompanies.map((company) => (
                  <div
                    key={company.id}
                    className="relative"
                  >
                    <CompanyCard
                      company={company}
                      onClick={() => navigate(`/companies/${company.id}`)}
                    />
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-20 bg-white rounded-[22px] border border-stone-100">
                <p className="text-stone-400 mb-4">No designers found matching your criteria</p>
                <button onClick={clearAllFilters} className="text-[#b8860b] hover:underline">
                  Clear filters
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Custom scrollbar + hover animation styles */}
      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #d6d3d1;
          border-radius: 2px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #a8a29e;
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateX(8px); }
          to { opacity: 1; transform: translateX(0); }
        }
        .animate-fade-in {
          animation: fadeIn 0.2s ease-out;
        }
      `}</style>
    </div>
  );
}
