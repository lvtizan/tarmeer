'use client';

import Link from 'next/link';
import { useSiteLocale } from '@/contexts/SiteLocaleContext';

const SPACE_CARD_KEYS = [
  { key: 'Villa' as const, to: '/companies?style=Villa', image: '/images/hero/hero-villa-1.jpg', size: 'large' },
  { key: 'Apartment' as const, to: '/companies?style=Apartment', image: '/images/hero/hero-living-1.jpg', size: 'large' },
  { key: 'Commercial' as const, to: '/companies?style=Commercial', image: '/images/hero/hero-kitchen-1.jpg', size: 'small' },
  { key: 'Office' as const, to: '/companies?style=Office', image: '/images/hero/hero-living-2.jpg', size: 'small' },
  { key: 'Landscape' as const, to: '/companies?service=Landscape', image: '/images/hero/hero-renovation-xl.webp', size: 'small' },
];

export default function HomeSpaceSection() {
  const { tr } = useSiteLocale();

  const cards = SPACE_CARD_KEYS.map((c) => ({
    ...c,
    label: tr.home.spaceCards[c.key].label,
    subtitle: tr.home.spaceCards[c.key].subtitle,
  }));

  const large = cards.filter((c) => c.size === 'large');
  const small = cards.filter((c) => c.size === 'small');

  return (
    <section className="bg-[#faf9f7] py-10 sm:py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="mb-7">
          <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-[#b8864a] mb-1.5">{tr.home.spaceTag}</p>
          <h2 className="font-serif text-[26px] leading-tight text-[#1c1917] sm:text-[32px]">{tr.home.browseBySpace}</h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
          {large.map((card) => (
            <Link key={card.key} href={card.to} className="group relative overflow-hidden rounded-2xl block" style={{ height: '240px' }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={card.image} alt={card.label} className="absolute inset-0 h-full w-full object-cover transition duration-500 group-hover:scale-105" loading="lazy" />
              <div className="absolute inset-0" style={{ background: 'linear-gradient(to top, rgba(20,17,14,0.82) 0%, rgba(20,17,14,0.18) 55%, transparent 100%)' }} />
              <div className="absolute inset-0 flex flex-col justify-end p-6">
                <h3 className="font-serif text-2xl font-semibold text-white leading-tight">{card.label}</h3>
                <p className="text-white/60 text-xs mt-1">{card.subtitle}</p>
              </div>
              <div className="absolute top-4 right-4">
                <span className="text-xs font-medium text-white/80 bg-white/15 backdrop-blur-sm px-2.5 py-1 rounded-full">{tr.home.explore}</span>
              </div>
            </Link>
          ))}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {small.map((card) => (
            <Link key={card.key} href={card.to} className="group relative overflow-hidden rounded-2xl block" style={{ height: '175px' }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={card.image} alt={card.label} className="absolute inset-0 h-full w-full object-cover transition duration-500 group-hover:scale-105" loading="lazy" />
              <div className="absolute inset-0" style={{ background: 'linear-gradient(to top, rgba(20,17,14,0.80) 0%, rgba(20,17,14,0.15) 55%, transparent 100%)' }} />
              <div className="absolute inset-0 flex flex-col justify-end p-5">
                <h3 className="font-serif text-lg font-semibold text-white leading-tight">{card.label}</h3>
                <p className="text-white/55 text-[11px] mt-0.5">{card.subtitle}</p>
              </div>
              <div className="absolute top-3 right-3">
                <span className="text-[11px] font-medium text-white/70 bg-white/15 backdrop-blur-sm px-2 py-0.5 rounded-full">{tr.home.explore}</span>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
