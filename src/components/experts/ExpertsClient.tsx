'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { MapPin, Briefcase, ChevronLeft, ChevronRight, Users } from 'lucide-react';
import Avatar from '@/components/ui/Avatar';
import { ExpertBadges } from './ExpertBadges';
import type { ExpertListItem, ExpertsPagination } from './types';

const API_BASE = process.env.NEXT_PUBLIC_API_URL?.trim() || '/api';

interface ExpertsClientProps {
  experts: ExpertListItem[];
  pagination: ExpertsPagination;
  service: string;
  isVn: boolean;
}

function buildExpertsUrl(service: string, page: number): string {
  const params = new URLSearchParams();
  if (service) params.set('service', service);
  if (page > 1) params.set('page', String(page));
  const qs = params.toString();
  return qs ? `/experts?${qs}` : '/experts';
}

export default function ExpertsClient({ experts, pagination, service, isVn }: ExpertsClientProps) {
  const router = useRouter();
  const [serviceChips, setServiceChips] = useState<string[]>([]);

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

  // Keep the currently selected service visible as a chip even when it's not in the configured list
  const chips = useMemo(() => {
    if (service && !serviceChips.includes(service)) return [service, ...serviceChips];
    return serviceChips;
  }, [service, serviceChips]);

  const totalPages = Math.max(1, Math.ceil((pagination.total || 0) / (pagination.limit || 12)));
  const currentPage = pagination.page || 1;

  const goTo = (svc: string, page: number) => {
    router.push(buildExpertsUrl(svc, page));
  };

  const pageNumbers = useMemo(() => {
    const nums: number[] = [];
    const start = Math.max(1, currentPage - 2);
    const end = Math.min(totalPages, currentPage + 2);
    for (let p = start; p <= end; p++) nums.push(p);
    return nums;
  }, [currentPage, totalPages]);

  return (
    <div className="min-h-screen bg-[#faf9f7]">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-14">
        {/* Header */}
        <div className="mb-8">
          <h1 className="font-serif text-3xl sm:text-4xl text-[#1c1917] mb-2">
            {isVn ? 'Tìm Chuyên Gia' : 'Find Experts'}
          </h1>
          <p className="text-stone-500 text-sm sm:text-base">
            {isVn
              ? 'Kết nối với các chuyên gia thiết kế, thi công và hoàn thiện nội thất đã được xác minh.'
              : 'Connect with verified interior design, fit-out and finishing professionals.'}
          </p>
        </div>

        {/* Service filter chips */}
        {chips.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-8">
            <button
              type="button"
              onClick={() => goTo('', 1)}
              className={`px-3.5 py-1.5 rounded-full text-sm border transition ${
                !service
                  ? 'bg-[#1c1917] text-white border-[#1c1917]'
                  : 'bg-white text-stone-600 border-stone-200 hover:border-[#b8864a] hover:text-[#b8864a]'
              }`}
            >
              {isVn ? 'Tất cả' : 'All'}
            </button>
            {chips.map((svc) => (
              <button
                key={svc}
                type="button"
                onClick={() => goTo(svc, 1)}
                className={`px-3.5 py-1.5 rounded-full text-sm border transition ${
                  service === svc
                    ? 'bg-[#1c1917] text-white border-[#1c1917]'
                    : 'bg-white text-stone-600 border-stone-200 hover:border-[#b8864a] hover:text-[#b8864a]'
                }`}
              >
                {svc}
              </button>
            ))}
          </div>
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
                : 'Try a different service, or browse all experts.'}
            </p>
            {service && (
              <button
                type="button"
                onClick={() => goTo('', 1)}
                className="inline-flex items-center px-4 py-2 rounded-lg bg-[#1c1917] text-white text-sm font-medium hover:bg-[#b8864a] transition"
              >
                {isVn ? 'Xem tất cả chuyên gia' : 'View all experts'}
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
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
                      <ExpertBadges isSigned={expert.is_signed} isCertified={expert.is_certified} isVn={isVn} />
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
                      <span key={svc} className="px-2.5 py-0.5 text-[11px] text-stone-500 border border-stone-200 rounded">
                        {svc}
                      </span>
                    ))}
                    {expert.services.length > 4 && (
                      <span className="px-2 py-0.5 text-[11px] text-stone-400">+{expert.services.length - 4}</span>
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
              onClick={() => goTo(service, currentPage - 1)}
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
                onClick={() => goTo(service, p)}
                className={`min-w-9 h-9 px-2 rounded-lg border text-sm transition ${
                  p === currentPage
                    ? 'bg-[#1c1917] text-white border-[#1c1917]'
                    : 'bg-white text-stone-600 border-stone-200 hover:border-[#b8864a] hover:text-[#b8864a]'
                }`}
              >
                {p}
              </button>
            ))}
            {pageNumbers[pageNumbers.length - 1] < totalPages && <span className="px-1 text-stone-400 text-sm">…</span>}
            <button
              type="button"
              disabled={currentPage >= totalPages}
              onClick={() => goTo(service, currentPage + 1)}
              className="p-2 rounded-lg border border-stone-200 bg-white text-stone-500 hover:border-[#b8864a] hover:text-[#b8864a] transition disabled:opacity-40 disabled:cursor-not-allowed"
              aria-label="Next page"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
