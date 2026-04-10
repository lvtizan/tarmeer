import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { motion } from 'framer-motion';
import {
  ArrowLeft,
  Check,
  Search,
  Camera,
  FileText,
  Share2,
  LayoutDashboard,
  Users,
} from 'lucide-react';
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

  return (
    <div dir={lang === 'ar' ? 'rtl' : 'ltr'}>
      <Helmet>
        <title>Join Tarmeer — AI-Powered Platform for Renovation Companies in UAE</title>
        <meta
          name="description"
          content="Grow your renovation business with AI-driven leads, GEO+SEO optimization, smart photo tagging, and content generation. Join 100+ UAE companies on Tarmeer — free forever."
        />
        <meta
          property="og:title"
          content="Join Tarmeer — AI-Powered Platform for Renovation Companies"
        />
        <meta
          property="og:description"
          content="GEO+SEO engine, AI photo tagging, content generation — all free for renovation companies in UAE."
        />
        <meta property="og:image" content="https://www.tarmeer.com/images/tarmeer_logo.svg" />
        <meta property="og:url" content="https://www.tarmeer.com/for-companies" />
        <meta property="og:type" content="website" />
        <link rel="canonical" href="https://www.tarmeer.com/for-companies" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta
          name="twitter:title"
          content="Join Tarmeer — AI Platform for Renovation Companies in UAE"
        />
        <meta
          name="twitter:description"
          content="Grow your renovation business with AI-driven leads and GEO+SEO optimization."
        />
        <meta name="twitter:image" content="https://www.tarmeer.com/images/tarmeer_logo.svg" />
        <script type="application/ld+json">
          {JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'WebPage',
            name: 'Join Tarmeer — For Renovation Companies',
            description: 'AI-powered platform for renovation companies in UAE',
            url: 'https://www.tarmeer.com/for-companies',
            publisher: {
              '@type': 'Organization',
              name: 'Tarmeer',
              url: 'https://www.tarmeer.com',
              logo: 'https://www.tarmeer.com/images/tarmeer_logo.svg',
            },
          })}
        </script>
      </Helmet>

      {/* ── 1. Mini Header (sticky) ── */}
      <header className="sticky top-0 z-50 h-16 bg-white shadow-sm flex items-center px-4 sm:px-6">
        <div className="max-w-6xl mx-auto w-full flex items-center justify-between">
          <div className="flex items-center gap-6">
            <Link to="/">
              <img src="/images/tarmeer_logo.svg" alt="Tarmeer" className="h-8" />
            </Link>
            <Link
              to="/"
              className="hidden sm:flex items-center gap-1.5 text-sm text-[#6b6b6b] hover:text-[#2c2c2c] transition"
            >
              <ArrowLeft className="w-4 h-4" />
              {t(lang, 'backToTarmeer')}
            </Link>
          </div>
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

      {/* ── 2. Hero Section ── */}
      <section className="min-h-[600px] bg-gradient-to-br from-[#1c1917] via-[#2c2520] to-[#1c1917] relative overflow-hidden">
        <div className="absolute top-1/2 -translate-y-1/2 right-[-10%] w-[600px] h-[600px] rounded-full bg-white/5" />
        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 py-16 lg:py-24 grid lg:grid-cols-2 gap-12 items-center">
          <div>
            <p className="text-sm font-semibold text-[#b8864a] uppercase tracking-wider">
              {t(lang, 'tagline')}
            </p>
            <h1 className="font-serif text-4xl lg:text-5xl font-bold text-white leading-tight mt-4">
              {t(lang, 'headline')}
            </h1>
            <p className="text-lg text-white/70 mt-6 max-w-lg">{t(lang, 'subtitle')}</p>
          </div>
          <div className="order-2">
            <CompanySignupForm lang={lang} />
          </div>
        </div>
      </section>

      {/* ── 3. Stats Bar ── */}
      <section className="bg-white py-12">
        <div className="max-w-4xl mx-auto grid sm:grid-cols-3 gap-8 text-center px-4 sm:px-6">
          {[
            { value: '100+', label: 'statsCompanies' as const },
            { value: '5,000+', label: 'statsPhotos' as const },
            { value: '7', label: 'statsEmirates' as const },
          ].map((stat, i) => (
            <motion.div key={i} {...fadeUp} transition={{ duration: 0.5, delay: i * 0.1 }}>
              <div className="text-3xl lg:text-4xl font-bold text-[#b8864a]">{stat.value}</div>
              <div className="text-sm text-[#6b6b6b] mt-1">{t(lang, stat.label)}</div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ── 4. Feature Sections (alternating) ── */}
      {/* Feature 1: image left, text right */}
      <section className="bg-[#faf9f7] py-20 lg:py-28">
        <motion.div
          {...fadeUp}
          className="max-w-6xl mx-auto px-4 sm:px-6 grid lg:grid-cols-2 gap-12 lg:gap-20 items-center"
        >
          <div className="rounded-2xl bg-gradient-to-br from-stone-100 to-stone-200 aspect-[4/3] flex items-center justify-center">
            <Search className="w-16 h-16 text-stone-300" />
          </div>
          <div>
            <p className="text-sm font-semibold text-[#b8864a] uppercase tracking-wider">
              {t(lang, 'feature1Tag')}
            </p>
            <h2 className="font-serif text-3xl lg:text-4xl font-bold text-[#1c1917] mt-3">
              {t(lang, 'feature1Title')}
            </h2>
            <p className="text-[15px] text-[#6b6b6b] leading-relaxed mt-4">
              {t(lang, 'feature1Desc')}
            </p>
            <div className="mt-6 space-y-3">
              {(['feature1Check1', 'feature1Check2', 'feature1Check3'] as const).map((key) => (
                <div key={key} className="flex items-center gap-3">
                  <Check className="w-5 h-5 text-[#b8864a] flex-shrink-0" />
                  <span className="text-[15px] text-[#2c2c2c]">{t(lang, key)}</span>
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      </section>

      {/* Feature 2: text left, image right */}
      <section className="bg-white py-20 lg:py-28">
        <motion.div
          {...fadeUp}
          className="max-w-6xl mx-auto px-4 sm:px-6 grid lg:grid-cols-2 gap-12 lg:gap-20 items-center"
        >
          <div className="lg:order-first">
            <p className="text-sm font-semibold text-[#b8864a] uppercase tracking-wider">
              {t(lang, 'feature2Tag')}
            </p>
            <h2 className="font-serif text-3xl lg:text-4xl font-bold text-[#1c1917] mt-3">
              {t(lang, 'feature2Title')}
            </h2>
            <p className="text-[15px] text-[#6b6b6b] leading-relaxed mt-4">
              {t(lang, 'feature2Desc')}
            </p>
            <div className="mt-6 space-y-3">
              {(['feature2Check1', 'feature2Check2', 'feature2Check3'] as const).map((key) => (
                <div key={key} className="flex items-center gap-3">
                  <Check className="w-5 h-5 text-[#b8864a] flex-shrink-0" />
                  <span className="text-[15px] text-[#2c2c2c]">{t(lang, key)}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-2xl bg-gradient-to-br from-stone-100 to-stone-200 aspect-[4/3] flex items-center justify-center">
            <Camera className="w-16 h-16 text-stone-300" />
          </div>
        </motion.div>
      </section>

      {/* Feature 3: image left, text right */}
      <section className="bg-[#faf9f7] py-20 lg:py-28">
        <motion.div
          {...fadeUp}
          className="max-w-6xl mx-auto px-4 sm:px-6 grid lg:grid-cols-2 gap-12 lg:gap-20 items-center"
        >
          <div className="rounded-2xl bg-gradient-to-br from-stone-100 to-stone-200 aspect-[4/3] flex items-center justify-center">
            <FileText className="w-16 h-16 text-stone-300" />
          </div>
          <div>
            <p className="text-sm font-semibold text-[#b8864a] uppercase tracking-wider">
              {t(lang, 'feature3Tag')}
            </p>
            <h2 className="font-serif text-3xl lg:text-4xl font-bold text-[#1c1917] mt-3">
              {t(lang, 'feature3Title')}
            </h2>
            <p className="text-[15px] text-[#6b6b6b] leading-relaxed mt-4">
              {t(lang, 'feature3Desc')}
            </p>
            <div className="mt-6 space-y-3">
              {(['feature3Check1', 'feature3Check2', 'feature3Check3'] as const).map((key) => (
                <div key={key} className="flex items-center gap-3">
                  <Check className="w-5 h-5 text-[#b8864a] flex-shrink-0" />
                  <span className="text-[15px] text-[#2c2c2c]">{t(lang, key)}</span>
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      </section>

      {/* ── 5. Grid Section ── */}
      <section className="bg-[#faf9f7] py-20">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <h2 className="font-serif text-3xl lg:text-4xl font-bold text-[#1c1917] text-center mb-12">
            {t(lang, 'gridTitle')}
          </h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              { icon: Share2, title: 'grid1Title' as const, desc: 'grid1Desc' as const },
              {
                icon: LayoutDashboard,
                title: 'grid2Title' as const,
                desc: 'grid2Desc' as const,
              },
              { icon: Users, title: 'grid3Title' as const, desc: 'grid3Desc' as const },
            ].map((card, i) => (
              <motion.div
                key={i}
                {...fadeUp}
                transition={{ duration: 0.5, delay: i * 0.1 }}
                className="bg-white rounded-2xl border border-stone-200 shadow-sm p-8"
              >
                <div className="w-12 h-12 rounded-xl bg-[#b8864a]/10 flex items-center justify-center mb-4">
                  <card.icon className="w-6 h-6 text-[#b8864a]" />
                </div>
                <h3 className="text-lg font-semibold text-[#1c1917] mb-2">
                  {t(lang, card.title)}
                </h3>
                <p className="text-[15px] text-[#6b6b6b] leading-relaxed">
                  {t(lang, card.desc)}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── 6. CTA Banner ── */}
      <section className="bg-gradient-to-r from-[#b8864a] to-[#c6a065] py-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 text-center">
          <h2 className="font-serif text-3xl lg:text-4xl font-bold text-white mb-6">
            {t(lang, 'ctaTitle')}
          </h2>
          <button
            onClick={() =>
              document.getElementById('footer-form')?.scrollIntoView({ behavior: 'smooth' })
            }
            className="bg-white text-[#b8864a] font-semibold px-8 py-3.5 rounded-[20px] hover:bg-white/90 transition shadow-lg"
          >
            {t(lang, 'ctaButton')}
          </button>
        </div>
      </section>

      {/* ── 7. Footer Form Section ── */}
      <section
        id="footer-form"
        className="bg-gradient-to-br from-[#1c1917] via-[#2c2520] to-[#1c1917] py-20 lg:py-28"
      >
        <div className="max-w-6xl mx-auto px-4 sm:px-6 grid lg:grid-cols-2 gap-12 items-center">
          <div>
            <h2 className="font-serif text-3xl lg:text-4xl font-bold text-white">
              {t(lang, 'footerTitle')}
            </h2>
            <p className="text-lg text-white/60 mt-4">{t(lang, 'footerSubtitle')}</p>
            <div className="mt-8 space-y-4">
              {(['footerCheck1', 'footerCheck2', 'footerCheck3'] as const).map((key) => (
                <div key={key} className="flex items-center gap-3">
                  <Check className="w-5 h-5 text-[#b8864a] flex-shrink-0" />
                  <span className="text-[15px] text-white/80">{t(lang, key)}</span>
                </div>
              ))}
            </div>
          </div>
          <div>
            <CompanySignupForm lang={lang} />
          </div>
        </div>
      </section>

      {/* ── 8. Mini Footer ── */}
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
