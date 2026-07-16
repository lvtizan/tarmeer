// AE 首页「中国在地接待团队」区块 — 真实接待合影提到首页高位（改版反馈 2026-07-16）
// 真实照片（客户面部隐私模糊），链接到 /services/china-sourcing。server component。
import Link from 'next/link';
import { ArrowRight, Languages, Plane, ShieldCheck } from 'lucide-react';

const POINTS = [
  { icon: Languages, text: 'Bilingual consultants who host you in person' },
  { icon: Plane, text: 'Factory & showroom visits arranged end to end' },
  { icon: ShieldCheck, text: 'Delivery & after-sales guaranteed back in the UAE' },
];

export default function HomeChinaTeam() {
  return (
    <section className="bg-[#faf8f5] py-14 sm:py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="grid items-center gap-8 lg:grid-cols-2 lg:gap-14">
          {/* 真实接待合影 */}
          <div className="overflow-hidden rounded-2xl bg-stone-200">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/images/sourcing/team-clients-medium.webp"
              srcSet="/images/sourcing/team-clients-thumb.webp 600w, /images/sourcing/team-clients-medium.webp 1200w, /images/sourcing/team-clients.webp 2000w"
              sizes="(min-width: 1024px) 50vw, 100vw"
              alt="Tarmeer team hosting overseas clients at a building materials showroom in China"
              loading="lazy"
              className="aspect-video h-full w-full object-cover"
            />
          </div>

          {/* 文案 */}
          <div>
            <p className="text-[10px] uppercase tracking-[0.22em] text-[#b8864a]">Your Team in China</p>
            <h2 className="mt-2 font-serif text-[26px] leading-tight text-[#1c1917] sm:text-[34px]">
              Real people receive you on the ground
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-stone-500 sm:text-base">
              Sourcing from China isn&apos;t a website and a tracking number. Our own consultants live where the
              factories are — and they host you like a guest, not a purchase order.
            </p>
            <ul className="mt-6 space-y-3">
              {POINTS.map(({ icon: Icon, text }) => (
                <li key={text} className="flex items-start gap-3">
                  <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#f5f0e8] text-[#b8864a]">
                    <Icon className="h-4.5 w-4.5" />
                  </span>
                  <span className="pt-1.5 text-sm text-[#1c1917]">{text}</span>
                </li>
              ))}
            </ul>
            <Link
              href="/services/china-sourcing"
              className="mt-8 inline-flex h-12 items-center gap-2 rounded-lg bg-[#b8864a] px-6 text-sm font-semibold text-white transition hover:bg-[#a07640]"
            >
              How China Sourcing Works <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
