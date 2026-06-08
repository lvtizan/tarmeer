'use client';

import { useState, useEffect } from 'react';
import { trackContact, trackLead } from '../../lib/analytics';
import { validatePhone, isPhoneComplete } from '../../lib/phoneValidation';
import AdminSelect from '../ui/AdminSelect';
import { useSiteLocale } from '@/contexts/SiteLocaleContext';

const AE_HERO_IMAGES = [
  '/images/hero/hero-living-1.jpg',
  '/images/hero/hero-villa-1.jpg',
  '/images/hero/hero-living-2.jpg',
  '/images/hero/hero-kitchen-1.jpg',
];

const VN_HERO_IMAGES = [
  '/images/vn-companies/portfolio/vn-atz-luxury/03.jpg',
  '/images/vn-companies/portfolio/vn-atz-luxury/06.jpg',
  '/images/vn-companies/portfolio/vn-25-nm-thiet-ke-noi-that-chung-cu-biet-thu-nha-pho-vn-phong/05.jpg',
  '/images/vn-companies/portfolio/vn-cong-ty-cp-s/01.jpg',
  '/images/vn-companies/portfolio/vn-floorii/12.jpg',
];

const GCC_PHONE_OPTIONS = [
  { label: 'UAE', code: '+971', maxDigits: 9 },
  { label: 'KSA', code: '+966', maxDigits: 9 },
  { label: 'Qatar', code: '+974', maxDigits: 8 },
  { label: 'Kuwait', code: '+965', maxDigits: 8 },
  { label: 'Oman', code: '+968', maxDigits: 8 },
  { label: 'Bahrain', code: '+973', maxDigits: 8 },
];

const VN_PHONE_OPTIONS = [
  { label: 'VN', code: '+84', maxDigits: 9 },
  { label: 'Other', code: '+1', maxDigits: 10 },
];

const API_BASE = process.env.NEXT_PUBLIC_API_URL?.trim() || '/api';

export default function Banner() {
  const { tr, lang } = useSiteLocale();
  const PHONE_OPTIONS = lang === 'vi' ? VN_PHONE_OPTIONS : GCC_PHONE_OPTIONS;
  const heroImages = lang === 'vi' ? VN_HERO_IMAGES : AE_HERO_IMAGES;
  const [heroIndex, setHeroIndex] = useState(0);
  const [name, setName] = useState('');
  const [area, setArea] = useState('');
  const [phoneRegion, setPhoneRegion] = useState(PHONE_OPTIONS[0]);
  const [phone, setPhone] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    const timer = setInterval(() => {
      setHeroIndex((i) => (i + 1) % heroImages.length);
    }, 4500);
    return () => clearInterval(timer);
  }, [heroImages.length]);

  const phoneError = isPhoneComplete(phone, phoneRegion.code)
    ? validatePhone(phone, phoneRegion.code)
    : null;

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    const numericArea = Number(area);
    if (!area || !Number.isFinite(numericArea) || numericArea <= 0) {
      setError(tr.banner.areaError);
      return;
    }
    if (phone.length !== phoneRegion.maxDigits) {
      setError(tr.banner.phoneDigitError(phoneRegion.maxDigits, phoneRegion.label));
      return;
    }
    if (phoneError) {
      setError(phoneError);
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch(`${API_BASE}/inquiries`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim() || '',
          phone: `${phoneRegion.code}${phone}`,
          city: lang === 'vi' ? 'Hồ Chí Minh' : 'Dubai',
          area_range: `${numericArea}m²`,
          source_page: 'home-banner',
        }),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({})) as { error?: string };
        throw new Error(body.error || 'Failed to submit booking request.');
      }
      setSuccess(tr.banner.successMessage);
      trackContact({ content_name: 'Homepage Banner' });
      trackLead({ content_name: 'Homepage Banner' });
      setName('');
      setArea('');
      setPhone('');
    } catch (submitError: unknown) {
      setError(submitError instanceof Error ? submitError.message : 'Failed to submit booking request.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section className="relative min-h-[420px] overflow-hidden py-8 sm:min-h-[500px] sm:py-10">
      {heroImages.map((src, i) => (
        <div
          key={src}
          className="absolute inset-0 bg-cover bg-center bg-no-repeat transition-opacity duration-1000"
          style={{ backgroundImage: `url(${src})`, opacity: i === heroIndex ? 1 : 0 }}
        />
      ))}
      <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(0,0,0,0.55)_0%,rgba(0,0,0,0.45)_38%,rgba(0,0,0,0.35)_100%)]" />

      <div className="relative z-10 mx-auto grid max-w-6xl items-center gap-8 px-4 sm:px-6 lg:grid-cols-[340px_1fr] lg:gap-16">
        <form onSubmit={handleSubmit} className="rounded-[20px] border border-white/80 bg-white/94 shadow-[0_18px_44px_rgba(28,25,23,0.14)] backdrop-blur-sm">
          <div className="space-y-3.5 px-6 py-5">
            <h2 className="text-[22px] font-semibold tracking-tight text-[#1c1917]">{tr.banner.formTitle}</h2>

            <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder={tr.banner.namePlaceholder}
              className="w-full h-[48px] px-5 rounded-[20px] border border-stone-200 bg-stone-50/70 text-[15px] text-[#1c1917] placeholder:text-stone-300 outline-none focus:ring-2 focus:ring-[#B8864A]/15 focus:border-[#B8864A] focus:bg-white transition" />

            <div className="rounded-[20px] border border-stone-200 bg-stone-50/70 px-4 py-3.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.65)]">
              <label className="mb-1 block text-[11px] font-medium uppercase tracking-[0.14em] text-stone-500">{tr.banner.areaLabel}</label>
              <div className="flex items-center justify-between gap-4">
                <input type="text" inputMode="numeric" value={area}
                  onChange={(e) => setArea(e.target.value.replace(/\D/g, ''))}
                  className="w-full bg-transparent text-[1.65rem] font-semibold text-[#1c1917] outline-none placeholder:text-stone-300"
                  placeholder={tr.banner.areaPlaceholder} />
                <span className="shrink-0 text-2xl font-semibold text-stone-700">m²</span>
              </div>
            </div>

            <div className={`rounded-[20px] border ${phoneError ? 'border-red-300' : 'border-stone-200'} bg-stone-50/70 px-4 py-3.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.65)]`}>
              <label className="mb-1 block text-[11px] font-medium uppercase tracking-[0.14em] text-stone-500">{tr.banner.phoneLabel}</label>
              <div className="grid grid-cols-[112px_1fr] items-center gap-3">
                <AdminSelect
                  value={phoneRegion.code}
                  onChange={(val) => {
                    const next = PHONE_OPTIONS.find((o) => o.code === val) || PHONE_OPTIONS[0];
                    setPhoneRegion(next);
                    setPhone((cur) => cur.slice(0, next.maxDigits));
                  }}
                  options={PHONE_OPTIONS.map((o) => ({ value: o.code, label: `${o.label} ${o.code}` }))}
                  className="w-full"
                />
                <input type="tel" inputMode="numeric" value={phone}
                  onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, phoneRegion.maxDigits))}
                  maxLength={phoneRegion.maxDigits}
                  className="min-w-0 w-full bg-transparent text-base font-medium text-[#1c1917] outline-none placeholder:text-stone-300"
                  placeholder={`Enter ${phoneRegion.maxDigits}-digit number`} />
              </div>
              {phoneError && <p className="text-[12px] text-red-600 mt-1.5">{phoneError}</p>}
            </div>

            {error && <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[12px] leading-5 text-red-700">{error}</p>}
            {success && <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-[12px] leading-5 text-emerald-700">{success}</p>}

            <p className="text-left text-[11px] leading-5 text-stone-500">
              {tr.banner.formNote}
            </p>

            <button type="submit" disabled={isSubmitting}
              className="flex h-12 w-full items-center justify-center rounded-[20px] bg-[#B8864A] text-lg font-semibold text-white shadow-[0_16px_28px_rgba(184,134,74,0.24)] transition hover:bg-[#a4763f]">
              {isSubmitting ? tr.banner.submitting : tr.banner.submit}
            </button>
          </div>
        </form>

        <div className="max-w-2xl text-white lg:justify-self-end">
          <p className="mb-3 text-xs font-medium uppercase tracking-[0.32em] text-white/80">{tr.banner.tagline}</p>
          <h1 className="font-serif text-4xl font-semibold tracking-tight text-white sm:text-5xl md:text-[3.5rem]">
            {tr.banner.headline1}
            <br />{tr.banner.headline2}
            <br />{tr.banner.headline3}
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-white/88 sm:text-lg">
            {tr.banner.description}
          </p>
        </div>
      </div>
    </section>
  );
}
