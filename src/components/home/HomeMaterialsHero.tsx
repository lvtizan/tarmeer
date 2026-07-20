// AE 首页新 Hero — 中国新材料主张（改版 spec §5 ①，AE 专用，不进 i18n）
// 首屏背景轮播「带客视察中国大板展厅」(HeroSlides，Agnes 生成，全身入镜不切头)，
// 左侧压暗渐变放文案（不用纯黑硬块），图满铺到视口两缘。
import Link from 'next/link';
import HeroSlides from './HeroSlides';

export default function HomeMaterialsHero() {
  return (
    <section className="relative isolate flex min-h-[520px] items-center overflow-hidden sm:min-h-[600px] lg:min-h-[640px]">
      <HeroSlides />

      {/* 左强右弱压暗：左侧文字可读，右侧展厅场景清晰 */}
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(90deg,rgba(20,18,16,0.90)_0%,rgba(20,18,16,0.74)_38%,rgba(20,18,16,0.40)_65%,rgba(20,18,16,0.20)_100%)]" />

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
