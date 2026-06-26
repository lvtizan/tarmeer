'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  MapPin, Briefcase, ChevronLeft, ChevronRight, Users,
  BadgeCheck, ClipboardList, Handshake, Search,
} from 'lucide-react';
import Avatar from '@/components/ui/Avatar';
import { ExpertBadges } from './ExpertBadges';
import FilterSidebar from '@/components/shared/FilterSidebar';
import FilterOption from '@/components/shared/FilterOption';
import SearchableFilterList from '@/components/shared/SearchableFilterList';
import ActiveFilterChip from '@/components/shared/ActiveFilterChip';
import type { ExpertListItem, ExpertsPagination } from './types';
import { translateServiceLabel } from '@/i18n/sections/services';

const API_BASE = process.env.NEXT_PUBLIC_API_URL?.trim() || '/api';

interface ExpertsClientProps {
  experts: ExpertListItem[];
  pagination: ExpertsPagination;
  service: string;
  city: string;
  certified: boolean;
  isVn: boolean;
  country: string;
}

function buildExpertsUrl(service: string, city: string, certified: boolean, page: number): string {
  const params = new URLSearchParams();
  if (service) params.set('service', service);
  if (city) params.set('city', city);
  if (certified) params.set('certified', '1');
  if (page > 1) params.set('page', String(page));
  const qs = params.toString();
  return qs ? `/experts?${qs}` : '/experts';
}

function ExpertListCard({ expert, isVn }: { expert: ExpertListItem; isVn: boolean }) {
  // 封面优先用专家项目图，其次头像，再首字母
  const coverUrl = expert.cover_image || expert.avatar_url || '';

  return (
    <div className="group flex flex-col sm:flex-row border-b border-stone-200/60 hover:bg-[#faf8f5] transition-colors duration-150 cursor-pointer py-4 gap-3 sm:gap-5">
      {/* Left — rectangular cover (project image) */}
      <Link
        href={`/experts/${expert.slug}`}
        className="w-full sm:w-[280px] md:w-[316px] h-[200px] flex-shrink-0 overflow-hidden bg-stone-100 rounded-xl sm:rounded-none"
      >
        {coverUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={coverUrl}
            alt={expert.full_name}
            className="w-full h-full object-cover group-hover:brightness-95 transition duration-300"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-stone-50 to-stone-100">
            <span className="font-serif text-4xl text-stone-200">{expert.full_name.charAt(0)}</span>
          </div>
        )}
      </Link>

      {/* Right — info */}
      <div className="flex-1 min-w-0 flex flex-col justify-between">
        <div>
          {/* Name + badges */}
          <Link href={`/experts/${expert.slug}`} className="block mb-1">
            <h3 className="font-semibold text-[17px] text-[#1c1917] group-hover:text-[#b8860b] transition-colors inline">
              {expert.full_name}
            </h3>
            {' '}
            <ExpertBadges isSigned={expert.is_signed} isCertified={expert.is_certified} isVn={isVn} />
          </Link>

          {/* Meta: experience · city */}
          <p className="text-sm text-stone-500 mb-2">
            {[
              Number(expert.experience_years) > 0
                ? (isVn ? `${expert.experience_years} năm kinh nghiệm` : `${expert.experience_years} yrs experience`)
                : null,
              expert.city ? `${expert.city}${isVn ? '' : ', UAE'}` : null,
            ]
              .filter(Boolean)
              .map((part, i) => (
                <span key={i}>
                  {i > 0 && <span className="mx-1.5 text-stone-300">·</span>}
                  {i === 0 ? <span className="text-[#b8860b] font-medium">{part}</span> : part}
                </span>
              ))}
          </p>

          {/* Service tags */}
          {expert.services.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-1">
              {expert.services.slice(0, 5).map((svc) => (
                <span
                  key={svc}
                  className="px-2.5 py-0.5 text-xs text-stone-600 border border-stone-200 rounded bg-white"
                >
                  {translateServiceLabel(svc, isVn ? 'vi' : 'en')}
                </span>
              ))}
              {expert.services.length > 5 && (
                <span className="px-2 py-0.5 text-xs text-stone-400">+{expert.services.length - 5}</span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* CTA — right column */}
      <div className="flex-shrink-0 flex flex-col items-end justify-between gap-3 sm:min-w-[140px]">
        <Link
          href={`/experts/${expert.slug}`}
          className="inline-flex items-center px-5 py-2 rounded-full border border-[#b8864a] text-[#b8864a] text-sm font-medium hover:bg-[#b8864a] hover:text-white transition-colors whitespace-nowrap"
        >
          {isVn ? 'Xem hồ sơ' : 'View Profile'}
        </Link>
        {expert.city && (
          <p className="text-xs text-stone-400 flex items-center gap-1 text-right">
            <MapPin className="w-3 h-3 flex-shrink-0" />
            {isVn ? `Khu vực ${expert.city}` : `Based in ${expert.city}`}
          </p>
        )}
      </div>
    </div>
  );
}

export default function ExpertsClient({
  experts,
  pagination,
  service,
  city,
  certified,
  isVn,
  country,
}: ExpertsClientProps) {
  const router = useRouter();
  const [serviceChips, setServiceChips] = useState<string[]>([]);
  const [cities, setCities] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    fetch(`${API_BASE}/public/service-categories`)
      .then((r) => r.json())
      .then((d: unknown) => {
        const data = d as { categories?: { name: string; subs: string[] }[] };
        if (Array.isArray(data?.categories)) {
          const subs = data.categories.flatMap((c) => c.subs || []);
          setServiceChips([...new Set(subs)]);
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetch(`${API_BASE}/experts/cities?country=${country}`)
      .then((r) => r.json())
      .then((d: unknown) => {
        const data = d as { cities?: string[] };
        if (Array.isArray(data?.cities)) setCities(data.cities);
      })
      .catch(() => {});
  }, [country]);

  const serviceOptions = useMemo(() => {
    if (service && !serviceChips.includes(service)) return [service, ...serviceChips];
    return serviceChips;
  }, [service, serviceChips]);

  const totalPages = Math.max(1, Math.ceil((pagination.total || 0) / (pagination.limit || 12)));
  const currentPage = pagination.page || 1;

  const goTo = (svc: string, ct: string, cert: boolean, page: number) => {
    router.push(buildExpertsUrl(svc, ct, cert, page));
  };

  const hasActiveFilters = Boolean(service || city || certified);
  const clearAll = () => goTo('', '', false, 1);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    goTo(searchQuery.trim() || service, city, certified, 1);
  };

  const pageNumbers = useMemo(() => {
    const nums: number[] = [];
    const start = Math.max(1, currentPage - 2);
    const end = Math.min(totalPages, currentPage + 2);
    for (let p = start; p <= end; p++) nums.push(p);
    return nums;
  }, [currentPage, totalPages]);

  const renderFilters = (compact: boolean) => (
    <>
      {/* Services */}
      {serviceOptions.length > 0 && (
        compact ? (
          <div>
            <p className="text-xs font-semibold text-stone-400 uppercase tracking-wider mb-3">
              {isVn ? 'Dịch vụ' : 'Service'}
            </p>
            <div className="flex flex-wrap gap-2">
              {serviceOptions.map((svc) => (
                <FilterOption key={svc} selected={service === svc} onClick={() => goTo(service === svc ? '' : svc, city, certified, 1)} compact>
                  {translateServiceLabel(svc, isVn ? 'vi' : 'en')}
                </FilterOption>
              ))}
            </div>
          </div>
        ) : (
          <SearchableFilterList
            title={isVn ? 'Dịch vụ' : 'Service'}
            options={serviceOptions}
            selected={service}
            onToggle={(svc) => goTo(service === svc ? '' : svc, city, certified, 1)}
            searchPlaceholder={isVn ? 'Tìm dịch vụ…' : 'Search service…'}
            noResultsText={isVn ? 'Không tìm thấy' : 'No results'}
            labelFor={(svc) => translateServiceLabel(svc, isVn ? 'vi' : 'en')}
          />
        )
      )}

      {/* Cities */}
      {cities.length > 0 && (
        compact ? (
          <div>
            <p className="text-xs font-semibold text-stone-400 uppercase tracking-wider mb-3">
              {isVn ? 'Thành phố' : 'City'}
            </p>
            <div className="flex flex-wrap gap-2">
              {cities.map((ct) => (
                <FilterOption key={ct} selected={city === ct} onClick={() => goTo(service, city === ct ? '' : ct, certified, 1)} compact>
                  {ct}
                </FilterOption>
              ))}
            </div>
          </div>
        ) : (
          <SearchableFilterList
            title={isVn ? 'Thành phố' : 'City'}
            options={cities}
            selected={city}
            onToggle={(ct) => goTo(service, city === ct ? '' : ct, certified, 1)}
            searchPlaceholder={isVn ? 'Tìm thành phố…' : 'Search city…'}
            noResultsText={isVn ? 'Không tìm thấy' : 'No results'}
          />
        )
      )}

      {/* Certified toggle */}
      <div>
        <p className="text-xs font-semibold text-stone-400 uppercase tracking-wider mb-3">
          {isVn ? 'Chứng nhận' : 'Certification'}
        </p>
        <button
          onClick={() => goTo(service, city, !certified, 1)}
          className={`w-full flex items-center gap-2.5 px-4 py-2.5 rounded-lg text-sm transition-all duration-200 ${
            certified
              ? 'bg-[#f5f0e8] border border-[#d4c4a8] text-[#1c1917]'
              : 'text-stone-500 hover:bg-stone-50'
          }`}
        >
          <BadgeCheck
            className={`w-4 h-4 flex-shrink-0 ${certified ? 'text-[#b8860b]' : 'text-stone-400'}`}
          />
          {isVn ? 'Chỉ đã chứng nhận' : 'Certified only'}
        </button>
      </div>
    </>
  );

  return (
    <div className="min-h-screen bg-[#faf9f7]">
      {/* Hero */}
      <section className="relative bg-[#2c2620] overflow-hidden">
        <div className="absolute inset-0 opacity-[0.04] [background-image:radial-gradient(circle_at_1px_1px,rgba(255,255,255,0.8)_1px,transparent_0)] [background-size:32px_32px]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_0%,rgba(184,134,74,0.12),transparent_70%)]" />
        <div className="relative max-w-4xl mx-auto px-4 sm:px-6 py-12 sm:py-16 text-center">
          <h1 className="font-serif text-[28px] sm:text-[36px] text-white font-medium leading-tight mb-10">
            {isVn
              ? 'Tìm Chuyên Gia Thiết Kế & Thi Công Phù Hợp'
              : 'Find the Right Design & Renovation Expert in UAE'}
          </h1>

          {/* 3-Step Flow */}
          <div className="grid grid-cols-3 mb-10 max-w-xs sm:max-w-sm mx-auto">
            {[
              {
                icon: ClipboardList,
                label: isVn ? 'Chia sẻ dự án của bạn' : 'Tell us about your project',
              },
              {
                icon: Users,
                label: isVn ? 'Kết nối với chuyên gia' : 'Get matched with local experts',
              },
              {
                icon: Handshake,
                label: isVn ? 'Thuê với sự tự tin' : 'Hire the right pro with confidence',
              },
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

          {/* Search */}
          <form onSubmit={handleSearch} className="max-w-md mx-auto flex gap-0">
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
              <input
                type="text"
                placeholder={isVn ? 'Tìm theo tên hoặc chuyên môn' : 'Search by name or specialty'}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full h-12 pl-10 pr-4 bg-white rounded-l-lg text-sm text-[#1c1917] placeholder:text-stone-400 focus:outline-none"
              />
            </div>
            <button
              type="submit"
              className="h-12 px-6 bg-[#b8864a] hover:bg-[#a67c47] text-white text-sm font-semibold rounded-r-lg transition whitespace-nowrap"
            >
              {isVn ? 'Tìm kiếm' : 'Get Started'}
            </button>
          </form>
        </div>
      </section>

      {/* Active Filters bar */}
      {hasActiveFilters && (
        <div className="bg-white border-b border-stone-100">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium text-[#1c1917]">
                {isVn ? 'Bộ lọc đang dùng' : 'Active filters'}
              </span>
              <button onClick={clearAll} className="text-sm text-stone-500 hover:text-[#b8860b] transition">
                {isVn ? 'Xóa tất cả' : 'Clear all'}
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {service && <ActiveFilterChip label={translateServiceLabel(service, isVn ? 'vi' : 'en')} onRemove={() => goTo('', city, certified, 1)} />}
              {city && <ActiveFilterChip label={city} onRemove={() => goTo(service, '', certified, 1)} />}
              {certified && (
                <ActiveFilterChip
                  label={isVn ? 'Đã chứng nhận' : 'Certified'}
                  onRemove={() => goTo(service, city, false, 1)}
                />
              )}
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-4 pb-8">
        <div className="flex gap-8">
          <FilterSidebar
            hasActiveFilters={hasActiveFilters}
            onClearAll={clearAll}
            renderFilters={renderFilters}
            filtersLabel={isVn ? 'Bộ lọc' : 'Filters'}
            clearLabel={isVn ? 'Xóa tất cả' : 'Clear filters'}
          />

          {/* Expert List */}
          <div className="flex-1 min-w-0">
            {experts.length === 0 ? (
              <div className="text-center py-20 bg-white rounded-[22px] border border-stone-100">
                <Users className="w-10 h-10 mx-auto text-stone-300 mb-4" />
                <p className="font-serif text-xl text-[#1c1917] mb-2">
                  {isVn ? 'Chưa tìm thấy chuyên gia phù hợp' : 'No experts found'}
                </p>
                <p className="text-sm text-stone-500 mb-5">
                  {isVn ? 'Hãy thử bộ lọc khác.' : 'Try a different filter.'}
                </p>
                {hasActiveFilters && (
                  <button
                    onClick={clearAll}
                    className="text-[#b8860b] hover:underline text-sm"
                  >
                    {isVn ? 'Xóa bộ lọc' : 'Clear filters'}
                  </button>
                )}
              </div>
            ) : (
              <div>
                {experts.map((expert) => (
                  <ExpertListCard key={expert.id} expert={expert} isVn={isVn} />
                ))}
              </div>
            )}

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-1.5 mt-10">
                <button
                  type="button"
                  disabled={currentPage <= 1}
                  onClick={() => goTo(service, city, certified, currentPage - 1)}
                  className="p-2 rounded-lg border border-stone-200 bg-white text-stone-500 hover:border-[#b8864a] hover:text-[#b8864a] transition disabled:opacity-40 disabled:cursor-not-allowed"
                  aria-label="Previous page"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                {pageNumbers[0] > 1 && <span className="px-1 text-stone-400 text-sm">…</span>}
                {pageNumbers.map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => goTo(service, city, certified, p)}
                    className={`min-w-9 h-9 px-2 rounded-lg border text-sm transition ${
                      p === currentPage
                        ? 'bg-[#1c1917] text-white border-[#1c1917]'
                        : 'bg-white text-stone-600 border-stone-200 hover:border-[#b8864a] hover:text-[#b8864a]'
                    }`}
                  >
                    {p}
                  </button>
                ))}
                {pageNumbers[pageNumbers.length - 1] < totalPages && (
                  <span className="px-1 text-stone-400 text-sm">…</span>
                )}
                <button
                  type="button"
                  disabled={currentPage >= totalPages}
                  onClick={() => goTo(service, city, certified, currentPage + 1)}
                  className="p-2 rounded-lg border border-stone-200 bg-white text-stone-500 hover:border-[#b8864a] hover:text-[#b8864a] transition disabled:opacity-40 disabled:cursor-not-allowed"
                  aria-label="Next page"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
