// 「Visit Our Selection Center」预约区块 — /materials 产品流与供应商列表之间
// 左图 /images/sourcing/visit-2.webp（明亮大理石展厅+客户顾问，冷调；变体仅 thumb/medium）
// 右侧理念文案 + SourcingRequestForm variant='visit'。
// server component（无状态），表单为 client 子组件。
import { MapPin, ShieldCheck, Sparkles } from 'lucide-react';
import SourcingRequestForm from '@/components/sourcing/SourcingRequestForm';

const HIGHLIGHTS = [
  {
    icon: Sparkles,
    title: 'A curated selection center',
    body: 'Not a warehouse — a designed space where every material earned its place.',
  },
  {
    icon: MapPin,
    title: 'The newest materials from China',
    body: 'Sintered stone, microcement, smart fittings — touch them before you specify.',
  },
  {
    icon: ShieldCheck,
    title: 'Guaranteed locally',
    body: 'Sourced overseas, backed here in the UAE — delivery, installation and after-sales.',
  },
];

export default function ShowroomVisitSection() {
  return (
    // id="visit"：首页 hero「Book a Showroom Visit」CTA 的锚点目标（/materials#visit）
    <section id="visit" className="relative isolate scroll-mt-24 bg-[#faf8f5] border-b border-stone-200/60">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-12 sm:py-16">
        <div className="grid lg:grid-cols-2 gap-8 lg:gap-12 items-stretch">
          {/* Left: showroom image（显式 aspect 防 CLS；lg 拉伸填满与右列等高） */}
          <div className="rounded-2xl overflow-hidden bg-stone-200 aspect-[4/3] lg:aspect-auto lg:h-full lg:min-h-[480px]">
            <img
              src="/images/sourcing/visit-2-medium.webp"
              srcSet="/images/sourcing/visit-2-thumb.webp 600w, /images/sourcing/visit-2-medium.webp 1200w"
              sizes="(min-width: 1024px) 50vw, 100vw"
              alt="Tarmeer material selection center in Sharjah"
              loading="lazy"
              className="w-full h-full object-cover"
            />
          </div>

          {/* Right: copy + booking form */}
          <div className="flex flex-col justify-center">
            <p className="text-sm font-semibold text-[#b8864a] uppercase tracking-wider">
              Visit Our Selection Center
            </p>
            <h2 className="font-serif text-[24px] sm:text-[30px] text-[#1c1917] font-medium leading-tight mt-2">
              See It. Touch It. Specify It.
            </h2>
            <div className="space-y-4 mt-6">
              {HIGHLIGHTS.map(({ icon: Icon, title, body }) => (
                <div key={title} className="flex items-start gap-3">
                  <span className="inline-flex w-9 h-9 rounded-xl bg-[#f5f0e8] text-[#b8864a] items-center justify-center shrink-0 mt-0.5">
                    <Icon className="w-4.5 h-4.5" />
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-[#1c1917]">{title}</p>
                    <p className="text-[13px] text-stone-500 leading-relaxed mt-0.5">{body}</p>
                  </div>
                </div>
              ))}
            </div>
            <SourcingRequestForm variant="visit" className="mt-7" />
          </div>
        </div>
      </div>
    </section>
  );
}
