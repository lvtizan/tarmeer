// AE 首页结尾「Get a Quote」收口区（2026-07-20 重设计新增）— 单页叙事终点，转化收在表单。
// 左：标题 + 一行；右：既有 SourcingRequestForm sourcing 变体（不重造表单）。AE 专用，不进 i18n。
import SourcingRequestForm from '@/components/sourcing/SourcingRequestForm';

const BG = '/images/sourcing/china-factory';

export default function HomeContactForm() {
  return (
    <section className="relative isolate overflow-hidden bg-[#1c1917] py-14 sm:py-20">
      {/* 压暗背景图（呼应中国采购）+ 左深渐变遮罩，保左文可读、右侧白卡浮出 */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={`${BG}-medium.webp`}
        srcSet={`${BG}-thumb.webp 600w, ${BG}-medium.webp 1200w, ${BG}.webp 2000w`}
        sizes="100vw"
        alt=""
        aria-hidden="true"
        loading="lazy"
        className="absolute inset-0 -z-10 h-full w-full object-cover"
      />
      <div className="absolute inset-0 -z-10 bg-[linear-gradient(90deg,rgba(28,25,23,0.94)_0%,rgba(28,25,23,0.86)_50%,rgba(28,25,23,0.74)_100%)]" />

      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="grid items-center gap-10 lg:grid-cols-[1fr_440px] lg:gap-16">
          {/* 左：极简收口文案 */}
          <div>
            <p className="text-[10px] uppercase tracking-[0.22em] text-[#c6a065]">Start Your Project</p>
            <h2 className="mt-2 font-serif text-[30px] leading-tight tracking-[-0.01em] [text-wrap:balance] text-white sm:text-[40px]">
              Get a Quote
            </h2>
            <p className="mt-4 max-w-md text-sm leading-relaxed text-white/60 sm:text-base">
              Tell us what you&apos;re sourcing — a specialist replies within one business day.
            </p>
          </div>

          {/* 右：既有采购咨询表单（白卡浮在深色上） */}
          <SourcingRequestForm
            variant="sourcing"
            title="Plan Your China Sourcing"
            subtitle="Materials, quantities or just an idea — all welcome."
          />
        </div>
      </div>
    </section>
  );
}
