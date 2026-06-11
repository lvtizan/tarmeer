'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { t, type Lang } from '@/i18n/forCompanies';
import AdminSelect from '@/components/ui/AdminSelect';
import { validatePhone, isPhoneComplete } from '@/lib/phoneValidation';
import { api } from '@/lib/api';

const GCC_PHONE_OPTIONS = [
  { label: 'UAE', code: '+971', maxDigits: 9 },
  { label: 'KSA', code: '+966', maxDigits: 9 },
  { label: 'Qatar', code: '+974', maxDigits: 8 },
  { label: 'Kuwait', code: '+965', maxDigits: 8 },
  { label: 'Oman', code: '+968', maxDigits: 8 },
  { label: 'Bahrain', code: '+973', maxDigits: 8 },
];

const UAE_CITIES = ['Dubai', 'Abu Dhabi', 'Sharjah', 'Ajman', 'Ras Al Khaimah', 'Fujairah', 'Umm Al Quwain'];

const COMPANY_TYPE_GROUPS: Record<string, string> = {
  design_studio: 'Design',
  renovation_company: 'Construction',
  general_contractor: 'Construction',
  fitout_contractor: 'Construction',
  mep_contractor: 'Systems & MEP',
  fire_fighting: 'Systems & MEP',
  smart_home: 'Systems & MEP',
  waterproofing: 'Systems & MEP',
  glass_aluminium: 'Specialty Trade',
  carpentry_joinery: 'Specialty Trade',
  stone_marble: 'Specialty Trade',
  steel_fabrication: 'Specialty Trade',
  specialty_trade: 'Specialty Trade',
  maintenance_company: 'Services',
  cleaning_services: 'Services',
  manpower_supply: 'Services',
  landscaping: 'Services',
  swimming_pool: 'Services',
  furnishing: 'Furnishing',
};

const COMPANY_TYPES: Array<{ value: string; labelKey: keyof typeof import('@/i18n/forCompanies').default.en }> = [
  { value: 'design_studio', labelKey: 'typeDesignStudio' },
  { value: 'renovation_company', labelKey: 'typeRenovation' },
  { value: 'general_contractor', labelKey: 'typeGeneralContractor' },
  { value: 'fitout_contractor', labelKey: 'typeFitoutContractor' },
  { value: 'mep_contractor', labelKey: 'typeMepContractor' },
  { value: 'fire_fighting', labelKey: 'typeFireFighting' },
  { value: 'smart_home', labelKey: 'typeSmartHome' },
  { value: 'waterproofing', labelKey: 'typeWaterproofing' },
  { value: 'glass_aluminium', labelKey: 'typeGlassAluminium' },
  { value: 'carpentry_joinery', labelKey: 'typeCarpentryJoinery' },
  { value: 'stone_marble', labelKey: 'typeStoneMarble' },
  { value: 'steel_fabrication', labelKey: 'typeSteelFabrication' },
  { value: 'specialty_trade', labelKey: 'typeSpecialtyTrade' },
  { value: 'maintenance_company', labelKey: 'typeMaintenanceCompany' },
  { value: 'cleaning_services', labelKey: 'typeCleaningServices' },
  { value: 'manpower_supply', labelKey: 'typeManpowerSupply' },
  { value: 'landscaping', labelKey: 'typeLandscaping' },
  { value: 'swimming_pool', labelKey: 'typeSwimmingPool' },
  { value: 'furnishing', labelKey: 'typeFurnishing' },
];

const API_BASE = process.env.NEXT_PUBLIC_API_URL?.trim() || '/api';

interface CompanySignupFormProps {
  lang: Lang;
}

export default function CompanySignupForm({ lang }: CompanySignupFormProps) {
  const router = useRouter();

  const [contactName, setContactName] = useState('');
  const [phoneRegion, setPhoneRegion] = useState(GCC_PHONE_OPTIONS[0]);
  const [phoneDigits, setPhoneDigits] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [companyTypes, setCompanyTypes] = useState<string[]>([]);
  const [establishmentYear, setEstablishmentYear] = useState('');
  const [city, setCity] = useState('');

  const phoneError = isPhoneComplete(phoneDigits, phoneRegion.code)
    ? validatePhone(phoneDigits, phoneRegion.code)
    : null;

  const MAX_COMPANY_TYPES = 5;

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [companyTypeError, setCompanyTypeError] = useState(false);
  const [tried, setTried] = useState(false);

  const [phoneExistsMode, setPhoneExistsMode] = useState(false);
  const [existingHasProfile, setExistingHasProfile] = useState(false);
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState<string | null>(null);
  const [loginSubmitting, setLoginSubmitting] = useState(false);

  const [registerMode, setRegisterMode] = useState(false);
  const [regStep, setRegStep] = useState<'email' | 'password'>('email');
  const [regIsNewEmail, setRegIsNewEmail] = useState<boolean | null>(null);
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regError, setRegError] = useState<string | null>(null);
  const [regSubmitting, setRegSubmitting] = useState(false);
  const [regSuccess, setRegSuccess] = useState<string | null>(null);

  const [companyTypeDropdownOpen, setCompanyTypeDropdownOpen] = useState(false);
  const [companyTypeSearch, setCompanyTypeSearch] = useState('');
  const companyTypeDropdownRef = useRef<HTMLDivElement>(null);
  const companyTypeSearchRef = useRef<HTMLInputElement>(null);

  const [phoneAlreadySubmitted, setPhoneAlreadySubmitted] = useState(false);
  const [phoneCheckResult, setPhoneCheckResult] = useState<{ hasAccount: boolean; hasCompanyProfile: boolean } | null>(null);
  const phoneCheckTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const checkPhoneDebounced = useCallback((digits: string, regionCode: string) => {
    clearTimeout(phoneCheckTimer.current);
    setPhoneAlreadySubmitted(false);
    setPhoneCheckResult(null);

    if (!isPhoneComplete(digits, regionCode)) return;
    const validation = validatePhone(digits, regionCode);
    if (validation) return;

    phoneCheckTimer.current = setTimeout(async () => {
      try {
        const fullPhone = `${regionCode}${digits}`;
        const res = await fetch(`${API_BASE}/company-leads/check-phone?phone=${encodeURIComponent(fullPhone)}`);
        if (!res.ok) return;
        const data = await res.json();
        if (data.exists) {
          setPhoneAlreadySubmitted(true);
          setPhoneCheckResult({ hasAccount: data.hasAccount, hasCompanyProfile: data.hasCompanyProfile });
        }
      } catch { /* ignore */ }
    }, 500);
  }, []);

  useEffect(() => {
    return () => clearTimeout(phoneCheckTimer.current);
  }, []);

  useEffect(() => {
    if (!companyTypeDropdownOpen) { setCompanyTypeSearch(''); return; }
    const handleOutside = (e: MouseEvent) => {
      if (companyTypeDropdownRef.current && !companyTypeDropdownRef.current.contains(e.target as Node)) {
        setCompanyTypeDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    setTimeout(() => companyTypeSearchRef.current?.focus(), 50);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [companyTypeDropdownOpen]);

  const dir = lang === 'ar' ? 'rtl' : 'ltr';

  const inputClass =
    'w-full h-[50px] px-5 rounded-2xl border border-stone-200 bg-stone-50/80 text-[15px] text-[#1c1917] placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-[#B8864A]/15 focus:border-[#B8864A] focus:bg-white transition';

  const labelClass = 'block text-xs font-medium uppercase tracking-wider text-stone-500 mb-1.5';

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTried(true);
    setError(null);

    if (!contactName.trim()) { setError('Please fill in all required fields'); return; }
    if (!phoneDigits.trim() || !isPhoneComplete(phoneDigits, phoneRegion.code)) { setError('Please fill in all required fields'); return; }
    if (phoneError) { setError(phoneError); return; }
    if (!companyName.trim()) { setError('Please fill in all required fields'); return; }
    if (!city) { setError('Please fill in all required fields'); return; }
    if (companyTypes.length === 0) {
      setCompanyTypeError(true);
      setError('Please fill in all required fields');
      return;
    }
    if (establishmentYear) {
      const yr = Number(establishmentYear);
      if (yr < 1970 || yr > new Date().getFullYear()) { setError('Invalid year selected'); return; }
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
          companyTypes,
          establishmentYear: establishmentYear || undefined,
          city,
          sourcePage: typeof window !== 'undefined' ? window.location.href : '/for-companies',
        }),
      });

      if (res.status === 409) {
        const body = await res.json().catch(() => ({}));
        if (body.phoneExists) {
          const hasProfile = !!body.hasCompanyProfile;
          setExistingHasProfile(hasProfile);
          if (!hasProfile && typeof sessionStorage !== 'undefined') {
            sessionStorage.setItem('company_signup_prefill', JSON.stringify({
              company_name: companyName.trim(),
              contact_person: contactName.trim(),
              phone: `${phoneRegion.code}${phoneDigits}`,
              city,
              company_type: companyTypes[0] || '',
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

      setRegisterMode(true);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Something went wrong. Please try again.';
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

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
      if (response.user && typeof localStorage !== 'undefined') {
        localStorage.setItem('user', JSON.stringify(response.user));
        localStorage.setItem('active_role', 'company');
      }
      if (!existingHasProfile) {
        await api.post('/auth/company/profile', {
          company_name: companyName.trim(),
          contact_person: contactName.trim(),
          phone: `${phoneRegion.code}${phoneDigits}`,
          city,
          company_type: companyTypes[0] || '',
          establishment_year: establishmentYear ? Number(establishmentYear) : null,
          description: '',
          services: ['Interior Design'],
        }).catch(() => {});
      }
      router.push('/company/dashboard');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Invalid email or password.';
      setLoginError(message);
    } finally {
      setLoginSubmitting(false);
    }
  };

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
      setRegIsNewEmail(true);
      setRegStep('password');
    } finally {
      setRegSubmitting(false);
    }
  };

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
      company_type: companyTypes[0] || '',
      establishment_year: establishmentYear ? Number(establishmentYear) : null,
      signup_source: source,
    };

    try {
      if (regIsNewEmail) {
        await api.post('/auth/register', {
          email: regEmail.trim(),
          password: regPassword,
          full_name: contactName.trim(),
          phone: `${phoneRegion.code}${phoneDigits}`,
          city,
          role: 'company',
          signup_source: source,
          pending_profile: profileData,
        });

        try {
          const loginRes = await api.post('/auth/login', { email: regEmail.trim(), password: regPassword });
          api.setToken(loginRes.token);
          if (loginRes.user && typeof localStorage !== 'undefined') {
            localStorage.setItem('user', JSON.stringify(loginRes.user));
            localStorage.setItem('active_role', 'company');
          }
          await api.post('/auth/company/profile', profileData);
          router.push('/company');
          return;
        } catch {
          if (typeof sessionStorage !== 'undefined') {
            sessionStorage.setItem('pending_company_profile', JSON.stringify(profileData));
          }
          setRegSuccess(
            lang === 'ar'
              ? `تم إنشاء الحساب! يرجى التحقق من ${regEmail.trim()} ثم تسجيل الدخول.`
              : `Account created! Please check ${regEmail.trim()} to verify your email, then sign in.`
          );
        }
      } else {
        const loginRes = await api.post('/auth/login', { email: regEmail.trim(), password: regPassword });
        api.setToken(loginRes.token);
        if (loginRes.user && typeof localStorage !== 'undefined') {
          localStorage.setItem('user', JSON.stringify(loginRes.user));
          localStorage.setItem('active_role', 'company');
        }
        await api.post('/auth/company/profile', profileData).catch(() => {});
        router.push('/company');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '';
      if (regIsNewEmail && /already registered/i.test(msg)) {
        setRegIsNewEmail(false);
        setRegPassword('');
        setRegError(lang === 'ar' ? 'هذا البريد مسجّل بالفعل. أدخل كلمة المرور لتسجيل الدخول.' : 'This email already has an account. Enter your password to sign in.');
      } else {
        setRegError(msg || (regIsNewEmail ? 'Registration failed.' : 'Invalid email or password.'));
      }
    } finally {
      setRegSubmitting(false);
    }
  };

  return (
    <div
      dir={dir}
      className="bg-white rounded-[20px] shadow-[0_18px_44px_rgba(28,25,23,0.14)] overflow-hidden"
    >
      <div className="px-7 py-7 space-y-5">
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
                <div className="flex items-start gap-3 rounded-2xl bg-emerald-50 border border-emerald-200 px-4 py-3">
                  <svg className="w-5 h-5 text-emerald-500 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                  <div>
                    <p className="text-[14px] font-semibold text-emerald-800">
                      {lang === 'ar' ? 'تم استلام معلوماتك بنجاح!' : 'Your information has been received!'}
                    </p>
                    <p className="text-[13px] text-emerald-700/80 mt-0.5 leading-relaxed">
                      {lang === 'ar'
                        ? 'سيتواصل معك فريقنا قريبًا. في الأثناء، أنشئ حسابك لإدارة صفحة شركتك.'
                        : 'Our team will be in touch shortly. Meanwhile, create your account to start managing your company page.'}
                    </p>
                  </div>
                </div>

                <h2 className="text-[18px] font-bold text-[#1c1917] leading-snug">
                  {lang === 'ar' ? 'إنشاء حسابك' : 'Create your account'}
                </h2>

                <button
                  type="button"
                  onClick={() => {
                    if (typeof sessionStorage !== 'undefined') {
                      sessionStorage.setItem('pending_company_profile', JSON.stringify({
                        company_name: companyName.trim(),
                        contact_person: contactName.trim(),
                        phone: `${phoneRegion.code}${phoneDigits}`,
                        city,
                        company_type: companyTypes[0] || '',
                        establishment_year: establishmentYear || null,
                        services: ['Interior Design'],
                        signup_source: 'for-companies-landing',
                      }));
                    }
                    const phoneFull = encodeURIComponent(`${phoneRegion.code}${phoneDigits}`);
                    window.location.href = `${API_BASE}/auth/google?role=company&phone=${phoneFull}&source=company_form`;
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

                <div className="relative my-2">
                  <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-stone-200" /></div>
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
                      checkPhoneDebounced(digits, phoneRegion.code);
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
                {phoneAlreadySubmitted && !phoneError && (
                  <div className="mt-2 flex items-start gap-2.5 rounded-xl bg-emerald-50 border border-emerald-200 px-3.5 py-2.5">
                    <svg className="w-4 h-4 text-emerald-500 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                    <p className="text-[13px] text-emerald-800 leading-relaxed">
                      {phoneCheckResult?.hasAccount
                        ? (lang === 'ar' ? 'هذا الرقم مسجّل بالفعل. سجّل الدخول للوصول إلى لوحة التحكم.' : 'This number is already registered. Sign in to access your dashboard.')
                        : (lang === 'ar' ? 'معلوماتك موجودة لدينا بالفعل! سجّل حسابك لإدارة صفحة شركتك.' : 'Your info is already in our system! Register an account to manage your company page.')}
                    </p>
                  </div>
                )}
              </div>

              <div className={phoneAlreadySubmitted ? 'opacity-40 pointer-events-none' : ''}>
                <label className={labelClass}>
                  {t(lang, 'companyName')} <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  placeholder={t(lang, 'companyNamePlaceholder')}
                  disabled={phoneAlreadySubmitted}
                  className={`${inputClass} ${tried && !companyName.trim() ? 'border-red-400 focus:border-red-400 focus:ring-red-200/30' : ''}`}
                />
              </div>

              <div className={phoneAlreadySubmitted ? 'opacity-40 pointer-events-none' : ''}>
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

              <div className={phoneAlreadySubmitted ? 'opacity-40 pointer-events-none' : ''}>
                <label className={labelClass}>
                  {t(lang, 'companyType')} <span className="text-red-500">*</span>
                </label>

                {/* Multi-select dropdown */}
                <div ref={companyTypeDropdownRef} className="relative">
                  {/* Trigger button */}
                  <button
                    type="button"
                    onClick={() => setCompanyTypeDropdownOpen(o => !o)}
                    className={`flex items-center justify-between w-full h-[50px] px-5 rounded-2xl border bg-stone-50/80 text-left transition focus:outline-none focus:ring-2 focus:ring-[#B8864A]/15 focus:border-[#B8864A] focus:bg-white ${
                      (companyTypeError || (tried && companyTypes.length === 0))
                        ? 'border-red-400 ring-2 ring-red-200/30'
                        : 'border-stone-200'
                    }`}
                  >
                    {companyTypes.length === 0 ? (
                      <span className="text-[15px] text-stone-400 truncate">{t(lang, 'companyTypeSelectPrompt')}</span>
                    ) : (
                      <span className="flex flex-wrap gap-1 flex-1 min-w-0 overflow-hidden">
                        {companyTypes.map(v => {
                          const ct = COMPANY_TYPES.find(c => c.value === v);
                          return ct ? (
                            <span
                              key={v}
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#b8864a]/10 text-[#b8864a] text-[12px] font-medium leading-none"
                            >
                              {t(lang, ct.labelKey)}
                              <span
                                role="button"
                                tabIndex={0}
                                aria-label="Remove"
                                onMouseDown={(e) => {
                                  e.stopPropagation();
                                  setCompanyTypes(prev => prev.filter(x => x !== v));
                                }}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter' || e.key === ' ') {
                                    e.stopPropagation();
                                    setCompanyTypes(prev => prev.filter(x => x !== v));
                                  }
                                }}
                                className="cursor-pointer text-[#b8864a]/60 hover:text-[#b8864a] leading-none"
                              >
                                ×
                              </span>
                            </span>
                          ) : null;
                        })}
                      </span>
                    )}
                    <span className="flex items-center gap-1.5 ml-2 flex-shrink-0">
                      {companyTypes.length > 0 && (
                        <span className="text-[11px] text-[#b8864a] font-medium whitespace-nowrap">
                          {companyTypes.length}/{MAX_COMPANY_TYPES}
                        </span>
                      )}
                      <svg className={`w-4 h-4 text-stone-400 transition-transform ${companyTypeDropdownOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </span>
                  </button>

                  {/* Dropdown panel */}
                  {companyTypeDropdownOpen && (
                    <div className="absolute z-50 mt-1 w-full bg-white border border-stone-200 rounded-2xl shadow-lg overflow-hidden">
                      {/* Search */}
                      <div className="px-3 py-2.5 border-b border-stone-100">
                        <div className="relative">
                          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-stone-400 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                            <circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/>
                          </svg>
                          <input
                            ref={companyTypeSearchRef}
                            type="text"
                            value={companyTypeSearch}
                            onChange={e => setCompanyTypeSearch(e.target.value)}
                            placeholder={lang === 'ar' ? 'بحث…' : 'Search…'}
                            className="w-full h-9 pl-8 pr-3 text-sm border border-stone-200 rounded-xl bg-stone-50 focus:outline-none focus:border-[#b8864a] focus:bg-white transition"
                          />
                        </div>
                        {companyTypes.length >= MAX_COMPANY_TYPES && (
                          <p className="text-[11px] text-amber-600 mt-1.5 text-center">{t(lang, 'companyTypeMaxReached')}</p>
                        )}
                      </div>
                      {/* Options list */}
                      <ul className="overflow-y-auto max-h-52">
                        {(() => {
                          const q = companyTypeSearch.toLowerCase();
                          const filtered = q
                            ? COMPANY_TYPES.filter(ct => t(lang, ct.labelKey).toLowerCase().includes(q))
                            : COMPANY_TYPES;
                          if (filtered.length === 0) {
                            return <li className="px-5 py-3 text-sm text-stone-400 text-center">{t(lang, 'companyTypeNoResults')}</li>;
                          }
                          return filtered.map(ct => {
                            const isSelected = companyTypes.includes(ct.value);
                            const isDisabled = !isSelected && companyTypes.length >= MAX_COMPANY_TYPES;
                            return (
                              <li key={ct.value}>
                                <button
                                  type="button"
                                  disabled={isDisabled}
                                  onClick={() => {
                                    if (isSelected) {
                                      setCompanyTypes(prev => prev.filter(v => v !== ct.value));
                                    } else {
                                      setCompanyTypes(prev => [...prev, ct.value]);
                                      setCompanyTypeError(false);
                                    }
                                  }}
                                  className={`w-full flex items-center gap-3 px-5 py-3 text-[14px] text-left transition ${
                                    isDisabled
                                      ? 'opacity-40 cursor-not-allowed'
                                      : 'hover:bg-stone-50 cursor-pointer'
                                  } ${isSelected ? 'text-[#b8864a] bg-[#b8864a]/5' : 'text-[#1c1917]'}`}
                                >
                                  {/* Checkbox */}
                                  <span className={`flex-shrink-0 w-4 h-4 rounded border flex items-center justify-center transition ${
                                    isSelected
                                      ? 'bg-[#b8864a] border-[#b8864a]'
                                      : 'border-stone-300 bg-white'
                                  }`}>
                                    {isSelected && (
                                      <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={3}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/>
                                      </svg>
                                    )}
                                  </span>
                                  {t(lang, ct.labelKey)}
                                </button>
                              </li>
                            );
                          });
                        })()}
                      </ul>
                    </div>
                  )}
                </div>

                {(companyTypeError || (tried && companyTypes.length === 0)) && (
                  <p className="mt-1.5 text-[12px] text-red-500">
                    {lang === 'ar' ? 'يرجى اختيار نوع الشركة' : 'Please select at least one company type'}
                  </p>
                )}
              </div>

              <div className={phoneAlreadySubmitted ? 'opacity-40 pointer-events-none' : ''}>
                <label className={labelClass}>{t(lang, 'yearEstablished')}</label>
                <AdminSelect
                  value={establishmentYear}
                  onChange={setEstablishmentYear}
                  options={[
                    { value: '', label: t(lang, 'yearSelectPrompt') },
                    ...Array.from({ length: new Date().getFullYear() - 1969 }, (_, i) => {
                      const yr = String(new Date().getFullYear() - i);
                      return { value: yr, label: yr };
                    }),
                  ]}
                  className="w-full"
                  disabled={phoneAlreadySubmitted}
                />
              </div>

              {error && (
                <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[12px] leading-5 text-red-700">
                  {error}
                </p>
              )}

              {phoneAlreadySubmitted ? (
                <button
                  type="button"
                  onClick={() => {
                    if (phoneCheckResult?.hasAccount) {
                      router.push('/auth?mode=login&role=company');
                    } else {
                      setRegisterMode(true);
                    }
                  }}
                  className="flex h-12 w-full items-center justify-center gap-2 rounded-[20px] bg-[#B8864A] text-[15px] font-semibold text-white shadow-[0_16px_28px_rgba(184,134,74,0.22)] transition hover:bg-[#a67c47]"
                >
                  {phoneCheckResult?.hasAccount
                    ? (lang === 'ar' ? 'تسجيل الدخول →' : 'Sign In →')
                    : (lang === 'ar' ? 'إنشاء حساب →' : 'Create Account →')}
                </button>
              ) : (
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
              )}
            </form>
          </>
        )}
      </div>
    </div>
  );
}
