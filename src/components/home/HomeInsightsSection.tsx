import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import SmartImage from '@/components/ui/SmartImage';
import type { PublicGuide } from '@/lib/publicApi';

const CATEGORY_LABELS: Record<string, string> = {
  cost: 'Cost & Budgeting',
  sourcing: 'Sourcing & Materials',
  trend: 'Design Trends',
  story: 'Project Stories',
  find: 'Finding a Company',
};

export default function HomeInsightsSection({ guides }: { guides: PublicGuide[] }) {
  if (!guides || guides.length === 0) return null;
  const items = guides.slice(0, 4);

  return (
    <section className="bg-white py-10 sm:py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="flex items-end justify-between mb-6">
          <div>
            <p className="text-[10px] uppercase tracking-[0.22em] text-stone-400 mb-1.5">Insights &amp; Guides</p>
            <h2 className="font-serif text-[24px] leading-tight tracking-[-0.01em] text-[#1c1917] sm:text-[28px]">
              Data-driven guides &amp; cost data
            </h2>
          </div>
          <Link href="/insights" className="hidden sm:inline-flex items-center gap-2 text-sm font-medium text-[#b8864a] hover:text-[#9a7040] transition">
            View All <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
          {items.map((g) => (
            <Link
              key={g.id}
              href={`/insights/${g.slug}`}
              className="group flex flex-col overflow-hidden rounded-2xl border border-stone-200 bg-white transition hover:border-stone-300 hover:shadow-[0_12px_32px_rgba(28,25,23,0.08)]"
            >
              <div className="relative aspect-video overflow-hidden bg-stone-100">
                {g.cover_image ? (
                  <SmartImage
                    src={g.cover_image}
                    variant="thumb"
                    alt={g.title}
                    className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                    loading="lazy"
                    width={400}
                    height={225}
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-stone-100 to-stone-200">
                    <span className="font-serif text-3xl text-stone-300">📖</span>
                  </div>
                )}
              </div>
              <div className="flex flex-col flex-1 p-3.5 sm:p-4">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-[#b8864a] mb-1">
                  {CATEGORY_LABELS[g.category] ?? g.category}
                </p>
                <h3 className="font-medium text-[14px] leading-snug text-[#1c1917] group-hover:text-[#b8864a] transition sm:text-[15px] line-clamp-2">
                  {g.title}
                </h3>
                <p className="mt-1 line-clamp-2 text-[12px] leading-5 text-stone-500 sm:text-[13px]">{g.summary}</p>
              </div>
            </Link>
          ))}
        </div>

        <div className="mt-5 flex justify-center sm:hidden">
          <Link href="/insights" className="inline-flex items-center gap-2 text-sm font-medium text-[#b8864a]">
            View All Guides <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </section>
  );
}
