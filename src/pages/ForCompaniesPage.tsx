import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import TarmeerLogo from '../components/TarmeerLogo';
import { Check, Search, Camera, Phone, Gift, Shield, Users } from 'lucide-react';
import { t, type Lang } from '../i18n/forCompanies';
import CompanySignupForm from '../components/for-companies/CompanySignupForm';

export default function ForCompaniesPage() {
  const [lang, setLang] = useState<Lang>('en');

  return (
    <div dir={lang === 'ar' ? 'rtl' : 'ltr'}>
      <Helmet>
        <title>Join Tarmeer — Get Homeowner Leads Free | UAE Renovation Platform</title>
        <meta name="description" content="Join 100+ renovation companies on Tarmeer. Get homeowner leads, showcase your projects, grow your business — 100% free." />
        <meta property="og:title" content="Join Tarmeer — Get Homeowner Leads Free" />
        <meta property="og:description" content="Upload your projects. Homeowners find you and call you. Free to join." />
        <meta property="og:image" content="https://www.tarmeer.com/images/tarmeer_logo.svg" />
        <meta property="og:url" content="https://www.tarmeer.com/for-companies" />
        <meta property="og:type" content="website" />
        <link rel="canonical" href="https://www.tarmeer.com/for-companies" />
      </Helmet>

      {/* ── Header ── */}
      <header className="sticky top-0 z-50 h-14 bg-white shadow-sm flex items-center px-4 sm:px-6">
        <div className="max-w-6xl mx-auto w-full flex items-center justify-between">
          <TarmeerLogo />
          <div className="flex items-center gap-1 rounded-lg border border-stone-200 p-0.5">
            <button onClick={() => setLang('en')} className={`px-3 py-1 text-sm font-medium rounded-md transition ${lang === 'en' ? 'bg-[#b8864a] text-white' : 'text-[#6b6b6b]'}`}>EN</button>
            <button onClick={() => setLang('ar')} className={`px-3 py-1 text-sm font-medium rounded-md transition ${lang === 'ar' ? 'bg-[#b8864a] text-white' : 'text-[#6b6b6b]'}`}>AR</button>
          </div>
        </div>
      </header>

      {/* ── Hero ── */}
      <section className="bg-[#141211] relative overflow-hidden">
        {/* Layered gradients for depth */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_10%_20%,rgba(184,134,74,0.12)_0%,transparent_70%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_50%_at_90%_80%,rgba(184,134,74,0.06)_0%,transparent_60%)]" />
        {/* Animated flowing curves — gold SVG */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none" preserveAspectRatio="none" viewBox="0 0 1440 700" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M-100 500 C200 350, 500 650, 800 400 S1200 200, 1540 350" stroke="url(#gold1)" strokeWidth="1" opacity="0.12">
            <animate attributeName="d" dur="12s" repeatCount="indefinite" values="
              M-100 500 C200 350, 500 650, 800 400 S1200 200, 1540 350;
              M-100 450 C200 400, 500 550, 800 350 S1200 250, 1540 400;
              M-100 500 C200 350, 500 650, 800 400 S1200 200, 1540 350
            "/>
          </path>
          <path d="M-100 550 C300 400, 600 700, 900 450 S1300 250, 1540 400" stroke="url(#gold1)" strokeWidth="0.8" opacity="0.08">
            <animate attributeName="d" dur="15s" repeatCount="indefinite" values="
              M-100 550 C300 400, 600 700, 900 450 S1300 250, 1540 400;
              M-100 500 C300 450, 600 600, 900 400 S1300 300, 1540 450;
              M-100 550 C300 400, 600 700, 900 450 S1300 250, 1540 400
            "/>
          </path>
          <path d="M-100 600 C400 450, 700 750, 1000 500 S1400 300, 1540 450" stroke="url(#gold2)" strokeWidth="0.6" opacity="0.06">
            <animate attributeName="d" dur="18s" repeatCount="indefinite" values="
              M-100 600 C400 450, 700 750, 1000 500 S1400 300, 1540 450;
              M-100 550 C400 500, 700 650, 1000 450 S1400 350, 1540 500;
              M-100 600 C400 450, 700 750, 1000 500 S1400 300, 1540 450
            "/>
          </path>
          <path d="M-50 200 C300 100, 700 350, 1100 150 S1400 50, 1540 200" stroke="url(#gold2)" strokeWidth="0.7" opacity="0.07">
            <animate attributeName="d" dur="20s" repeatCount="indefinite" values="
              M-50 200 C300 100, 700 350, 1100 150 S1400 50, 1540 200;
              M-50 250 C300 150, 700 300, 1100 200 S1400 100, 1540 250;
              M-50 200 C300 100, 700 350, 1100 150 S1400 50, 1540 200
            "/>
          </path>
          <defs>
            <linearGradient id="gold1" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#b8864a" stopOpacity="0" />
              <stop offset="30%" stopColor="#b8864a" stopOpacity="1" />
              <stop offset="70%" stopColor="#c6a065" stopOpacity="1" />
              <stop offset="100%" stopColor="#b8864a" stopOpacity="0" />
            </linearGradient>
            <linearGradient id="gold2" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#c6a065" stopOpacity="0" />
              <stop offset="50%" stopColor="#b8864a" stopOpacity="1" />
              <stop offset="100%" stopColor="#c6a065" stopOpacity="0" />
            </linearGradient>
          </defs>
        </svg>
        {/* Subtle gold accent line */}
        <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-[#b8864a]/40 to-transparent" />

        <div className="relative max-w-6xl mx-auto px-6 sm:px-8 lg:px-6 py-12 lg:py-24 grid lg:grid-cols-[1fr_420px] gap-12 lg:gap-16 items-center">
          {/* Form first on mobile */}
          <div className="order-1 lg:order-2">
            <CompanySignupForm lang={lang} />
          </div>
          <div className="order-2 lg:order-1 text-center lg:text-left">
            {/* Tagline with gold bar */}
            <div className="flex items-center justify-center lg:justify-start gap-3 mb-6">
              <div className="h-[2px] w-8 bg-[#b8864a]" />
              <p className="text-[11px] font-bold text-[#c6a065] uppercase tracking-[0.25em]">
                {t(lang, 'tagline')}
              </p>
            </div>

            {/* Big title */}
            <h1 className="font-serif text-[2.5rem] sm:text-[3.2rem] lg:text-[3.8rem] font-bold text-white leading-[1.1] tracking-tight">
              {lang === 'ar' ? t(lang, 'headline') : (
                <>Homeowners Are<br />Looking <span className="text-[#c6a065]">for You</span></>
              )}
            </h1>

            {/* Subtitle */}
            <p className="text-[17px] text-white/55 mt-6 max-w-[420px] mx-auto lg:mx-0 leading-[1.7]">
              {t(lang, 'subtitle')}
            </p>

          </div>
        </div>
      </section>

      {/* ── Features ── */}
      <section className="bg-[#f5f0e8] py-14 lg:py-20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          {/* Step flow: cards with step numbers and connecting arrows */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 relative">
            {/* Connecting arrows between cards (desktop only) */}
            <div className="hidden md:flex absolute top-14 left-[33.33%] -translate-x-1/2 w-8 items-center justify-center z-10">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M5 12h14M13 5l7 7-7 7" stroke="#b8864a" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.4"/></svg>
            </div>
            <div className="hidden md:flex absolute top-14 left-[66.66%] -translate-x-1/2 w-8 items-center justify-center z-10">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M5 12h14M13 5l7 7-7 7" stroke="#b8864a" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.4"/></svg>
            </div>
            {([
              { icon: Search, step: '01', tag: 'feature1Tag', title: 'feature1Title', desc: 'feature1Desc', checks: ['feature1Check1', 'feature1Check2', 'feature1Check3'] },
              { icon: Camera, step: '02', tag: 'feature2Tag', title: 'feature2Title', desc: 'feature2Desc', checks: ['feature2Check1', 'feature2Check2', 'feature2Check3'] },
              { icon: Phone, step: '03', tag: 'feature3Tag', title: 'feature3Title', desc: 'feature3Desc', checks: ['feature3Check1', 'feature3Check2', 'feature3Check3'] },
            ] as const).map((feat) => (
              <div key={feat.tag} className="rounded-2xl bg-white border border-stone-200/60 p-7 sm:p-8 shadow-sm hover:shadow-md transition-shadow relative">
                {/* Large step number watermark */}
                <span className="absolute top-4 right-5 text-[3.5rem] font-bold text-[#b8864a]/[0.06] leading-none select-none">{feat.step}</span>
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#b8864a]/10 mb-5">
                  <feat.icon className="w-6 h-6 text-[#b8864a]" />
                </div>
                <p className="text-[10px] font-bold text-[#b8864a] uppercase tracking-[0.2em] mb-2">
                  {t(lang, feat.tag)}
                </p>
                <h3 className="font-serif text-[22px] font-bold text-[#1c1917] leading-snug">{t(lang, feat.title)}</h3>
                <p className="text-[14px] text-[#6b6b6b] leading-relaxed mt-3">{t(lang, feat.desc)}</p>
                <div className="mt-5 space-y-2.5">
                  {feat.checks.map((key) => (
                    <div key={key} className="flex items-center gap-2.5">
                      <Check className="w-4 h-4 text-[#b8864a] flex-shrink-0" />
                      <span className="text-[14px] text-[#2c2c2c]">{t(lang, key)}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Why Join ── */}
      <section className="bg-white py-14 lg:py-20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-center gap-3 mb-3">
            <div className="h-[2px] w-8 bg-[#b8864a]" />
            <p className="text-[10px] font-bold text-[#b8864a] uppercase tracking-[0.25em]">WHY TARMEER</p>
            <div className="h-[2px] w-8 bg-[#b8864a]" />
          </div>
          <h2 className="font-serif text-[1.8rem] lg:text-[2.2rem] font-bold text-[#1c1917] text-center mb-10">
            {t(lang, 'gridTitle')}
          </h2>
          <div className="grid sm:grid-cols-3 gap-6">
            {[
              { icon: Gift, title: 'grid1Title' as const, desc: 'grid1Desc' as const },
              { icon: Shield, title: 'grid2Title' as const, desc: 'grid2Desc' as const },
              { icon: Users, title: 'grid3Title' as const, desc: 'grid3Desc' as const },
            ].map((card, i) => (
              <div key={i} className="rounded-2xl border border-stone-100 bg-[#faf9f7] p-7 text-center">
                <div className="w-12 h-12 rounded-2xl bg-[#b8864a]/10 flex items-center justify-center mb-5 mx-auto">
                  <card.icon className="w-6 h-6 text-[#b8864a]" />
                </div>
                <h3 className="text-[16px] font-semibold text-[#1c1917] mb-2">{t(lang, card.title)}</h3>
                <p className="text-[14px] text-[#6b6b6b] leading-relaxed">{t(lang, card.desc)}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="bg-[#1c1917] py-6 border-t border-white/10">
        <div className="flex gap-6 items-center justify-center">
          <span className="text-sm text-white/40">&copy; 2026 Tarmeer</span>
          <Link to="/privacy" className="text-sm text-white/40 hover:text-white/60 transition">{t(lang, 'privacy')}</Link>
          <Link to="/contact" className="text-sm text-white/40 hover:text-white/60 transition">{t(lang, 'contactUs')}</Link>
        </div>
      </footer>
    </div>
  );
}
