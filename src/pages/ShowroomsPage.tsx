import { Link } from 'react-router-dom';
import PageContainer from '../components/PageContainer';
import { brandsList } from '../data/brands';
import { WHATSAPP_LINK, GOOGLE_MAPS_URL } from '../lib/constants';
import { MapPin, Clock, Palette, Building2, Package } from 'lucide-react';

const PRIMARY = '#b8864a';

const EXPERIENCE_ITEMS = [
  {
    title: 'Tactile Material Testing',
    text: 'Touch and feel our exclusive range of marbles, timbers, and high-performance synthetics.',
    icon: Palette,
  },
  {
    title: 'Design Consultation',
    text: 'Work directly with our expert interior designers to map out your space and material needs.',
    icon: Building2,
  },
  {
    title: 'Personalized Sourcing',
    text: 'Direct access to our premium Chinese supply chain, customized for your specific project requirements.',
    icon: Package,
  },
];

export default function MaterialsPage() {
  const scrollToLocations = () => {
    document.getElementById('locations')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div className="min-h-screen bg-[#faf9f7]">
      <section className="relative h-[500px] sm:h-[600px] flex items-center overflow-hidden">
        <div className="absolute inset-0 z-0">
          <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/40 to-transparent z-10" />
          <img
            src="https://images.unsplash.com/photo-1618221195710-dd6b41faaea6?w=1600&q=80"
            alt=""
            className="w-full h-full object-cover"
          />
        </div>
        <div className="relative z-20 max-w-6xl mx-auto px-4 sm:px-6 lg:px-10 w-full">
          <div className="max-w-2xl">
            <span
              className="inline-block px-3 py-1 rounded text-[10px] font-bold uppercase tracking-widest text-white mb-6"
              style={{ backgroundColor: PRIMARY }}
            >
              Physical Showrooms
            </span>
            <h1 className="font-serif text-4xl sm:text-5xl lg:text-6xl font-bold text-white leading-tight mb-6 tracking-tight">
              Experience Excellence <br />
              <span className="italic font-light" style={{ color: PRIMARY }}>
                In Person.
              </span>
            </h1>
            <p className="text-lg lg:text-xl text-slate-200 mb-10 leading-relaxed font-light">
              Step into tactile world of Tarmeer. Discover beauty of premium materials in our curated showroom in Sharjah.
            </p>
            <div className="flex flex-wrap gap-4">
              <button
                type="button"
                onClick={scrollToLocations}
                className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-lg font-bold transition-transform hover:scale-105 text-white shadow-xl"
                style={{ backgroundColor: PRIMARY }}
              >
                Explore Locations
              </button>
            </div>
          </div>
        </div>
      </section>

      <PageContainer className="py-12 sm:py-16">
        <Link to="/" className="text-[#c6a065] hover:underline text-sm mb-8 inline-block">
          ← Back to Home
        </Link>

        <div className="space-y-12 sm:space-y-16">
          <section id="locations">
            <h2 className="font-serif text-3xl lg:text-4xl font-bold text-[#2c2c2c] mb-6 text-center">
              Our Location — Sharjah
            </h2>
            <div className="rounded-lg overflow-hidden border border-stone-200 bg-white shadow-sm">
              <div className="w-full bg-stone-100">
                <img
                  src="/images/showroom-sharjah-panorama.png"
                  alt="Tarmeer showroom Sharjah"
                  className="w-full h-auto object-contain"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = '/images/materials-banner.png';
                  }}
                />
              </div>
              <div className="p-6 sm:p-8">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div className="flex items-start gap-3 text-[#6b6b6b]">
                    <MapPin className="w-5 h-5 shrink-0 mt-0.5" style={{ color: PRIMARY }} />
                    <span className="text-sm">1 - 2a 147 street - Al Sajaa - Sharjah - United Arab Emirates</span>
                  </div>
                  <div className="flex items-start gap-3 text-[#6b6b6b]">
                    <Clock className="w-5 h-5 shrink-0 mt-0.5" style={{ color: PRIMARY }} />
                    <span className="text-sm">9:00 AM - 8:00 PM (Sat - Thu)</span>
                  </div>
                </div>
                <div className="flex flex-col sm:flex-row gap-3 mt-6">
                  <a
                    href={WHATSAPP_LINK}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn-primary text-white text-center font-bold py-3 rounded-lg"
                  >
                    Book a Consultation
                  </a>
                  <a
                    href={GOOGLE_MAPS_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="py-3 px-6 sm:px-8 rounded-lg border border-stone-200 bg-stone-50 text-[#2c2c2c] font-bold text-center hover:bg-[#b8864a]/10 transition"
                  >
                    View on Map
                  </a>
                </div>
              </div>
            </div>
          </section>

          <section>
            <h2 className="font-serif text-3xl lg:text-4xl font-bold text-[#2c2c2c] mb-6 text-center">
              Partner Brands
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 sm:gap-6">
              {brandsList.map((brand) => (
                <Link
                  key={brand.slug}
                  to={`/materials/brands/${brand.slug}`}
                  className="group flex flex-col bg-white rounded-lg border border-stone-100 overflow-hidden hover:border-[#c6a065]/40 hover:shadow-lg transition"
                >
                  <div className="aspect-video w-full flex items-center justify-center bg-stone-50 overflow-hidden">
                    <img
                      src={brand.logo}
                      alt={brand.nameEn}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = 'none';
                      }}
                    />
                  </div>
                  <div className="p-4 text-center">
                    <h4 className="font-semibold text-[#2c2c2c] group-hover:text-[#b8864a] transition">
                      {brand.nameEn}
                    </h4>
                    <p className="text-xs text-[#6b6b6b] mt-1">{brand.tagline}</p>
                  </div>
                </Link>
              ))}
            </div>
          </section>

          <section>
            <div className="text-center mb-12">
              <h2 className="font-serif text-3xl lg:text-4xl font-bold text-[#2c2c2c] mb-4 tracking-tight">
                The Showroom Experience
              </h2>
              <div className="w-20 h-1.5 rounded-full mx-auto" style={{ backgroundColor: PRIMARY }} />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {EXPERIENCE_ITEMS.map((item) => {
                const Icon = item.icon;
                return (
                  <div
                    key={item.title}
                    className="flex flex-col items-center text-center p-8 rounded-lg border border-stone-200 bg-white hover:border-[#b8864a]/40 transition-colors"
                  >
                    <div
                      className="size-16 rounded-full flex items-center justify-center mb-6"
                      style={{ backgroundColor: `${PRIMARY}20` }}
                    >
                      <Icon className="w-8 h-8" style={{ color: PRIMARY }} />
                    </div>
                    <h3 className="text-xl font-bold text-[#2c2c2c] mb-3">{item.title}</h3>
                    <p className="text-[#6b6b6b] leading-relaxed">{item.text}</p>
                  </div>
                );
              })}
            </div>
          </section>

          <section>
              <div
                className="relative rounded-lg p-10 lg:p-16 overflow-hidden text-white flex flex-col lg:flex-row items-center-center justify-between gap-8 lg:gap-10"
                style={{ backgroundColor: PRIMARY }}
              >
              <div className="relative z-10 max-w-xl">
                <h2 className="text-3xl lg:text-4xl font-bold mb-3 leading-tight text-white">
                  Ready to start your project?
                </h2>
                <p className="text-lg font-medium text-white/90">
                  Visit our Sharjah showroom for a bespoke design consultation and material curation, or contact us to get started.
                </p>
              </div>
              <div className="relative z-10 shrink-0">
                <a
                  href={WHATSAPP_LINK}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-block bg-[#1c1917] text-white text-lg font-bold px-10 py-4 rounded-2xl hover:bg-stone-800 transition shadow-xl"
                >
                  Contact Us
                </a>
              </div>
            </div>
          </section>
        </div>
      </PageContainer>
    </div>
  );
}
