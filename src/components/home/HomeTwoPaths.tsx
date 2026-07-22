// AE 首页「两种方式」区块（2026-07-20）——突出我们的差异：① 迪拜前置展厅看样 ② 设计师赴华考察团。
// 两张大图卡并排；文案克制（标签+标题+一行+入口）。AE 专用，不进 i18n；纯 server component。
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';

const PATHS: {
  tag: string;
  img: string;
  alt: string;
  title: string;
  line: string;
  cta: string;
  href: string;
}[] = [
  {
    tag: 'In Dubai',
    img: 'showroom',
    alt: 'Tarmeer selection center in the UAE with material samples on display',
    title: 'See samples at our Dubai showroom',
    line: 'Touch the newest materials locally — no need to fly to China first.',
    cta: 'Visit the selection center',
    href: '/materials/showroom',
  },
  {
    tag: 'In China',
    img: 'hero-real-1',
    alt: 'Designers touring a stone materials factory in China',
    title: 'Join a designer study tour',
    line: 'Fly to Foshan with us to inspect factories and materials first-hand.',
    cta: 'See the study tour',
    href: '/for-designers/china-tour',
  },
];

export default function HomeTwoPaths() {
  return (
    <section className="bg-white py-14 sm:py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="max-w-2xl">
          <p className="text-[10px] uppercase tracking-[0.22em] text-[#b8864a]">Two Ways to Source</p>
          <h2 className="mt-2 font-serif text-[26px] leading-tight tracking-[-0.01em] text-[#1c1917] sm:text-[34px]">
            See it in Dubai, or source it in China
          </h2>
        </div>

        <div className="mt-10 grid gap-5 lg:grid-cols-2">
          {PATHS.map((p) => (
            <Link
              key={p.href}
              href={p.href}
              className="group flex flex-col overflow-hidden rounded-2xl border border-stone-200 bg-white transition hover:border-[#b8864a]/40 hover:shadow-sm"
            >
              <div className="relative aspect-[16/9] overflow-hidden bg-stone-200">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`/images/sourcing/${p.img}-medium.webp`}
                  srcSet={`/images/sourcing/${p.img}-thumb.webp 600w, /images/sourcing/${p.img}-medium.webp 1200w`}
                  sizes="(min-width: 1024px) 50vw, 100vw"
                  alt={p.alt}
                  loading="lazy"
                  className="absolute inset-0 h-full w-full object-cover transition duration-500 group-hover:scale-105"
                />
                <span className="absolute left-4 top-4 rounded-full bg-white/90 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-[#b8864a] backdrop-blur">
                  {p.tag}
                </span>
              </div>
              <div className="p-6">
                <h3 className="font-serif text-xl font-bold text-[#1c1917]">{p.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-stone-500">{p.line}</p>
                <span className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-[#b8864a] transition group-hover:text-[#a07640]">
                  {p.cta} <ArrowRight className="h-4 w-4" />
                </span>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
