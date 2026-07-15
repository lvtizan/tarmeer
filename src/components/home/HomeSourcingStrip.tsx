// AE 首页「采购流程」4 步摘要横条（改版 spec §5 ③，AE 专用，不进 i18n）
// 完整流程页：/services/china-sourcing（服务页 agent 产出）
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';

const STEPS = [
  { num: '01', title: 'Select', desc: 'Pick materials from our curated catalogue — or bring your own spec.' },
  { num: '02', title: 'We Source & QC', desc: 'We negotiate directly with factories in China and inspect every order.' },
  { num: '03', title: 'Import & Deliver', desc: 'Shipping, customs and last-mile delivery handled end to end.' },
  { num: '04', title: 'Local Guarantee', desc: 'Backed by our UAE building-materials mall, before and after handover.' },
];

export default function HomeSourcingStrip() {
  return (
    <section className="bg-[#1c1917] py-10 sm:py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="flex items-end justify-between mb-7">
          <div>
            <p className="text-[10px] uppercase tracking-[0.22em] text-[#b8864a] mb-1.5">China Sourcing</p>
            <h2 className="font-serif text-[24px] leading-tight tracking-[-0.01em] text-white sm:text-[28px]">
              How China Sourcing Works
            </h2>
          </div>
          <Link href="/services/china-sourcing" className="hidden sm:inline-flex items-center gap-2 text-sm font-medium text-[#b8864a] hover:text-[#d4a866] transition">
            See the Full Process <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((step) => (
            <div key={step.num} className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
              <p className="font-serif text-2xl text-[#b8864a]">{step.num}</p>
              <h3 className="mt-2 text-[15px] font-semibold text-white">{step.title}</h3>
              <p className="mt-1.5 text-[13px] leading-5 text-white/60">{step.desc}</p>
            </div>
          ))}
        </div>

        <div className="mt-5 flex justify-center sm:hidden">
          <Link href="/services/china-sourcing" className="inline-flex items-center gap-2 text-sm font-medium text-[#b8864a]">
            See the Full Process <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </section>
  );
}
