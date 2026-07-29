// AE 首页「How it works」三步（2026-07-20 重设计：只留三步卡，价值点并入 HomeWhyUs，CTA 由 Hero/结尾表单承担）
// AE 专用，不进 i18n；纯 server component（无状态）。
import { Fragment } from 'react';
import Link from 'next/link';
import { LayoutGrid, Factory, ShieldCheck, ArrowRight, ArrowDown } from 'lucide-react';

const STEPS: {
  n: string;
  icon: typeof LayoutGrid;
  img: string;
  title: string;
  desc: string;
  href: string;
  linkLabel: string;
}[] = [
  {
    n: '01',
    icon: LayoutGrid,
    img: 'step-select',
    title: 'Select your materials',
    desc: 'Browse online or visit our UAE selection center in person.',
    href: '/materials/showroom',
    linkLabel: 'Selection center',
  },
  {
    n: '02',
    icon: Factory,
    img: 'step-source',
    title: 'We source from China',
    desc: 'Factory-direct, quality-checked and consolidated for you.',
    href: '/services/china-sourcing',
    linkLabel: 'How sourcing works',
  },
  {
    n: '03',
    icon: ShieldCheck,
    img: 'step-deliver',
    title: 'Local delivery & guarantee',
    desc: 'Delivered in the UAE, backed by a local after-sales guarantee.',
    href: '/guarantee',
    linkLabel: 'Our guarantee',
  },
];

export default function HomeHowItWorks() {
  return (
    <section className="bg-[#faf8f5] py-14 sm:py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        {/* 标题 */}
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-[10px] uppercase tracking-[0.22em] text-[#b8864a]">How It Works</p>
          <h2 className="mt-2 font-serif text-[26px] leading-tight tracking-[-0.01em] [text-wrap:balance] text-[#1c1917] sm:text-[34px]">
            China&apos;s newest materials, in three steps
          </h2>
        </div>

        {/* 三步流程：卡片 + 1→2→3 箭头 */}
        <div className="mt-10 flex flex-col gap-4 sm:flex-row sm:items-stretch sm:gap-2">
          {STEPS.map((s, i) => (
            <Fragment key={s.n}>
            <div
              className="flex flex-1 flex-col overflow-hidden rounded-2xl border border-stone-200 bg-white transition hover:border-[#b8864a]/40 hover:shadow-sm"
            >
              {/* 场景图 + 序号角标 */}
              <div className="relative aspect-[16/10] overflow-hidden bg-stone-100">
                <img
                  src={`/images/sourcing/${s.img}-medium.webp`}
                  srcSet={`/images/sourcing/${s.img}-thumb.webp 600w, /images/sourcing/${s.img}-medium.webp 1200w`}
                  sizes="(min-width:640px) 33vw, 100vw"
                  alt={s.title}
                  loading="lazy"
                  className="h-full w-full object-cover"
                />
                <span className="absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full bg-[#1c1917]/85 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-white backdrop-blur-sm">
                  <s.icon className="h-3.5 w-3.5 text-[#d8b487]" />
                  Step {s.n}
                </span>
              </div>
              {/* 文字 */}
              <div className="flex flex-1 flex-col p-6">
                <h3 className="font-serif text-lg font-bold text-[#1c1917]">{s.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-stone-500">{s.desc}</p>
                <Link
                  href={s.href}
                  className="mt-3 inline-flex items-center gap-1 text-[13px] font-semibold text-[#b8864a] transition hover:text-[#a07640]"
                >
                  {s.linkLabel} <span aria-hidden>→</span>
                </Link>
              </div>
            </div>
            {i < STEPS.length - 1 && (
              <div className="flex items-center justify-center sm:w-8">
                <ArrowRight className="hidden h-6 w-6 text-[#b8864a]/50 sm:block" />
                <ArrowDown className="h-6 w-6 text-[#b8864a]/50 sm:hidden" />
              </div>
            )}
            </Fragment>
          ))}
        </div>
      </div>
    </section>
  );
}
