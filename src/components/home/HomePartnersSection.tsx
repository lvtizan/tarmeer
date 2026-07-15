// AE 首页压缩版「Local Execution Partners」（改版 spec §5 ⑥，AE 专用，不进 i18n）
// 装企/专家降级为双入口卡；companies 复用 page.tsx 已取数据展示少量名字，可为空。
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import type { Company } from '@/lib/companyData';

export default function HomePartnersSection({ companies = [] }: { companies?: Company[] }) {
  const partnerNames = companies.slice(0, 6);

  return (
    <section className="bg-[#faf9f7] py-10 sm:py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="mb-6">
          <p className="text-[10px] uppercase tracking-[0.22em] text-stone-400 mb-1.5">Local Execution Partners</p>
          <h2 className="font-serif text-[24px] leading-tight tracking-[-0.01em] text-[#1c1917] sm:text-[28px]">
            From Materials to a Finished Space
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-stone-500">
            Need more than materials? We work with vetted renovation companies and independent design experts
            across the UAE who build, install and design with what you source.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Link
            href="/companies"
            className="group flex flex-col rounded-2xl border border-stone-200 bg-white p-6 transition hover:border-stone-300 hover:shadow-[0_12px_32px_rgba(28,25,23,0.08)]"
          >
            <h3 className="font-serif text-[19px] leading-tight text-[#1c1917] transition group-hover:text-[#b8864a]">
              Find Renovation Companies
            </h3>
            <p className="mt-1.5 text-[13px] leading-5 text-stone-500">
              Compare vetted fit-out and renovation companies by portfolio, service and city.
            </p>
            {partnerNames.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {partnerNames.map((company) => (
                  <span key={company.id} className="inline-block rounded-full border border-stone-200 px-2.5 py-0.5 text-[11px] text-stone-500">
                    {company.name}
                  </span>
                ))}
              </div>
            )}
            <span className="mt-auto inline-flex items-center gap-1.5 pt-4 text-sm font-medium text-[#b8864a]">
              Browse Companies <ArrowRight className="h-4 w-4" />
            </span>
          </Link>

          <Link
            href="/experts"
            className="group flex flex-col rounded-2xl border border-stone-200 bg-white p-6 transition hover:border-stone-300 hover:shadow-[0_12px_32px_rgba(28,25,23,0.08)]"
          >
            <h3 className="font-serif text-[19px] leading-tight text-[#1c1917] transition group-hover:text-[#b8864a]">
              Meet Design Experts
            </h3>
            <p className="mt-1.5 text-[13px] leading-5 text-stone-500">
              Work with independent interior designers who specify and style the newest materials.
            </p>
            <span className="mt-auto inline-flex items-center gap-1.5 pt-4 text-sm font-medium text-[#b8864a]">
              Browse Experts <ArrowRight className="h-4 w-4" />
            </span>
          </Link>
        </div>
      </div>
    </section>
  );
}
