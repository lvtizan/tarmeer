// AE 首页「Why choose us」6 价值卡（2026-07-20 重设计：合并原 HomeSourcingStrip + HomeGuaranteeStrip）
// 深色区制造叙事节奏；每卡 图标 + 标题 + 一行，克制文案。AE 专用，不进 i18n；纯 server component。
import Link from 'next/link';
import { ArrowRight, Store, Sparkles, Wallet, Truck, Languages, SearchCheck } from 'lucide-react';

const VALUES: { icon: typeof Sparkles; title: string; line: string }[] = [
  {
    icon: Store,
    title: 'A selection center in Dubai',
    line: 'See and touch the materials locally — no need to fly to China.',
  },
  {
    icon: Sparkles,
    title: "Materials you can't find in Dubai",
    line: 'The newest surfaces, straight from Chinese factories.',
  },
  {
    icon: Wallet,
    title: 'Factory-direct pricing',
    line: 'No layers of middlemen between you and the source.',
  },
  {
    icon: Truck,
    title: 'Local delivery & guarantee',
    line: 'Delivered in the UAE, warranty honoured locally.',
  },
  {
    icon: Languages,
    title: 'Bilingual team',
    line: 'Consultants who host you in Dubai and in China.',
  },
  {
    icon: SearchCheck,
    title: 'Quality-checked before shipping',
    line: 'Every order inspected at the factory.',
  },
];

export default function HomeWhyUs() {
  return (
    <section className="bg-[#1c1917] py-14 sm:py-20">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-[10px] uppercase tracking-[0.22em] text-[#c6a065]">Why Choose Us</p>
            <h2 className="mt-2 font-serif text-[26px] leading-tight tracking-[-0.01em] text-white sm:text-[34px]">
              See it in Dubai, sourced from China
            </h2>
          </div>
          <Link
            href="/guarantee"
            className="inline-flex items-center gap-2 text-sm font-medium text-[#c6a065] transition hover:text-white"
          >
            Our guarantee <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {VALUES.map(({ icon: Icon, title, line }) => (
            <div
              key={title}
              className="rounded-2xl border border-white/10 bg-white/[0.04] p-6 transition hover:border-[#c6a065]/40"
            >
              <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-[#c6a065]/10 text-[#c6a065]">
                <Icon className="h-5 w-5" />
              </span>
              <h3 className="mt-4 font-serif text-lg font-bold text-white">{title}</h3>
              <p className="mt-1.5 text-[13px] leading-5 text-white/55">{line}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
