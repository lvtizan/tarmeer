// /materials/showroom — The UAE Selection Center（AE 专属）
// 战略：物理枢纽——策展、空间动线、二维码数字目录、双语顾问、到店流程、洽谈茶室。
// 契约：docs/plans/china-materials-revamp-spec.md §4「选材中心」。
// 二维码为「叙事层」：讲清扫码即见规格/认证/贸易价/交期的到店体验，码指向现有产品页；
//   不在公开页展示贸易价（去标识铁律），贸易价/交期是到店/顾问侧信息。
import type { Metadata } from 'next';
import Link from 'next/link';
import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import {
  LayoutGrid,
  QrCode,
  Languages,
  Coffee,
  ScanLine,
  FileCheck,
  ShieldCheck,
  Layers,
  ArrowRight,
  Check,
} from 'lucide-react';
import SourcingRequestForm from '@/components/sourcing/SourcingRequestForm';
import { getCountry } from '@/lib/country';
import { jsonLdHtml } from '@/lib/schema/jsonLdScript';

export const dynamic = 'force-dynamic';

const HERO_IMG = '/images/sourcing/showroom';

export async function generateMetadata(): Promise<Metadata> {
  const c = getCountry((await headers()).get('x-country'));
  if (c.code !== 'ae') notFound();
  const title = 'The UAE Selection Center — Newest Materials from China | Tarmeer';
  const description =
    "A curated selection center in the UAE where you can see, touch and specify China's newest materials. Scan any sample for full specs, certifications and lead times. Book a visit with a bilingual consultant.";
  return {
    title,
    description,
    openGraph: {
      title,
      description,
      images: [{ url: `${c.baseUrl}${HERO_IMG}-medium.webp`, width: 1200, height: 630 }],
      url: `${c.baseUrl}/materials/showroom`,
      type: 'website',
    },
    twitter: { card: 'summary_large_image', title, description },
    alternates: { canonical: `${c.baseUrl}/materials/showroom` },
    robots: 'index, follow, max-image-preview:large',
  };
}

// 空间分区——按应用/效果（大样上墙 + 场景 vignette），复用 scene-* 素材
const ZONES: { title: string; desc: string; img: string; alt: string }[] = [
  {
    title: 'Feature Walls',
    desc: 'Microcement, sintered stone and art panels shown full-scale on the wall.',
    img: 'scene-feature-wall',
    alt: 'Feature wall materials displayed at the Tarmeer selection center',
  },
  {
    title: 'Countertops',
    desc: 'Large-format sintered stone slabs you can run your hand across.',
    img: 'scene-countertop',
    alt: 'Countertop stone slabs on display',
  },
  {
    title: 'Flooring',
    desc: 'Tiles, stone and engineered surfaces laid out as walkable vignettes.',
    img: 'scene-flooring',
    alt: 'Flooring materials laid out as vignettes',
  },
  {
    title: 'Kitchen & Bath',
    desc: 'Smart fittings and finishes staged in room-like settings.',
    img: 'scene-kitchen-bath',
    alt: 'Kitchen and bath fittings staged at the selection center',
  },
];

// 二维码数字目录——扫码即见的四类信息
const CATALOG_FIELDS = ['Specifications', 'Certifications', 'Trade pricing on request', 'Lead times'];

// 到店 5 步流程
const FLOW: { title: string; desc: string }[] = [
  { title: 'Book on social or online', desc: 'Message us or book a slot online — tell us the project and materials you have in mind.' },
  { title: 'Welcome & brief', desc: 'A bilingual consultant meets you, understands your project and maps the space to your needs.' },
  { title: 'Curated selection', desc: 'Walk the zones, touch full-scale samples, scan for full specs — shortlist what fits.' },
  { title: 'Consultant prepares your list', desc: 'Your consultant builds a material list and BOQ with trade pricing and lead times.' },
  { title: 'Order on the spot', desc: 'Confirm with a deposit and move straight into sourcing — we handle the rest to your door.' },
];

export default async function SelectionCenterPage() {
  const c = getCountry((await headers()).get('x-country'));
  if (c.code !== 'ae') notFound();

  const placeJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Service',
    name: 'Tarmeer UAE Selection Center',
    description:
      "A curated selection center in the UAE showing China's newest materials — see, touch and specify with a bilingual consultant, backed by local delivery and after-sales guarantees.",
    url: `${c.baseUrl}/materials/showroom`,
    areaServed: { '@type': 'Country', name: c.fullName },
    provider: {
      '@type': 'Organization',
      name: 'Tarmeer',
      url: c.baseUrl,
      logo: { '@type': 'ImageObject', url: `${c.baseUrl}/images/tarmeer_logo.svg` },
    },
  };

  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: `${c.baseUrl}/` },
      { '@type': 'ListItem', position: 2, name: 'Materials', item: `${c.baseUrl}/materials` },
      {
        '@type': 'ListItem',
        position: 3,
        name: 'Selection Center',
        item: `${c.baseUrl}/materials/showroom`,
      },
    ],
  };

  return (
    <div>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdHtml(placeJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdHtml(breadcrumbJsonLd) }}
      />

      {/* Hero */}
      <section className="relative isolate overflow-hidden bg-[#1c1917]">
        <img
          src={`${HERO_IMG}-medium.webp`}
          srcSet={`${HERO_IMG}-thumb.webp 600w, ${HERO_IMG}-medium.webp 1200w, ${HERO_IMG}.webp 2000w`}
          sizes="100vw"
          alt="Tarmeer material selection center in the UAE"
          className="absolute inset-0 -z-10 h-full w-full object-cover"
          loading="eager"
          fetchPriority="high"
          style={{
            backgroundImage: `url(${HERO_IMG}-blur.webp)`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
          }}
        />
        <div className="absolute inset-0 -z-10 bg-[linear-gradient(90deg,rgba(28,25,23,0.92)_0%,rgba(28,25,23,0.78)_50%,rgba(28,25,23,0.55)_100%)]" />

        <div className="relative max-w-5xl mx-auto px-4 sm:px-6 py-16 lg:py-24">
          <p className="text-sm font-semibold text-[#c6a065] uppercase tracking-wider">
            The UAE Selection Center
          </p>
          <h1 className="font-serif text-4xl lg:text-5xl font-bold text-white leading-tight mt-4 max-w-2xl">
            See It. Touch It. <span className="text-[#c6a065]">Specify It.</span>
          </h1>
          <p className="text-lg text-white/70 mt-6 max-w-xl">
            A curated space in the {c.name} — not a warehouse. Only the newest and best materials
            from China earn a place on our walls, so every hour you spend here counts.
          </p>

          <div className="mt-8 flex flex-wrap gap-4">
            {['Curated, not cluttered', 'Bilingual consultants', 'Backed by local guarantees'].map((item) => (
              <div key={item} className="flex items-center gap-2">
                <Check className="w-4 h-4 text-[#c6a065] flex-shrink-0" />
                <span className="text-[15px] text-white/80">{item}</span>
              </div>
            ))}
          </div>

          <div className="mt-10 flex flex-wrap gap-3">
            <a
              href="#book"
              className="inline-flex items-center gap-2 h-12 px-6 rounded-lg bg-[#b8864a] hover:bg-[#a07640] text-white text-sm font-semibold transition"
            >
              Book a Visit
              <ArrowRight className="w-4 h-4" />
            </a>
            <Link
              href="/materials"
              className="inline-flex items-center gap-2 h-12 px-6 rounded-lg border border-white/25 text-white/90 hover:bg-white/10 text-sm font-semibold transition"
            >
              Browse the Material Library
            </Link>
          </div>
        </div>
      </section>

      {/* 空间与动线 — 分区 */}
      <section className="bg-white py-14 lg:py-20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="max-w-2xl">
            <p className="text-sm font-semibold text-[#b8864a] uppercase tracking-wider">
              Space &amp; Flow
            </p>
            <h2 className="font-serif text-3xl lg:text-4xl font-bold text-[#1c1917] mt-3">
              Organized by Application, Not by Supplier
            </h2>
            <p className="text-stone-500 mt-4 leading-relaxed">
              Materials are staged by where they go — feature walls, countertops, flooring,
              kitchen &amp; bath — with full-scale samples on the wall and room-like vignettes,
              so you can judge a finish the way it will actually be used.
            </p>
          </div>

          <div className="mt-10 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {ZONES.map((z) => (
              <div key={z.title} className="rounded-2xl overflow-hidden border border-stone-200 bg-white">
                <div className="aspect-[4/3] bg-stone-200 overflow-hidden">
                  <img
                    src={`/images/sourcing/${z.img}-thumb.webp`}
                    srcSet={`/images/sourcing/${z.img}-thumb.webp 600w, /images/sourcing/${z.img}-medium.webp 1200w`}
                    sizes="(min-width: 1024px) 25vw, (min-width: 640px) 50vw, 100vw"
                    alt={z.alt}
                    loading="lazy"
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="p-5">
                  <div className="flex items-center gap-2">
                    <LayoutGrid className="w-4 h-4 text-[#b8864a]" />
                    <h3 className="font-serif text-lg font-bold text-[#1c1917]">{z.title}</h3>
                  </div>
                  <p className="text-sm text-stone-500 leading-relaxed mt-2">{z.desc}</p>
                </div>
              </div>
            ))}
          </div>

          {/* 洽谈茶室 */}
          <div className="mt-6 flex items-start gap-4 rounded-2xl border border-stone-200 bg-stone-50 p-6">
            <span className="inline-flex w-11 h-11 rounded-xl bg-[#b8864a]/10 text-[#b8864a] items-center justify-center shrink-0">
              <Coffee className="w-5 h-5" />
            </span>
            <div>
              <h3 className="font-serif text-lg font-bold text-[#1c1917]">A private consultation lounge</h3>
              <p className="text-sm text-stone-500 leading-relaxed mt-1">
                Sit down over tea to review selections, talk budgets and plan a project — this is a
                relationship, not a transaction.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 二维码数字目录（叙事层） */}
      <section className="bg-[#1c1917] py-14 lg:py-20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 grid lg:grid-cols-[1fr_360px] gap-10 lg:gap-14 items-center">
          <div>
            <p className="text-sm font-semibold text-[#c6a065] uppercase tracking-wider">
              Scan Any Sample
            </p>
            <h2 className="font-serif text-3xl lg:text-4xl font-bold text-white mt-3">
              Every Material Carries a QR Code
            </h2>
            <p className="text-white/70 mt-4 leading-relaxed max-w-xl">
              Scan the code on any sample to open its digital catalog — the full spec is in your
              pocket before you leave. Take samples back to your studio and keep every detail with
              you, so nothing gets lost in translation.
            </p>

            <div className="mt-8 grid grid-cols-2 sm:grid-cols-4 gap-3">
              {CATALOG_FIELDS.map((f) => (
                <div key={f} className="rounded-xl border border-white/15 bg-white/5 px-4 py-3">
                  <FileCheck className="w-4 h-4 text-[#c6a065]" />
                  <p className="text-sm font-medium text-white mt-2">{f}</p>
                </div>
              ))}
            </div>

            <p className="text-[13px] text-white/45 mt-6 max-w-xl leading-relaxed">
              Trade pricing and lead times are shared with visiting designers and trade partners —
              transparency is how we build trust across borders.
            </p>
          </div>

          {/* QR 示意 */}
          <div className="mx-auto">
            <div className="flex flex-col items-center gap-4 rounded-2xl border border-white/15 bg-white/5 p-8">
              <span className="inline-flex w-24 h-24 rounded-2xl bg-white text-[#1c1917] items-center justify-center">
                <QrCode className="w-14 h-14" />
              </span>
              <div className="flex items-center gap-2 text-white/70 text-sm">
                <ScanLine className="w-4 h-4 text-[#c6a065]" />
                <span>Scan → digital catalog</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 双语顾问 */}
      <section className="bg-white py-14 lg:py-20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 grid lg:grid-cols-2 gap-8 lg:gap-12 items-center">
          {/* 顾问在展厅用双语给海湾客户讲材料的实景图 */}
          <div className="rounded-2xl overflow-hidden bg-stone-200 aspect-[3/2]">
            <img
              src="/images/sourcing/cv-1-medium.webp"
              srcSet="/images/sourcing/cv-1-thumb.webp 600w, /images/sourcing/cv-1-medium.webp 1200w"
              sizes="(min-width: 1024px) 50vw, 100vw"
              alt="A bilingual consultant explaining material samples to visiting clients at the Tarmeer selection center"
              loading="lazy"
              className="w-full h-full object-cover"
            />
          </div>
          <div>
            <span className="inline-flex w-12 h-12 rounded-2xl bg-[#b8864a]/10 text-[#b8864a] items-center justify-center">
              <Languages className="w-6 h-6" />
            </span>
            <p className="text-sm font-semibold text-[#b8864a] uppercase tracking-wider mt-4">
              Bilingual Selection Consultants
            </p>
            <h2 className="font-serif text-2xl lg:text-3xl font-bold text-[#1c1917] mt-2">
              Someone Who Speaks Materials — and Your Language
            </h2>
            <p className="text-stone-500 mt-4 leading-relaxed">
              Our consultants work in Arabic, English and Chinese. They explain the material,
              bridge the conversation with the factory, prepare your quotation and BOQ, and stay
              with you all the way to a confirmed order.
            </p>
          </div>
        </div>
      </section>

      {/* 到店 5 步流程 */}
      <section className="bg-stone-50 py-14 lg:py-20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="text-center max-w-2xl mx-auto">
            <p className="text-sm font-semibold text-[#b8864a] uppercase tracking-wider">How a Visit Works</p>
            <h2 className="font-serif text-3xl lg:text-4xl font-bold text-[#1c1917] mt-3">
              From Booking to Order — in One Visit
            </h2>
          </div>

          <div className="mt-12 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-5">
            {FLOW.map((step, i) => (
              <div key={step.title} className="relative border border-stone-200 rounded-2xl p-6 bg-white">
                <span className="font-serif text-4xl font-bold text-[#b8864a]/25 leading-none">
                  {String(i + 1).padStart(2, '0')}
                </span>
                <h3 className="font-serif text-base font-bold text-[#1c1917] mt-3">{step.title}</h3>
                <p className="text-sm text-stone-500 leading-relaxed mt-2">{step.desc}</p>
              </div>
            ))}
          </div>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-stone-500">
            <span className="inline-flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-[#b8864a]" />
              Every order backed by our{' '}
              <Link href="/guarantee" className="font-semibold text-[#b8864a] hover:text-[#a07640]">
                local delivery &amp; after-sales guarantee
              </Link>
            </span>
            <span className="inline-flex items-center gap-2">
              <Layers className="w-4 h-4 text-[#b8864a]" />
              New samples arrive continuously from our China partners
            </span>
          </div>
        </div>
      </section>

      {/* Booking form */}
      <section id="book" className="bg-white py-14 lg:py-20 scroll-mt-20">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 grid lg:grid-cols-[1fr_420px] gap-10 lg:gap-14 items-start">
          <div>
            <p className="text-sm font-semibold text-[#b8864a] uppercase tracking-wider">Book a Visit</p>
            <h2 className="font-serif text-3xl lg:text-4xl font-bold text-[#1c1917] mt-3">
              Come See the Newest Materials in Person
            </h2>
            <p className="text-stone-500 mt-4 leading-relaxed">
              Pick a time that suits you and we&apos;ll pair you with a bilingual consultant for your
              project. Samples are on the wall, ready to touch.
            </p>
            <ul className="mt-6 space-y-3">
              {[
                'A consultant matched to your project',
                'Full specs, certifications and lead times on request',
                'Trade pricing for designers and trade partners',
              ].map((item) => (
                <li key={item} className="flex items-start gap-2.5">
                  <Check className="w-4 h-4 text-[#b8864a] flex-shrink-0 mt-0.5" />
                  <span className="text-[15px] text-stone-600">{item}</span>
                </li>
              ))}
            </ul>
          </div>

          <SourcingRequestForm variant="visit" />
        </div>
      </section>
    </div>
  );
}
