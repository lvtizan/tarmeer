'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useSiteLocale } from '@/contexts/SiteLocaleContext';
import { COUNTRY } from '@/lib/country';
import { ADDRESS, VN_ADDRESS, GOOGLE_MAPS_URL, VN_GOOGLE_MAPS_URL, WHATSAPP_LINK, VN_WHATSAPP_NUMBERS } from '@/lib/constants';
import { resolveImageUrl, resolveVariantUrl } from '@/lib/imageUrl';
import type { Supplier } from '@/components/materials/MaterialsClient';
import ProgressiveImage from '@/components/ui/ProgressiveImage';
import { MapPin, ArrowRight, Building2, Home, Layers } from 'lucide-react';

const API_BASE = process.env.NEXT_PUBLIC_API_URL?.trim() || '/api';

function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
  );
}

export default function AboutClient() {
  const { lang, tr } = useSiteLocale();
  const t = tr.about;
  const isVn = lang === 'vi';

  // Section imagery is country-aware: AE uses on-brand UAE villa scenes,
  // VN keeps culture-neutral interiors (no Gulf-specific imagery for VN users).
  // Canonical variant scheme (matches the site-wide image pipeline):
  // -blur (40px, instant placeholder) → -thumb (600) → -medium (1200) → full (1672).
  const aboutImg = (base: string) => ({
    src: `/images/about/${base}-medium.webp`,
    srcSet: `/images/about/${base}-thumb.webp 600w, /images/about/${base}-medium.webp 1200w, /images/about/${base}.webp 1672w`,
    blur: `/images/about/${base}-blur.webp`,
  });
  const heroImg = aboutImg(isVn ? 'hero-living-vn' : 'hero-villa-ae');
  const whoImg = aboutImg(isVn ? 'who-consultation' : 'who-villa-ae');
  const servicesImg = aboutImg(isVn ? 'services-consultation' : 'services-villa-ae');
  // AE photos are 3:1 cinematic; VN photos are 16:9.
  const contentAspect = isVn ? 'aspect-video' : 'aspect-[3/1]';

  // WhatsApp is country-aware (matches the footer): AE → +971, VN → local number.
  const wa = isVn ? VN_WHATSAPP_NUMBERS[0] : { label: '+971 58 838 8922', link: WHATSAPP_LINK };

  // Materials/suppliers section is AE-only (VN hides materials).
  const sections = [
    { id: 'who', label: t.tocWhoWeAre },
    { id: 'services', label: t.tocServices },
    ...(isVn ? [] : [{ id: 'materials', label: t.tocMaterials }]),
    { id: 'coverage', label: t.tocCoverage },
    { id: 'contact', label: t.tocContact },
  ];

  const [activeId, setActiveId] = useState('who');
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);

  // Scroll-spy: highlight the ToC entry whose section is in view.
  useEffect(() => {
    const observer = new IntersectionObserver(
      entries => {
        const visible = entries.filter(e => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActiveId(visible[0].target.id);
      },
      { rootMargin: '-30% 0px -55% 0px', threshold: 0 },
    );
    sections.forEach(s => {
      const el = document.getElementById(s.id);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isVn]);

  // Live supplier strip — AE only.
  useEffect(() => {
    if (isVn) return;
    let mounted = true;
    fetch(`${API_BASE}/suppliers?limit=6`)
      .then(r => (r.ok ? r.json() : null))
      .then((d: { suppliers?: Supplier[] } | Supplier[] | null) => {
        if (!mounted || !d) return;
        const list = Array.isArray(d) ? d : (d.suppliers ?? []);
        setSuppliers(list.slice(0, 6));
      })
      .catch(() => {});
    return () => { mounted = false; };
  }, [isVn]);

  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div className="min-h-screen bg-[#faf9f7]">
      {/* Hero */}
      <header className="relative w-full overflow-hidden bg-[#1c1917]">
        {/* 3:1 cinematic band — image is 3:1 too → full-bleed, full people, zero crop */}
        <ProgressiveImage
          src={heroImg.src}
          srcSet={heroImg.srcSet}
          sizes="100vw"
          blur={heroImg.blur}
          alt="Tarmeer advisor with homeowners at a luxury villa"
          loading="eager"
          fetchPriority="high"
          className="aspect-[3/1] max-h-[72vh] w-full"
        />
        {/* bottom-up gradient keeps the title legible without covering faces */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-[#1c1917] via-[#1c1917]/45 to-transparent" />
        <div className="absolute inset-x-0 bottom-0">
          <div className="mx-auto max-w-6xl px-5 pb-6 sm:pb-9">
            <p className="mb-2 text-sm font-semibold uppercase tracking-[0.2em] text-[#c6a065]">Tarmeer</p>
            <h1 className="text-3xl font-bold leading-tight text-white sm:text-4xl">{t.pageTitle}</h1>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-white/85 sm:text-base">{t.heroTagline}</p>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-6xl grid-cols-1 gap-10 px-5 py-12 lg:grid-cols-[220px_minmax(0,1fr)] lg:py-16">
        {/* Left ToC */}
        <aside className="lg:sticky lg:top-24 lg:self-start">
          <nav className="flex gap-2 overflow-x-auto lg:flex-col lg:gap-1">
            {sections.map((s, i) => (
              <button
                key={s.id}
                type="button"
                onClick={() => scrollTo(s.id)}
                className={`shrink-0 rounded-lg px-3 py-2 text-left text-sm transition ${
                  activeId === s.id
                    ? 'bg-[#b8864a]/10 font-semibold text-[#b8864a]'
                    : 'text-stone-500 hover:bg-stone-100 hover:text-stone-800'
                }`}
              >
                <span className="mr-2 tabular-nums text-stone-400">{String(i + 1).padStart(2, '0')}</span>
                {s.label}
              </button>
            ))}
          </nav>
        </aside>

        {/* Right content */}
        <div className="min-w-0 space-y-16">
          {/* Who we are */}
          <section id="who" className="scroll-mt-24">
            <h2 className="text-2xl font-bold text-[#2c2c2c]">{t.whoTitle}</h2>
            <div className="mt-4 space-y-4 text-[15px] leading-relaxed text-stone-600">
              <p>{t.whoBody1}</p>
              <p>{t.whoBody2}</p>
            </div>
            <ProgressiveImage
              src={whoImg.src}
              srcSet={whoImg.srcSet}
              sizes="(min-width: 1024px) 900px, 100vw"
              blur={whoImg.blur}
              loading="lazy"
              alt="Reviewing floor plans and material samples with a client"
              className={`mt-6 w-full rounded-2xl ${contentAspect}`}
            />
          </section>

          {/* Services */}
          <section id="services" className="scroll-mt-24">
            <h2 className="text-2xl font-bold text-[#2c2c2c]">{t.servicesTitle}</h2>
            <p className="mt-3 text-[15px] text-stone-600">{t.servicesIntro}</p>
            <ProgressiveImage
              src={servicesImg.src}
              srcSet={servicesImg.srcSet}
              sizes="(min-width: 1024px) 900px, 100vw"
              blur={servicesImg.blur}
              loading="lazy"
              alt="A Tarmeer advisor discussing project options with homeowners"
              className={`mt-6 w-full rounded-2xl ${contentAspect}`}
            />
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <div className="rounded-2xl border border-stone-200 bg-white p-6">
                <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-[#b8864a]/10">
                  <Home className="h-5 w-5 text-[#b8864a]" />
                </div>
                <h3 className="text-lg font-semibold text-[#2c2c2c]">{t.forHomeownersTitle}</h3>
                <p className="mt-2 text-sm leading-relaxed text-stone-600">{t.forHomeownersBody}</p>
              </div>
              <div className="rounded-2xl border border-stone-200 bg-white p-6">
                <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-[#b8864a]/10">
                  <Building2 className="h-5 w-5 text-[#b8864a]" />
                </div>
                <h3 className="text-lg font-semibold text-[#2c2c2c]">{t.forCompaniesTitle}</h3>
                <p className="mt-2 text-sm leading-relaxed text-stone-600">{t.forCompaniesBody}</p>
              </div>
            </div>
          </section>

          {/* Building materials — AE only */}
          {!isVn && (
            <section id="materials" className="scroll-mt-24">
              <h2 className="text-2xl font-bold text-[#2c2c2c]">{t.materialsTitle}</h2>
              <div className="mt-4 space-y-4 text-[15px] leading-relaxed text-stone-600">
                <p>{t.materialsBody1}</p>
                <p>{t.materialsBody2}</p>
              </div>
              <div className="mt-6 overflow-hidden rounded-2xl border border-stone-200">
                <img src="/images/showroom-sharjah-panorama.jpg" alt="Al Tameer United building materials center, Sharjah" className="w-full object-cover" />
              </div>

              {/* Supplier strip */}
              {suppliers.length > 0 && (
                <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {suppliers.map(s => (
                    <Link
                      key={s.slug}
                      href={`/materials/suppliers/${s.slug}`}
                      className="group overflow-hidden rounded-xl border border-stone-200 bg-white transition hover:shadow-md"
                    >
                      <div className="aspect-video overflow-hidden bg-stone-100">
                        <img
                          src={s.cover_image_url ? resolveVariantUrl(s.cover_image_url, 'thumb') : resolveImageUrl(s.logo_url)}
                          alt={s.company_name}
                          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                        />
                      </div>
                      <p className="truncate px-3 py-2 text-xs font-medium text-[#2c2c2c]">{s.company_name}</p>
                    </Link>
                  ))}
                </div>
              )}

              {/* CTA */}
              <Link
                href="/materials"
                className="mt-6 flex items-center justify-between gap-4 rounded-2xl border border-[#b8864a]/30 bg-[#b8864a]/[0.06] px-5 py-4 transition hover:bg-[#b8864a]/10"
              >
                <div className="flex items-center gap-3">
                  <Layers className="h-5 w-5 shrink-0 text-[#b8864a]" />
                  <div>
                    <p className="text-sm font-semibold text-[#2c2c2c]">{t.materialsCtaTitle}</p>
                    <p className="text-xs text-stone-500">{t.materialsCtaBody}</p>
                  </div>
                </div>
                <span className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-[#b8864a] px-4 py-2 text-sm font-semibold text-white">
                  {t.materialsCtaBtn}
                  <ArrowRight className="h-4 w-4" />
                </span>
              </Link>
            </section>
          )}

          {/* Coverage */}
          <section id="coverage" className="scroll-mt-24">
            <h2 className="text-2xl font-bold text-[#2c2c2c]">{t.coverageTitle}</h2>
            <p className="mt-3 text-[15px] text-stone-600">{t.coverageBody}</p>
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <div className="rounded-2xl border border-stone-200 bg-white p-6">
                <h3 className="text-lg font-semibold text-[#2c2c2c]">{t.coverageUaeTitle}</h3>
                <div className="mt-3 flex flex-wrap gap-2">
                  {COUNTRY.ae.cities.map(c => (
                    <span key={c} className="rounded-full bg-stone-100 px-3 py-1 text-xs text-stone-600">{c}</span>
                  ))}
                </div>
                <a
                  href={GOOGLE_MAPS_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group mt-4 flex items-start gap-2 text-xs leading-relaxed text-stone-500 transition hover:text-[#b8864a]"
                >
                  <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#b8864a]" />
                  <span>
                    <strong className="font-semibold text-stone-600 group-hover:text-[#b8864a]">{t.officeLabel}:</strong> {ADDRESS}
                    <span className="mt-1 block font-medium text-[#b8864a] underline-offset-2 group-hover:underline">{t.viewOnMap} →</span>
                  </span>
                </a>
              </div>
              <div className="rounded-2xl border border-stone-200 bg-white p-6">
                <h3 className="text-lg font-semibold text-[#2c2c2c]">{t.coverageVnTitle}</h3>
                <div className="mt-3 flex flex-wrap gap-2">
                  {COUNTRY.vn.cities.map(c => (
                    <span key={c} className="rounded-full bg-stone-100 px-3 py-1 text-xs text-stone-600">{c}</span>
                  ))}
                </div>
                <a
                  href={VN_GOOGLE_MAPS_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group mt-4 flex items-start gap-2 text-xs leading-relaxed text-stone-500 transition hover:text-[#b8864a]"
                >
                  <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#b8864a]" />
                  <span>
                    <strong className="font-semibold text-stone-600 group-hover:text-[#b8864a]">{t.officeLabel}:</strong> {VN_ADDRESS}
                    <span className="mt-1 block font-medium text-[#b8864a] underline-offset-2 group-hover:underline">{t.viewOnMap} →</span>
                  </span>
                </a>
              </div>
            </div>
          </section>

          {/* Contact */}
          <section id="contact" className="scroll-mt-24">
            <div className="rounded-2xl bg-[#1c1917] px-6 py-10 text-center">
              <h2 className="text-2xl font-bold text-white">{t.contactTitle}</h2>
              <p className="mx-auto mt-3 max-w-2xl text-sm leading-relaxed text-white/75">{t.contactBody}</p>
              <div className="mt-6 flex items-center justify-center">
                <a
                  href={wa.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`${t.whatsappCta}: ${wa.label}`}
                  className="inline-flex items-center gap-2 rounded-xl bg-[#25D366] px-6 py-3 text-sm font-semibold text-white transition hover:bg-[#1ebe5b]"
                >
                  <WhatsAppIcon className="h-5 w-5" />
                  {wa.label}
                </a>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
