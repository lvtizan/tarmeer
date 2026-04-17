import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { t, type Lang } from '../../i18n/forCompanies';
import AdminSelect from '../ui/AdminSelect';
import { validatePhone, isPhoneComplete } from '../../lib/phoneValidation';
import { api } from '../../lib/api';

const GCC_PHONE_OPTIONS = [
  { label: 'UAE', code: '+971', maxDigits: 9 },
  { label: 'KSA', code: '+966', maxDigits: 9 },
  { label: 'Qatar', code: '+974', maxDigits: 8 },
  { label: 'Kuwait', code: '+965', maxDigits: 8 },
  { label: 'Oman', code: '+968', maxDigits: 8 },
  { label: 'Bahrain', code: '+973', maxDigits: 8 },
];

const UAE_CITIES = ['Dubai', 'Abu Dhabi', 'Sharjah', 'Ajman', 'Ras Al Khaimah', 'Fujairah', 'Umm Al Quwain'];

const COMPANY_TYPES = [
  { value: 'design_studio', labelKey: 'typeDesignStudio' as const },
  { value: 'renovation_company', labelKey: 'typeRenovation' as const },
  { value: 'general_contractor', labelKey: 'typeGeneralContractor' as const },
  { value: 'mep_contractor', labelKey: 'typeMepContractor' as const },
  { value: 'maintenance_company', labelKey: 'typeMaintenanceCompany' as const },
  { value: 'specialty_trade', labelKey: 'typeSpecialtyTrade' as const },
  { value: 'landscaping', labelKey: 'typeLandscaping' as const },
  { value: 'furnishing', labelKey: 'typeFurnishing' as const },
];

const API_BASE = import.meta.env.VITE_API_URL?.trim() || '/api';

interface CompanySignupFormProps {
  lang: Lang;
}

export default function CompanySignupForm({ lang }: CompanySignupFormProps) {
  const navigate = useNavigate();

  // Form fields
  const [contactName, setContactName] = useState('');
  const [phoneRegion, setPhoneRegion] = useState(GCC_PHONE_OPTIONS[0]);
  const [phoneDigits, setPhoneDigits] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [companyType, setCompanyType] = useState('');
  const [establishmentYear, setEstablishmentYear] = useState('');
  const [city, setCity] = useState('');

  // Phone validation
  const phoneError = isPhoneComplete(phoneDigits, phoneRegion.code)
    ? validatePhone(phoneDigits, phoneRegion.code)
    : null;

  // Refs
  const companyTypeRef = useRef<HTMLSelectElement>(null);

  // UI state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [companyTypeError, setCompanyTypeError] = useState(false);
  const [tried, setTried] = useState(false);

  // Phone-exists inline login state
  const [phoneExistsMode, setPhoneExistsMode] = useState(false);
  const [existingHasProfile, setExistingHasProfile] = useState(false);
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState<string | null>(null);
  const [loginSubmitting, setLoginSubmitting] = useState(false);

  // New user registration (stay on page instead of redirecting to /auth)
  const [registerMode, setRegisterMode] = useState(false);
  const [regStep, setRegStep] = useState<'email' | 'password'>('email');
  const [regIsNewEmail, setRegIsNewEmail] = useState<boolean | null>(null);
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regError, setRegError] = useState<string | null>(null);
  const [regSubmitting, setRegSubmitting] = useState(false);
  const [regSuccess, setRegSuccess] = useState<string | null>(null);

  const dir = lang === 'ar' ? 'rtl' : 'ltr';

  const inputClass =
    'w-full h-[50px] px-5 rounded-2xl border border-stone-200 bg-stone-50/80 text-[15px] text-[#1c1917] placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-[#B8864A]/15 focus:border-[#B8864A] focus:bg-white transition';

  const labelClass = 'block text-xs font-medium uppercase tracking-wider text-stone-500 mb-1.5';

  /* ── Step 1: Submit lead to CRM ── */
  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTried(true);
    setError(null);

    if (!contactName.trim()) { setError('Please fill in all required fields'); return; }
    if (!phoneDigits.trim() || !isPhoneComplete(phoneDigits, phoneRegion.code)) { setError('Please fill in all required fields'); return; }
    if (phoneError) { setError(phoneError); return; }
    if (!companyName.trim()) { setError('Please fill in all required fields'); return; }
    if (!city) { setError('Please fill in all required fields'); return; }
    if (!companyType) {
      setCompanyTypeError(true);
      setError('Please fill in all required fields');
      return;
    }
    if (establishmentYear) {
      const yr = Number(establishmentYear);
      if (yr < 1900 || yr > 2026) { setError('Year must be between 1900 and 2026'); return; }
    }

    setIsSubmitting(true);
    try {
      const res = await fetch(`${API_BASE}/company-leads`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contactName: contactName.trim(),
          phone: `${phoneRegion.code}${phoneDigits}`,
          companyName: companyName.trim(),
          companyType,
          establishmentYear: establishmentYear || undefined,
          city,
        }),
      });

      if (res.status === 409) {
        const body = await res.json().catch(() => ({}));
        if (body.phoneExists) {
          const hasProfile = !!body.hasCompanyProfile;
          setExistingHasProfile(hasProfile);
          if (!hasProfile) {
            // Save form data so profile page can prefill after login
            sessionStorage.setItem('company_signup_prefill', JSON.stringify({
              company_name: companyName.trim(),
              contact_person: contactName.trim(),
              phone: `${phoneRegion.code}${phoneDigits}`,
              city,
              company_type: companyType,
              establishment_year: establishmentYear || null,
            }));
          }
          setPhoneExistsMode(true);
          setIsSubmitting(false);
          return;
        }
      }

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || 'Failed to submit. Please try again.');
      }

      // Stay on page — show email/password registration form
      setRegisterMode(true);
    } catch (err: any) {
      setError(err?.message || 'Something went wrong. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  /* ── Step 2: Login when phone already registered ── */
  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginEmail.trim() || !loginPassword) {
      setLoginError('Please enter your email and password.');
      return;
    }
    setLoginSubmitting(true);
    setLoginError(null);
    try {
      const response = await api.post('/auth/login', { email: loginEmail.trim(), password: loginPassword });
      api.setToken(response.token);
      if (response.user) {
        localStorage.setItem('user', JSON.stringify(response.user));
        localStorage.setItem('active_role', 'company');
      }
      // If no existing profile, auto-create it with form data so dashboard onboarding can proceed
      if (!existingHasProfile) {
        await api.post('/auth/company/profile', {
          company_name: companyName.trim(),
          contact_person: contactName.trim(),
          phone: `${phoneRegion.code}${phoneDigits}`,
          city,
          company_type: companyType,
          establishment_year: establishmentYear ? Number(establishmentYear) : null,
          description: '',
          services: ['Interior Design'],
        }).catch(() => {});
      }
      navigate('/company/dashboard');
    } catch (err: any) {
      setLoginError(err?.message || 'Invalid email or password.');
    } finally {
      setLoginSubmitting(false);
    }
  };



  /* ── Step 3a: Check email availability ── */
  const handleEmailContinue = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!regEmail.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(regEmail.trim())) {
      setRegError(lang === 'ar' ? 'يرجى إدخال بريد إلكتروني صالح' : 'Please enter a valid email.');
      return;
    }
    setRegSubmitting(true);
    setRegError(null);
    try {
      const res = await api.post('/auth/check-availability', { email: regEmail.trim() });
      setRegIsNewEmail(res.isNewEmail !== false);
      setRegStep('password');
    } catch {
      // If check fails, assume new and proceed
      setRegIsNewEmail(true);
      setRegStep('password');
    } finally {
      setRegSubmitting(false);
    }
  };

  /* ── Step 3b: Register or login with password ── */
  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!regPassword) {
      setRegError(lang === 'ar' ? 'يرجى إدخال كلمة المرور' : 'Please enter your password.');
      return;
    }
    if (regIsNewEmail && regPassword.length < 6) {
      setRegError(lang === 'ar' ? 'كلمة المرور يجب أن تكون 6 أحرف على الأقل' : 'Password must be at least 6 characters.');
      return;
    }
    setRegSubmitting(true);
    setRegError(null);
    const source = 'for-companies-landing';
    const profileData = {
      company_name: companyName.trim(),
      phone: `${phoneRegion.code}${phoneDigits}`,
      city,
      contact_person: contactName.trim(),
      description: '',
      services: ['Interior Design'],
      company_type: companyType,
      establishment_year: establishmentYear ? Number(establishmentYear) : null,
      signup_source: source,
    };

    try {
      if (regIsNewEmail) {
        // New user: register → auto-login → create profile
        await api.post('/auth/register', {
          email: regEmail.trim(),
          password: regPassword,
          full_name: contactName.trim(),
          phone: `${phoneRegion.code}${phoneDigits}`,
          city,
          role: 'company',
          signup_source: source,
        });

        try {
          const loginRes = await api.post('/auth/login', { email: regEmail.trim(), password: regPassword });
          api.setToken(loginRes.token);
          if (loginRes.user) {
            localStorage.setItem('user', JSON.stringify(loginRes.user));
            localStorage.setItem('active_role', 'company');
          }
          await api.post('/auth/company/profile', profileData);
          navigate('/company');
          return;
        } catch {
          // Save profile data so it can be applied after email verification + login
          sessionStorage.setItem('pending_company_profile', JSON.stringify(profileData));
          setRegSuccess(
            lang === 'ar'
              ? `تم إنشاء الحساب! يرجى التحقق من ${regEmail.trim()} ثم تسجيل الدخول.`
              : `Account created! Please check ${regEmail.trim()} to verify your email, then sign in.`
          );
        }
      } else {
        // Existing user: login → create/update profile
        const loginRes = await api.post('/auth/login', { email: regEmail.trim(), password: regPassword });
        api.setToken(loginRes.token);
        if (loginRes.user) {
          localStorage.setItem('user', JSON.stringify(loginRes.user));
          localStorage.setItem('active_role', 'company');
        }
        await api.post('/auth/company/profile', profileData).catch(() => {});
        navigate('/company');
      }
    } catch (err: any) {
      setRegError(err.message || (regIsNewEmail ? 'Registration failed.' : 'Invalid email or password.'));
    } finally {
      setRegSubmitting(false);
    }
  };

  /* ── Main form UI ── */
  return (
    <div
      dir={dir}
      className="bg-white rounded-[20px] shadow-[0_18px_44px_rgba(28,25,23,0.14)] overflow-hidden"
    >
      <div className="px-6 py-5 space-y-4">
        {/* ── Phone-exists inline login panel ── */}
        {phoneExistsMode ? (
          <>
            <div className="flex items-start gap-3 rounded-2xl bg-amber-50 border border-amber-200 px-4 py-3">
              <span className="text-amber-500 text-lg leading-none mt-0.5">⚠️</span>
              <div>
                <p className="text-[15px] font-semibold text-[#1c1917]">
                  {lang === 'ar' ? 'هذا الرقم مسجّل بالفعل' : 'This phone number is already registered'}
                </p>
                <p className="text-sm text-stone-500 mt-0.5">
                  {existingHasProfile
                    ? (lang === 'ar' ? 'سجّل الدخول للوصول إلى لوحة التحكم' : 'Sign in to access your dashboard')
                    : (lang === 'ar' ? 'سجّل الدخول لاستكمال ملفك الشركة' : 'Sign in to complete your company profile')}
                </p>
              </div>
            </div>

            <form onSubmit={handleLoginSubmit} className="space-y-3" noValidate>
              <div>
                <label className={labelClass}>
                  {lang === 'ar' ? 'البريد الإلكتروني' : 'Email'} <span className="text-red-500">*</span>
                </label>
                <input
                  type="email"
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  placeholder={lang === 'ar' ? 'أدخل بريدك الإلكتروني' : 'Enter your email'}
                  className={inputClass}
                  autoFocus
                />
              </div>
              <div>
                <label className={labelClass}>
                  {lang === 'ar' ? 'كلمة المرور' : 'Password'} <span className="text-red-500">*</span>
                </label>
                <input
                  type="password"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  placeholder={lang === 'ar' ? 'أدخل كلمة المرور' : 'Enter your password'}
                  className={inputClass}
                />
              </div>

              {loginError && (
                <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[12px] leading-5 text-red-700">
                  {loginError}
                </p>
              )}

              <button
                type="submit"
                disabled={loginSubmitting}
                className="flex h-12 w-full items-center justify-center rounded-[20px] bg-[#B8864A] text-[15px] font-semibold text-white shadow-[0_16px_28px_rgba(184,134,74,0.22)] transition hover:bg-[#a67c47] disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {loginSubmitting ? (
                  <>
                    <span className="mr-2 h-4 w-4 rounded-full border-2 border-white/30 border-t-white animate-spin inline-block" />
                    {lang === 'ar' ? 'جارٍ الدخول...' : 'Signing in...'}
                  </>
                ) : (
                  lang === 'ar' ? 'تسجيل الدخول' : 'Sign In'
                )}
              </button>

              <button
                type="button"
                onClick={() => { setPhoneExistsMode(false); setLoginError(null); }}
                className="w-full text-center text-sm text-stone-500 hover:text-stone-700 py-1"
              >
                {lang === 'ar' ? '← العودة' : '← Back'}
              </button>
            </form>
          </>
        ) : registerMode ? (
          <>
            {regSuccess ? (
              <div className="text-center space-y-4 py-4">
                <div className="w-14 h-14 mx-auto rounded-full bg-emerald-50 flex items-center justify-center">
                  <svg className="w-7 h-7 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                </div>
                <p className="text-[15px] text-stone-700 leading-relaxed px-2">{regSuccess}</p>
              </div>
            ) : (
              <>
                <h2 className="text-[18px] font-bold text-[#1c1917] leading-snug">
                  {lang === 'ar' ? 'إنشاء حسابك' : 'Create your account'}
                </h2>

                {/* Google OAuth */}
                <button
                  type="button"
                  onClick={() => {
                    const apiBase = import.meta.env.VITE_API_URL || '/api';
                    sessionStorage.setItem('pending_company_profile', JSON.stringify({
                      company_name: companyName.trim(),
                      contact_person: contactName.trim(),
                      phone: `${phoneRegion.code}${phoneDigits}`,
                      city,
                      company_type: companyType,
                      establishment_year: establishmentYear || null,
                    }));
                    window.location.href = `${apiBase}/auth/google?role=company`;
                  }}
                  className="flex h-12 w-full items-center justify-center gap-3 rounded-[20px] border border-stone-200 bg-white text-[15px] font-medium text-[#1c1917] shadow-sm transition hover:bg-stone-50"
                >
                  <svg className="h-[18px] w-[18px]" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                  </svg>
                  {lang === 'ar' ? 'المتابعة مع Google' : 'Continue with Google'}
                </button>

                <div className="relative my-1">
                  <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-stone-100" /></div>
                  <div className="relative flex justify-center">
                    <span className="px-4 bg-white text-[10px] text-stone-400 font-medium tracking-[0.15em]">
                      {lang === 'ar' ? 'أو بالبريد الإلكتروني' : 'OR CONTINUE WITH EMAIL'}
                    </span>
                  </div>
                </div>

                {regError && (
                  <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[12px] leading-5 text-red-700">
                    {regError}
                  </p>
                )}

                {regStep === 'email' ? (
                  /* Step 3a: Email input */
                  <form onSubmit={handleEmailContinue} className="space-y-3" noValidate>
                    <input
                      type="email"
                      value={regEmail}
                      onChange={(e) => { setRegEmail(e.target.value); setRegError(null); }}
                      placeholder={lang === 'ar' ? 'أدخل بريدك الإلكتروني' : 'Enter your email'}
                      className={inputClass}
                      autoFocus
                    />
                    <button
                      type="submit"
                      disabled={regSubmitting || !regEmail.trim()}
                      className="flex h-12 w-full items-center justify-center rounded-[20px] bg-[#B8864A] text-[15px] font-semibold text-white shadow-[0_16px_28px_rgba(184,134,74,0.22)] transition hover:bg-[#a67c47] disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                      {regSubmitting ? (
                        <span className="h-4 w-4 rounded-full border-2 border-white/30 border-t-white animate-spin inline-block" />
                      ) : (
                        lang === 'ar' ? 'المتابعة بالبريد الإلكتروني' : 'Continue with email'
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => { setRegisterMode(false); setRegError(null); }}
                      className="w-full text-center text-sm text-stone-500 hover:text-stone-700 py-1"
                    >
                      {lang === 'ar' ? '← العودة' : '← Back'}
                    </button>

                    <p className="text-[10px] text-stone-400 text-center">
                      {lang === 'ar' ? 'بالمتابعة، أنت توافق على' : 'By continuing, you agree to our'}{' '}
                      <a href="/privacy" className="text-stone-500 hover:text-[#B8864A]">Terms</a>
                      {' '}•{' '}
                      <a href="/privacy" className="text-stone-500 hover:text-[#B8864A]">Privacy</a>
                    </p>
                  </form>
                ) : (
                  /* Step 3b: Password input */
                  <form onSubmit={handlePasswordSubmit} className="space-y-3" noValidate>
                    <p className="text-sm text-stone-500">
                      {regIsNewEmail
                        ? (lang === 'ar' ? 'أنشئ كلمة مرور لـ' : 'Create a password for')
                        : (lang === 'ar' ? 'أدخل كلمة المرور لـ' : 'Enter password for')
                      }{' '}
                      <span className="font-medium text-[#1c1917]">{regEmail}</span>
                    </p>
                    <input
                      type="password"
                      value={regPassword}
                      onChange={(e) => { setRegPassword(e.target.value); setRegError(null); }}
                      placeholder={regIsNewEmail
                        ? (lang === 'ar' ? '6 أحرف على الأقل' : 'At least 6 characters')
                        : (lang === 'ar' ? 'أدخل كلمة المرور' : 'Enter your password')
                      }
                      className={inputClass}
                      autoFocus
                    />
                    <button
                      type="submit"
                      disabled={regSubmitting || !regPassword}
                      className="flex h-12 w-full items-center justify-center rounded-[20px] bg-[#B8864A] text-[15px] font-semibold text-white shadow-[0_16px_28px_rgba(184,134,74,0.22)] transition hover:bg-[#a67c47] disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                      {regSubmitting ? (
                        <span className="h-4 w-4 rounded-full border-2 border-white/30 border-t-white animate-spin inline-block" />
                      ) : regIsNewEmail ? (
                        lang === 'ar' ? 'إنشاء حساب' : 'Create Account'
                      ) : (
                        lang === 'ar' ? 'تسجيل الدخول' : 'Sign In'
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => { setRegStep('email'); setRegPassword(''); setRegError(null); }}
                      className="w-full text-center text-sm text-stone-500 hover:text-stone-700 py-1"
                    >
                      {lang === 'ar' ? '← العودة' : '← Back'}
                    </button>
                  </form>
                )}
              </>
            )}
          </>
        ) : (
        <>
        <h2 className="text-[18px] font-bold text-[#1c1917] leading-snug">
          {t(lang, 'formTitle')}
        </h2>

        <form onSubmit={handleFormSubmit} className="space-y-4" noValidate>
          {/* Contact Name */}
          <div>
            <label className={labelClass}>
              {t(lang, 'contactName')} <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={contactName}
              onChange={(e) => setContactName(e.target.value)}
              placeholder={t(lang, 'contactNamePlaceholder')}
              className={`${inputClass} ${tried && !contactName.trim() ? 'border-red-400 focus:border-red-400 focus:ring-red-200/30' : ''}`}
            />
          </div>

          {/* Phone Number */}
          <div>
            <label className={labelClass}>
              {t(lang, 'phone')} <span className="text-red-500">*</span>
            </label>
            <div className="flex gap-2">
              <AdminSelect
                value={phoneRegion.code}
                onChange={(code) => {
                  const next = GCC_PHONE_OPTIONS.find((o) => o.code === code) || GCC_PHONE_OPTIONS[0];
                  setPhoneRegion(next);
                  setPhoneDigits((d) => d.slice(0, next.maxDigits));
                }}
                options={GCC_PHONE_OPTIONS.map((o) => ({ value: o.code, label: `${o.label} (${o.code})` }))}
                className="shrink-0 w-[150px]"
              />
              <input
                type="tel"
                inputMode="numeric"
                value={phoneDigits}
                onChange={(e) => {
                  const digits = e.target.value
                    .replace(/\D/g, '')
                    .slice(0, phoneRegion.maxDigits);
                  setPhoneDigits(digits);
                }}
                maxLength={phoneRegion.maxDigits}
                placeholder={t(lang, 'phonePlaceholder')}
                className={`${inputClass} flex-1 min-w-0 ${
                  phoneError || (tried && !isPhoneComplete(phoneDigits, phoneRegion.code))
                    ? 'border-red-400 focus:border-red-400 focus:ring-red-200/30'
                    : ''
                }`}
              />
            </div>
            {phoneError && (
              <p className="mt-1.5 text-[12px] text-red-600">{phoneError}</p>
            )}
          </div>

          {/* Company Name */}
          <div>
            <label className={labelClass}>
              {t(lang, 'companyName')} <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              placeholder={t(lang, 'companyNamePlaceholder')}
              className={`${inputClass} ${tried && !companyName.trim() ? 'border-red-400 focus:border-red-400 focus:ring-red-200/30' : ''}`}
            />
          </div>

          {/* City */}
          <div>
            <label className={labelClass}>
              {lang === 'ar' ? 'المدينة' : 'City'} <span className="text-red-500">*</span>
            </label>
            <AdminSelect
              value={city}
              onChange={setCity}
              options={[
                { value: '', label: lang === 'ar' ? 'اختر المدينة' : 'Select city' },
                ...UAE_CITIES.map(c => ({ value: c, label: c })),
              ]}
              className="w-full"
              error={tried && !city}
            />
          </div>

          {/* Company Type */}
          <div>
            <label className={labelClass}>
              {t(lang, 'companyType')} <span className="text-red-500">*</span>
            </label>
            <AdminSelect
              ref={companyTypeRef}
              value={companyType}
              onChange={(v) => { setCompanyType(v); if (v) setCompanyTypeError(false); }}
              options={[
                { value: '', label: t(lang, 'companyTypePlaceholder') },
                ...COMPANY_TYPES.map(ct => ({ value: ct.value, label: t(lang, ct.labelKey) })),
              ]}
              className="w-full"
              error={companyTypeError || (tried && !companyType)}
            />
          </div>

          {/* Year of Establishment */}
          <div>
            <label className={labelClass}>{t(lang, 'yearEstablished')}</label>
            <input
              type="text"
              inputMode="numeric"
              value={establishmentYear}
              onChange={(e) => setEstablishmentYear(e.target.value.replace(/\D/g, '').slice(0, 4))}
              placeholder={t(lang, 'yearPlaceholder')}
              className={inputClass}
            />
          </div>

          {/* Error */}
          {error && (
            <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[12px] leading-5 text-red-700">
              {error}
            </p>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={isSubmitting}
            className="flex h-12 w-full items-center justify-center rounded-[20px] bg-[#B8864A] text-[15px] font-semibold text-white shadow-[0_16px_28px_rgba(184,134,74,0.22)] transition hover:bg-[#a67c47] disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {isSubmitting ? (
              <>
                <span className="mr-2 h-4 w-4 rounded-full border-2 border-white/30 border-t-white animate-spin inline-block" />
                {t(lang, 'submitting')}
              </>
            ) : (
              t(lang, 'submit')
            )}
          </button>
        </form>
        </>
        )}
      </div>
    </div>
  );
}
