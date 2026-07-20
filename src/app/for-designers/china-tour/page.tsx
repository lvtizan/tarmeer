// /for-designers/china-tour — 设计师赴华考察团（二期）落地页（AE 专属）
// 措辞铁律：合规表述统一用 "trade" / "trade partners" / "material trade margins"，禁止任何 commission / rebate / kickback / 返点 / 佣金 类字眼。
import type { Metadata } from 'next';
import Link from 'next/link';
import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import {
  Sparkles,
  Search,
  Eye,
  Factory,
  Building2,
  FlaskConical,
  Utensils,
  LineChart,
  Users,
  Wallet,
  ShieldCheck,
  Target,
  ArrowRight,
  Check,
} from 'lucide-react';
import SourcingRequestForm from '@/components/sourcing/SourcingRequestForm';
import { getCountry } from '@/lib/country';
import { jsonLdHtml } from '@/lib/schema/jsonLdScript';

export const dynamic = 'force-dynamic';

const HERO_IMG = '/images/sourcing/tour-1';

export async function generateMetadata(): Promise<Metadata> {
  const c = getCountry((await headers()).get('x-country'));
  if (c.code !== 'ae') notFound();
  const title = 'Designer China Tour — Second Edition | Invitation-Only Material Trip | Tarmeer';
  const description =
    'An invitation-only, limited-seat professional trip to China for a select group of UAE designers — factory inspections, exclusive first looks at new materials, and curated material-trend briefings in Foshan, Guangdong.';
  return {
    title,
    description,
    openGraph: {
      title,
      description,
      images: [{ url: `${c.baseUrl}${HERO_IMG}-medium.webp` }],
      url: `${c.baseUrl}/for-designers/china-tour`,
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
    },
    alternates: { canonical: `${c.baseUrl}/for-designers/china-tour` },
    robots: 'index, follow, max-image-preview:large',
  };
}

const PILLARS: { icon: typeof Search; title: string; desc: string }[] = [
  {
    icon: Search,
    title: 'Inspection',
    desc: 'Walk the production floor with our sourcing team — see how the materials you specify are actually made, tested and finished before they ship.',
  },
  {
    icon: Sparkles,
    title: 'Inspiration',
    desc: 'Step inside showrooms and design centers most studios never reach, and leave with a notebook full of collections for your next projects.',
  },
  {
    icon: Eye,
    title: 'Exclusive First Looks',
    desc: 'Preview unreleased material collections before they arrive in the UAE — and reserve first pick for the projects on your desk.',
  },
];

const ITINERARY: { icon: typeof Factory; title: string; desc: string }[] = [
  {
    icon: Factory,
    title: 'Anchor Factories',
    desc: 'Private, hosted visits to our anchor partner factories — surfaces, stone, tile, kitchen and joinery lines — with time to inspect quality and finishes up close.',
  },
  {
    icon: Building2,
    title: 'Building-Materials City',
    desc: 'A guided walk through one of the largest building-materials cities in the world, in Foshan, curated so you see the best of it without the overwhelm.',
  },
  {
    icon: FlaskConical,
    title: 'New-Materials Center',
    desc: 'A dedicated stop at a new-materials center to preview innovations in sustainable surfaces, engineered stone and next-generation finishes.',
  },
  {
    icon: Utensils,
    title: 'Curated Dinners',
    desc: 'Relaxed, curated dinners with fellow designers and our partners — the relationships that make specification faster for years afterwards.',
  },
  {
    icon: LineChart,
    title: 'Material-Trend Briefing',
    desc: 'A closing material-trend briefing from our sourcing team — what is arriving next season and how to specify it ahead of the UAE market.',
  },
];

export default async function ChinaTourPage() {
  const c = getCountry((await headers()).get('x-country'));
  if (c.code !== 'ae') notFound();

  const serviceJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Service',
    name: 'Designer China Tour — Second Edition',
    description:
      'An invitation-only, limited-seat professional trip to China for a select group of UAE designers — factory inspections, exclusive first looks at new materials, and curated material-trend briefings in Foshan, Guangdong.',
    url: `${c.baseUrl}/for-designers/china-tour`,
    areaServed: { '@type': 'Country', name: c.fullName },
    audience: { '@type': 'Audience', audienceType: 'Interior designers and architects' },
    provider: {
      '@type': 'Organization',
      name: 'Tarmeer',
      url: c.baseUrl,
      logo: { '@type': 'ImageObject', url: `${c.baseUrl}/images/tarmeer_logo.svg` },
    },
  };

  return (
    <div>
      {/* 统一走 jsonLdHtml 转义，防将来加动态字段踩 </script> 注入坑 */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdHtml(serviceJsonLd) }}
      />

      {/* Hero */}
      <section className="relative isolate overflow-hidden bg-[#1c1917]">
        <img
          src={`${HERO_IMG}-medium.webp`}
          srcSet={`${HERO_IMG}-thumb.webp 600w, ${HERO_IMG}-medium.webp 1200w, ${HERO_IMG}.webp 2000w`}
          sizes="100vw"
          alt="Interior designers inspecting materials on a factory visit in China with the Tarmeer sourcing team"
          className="absolute inset-0 -z-10 h-full w-full object-cover"
          loading="eager"
          fetchPriority="high"
          style={{
            backgroundImage: `url(${HERO_IMG}-blur.webp)`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
          }}
        />
        <div className="absolute inset-0 -z-10 bg-[linear-gradient(90deg,rgba(28,25,23,0.93)_0%,rgba(28,25,23,0.80)_50%,rgba(28,25,23,0.58)_100%)]" />

        <div className="relative max-w-5xl mx-auto px-4 sm:px-6 py-16 lg:py-24">
          <p className="text-sm font-semibold text-[#c6a065] uppercase tracking-wider">
            Designer China Tour · Second Edition
          </p>
          <h1 className="font-serif text-4xl lg:text-5xl font-bold text-white leading-tight mt-4 max-w-2xl">
            An Invitation-Only Trip to the <span className="text-[#c6a065]">Source of Your Materials</span>
          </h1>
          <p className="text-lg text-white/70 mt-6 max-w-xl">
            A limited-seat, curated professional journey to China for a select group of {c.name}{' '}
            designers — factory inspections, exclusive first looks, and the relationships that make
            specification effortless. Small, select, and by invitation.
          </p>

          <div className="mt-8 flex flex-wrap gap-4">
            {['Invitation-only', 'Limited seats', 'Exclusive first looks'].map((item) => (
              <div key={item} className="flex items-center gap-2">
                <Check className="w-4 h-4 text-[#c6a065] flex-shrink-0" />
                <span className="text-[15px] text-white/80">{item}</span>
              </div>
            ))}
          </div>

          <div className="mt-10 flex flex-wrap gap-3">
            <a
              href="#apply"
              className="inline-flex items-center gap-2 h-12 px-6 rounded-lg bg-[#b8864a] hover:bg-[#a07640] text-white text-sm font-semibold transition"
            >
              Request an Invitation
              <ArrowRight className="w-4 h-4" />
            </a>
            <Link
              href="/for-designers"
              className="inline-flex items-center gap-2 h-12 px-6 rounded-lg border border-white/25 text-white/90 hover:bg-white/10 text-sm font-semibold transition"
            >
              About the Designer Program
            </Link>
          </div>
        </div>
      </section>

      {/* What the tour is — 3 pillars */}
      <section className="bg-white py-14 lg:py-20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="text-center max-w-2xl mx-auto">
            <p className="text-sm font-semibold text-[#b8864a] uppercase tracking-wider">What the Tour Is</p>
            <h2 className="font-serif text-3xl lg:text-4xl font-bold text-[#1c1917] mt-3">
              Inspection, Inspiration &amp; Exclusive First Looks
            </h2>
            <p className="text-stone-500 mt-4">
              Not a trade show sprint — a considered trip designed to change how you specify materials
              for {c.name} projects.
            </p>
          </div>

          <div className="mt-12 grid grid-cols-1 sm:grid-cols-3 gap-5">
            {PILLARS.map((p) => (
              <div
                key={p.title}
                className="border border-stone-200 rounded-2xl p-6 bg-white hover:border-[#b8864a]/40 hover:shadow-sm transition"
              >
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#b8864a]/10">
                  <p.icon className="w-5 h-5 text-[#b8864a]" />
                </div>
                <h3 className="font-serif text-lg font-bold text-[#1c1917] mt-4">{p.title}</h3>
                <p className="text-sm text-stone-500 leading-relaxed mt-2">{p.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Itinerary — Foshan / Guangdong */}
      <section className="bg-stone-50 py-14 lg:py-20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="text-center max-w-2xl mx-auto">
            <p className="text-sm font-semibold text-[#b8864a] uppercase tracking-wider">
              The Itinerary
            </p>
            <h2 className="font-serif text-3xl lg:text-4xl font-bold text-[#1c1917] mt-3">
              Five Days in Foshan &amp; Guangdong
            </h2>
            <p className="text-stone-500 mt-4">
              The material heartland of China, curated end to end by our sourcing team.
            </p>
          </div>

          <div className="mt-12 grid lg:grid-cols-2 gap-10 items-start">
            {/* Timeline */}
            <ol className="relative space-y-6">
              {ITINERARY.map((it, i) => (
                <li key={it.title} className="relative flex gap-4">
                  <div className="flex flex-col items-center">
                    <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-[#b8864a]/10">
                      <it.icon className="w-5 h-5 text-[#b8864a]" />
                    </div>
                    {i < ITINERARY.length - 1 && (
                      <span className="mt-2 w-px flex-1 bg-stone-200" aria-hidden />
                    )}
                  </div>
                  <div className="pb-2">
                    <div className="flex items-center gap-2">
                      <span className="font-serif text-sm font-bold text-[#b8864a]/50">
                        {String(i + 1).padStart(2, '0')}
                      </span>
                      <h3 className="font-serif text-lg font-bold text-[#1c1917]">{it.title}</h3>
                    </div>
                    <p className="text-sm text-stone-500 leading-relaxed mt-1">{it.desc}</p>
                  </div>
                </li>
              ))}
            </ol>

            {/* Images */}
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2 overflow-hidden rounded-2xl border border-stone-200 bg-stone-100 aspect-[16/9]">
                <img
                  src="/images/sourcing/tour-2-medium.webp"
                  srcSet="/images/sourcing/tour-2-thumb.webp 600w, /images/sourcing/tour-2-medium.webp 1200w, /images/sourcing/tour-2.webp 2000w"
                  sizes="(max-width: 1024px) 100vw, 50vw"
                  alt="Designers touring a partner factory floor in Foshan"
                  className="h-full w-full object-cover"
                  loading="lazy"
                />
              </div>
              <div className="overflow-hidden rounded-2xl border border-stone-200 bg-stone-100 aspect-[4/3]">
                <img
                  src="/images/sourcing/tour-3-medium.webp"
                  srcSet="/images/sourcing/tour-3-thumb.webp 600w, /images/sourcing/tour-3-medium.webp 1200w, /images/sourcing/tour-3.webp 2000w"
                  sizes="(max-width: 1024px) 50vw, 25vw"
                  alt="Material samples inspected during the China tour"
                  className="h-full w-full object-cover"
                  loading="lazy"
                />
              </div>
              <div className="overflow-hidden rounded-2xl border border-stone-200 bg-stone-100 aspect-[4/3]">
                <img
                  src="/images/sourcing/showroom-medium.webp"
                  srcSet="/images/sourcing/showroom-thumb.webp 600w, /images/sourcing/showroom-medium.webp 1200w, /images/sourcing/showroom.webp 2000w"
                  sizes="(max-width: 1024px) 50vw, 25vw"
                  alt="A material showroom on the tour itinerary"
                  className="h-full w-full object-cover"
                  loading="lazy"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Who it's for */}
      <section className="bg-white py-14 lg:py-20">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <div className="text-center max-w-2xl mx-auto">
            <p className="text-sm font-semibold text-[#b8864a] uppercase tracking-wider">Who It&apos;s For</p>
            <h2 className="font-serif text-3xl lg:text-4xl font-bold text-[#1c1917] mt-3">
              Small &amp; Select, by Design
            </h2>
            <p className="text-stone-500 mt-4">
              We keep the group intentionally small so every designer gets real access. Seats are held for:
            </p>
          </div>

          <div className="mt-12 grid grid-cols-1 sm:grid-cols-2 gap-5">
            {[
              {
                icon: Target,
                title: 'Designers with Live, Sizeable Projects',
                desc: 'Studios with substantial residential or commercial work underway where material choices are being made now.',
              },
              {
                icon: ShieldCheck,
                title: 'Designers with Specification Authority',
                desc: 'Professionals who hold specification authority on their projects and can put what they discover to work.',
              },
            ].map((w) => (
              <div key={w.title} className="border border-stone-200 rounded-2xl p-6 bg-white">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#b8864a]/10">
                  <w.icon className="w-5 h-5 text-[#b8864a]" />
                </div>
                <h3 className="font-serif text-lg font-bold text-[#1c1917] mt-4">{w.title}</h3>
                <p className="text-sm text-stone-500 leading-relaxed mt-2">{w.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it's structured — cost-sharing, compliant */}
      <section className="bg-stone-50 py-14 lg:py-20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="text-center max-w-2xl mx-auto">
            <p className="text-sm font-semibold text-[#b8864a] uppercase tracking-wider">
              How It&apos;s Structured
            </p>
            <h2 className="font-serif text-3xl lg:text-4xl font-bold text-[#1c1917] mt-3">
              Transparent &amp; Fair
            </h2>
            <p className="text-stone-500 mt-4">
              We believe in being upfront about how the trip is funded. Here is exactly how it works.
            </p>
          </div>

          <div className="mt-12 grid grid-cols-1 sm:grid-cols-3 gap-5">
            {[
              {
                icon: Building2,
                title: 'Supplier-Sponsored',
                desc: 'Our partner factories and suppliers host much of the on-the-ground program — visits, showrooms and dinners — as they would for any serious trade partner.',
              },
              {
                icon: Wallet,
                title: 'A Small, Refundable Deposit',
                desc: 'You place a modest deposit to confirm your seat. It is credited toward your orders and fully refundable — it exists only to keep the group committed and select.',
              },
              {
                icon: LineChart,
                title: 'Covered by Trade Margins',
                desc: 'We cover the rest through the material trade margins on the orders that follow. No hidden charges, no per-order fees to you — just standard trade economics.',
              },
            ].map((s) => (
              <div key={s.title} className="border border-stone-200 rounded-2xl p-6 bg-white">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#b8864a]/10">
                  <s.icon className="w-5 h-5 text-[#b8864a]" />
                </div>
                <h3 className="font-serif text-lg font-bold text-[#1c1917] mt-4">{s.title}</h3>
                <p className="text-sm text-stone-500 leading-relaxed mt-2">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Not a free holiday — trust / how it's measured */}
      <section className="bg-[#1c1917] py-14 lg:py-20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 grid lg:grid-cols-2 gap-10 lg:gap-14 items-center">
          <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/5 aspect-[4/3]">
            <img
              src="/images/sourcing/team-clients-medium.webp"
              srcSet="/images/sourcing/team-clients-thumb.webp 600w, /images/sourcing/team-clients-medium.webp 1200w, /images/sourcing/team-clients.webp 2000w"
              sizes="(max-width: 1024px) 100vw, 50vw"
              alt="The Tarmeer team with designers who joined a previous China tour"
              className="h-full w-full object-cover"
              loading="lazy"
            />
          </div>
          <div>
            <p className="text-sm font-semibold text-[#c6a065] uppercase tracking-wider">
              This Is Not a Free Holiday
            </p>
            <h2 className="font-serif text-3xl lg:text-4xl font-bold text-white leading-snug mt-3">
              A Working Trip, Measured by Real Projects
            </h2>
            <p className="text-white/70 mt-4 leading-relaxed">
              We are candid about this: the tour is an investment we make in designers who specify.
              It is tied to real project orders and measured by the specifications and business it
              converts into — not by attendance. That is why we keep the group small and select, and
              why we invite designers with live projects and the authority to act on what they see.
            </p>
            <ul className="mt-6 space-y-3">
              {[
                'Tied to real project orders, not a free trip',
                'Measured by specification and conversion, not attendance',
                'Every seat is an invitation we expect to earn its keep — for you and for us',
              ].map((item) => (
                <li key={item} className="flex items-start gap-2.5">
                  <Check className="w-4 h-4 text-[#c6a065] flex-shrink-0 mt-0.5" />
                  <span className="text-[15px] text-white/80">{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* Apply / Request an invitation */}
      <section id="apply" className="bg-white py-14 lg:py-20 scroll-mt-20">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 grid lg:grid-cols-[1fr_420px] gap-10 lg:gap-14 items-start">
          <div>
            <p className="text-sm font-semibold text-[#b8864a] uppercase tracking-wider">
              Request an Invitation
            </p>
            <h2 className="font-serif text-3xl lg:text-4xl font-bold text-[#1c1917] mt-3">
              Apply for the Second Edition
            </h2>
            <p className="text-stone-500 mt-4 leading-relaxed">
              Seats are limited and by invitation. Tell us about your studio and the projects you
              have underway — our partnerships team reviews every request personally and follows up
              within one business day.
            </p>
            <ul className="mt-6 space-y-3">
              {[
                'Invitation-only — reviewed by our partnerships team',
                'A small, fully refundable deposit confirms your seat',
                'Built for designers with live projects and specification authority',
              ].map((item) => (
                <li key={item} className="flex items-start gap-2.5">
                  <Check className="w-4 h-4 text-[#b8864a] flex-shrink-0 mt-0.5" />
                  <span className="text-[15px] text-stone-600">{item}</span>
                </li>
              ))}
            </ul>
            <div className="mt-8 flex items-center gap-3 text-sm text-stone-500">
              <Users className="w-4 h-4 text-[#b8864a] flex-shrink-0" />
              <span>Small, select group — early requests get priority for the next departure.</span>
            </div>
          </div>

          <SourcingRequestForm variant="designer_partner" />
        </div>
      </section>
    </div>
  );
}
