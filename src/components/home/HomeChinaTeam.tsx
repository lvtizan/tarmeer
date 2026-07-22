// AE 首页「Selection center + 在地团队」区块（2026-07-20 重设计：一行副文 + 3 要点，长段落删除）
// 真实照片（客户面部隐私模糊），链接到 /services/china-sourcing。server component。
import Link from 'next/link';
import { ArrowRight, Store, Languages, Plane } from 'lucide-react';
import TeamPhotoCarousel from './TeamPhotoCarousel';

const POINTS = [
  { icon: Store, text: 'A physical selection center in the UAE' },
  { icon: Languages, text: 'Bilingual consultants who host you in person' },
  { icon: Plane, text: 'Factory & showroom visits arranged end to end' },
];

export default function HomeChinaTeam() {
  return (
    <section className="bg-white py-14 sm:py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="grid items-center gap-8 lg:grid-cols-2 lg:gap-14">
          {/* 真实接待多图切换轮播（合影 + 看厂照，客户面部脱敏） */}
          <TeamPhotoCarousel />

          {/* 文案 */}
          <div>
            <p className="text-[10px] uppercase tracking-[0.22em] text-[#b8864a]">Selection Center &amp; Team</p>
            <h2 className="mt-2 font-serif text-[26px] leading-tight text-[#1c1917] sm:text-[34px]">
              Real people receive you on the ground
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-stone-500 sm:text-base">
              A showroom in the UAE, our own consultants in China.
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
