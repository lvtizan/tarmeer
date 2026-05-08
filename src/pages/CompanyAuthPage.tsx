import { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { motion } from 'framer-motion';
import TarmeerLogo from '../components/TarmeerLogo';
import { api } from '../lib/api';
import { MIN_PASSWORD_LENGTH } from '../lib/constants';
import LoadingButton from '../components/ui/LoadingButton';
import AuthCardShell from '../components/auth/AuthCardShell';
import { AUTH_INPUT_CLASS, AUTH_SOCIAL_BUTTON_CLASS } from '../components/auth/authCardStyles';
import { useVerificationPoller } from '../hooks/useVerificationPoller';
import {
  Check,
  Search,
  Camera,
  FileText,
  ChevronRight,
  Mail,
  Lock,
  Eye,
  EyeOff,
  Share2,
  LayoutDashboard,
  Users,
} from 'lucide-react';
import { t, type Lang } from '../i18n/forCompanies';

const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

type AuthStep = 'initial' | 'password' | 'done';

function JoinAuthCard() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [step, setStep] = useState<AuthStep>('initial');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isNewEmail, setIsNewEmail] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Poll for email verification — auto-login when user verifies in another tab/device
  useVerificationPoller(step === 'done' ? email : null, 'company');

  // Company signup data from /for-companies form
  const companySignupData = searchParams.get('company_name') ? {
    company_name: searchParams.get('company_name') || '',
    contact_person: searchParams.get('contact_person') || '',
    phone: searchParams.get('phone') || '',
    city: searchParams.get('city') || 'Dubai',
    company_type: searchParams.get('company_type') || 'renovation_company',
    establishment_year: searchParams.get('establishment_year') || null,
  } : null;

  // Check email availability (debounced)
  useEffect(() => {
    if (!email || !EMAIL_REGEX.test(email)) { setIsNewEmail(null); return; }
    const t = setTimeout(async () => {
      try {
        const res = await api.post('/auth/check-availability', { email });
        setIsNewEmail(res.emailAvailable === true);
      } catch { setIsNewEmail(null); }
    }, 500);
    return () => clearTimeout(t);
  }, [email]);

  const handleEmailContinue = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !EMAIL_REGEX.test(email)) { setError('Please enter a valid email'); return; }
    setError(null);
    setStep('password');
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password || password.length < MIN_PASSWORD_LENGTH) {
      setError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters`);
      return;
    }
    setError(null);
    if (isNewEmail === true) {
      await performRegister();
    } else if (isNewEmail === false) {
      await performLogin();
    } else {
      // null: debounce 还没跑完，同步查一次再决定
      try {
        const result = await api.post('/auth/check-availability', { email });
        if (result.emailAvailable === true) {
          await performRegister();
        } else {
          await performLogin();
        }
      } catch {
        await performLogin();
      }
    }
  };

  const performLogin = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.post('/auth/login', { email, password });
      // Supplier account — store supplier token and redirect to supplier dashboard
      if (response.accountType === 'supplier') {
        localStorage.setItem('supplier_token', response.token);
        localStorage.setItem('supplier_user', JSON.stringify(response.user));
        navigate('/supplier/dashboard');
        return;
      }
      api.setToken(response.token);
      if (response.user) {
        localStorage.setItem('user', JSON.stringify(response.user));
        localStorage.setItem('active_role', response.user.active_role || '');
      }
      if (response.isAdmin) {
        localStorage.setItem('admin_token', response.token);
        localStorage.setItem('admin', JSON.stringify(response.admin));
        navigate('/admin');
        return;
      }
      // Create company profile if coming from /for-companies
      if (companySignupData) {
        localStorage.setItem('active_role', 'company');
        try {
          await api.post('/auth/company/profile', {
            company_name: companySignupData.company_name,
            phone: companySignupData.phone,
            city: companySignupData.city,
            contact_person: companySignupData.contact_person,
            description: '',
            services: ['Interior Design'],
            company_type: companySignupData.company_type,
            establishment_year: companySignupData.establishment_year ? Number(companySignupData.establishment_year) : null,
          });
        } catch { /* profile may already exist */ }
      }
      const returnTo = sessionStorage.getItem('company_returnTo');
      if (returnTo) {
        sessionStorage.removeItem('company_returnTo');
        navigate(returnTo, { replace: true });
      } else {
        navigate('/company');
      }
    } catch (err: any) {
      setLoading(false);
      setError(err.message || 'Invalid email or password.');
    }
  };

  const performRegister = async () => {
    setLoading(true);
    setError(null);
    try {
      // Signup source: if from /for-companies landing, it's "for-companies-landing"
      const source = companySignupData ? 'for-companies-landing' : 'join-page';
      await api.post('/auth/register', {
        email, password,
        full_name: companySignupData?.contact_person || '',
        phone: companySignupData?.phone || '',
        city: companySignupData?.city || 'Dubai',
        role: 'company',
        signup_source: source,
      });

      // If company signup, try to auto-login and create profile
      if (companySignupData) {
        try {
          const loginRes = await api.post('/auth/login', { email, password });
          api.setToken(loginRes.token);
          if (loginRes.user) {
            localStorage.setItem('user', JSON.stringify(loginRes.user));
            localStorage.setItem('active_role', 'company');
          }
          await api.post('/auth/company/profile', {
            company_name: companySignupData.company_name,
            phone: companySignupData.phone,
            city: companySignupData.city,
            contact_person: companySignupData.contact_person,
            description: '',
            services: ['Interior Design'],
            company_type: companySignupData.company_type,
            establishment_year: companySignupData.establishment_year ? Number(companySignupData.establishment_year) : null,
            signup_source: source,
          });
          const returnTo = sessionStorage.getItem('company_returnTo');
          if (returnTo) {
            sessionStorage.removeItem('company_returnTo');
            navigate(returnTo, { replace: true });
          } else {
            navigate('/company');
          }
          return;
        } catch (loginErr: any) {
          // Email verification required — show friendly message instead of red error
          if (loginErr.message?.toLowerCase().includes('verify')) {
            setSuccess(`Account created! Please check ${email} to verify, then log in.`);
            setStep('done');
            return;
          }
          throw loginErr;
        }
      }

      setSuccess('Account created! Please check your email to verify.');
      setStep('done');
    } catch (err: any) {
      if (err.message?.includes('already')) {
        setError('This email is already registered. Please try logging in.');
      } else {
        setError(err.message || 'Registration failed.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthCardShell className="mx-auto lg:mx-0 order-2 lg:order-1">
      {error && (
        <div className="mb-4 rounded-xl border border-red-100 bg-red-50/50 p-3 text-sm text-red-600">{error}</div>
      )}
      {success && (
        <div className="mb-4 rounded-xl border border-emerald-100 bg-emerald-50/50 p-3 text-sm text-emerald-600">{success}</div>
      )}

      {step === 'initial' && (
        <div className="space-y-4">
          <button
            type="button"
            onClick={() => {
              const apiBase = import.meta.env.VITE_API_URL || '/api';
              // Store company signup data for after Google callback
              if (companySignupData) {
                sessionStorage.setItem('pending_company_profile', JSON.stringify(companySignupData));
              }
              const phoneParam = companySignupData?.phone ? `&phone=${encodeURIComponent(companySignupData.phone)}` : '';
              window.location.href = `${apiBase}/auth/google?role=company${phoneParam}`;
            }}
            className={AUTH_SOCIAL_BUTTON_CLASS}
          >
            <svg className="h-[18px] w-[18px]" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            Continue with Google
          </button>

          <div className="relative my-5">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-stone-100"></div>
            </div>
            <div className="relative flex justify-center">
              <span className="px-4 bg-white text-[10px] text-stone-400 font-medium tracking-[0.15em]">OR CONTINUE WITH EMAIL</span>
            </div>
          </div>

          <form onSubmit={handleEmailContinue} className="space-y-4">
            <div className="relative">
              <Mail className="absolute left-5 top-1/2 -translate-y-1/2 h-[18px] w-[18px] text-stone-400" />
              <input
                type="email"
                value={email}
                onChange={(e) => { setEmail(e.target.value); setError(null); }}
                placeholder="Enter your email"
                className={`${AUTH_INPUT_CLASS} pl-[52px] pr-[52px]`}
              />
              {isNewEmail === true && <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-medium text-emerald-600">New account</span>}
              {isNewEmail === false && <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-medium text-stone-500">Sign in</span>}
            </div>
            <button type="submit" className="w-full h-[54px] rounded-2xl bg-[#B8864A] text-white font-semibold text-[15px] hover:bg-[#a3780a] transition-all duration-200 disabled:opacity-35 disabled:cursor-not-allowed shadow-[0_4px_20px_rgba(184,134,74,0.25)]">
              Continue with email
            </button>
            {error && error.includes('email') && <p className="text-sm text-red-500 mt-2">{error}</p>}
          </form>

          <p className="text-[10px] text-stone-400 text-center mt-5">
            By continuing, you agree to our{' '}
            <a href="/privacy" className="text-stone-500 hover:text-[#B8864A] transition-colors">Terms</a>
            {' '}•{' '}
            <a href="/privacy" className="text-stone-500 hover:text-[#B8864A] transition-colors">Privacy</a>
          </p>
        </div>
      )}

      {step === 'password' && (
        <div className="space-y-5">
          <button
            type="button"
            onClick={() => {
              setStep('initial');
              setEmail('');
              setPassword('');
              setError(null);
            }}
            className="text-sm text-stone-400 hover:text-[#1c1917] transition flex items-center gap-1"
          >
            <ChevronRight className="w-4 h-4 rotate-180" />
            Back
          </button>

          <form onSubmit={handlePasswordSubmit} className="space-y-4">
            <p className="text-sm text-stone-500">
              Enter password for <span className="font-medium text-[#1c1917]">{email}</span>
            </p>

            <div className="relative">
              <Lock className="absolute left-5 top-1/2 -translate-y-1/2 h-5 w-5 text-stone-400" />
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => { setPassword(e.target.value); setError(null); }}
                placeholder="Enter your password"
                autoFocus
                className={`${AUTH_INPUT_CLASS} pl-[52px] pr-12`}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 p-2 hover:bg-stone-100 rounded-lg transition"
              >
                {showPassword ? <EyeOff className="w-5 h-5 text-stone-400" /> : <Eye className="w-5 h-5 text-stone-400" />}
              </button>
            </div>
            {error && error.includes('Password') && <p className="mt-2 text-sm text-red-500">{error}</p>}

            {!isNewEmail && (
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" className="h-4 w-4 rounded border-stone-300 text-[#B8864A] focus:ring-[#B8864A]" />
                  <span className="text-sm text-stone-500">Remember me</span>
                </label>
                <button
                  type="button"
                  onClick={() => navigate('/forgot-password')}
                  className="text-sm font-medium text-[#B8864A] hover:opacity-70 transition"
                >
                  Forgot password?
                </button>
              </div>
            )}

            <LoadingButton
              type="submit"
              loading={loading}
              className="w-full h-[54px] rounded-2xl font-semibold bg-[#B8864A] text-white hover:bg-[#a3780a] transition-all duration-200 shadow-[0_4px_20px_rgba(184,134,74,0.25)]"
            >
              {isNewEmail ? 'Create Account' : 'Sign In'}
            </LoadingButton>
          </form>
        </div>
      )}

      {step === 'done' && (
        <div className="text-center py-4">
          <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-3">
            <Check className="w-6 h-6 text-emerald-600" />
          </div>
          <h3 className="font-semibold text-[#1c1917] mb-2">Check your email</h3>
          <p className="text-sm text-[#6b6b6b]">We sent a verification link to <strong>{email}</strong>. Click it to activate your account.</p>
        </div>
      )}
    </AuthCardShell>
  );
}

const fadeUp = {
  initial: { opacity: 0, y: 20 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true },
  transition: { duration: 0.5 },
};

export default function CompanyAuthPage() {
  const [lang, setLang] = useState<Lang>('en');
  return (
    <div dir={lang === 'ar' ? 'rtl' : 'ltr'}>
      <Helmet>
        <title>Join Tarmeer — Grow Your Renovation Business in UAE</title>
        <meta
          name="description"
          content="Join 100+ renovation companies on Tarmeer. AI-driven leads, GEO+SEO optimization, smart photo tagging, and content generation — all included."
        />
        <meta property="og:title" content="Join Tarmeer — Grow Your Renovation Business" />
        <meta property="og:description" content="AI-driven leads, GEO+SEO optimization, and smart tools for renovation companies in UAE." />
        <meta property="og:image" content="https://www.tarmeer.com/images/tarmeer_logo.svg" />
        <meta property="og:url" content="https://www.tarmeer.com/join" />
        <meta property="og:type" content="website" />
        <link rel="canonical" href="https://www.tarmeer.com/join" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="Join Tarmeer — For Renovation Companies in UAE" />
        <meta name="twitter:description" content="Grow your renovation business with AI-driven leads and GEO+SEO optimization." />
        <meta name="twitter:image" content="https://www.tarmeer.com/images/tarmeer_logo.svg" />
        <meta name="robots" content="noindex, nofollow" />
        <script type="application/ld+json">
          {JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'WebPage',
            name: 'Join Tarmeer — For Renovation Companies',
            description: 'AI-powered platform for renovation companies in UAE',
            url: 'https://www.tarmeer.com/join',
            publisher: {
              '@type': 'Organization',
              name: 'Tarmeer',
              url: 'https://www.tarmeer.com',
              logo: 'https://www.tarmeer.com/images/tarmeer_logo.svg',
            },
          })}
        </script>
      </Helmet>

      {/* ── Header ── */}
      <header className="sticky top-0 z-50 h-16 bg-white shadow-sm flex items-center px-4 sm:px-6">
        <div className="max-w-6xl mx-auto w-full flex items-center justify-between">
          <div className="flex items-center gap-2">
            <TarmeerLogo />
            <span className="text-[13px] font-medium text-[#b8864a] tracking-wide">Business Hub</span>
          </div>
          <div className="flex items-center gap-1 rounded-lg border border-stone-200 p-0.5">
            <button
              onClick={() => setLang('en')}
              className={`px-3 py-1 text-sm font-medium rounded-md transition ${
                lang === 'en' ? 'bg-[#b8864a] text-white' : 'text-[#6b6b6b] hover:text-[#2c2c2c]'
              }`}
            >
              EN
            </button>
            <button
              onClick={() => setLang('ar')}
              className={`px-3 py-1 text-sm font-medium rounded-md transition ${
                lang === 'ar' ? 'bg-[#b8864a] text-white' : 'text-[#6b6b6b] hover:text-[#2c2c2c]'
              }`}
            >
              AR
            </button>
          </div>
        </div>
      </header>

      {/* ── Hero — text left, auth card right ── */}
      <section className="relative overflow-hidden">
        <div
          className="absolute inset-0 bg-cover bg-center bg-no-repeat"
          style={{ backgroundImage: 'url(https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=1920&q=85)' }}
        />
        <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(28,25,23,0.88)_0%,rgba(28,25,23,0.75)_50%,rgba(28,25,23,0.6)_100%)]" />
        <div className="relative max-w-5xl mx-auto px-4 sm:px-6 py-16 lg:py-24 grid lg:grid-cols-[1fr_auto] gap-8 lg:gap-10 items-center">
          {/* Text — left */}
          <div>
            <p className="text-sm font-semibold text-[#c6a065] uppercase tracking-wider">
              {t(lang, 'tagline')}
            </p>
            <h1 className="font-serif text-4xl lg:text-5xl font-bold text-white leading-tight mt-4">
              {t(lang, 'headline')}
            </h1>
            <p className="text-lg text-white/70 mt-6 max-w-lg">
              {t(lang, 'subtitle')}
            </p>
          </div>

          {/* Auth card — right */}
          <JoinAuthCard />
        </div>
      </section>

      {/* ── Features — dark band ── */}
      <section className="bg-[#1c1917] py-14 lg:py-20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-px bg-white/10 rounded-2xl overflow-hidden">
            {([
              { icon: Search, tag: 'feature1Tag', title: 'feature1Title', desc: 'feature1Desc', checks: ['feature1Check1', 'feature1Check2', 'feature1Check3'] },
              { icon: Camera, tag: 'feature2Tag', title: 'feature2Title', desc: 'feature2Desc', checks: ['feature2Check1', 'feature2Check2', 'feature2Check3'] },
              { icon: FileText, tag: 'feature3Tag', title: 'feature3Title', desc: 'feature3Desc', checks: ['feature3Check1', 'feature3Check2', 'feature3Check3'] },
            ] as const).map((feat) => (
              <motion.div
                key={feat.tag}
                {...fadeUp}
                className="bg-[#1c1917] p-6 sm:p-8"
              >
                <div className="flex items-center gap-3 mb-4">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#b8864a]/15">
                    <feat.icon className="w-5 h-5 text-[#c6a065]" />
                  </div>
                  <p className="text-[11px] font-semibold text-[#c6a065] uppercase tracking-wider">
                    {t(lang, feat.tag)}
                  </p>
                </div>
                <h3 className="font-serif text-xl font-bold text-white">
                  {t(lang, feat.title)}
                </h3>
                <p className="text-[14px] text-white/55 leading-relaxed mt-2">
                  {t(lang, feat.desc)}
                </p>
                <div className="mt-4 space-y-2">
                  {feat.checks.map((key) => (
                    <div key={key} className="flex items-center gap-2">
                      <Check className="w-4 h-4 text-[#c6a065] flex-shrink-0" />
                      <span className="text-[14px] text-white/80">{t(lang, key)}</span>
                    </div>
                  ))}
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Grid — light band ── */}
      <section className="bg-[#f5f0e8] py-14 lg:py-20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <motion.h2
            {...fadeUp}
            className="font-serif text-3xl lg:text-4xl font-bold text-[#1c1917] text-center mb-10"
          >
            {t(lang, 'gridTitle')}
          </motion.h2>
          <div className="grid sm:grid-cols-3 gap-5 lg:gap-6">
            {[
              { icon: Share2, title: 'grid1Title' as const, desc: 'grid1Desc' as const },
              { icon: LayoutDashboard, title: 'grid2Title' as const, desc: 'grid2Desc' as const },
              { icon: Users, title: 'grid3Title' as const, desc: 'grid3Desc' as const },
            ].map((card, i) => (
              <motion.div
                key={i}
                {...fadeUp}
                transition={{ duration: 0.5, delay: i * 0.1 }}
                className="rounded-2xl bg-white p-6 shadow-sm"
              >
                <div className="w-11 h-11 rounded-xl bg-[#b8864a]/10 flex items-center justify-center mb-4">
                  <card.icon className="w-5 h-5 text-[#b8864a]" />
                </div>
                <h3 className="text-[16px] font-semibold text-[#1c1917] mb-2">
                  {t(lang, card.title)}
                </h3>
                <p className="text-[14px] text-[#6b6b6b] leading-relaxed">
                  {t(lang, card.desc)}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="py-6">
        <div className="flex items-center justify-center gap-2 text-xs text-stone-400">
          <span>&copy; 2026 Tarmeer</span>
          <span>·</span>
          <Link to="/privacy" className="hover:text-stone-600 transition">Privacy Policy</Link>
        </div>
      </footer>
    </div>
  );
}
