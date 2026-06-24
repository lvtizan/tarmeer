'use client';

import { useEffect, useMemo, useState } from 'react';
import { X, MapPin, Phone, Globe, ClipboardList, Users, Handshake, Mail, BadgeCheck, Search } from 'lucide-react';
import FilterOption from '@/components/shared/FilterOption';
import ActiveFilterChip from '@/components/shared/ActiveFilterChip';
import FilterSidebar from '@/components/shared/FilterSidebar';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useServices } from '@/hooks/useServices';
import { companyHasService, companyHasSpaceType, SPACE_TYPE_KEYS, SPACE_TYPE_LABELS } from '@/lib/serviceCategories';
import type { Company } from '@/lib/companyData';
import { getCompanyTypeLabel } from '@/lib/companyData';
import { getImageFallbackCandidates, getNextRenderableImageIndex } from '@/lib/imageCleanup';
import { resolveImageUrl } from '@/lib/imageUrl';
import { useSiteLocale } from '@/contexts/SiteLocaleContext';


// List Card - Project First
function CompanyCard({ company, onClick, isVn }: { company: Company; onClick: () => void; isVn: boolean }) {
  const { tr } = useSiteLocale();
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
      className="group flex flex-col sm:flex-row border-b border-stone-200/60 hover:bg-[#faf8f5] transition-colors duration-150 cursor-pointer py-4 gap-3 sm:gap-5"
    >
      {/* Left - Project Image */}
      <div className="w-full sm:w-[280px] md:w-[316px] h-[200px] flex-shrink-0 overflow-hidden bg-stone-100 rounded-xl sm:rounded-none">
        {currentSrc ? (
          // eslint-disable-next-line @next/next/no-img-element
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
              // eslint-disable-next-line @next/next/no-img-element
              <img src={resolveImageUrl(company.coverImage)} alt="" className="w-6 h-6 rounded object-contain bg-white flex-shrink-0"
                onError={(e) => { e.currentTarget.style.display = 'none'; }} />
            )}
            <h3 className="font-semibold text-[17px] text-[#1c1917] group-hover:text-[#b8860b] transition-colors truncate">
              {company.isSigned && (
                <span className="inline-flex items-center mr-1.5 px-1.5 py-[2px] rounded bg-gradient-to-b from-[#d4a853] to-[#b8864a] text-white text-[10px] font-bold tracking-wider leading-none shrink-0 align-middle">Gold</span>
              )}
              {company.isCertified && (
                <span className="inline-flex items-center mr-1.5 px-1.5 py-[2px] rounded bg-blue-500 text-white text-[10px] font-bold tracking-wider leading-none shrink-0 align-middle">✓</span>
              )}
              {company.name}
              {!company.isSigned && company.isClaimed && (
                <BadgeCheck className="inline w-4 h-4 ml-1 text-[#b8864a]/70 shrink-0" />
              )}
            </h3>
          </div>

          {/* Rating + Reviews placeholder */}
          <div className="flex items-center gap-2 mb-2 text-sm flex-wrap">
            {company.companyType && getCompanyTypeLabel(company.companyType) && (
              <>
                <span className="text-xs px-2 py-0.5 rounded-full bg-[#f5f0e8] text-[#8b6914] font-medium">
                  {getCompanyTypeLabel(company.companyType)}
                </span>
                <span className="text-stone-300">&middot;</span>
              </>
            )}
            <span className="text-[#b8860b] font-medium">{tr.companies.projects(company.projectCount)}</span>
            <span className="text-stone-300">&middot;</span>
            <span className="text-stone-400">{company.city}{isVn ? '' : ', UAE'}</span>
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
        {(company.phone || company.website) && (
          <div className="flex items-center gap-4 mt-2 text-xs text-stone-400">
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
        )}

        {/* Mobile: Send Message & Location (stacked below on small screens) */}
        <div className="flex sm:hidden items-center gap-3 mt-3">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onClick();
            }}
            className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-[#b8860b] text-[#b8860b] font-semibold text-xs whitespace-nowrap hover:bg-[#b8860b] hover:text-white transition-colors duration-200"
          >
            <Mail className="w-3.5 h-3.5" />
            {tr.companies.sendMessage}
          </button>
          <span className="flex items-center gap-1 text-xs text-stone-400">
            <MapPin className="w-3 h-3 flex-shrink-0" />
            {company.city}{isVn ? '' : ', UAE'}
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
          {tr.companies.sendMessage}
        </button>
        <div className="mt-3 flex items-start gap-1.5 text-xs text-stone-400 text-center leading-snug">
          <MapPin className="w-3.5 h-3.5 flex-shrink-0 mt-0.5 text-stone-400" />
          <span>
            {tr.companies.projectsInArea(company.projectCount, company.city)}
          </span>
        </div>
      </div>
    </div>
  );
}

// Hover Preview Popup - Landscape
const SHOW_LIMIT = 6;

export default function CompaniesClient({ initialCompanies }: { initialCompanies: Company[] }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { tr, lang } = useSiteLocale();
  const isVn = lang === 'vi';
  const allServices = useServices();
  const [companies] = useState<Company[]>(initialCompanies);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCity, setSelectedCity] = useState<string>('');
  const [selectedStyles, setSelectedStyles] = useState<string[]>(() => {
    const s = searchParams.get('style');
    return s ? [s] : [];
  });
  const [selectedServices, setSelectedServices] = useState<string[]>(() => {
    const s = searchParams.get('service');
    return s ? [s] : [];
  });
  const [selectedSpaceTypes, setSelectedSpaceTypes] = useState<string[]>(() => {
    const s = searchParams.get('space');
    return s ? [s] : [];
  });
  const [selectedType, setSelectedType] = useState<string>('');
  const [showAllStyles, setShowAllStyles] = useState(false);
  const [showAllServices, setShowAllServices] = useState(false);
  const [serviceSearch, setServiceSearch] = useState('');
  const [foundedRange, setFoundedRange] = useState<string>('');

  // 同步 URL 的 service/style 参数 → 筛选状态。
  // 否则在 /companies 页内点 Find Experts 切换到别的服务时，URL 变了但筛选不更新（看着"无反应"）。
  useEffect(() => {
    const svc = searchParams.get('service');
    setSelectedServices(svc ? [svc] : []);
    const sty = searchParams.get('style');
    setSelectedStyles(sty ? [sty] : []);
    const spc = searchParams.get('space');
    setSelectedSpaceTypes(spc ? [spc] : []);
  }, [searchParams]);

  const cityOptions = useMemo(
    () => [...new Set(companies.map((c) => c.city).filter(Boolean))].sort(),
    [companies]
  );
  const styleOptions = useMemo(
    () => [...new Set(companies.flatMap((c) => c.styles).filter(Boolean))].sort(),
    [companies]
  );
  const typeOptions = useMemo(
    () => [...new Set(companies.map((c) => c.companyType).filter(Boolean))] as string[],
    [companies]
  );
  // Use canonical service list from DB; put selected ones first so they're visible without expanding
  const serviceOptions = useMemo(() => {
    const selected = selectedServices.filter((s) => allServices.includes(s));
    const rest = allServices.filter((s) => !selectedServices.includes(s));
    return [...selected, ...rest];
  }, [allServices, selectedServices]);

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
      if (selectedType && company.companyType !== selectedType) return false;
      if (selectedStyles.length > 0 && !selectedStyles.some((s) => company.styles.includes(s))) return false;
      if (selectedSpaceTypes.length > 0 && !selectedSpaceTypes.some((st) => companyHasSpaceType(company.styles, st))) return false;
      if (selectedServices.length > 0 && !selectedServices.some((s) => companyHasService(company.services, s))) return false;
      if (foundedRange) {
        const [min, max] = foundedRange.split('-').map(Number);
        if (max) {
          if (company.foundedYear < min || company.foundedYear > max) return false;
        } else if (company.foundedYear < min) return false;
      }
      return true;
    });
  }, [companies, searchQuery, selectedCity, selectedType, selectedStyles, selectedServices, selectedSpaceTypes, foundedRange]);

  // 有能力筛选(space/style/service)激活时，金牌(is_signed)置顶；组内保持服务端 weight_score 原序(JS sort 稳定)
  const sortedCompanies = useMemo(() => {
    const hasCapabilityFilter = selectedSpaceTypes.length > 0 || selectedStyles.length > 0 || selectedServices.length > 0;
    if (!hasCapabilityFilter) return filteredCompanies;
    return [...filteredCompanies].sort((a, b) => Number(b.isSigned ?? false) - Number(a.isSigned ?? false));
  }, [filteredCompanies, selectedSpaceTypes, selectedStyles, selectedServices]);

  const clearAllFilters = () => {
    setSearchQuery('');
    setSelectedCity('');
    setSelectedType('');
    setSelectedStyles([]);
    setSelectedServices([]);
    setSelectedSpaceTypes([]);
    setFoundedRange('');
  };

  const hasActiveFilters = useMemo(() => {
    return Boolean(searchQuery || selectedCity || selectedType || selectedStyles.length > 0 || selectedServices.length > 0 || selectedSpaceTypes.length > 0 || foundedRange);
  }, [searchQuery, selectedCity, selectedType, selectedStyles, selectedServices, selectedSpaceTypes, foundedRange]);

  const getFoundedLabel = (range: string) => {
    const labels: Record<string, string> = {
      '2015-2026': '10+ years',
      '2010-2014': '15+ years',
      '2000-2009': '25+ years',
    };
    return labels[range] || range;
  };

  const renderFilters = (compact = false) => (
    <>
      {/* City */}
      <div>
        <h4 className="text-xs font-medium text-[#1c1917] uppercase tracking-wider mb-3">{tr.companies.city}</h4>
        <div className={compact ? 'flex flex-wrap gap-2' : 'space-y-1'}>
          <FilterOption compact={compact} selected={!selectedCity} onClick={() => setSelectedCity('')}>{tr.companies.allCities}</FilterOption>
          {cityOptions.map((city) => (
            <FilterOption compact={compact} key={city} selected={selectedCity === city} onClick={() => setSelectedCity(city)}>
              {city}
            </FilterOption>
          ))}
        </div>
      </div>

      <hr className="border-stone-100" />

      {/* Space Type — VN 公司无 specialties，隐藏避免点了永远空结果 */}
      {!isVn && (
        <>
          <div>
            <h4 className="text-xs font-medium text-[#1c1917] uppercase tracking-wider mb-3">{tr.companies.spaceType}</h4>
            <div className={compact ? 'flex flex-wrap gap-2' : 'space-y-1'}>
              {SPACE_TYPE_KEYS.map((key) => (
                <FilterOption
                  compact={compact}
                  key={key}
                  selected={selectedSpaceTypes.includes(key)}
                  onClick={() => setSelectedSpaceTypes((prev) =>
                    prev.includes(key) ? prev.filter((v) => v !== key) : [...prev, key]
                  )}
                >
                  {SPACE_TYPE_LABELS[key]}
                </FilterOption>
              ))}
            </div>
          </div>

          <hr className="border-stone-100" />
        </>
      )}

      {/* Company Type */}
      {typeOptions.length > 0 && (
        <>
          <div>
            <h4 className="text-xs font-medium text-[#1c1917] uppercase tracking-wider mb-3">{tr.companies.companyType}</h4>
            <div className={compact ? 'flex flex-wrap gap-2' : 'space-y-1'}>
              <FilterOption compact={compact} selected={!selectedType} onClick={() => setSelectedType('')}>{tr.companies.allTypes}</FilterOption>
              {typeOptions.map((type) => (
                <FilterOption compact={compact} key={type} selected={selectedType === type} onClick={() => setSelectedType(type)}>
                  {getCompanyTypeLabel(type)}
                </FilterOption>
              ))}
            </div>
          </div>
          <hr className="border-stone-100" />
        </>
      )}

      {/* Founded */}
      <div>
        <h4 className="text-xs font-medium text-[#1c1917] uppercase tracking-wider mb-3">{tr.companies.founded}</h4>
        <div className={compact ? 'flex flex-wrap gap-2' : 'space-y-1'}>
          <FilterOption compact={compact} selected={!foundedRange} onClick={() => setFoundedRange('')}>{tr.companies.any}</FilterOption>
          <FilterOption compact={compact} selected={foundedRange === '2015-2026'} onClick={() => setFoundedRange('2015-2026')}>10+ years</FilterOption>
          <FilterOption compact={compact} selected={foundedRange === '2010-2014'} onClick={() => setFoundedRange('2010-2014')}>15+ years</FilterOption>
          <FilterOption compact={compact} selected={foundedRange === '2000-2009'} onClick={() => setFoundedRange('2000-2009')}>25+ years</FilterOption>
        </div>
      </div>

      <hr className="border-stone-100" />

      {/* Style */}
      <div>
        <h4 className="text-xs font-medium text-[#1c1917] uppercase tracking-wider mb-3">{tr.companies.style}</h4>
        <div className={compact ? 'flex flex-wrap gap-2' : 'space-y-1'}>
          {(showAllStyles ? styleOptions : styleOptions.slice(0, compact ? styleOptions.length : SHOW_LIMIT)).map((style) => (
            <FilterOption
              compact={compact}
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
        {!compact && styleOptions.length > SHOW_LIMIT && (
          <button
            onClick={() => setShowAllStyles((v) => !v)}
            className="mt-2 text-xs text-[#b8864a] hover:text-[#a07540] font-medium transition"
          >
            {showAllStyles ? tr.companies.showLess : tr.companies.showMore(styleOptions.length - SHOW_LIMIT)}
          </button>
        )}
      </div>

      <hr className="border-stone-100" />

      {/* Services */}
      {(() => {
        const q = serviceSearch.trim().toLowerCase();
        const matched = q ? serviceOptions.filter((s) => s.toLowerCase().includes(q)) : serviceOptions;
        const shown = q ? matched : (showAllServices ? serviceOptions : serviceOptions.slice(0, compact ? serviceOptions.length : SHOW_LIMIT));
        return (
          <div>
            <h4 className="text-xs font-medium text-[#1c1917] uppercase tracking-wider mb-3">{tr.companies.services}</h4>
            <div className="relative mb-3">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-stone-400" />
              <input
                type="text"
                value={serviceSearch}
                onChange={(e) => setServiceSearch(e.target.value)}
                placeholder={tr.companies.searchServices}
                className="h-9 w-full rounded-lg border border-stone-200 bg-white pl-8 pr-3 text-sm text-[#1c1917] outline-none placeholder:text-stone-400 focus:border-[#b8864a] focus:ring-2 focus:ring-[#b8864a]/25"
              />
            </div>
            <div className={compact ? 'flex flex-wrap gap-2' : 'space-y-1'}>
              {shown.map((service) => (
                <FilterOption
                  compact={compact}
                  key={service}
                  selected={selectedServices.includes(service)}
                  onClick={() => setSelectedServices((prev) =>
                    prev.includes(service) ? prev.filter((v) => v !== service) : [...prev, service]
                  )}
                >
                  {service}
                </FilterOption>
              ))}
              {q && shown.length === 0 && (
                <p className="py-2 text-xs text-stone-400">{tr.companies.noCompanies}</p>
              )}
            </div>
            {!compact && !q && serviceOptions.length > SHOW_LIMIT && (
              <button
                onClick={() => setShowAllServices((v) => !v)}
                className="mt-2 text-xs text-[#b8864a] hover:text-[#a07540] font-medium transition"
              >
                {showAllServices ? tr.companies.showLess : tr.companies.showMore(serviceOptions.length - SHOW_LIMIT)}
              </button>
            )}
          </div>
        );
      })()}
    </>
  );

  return (
    <div className="min-h-screen bg-[#faf9f7]">
      {/* Hero - Match with Professionals */}
      <section className="relative bg-[#2c2620] overflow-hidden">
        {/* Subtle pattern overlay */}
        <div className="absolute inset-0 opacity-[0.04] [background-image:radial-gradient(circle_at_1px_1px,rgba(255,255,255,0.8)_1px,transparent_0)] [background-size:32px_32px]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_0%,rgba(184,134,74,0.12),transparent_70%)]" />
        <div className="relative max-w-4xl mx-auto px-4 sm:px-6 py-12 sm:py-16 text-center">
          <h1 className="font-serif text-[28px] sm:text-[36px] text-white font-medium leading-tight mb-10">
            {tr.companies.heroHeading}
          </h1>

          {/* 3-Step Flow */}
          <div className="grid grid-cols-3 mb-10 max-w-xs sm:max-w-sm mx-auto">
            {[
              { icon: ClipboardList, label: tr.companies.step1 },
              { icon: Users, label: tr.companies.step2 },
              { icon: Handshake, label: tr.companies.step3 },
            ].map((step, i) => (
              <div key={i} className="relative flex flex-col items-center">
                {i > 0 && (
                  <div className="absolute top-6 left-[-50%] right-1/2 h-px bg-white/25" />
                )}
                <div className="relative z-10 w-12 h-12 rounded-full border border-white/30 bg-[#2c2620] flex items-center justify-center">
                  <step.icon className="w-5 h-5 text-white/80" />
                </div>
                <p className="text-white/70 text-xs sm:text-sm leading-snug text-center mt-2.5 px-1">
                  {step.label}
                </p>
              </div>
            ))}
          </div>

          {/* Search Bar */}
          <div className="max-w-md mx-auto flex gap-0">
            <div className="relative flex-1">
              <MapPin className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
              <input
                type="text"
                placeholder={tr.companies.searchPlaceholder}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full h-12 pl-10 pr-4 bg-white rounded-l-lg text-sm text-[#1c1917] placeholder:text-stone-400 focus:outline-none"
              />
            </div>
            <button className="h-12 px-6 bg-[#b8864a] hover:bg-[#a67c47] text-white text-sm font-semibold rounded-r-lg transition whitespace-nowrap">
              {tr.companies.getStarted}
            </button>
          </div>

        </div>
      </section>

      {/* Active Filters */}
      {hasActiveFilters && (
        <div className="bg-white border-b border-stone-100">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium text-[#1c1917]">{tr.companies.activeFilters}</span>
              <button onClick={clearAllFilters} className="text-sm text-stone-500 hover:text-[#b8860b] transition">
                {tr.companies.clearAll}
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {searchQuery && <ActiveFilterChip label={`"${searchQuery}"`} onRemove={() => setSearchQuery('')} />}
              {selectedCity && <ActiveFilterChip label={selectedCity} onRemove={() => setSelectedCity('')} />}
              {selectedType && <ActiveFilterChip label={getCompanyTypeLabel(selectedType)} onRemove={() => setSelectedType('')} />}
              {foundedRange && <ActiveFilterChip label={getFoundedLabel(foundedRange)} onRemove={() => setFoundedRange('')} />}
              {selectedSpaceTypes.map((st) => (
                <ActiveFilterChip key={st} label={SPACE_TYPE_LABELS[st] || st} onRemove={() => setSelectedSpaceTypes((prev) => prev.filter((v) => v !== st))} />
              ))}
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
      <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-4 pb-8">
        <div className="flex gap-8">
          <FilterSidebar
            hasActiveFilters={hasActiveFilters}
            onClearAll={clearAllFilters}
            renderFilters={renderFilters}
            filtersLabel={tr.companies.filters}
            clearLabel={tr.companies.clearFilters}
          />

          {/* Main - Company List */}
          <div className="flex-1 min-w-0">
            {sortedCompanies.length > 0 ? (
              <div>
                {sortedCompanies.map((company) => (
                  <div key={company.id} className="relative">
                    <CompanyCard
                      company={company}
                      isVn={isVn}
                      onClick={() => router.push(`/companies/${company.slug || company.id}`)}
                    />
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-20 bg-white rounded-[22px] border border-stone-100">
                <p className="text-stone-400 mb-4">{tr.companies.noCompanies}</p>
                <button onClick={clearAllFilters} className="text-[#b8860b] hover:underline">
                  {tr.companies.clearFilters}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateX(8px); }
          to { opacity: 1; transform: translateX(0); }
        }
        .animate-fade-in { animation: fadeIn 0.2s ease-out; }
      `}</style>
    </div>
  );
}
