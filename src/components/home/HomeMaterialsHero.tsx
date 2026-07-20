// AE 首页新 Hero — 中国新材料主张（改版 spec §5 ①，AE 专用，不进 i18n）
// 图片由图片 agent 产出：/images/sourcing/hero-home.webp（+ -blur/-thumb/-medium 四档）
import Link from 'next/link';

const HERO_BASE = '/images/sourcing/hero-home';

export default function HomeMaterialsHero() {
  return (
    <section className="relative isolate flex min-h-[480px] items-center overflow-hidden sm:min-h-[560px]">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={`${HERO_BASE}.webp`}
        srcSet={`${HERO_BASE}-thumb.webp 600w, ${HERO_BASE}-medium.webp 1200w, ${HERO_BASE}.webp 2000w`}
        sizes="100vw"
        alt="Curated new building materials from China, displayed in a UAE showroom"
        loading="eager"
        fetchPriority="high"
        className="absolute inset-0 h-full w-full object-cover"
      />
      <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(0,0,0,0.62)_0%,rgba(0,0,0,0.48)_45%,rgba(0,0,0,0.28)_100%)]" />

      <div className="relative z-10 mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
        <div className="max-w-2xl">
          <p className="mb-3 text-xs font-medium uppercase tracking-[0.32em] text-white/80">
            China Sourcing &middot; Local Guarantee
          </p>
          <h1 className="font-serif text-4xl font-semibold tracking-tight text-white sm:text-5xl md:text-[3.5rem]">
            China&apos;s Newest Materials,
            <br />Curated for the UAE
          </h1>
          <p className="mt-4 max-w-xl text-base leading-7 text-white/88 sm:text-lg">
            Sourced direct from leading Chinese factories — delivered and guaranteed by a local building-materials mall.
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
