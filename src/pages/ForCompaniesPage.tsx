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

/* Compact icon badge for feature sections */
function FeatureIcon({ icon: Icon }: { icon: React.ComponentType<{ className?: string }> }) {
  return (
    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#b8864a]/10">
      <Icon className="w-6 h-6 text-[#b8864a]" />
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

      {/* ── 3. Feature Sections — compact card grid ── */}
      <section className="bg-[#faf9f7] py-12 lg:py-16">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 lg:gap-6">
            {([
              { icon: Search, tag: 'feature1Tag', title: 'feature1Title', desc: 'feature1Desc', checks: ['feature1Check1', 'feature1Check2', 'feature1Check3'] },
              { icon: Camera, tag: 'feature2Tag', title: 'feature2Title', desc: 'feature2Desc', checks: ['feature2Check1', 'feature2Check2', 'feature2Check3'] },
              { icon: FileText, tag: 'feature3Tag', title: 'feature3Title', desc: 'feature3Desc', checks: ['feature3Check1', 'feature3Check2', 'feature3Check3'] },
            ] as const).map((feat) => (
              <motion.div
                key={feat.tag}
                {...fadeUp}
                className="bg-white rounded-2xl border border-stone-200 p-5 sm:p-6"
              >
                <div className="flex items-center gap-3 mb-3">
                  <FeatureIcon icon={feat.icon} />
                  <p className="text-[11px] font-semibold text-[#b8864a] uppercase tracking-wider">
                    {t(lang, feat.tag)}
                  </p>
                </div>
                <h3 className="font-serif text-xl font-bold text-[#1c1917]">
                  {t(lang, feat.title)}
                </h3>
                <p className="text-[14px] text-[#6b6b6b] leading-relaxed mt-2">
                  {t(lang, feat.desc)}
                </p>
                <div className="mt-4 space-y-2">
                  {feat.checks.map((key) => (
                    <div key={key} className="flex items-center gap-2">
                      <Check className="w-4 h-4 text-[#b8864a] flex-shrink-0" />
                      <span className="text-[14px] text-[#2c2c2c]">{t(lang, key)}</span>
                    </div>
                  ))}
                </div>
              </motion.div>
            ))}
          </div>
        </div>
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
                className="bg-[#faf9f7] rounded-2xl border border-stone-200 shadow-sm p-5 sm:p-6"
              >
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 shrink-0 rounded-xl bg-[#b8864a]/10 flex items-center justify-center mt-0.5">
                    <card.icon className="w-5 h-5 text-[#b8864a]" />
                  </div>
                  <div>
                    <h3 className="text-[15px] font-semibold text-[#1c1917]">
                      {t(lang, card.title)}
                    </h3>
                    <p className="text-[14px] text-[#6b6b6b] leading-relaxed mt-1">
                      {t(lang, card.desc)}
                    </p>
                  </div>
                </div>
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
