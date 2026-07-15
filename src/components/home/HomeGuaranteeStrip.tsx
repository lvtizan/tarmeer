// AE 首页「本地担保」3 承诺条（改版 spec §5 ④，AE 专用，不进 i18n）
// 详情页：/guarantee（服务页 agent 产出）；侧图由图片 agent 产出。
import Link from 'next/link';
import { ArrowRight, Truck, ShieldCheck, Warehouse } from 'lucide-react';

const GUARANTEE_IMG_BASE = '/images/sourcing/hero-guarantee';

const PROMISES = [
  {
    icon: Truck,
    title: 'Delivery Guarantee',
    desc: 'On-time delivery commitments on every order, tracked from factory to your site.',
  },
  {
    icon: ShieldCheck,
    title: 'After-sales Warranty',
    desc: 'Warranty honoured locally in the UAE — no chasing overseas factories.',
  },
  {
    icon: Warehouse,
    title: 'Local Stock',
    desc: 'Fast-moving materials held in our UAE mall, ready for immediate supply.',
  },
];

export default function HomeGuaranteeStrip() {
  return (
    <section className="bg-white py-10 sm:py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="grid grid-cols-1 items-center gap-8 lg:grid-cols-[1fr_360px]">
          <div>
            <p className="text-[10px] uppercase tracking-[0.22em] text-stone-400 mb-1.5">Local Guarantee</p>
            <h2 className="font-serif text-[24px] leading-tight tracking-[-0.01em] text-[#1c1917] sm:text-[28px]">
              Guaranteed by a Local Building-Materials Mall
            </h2>
            <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
              {PROMISES.map((promise) => (
                <div key={promise.title} className="rounded-2xl border border-stone-200 bg-[#faf9f7] p-5">
                  <promise.icon className="h-6 w-6 text-[#b8864a]" />
                  <h3 className="mt-3 text-[15px] font-semibold text-[#1c1917]">{promise.title}</h3>
                  <p className="mt-1.5 text-[13px] leading-5 text-stone-500">{promise.desc}</p>
                </div>
              ))}
            </div>
            <Link href="/guarantee" className="mt-6 inline-flex items-center gap-2 text-sm font-medium text-[#b8864a] hover:text-[#9a7040] transition">
              Learn About Our Guarantee <ArrowRight className="w-4 h-4" />
            </Link>
          </div>

          <div className="relative hidden aspect-[4/5] overflow-hidden rounded-2xl bg-stone-100 lg:block">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`${GUARANTEE_IMG_BASE}.webp`}
              srcSet={`${GUARANTEE_IMG_BASE}-thumb.webp 600w, ${GUARANTEE_IMG_BASE}-medium.webp 1200w`}
              sizes="360px"
              alt="Local UAE building-materials mall backing every order"
              loading="lazy"
              className="absolute inset-0 h-full w-full object-cover"
            />
          </div>
        </div>
      </div>
    </section>
  );
}
