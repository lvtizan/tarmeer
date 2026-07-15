// AE 首页 ⑤「标杆案例位」（spec §5）：首个成交项目故事 → insights story 栏目
// server component；无 story 指南时整节隐藏（与 HomeMaterialsShowcase 空态口径一致）。
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import type { PublicGuide } from '@/lib/publicApi';
import { resolveImageUrl } from '@/lib/imageUrl';

export default function HomeCaseStudySection({ guide }: { guide: PublicGuide | null }) {
  if (!guide) return null;
  const cover = guide.cover_image ? resolveImageUrl(guide.cover_image) : null;

  return (
    <section className="relative isolate bg-white border-b border-stone-200/60">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-14 sm:py-20">
        <div className="grid lg:grid-cols-2 gap-8 lg:gap-14 items-center">
          {/* Cover（aspect-video 铁律） */}
          <Link
            href={`/insights/${guide.slug}`}
            className="block rounded-2xl overflow-hidden bg-stone-200 aspect-video group"
          >
            {cover && (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={cover}
                alt={guide.title}
                loading="lazy"
                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
              />
            )}
          </Link>

          {/* Copy */}
          <div>
            <p className="text-sm font-semibold text-[#b8864a] uppercase tracking-wider">
              Case Study
            </p>
            <h2 className="font-serif text-[26px] sm:text-[32px] text-[#1c1917] font-medium leading-tight mt-2">
              {guide.title}
            </h2>
            {guide.summary && (
              <p className="text-[15px] text-stone-500 leading-relaxed mt-4 line-clamp-4">
                {guide.summary}
              </p>
            )}
            <Link
              href={`/insights/${guide.slug}`}
              className="inline-flex items-center gap-2 mt-6 px-6 h-12 rounded-lg bg-[#b8864a] hover:bg-[#a07640] text-white text-sm font-semibold transition"
            >
              Read the Story
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
