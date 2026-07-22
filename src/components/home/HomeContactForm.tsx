// AE 首页结尾「Get a Quote」收口区（2026-07-20 重设计新增）— 单页叙事终点，转化收在表单。
// 左：标题 + 一行；右：既有 SourcingRequestForm sourcing 变体（不重造表单）。AE 专用，不进 i18n。
import SourcingRequestForm from '@/components/sourcing/SourcingRequestForm';

export default function HomeContactForm() {
  return (
    <section className="bg-[#1c1917] py-14 sm:py-20">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="grid items-center gap-10 lg:grid-cols-[1fr_440px] lg:gap-16">
          {/* 左：极简收口文案 */}
          <div>
            <p className="text-[10px] uppercase tracking-[0.22em] text-[#c6a065]">Start Your Project</p>
            <h2 className="mt-2 font-serif text-[30px] leading-tight tracking-[-0.01em] text-white sm:text-[40px]">
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
