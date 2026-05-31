'use client';

import { useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import AdminSelect from '@/components/ui/AdminSelect';
import { validatePhone, isPhoneComplete } from '@/lib/phoneValidation';
import { DollarSign, Image, UserCheck, CheckCircle } from 'lucide-react';
import { t, type Lang } from '@/i18n/forHomeowners';

const fadeUp = {
  initial: { opacity: 0, y: 20 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true },
  transition: { duration: 0.5 },
};

const CITIES = [
  { value: '', label: '' },
  { value: 'Dubai', label: 'Dubai' },
  { value: 'Abu Dhabi', label: 'Abu Dhabi' },
  { value: 'Sharjah', label: 'Sharjah' },
  { value: 'Ajman', label: 'Ajman' },
  { value: 'Ras Al Khaimah', label: 'Ras Al Khaimah' },
  { value: 'Other', label: 'Other' },
];

const pageJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'WebPage',
  name: 'Find Renovation Companies in UAE | Tarmeer',
  description: 'Compare verified renovation companies in UAE. Browse real portfolios and get free quotes.',
  url: 'https://www.tarmeer.com/for-homeowners',
  publisher: {
    '@type': 'Organization',
    name: 'Tarmeer',
    url: 'https://www.tarmeer.com',
    logo: 'https://www.tarmeer.com/images/tarmeer_logo.svg',
  },
};

export default function ForHomeownersClient() {
  const [lang, setLang] = useState<Lang>('en');
  const [area, setArea] = useState('');
  const [city, setCity] = useState('');
  const [phone, setPhone] = useState('');
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handlePhoneChange = (val: string) => {
    const digits = val.replace(/\D/g, '');
    setPhone(digits);
    if (isPhoneComplete(digits, '+971')) {
      setPhoneError(validatePhone(digits, '+971'));
    } else {
      setPhoneError(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!area || !city || !phone) return;
    const err = validatePhone(phone, '+971');
    if (err) { setPhoneError(err); return; }
    setSubmitting(true);
    try {
      const res = await fetch('/api/inquiries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Website Visitor',
          phone: `+971${phone}`,
          city,
          area_range: `${area}m²`,
          message: 'From homeowner landing page',
        }),
      });
      if (res.ok) setSubmitted(true);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div dir={lang === 'ar' ? 'rtl' : 'ltr'}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(pageJsonLd) }} />

      {/* Language toggle strip */}
      <div className="bg-white border-b border-stone-100 py-2 px-4">
        <div className="max-w-6xl mx-auto flex justify-end">
          <div className="flex items-center gap-1 rounded-lg border border-stone-200 p-0.5">
            <button
              onClick={() => setLang('en')}
              className={`px-3 py-1 text-sm font-medium rounded-md transition ${lang === 'en' ? 'bg-[#b8864a] text-white' : 'text-[#6b6b6b] hover:text-[#2c2c2c]'}`}
            >
              EN
            </button>
            <button
              onClick={() => setLang('ar')}
              className={`px-3 py-1 text-sm font-medium rounded-md transition ${lang === 'ar' ? 'bg-[#b8864a] text-white' : 'text-[#6b6b6b] hover:text-[#2c2c2c]'}`}
            >
              AR
            </button>
          </div>
        </div>
      </div>

      {/* Hero Section */}
      <section className="min-h-[600px] relative overflow-hidden">
        <div className="absolute inset-0 bg-cover bg-center bg-no-repeat" style={{ backgroundImage: 'url(/images/hero/pricing-bg.webp)' }} />
        <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(28,25,23,0.88)_0%,rgba(28,25,23,0.75)_50%,rgba(28,25,23,0.6)_100%)]" />
        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 py-16 lg:py-24 grid lg:grid-cols-2 gap-12 items-center">
          <div>
            <p className="text-sm font-semibold text-[#b8864a] uppercase tracking-wider">{t(lang, 'tagline')}</p>
            <h1 className="font-serif text-4xl lg:text-5xl font-bold text-white leading-tight mt-4">{t(lang, 'headline')}</h1>
            <p className="text-lg text-white/70 mt-6 max-w-lg">{t(lang, 'subtitle')}</p>
          </div>

          <div className="order-2">
            <div className="bg-white rounded-2xl shadow-xl p-6 sm:p-8">
              {submitted ? (
                <div className="text-center py-8">
                  <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-4" />
                  <h3 className="text-xl font-bold text-[#2c2c2c]">{t(lang, 'successTitle')}</h3>
                  <p className="text-[15px] text-[#6b6b6b] mt-2">{t(lang, 'successMessage')}</p>
                  <Link href="/companies" className="inline-block mt-6 px-6 py-3 bg-[#b8864a] text-white font-semibold rounded-2xl hover:bg-[#a37840] transition">
                    {t(lang, 'successBrowse')}
                  </Link>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-4">
                  <h2 className="text-xl font-bold text-[#2c2c2c] mb-2">{t(lang, 'formTitle')}</h2>
                  <div>
                    <label className="text-sm font-medium text-stone-500 block mb-1">{t(lang, 'area')}</label>
                    <input
                      type="number"
                      min="1"
                      value={area}
                      onChange={(e) => setArea(e.target.value)}
                      placeholder={t(lang, 'areaPlaceholder')}
                      required
                      className="w-full h-[50px] px-5 rounded-2xl border border-stone-200 bg-stone-50/80 text-[15px] text-[#1c1917] placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-[#B8864A]/15 focus:border-[#B8864A] focus:bg-white"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-stone-500 block mb-1">{t(lang, 'city')}</label>
                    <AdminSelect
                      value={city}
                      onChange={setCity}
                      options={CITIES.map((c) => c.value === '' ? { value: '', label: t(lang, 'cityPlaceholder') } : c)}
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-stone-500 block mb-1">{t(lang, 'phone')}</label>
                    <div className="flex items-center gap-2">
                      <span className="flex items-center justify-center h-[50px] px-4 rounded-2xl border border-stone-200 bg-stone-50/80 text-[15px] text-[#6b6b6b] select-none">+971</span>
                      <input
                        type="tel"
                        inputMode="numeric"
                        value={phone}
                        onChange={(e) => handlePhoneChange(e.target.value)}
                        placeholder={t(lang, 'phonePlaceholder')}
                        required
                        maxLength={9}
                        className={`flex-1 h-[50px] px-5 rounded-2xl border bg-stone-50/80 text-[15px] text-[#1c1917] placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-[#B8864A]/15 focus:border-[#B8864A] focus:bg-white ${phoneError ? 'border-red-400' : 'border-stone-200'}`}
                      />
                    </div>
                    {phoneError && <p className="text-xs text-red-500 mt-1">{phoneError}</p>}
                  </div>
                  <button
                    type="submit"
                    disabled={submitting || !area || !city || !phone}
                    className="w-full h-[50px] rounded-2xl bg-[#b8864a] text-white font-semibold text-[15px] hover:bg-[#a37840] transition disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {submitting ? t(lang, 'submitting') : t(lang, 'submit')}
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Pain Points */}
      <section className="bg-white py-14 lg:py-20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <motion.h2 {...fadeUp} className="font-serif text-3xl lg:text-4xl font-bold text-[#1c1917] text-center mb-12">
            {t(lang, 'painTitle')}
          </motion.h2>
          <div className="grid sm:grid-cols-3 gap-5 lg:gap-6">
            {([
              { icon: DollarSign, title: 'pain1Title' as const, desc: 'pain1Desc' as const },
              { icon: Image, title: 'pain2Title' as const, desc: 'pain2Desc' as const },
              { icon: UserCheck, title: 'pain3Title' as const, desc: 'pain3Desc' as const },
            ]).map((card, i) => (
              <motion.div key={i} {...fadeUp} transition={{ duration: 0.5, delay: i * 0.1 }} className="rounded-2xl bg-white border border-stone-200 shadow-sm p-6">
                <div className="w-11 h-11 rounded-xl bg-[#b8864a]/10 flex items-center justify-center mb-4">
                  <card.icon className="w-5 h-5 text-[#b8864a]" />
                </div>
                <h3 className="text-[16px] font-semibold text-[#1c1917] mb-2">{t(lang, card.title)}</h3>
                <p className="text-[15px] text-[#6b6b6b] leading-relaxed">{t(lang, card.desc)}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="bg-[#f5f0e8] py-14 lg:py-20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <motion.h2 {...fadeUp} className="font-serif text-3xl lg:text-4xl font-bold text-[#1c1917] text-center mb-12">
            {t(lang, 'howTitle')}
          </motion.h2>
          <div className="grid sm:grid-cols-3 gap-8">
            {([
              { num: 1, title: 'step1Title' as const, desc: 'step1Desc' as const },
              { num: 2, title: 'step2Title' as const, desc: 'step2Desc' as const },
              { num: 3, title: 'step3Title' as const, desc: 'step3Desc' as const },
            ]).map((step, i) => (
              <motion.div key={i} {...fadeUp} transition={{ duration: 0.5, delay: i * 0.1 }} className="text-center">
                <div className="w-14 h-14 rounded-full bg-[#b8864a] text-white text-xl font-bold flex items-center justify-center mx-auto mb-4">{step.num}</div>
                <h3 className="text-[16px] font-semibold text-[#1c1917] mb-2">{t(lang, step.title)}</h3>
                <p className="text-[15px] text-[#6b6b6b] leading-relaxed max-w-xs mx-auto">{t(lang, step.desc)}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Trust Stats */}
      <section className="bg-[#1c1917] py-14 lg:py-20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <motion.h2 {...fadeUp} className="font-serif text-2xl lg:text-3xl font-bold text-white text-center mb-10">
            {t(lang, 'trustTitle')}
          </motion.h2>
          <div className="grid grid-cols-3 gap-6 text-center">
            {([
              { num: '100+', label: 'trustCompanies' as const },
              { num: '5,000+', label: 'trustProjects' as const },
              { num: '7', label: 'trustCities' as const },
            ]).map((stat, i) => (
              <motion.div key={i} {...fadeUp} transition={{ duration: 0.5, delay: i * 0.1 }}>
                <p className="text-3xl lg:text-4xl font-bold text-[#b8864a]">{stat.num}</p>
                <p className="text-sm text-white/60 mt-1">{t(lang, stat.label)}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <footer className="bg-[#1c1917] py-6 border-t border-white/10">
        <div className="flex gap-6 items-center justify-center">
          <span className="text-sm text-white/40">&copy; 2026 Tarmeer</span>
          <Link href="/privacy" className="text-sm text-white/40 hover:text-white/60 transition">{t(lang, 'privacy')}</Link>
          <Link href="/contact" className="text-sm text-white/40 hover:text-white/60 transition">{t(lang, 'contactUs')}</Link>
        </div>
      </footer>
    </div>
  );
}
