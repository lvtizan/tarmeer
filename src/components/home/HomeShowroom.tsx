// AE 首页「一站式：迪拜展厅 ↔ 中国工厂」zigzag 图文交替区块（2026-07-20，替换原 6 卡 HomeWhyUs + 并入 TwoPaths）
// 参考 georgegroups「More Than Materials」布局；两行左右交替，图带 IN DUBAI/IN CHINA 角标 + 二级页入口。
// AE 专用，不进 i18n；纯 server component（无状态）。
import Link from 'next/link';
import { MapPin, ArrowRight } from 'lucide-react';
import { ADDRESS, GOOGLE_MAPS_URL } from '@/lib/constants';

const ROWS: {
  img: string;
  alt: string;
  badge: string;
  imageRight: boolean;
  showAddress?: boolean;
  blocks: { title: string; line: string }[];
  cta: { label: string; href: string };
}[] = [
  {
    img: 'showroom-exterior',
    alt: 'The Tarmeer building-materials selection center in the UAE',
    badge: 'In Dubai',
    imageRight: true,
    showAddress: true,
    blocks: [
      {
        title: 'See it in Dubai before you buy',
        line: 'Touch the newest materials at our UAE selection center, guided by a bilingual consultant.',
      },
      {
        title: 'One partner, end to end',
        line: 'Selection, sourcing, delivery and after-sales — all handled in one place.',
      },
    ],
    cta: { label: 'Visit the selection center', href: '/materials/showroom' },
  },
  {
    img: 'hero-real-1',
    alt: 'Designers touring a partner stone showroom and factory in China',
    badge: 'In China',
    imageRight: false,
    blocks: [
      {
        title: 'Sourced direct from China',
        line: 'Factory-direct from Foshan, the material heartland of China.',
      },
      {
        title: 'Quality-checked before shipping',
        line: 'Every order inspected and consolidated before it leaves the factory.',
      },
    ],
    cta: { label: 'See the study tour', href: '/for-designers/china-tour' },
  },
];

export default function HomeShowroom() {
  return (
    <section className="bg-white py-14 sm:py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-[10px] uppercase tracking-[0.22em] text-[#b8864a]">One Partner, End to End</p>
          <h2 className="mt-2 font-serif text-[26px] leading-tight tracking-[-0.01em] text-[#1c1917] sm:text-[34px]">
            Your showroom in Dubai, your factory network in China
          </h2>
        </div>

        <div className="mt-12 space-y-12 lg:space-y-16">
          {ROWS.map((row) => (
            <div key={row.img} className="grid items-center gap-8 lg:grid-cols-2 lg:gap-14">
              {/* 图 + 角标 */}
              <div
                className={`relative overflow-hidden rounded-2xl bg-stone-200 aspect-[16/10] ${
                  row.imageRight ? 'lg:order-last' : ''
                }`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`/images/sourcing/${row.img}-medium.webp`}
                  srcSet={`/images/sourcing/${row.img}-thumb.webp 600w, /images/sourcing/${row.img}-medium.webp 1200w`}
                  sizes="(min-width: 1024px) 50vw, 100vw"
                  alt={row.alt}
                  loading="lazy"
                  className="h-full w-full object-cover"
                />
                <span className="absolute left-4 top-4 rounded-full bg-white/90 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-[#b8864a] backdrop-blur">
                  {row.badge}
                </span>
              </div>
              {/* 文 */}
              <div className="space-y-6">
                {row.blocks.map((b) => (
                  <div key={b.title}>
                    <h3 className="font-serif text-xl font-bold text-[#1c1917]">{b.title}</h3>
                    <p className="mt-1.5 text-[15px] leading-relaxed text-stone-500">{b.line}</p>
                  </div>
                ))}
                {row.showAddress && (
                  <a
                    href={GOOGLE_MAPS_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-start gap-2.5 rounded-xl border border-stone-200 bg-[#faf8f5] p-4 transition hover:border-[#b8864a]/40"
                  >
                    <MapPin className="mt-0.5 h-5 w-5 shrink-0 text-[#b8864a]" />
                    <span className="text-sm leading-relaxed text-stone-600">
                      {ADDRESS}
                      <span className="mt-0.5 block text-[13px] font-semibold text-[#b8864a]">
                        Get directions →
                      </span>
                    </span>
                  </a>
                )}
                <Link
                  href={row.cta.href}
                  className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#b8864a] transition hover:text-[#a07640]"
                >
                  {row.cta.label} <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
