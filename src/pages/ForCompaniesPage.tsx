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

/* Large icon in a styled circle for feature sections */
function FeatureIcon({ icon: Icon }: { icon: React.ComponentType<{ className?: string }> }) {
  return (
    <div className="flex items-center justify-center">
      <div className="w-32 h-32 lg:w-40 lg:h-40 rounded-full bg-[#b8864a]/8 flex items-center justify-center">
        <div className="w-20 h-20 lg:w-24 lg:h-24 rounded-full bg-[#b8864a]/12 flex items-center justify-center">
          <Icon className="w-10 h-10 lg:w-12 lg:h-12 text-[#b8864a]" />
        </div>
      </div>
    </div>
  );
}

export default function ForCompaniesPage() {
  const [lang, setLang] = useState<Lang>('en');

  return (
    <div dir={lang === 'ar' ? 'rtl' : 'ltr'}>
      <Helmet>
        <title>Join Tarmeer — AI-Powered Platform for Renovation Companies in UAE</title>
        <meta
          name="description"
          content="Grow your renovation business with AI-driven leads, GEO+SEO optimization, smart photo tagging, and content generation. Join 100+ UAE companies on Tarmeer ."
        />
        <meta
          property="og:title"
          content="Join Tarmeer — AI-Powered Platform for Renovation Companies"
        />
        <meta
          property="og:description"
          content="GEO+SEO engine, AI photo tagging, content generation for renovation companies in UAE."
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
      <section className="min-h-[600px] relative overflow-hidden">
        <div
          className="absolute inset-0 bg-cover bg-center bg-no-repeat"
          style={{ backgroundImage: 'url(https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=1920&q=85)' }}
        />
        <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(28,25,23,0.88)_0%,rgba(28,25,23,0.75)_50%,rgba(28,25,23,0.6)_100%)]" />
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

      {/* ── 3. Feature Sections (alternating) ── */}
      {/* Feature 1: GEO+SEO — illustration left, text right */}
      <section className="bg-[#faf9f7] py-20 lg:py-28">
        <motion.div
          {...fadeUp}
          className="max-w-6xl mx-auto px-4 sm:px-6 grid lg:grid-cols-2 gap-12 lg:gap-20 items-center"
        >
          <FeatureIcon icon={Search} />
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

      {/* Feature 2: AI Tagging — text left, illustration right */}
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
          <FeatureIcon icon={Camera} />
        </motion.div>
      </section>

      {/* Feature 3: AI Writer — illustration left, text right */}
      <section className="bg-[#faf9f7] py-20 lg:py-28">
        <motion.div
          {...fadeUp}
          className="max-w-6xl mx-auto px-4 sm:px-6 grid lg:grid-cols-2 gap-12 lg:gap-20 items-center"
        >
          <FeatureIcon icon={FileText} />
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

      {/* ── 4. Grid Section ── */}
      <section className="bg-white py-20">
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
                className="bg-[#faf9f7] rounded-2xl border border-stone-200 shadow-sm p-8"
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

      {/* ── 5. CTA Banner ── */}
      <section className="bg-gradient-to-r from-[#b8864a] to-[#c6a065] py-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 text-center">
          <h2 className="font-serif text-3xl lg:text-4xl font-bold text-white mb-6">
            {t(lang, 'ctaTitle')}
          </h2>
          <Link
            to="/auth"
            className="inline-block bg-white text-[#b8864a] font-semibold px-8 py-3.5 rounded-[20px] hover:bg-white/90 transition shadow-lg"
          >
            {t(lang, 'ctaButton')}
          </Link>
        </div>
      </section>

      {/* ── 6. Mini Footer ── */}
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
