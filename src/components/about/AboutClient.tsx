'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useSiteLocale } from '@/contexts/SiteLocaleContext';
import { COUNTRY } from '@/lib/country';
import { ADDRESS, VN_ADDRESS } from '@/lib/constants';
import { resolveImageUrl, resolveVariantUrl } from '@/lib/imageUrl';
import type { Supplier } from '@/components/materials/MaterialsClient';
import ProgressiveImage from '@/components/ui/ProgressiveImage';
import { MapPin, ArrowRight, Building2, Home, Layers } from 'lucide-react';

const API_BASE = process.env.NEXT_PUBLIC_API_URL?.trim() || '/api';
const PRIMARY = '#b8864a';

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
      <header className="relative overflow-hidden">
        <div className="absolute inset-0">
          <ProgressiveImage
            src={heroImg.src}
            srcSet={heroImg.srcSet}
            sizes="100vw"
            blur={heroImg.blur}
            alt=""
            loading="eager"
            fetchPriority="high"
            className="h-full w-full"
            imgClassName="object-top"
          />
        </div>
        <div className="absolute inset-0 bg-gradient-to-r from-[#1c1917]/85 via-[#1c1917]/60 to-[#1c1917]/20" />
        <div className="relative mx-auto flex min-h-[440px] max-w-6xl flex-col justify-center px-5 py-16 sm:min-h-[560px]">
          <p className="mb-3 text-sm font-semibold uppercase tracking-[0.2em] text-[#c6a065]">Tarmeer</p>
          <h1 className="max-w-2xl text-3xl font-bold leading-tight text-white sm:text-4xl">{t.pageTitle}</h1>
          <p className="mt-4 max-w-xl text-base leading-relaxed text-white/85">{t.heroTagline}</p>
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
              className="mt-6 aspect-video w-full rounded-2xl"
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
              className="mt-6 aspect-video w-full rounded-2xl"
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
                <p className="mt-4 flex items-start gap-2 text-xs leading-relaxed text-stone-500">
                  <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#b8864a]" />
                  <span><strong className="font-semibold text-stone-600">{t.officeLabel}:</strong> {ADDRESS}</span>
                </p>
              </div>
              <div className="rounded-2xl border border-stone-200 bg-white p-6">
                <h3 className="text-lg font-semibold text-[#2c2c2c]">{t.coverageVnTitle}</h3>
                <div className="mt-3 flex flex-wrap gap-2">
                  {COUNTRY.vn.cities.map(c => (
                    <span key={c} className="rounded-full bg-stone-100 px-3 py-1 text-xs text-stone-600">{c}</span>
                  ))}
                </div>
                <p className="mt-4 flex items-start gap-2 text-xs leading-relaxed text-stone-500">
                  <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#b8864a]" />
                  <span><strong className="font-semibold text-stone-600">{t.officeLabel}:</strong> {VN_ADDRESS}</span>
                </p>
              </div>
            </div>
          </section>

          {/* Contact */}
          <section id="contact" className="scroll-mt-24">
            <div className="rounded-2xl bg-[#1c1917] px-6 py-10 text-center">
              <h2 className="text-2xl font-bold text-white">{t.contactTitle}</h2>
              <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-white/75">{t.contactBody}</p>
              <Link
                href="/contact"
                className="mt-6 inline-flex items-center gap-2 rounded-xl px-6 py-3 text-sm font-semibold text-white transition hover:opacity-90"
                style={{ backgroundColor: PRIMARY }}
              >
                {t.contactBtn}
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
