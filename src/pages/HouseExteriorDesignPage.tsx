import { Helmet } from 'react-helmet-async';
import { ArrowLeft, CheckCircle, CircleGauge, Layers3, Ruler, Sparkles } from 'lucide-react';
import { Link } from 'react-router-dom';
import ServiceInquiryCard from '../components/services/ServiceInquiryCard';

const HIGHLIGHTS = [
  {
    title: 'Facade concept',
    description: 'Clear design direction for the exterior composition, proportions, and architectural language.',
    icon: Sparkles,
  },
  {
    title: 'Material language',
    description: 'A cohesive palette of finishes, textures, and colors that works for climate and budget.',
    icon: Layers3,
  },
  {
    title: 'Construction ready',
    description: 'Layout drawings and specification guidance that can move smoothly into execution.',
    icon: Ruler,
  },
];

const DELIVERABLES = [
  'Facade concept sketches and direction board',
  'Exterior layout and massing drawings',
  'Material and finish recommendations',
  'Visualizations for client approval',
  'Construction-ready documentation set',
  'Coordination notes for contractors',
];

export default function HouseExteriorDesignPage() {
  return (
    <div className="min-h-screen bg-[#faf9f7]">
      <Helmet>
        <title>House Exterior Design Service - Facade & Landscape | Tarmeer</title>
        <meta name="description" content="Professional house exterior design service in the UAE. Facade concepts, material selection, layout drawings, and construction-ready documentation for villas and homes." />
        <meta property="og:title" content="House Exterior Design Service | Tarmeer" />
        <meta property="og:description" content="Facade design, material selection, and construction documentation for UAE homes." />
        <meta property="og:image" content="https://www.tarmeer.com/og-default.jpg" />
        <meta property="og:type" content="website" />
        <meta property="og:url" content="https://www.tarmeer.com/services/house-exterior" />
        <link rel="canonical" href="https://www.tarmeer.com/services/house-exterior" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="keywords" content="house exterior design UAE, facade design, villa exterior, landscape design, construction drawings, Tarmeer" />
        <meta name="robots" content="index, follow, max-image-preview:large" />
        <script type="application/ld+json">{JSON.stringify({
          '@context': 'https://schema.org',
          '@type': 'Service',
          name: 'House Exterior Design',
          description: 'Exterior design service for villas and standalone homes including facade direction, material language, layout drawings, and construction-ready documentation.',
          provider: { '@type': 'Organization', name: 'Tarmeer', url: 'https://www.tarmeer.com' },
          areaServed: { '@type': 'Country', name: 'United Arab Emirates' },
          serviceType: 'Exterior Design',
          url: 'https://www.tarmeer.com/services/house-exterior',
        })}</script>
      </Helmet>
      <section className="relative h-[200px] sm:h-[280px] overflow-hidden bg-gradient-to-r from-[#2c2c2c] to-[#45413b]">
        <div className="absolute inset-0 opacity-35">
          <img
            src="https://images.unsplash.com/photo-1494526585095-c41746248156?w=1200&q=75"
            alt=""
            fetchPriority="high"
            className="h-full w-full object-cover"
          />
        </div>
        <div className="relative mx-auto flex h-full max-w-7xl items-center px-4 sm:px-6">
          <div>
            <p className="mb-2 text-xs uppercase tracking-widest text-white/60 sm:text-sm">Design Package</p>
            <h1 className="mb-2 font-serif text-3xl font-bold text-white sm:text-4xl md:text-5xl">
              House Exterior Design
            </h1>
            <p className="hidden max-w-xl text-sm text-white/70 sm:block">
              Exterior design service for villas and standalone homes, including facade direction, material language, layout drawings, visualizations and construction-ready documentation.
            </p>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:py-12">
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start">
          <div className="space-y-6">
            <div className="flex items-center gap-3">
              <Link to="/#pricing" className="inline-flex shrink-0 items-center gap-1.5 text-sm text-[#6b6b6b] transition hover:text-[#b8864a]">
                <ArrowLeft className="w-4 h-4" />
                Back
              </Link>
              <h2 className="font-serif text-xl font-semibold text-[#2c2c2c] sm:text-2xl">What You'll Get</h2>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              {HIGHLIGHTS.map((item) => {
                const Icon = item.icon;
                return (
                  <div key={item.title} className="rounded-xl border border-stone-200 bg-white p-5 shadow-sm">
                    <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-full border border-[#c6a065]/30 bg-[#c6a065]/10 text-[#b8864a]">
                      <Icon className="h-5 w-5" strokeWidth={1.8} />
                    </div>
                    <h3 className="mb-2 text-base font-semibold text-[#2c2c2c]">{item.title}</h3>
                    <p className="text-sm leading-6 text-[#6b6b6b]">{item.description}</p>
                  </div>
                );
              })}
            </div>

            <div className="rounded-xl border border-stone-200 bg-white p-5">
              <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-[#1c1917]">
                <CircleGauge className="h-4 w-4 text-[#b8864a]" />
                Deliverables
              </div>
              <ul className="grid gap-2 sm:grid-cols-2">
                {DELIVERABLES.map((item) => (
                  <li key={item} className="flex items-start gap-2 text-sm text-[#2c2c2c]/90">
                    <CheckCircle className="mt-0.5 h-4 w-4 shrink-0 text-[#b8864a]" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="rounded-xl border border-[#b8864a]/30 bg-[#b8864a]/10 p-4 text-center">
              <p className="text-sm text-[#2c2c2c]">
                <span className="font-semibold">Best for:</span> villas, standalone homes, and custom residential facades.
              </p>
            </div>
          </div>

          <aside className="lg:sticky lg:top-6">
            <ServiceInquiryCard
              title="Get in touch with Tarmeer"
              subtitle="Tell us about your project and we'll connect you."
            />
          </aside>
        </div>
      </div>
    </div>
  );
}
