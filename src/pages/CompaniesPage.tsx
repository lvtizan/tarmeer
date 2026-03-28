import { useEffect, useMemo, useState } from 'react';
import { Search, X, MapPin, Calendar, Check, Phone, Mail, Globe, ArrowRight, TrendingUp } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { Company } from '../lib/companyData';
import { fetchPublicCompanies } from '../lib/publicApi';
import { getNextRenderableImageIndex } from '../lib/imageCleanup';

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
  const [failedIndices, setFailedIndices] = useState<number[]>([]);
  const images = company.projectImages;
  const activeIndex = getNextRenderableImageIndex(images, imgIndex, failedIndices);
  const currentSrc = activeIndex === -1 ? '' : images[activeIndex];

  const handleImageError = () => {
    if (activeIndex === -1) return;
    const nextFailed = [...failedIndices, activeIndex];
    setFailedIndices(nextFailed);
    const nextIndex = getNextRenderableImageIndex(images, activeIndex + 1, nextFailed);
    if (nextIndex !== -1) setImgIndex(nextIndex);
  };

  return (
    <div
      onClick={onClick}
      className="group flex bg-white rounded-[22px] border border-stone-100 hover:border-[#d4c4a8] hover:shadow-lg hover:shadow-stone-100/50 transition-all duration-300 cursor-pointer overflow-hidden"
      style={{ minHeight: '220px' }}
    >
      {/* Left - Large Project Image */}
      <div className="w-[38%] flex-shrink-0 bg-stone-100 h-[220px]">
        {currentSrc ? (
          <img
            src={currentSrc}
            alt={`${company.name} project`}
            className="w-full h-full object-cover group-hover:scale-105 transition duration-700"
            onError={handleImageError}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-stone-50 to-stone-100">
            <span className="font-serif text-4xl text-stone-200">{company.name.charAt(0)}</span>
          </div>
        )}
      </div>

      {/* Right - Company Info */}
      <div className="flex-1 p-6 flex flex-col justify-between">
        <div>
          {/* Company Name + Logo Badge */}
          <div className="flex items-start justify-between gap-3 mb-2">
            <h3 className="font-serif text-xl font-semibold text-[#1c1917] group-hover:text-[#b8860b] transition-colors">
              {company.name}
            </h3>
            {company.coverImage && (
              <div className="w-8 h-8 rounded-lg overflow-hidden flex-shrink-0 bg-stone-50">
                <img src={company.coverImage} alt={company.name} className="w-full h-full object-cover" />
              </div>
            )}
          </div>

          {/* Tagline */}
          <p className="text-stone-500 text-sm leading-relaxed mb-3 line-clamp-2">
            {company.shortDescription}
          </p>

          {/* Style Tags */}
          <div className="flex flex-wrap gap-1.5 mb-4">
            {company.styles.slice(0, 3).map((style) => (
              <span
                key={style}
                className="px-3 py-1 bg-[#f9f7f4] text-stone-500 text-xs rounded-full border border-stone-100"
              >
                {style}
              </span>
            ))}
          </div>
        </div>

        {/* Meta Info */}
        <div className="flex items-center gap-5 text-xs text-stone-400">
          <span className="flex items-center gap-1.5">
            <MapPin className="w-3.5 h-3.5" />
            {company.city}
          </span>
          <span className="flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5" />
            Since {company.foundedYear}
          </span>
          <span className="flex items-center gap-1.5">
            <TrendingUp className="w-3.5 h-3.5" />
            {company.projectCount}+ projects
          </span>
        </div>

        {/* Arrow Indicator */}
        <ArrowRight className="w-5 h-5 text-[#b8860b] opacity-0 group-hover:opacity-100 -translate-x-2 group-hover:translate-x-0 transition-all duration-300 absolute top-6 right-6" />
      </div>
    </div>
  );
}

// Preview Card - Right Sidebar
function PreviewCard({ company, onViewProfile }: { company: Company; onViewProfile: () => void }) {
  const images = company.projectImages;
  const coverSrc = images[0] || company.coverImage || '';

  return (
    <div className="bg-white rounded-[22px] border border-stone-100 overflow-hidden shadow-sm shadow-stone-100/50">
      {/* Cover Image */}
      <div className="aspect-[4/5] bg-stone-100 relative overflow-hidden">
        {coverSrc ? (
          <img src={coverSrc} alt={company.name} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-stone-50 to-stone-100">
            <span className="font-serif text-5xl text-stone-200">{company.name.charAt(0)}</span>
          </div>
        )}
      </div>

      {/* Info */}
      <div className="p-5">
        <h4 className="font-serif text-lg font-semibold text-[#1c1917] mb-2">{company.name}</h4>
        <p className="text-stone-500 text-sm leading-relaxed mb-4 line-clamp-2">
          {company.shortDescription}
        </p>

        {/* Contact Info */}
        <div className="space-y-3 mb-5">
          <div className="flex items-center gap-3 text-sm">
            <MapPin className="w-4 h-4 text-stone-400" />
            <span className="text-[#1c1917]">{company.city}, UAE</span>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <Calendar className="w-4 h-4 text-stone-400" />
            <span className="text-[#1c1917]">Since {company.foundedYear}</span>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <TrendingUp className="w-4 h-4 text-stone-400" />
            <span className="text-[#1c1917]">{company.projectCount}+ projects</span>
          </div>
        </div>

        {/* Quick Links */}
        <div className="space-y-2 mb-5">
          {company.website && (
            <a
              href={company.website}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-sm text-stone-500 hover:text-[#b8860b] transition"
            >
              <Globe className="w-4 h-4" />
              Website
            </a>
          )}
          {company.phone && (
            <a
              href={`tel:${company.phone}`}
              className="flex items-center gap-2 text-sm text-stone-500 hover:text-[#b8860b] transition"
            >
              <Phone className="w-4 h-4" />
              {company.phone}
            </a>
          )}
          {company.email && (
            <a
              href={`mailto:${company.email}`}
              className="flex items-center gap-2 text-sm text-stone-500 hover:text-[#b8860b] transition"
            >
              <Mail className="w-4 h-4" />
              Email
            </a>
          )}
        </div>

        {/* CTA */}
        <button
          onClick={onViewProfile}
          className="w-full py-3 rounded-xl bg-[#1c1917] text-white font-medium hover:bg-[#b8860b] transition flex items-center justify-center gap-2"
        >
          View Full Profile
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

type HeroVariant = 'centered' | 'split';

function HeroSearch({
  searchQuery,
  setSearchQuery,
}: {
  searchQuery: string;
  setSearchQuery: (value: string) => void;
}) {
  return (
    <div className="relative">
      <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-white/40" />
      <input
        type="text"
        placeholder="Search by studio, style, or city"
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        className="w-full pl-11 pr-10 h-12 bg-white/[0.03] border border-white/18 rounded-full text-[15px] text-white placeholder:text-white/35 focus:outline-none focus:border-[#b49a6b]/55 focus:bg-white/[0.05] transition"
      />
      {searchQuery && (
        <button
          onClick={() => setSearchQuery('')}
          className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-white/50 hover:text-white hover:bg-white/10 rounded-full transition"
          aria-label="Clear search"
        >
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}

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
  const [hoveredCompany, setHoveredCompany] = useState<string | null>(null);
  const [heroVariant, setHeroVariant] = useState<HeroVariant>('split');

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
        if (!company.name.toLowerCase().includes(q) && !company.description.toLowerCase().includes(q)) return false;
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

  const previewCompany = hoveredCompany
    ? filteredCompanies.find((c) => c.id === hoveredCompany) || null
    : (filteredCompanies[0] || null);

  const citiesCovered = cityOptions.length;
  const totalProjects = companies.reduce((sum, c) => sum + c.projectCount, 0);
  const verifiedProjects = Math.max(30, totalProjects);
  const heroImageSrc = useMemo(
    () => companies.find((c) => c.projectImages[0] || c.coverImage)?.projectImages[0]
      || companies.find((c) => c.projectImages[0] || c.coverImage)?.coverImage
      || '',
    [companies]
  );

  return (
    <div className="min-h-screen bg-[#faf9f7]">
      <section className="relative overflow-hidden bg-[#11110f]">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_52%_18%,rgba(180,150,96,0.13),transparent_48%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(8,8,8,0.35)_0%,rgba(8,8,8,0.64)_100%)]" />
        <div className="absolute inset-0 opacity-[0.08] [background-image:linear-gradient(rgba(255,255,255,0.06)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.06)_1px,transparent_1px)] [background-size:44px_44px]" />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 py-16 sm:py-20">
          <div className="flex justify-end mb-6">
            <div className="inline-flex border border-white/15 rounded-full p-1 bg-black/25 backdrop-blur-sm">
              <button
                onClick={() => setHeroVariant('centered')}
                className={`px-4 py-1.5 text-xs tracking-[0.12em] uppercase rounded-full transition ${
                  heroVariant === 'centered' ? 'bg-white text-[#131310]' : 'text-white/70 hover:text-white'
                }`}
              >
                A Centered
              </button>
              <button
                onClick={() => setHeroVariant('split')}
                className={`px-4 py-1.5 text-xs tracking-[0.12em] uppercase rounded-full transition ${
                  heroVariant === 'split' ? 'bg-white text-[#131310]' : 'text-white/70 hover:text-white'
                }`}
              >
                B Split
              </button>
            </div>
          </div>

          {heroVariant === 'centered' ? (
            <div className="max-w-4xl mx-auto text-center">
              <div className="inline-flex items-center px-3.5 py-1 border border-white/20 rounded-full text-[11px] tracking-[0.18em] uppercase text-white/70 mb-7">
                UAE Interior Directory
              </div>
              <h1 className="font-serif text-[38px] sm:text-[56px] lg:text-[64px] text-white font-medium leading-[1.04] tracking-[-0.02em] max-w-[880px] mx-auto">
                Curated Interior Design Studios
                <br />
                Across the Emirates
              </h1>
              <p className="text-white/62 text-[15px] sm:text-[17px] leading-relaxed max-w-[560px] mx-auto mt-6">
                A refined directory for discerning homeowners seeking vetted design partners across Dubai and Abu Dhabi.
              </p>
              <div className="max-w-[560px] mx-auto mt-9">
                <HeroSearch searchQuery={searchQuery} setSearchQuery={setSearchQuery} />
              </div>
              <div className="mt-12 grid grid-cols-1 sm:grid-cols-3 border border-white/14 rounded-2xl overflow-hidden bg-white/[0.02]">
                <div className="px-6 py-5 border-b sm:border-b-0 sm:border-r border-white/10 text-center">
                  <p className="text-white text-2xl font-semibold leading-none">{companies.length || 26}</p>
                  <p className="text-[11px] tracking-[0.12em] uppercase text-white/52 mt-2">Curated Designers</p>
                </div>
                <div className="px-6 py-5 border-b sm:border-b-0 sm:border-r border-white/10 text-center">
                  <p className="text-white text-2xl font-semibold leading-none">{citiesCovered || 2}</p>
                  <p className="text-[11px] tracking-[0.12em] uppercase text-white/52 mt-2">Cities Covered</p>
                </div>
                <div className="px-6 py-5 text-center">
                  <p className="text-white text-2xl font-semibold leading-none">{verifiedProjects}+</p>
                  <p className="text-[11px] tracking-[0.12em] uppercase text-white/52 mt-2">Verified Projects</p>
                </div>
              </div>
            </div>
          ) : (
            <div className="grid lg:grid-cols-[1.08fr_0.92fr] gap-10 lg:gap-12 items-end">
              <div className="pt-2">
                <div className="inline-flex items-center px-3.5 py-1 border border-white/20 rounded-full text-[11px] tracking-[0.18em] uppercase text-white/70 mb-7">
                  UAE Interior Directory
                </div>
                <h1 className="font-serif text-[38px] sm:text-[54px] lg:text-[62px] text-white font-medium leading-[1.03] tracking-[-0.02em] max-w-[760px]">
                  Private Access to
                  <br />
                  Premium Interior Studios
                </h1>
                <p className="text-white/62 text-[15px] sm:text-[17px] leading-relaxed max-w-[540px] mt-6">
                  Explore an editorial-grade shortlist of established UAE design firms with verified project history and clear specialization.
                </p>
                <div className="max-w-[560px] mt-9">
                  <HeroSearch searchQuery={searchQuery} setSearchQuery={setSearchQuery} />
                </div>
                <div className="mt-10 grid grid-cols-3 border border-white/14 rounded-2xl overflow-hidden bg-white/[0.02] max-w-[640px]">
                  <div className="px-4 sm:px-6 py-5 border-r border-white/10">
                    <p className="text-white text-2xl font-semibold leading-none">{companies.length || 26}</p>
                    <p className="text-[11px] tracking-[0.1em] uppercase text-white/50 mt-2">Curated Designers</p>
                  </div>
                  <div className="px-4 sm:px-6 py-5 border-r border-white/10">
                    <p className="text-white text-2xl font-semibold leading-none">{citiesCovered || 2}</p>
                    <p className="text-[11px] tracking-[0.1em] uppercase text-white/50 mt-2">Cities Covered</p>
                  </div>
                  <div className="px-4 sm:px-6 py-5">
                    <p className="text-white text-2xl font-semibold leading-none">{verifiedProjects}+</p>
                    <p className="text-[11px] tracking-[0.1em] uppercase text-white/50 mt-2">Verified Projects</p>
                  </div>
                </div>
              </div>

              <div className="hidden lg:block">
                <div className="relative h-[520px] rounded-[28px] overflow-hidden border border-white/14 bg-[#171715]">
                  {heroImageSrc ? (
                    <img src={heroImageSrc} alt="UAE luxury interior" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full bg-[linear-gradient(130deg,#2d2a25_0%,#1b1a18_50%,#121211_100%)]" />
                  )}
                  <div className="absolute inset-0 bg-[linear-gradient(170deg,rgba(10,10,10,0.05)_0%,rgba(10,10,10,0.72)_72%,rgba(10,10,10,0.88)_100%)]" />
                  <div className="absolute bottom-0 left-0 right-0 p-7">
                    <p className="text-[11px] tracking-[0.16em] uppercase text-white/70 mb-2">Editorial Selection</p>
                    <p className="font-serif text-[26px] leading-tight text-white max-w-[320px]">
                      Quietly luxurious spaces, tailored for modern Gulf living.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
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

      {/* Results Header */}
      <div className="bg-white border-b border-stone-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4">
          <div className="flex items-center justify-between">
            <p className="text-stone-500">
              <span className="font-semibold text-[#1c1917]">{filteredCompanies.length}</span> Designers Found
            </p>
            <span className="text-xs text-stone-400">Sorted by Relevance</span>
          </div>
        </div>
      </div>

      {/* Main Content - Three Column */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        <div className="flex gap-6">
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

          {/* Center - Company List */}
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
                    onMouseEnter={() => setHoveredCompany(company.id)}
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

          {/* Right Sidebar - Preview Card */}
          <aside className="w-72 flex-shrink-0 hidden xl:block">
            <div className="lg:sticky lg:top-24">
              <div className="mb-4">
                <h3 className="text-xs font-medium text-[#1c1917] uppercase tracking-wider">Featured Studio</h3>
              </div>

              {previewCompany ? (
                <PreviewCard
                  company={previewCompany}
                  onViewProfile={() => navigate(`/companies/${previewCompany.id}`)}
                />
              ) : (
                <div className="bg-white rounded-[22px] border border-stone-100 p-8 text-center">
                  <p className="text-sm text-stone-400">Hover over a designer to preview</p>
                </div>
              )}
            </div>
          </aside>
        </div>
      </div>

      {/* Custom scrollbar styles */}
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
      `}</style>
    </div>
  );
}
