// AE 首页「一眼看懂」主线 — Hero 正下方，接待团队之前（2026-07-20 反馈：首页要一眼看懂业务）
// 两块：① 三步怎么运转（选材 → 中国采购+质检+拼柜 → 本地交付+担保）② 三点价值条。
// AE 专用，不进 i18n；纯 server component（无状态）。
import Link from 'next/link';
import { LayoutGrid, Factory, ShieldCheck, Sparkles, Wallet, MapPin } from 'lucide-react';

const STEPS: {
  n: string;
  icon: typeof LayoutGrid;
  title: string;
  desc: string;
}[] = [
  {
    n: '01',
    icon: LayoutGrid,
    title: 'Select your materials',
    desc: 'Browse the library online, or visit our UAE selection center to see and touch the newest materials in person.',
  },
  {
    n: '02',
    icon: Factory,
    title: 'We source from China',
    desc: 'We buy direct from leading Chinese factories, quality-check every order and consolidate it for shipping.',
  },
  {
    n: '03',
    icon: ShieldCheck,
    title: 'Local delivery & guarantee',
    desc: 'Delivered to your project in the UAE — backed by our local delivery commitment and after-sales warranty.',
  },
];

const VALUES: { icon: typeof Sparkles; title: string; desc: string }[] = [
  {
    icon: Sparkles,
    title: "Materials you can't find in the UAE",
    desc: 'The newest finishes from China — before they reach the wider market.',
  },
  {
    icon: Wallet,
    title: 'Factory-direct pricing',
    desc: 'Sourced straight from the factory floor, without the middle layers.',
  },
  {
    icon: MapPin,
    title: 'Backed locally',
    desc: 'A UAE building-materials mall stands behind delivery and after-sales.',
  },
];

export default function HomeHowItWorks() {
  return (
    <section className="bg-white py-14 sm:py-20">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-14">
          {/* 左：核心业务实景图——顾问带海湾客户在中国选材 */}
          <div className="overflow-hidden rounded-2xl bg-stone-200 aspect-[4/3]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/images/sourcing/people-hero-medium.webp"
              srcSet="/images/sourcing/people-hero-thumb.webp 600w, /images/sourcing/people-hero-medium.webp 1200w, /images/sourcing/people-hero.webp 2000w"
              sizes="(min-width: 1024px) 50vw, 100vw"
              alt="A Tarmeer consultant guiding Gulf clients through new building materials from China"
              loading="lazy"
              className="h-full w-full object-cover"
            />
          </div>

          {/* 右：一眼看懂——三步怎么运转 */}
          <div>
            <p className="text-[10px] uppercase tracking-[0.22em] text-[#b8864a]">How It Works</p>
            <h2 className="mt-2 font-serif text-[26px] leading-tight tracking-[-0.01em] text-[#1c1917] sm:text-[34px]">
              China&apos;s newest materials, in three steps
            </h2>
            <p className="mt-3 text-[15px] leading-7 text-stone-500 sm:text-base">
              From the factory floor in China to your project in the UAE — curated, sourced and guaranteed by us.
            </p>

            <ol className="mt-8 space-y-5">
              {STEPS.map((s) => (
                <li key={s.n} className="flex items-start gap-4">
                  <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#b8864a]/10 text-[#b8864a]">
                    <s.icon className="h-5 w-5" />
                  </span>
                  <div>
                    <h3 className="font-serif text-lg font-bold text-[#1c1917]">
                      <span className="text-[#b8864a]/50">{s.n}</span> &nbsp;{s.title}
                    </h3>
                    <p className="mt-1 text-sm leading-relaxed text-stone-500">{s.desc}</p>
                  </div>
                </li>
              ))}
            </ol>

            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/materials"
                className="inline-flex h-11 items-center justify-center rounded-full bg-[#b8864a] px-7 text-sm font-semibold text-white transition hover:bg-[#a07640]"
              >
                Browse Materials
              </Link>
              <Link
                href="/services/china-sourcing"
                className="inline-flex h-11 items-center justify-center rounded-full border border-stone-300 px-7 text-sm font-semibold text-stone-700 transition hover:border-[#b8864a] hover:text-[#b8864a]"
              >
                How sourcing works
              </Link>
            </div>
          </div>
        </div>

        {/* 三点价值条 */}
        <div className="mt-12 grid gap-px overflow-hidden rounded-2xl border border-stone-200 bg-stone-200 sm:grid-cols-3">
          {VALUES.map((v) => (
            <div key={v.title} className="flex items-start gap-3 bg-[#faf8f5] p-6">
              <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-[#b8864a]">
                <v.icon className="h-5 w-5" />
              </span>
              <div>
                <p className="text-sm font-semibold text-[#1c1917]">{v.title}</p>
                <p className="mt-1 text-[13px] leading-relaxed text-stone-500">{v.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
