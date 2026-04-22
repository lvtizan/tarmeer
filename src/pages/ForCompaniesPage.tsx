import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { motion } from 'framer-motion';
import TarmeerLogo from '../components/TarmeerLogo';
import { ClipboardEdit, Camera, Phone } from 'lucide-react';
import { t, type Lang } from '../i18n/forCompanies';
import CompanySignupForm from '../components/for-companies/CompanySignupForm';

const fadeUp = {
  initial: { opacity: 0, y: 20 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true },
  transition: { duration: 0.5 },
};

export default function ForCompaniesPage() {
  const [lang, setLang] = useState<Lang>('en');

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div dir={lang === 'ar' ? 'rtl' : 'ltr'}>
      <Helmet>
        <title>Join Tarmeer — Free Platform for Renovation Companies in UAE</title>
        <meta
          name="description"
          content="Register free. Upload your work. Homeowners contact you directly on WhatsApp. Join 100+ UAE renovation companies on Tarmeer."
        />
        <meta
          property="og:title"
          content="Join Tarmeer — Get Customer Calls For Your Company"
        />
        <meta
          property="og:description"
          content="Free platform for renovation companies in UAE. Homeowners contact you directly on WhatsApp."
        />
        <meta property="og:image" content="https://www.tarmeer.com/images/tarmeer_logo.svg" />
        <meta property="og:url" content="https://www.tarmeer.com/for-companies" />
        <meta property="og:type" content="website" />
        <link rel="canonical" href="https://www.tarmeer.com/for-companies" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta
          name="twitter:title"
          content="Join Tarmeer — Free Platform for Renovation Companies in UAE"
        />
        <meta
          name="twitter:description"
          content="Register free. Upload your work. Homeowners contact you directly on WhatsApp."
        />
        <meta name="twitter:image" content="https://www.tarmeer.com/images/tarmeer_logo.svg" />
        <script type="application/ld+json">
          {JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'WebPage',
            name: 'Join Tarmeer — For Renovation Companies',
            description: 'Free platform for renovation companies in UAE',
            url: 'https://www.tarmeer.com/for-companies',
            publisher: {
              '@type': 'Organization',
              name: 'Tarmeer',
              url: 'https://www.tarmeer.com',
              logo: 'https://www.tarmeer.com/images/tarmeer_logo.svg',
            },
          })}
        </script>
        {/* Preload hero image -- desktop only, mobile uses solid bg */}
        <link rel="preload" as="image" fetchPriority="high" href="/images/hero/hero-renovation-lg.webp" media="(min-width: 769px)" />
      </Helmet>

      {/* -- 1. Mini Header (sticky) -- */}
      <header className="sticky top-0 z-50 h-16 bg-white shadow-sm flex items-center px-4 sm:px-6">
        <div className="max-w-6xl mx-auto w-full flex items-center justify-between">
          <TarmeerLogo />
          <div className="flex items-center gap-1 rounded-lg border border-stone-200 p-0.5">
            <button
              onClick={() => setLang('en')}
              className={`px-3 py-1 text-sm font-medium rounded-md transition ${
                lang === 'en'
                  ? 'bg-[#b8864a] text-white'
                  : 'text-[#6b6b6b] hover:text-[#2c2c2c]'
              }`}
            >
              EN
            </button>
            <button
              onClick={() => setLang('ar')}
              className={`px-3 py-1 text-sm font-medium rounded-md transition ${
                lang === 'ar'
                  ? 'bg-[#b8864a] text-white'
                  : 'text-[#6b6b6b] hover:text-[#2c2c2c]'
              }`}
            >
              AR
            </button>
          </div>
        </div>
      </header>

      {/* -- Section 1: Hero + Form -- */}
      <section className="min-h-[600px] relative overflow-hidden bg-[#1c1917]">
        {/* Desktop only: blur placeholder + real hero image */}
        <div
          className="absolute inset-0 bg-cover bg-center bg-no-repeat hidden md:block"
          style={{ backgroundImage: 'url(/images/hero/hero-renovation-blur.webp)', filter: 'blur(20px)', transform: 'scale(1.1)' }}
        />
        <picture className="absolute inset-0 hidden md:block">
          <source media="(max-width: 1024px)" srcSet="/images/hero/hero-renovation-md.webp" />
          <source media="(max-width: 1600px)" srcSet="/images/hero/hero-renovation-lg.webp" />
          <img
            src="/images/hero/hero-renovation-xl.webp"
            alt=""
            className="absolute inset-0 w-full h-full object-cover"
            loading="eager"
            fetchPriority="high"
          />
        </picture>
        <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(28,25,23,0.88)_0%,rgba(28,25,23,0.75)_50%,rgba(28,25,23,0.6)_100%)] hidden md:block" />

        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 py-12 lg:py-24 grid lg:grid-cols-2 gap-10 lg:gap-12 items-center">
          {/* Text -- below form on mobile, left on desktop */}
          <div className="order-2 lg:order-1">
            <p className="text-sm font-semibold text-[#b8864a] uppercase tracking-wider">
              {t(lang, 'tagline')}
            </p>
            <h1 className="font-serif text-3xl sm:text-4xl lg:text-5xl font-bold text-white leading-tight mt-4">
              {t(lang, 'headline')}
            </h1>
            <p className="text-[15px] sm:text-lg text-white/70 mt-4 max-w-lg">
              {t(lang, 'subtitle')}
            </p>

            {/* Arabic mirror text */}
            <div className="mt-6 border-t border-white/10 pt-5">
              <p className="text-sm font-semibold text-[#b8864a] uppercase tracking-wider" dir="rtl">
                {lang === 'en'
                  ? '\u0645\u062c\u0627\u0646\u064a \u0644\u062c\u0645\u064a\u0639 \u0627\u0644\u0634\u0631\u0643\u0627\u062a'
                  : 'FREE FOR ALL COMPANIES'}
              </p>
              <p
                className="font-serif text-xl sm:text-2xl font-bold text-white/90 mt-2"
                dir={lang === 'en' ? 'rtl' : 'ltr'}
              >
                {lang === 'en'
                  ? '\u0627\u062d\u0635\u0644 \u0639\u0644\u0649 \u0627\u062a\u0635\u0627\u0644\u0627\u062a \u0639\u0645\u0644\u0627\u0621 \u0644\u0634\u0631\u0643\u062a\u0643'
                  : 'Get Customer Calls For Your Company'}
              </p>
              <p
                className="text-sm text-white/50 mt-1.5 max-w-lg"
                dir={lang === 'en' ? 'rtl' : 'ltr'}
              >
                {lang === 'en'
                  ? '\u0633\u062c\u0651\u0644 \u0645\u062c\u0627\u0646\u0627\u064b. \u0627\u0631\u0641\u0639 \u0623\u0639\u0645\u0627\u0644\u0643. \u0623\u0635\u062d\u0627\u0628 \u0627\u0644\u0645\u0646\u0627\u0632\u0644 \u064a\u062a\u0648\u0627\u0635\u0644\u0648\u0646 \u0645\u0639\u0643 \u0645\u0628\u0627\u0634\u0631\u0629 \u0639\u0628\u0631 \u0648\u0627\u062a\u0633\u0627\u0628.'
                  : 'Register free. Upload your work. Homeowners contact you directly on WhatsApp.'}
              </p>
            </div>
          </div>

          {/* Form -- first on mobile, right on desktop */}
          <div className="order-1 lg:order-2">
            <CompanySignupForm lang={lang} />
          </div>
        </div>
      </section>

      {/* -- Section 2: How It Works -- */}
      <section className="bg-white py-14 lg:py-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6">
          <motion.h2
            {...fadeUp}
            className="font-serif text-2xl sm:text-3xl font-bold text-[#1c1917] text-center mb-12"
          >
            {t(lang, 'howItWorksTitle')}
          </motion.h2>

          <div className="grid sm:grid-cols-3 gap-8 sm:gap-6">
            {([
              { icon: ClipboardEdit, step: 1, title: 'step1Title' as const, desc: 'step1Desc' as const },
              { icon: Camera, step: 2, title: 'step2Title' as const, desc: 'step2Desc' as const },
              { icon: Phone, step: 3, title: 'step3Title' as const, desc: 'step3Desc' as const },
            ]).map((item, i) => (
              <motion.div
                key={item.step}
                {...fadeUp}
                transition={{ duration: 0.5, delay: i * 0.1 }}
                className="flex flex-col items-center text-center"
              >
                <div className="w-12 h-12 rounded-full bg-[#b8864a]/10 flex items-center justify-center mb-4">
                  <item.icon className="w-6 h-6 text-[#b8864a]" />
                </div>
                <p className="text-xs font-medium text-stone-400 uppercase tracking-wider mb-1">
                  {lang === 'ar' ? `\u0627\u0644\u062e\u0637\u0648\u0629 ${item.step}` : `Step ${item.step}`}
                </p>
                <h3 className="text-[15px] font-bold text-[#1c1917]">
                  {t(lang, item.title)}
                </h3>
                <p className="text-sm text-[#6b6b6b] mt-1">
                  {t(lang, item.desc)}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* -- Section 3: Social Proof + Bottom CTA -- */}
      <section className="bg-[#1c1917] py-14 lg:py-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6">
          {/* Stats row */}
          <div className="grid grid-cols-3 gap-4 text-center mb-10">
            {([
              { num: 'statsCompaniesNum' as const, label: 'statsCompanies' as const },
              { num: 'statsPhotosNum' as const, label: 'statsPhotos' as const },
              { num: 'statsFreeLabel' as const, label: 'statsFree' as const },
            ]).map((stat) => (
              <div key={stat.num}>
                <p className="text-2xl sm:text-3xl font-bold text-white">
                  {t(lang, stat.num)}
                </p>
                <p className="text-sm text-white/50 mt-1">
                  {t(lang, stat.label)}
                </p>
              </div>
            ))}
          </div>

          {/* Bottom CTA */}
          <div className="flex justify-center">
            <button
              onClick={scrollToTop}
              className="h-12 px-10 rounded-[20px] bg-[#B8864A] text-[15px] font-semibold text-white shadow-[0_16px_28px_rgba(184,134,74,0.22)] transition hover:bg-[#a67c47]"
            >
              {t(lang, 'bottomCta')} ↑
            </button>
          </div>
        </div>
      </section>

      {/* -- Mini Footer -- */}
      <footer className="bg-[#1c1917] py-6 border-t border-white/10">
        <div className="flex gap-6 items-center justify-center">
          <span className="text-sm text-white/40">&copy; 2026 Tarmeer</span>
          <Link to="/privacy" className="text-sm text-white/40 hover:text-white/60 transition">
            {t(lang, 'privacy')}
          </Link>
          <Link to="/contact" className="text-sm text-white/40 hover:text-white/60 transition">
            {t(lang, 'contactUs')}
          </Link>
        </div>
      </footer>
    </div>
  );
}
