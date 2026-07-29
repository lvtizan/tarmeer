// 「Local Delivery & After-sales Guarantee」担保页 — AE 专属（spec §4 Agent 服务页归属）。
// 契约：docs/plans/china-materials-revamp-spec.md 验收 #3。
// 国家门禁：非 AE 站 metadata 与页面体统一 notFound()（全站新页面统一写法）。

import type { Metadata } from 'next';
import { headers } from 'next/headers';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  ArrowRight,
  BadgeCheck,
  ClipboardCheck,
  Clock,
  Eye,
  Headset,
  MessageSquare,
  PackageCheck,
  RefreshCcw,
  Search,
  ShieldCheck,
  Truck,
  Warehouse,
  Wrench,
} from 'lucide-react';
import SourcingHero from '@/components/sourcing/SourcingHero';
import { getCountry } from '@/lib/country';
import { jsonLdHtml } from '@/lib/schema/jsonLdScript';

export const dynamic = 'force-dynamic';

const PAGE_PATH = '/guarantee';

// ─── 文案数据 ─────────────────────────────────────────────────────────────────

const PILLARS = [
  {
    icon: Truck,
    title: 'Delivery Guarantee',
    intro: 'Your materials arrive when promised — and only in the condition you agreed to.',
    points: [
      'On-time arrival with proactive status updates',
      'Every shipment inspected together with you on arrival',
      'No handover if materials don’t match the agreed specification',
      'Any delay is explained up front, with a revised date — never silence',
    ],
  },
  {
    icon: ShieldCheck,
    title: 'After-sales Warranty',
    intro: 'A clear, written warranty on every order — honoured by a local team.',
    points: [
      'Defined warranty period stated up front',
      'Manufacturing defects replaced free of charge',
      'A local desk in the UAE that answers, in person',
    ],
  },
  {
    icon: Warehouse,
    title: 'Local Stock Buffer',
    intro: 'Popular new materials are stocked locally, so you never wait on a container.',
    points: [
      'Common new materials held in stock at our UAE mall',
      'Immediate supply for urgent project needs',
      'A ready buffer for exchanges and replacements',
    ],
  },
];

const COMMITMENTS = [
  { icon: Clock, title: 'On-time Delivery', body: 'Agreed dates are honoured, with proactive updates — and any delay explained and re-dated, never left unspoken.' },
  { icon: PackageCheck, title: 'Inspection on Arrival', body: 'Every shipment is opened and checked with you before handover.' },
  { icon: ClipboardCheck, title: 'Spec-match Promise', body: 'If it doesn’t match the agreed specification, we don’t hand it over.' },
  { icon: RefreshCcw, title: 'Defect Replacement', body: 'Manufacturing defects are replaced free within the warranty period.' },
  { icon: Headset, title: 'Local Support Desk', body: 'A UAE-based team you can call, message or visit in person.' },
  { icon: Warehouse, title: 'Stock Buffer', body: 'Popular new materials kept in local stock for immediate supply and exchange.' },
  { icon: BadgeCheck, title: 'Certified Imports', body: 'Customs clearance and UAE compliance certificates handled on every order.' },
  { icon: Eye, title: 'Transparent Process', body: 'Itemised pricing and order visibility from factory to site.' },
];

const CLAIM_STEPS = [
  {
    icon: MessageSquare,
    title: 'Contact the Local Desk',
    body: 'Call, message or visit our building-materials mall in the UAE — your case is logged the same day.',
  },
  {
    icon: Search,
    title: 'Assessment',
    body: 'We inspect the materials on site or in store and confirm the resolution within days, not weeks.',
  },
  {
    icon: Wrench,
    title: 'Replacement or Fix',
    body: 'Defective items are replaced from local stock or reordered — resolved at no cost within warranty.',
  },
];

// ─── Next.js exports ──────────────────────────────────────────────────────────

export async function generateMetadata(): Promise<Metadata> {
  const c = getCountry((await headers()).get('x-country'));
  // AE 专属路由：非 AE 站 metadata 与页面体同口径 notFound（全站新页面统一写法）
  if (c.code !== 'ae') notFound();
  const canonical = `${c.baseUrl}${PAGE_PATH}`;
  const description =
    'Every material sourced from China through Tarmeer is guaranteed by a local building-materials mall in the UAE: on-time delivery, inspection on arrival, after-sales warranty, free defect replacement and local stock buffer.';
  return {
    title: 'Local Delivery & After-sales Guarantee | Tarmeer UAE',
    description,
    keywords: [
      'building materials guarantee UAE',
      'materials after-sales warranty Dubai',
      'delivery guarantee building materials',
      'China materials local warranty UAE',
      'Tarmeer guarantee',
    ],
    robots: { index: true, follow: true },
    alternates: { canonical },
    openGraph: {
      type: 'website',
      title: 'Local Delivery & After-sales Guarantee | Tarmeer UAE',
      description,
      url: canonical,
      images: [{ url: `${c.baseUrl}/images/sourcing/hero-guarantee.webp`, width: 1200, height: 630, alt: 'Tarmeer local delivery and after-sales guarantee' }],
    },
    twitter: { card: 'summary_large_image' },
  };
}

export default async function GuaranteePage() {
  const c = getCountry((await headers()).get('x-country'));
  // 国家隔离铁律：本页 AE 专属，非 AE 站一律 notFound（禁软 404）
  if (c.code !== 'ae') notFound();

  const canonical = `${c.baseUrl}${PAGE_PATH}`;

  const serviceJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Service',
    name: 'Local Delivery & After-sales Guarantee',
    description:
      'Delivery guarantee, after-sales warranty and local stock buffer for building materials sourced from China — backed by a physical building-materials mall in the UAE.',
    provider: { '@type': 'Organization', name: 'Tarmeer', url: c.baseUrl },
    areaServed: { '@type': 'Country', name: c.fullName },
    serviceType: 'Building Materials Guarantee & After-sales',
    url: canonical,
  };

  return (
    <div className="min-h-screen bg-[#faf9f7]">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdHtml(serviceJsonLd) }} />

      {/* ① Hero */}
      <SourcingHero
        imageBase="hero-guarantee"
        imageAlt="Tarmeer's local building-materials mall in the UAE, backing every order with delivery and after-sales guarantees"
        eyebrow="Local Delivery & After-sales Guarantee"
        title="China's newest materials, guaranteed by a local building-materials mall in the UAE"
        subtitle="Sourcing from overseas shouldn't mean being on your own. Every order is delivered, warranted and supported locally."
      >
        <Link
          href="/materials"
          className="inline-flex h-12 items-center gap-2 rounded-lg bg-[#b8864a] px-6 text-sm font-semibold text-white transition hover:bg-[#a07640]"
        >
          Browse Materials
          <ArrowRight className="h-4 w-4" />
        </Link>
        <Link
          href="/services/china-sourcing"
          className="inline-flex h-12 items-center rounded-lg border border-white/40 px-6 text-sm font-semibold text-white transition hover:border-white hover:bg-white/10"
        >
          Plan Your Sourcing
        </Link>
      </SourcingHero>

      {/* ② 三大支柱 */}
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-20">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="font-serif text-2xl font-bold text-[#2c2c2c] sm:text-3xl">Three pillars of our guarantee</h2>
          <p className="mt-3 text-sm leading-relaxed text-stone-500 sm:text-base">
            Not fine print — a physical mall, local stock and a local team standing behind every order.
          </p>
        </div>
        <div className="mt-10 grid gap-5 lg:grid-cols-3">
          {PILLARS.map(({ icon: Icon, title, intro, points }) => (
            <div key={title} className="rounded-xl border border-stone-200 bg-white p-7 sm:p-8">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-[#b8864a]/10">
                <Icon className="h-6 w-6 text-[#b8864a]" />
              </div>
              <h3 className="mt-5 font-serif text-xl font-semibold text-[#2c2c2c]">{title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-stone-500">{intro}</p>
              <ul className="mt-5 space-y-2.5 border-t border-stone-100 pt-5">
                {points.map((p) => (
                  <li key={p} className="flex items-start gap-2.5 text-sm leading-relaxed text-[#2c2c2c]">
                    <span aria-hidden className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-[#b8864a]" />
                    {p}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      {/* ③ 8 Commitments 信任网格 */}
      <section className="bg-white py-16 sm:py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-[#b8864a]">Our Promise</p>
            <h2 className="mt-2 font-serif text-2xl font-bold text-[#2c2c2c] sm:text-3xl">8 commitments on every order</h2>
          </div>
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {COMMITMENTS.map(({ icon: Icon, title, body }) => (
              <div key={title} className="rounded-xl border border-stone-200 bg-[#faf9f7] p-5">
                <Icon className="h-5 w-5 text-[#b8864a]" />
                <h3 className="mt-3 text-sm font-semibold text-[#2c2c2c]">{title}</h3>
                <p className="mt-1.5 text-[13px] leading-relaxed text-stone-500">{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ④ How claims work */}
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-20">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="font-serif text-2xl font-bold text-[#2c2c2c] sm:text-3xl">How claims work</h2>
          <p className="mt-3 text-sm leading-relaxed text-stone-500 sm:text-base">
            If something isn&apos;t right, resolving it takes three steps — all handled locally.
          </p>
        </div>
        <div className="mx-auto mt-10 grid max-w-4xl gap-4 sm:grid-cols-3">
          {CLAIM_STEPS.map(({ icon: Icon, title, body }, i) => (
            <div key={title} className="relative rounded-xl border border-stone-200 bg-white p-6">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full border border-[#b8864a]/30 bg-[#faf9f7]">
                  <Icon className="h-4.5 w-4.5 text-[#b8864a]" />
                </div>
                <span className="text-xs font-semibold uppercase tracking-wider text-stone-400">Step {i + 1}</span>
              </div>
              <h3 className="mt-4 text-base font-semibold text-[#2c2c2c]">{title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-stone-500">{body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ⑤ CTA 双按钮 */}
      <section className="bg-[#1c1917] py-16 sm:py-20">
        <div className="mx-auto max-w-3xl px-4 text-center sm:px-6">
          <h2 className="font-serif text-2xl font-bold text-white sm:text-3xl">
            Ready to build with China&apos;s newest materials?
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-white/70 sm:text-base">
            Explore the curated catalogue, or tell us about your project and let our team plan the sourcing.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/materials"
              className="inline-flex h-12 items-center gap-2 rounded-lg bg-[#b8864a] px-6 text-sm font-semibold text-white transition hover:bg-[#a07640]"
            >
              Browse Materials
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/services/china-sourcing"
              className="inline-flex h-12 items-center rounded-lg border border-[#d8b98c]/60 px-6 text-sm font-semibold text-[#d8b98c] transition hover:border-[#d8b98c] hover:bg-[#d8b98c]/10"
            >
              Plan Your Sourcing
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
