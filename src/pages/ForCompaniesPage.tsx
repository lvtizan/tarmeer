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

      {/* ── Hero: no image, pure CSS gradient, instant load ── */}
      <section className="bg-[#1c1917] relative">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(184,134,74,0.15)_0%,transparent_60%)]" />
        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 py-10 lg:py-20 grid lg:grid-cols-2 gap-10 items-start">
          {/* Form first on mobile */}
          <div className="order-1 lg:order-2">
            <CompanySignupForm lang={lang} />
          </div>
          <div className="order-2 lg:order-1">
            <p className="text-xs font-semibold text-[#c6a065] uppercase tracking-[0.2em]">
              {t(lang, 'tagline')}
            </p>
            <h1 className="font-serif text-3xl sm:text-4xl lg:text-5xl font-bold text-white leading-tight mt-3">
              {t(lang, 'headline')}
            </h1>
            <p className="text-base sm:text-lg text-white/65 mt-4 max-w-md leading-relaxed">
              {t(lang, 'subtitle')}
            </p>
            {/* Trust numbers */}
            <div className="flex flex-wrap gap-6 mt-8">
              <div><span className="text-2xl font-bold text-white">100+</span><p className="text-xs text-white/50 mt-0.5">{lang === 'ar' ? 'شركة مسجلة' : 'Companies'}</p></div>
              <div><span className="text-2xl font-bold text-white">2,000+</span><p className="text-xs text-white/50 mt-0.5">{lang === 'ar' ? 'صورة مشروع' : 'Project Photos'}</p></div>
              <div><span className="text-2xl font-bold text-white">7</span><p className="text-xs text-white/50 mt-0.5">{lang === 'ar' ? 'إمارات' : 'Emirates'}</p></div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Features: results-focused, no jargon ── */}
      <section className="bg-[#1c1917] border-t border-white/5 py-12 lg:py-16">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-px bg-white/10 rounded-2xl overflow-hidden">
            {([
              { icon: Search, tag: 'feature1Tag', title: 'feature1Title', desc: 'feature1Desc', checks: ['feature1Check1', 'feature1Check2', 'feature1Check3'] },
              { icon: Camera, tag: 'feature2Tag', title: 'feature2Title', desc: 'feature2Desc', checks: ['feature2Check1', 'feature2Check2', 'feature2Check3'] },
              { icon: Phone, tag: 'feature3Tag', title: 'feature3Title', desc: 'feature3Desc', checks: ['feature3Check1', 'feature3Check2', 'feature3Check3'] },
            ] as const).map((feat) => (
              <div key={feat.tag} className="bg-[#1c1917] p-6 sm:p-8">
                <div className="flex items-center gap-3 mb-4">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#b8864a]/15">
                    <feat.icon className="w-5 h-5 text-[#c6a065]" />
                  </div>
                  <p className="text-[11px] font-semibold text-[#c6a065] uppercase tracking-wider">
                    {t(lang, feat.tag)}
                  </p>
                </div>
                <h3 className="font-serif text-xl font-bold text-white">{t(lang, feat.title)}</h3>
                <p className="text-[14px] text-white/55 leading-relaxed mt-2">{t(lang, feat.desc)}</p>
                <div className="mt-4 space-y-2">
                  {feat.checks.map((key) => (
                    <div key={key} className="flex items-center gap-2">
                      <Check className="w-4 h-4 text-[#c6a065] flex-shrink-0" />
                      <span className="text-[14px] text-white/80">{t(lang, key)}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Why Join ── */}
      <section className="bg-[#f5f0e8] py-12 lg:py-16">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <h2 className="font-serif text-2xl lg:text-3xl font-bold text-[#1c1917] text-center mb-8">
            {t(lang, 'gridTitle')}
          </h2>
          <div className="grid sm:grid-cols-3 gap-5">
            {[
              { icon: Gift, title: 'grid1Title' as const, desc: 'grid1Desc' as const },
              { icon: Shield, title: 'grid2Title' as const, desc: 'grid2Desc' as const },
              { icon: Users, title: 'grid3Title' as const, desc: 'grid3Desc' as const },
            ].map((card, i) => (
              <div key={i} className="rounded-2xl bg-white p-6 shadow-sm">
                <div className="w-11 h-11 rounded-xl bg-[#b8864a]/10 flex items-center justify-center mb-4">
                  <card.icon className="w-5 h-5 text-[#b8864a]" />
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
