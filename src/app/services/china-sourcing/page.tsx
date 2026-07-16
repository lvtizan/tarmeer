// 「Source New Materials from China」服务页 — AE 专属（spec §4 Agent 服务页归属）。
// 契约：docs/plans/china-materials-revamp-spec.md 验收 #3。
// 国家门禁：非 AE 站 metadata 与页面体统一 notFound()（全站新页面统一写法）。

import type { Metadata } from 'next';
import { headers } from 'next/headers';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  ArrowRight,
  Building2,
  CheckCircle2,
  ClipboardList,
  Container,
  FileBadge,
  Gem,
  LayoutGrid,
  SearchCheck,
  ShieldCheck,
  Tags,
  Truck,
  Wrench,
} from 'lucide-react';
import SourcingHero from '@/components/sourcing/SourcingHero';
import SourcingRequestForm from '@/components/sourcing/SourcingRequestForm';
import { getCountry } from '@/lib/country';
import { jsonLdHtml } from '@/lib/schema/jsonLdScript';

export const dynamic = 'force-dynamic';

const PAGE_PATH = '/services/china-sourcing';
const FORM_ANCHOR = 'sourcing-form';

// ─── 文案数据（单一来源：FAQ 同时渲染页面与 FAQPage JSON-LD） ─────────────────

// 中国在地接待能力（③b 区块，对应策划案：双语顾问/工厂接待/考察行程）
const HOST_POINTS = [
  {
    title: 'Bilingual consultants, in person',
    body: 'English- and Chinese-speaking specialists walk the showrooms with you — translating specs, prices and negotiations on the spot.',
  },
  {
    title: 'Hosted factory & showroom visits',
    body: 'From airport pickup to factory floor in Foshan and across Guangdong, your itinerary is arranged and accompanied end to end.',
  },
  {
    title: 'Eyes on your order after you fly home',
    body: 'The same team that hosted you stays on the ground for production checks, QC and loading — you always know a person, not a portal.',
  },
  {
    title: 'One WhatsApp away',
    body: 'Direct line to your consultant before, during and after the trip — questions answered in your language, in your timezone.',
  },
];

// 真实接待瞬间照（客户面部已脱敏，团队真脸保留）
const TOUR_PHOTOS = [
  { src: 'tour-1', alt: 'Tarmeer team walking Gulf clients through a tile showroom in China' },
  { src: 'tour-2', alt: 'Consultant explaining large-format slabs to a client at a China showroom' },
  { src: 'tour-3', alt: 'Team presenting stone materials to visiting clients in China' },
];

const VALUE_CARDS = [
  {
    icon: Gem,
    title: 'Curated New Materials',
    body: 'We track China’s newest material releases and curate only what performs — no catalogue noise, just materials worth building with.',
  },
  {
    icon: Tags,
    title: 'Transparent Factory Pricing',
    body: 'Ex-factory prices with freight and duties itemised — you see exactly what you pay for at every step.',
  },
  {
    icon: ShieldCheck,
    title: 'End-to-end Quality Control',
    body: 'Factory QC before shipping and inspection again on arrival — spec mismatches never reach handover.',
  },
  {
    icon: Building2,
    title: 'Local Backing in the UAE',
    body: 'Every order is backed by a physical building-materials mall in the UAE — with stock, staff and warranty.',
  },
];

const PROCESS_STEPS = [
  {
    icon: LayoutGrid,
    title: 'Material Selection',
    body: 'Choose from China’s newest materials at our UAE selection center, or browse the curated online catalogue.',
  },
  {
    icon: ClipboardList,
    title: 'Order Placement',
    body: 'We place and manage your order directly with vetted factories in China at transparent ex-factory pricing.',
  },
  {
    icon: SearchCheck,
    title: 'Factory QC',
    body: 'Materials are inspected at the factory before shipping — dimensions, finish, batch consistency and packaging.',
  },
  {
    icon: Container,
    title: 'Consolidation',
    body: 'Orders are consolidated into shared containers, keeping freight costs low even for small quantities.',
  },
  {
    icon: FileBadge,
    title: 'Import & Certification',
    body: 'We handle sea freight, UAE customs clearance and the compliance certificates your project requires.',
  },
  {
    icon: Truck,
    title: 'Delivery',
    body: 'Materials are delivered to your site in the UAE and inspected together with you on arrival.',
  },
  {
    icon: Wrench,
    title: 'Local After-sales',
    body: 'A clear warranty period, free defect replacement and a local support desk — backed by our building-materials mall.',
  },
];

const FAQS = [
  {
    q: 'How long does delivery take?',
    a: 'Most orders arrive within 4–8 weeks through consolidated container shipping from China to the UAE. Materials we keep in local stock at our building-materials mall can be supplied immediately.',
  },
  {
    q: 'Is there a minimum order quantity (MOQ)?',
    a: 'No fixed MOQ on our side. Because we consolidate multiple orders into shared containers, we can source quantities factories would normally reject — from a single feature wall to a full villa’s worth of materials.',
  },
  {
    q: 'How is quality guaranteed?',
    a: 'Every order passes factory quality control in China before it ships, and is inspected again on arrival in the UAE. If materials don’t match the agreed specifications, we don’t hand them over — replacement is arranged at no extra cost.',
  },
  {
    q: 'Who handles import, customs and certification?',
    a: 'We do. Tarmeer manages export documentation, sea freight, UAE customs clearance and the local compliance certificates your project requires — you receive materials that are ready to install.',
  },
  {
    q: 'Who do I contact if something goes wrong?',
    a: 'Our local support desk in the UAE. Every order is backed by our physical building-materials mall, with a clear warranty period, free defect replacement and a local team that answers.',
  },
];

// ─── Next.js exports ──────────────────────────────────────────────────────────

export async function generateMetadata(): Promise<Metadata> {
  const c = getCountry((await headers()).get('x-country'));
  // AE 专属路由：非 AE 站 metadata 与页面体同口径 notFound（全站新页面统一写法）
  if (c.code !== 'ae') notFound();
  const canonical = `${c.baseUrl}${PAGE_PATH}`;
  const description =
    'Source China’s newest building materials with Tarmeer: curated selection, factory QC, consolidated shipping, UAE customs & certification, on-site delivery and local after-sales — all guaranteed by a local building-materials mall.';
  return {
    title: 'Source New Materials from China — Curated, QC’d & Guaranteed | Tarmeer UAE',
    description,
    keywords: [
      'source materials from China UAE',
      'China building materials import Dubai',
      'new materials sourcing service',
      'consolidated shipping China UAE',
      'building materials mall UAE',
      'Tarmeer sourcing',
    ],
    robots: { index: true, follow: true },
    alternates: { canonical },
    openGraph: {
      type: 'website',
      title: 'Source New Materials from China | Tarmeer UAE',
      description,
      url: canonical,
      images: [{ url: `${c.baseUrl}/images/sourcing/hero-sourcing.webp`, width: 1200, height: 630, alt: 'Source new materials from China with Tarmeer' }],
    },
    twitter: { card: 'summary_large_image' },
  };
}

export default async function ChinaSourcingPage() {
  const c = getCountry((await headers()).get('x-country'));
  // 国家隔离铁律：本页 AE 专属，非 AE 站一律 notFound（禁软 404）
  if (c.code !== 'ae') notFound();

  const canonical = `${c.baseUrl}${PAGE_PATH}`;

  const serviceJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Service',
    name: 'China Materials Sourcing Service',
    description:
      'End-to-end sourcing of new building materials from China to the UAE: curation, factory QC, consolidated shipping, import certification, delivery and local after-sales.',
    provider: { '@type': 'Organization', name: 'Tarmeer', url: c.baseUrl },
    areaServed: { '@type': 'Country', name: c.fullName },
    serviceType: 'Building Materials Sourcing',
    url: canonical,
  };

  const faqJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: FAQS.map((f) => ({
      '@type': 'Question',
      name: f.q,
      acceptedAnswer: { '@type': 'Answer', text: f.a },
    })),
  };

  return (
    <div className="min-h-screen bg-[#faf9f7]">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdHtml(serviceJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdHtml(faqJsonLd) }} />

      {/* ① Hero */}
      <SourcingHero
        imageBase="hero-sourcing"
        imageAlt="Curated new building materials sourced from China, displayed at Tarmeer's UAE selection center"
        eyebrow="China Sourcing Service"
        title="Access China's newest materials — curated, quality-checked, delivered and guaranteed in the UAE"
        subtitle="From selection to after-sales, one team manages the entire journey — so you get factory-fresh materials without the import headache."
      >
        <a
          href={`#${FORM_ANCHOR}`}
          className="inline-flex h-12 items-center gap-2 rounded-lg bg-[#b8864a] px-6 text-sm font-semibold text-white transition hover:bg-[#a07640]"
        >
          Start Your Sourcing Plan
          <ArrowRight className="h-4 w-4" />
        </a>
        <a
          href="#process"
          className="inline-flex h-12 items-center rounded-lg border border-white/40 px-6 text-sm font-semibold text-white transition hover:border-white hover:bg-white/10"
        >
          How It Works
        </a>
      </SourcingHero>

      {/* ② Why source through Tarmeer */}
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-20">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="font-serif text-2xl font-bold text-[#2c2c2c] sm:text-3xl">Why source through Tarmeer</h2>
          <p className="mt-3 text-sm leading-relaxed text-stone-500 sm:text-base">
            Buying directly from China is powerful — but only if someone stands behind every shipment. We do.
          </p>
        </div>
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {VALUE_CARDS.map(({ icon: Icon, title, body }) => (
            <div key={title} className="rounded-xl border border-stone-200 bg-white p-6">
              <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-[#b8864a]/10">
                <Icon className="h-5 w-5 text-[#b8864a]" />
              </div>
              <h3 className="mt-4 text-base font-semibold text-[#2c2c2c]">{title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-stone-500">{body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ③ 7-step process — 垂直时间线 */}
      <section id="process" className="scroll-mt-24 bg-white py-16 sm:py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-[#b8864a]">The Process</p>
            <h2 className="mt-2 font-serif text-2xl font-bold text-[#2c2c2c] sm:text-3xl">
              From factory floor in China to your site in the UAE
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-stone-500 sm:text-base">
              Seven steps, one accountable team — every stage handled and documented.
            </p>
          </div>
          <ol className="mx-auto mt-12 max-w-3xl">
            {PROCESS_STEPS.map(({ icon: Icon, title, body }, i) => (
              <li key={title} className="relative flex gap-5 pb-10 last:pb-0">
                {/* 时间线竖线（最后一步不画） */}
                {i < PROCESS_STEPS.length - 1 && (
                  <span aria-hidden className="absolute left-[23px] top-12 h-[calc(100%-3rem)] w-px bg-stone-200" />
                )}
                <div className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-[#b8864a]/30 bg-[#faf9f7]">
                  <Icon className="h-5 w-5 text-[#b8864a]" />
                </div>
                <div className="pt-1">
                  <p className="text-xs font-semibold uppercase tracking-wider text-stone-400">Step {i + 1}</p>
                  <h3 className="mt-0.5 text-base font-semibold text-[#2c2c2c] sm:text-lg">{title}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-stone-500">{body}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ③b 中国在地接待团队 — 真人形象传达亲切与可落地接待（2026-07-16 需求） */}
      <section className="bg-[#faf8f5] py-16 sm:py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-14">
            {/* 左：真实接待合影（团队在中国瓷砖展厅接待海湾客户） */}
            <div>
              <div className="aspect-video overflow-hidden rounded-2xl bg-stone-200">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/images/sourcing/team-clients-medium.webp"
                  srcSet="/images/sourcing/team-clients-thumb.webp 600w, /images/sourcing/team-clients-medium.webp 1200w, /images/sourcing/team-clients.webp 2000w"
                  sizes="(min-width: 1024px) 45vw, 100vw"
                  alt="Tarmeer team hosting Gulf clients at a building materials showroom in China"
                  loading="lazy"
                  className="h-full w-full object-cover"
                />
              </div>
              <p className="mt-3 text-xs text-stone-400">
                Our team hosting overseas clients at a partner showroom in China.
              </p>
            </div>

            {/* 右：接待能力文案 */}
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.25em] text-[#b8864a]">Your Team in China</p>
              <h2 className="mt-2 font-serif text-2xl font-bold text-[#2c2c2c] sm:text-3xl">
                Real people receive you on the ground in China
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-stone-500 sm:text-base">
                Sourcing from China isn&apos;t a website and a tracking number. Our own consultants live where the
                factories are — and they host you like a guest, not a purchase order.
              </p>
              <ul className="mt-7 space-y-4">
                {HOST_POINTS.map(({ title, body }) => (
                  <li key={title} className="flex items-start gap-3">
                    <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-[#b8864a]" />
                    <div>
                      <p className="text-sm font-semibold text-[#2c2c2c]">{title}</p>
                      <p className="mt-0.5 text-sm leading-relaxed text-stone-500">{body}</p>
                    </div>
                  </li>
                ))}
              </ul>
              <a
                href={`#${FORM_ANCHOR}`}
                className="mt-8 inline-flex h-12 items-center gap-2 rounded-lg bg-[#b8864a] px-6 text-sm font-semibold text-white transition hover:bg-[#a07640]"
              >
                Plan a Visit With Our Team
                <ArrowRight className="h-4 w-4" />
              </a>
            </div>
          </div>

          {/* 真实接待瞬间图组（客户面部隐私脱敏，团队真脸保留） */}
          <div className="mt-12">
            <p className="text-center text-xs font-semibold uppercase tracking-[0.25em] text-[#b8864a]">
              Moments From Real Client Visits
            </p>
            <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
              {TOUR_PHOTOS.map((t) => (
                <div key={t.src} className="overflow-hidden rounded-2xl bg-stone-200">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={`/images/sourcing/${t.src}-medium.webp`}
                    srcSet={`/images/sourcing/${t.src}-thumb.webp 600w, /images/sourcing/${t.src}-medium.webp 1200w`}
                    sizes="(min-width: 640px) 33vw, 100vw"
                    alt={t.alt}
                    loading="lazy"
                    className="aspect-video h-full w-full object-cover"
                  />
                </div>
              ))}
            </div>
            <p className="mt-3 text-center text-xs text-stone-400">
              Real client visits at partner showrooms in China. Client faces are blurred for privacy.
            </p>
          </div>
        </div>
      </section>

      {/* ④ 信任条 → /guarantee */}
      <section className="bg-[#1c1917] py-14 sm:py-16">
        <div className="mx-auto flex max-w-7xl flex-col items-center gap-6 px-4 text-center sm:px-6 lg:flex-row lg:justify-between lg:text-left">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-[#d8b98c]">Local Guarantee</p>
            <h2 className="mt-2 font-serif text-2xl font-bold text-white sm:text-3xl">
              Backed by a local building-materials mall
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-white/70 sm:text-base">
              Your sourcing isn&apos;t left overseas. Delivery, warranty and replacement are all guaranteed by our
              physical mall in the UAE — with local stock and a local team.
            </p>
          </div>
          <Link
            href="/guarantee"
            className="inline-flex h-12 shrink-0 items-center gap-2 rounded-lg border border-[#d8b98c]/60 px-6 text-sm font-semibold text-[#d8b98c] transition hover:border-[#d8b98c] hover:bg-[#d8b98c]/10"
          >
            See Our Guarantee
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      {/* ⑤ FAQ */}
      <section className="mx-auto max-w-3xl px-4 py-16 sm:px-6 sm:py-20">
        <h2 className="text-center font-serif text-2xl font-bold text-[#2c2c2c] sm:text-3xl">
          Frequently asked questions
        </h2>
        <div className="mt-8 space-y-3">
          {FAQS.map((f) => (
            <details key={f.q} className="group rounded-xl border border-stone-200 bg-white p-5">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-sm font-semibold text-[#2c2c2c] sm:text-base [&::-webkit-details-marker]:hidden">
                {f.q}
                <span
                  aria-hidden
                  className="shrink-0 text-lg leading-none text-[#b8864a] transition-transform group-open:rotate-45"
                >
                  +
                </span>
              </summary>
              <p className="mt-3 text-sm leading-relaxed text-stone-500">{f.a}</p>
            </details>
          ))}
        </div>
      </section>

      {/* ⑥ 表单区（hero CTA 锚点目标；移动端自然堆叠可达） */}
      <section id={FORM_ANCHOR} className="scroll-mt-24 border-t border-stone-200 bg-white py-16 sm:py-20">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 sm:px-6 lg:grid-cols-2 lg:items-start">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-[#b8864a]">Get Started</p>
            <h2 className="mt-2 font-serif text-2xl font-bold text-[#2c2c2c] sm:text-3xl">
              Tell us what you&apos;re sourcing
            </h2>
            <p className="mt-3 max-w-md text-sm leading-relaxed text-stone-500 sm:text-base">
              Share your project and material needs — a sourcing specialist will prepare options, pricing and
              timelines for you.
            </p>
            <ul className="mt-6 space-y-3">
              {[
                'Response within one business day',
                'Free sourcing consultation — no obligation',
                'Every order backed by our local guarantee',
              ].map((item) => (
                <li key={item} className="flex items-start gap-3 text-sm text-[#2c2c2c]">
                  <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-[#b8864a]" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
          <SourcingRequestForm variant="sourcing" className="lg:sticky lg:top-24 lg:max-w-md" />
        </div>
      </section>
    </div>
  );
}
