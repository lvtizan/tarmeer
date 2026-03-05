import { Link } from 'react-router-dom';
import { MapPin, Clock, Palette, Building2, Package } from 'lucide-react';
import { GOOGLE_MAPS_URL, WHATSAPP_LINK } from '../lib/constants';

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

const SHOWROOMS = [
  {
    id: 'sharjah',
    city: 'SHARJAH',
    name: 'Al Sajaa — Sharjah',
    address: '1 - 2a 147 street - Al Sajaa - Sharjah - United Arab Emirates',
    hours: '9:00 AM - 8:00 PM (Sat - Thu)',
    mapUrl: GOOGLE_MAPS_URL,
    image: 'https://images.unsplash.com/photo-1618221195710-dd6b41faaea6?w=800&q=80',
  },
  {
    id: 'dubai',
    city: 'DUBAI',
    name: 'Dubai Design District',
    address: 'Building 4, D3, Dubai, United Arab Emirates',
    hours: '9:00 AM - 8:00 PM (Sat - Thu)',
    mapUrl: GOOGLE_MAPS_URL,
    image: 'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=800&q=80',
  },
  {
    id: 'riyadh',
    city: 'RIYADH',
    name: 'Riyadh, Olaya',
    address: 'Olaya St, Commercial Center, Riyadh, KSA',
    hours: '10:00 AM - 9:00 PM (Sat - Thu)',
    mapUrl: 'https://www.google.com/maps/search/Olaya+Riyadh',
    image: 'https://images.unsplash.com/photo-1600566753190-17f0baa2a6c3?w=800&q=80',
  },
];

export default function ShowroomsPage() {
  return (
    <div className="min-h-screen">
      {/* Hero */}
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
              className="inline-block px-3 py-1 rounded text-[10px] font-bold uppercase tracking-widest text-[#2c2c2c] mb-6"
              style={{ backgroundColor: PRIMARY }}
            >
              Physical Showrooms
            </span>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-white leading-tight mb-6 tracking-tight">
              Experience Excellence <br />
              <span className="italic font-serif font-light" style={{ color: PRIMARY }}>
                In Person.
              </span>
            </h1>
            <p className="text-lg lg:text-xl text-slate-200 mb-10 leading-relaxed font-light">
              Step into the tactile world of Tarmeer. Discover the beauty of premium Chinese materials in our curated showrooms across the Middle East.
            </p>
            <div className="flex flex-wrap gap-4">
              <a
                href="#locations"
                className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-lg font-bold transition-transform hover:scale-105 text-[#2c2c2c] shadow-xl"
                style={{ backgroundColor: PRIMARY }}
              >
                Explore Locations
              </a>
              <Link
                to="/materials"
                className="inline-flex items-center justify-center px-8 py-4 rounded-lg font-bold bg-white/10 backdrop-blur-md text-white border border-white/20 hover:bg-white/20 transition"
              >
                Virtual Tour
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Experience Section */}
      <section className="py-16 sm:py-24 bg-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-10">
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
                  className="flex flex-col items-center text-center p-8 rounded-2xl border border-stone-200 bg-[#faf9f7] hover:border-[#b8864a]/40 transition-colors"
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
        </div>
      </section>

      {/* Our Locations */}
      <section id="locations" className="py-16 sm:py-24 bg-[#faf9f7]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-10">
          <div className="flex flex-col lg:flex-row justify-between items-end mb-12 gap-6">
            <div>
              <h2 className="font-serif text-3xl lg:text-4xl font-bold text-[#2c2c2c] mb-4">
                Our Locations
              </h2>
              <p className="text-[#6b6b6b] max-w-lg">
                Visit us in the heart of the Middle East&apos;s design hubs. Each showroom features our latest collections and dedicated design labs.
              </p>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {SHOWROOMS.map((loc) => (
              <div
                key={loc.id}
                className="group bg-white rounded-2xl overflow-hidden shadow-sm border border-stone-200 hover:shadow-xl transition-all"
              >
                <div className="relative h-56 overflow-hidden">
                  <img
                    src={loc.image}
                    alt=""
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1618221195710-dd6b41faaea6?w=800&q=80';
                    }}
                  />
                  <div
                    className="absolute top-4 right-4 px-3 py-1 rounded-full text-[10px] font-bold text-[#2c2c2c]"
                    style={{ backgroundColor: PRIMARY }}
                  >
                    {loc.city}
                  </div>
                </div>
                <div className="p-6">
                  <h3 className="text-xl font-bold text-[#2c2c2c] mb-4">{loc.name}</h3>
                  <div className="space-y-3 mb-6">
                    <div className="flex items-start gap-3 text-[#6b6b6b]">
                      <MapPin className="w-5 h-5 shrink-0 mt-0.5" style={{ color: PRIMARY }} />
                      <span className="text-sm">{loc.address}</span>
                    </div>
                    <div className="flex items-start gap-3 text-[#6b6b6b]">
                      <Clock className="w-5 h-5 shrink-0 mt-0.5" style={{ color: PRIMARY }} />
                      <span className="text-sm">{loc.hours}</span>
                    </div>
                  </div>
                  <div className="flex flex-col gap-3">
                    <a
                      href={WHATSAPP_LINK}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full btn-primary text-center font-bold py-3 rounded-xl"
                    >
                      Book a Consultation
                    </a>
                    <a
                      href={loc.mapUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full py-3 rounded-xl border border-stone-200 bg-stone-50 text-[#2c2c2c] font-bold text-center hover:bg-[#b8864a]/10 transition"
                    >
                      View on Map
                    </a>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Appointment Banner */}
      <section className="py-12 sm:py-16 px-4 sm:px-6 lg:px-10">
        <div className="max-w-6xl mx-auto">
          <div
            className="relative rounded-3xl p-10 lg:p-16 overflow-hidden text-white flex flex-col lg:flex-row items-center justify-between gap-8 lg:gap-10"
            style={{ backgroundColor: PRIMARY }}
          >
            <div className="absolute -top-24 -right-24 w-96 h-96 bg-white/10 rounded-full blur-3xl" />
            <div className="relative z-10 max-w-xl">
              <h2 className="text-3xl lg:text-4xl font-bold mb-3 leading-tight">
                Ready to start your project?
              </h2>
              <p className="text-lg font-medium text-stone-100">
                Join us at any of our showrooms for a bespoke design consultation and material curation session.
              </p>
            </div>
            <div className="relative z-10 shrink-0">
              <a
                href={WHATSAPP_LINK}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block bg-[#1c1917] text-white text-lg font-bold px-10 py-4 rounded-2xl hover:bg-stone-800 transition shadow-xl"
              >
                Schedule Visit Now
              </a>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
