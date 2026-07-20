// AE 首页新 Hero — 中国新材料主张（改版 spec §5 ①，AE 专用，不进 i18n）
// 全幅「带客视察中国厂家」真实场景图(hero-home，Agnes 生成)，左侧压暗放文案（不用纯黑硬块）。
// 人物在画面偏后(头部约上 1/3)，全幅 object-center 不切头；左强右弱渐变保证白字可读、右侧场景清晰。
import Link from 'next/link';

const HERO_BASE = '/images/sourcing/hero-home';

export default function HomeMaterialsHero() {
  return (
    <section className="relative isolate flex min-h-[520px] items-center overflow-hidden sm:min-h-[600px] lg:min-h-[640px]">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={`${HERO_BASE}.webp`}
        srcSet={`${HERO_BASE}-thumb.webp 600w, ${HERO_BASE}-medium.webp 1200w, ${HERO_BASE}.webp 2000w`}
        sizes="100vw"
        alt="A Chinese factory manager guiding visiting Gulf clients on an inspection tour of a building-materials factory in China"
        loading="eager"
        fetchPriority="high"
        className="absolute inset-0 h-full w-full object-cover object-center"
      />
      {/* 左强右弱压暗：左侧文字可读，右侧厂区场景清晰 */}
      <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(20,18,16,0.90)_0%,rgba(20,18,16,0.74)_38%,rgba(20,18,16,0.40)_65%,rgba(20,18,16,0.20)_100%)]" />

      <div className="relative z-10 mx-auto w-full max-w-7xl px-4 sm:px-6">
        <div className="max-w-xl">
          <p className="mb-3 text-xs font-medium uppercase tracking-[0.32em] text-[#c6a065]">
            China Sourcing &middot; Local Guarantee
          </p>
          <h1 className="font-serif text-4xl font-semibold tracking-tight text-white sm:text-5xl md:text-[3.5rem]">
            China&apos;s Newest Materials,
            <br />Curated for the UAE
          </h1>
          <p className="mt-5 text-base leading-7 text-white/85 sm:text-lg">
            We take you to the factory floor in China, source the newest materials direct — then deliver
            and guarantee them through a local building-materials mall in the UAE.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
            <Link
              href="/materials"
              className="inline-flex h-12 items-center justify-center rounded-full bg-[#b8864a] px-8 text-base font-semibold text-white shadow-[0_16px_28px_rgba(184,134,74,0.28)] transition hover:bg-[#a07640]"
            >
              Browse Materials
            </Link>
            <Link
              href="/materials/showroom"
              className="inline-flex h-12 items-center justify-center rounded-full border border-white/70 px-8 text-base font-medium text-white transition hover:border-white hover:bg-white/10"
            >
              Visit the Selection Center
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
