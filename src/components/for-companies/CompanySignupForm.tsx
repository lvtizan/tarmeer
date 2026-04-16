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

      // Redirect to auth page with pre-filled data
      const params = new URLSearchParams({
        role: 'company',
        company_name: companyName.trim(),
        contact_person: contactName.trim(),
        phone: `${phoneRegion.code}${phoneDigits}`,
        city,
        company_type: companyType,
        ...(establishmentYear ? { establishment_year: establishmentYear } : {}),
      });
      navigate(`/join?${params.toString()}`);
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
        localStorage.setItem('active_role', response.user.active_role || 'company');
      }
      // If no existing profile, prefill data was saved; profile page will read it
      navigate(existingHasProfile ? '/company/dashboard' : '/company/profile');
    } catch (err: any) {
      setLoginError(err?.message || 'Invalid email or password.');
    } finally {
      setLoginSubmitting(false);
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
