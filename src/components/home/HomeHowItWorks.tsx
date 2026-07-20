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
  href: string;
  linkLabel: string;
}[] = [
  {
    n: '01',
    icon: LayoutGrid,
    title: 'Select your materials',
    desc: 'Browse the library online, or visit our UAE selection center to see and touch the newest materials in person.',
    href: '/materials/showroom',
    linkLabel: 'Visit the selection center',
  },
  {
    n: '02',
    icon: Factory,
    title: 'We source from China',
    desc: 'We buy direct from leading Chinese factories, quality-check every order and consolidate it for shipping.',
    href: '/services/china-sourcing',
    linkLabel: 'How sourcing works',
  },
  {
    n: '03',
    icon: ShieldCheck,
    title: 'Local delivery & guarantee',
    desc: 'Delivered to your project in the UAE — backed by our local delivery commitment and after-sales warranty.',
    href: '/guarantee',
    linkLabel: 'Our local guarantee',
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
        {/* 标题 */}
        <div className="max-w-2xl">
          <p className="text-[10px] uppercase tracking-[0.22em] text-[#b8864a]">How It Works</p>
          <h2 className="mt-2 font-serif text-[26px] leading-tight tracking-[-0.01em] text-[#1c1917] sm:text-[34px]">
            China&apos;s newest materials, in three steps
          </h2>
          <p className="mt-3 text-[15px] leading-7 text-stone-500 sm:text-base">
            From the factory floor in China to your project in the UAE — curated, sourced and guaranteed by us.
          </p>
        </div>

        {/* 三步卡片 */}
        <div className="mt-10 grid gap-5 sm:grid-cols-3">
          {STEPS.map((s) => (
            <div
              key={s.n}
              className="flex flex-col rounded-2xl border border-stone-200 bg-white p-6 transition hover:border-[#b8864a]/40 hover:shadow-sm"
            >
              <div className="flex items-center justify-between">
                <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-[#b8864a]/10 text-[#b8864a]">
                  <s.icon className="h-5 w-5" />
                </span>
                <span className="font-serif text-4xl font-bold leading-none text-[#b8864a]/20">{s.n}</span>
              </div>
              <h3 className="mt-4 font-serif text-lg font-bold text-[#1c1917]">{s.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-stone-500">{s.desc}</p>
              <Link
                href={s.href}
                className="mt-3 inline-flex items-center gap-1 text-[13px] font-semibold text-[#b8864a] transition hover:text-[#a07640]"
              >
                {s.linkLabel} <span aria-hidden>→</span>
              </Link>
            </div>
          ))}
        </div>

        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            href="/materials"
            className="inline-flex h-11 items-center justify-center rounded-full bg-[#b8864a] px-7 text-sm font-semibold text-white transition hover:bg-[#a07640]"
          >
            Browse Materials
          </Link>
          <Link
            href="/for-designers"
            className="inline-flex h-11 items-center justify-center rounded-full border border-stone-300 px-7 text-sm font-semibold text-stone-700 transition hover:border-[#b8864a] hover:text-[#b8864a]"
          >
            For Designers
          </Link>
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
