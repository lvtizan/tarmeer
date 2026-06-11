'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { MapPin, Briefcase, ChevronLeft, ChevronRight, Users, BadgeCheck } from 'lucide-react';
import Avatar from '@/components/ui/Avatar';
import { ExpertBadges } from './ExpertBadges';
import FilterSidebar from '@/components/shared/FilterSidebar';
import FilterOption from '@/components/shared/FilterOption';
import ActiveFilterChip from '@/components/shared/ActiveFilterChip';
import type { ExpertListItem, ExpertsPagination } from './types';

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
        <div>
          <p className="text-xs font-semibold text-stone-400 uppercase tracking-wider mb-3">
            {isVn ? 'Dịch vụ' : 'Service'}
          </p>
          {compact ? (
            <div className="flex flex-wrap gap-2">
              {serviceOptions.map((svc) => (
                <FilterOption
                  key={svc}
                  selected={service === svc}
                  onClick={() => goTo(service === svc ? '' : svc, city, certified, 1)}
                  compact
                >
                  {svc}
                </FilterOption>
              ))}
            </div>
          ) : (
            <div className="space-y-0.5">
              {serviceOptions.map((svc) => (
                <FilterOption
                  key={svc}
                  selected={service === svc}
                  onClick={() => goTo(service === svc ? '' : svc, city, certified, 1)}
                >
                  {svc}
                </FilterOption>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Cities */}
      {cities.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-stone-400 uppercase tracking-wider mb-3">
            {isVn ? 'Thành phố' : 'City'}
          </p>
          {compact ? (
            <div className="flex flex-wrap gap-2">
              {cities.map((ct) => (
                <FilterOption
                  key={ct}
                  selected={city === ct}
                  onClick={() => goTo(service, city === ct ? '' : ct, certified, 1)}
                  compact
                >
                  {ct}
                </FilterOption>
              ))}
            </div>
          ) : (
            <div className="space-y-0.5">
              {cities.map((ct) => (
                <FilterOption
                  key={ct}
                  selected={city === ct}
                  onClick={() => goTo(service, city === ct ? '' : ct, certified, 1)}
                >
                  {ct}
                </FilterOption>
              ))}
            </div>
          )}
        </div>
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
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-14">
        {/* Header */}
        <div className="mb-6">
          <h1 className="font-serif text-3xl sm:text-4xl text-[#1c1917] mb-2">
            {isVn ? 'Tìm Chuyên Gia' : 'Find Experts'}
          </h1>
          <p className="text-stone-500 text-sm sm:text-base">
            {isVn
              ? 'Kết nối với các chuyên gia thiết kế, thi công và hoàn thiện nội thất đã được xác minh.'
              : 'Connect with verified interior design, fit-out and finishing professionals.'}
          </p>
        </div>

        {/* Active filter chips */}
        {hasActiveFilters && (
          <div className="flex flex-wrap gap-2 mb-5">
            {service && (
              <ActiveFilterChip label={service} onRemove={() => goTo('', city, certified, 1)} />
            )}
            {city && (
              <ActiveFilterChip label={city} onRemove={() => goTo(service, '', certified, 1)} />
            )}
            {certified && (
              <ActiveFilterChip
                label={isVn ? 'Đã chứng nhận' : 'Certified'}
                onRemove={() => goTo(service, city, false, 1)}
              />
            )}
            <button
              onClick={clearAll}
              className="text-xs text-stone-400 hover:text-stone-600 underline underline-offset-2 transition"
            >
              {isVn ? 'Xóa tất cả' : 'Clear all'}
            </button>
          </div>
        )}

        {/* Layout: sidebar + grid */}
        <div className="flex gap-6 items-start">
          <FilterSidebar
            hasActiveFilters={hasActiveFilters}
            onClearAll={clearAll}
            renderFilters={renderFilters}
            filtersLabel={isVn ? 'Bộ lọc' : 'Filters'}
            clearLabel={isVn ? 'Xóa tất cả' : 'Clear filters'}
          />

          {/* Main content */}
          <div className="flex-1 min-w-0">
            {pagination.total > 0 && (
              <p className="text-sm text-stone-500 mb-4">
                {isVn ? `${pagination.total} chuyên gia` : `${pagination.total} experts`}
              </p>
            )}

            {/* Expert cards */}
            {experts.length === 0 ? (
              <div className="text-center py-20 bg-white border border-stone-200/60 rounded-2xl">
                <Users className="w-10 h-10 mx-auto text-stone-300 mb-4" />
                <p className="font-serif text-xl text-[#1c1917] mb-2">
                  {isVn ? 'Chưa tìm thấy chuyên gia phù hợp' : 'No experts found'}
                </p>
                <p className="text-sm text-stone-500 mb-5">
                  {isVn
                    ? 'Hãy thử chọn dịch vụ khác hoặc xem tất cả chuyên gia.'
                    : 'Try a different filter, or browse all experts.'}
                </p>
                {hasActiveFilters && (
                  <button
                    type="button"
                    onClick={clearAll}
                    className="inline-flex items-center px-4 py-2 rounded-lg bg-[#1c1917] text-white text-sm font-medium hover:bg-[#b8864a] transition"
                  >
                    {isVn ? 'Xem tất cả chuyên gia' : 'View all experts'}
                  </button>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-5">
                {experts.map((expert) => (
                  <Link
                    key={expert.id}
                    href={`/experts/${expert.slug}`}
                    className="group bg-white border border-stone-200/60 rounded-2xl p-5 hover:shadow-md hover:border-[#b8864a]/40 transition"
                  >
                    <div className="flex items-start gap-3.5">
                      <Avatar name={expert.full_name} avatarUrl={expert.avatar_url || ''} size="lg" />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 flex-wrap mb-1">
                          <h3 className="font-semibold text-[16px] text-[#1c1917] group-hover:text-[#b8864a] transition truncate">
                            {expert.full_name}
                          </h3>
                          <ExpertBadges
                            isSigned={expert.is_signed}
                            isCertified={expert.is_certified}
                            isVn={isVn}
                          />
                        </div>
                        <div className="flex items-center gap-3 text-xs text-stone-400 flex-wrap">
                          {Number(expert.experience_years) > 0 && (
                            <span className="flex items-center gap-1">
                              <Briefcase className="w-3 h-3" />
                              {isVn
                                ? `${expert.experience_years} năm kinh nghiệm`
                                : `${expert.experience_years} yrs experience`}
                            </span>
                          )}
                          {expert.city && (
                            <span className="flex items-center gap-1">
                              <MapPin className="w-3 h-3" />
                              {expert.city}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    {expert.services.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-3.5">
                        {expert.services.slice(0, 4).map((svc) => (
                          <span
                            key={svc}
                            className="px-2.5 py-0.5 text-[11px] text-stone-500 border border-stone-200 rounded"
                          >
                            {svc}
                          </span>
                        ))}
                        {expert.services.length > 4 && (
                          <span className="px-2 py-0.5 text-[11px] text-stone-400">
                            +{expert.services.length - 4}
                          </span>
                        )}
                      </div>
                    )}
                  </Link>
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
