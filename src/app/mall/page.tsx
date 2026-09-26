export const dynamic = 'force-dynamic';

import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { headers } from 'next/headers';
import {
  ArrowDown,
  ArrowRight,
  BadgeCheck,
  Boxes,
  Factory,
  Globe2,
  MapPin,
  Plane,
  Search,
  ShieldCheck,
  Warehouse,
} from 'lucide-react';
import MallDigitalShowroom from '@/components/mall/MallDigitalShowroom';
import MallMobileStickyCta from '@/components/mall/MallMobileStickyCta';
import MallVisitDrawer from '@/components/mall/MallVisitDrawer';
import MallVisitTrigger from '@/components/mall/MallVisitTrigger';
import { ADDRESS, GOOGLE_MAPS_URL } from '@/lib/constants';
import { getCountry } from '@/lib/country';

const EXPERIENCES = [
  {
    number: '01',
    icon: Globe2,
    eyebrow: 'Online · Anywhere',
    title: 'Explore China digitally',
    body: 'Walk through Chinese manufacturer showrooms online, compare applications and shortlist materials without waiting for a flight.',
    href: '#digital-showroom',
    cta: 'Preview the VR showroom',
    image: '/images/mall/vr-showroom-main',
  },
  {
    number: '02',
    icon: Warehouse,
    eyebrow: 'In the UAE',
    title: 'Touch materials locally',
    body: 'Visit our UAE material center to see samples at full scale and review your shortlist with a bilingual consultant.',
    href: '/materials/showroom',
    cta: 'Visit the material center',
    image: '/images/sourcing/showroom',
  },
  {
    number: '03',
    icon: Plane,
    eyebrow: 'In China',
    title: 'Visit factories in person',
    body: 'Travel with our team to material markets, showrooms and factories for direct access to products and makers.',
    href: '/for-designers/china-tour',
    cta: 'See the China visit',
    image: '/images/sourcing/hero-real-1',
  },
] as const;

const JOURNEY = [
  { icon: Search, title: 'Discover', body: 'Browse China showrooms online and save what fits.' },
  { icon: Boxes, title: 'Shortlist', body: 'Review samples, specifications, quantities and lead times.' },
  { icon: Factory, title: 'Source & inspect', body: 'We coordinate factories and check quality before shipping.' },
  { icon: Warehouse, title: 'Consolidate & import', body: 'Orders are combined, cleared and certified for the UAE.' },
  { icon: ShieldCheck, title: 'Deliver & support', body: 'Local delivery and after-sales continue after handover.' },
] as const;

export async function generateMetadata(): Promise<Metadata> {
  const c = getCountry((await headers()).get('x-country'));
  if (c.code !== 'ae') notFound();
  const title = 'Explore China Building Materials Online, in the UAE or in China';
  const description =
    'Visit Chinese building-material showrooms digitally, see real samples at our UAE material center, or travel to China with Tarmeer. We manage sourcing, factory QC, import, delivery and local after-sales.';
  return {
    title,
    description,
    openGraph: {
      title: `${title} | Tarmeer`,
      description,
      url: `${c.baseUrl}/mall`,
      images: [{ url: `${c.baseUrl}/images/mall/vr-showroom-main.webp`, width: 2000, height: 1185 }],
    },
    twitter: { card: 'summary_large_image', title: `${title} | Tarmeer`, description },
    alternates: { canonical: `${c.baseUrl}/mall` },
    keywords:
      'China building materials virtual showroom, VR material showroom, source building materials China, UAE material center, China factory visit, Tarmeer',
  };
}

export default async function MallPage() {
  const c = getCountry((await headers()).get('x-country'));
  if (c.code !== 'ae') notFound();

  return (
    <div className="overflow-x-clip bg-[#faf8f5] pb-20 sm:pb-0">
      <section className="relative isolate min-h-[720px] overflow-hidden bg-[#171513] text-white sm:min-h-[760px]">
        <img
          src="/images/mall/vr-showroom-main-medium.webp"
          srcSet="/images/mall/vr-showroom-main-thumb.webp 600w, /images/mall/vr-showroom-main-medium.webp 1200w, /images/mall/vr-showroom-main.webp 2000w"
          sizes="100vw"
          alt="Chinese stone manufacturer's VR showroom with illuminated slab displays"
          loading="eager"
          fetchPriority="high"
          className="absolute inset-0 -z-20 h-full w-full object-cover object-center"
          style={{
            backgroundImage: 'url(/images/mall/vr-showroom-main-blur.webp)',
            backgroundPosition: 'center',
            backgroundSize: 'cover',
          }}
        />
        <div className="absolute inset-0 -z-10 bg-[linear-gradient(90deg,rgba(18,16,14,0.96)_0%,rgba(18,16,14,0.82)_40%,rgba(18,16,14,0.34)_72%,rgba(18,16,14,0.16)_100%)]" />
        <div className="absolute inset-x-0 bottom-0 -z-10 h-40 bg-gradient-to-t from-[#171513] to-transparent" />

        <div className="mx-auto flex min-h-[720px] max-w-[1440px] items-center px-4 py-20 sm:min-h-[760px] sm:px-6 lg:px-10">
          <div className="max-w-3xl pt-10">
            <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-[#d2aa73]">
              China Digital Showrooms · UAE Material Center · Factory Visits
            </p>
            <h1 className="mt-5 max-w-3xl font-serif text-[42px] font-semibold leading-[1.02] tracking-[-0.025em] sm:text-6xl lg:text-[76px]">
              Source China.
              <span className="block text-[#d8b487]">See it your way.</span>
            </h1>
            <p className="mt-6 max-w-xl text-base leading-7 text-white/70 sm:text-lg sm:leading-8">
              Explore Chinese manufacturers online, touch real materials in the UAE, or visit factories in China — then source, ship and deliver with one accountable team.
            </p>
            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <a
                href="#digital-showroom"
                className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-[#b8864a] px-7 text-sm font-semibold text-white shadow-[0_18px_42px_rgba(184,134,74,0.26)] transition hover:bg-[#a07640] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
              >
                Preview VR Showroom <ArrowDown className="h-4 w-4" />
              </a>
              <MallVisitTrigger className="hidden h-12 items-center justify-center gap-2 rounded-full border border-white/35 px-7 text-sm font-semibold text-white transition hover:border-white hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white sm:inline-flex" />
            </div>
            <div className="mt-10 grid max-w-2xl grid-cols-3 gap-3 border-t border-white/15 pt-5 text-xs leading-5 text-white/65 sm:gap-7 sm:text-sm">
              <span>Browse China online</span>
              <span>See samples in the UAE</span>
              <span>Visit factories in person</span>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-[#faf8f5] py-16 sm:py-24">
        <div className="mx-auto max-w-[1440px] px-4 sm:px-6 lg:px-10">
          <div className="grid gap-6 lg:grid-cols-[0.7fr_1.3fr] lg:items-end">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.26em] text-[#b8864a]">One Network, Three Ways In</p>
              <h2 className="mt-3 max-w-xl font-serif text-3xl font-semibold leading-tight text-[#1c1917] sm:text-4xl lg:text-[46px]">
                Start online. Go physical when it matters.
              </h2>
            </div>
            <p className="max-w-2xl text-sm leading-7 text-stone-600 sm:text-base lg:justify-self-end">
              Every route connects to the same China sourcing network. Begin with speed, add touch and scale, then travel only when direct factory access adds value.
            </p>
          </div>

          <div className="mt-10 grid gap-5 lg:grid-cols-3">
            {EXPERIENCES.map((item) => (
              <article key={item.number} className="group overflow-hidden rounded-[24px] border border-stone-200 bg-white sm:rounded-[28px]">
                <div className="relative aspect-[16/10] overflow-hidden bg-stone-200">
                  <img
                    src={`${item.image}-medium.webp`}
                    srcSet={`${item.image}-thumb.webp 600w, ${item.image}-medium.webp 1200w`}
                    sizes="(min-width: 1024px) 33vw, 100vw"
                    alt={item.title}
                    loading="lazy"
                    className="h-full w-full object-cover transition duration-700 group-hover:scale-[1.04] motion-reduce:transition-none"
                  />
                  <span className="absolute left-4 top-4 rounded-full bg-[#171513]/80 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-white backdrop-blur-md">
                    {item.eyebrow}
                  </span>
                </div>
                <div className="p-6 sm:p-7">
                  <div className="flex items-center justify-between">
                    <item.icon className="h-5 w-5 text-[#b8864a]" />
                    <span className="font-serif text-3xl text-stone-200">{item.number}</span>
                  </div>
                  <h3 className="mt-5 font-serif text-2xl font-semibold text-[#1c1917]">{item.title}</h3>
                  <p className="mt-3 text-sm leading-6 text-stone-500">{item.body}</p>
                  <Link href={item.href} className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-[#a8773e] transition hover:text-[#8c6333]">
                    {item.cta} <ArrowRight className="h-4 w-4" />
                  </Link>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <MallDigitalShowroom />

      <section className="bg-white py-16 sm:py-24">
        <div className="mx-auto max-w-[1440px] px-4 sm:px-6 lg:px-10">
          <div className="mx-auto max-w-3xl text-center">
            <p className="text-[10px] font-semibold uppercase tracking-[0.26em] text-[#b8864a]">One Accountable Journey</p>
            <h2 className="mt-3 font-serif text-3xl font-semibold text-[#1c1917] sm:text-4xl">From first look to final delivery</h2>
            <p className="mt-4 text-sm leading-7 text-stone-500 sm:text-base">
              You choose how to explore. Tarmeer keeps sourcing, quality control and delivery connected behind the scenes.
            </p>
          </div>
          <div className="relative mt-12">
            <div className="absolute left-[10%] right-[10%] top-6 hidden h-px bg-stone-200 md:block" aria-hidden="true" />
            <ol className="relative grid gap-3 md:grid-cols-5 md:gap-0">
              {JOURNEY.map((step, index) => (
                <li key={step.title} className="relative flex gap-4 rounded-2xl border border-stone-200 bg-[#faf8f5] p-5 md:block md:rounded-none md:border-0 md:bg-transparent md:px-4 md:text-center">
                  <span className="relative z-10 flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-[#cda66e]/40 bg-white text-[#a8773e] shadow-sm md:mx-auto">
                    <step.icon className="h-5 w-5" />
                  </span>
                  <div className="md:mt-5">
                    <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#b8864a]">0{index + 1}</span>
                    <h3 className="mt-1 font-serif text-lg font-semibold text-[#1c1917]">{step.title}</h3>
                    <p className="mt-2 text-sm leading-6 text-stone-500">{step.body}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </section>

      <section className="bg-[#eee5d7] py-16 sm:py-20">
        <div className="mx-auto grid max-w-[1440px] gap-10 px-4 sm:px-6 lg:grid-cols-[1.08fr_0.92fr] lg:items-center lg:px-10">
          <div className="relative aspect-[16/10] overflow-hidden rounded-[28px] bg-stone-300">
            <img
              src="/images/sourcing/showroom-exterior-medium.webp"
              srcSet="/images/sourcing/showroom-exterior-thumb.webp 600w, /images/sourcing/showroom-exterior-medium.webp 1200w, /images/sourcing/showroom-exterior.webp 2000w"
              sizes="(min-width: 1024px) 55vw, 100vw"
              alt="Tarmeer UAE material center supporting China-sourced building materials"
              loading="lazy"
              className="h-full w-full object-cover"
            />
            <span className="absolute bottom-4 left-4 rounded-full bg-white/90 px-4 py-2 text-xs font-semibold text-[#1c1917] backdrop-blur-md">
              UAE Material Center
            </span>
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.26em] text-[#9a6c36]">Local Confidence</p>
            <h2 className="mt-3 font-serif text-3xl font-semibold leading-tight text-[#1c1917] sm:text-4xl">
              China access, backed in the UAE
            </h2>
            <p className="mt-5 max-w-xl text-sm leading-7 text-stone-600 sm:text-base">
              A digital showroom helps you discover. Our UAE team makes the order real — with physical samples, coordinated shipping, inspection on arrival and local after-sales support.
            </p>
            <div className="mt-7 grid gap-3 sm:grid-cols-3">
              {[
                ['Delivery', 'Clear milestones and local handover'],
                ['Warranty', 'Defect assessment and replacement support'],
                ['Local stock', 'Selected fast-moving materials available nearby'],
              ].map(([title, body]) => (
                <div key={title} className="rounded-2xl border border-[#cdbb9f] bg-white/55 p-4">
                  <BadgeCheck className="h-5 w-5 text-[#a8773e]" />
                  <h3 className="mt-3 text-sm font-semibold text-[#1c1917]">{title}</h3>
                  <p className="mt-1 text-xs leading-5 text-stone-600">{body}</p>
                </div>
              ))}
            </div>
            <div className="mt-7 flex flex-col gap-3 sm:flex-row">
              <MallVisitTrigger className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-[#b8864a] px-6 text-sm font-semibold text-white transition hover:bg-[#a07640] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8c6333]" />
              <a
                href={GOOGLE_MAPS_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full border border-[#b8a589] px-6 text-center text-sm font-semibold text-[#1c1917] transition hover:border-[#8c6333]"
              >
                <MapPin className="h-4 w-4" /> {ADDRESS}
              </a>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-[#171513] px-4 py-16 text-center text-white sm:px-6 sm:py-20">
        <div className="mx-auto max-w-3xl">
          <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-[#d2aa73]">Your Next Material Is Closer Than It Looks</p>
          <h2 className="mt-3 font-serif text-3xl font-semibold sm:text-4xl">Start in the digital showroom</h2>
          <p className="mx-auto mt-4 max-w-xl text-sm leading-7 text-white/60 sm:text-base">
            Explore online first. When you are ready, we will arrange samples, a UAE visit or a China sourcing trip around your project.
          </p>
          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <a href="#digital-showroom" className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-white px-7 text-sm font-semibold text-[#171513] transition hover:bg-[#f1e7d8]">
              Preview VR Showroom <ArrowRight className="h-4 w-4" />
            </a>
            <MallVisitTrigger className="inline-flex h-12 items-center justify-center gap-2 rounded-full border border-white/25 px-7 text-sm font-semibold text-white transition hover:border-white/50 hover:bg-white/5" />
          </div>
        </div>
      </section>

      <MallMobileStickyCta />
      <MallVisitDrawer />
    </div>
  );
}
