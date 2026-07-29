// /for-designers — Material Partner Program for Interior Designers（AE 专属）
// 契约：docs/plans/china-materials-revamp-spec.md §4「Agent 设计师」+ §6 SEO。
// 措辞铁律：合规表述统一用 "trade benefits program" / "designer trade terms"，禁止任何返点/佣金类英文字眼。
import type { Metadata } from 'next';
import Link from 'next/link';
import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import {
  BadgePercent,
  Sparkles,
  Package,
  Languages,
  ShieldCheck,
  Plane,
  ArrowRight,
  Check,
} from 'lucide-react';
import SourcingRequestForm from '@/components/sourcing/SourcingRequestForm';
import { getCountry } from '@/lib/country';
import { jsonLdHtml } from '@/lib/schema/jsonLdScript';

export const dynamic = 'force-dynamic';

const HERO_IMG = '/images/sourcing/hero-designers';

export async function generateMetadata(): Promise<Metadata> {
  const c = getCountry((await headers()).get('x-country'));
  if (c.code !== 'ae') notFound();
  const title = 'Material Partner Program for Interior Designers | Tarmeer';
  const description =
    "Specify China's newest materials with confidence — designer trade terms, exclusive first looks, free samples, and local delivery guarantees for your UAE projects.";
  return {
    title,
    description,
    openGraph: {
      title,
      description,
      images: [{ url: `${c.baseUrl}${HERO_IMG}-medium.webp` }],
      url: `${c.baseUrl}/for-designers`,
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
    },
    alternates: { canonical: `${c.baseUrl}/for-designers` },
    robots: 'index, follow, max-image-preview:large',
  };
}

const BENEFITS: {
  icon: typeof BadgePercent;
  title: string;
  desc: string;
  href?: string;
  linkLabel?: string;
}[] = [
  {
    icon: BadgePercent,
    title: 'Designer Trade Terms',
    desc: 'Dedicated trade pricing and a trade benefits program built for studios that specify materials through Tarmeer.',
  },
  {
    icon: Sparkles,
    title: 'Exclusive First Looks',
    desc: "Preview the newest material collections arriving from China before they reach the wider UAE market.",
  },
  {
    icon: Package,
    title: 'Free Sample Support',
    desc: 'Request material samples for your projects free of charge, delivered to your studio across the UAE.',
  },
  {
    icon: Languages,
    title: 'Dedicated Material Consultant',
    desc: 'A bilingual consultant works with you on selections, prepares quotations and project BOQs end to end.',
  },
  {
    icon: ShieldCheck,
    title: 'Local Delivery & After-sales Guarantee',
    desc: 'Every material you specify is backed by our local delivery commitment and after-sales guarantee.',
    href: '/guarantee',
    linkLabel: 'Read our guarantee',
  },
  {
    icon: Plane,
    title: 'China Factory Tours',
    desc: 'Join curated visits to partner factories and material hubs in China with our sourcing team.',
    href: '/for-designers/china-tour',
    linkLabel: 'See the study tour',
  },
];

const STEPS: { title: string; desc: string }[] = [
  {
    title: 'Apply',
    desc: 'Tell us about your studio and the projects you work on. Our partnerships team reviews every application.',
  },
  {
    title: 'Visit our selection center',
    desc: 'See the latest materials from China in person, with your dedicated consultant walking you through collections.',
  },
  {
    title: 'Specify materials for your project',
    desc: 'We prepare quotations and BOQs on designer trade terms, matched to your project requirements.',
  },
  {
    title: 'We source, deliver & guarantee',
    desc: 'Tarmeer handles sourcing, shipping and local delivery — every order covered by our after-sales guarantee.',
  },
];

export default async function ForDesignersPage() {
  const c = getCountry((await headers()).get('x-country'));
  if (c.code !== 'ae') notFound();

  const serviceJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Service',
    name: 'Material Partner Program for Interior Designers',
    description:
      "Specify China's newest materials with confidence — designer trade terms, exclusive first looks, free samples, and local delivery guarantees for UAE projects.",
    url: `${c.baseUrl}/for-designers`,
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
      {/* 统一走 jsonLdHtml 转义（当前虽为纯常量，防将来加动态字段踩 </script> 注入坑） */}
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
          alt="Interior designer reviewing material samples at the Tarmeer selection center"
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
            Material Partner Program
          </p>
          <h1 className="font-serif text-4xl lg:text-5xl font-bold text-white leading-tight mt-4 max-w-2xl">
            Specify China&apos;s Newest Materials <span className="text-[#c6a065]">with Confidence</span>
          </h1>
          <p className="text-lg text-white/70 mt-6 max-w-xl">
            Trade benefits, exclusive first looks, and local delivery guarantees for your projects —
            a partner program built for interior designers working in the {c.name}.
          </p>

          <div className="mt-8 flex flex-wrap gap-4">
            {['Designer trade terms', 'Free sample support', 'Local after-sales guarantee'].map((item) => (
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
              Apply to Join
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

      {/* Benefits — 6 cards */}
      <section className="bg-white py-14 lg:py-20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="text-center max-w-2xl mx-auto">
            <p className="text-sm font-semibold text-[#b8864a] uppercase tracking-wider">Program Benefits</p>
            <h2 className="font-serif text-3xl lg:text-4xl font-bold text-[#1c1917] mt-3">
              What Partner Designers Get
            </h2>
            <p className="text-stone-500 mt-4">
              One program, everything you need to specify new materials from China for {c.name} projects.
            </p>
          </div>

          <div className="mt-12 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {BENEFITS.map((b) => (
              <div
                key={b.title}
                className="border border-stone-200 rounded-2xl p-6 bg-white hover:border-[#b8864a]/40 hover:shadow-sm transition"
              >
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#b8864a]/10">
                  <b.icon className="w-5 h-5 text-[#b8864a]" />
                </div>
                <h3 className="font-serif text-lg font-bold text-[#1c1917] mt-4">{b.title}</h3>
                <p className="text-sm text-stone-500 leading-relaxed mt-2">{b.desc}</p>
                {b.href && (
                  <Link
                    href={b.href}
                    className="inline-flex items-center gap-1 text-sm font-semibold text-[#b8864a] hover:text-[#a07640] mt-3 transition"
                  >
                    {b.linkLabel}
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works — 4 steps */}
      <section className="bg-stone-50 py-14 lg:py-20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="text-center max-w-2xl mx-auto">
            <p className="text-sm font-semibold text-[#b8864a] uppercase tracking-wider">How It Works</p>
            <h2 className="font-serif text-3xl lg:text-4xl font-bold text-[#1c1917] mt-3">
              From Application to Delivered Project
            </h2>
          </div>

          <div className="mt-12 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {STEPS.map((step, i) => (
              <div key={step.title} className="relative border border-stone-200 rounded-2xl p-6 bg-white">
                <span className="font-serif text-4xl font-bold text-[#b8864a]/25 leading-none">
                  {String(i + 1).padStart(2, '0')}
                </span>
                <h3 className="font-serif text-lg font-bold text-[#1c1917] mt-3">{step.title}</h3>
                <p className="text-sm text-stone-500 leading-relaxed mt-2">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Who is it for */}
      <section className="bg-[#1c1917] py-12 lg:py-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 text-center">
          <p className="text-sm font-semibold text-[#c6a065] uppercase tracking-wider">Who Is It For</p>
          <p className="font-serif text-2xl lg:text-3xl font-bold text-white leading-snug mt-4">
            Interior designers &amp; architects working on {c.name} residential and commercial projects.
          </p>
        </div>
      </section>

      {/* Apply form */}
      <section id="apply" className="bg-white py-14 lg:py-20 scroll-mt-20">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 grid lg:grid-cols-[1fr_420px] gap-10 lg:gap-14 items-start">
          <div>
            <p className="text-sm font-semibold text-[#b8864a] uppercase tracking-wider">Apply Now</p>
            <h2 className="font-serif text-3xl lg:text-4xl font-bold text-[#1c1917] mt-3">
              Join the Material Partner Program
            </h2>
            <p className="text-stone-500 mt-4 leading-relaxed">
              Tell us about your studio and the projects you work on. Our partnerships team reviews
              every application and gets back to you within one business day.
            </p>
            <ul className="mt-6 space-y-3">
              {[
                'No membership fees — apply with your studio details',
                'Designer trade terms from your first project',
                'Dedicated bilingual consultant assigned on approval',
              ].map((item) => (
                <li key={item} className="flex items-start gap-2.5">
                  <Check className="w-4 h-4 text-[#b8864a] flex-shrink-0 mt-0.5" />
                  <span className="text-[15px] text-stone-600">{item}</span>
                </li>
              ))}
            </ul>
          </div>

          <SourcingRequestForm variant="designer_partner" />
        </div>
      </section>

      {/* CTA — material library */}
      <section className="bg-stone-50 py-12 lg:py-16 border-t border-stone-200">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 text-center">
          <h2 className="font-serif text-2xl lg:text-3xl font-bold text-[#1c1917]">
            Not ready to apply yet?
          </h2>
          <p className="text-stone-500 mt-3">
            Explore the latest materials from China available for {c.name} projects.
          </p>
          <Link
            href="/materials"
            className="inline-flex items-center gap-2 h-12 px-6 mt-6 rounded-lg bg-[#b8864a] hover:bg-[#a07640] text-white text-sm font-semibold transition"
          >
            Browse the Material Library
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>
    </div>
  );
}
