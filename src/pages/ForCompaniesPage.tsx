import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { motion } from 'framer-motion';
import {
  ArrowLeft,
  Check,
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

/* Minimal SVG illustrations for the 3 feature sections */
function GeoSeoIllustration() {
  return (
    <svg viewBox="0 0 400 300" fill="none" className="w-full h-auto">
      <rect width="400" height="300" rx="20" fill="#FAF9F7" />
      {/* Browser window */}
      <rect x="60" y="50" width="280" height="180" rx="12" fill="white" stroke="#E7E5E4" strokeWidth="1.5" />
      <rect x="60" y="50" width="280" height="30" rx="12" fill="#F5F5F4" />
      <circle cx="78" cy="65" r="4" fill="#FCA5A5" />
      <circle cx="92" cy="65" r="4" fill="#FDE68A" />
      <circle cx="106" cy="65" r="4" fill="#86EFAC" />
      {/* Search bar */}
      <rect x="130" y="58" width="180" height="14" rx="7" fill="white" stroke="#D6D3D1" strokeWidth="1" />
      {/* Content lines */}
      <rect x="80" y="100" width="160" height="8" rx="4" fill="#B8864A" opacity="0.2" />
      <rect x="80" y="118" width="240" height="6" rx="3" fill="#E7E5E4" />
      <rect x="80" y="132" width="200" height="6" rx="3" fill="#E7E5E4" />
      {/* Chart bars */}
      <rect x="80" y="190" width="30" height="20" rx="4" fill="#B8864A" opacity="0.3" />
      <rect x="120" y="175" width="30" height="35" rx="4" fill="#B8864A" opacity="0.5" />
      <rect x="160" y="160" width="30" height="50" rx="4" fill="#B8864A" opacity="0.7" />
      <rect x="200" y="145" width="30" height="65" rx="4" fill="#B8864A" />
      {/* Upward arrow */}
      <path d="M245 195 L275 155" stroke="#B8864A" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M268 155 L275 155 L275 162" stroke="#B8864A" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      {/* AI sparkle */}
      <circle cx="310" cy="120" r="18" fill="#B8864A" opacity="0.1" />
      <path d="M310 108 L312 116 L320 118 L312 120 L310 128 L308 120 L300 118 L308 116Z" fill="#B8864A" opacity="0.6" />
    </svg>
  );
}

function AiTaggingIllustration() {
  return (
    <svg viewBox="0 0 400 300" fill="none" className="w-full h-auto">
      <rect width="400" height="300" rx="20" fill="#FAF9F7" />
      {/* Photo frame */}
      <rect x="70" y="45" width="180" height="140" rx="12" fill="white" stroke="#E7E5E4" strokeWidth="1.5" />
      {/* Mountain/house scene placeholder */}
      <rect x="80" y="55" width="160" height="100" rx="8" fill="#F5F5F4" />
      <path d="M80 135 L130 95 L170 120 L200 85 L240 135Z" fill="#D6D3D1" />
      <circle cx="210" cy="80" r="12" fill="#FDE68A" opacity="0.6" />
      {/* Tags floating */}
      <rect x="260" y="60" width="90" height="28" rx="14" fill="#B8864A" opacity="0.15" />
      <text x="280" y="79" fontSize="11" fill="#B8864A" fontFamily="system-ui" fontWeight="500">Modern</text>
      <rect x="270" y="100" width="80" height="28" rx="14" fill="#B8864A" opacity="0.15" />
      <text x="286" y="119" fontSize="11" fill="#B8864A" fontFamily="system-ui" fontWeight="500">Villa</text>
      <rect x="255" y="140" width="100" height="28" rx="14" fill="#B8864A" opacity="0.15" />
      <text x="270" y="159" fontSize="11" fill="#B8864A" fontFamily="system-ui" fontWeight="500">Marble</text>
      <rect x="265" y="180" width="85" height="28" rx="14" fill="#B8864A" opacity="0.15" />
      <text x="276" y="199" fontSize="11" fill="#B8864A" fontFamily="system-ui" fontWeight="500">Kitchen</text>
      {/* Connecting lines */}
      <line x1="250" y1="80" x2="260" y2="74" stroke="#B8864A" strokeWidth="1" opacity="0.3" />
      <line x1="250" y1="110" x2="270" y2="114" stroke="#B8864A" strokeWidth="1" opacity="0.3" />
      <line x1="250" y1="130" x2="255" y2="154" stroke="#B8864A" strokeWidth="1" opacity="0.3" />
      {/* AI sparkle */}
      <circle cx="160" cy="220" r="22" fill="#B8864A" opacity="0.08" />
      <path d="M160 206 L163 215 L172 218 L163 221 L160 230 L157 221 L148 218 L157 215Z" fill="#B8864A" opacity="0.5" />
      {/* Arrow from photo to tags */}
      <path d="M240 110 L252 110" stroke="#B8864A" strokeWidth="2" strokeLinecap="round" markerEnd="url(#arrow)" opacity="0.4" />
    </svg>
  );
}

function AiWriterIllustration() {
  return (
    <svg viewBox="0 0 400 300" fill="none" className="w-full h-auto">
      <rect width="400" height="300" rx="20" fill="#FAF9F7" />
      {/* Document */}
      <rect x="90" y="40" width="220" height="220" rx="12" fill="white" stroke="#E7E5E4" strokeWidth="1.5" />
      {/* Title line */}
      <rect x="115" y="65" width="150" height="10" rx="5" fill="#B8864A" opacity="0.25" />
      {/* Paragraph lines */}
      <rect x="115" y="90" width="170" height="6" rx="3" fill="#E7E5E4" />
      <rect x="115" y="104" width="155" height="6" rx="3" fill="#E7E5E4" />
      <rect x="115" y="118" width="170" height="6" rx="3" fill="#E7E5E4" />
      <rect x="115" y="132" width="130" height="6" rx="3" fill="#E7E5E4" />
      {/* Second paragraph */}
      <rect x="115" y="156" width="170" height="6" rx="3" fill="#E7E5E4" />
      <rect x="115" y="170" width="145" height="6" rx="3" fill="#E7E5E4" />
      <rect x="115" y="184" width="170" height="6" rx="3" fill="#E7E5E4" />
      {/* SEO score badge */}
      <rect x="115" y="210" width="80" height="28" rx="14" fill="#86EFAC" opacity="0.3" />
      <text x="130" y="229" fontSize="11" fill="#16A34A" fontFamily="system-ui" fontWeight="600">SEO: 95</text>
      {/* Cursor blinking effect */}
      <rect x="245" y="184" width="2" height="14" rx="1" fill="#B8864A" opacity="0.6" />
      {/* AI sparkle top right */}
      <circle cx="290" cy="55" r="20" fill="#B8864A" opacity="0.08" />
      <path d="M290 43 L292.5 51 L300 53.5 L292.5 56 L290 64 L287.5 56 L280 53.5 L287.5 51Z" fill="#B8864A" opacity="0.5" />
      {/* Publish button */}
      <rect x="210" y="210" width="75" height="28" rx="14" fill="#B8864A" opacity="0.15" />
      <text x="222" y="229" fontSize="11" fill="#B8864A" fontFamily="system-ui" fontWeight="500">Publish</text>
    </svg>
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

      {/* ── 3. Feature Sections (alternating) ── */}
      {/* Feature 1: GEO+SEO — illustration left, text right */}
      <section className="bg-[#faf9f7] py-20 lg:py-28">
        <motion.div
          {...fadeUp}
          className="max-w-6xl mx-auto px-4 sm:px-6 grid lg:grid-cols-2 gap-12 lg:gap-20 items-center"
        >
          <div>
            <GeoSeoIllustration />
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
          <div>
            <AiTaggingIllustration />
          </div>
        </motion.div>
      </section>

      {/* Feature 3: AI Writer — illustration left, text right */}
      <section className="bg-[#faf9f7] py-20 lg:py-28">
        <motion.div
          {...fadeUp}
          className="max-w-6xl mx-auto px-4 sm:px-6 grid lg:grid-cols-2 gap-12 lg:gap-20 items-center"
        >
          <div>
            <AiWriterIllustration />
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
