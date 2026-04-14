import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { CheckCircle } from 'lucide-react';
import { t, type Lang } from '../../i18n/forCompanies';
import { api } from '../../lib/api';
import { MIN_PASSWORD_LENGTH } from '../../lib/constants';
import AdminSelect from '../ui/AdminSelect';

const GCC_PHONE_OPTIONS = [
  { label: 'UAE', code: '+971', maxDigits: 9 },
  { label: 'KSA', code: '+966', maxDigits: 9 },
  { label: 'Qatar', code: '+974', maxDigits: 8 },
  { label: 'Kuwait', code: '+965', maxDigits: 8 },
  { label: 'Oman', code: '+968', maxDigits: 8 },
  { label: 'Bahrain', code: '+973', maxDigits: 8 },
];

const UAE_CITIES = ['Dubai', 'Abu Dhabi', 'Sharjah', 'Ajman', 'Ras Al Khaimah', 'Fujairah', 'Umm Al Quwain'];

const API_BASE = import.meta.env.VITE_API_URL?.trim() || '/api';

type Step = 'form' | 'password' | 'done';

interface CompanySignupFormProps {
  lang: Lang;
}

export default function CompanySignupForm({ lang }: CompanySignupFormProps) {
  const navigate = useNavigate();

  // Form fields
  const [phoneRegion, setPhoneRegion] = useState(GCC_PHONE_OPTIONS[0]);
  const [phoneDigits, setPhoneDigits] = useState('');
  const [email, setEmail] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [city, setCity] = useState('Dubai');

  // Password step fields
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // UI state
  const [step, setStep] = useState<Step>('form');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dir = lang === 'ar' ? 'rtl' : 'ltr';

  const inputClass =
    'w-full h-[50px] px-5 rounded-2xl border border-stone-200 bg-stone-50/80 text-[15px] text-[#1c1917] placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-[#B8864A]/15 focus:border-[#B8864A] focus:bg-white transition';

  const labelClass = 'block text-xs font-medium uppercase tracking-wider text-stone-500 mb-1.5';

  /* ── Step 1: Submit lead to CRM ── */
  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!email.trim()) return;
    if (!phoneDigits.trim()) return;
    if (!companyName.trim()) return;

    setIsSubmitting(true);
    try {
      const res = await fetch(`${API_BASE}/company-leads`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contactName: '',
          phone: `${phoneRegion.code}${phoneDigits}`,
          companyName: companyName.trim(),
          city,
          email: email.trim(),
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || 'Failed to submit. Please try again.');
      }

      setStep('password');
    } catch (err: any) {
      setError(err?.message || 'Something went wrong. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  /* ── Step 2: Register + login + create company profile ── */
  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(t(lang, 'passwordTooShort'));
      return;
    }
    if (password !== confirmPassword) {
      setError(t(lang, 'passwordMismatch'));
      return;
    }

    setIsSubmitting(true);
    try {
      const phone = `${phoneRegion.code}${phoneDigits}`;

      // 1. Register
      await api.post('/auth/register', {
        email: email.trim(),
        password,
        full_name: '',
        phone,
        city,
        role: 'company',
      });

      // 2. Login
      const loginRes = await api.post('/auth/login', { email: email.trim(), password });
      api.setToken(loginRes.token);

      if (loginRes.user) {
        localStorage.setItem('user', JSON.stringify(loginRes.user));
        localStorage.setItem('active_role', 'company');
      }

      // 3. Create company profile
      await api.post('/auth/company/profile', {
        company_name: companyName.trim(),
        phone,
        city,
        contact_person: '',
        description: '',
        services: ['Interior Design'],
        company_type: 'renovation_company',
      });

      // 4. Navigate to company dashboard
      navigate('/company');
    } catch (err: any) {
      const msg = err?.message || '';
      if (msg.includes('already') || msg.includes('registered')) {
        setError(null); // clear generic, show special UI below
        setError(t(lang, 'emailAlreadyRegistered'));
      } else {
        setError(msg || 'Registration failed. Please try again.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  /* ── Password step UI ── */
  if (step === 'password') {
    const isEmailAlreadyRegistered = error === t(lang, 'emailAlreadyRegistered');

    return (
      <div
        dir={dir}
        className="bg-white rounded-[20px] shadow-[0_18px_44px_rgba(28,25,23,0.14)] overflow-hidden"
      >
        <div className="px-6 py-5 space-y-4">
          {/* Company name badge */}
          <div className="flex items-center gap-2 rounded-xl bg-stone-50 border border-stone-100 px-4 py-2.5">
            <CheckCircle className="w-5 h-5 text-emerald-500 shrink-0" />
            <span className="text-[15px] font-semibold text-[#1c1917] truncate">{companyName}</span>
          </div>

          <p className="text-[15px] text-[#2c2c2c] leading-relaxed">
            {t(lang, 'passwordStepTitle')}
          </p>

          <form onSubmit={handlePasswordSubmit} className="space-y-4" noValidate>
            {/* Password */}
            <div>
              <label className={labelClass}>{t(lang, 'passwordLabel')}</label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={t(lang, 'passwordPlaceholder')}
                className={inputClass}
                minLength={MIN_PASSWORD_LENGTH}
              />
            </div>

            {/* Confirm Password */}
            <div>
              <label className={labelClass}>{t(lang, 'confirmPasswordLabel')}</label>
              <input
                type="password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder={t(lang, 'confirmPasswordPlaceholder')}
                className={inputClass}
              />
            </div>

            {/* Error */}
            {error && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[12px] leading-5 text-red-700">
                {error}
                {isEmailAlreadyRegistered && (
                  <>
                    {' '}
                    <Link
                      to="/auth"
                      className="font-medium text-[#b8864a] hover:text-[#a67c47] underline underline-offset-2"
                    >
                      {t(lang, 'signInLink')}
                    </Link>
                  </>
                )}
              </div>
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
                  {t(lang, 'creatingPage')}
                </>
              ) : (
                t(lang, 'createMyPage')
              )}
            </button>
          </form>
        </div>
      </div>
    );
  }

  /* ── Main form UI ── */
  return (
    <div
      dir={dir}
      className="bg-white rounded-[20px] shadow-[0_18px_44px_rgba(28,25,23,0.14)] overflow-hidden"
    >
      <div className="px-6 py-5 space-y-4">
        <h2 className="text-[18px] font-bold text-[#1c1917] leading-snug">
          {t(lang, 'formTitle')}
        </h2>

        <form onSubmit={handleFormSubmit} className="space-y-4" noValidate>
          {/* Phone Number */}
          <div>
            <label className={labelClass}>{t(lang, 'phone')}</label>
            <div className="flex gap-2">
              <div className="relative shrink-0">
                <select
                  value={phoneRegion.code}
                  onChange={(e) => {
                    const next =
                      GCC_PHONE_OPTIONS.find((o) => o.code === e.target.value) ||
                      GCC_PHONE_OPTIONS[0];
                    setPhoneRegion(next);
                    setPhoneDigits((d) => d.slice(0, next.maxDigits));
                  }}
                  className="h-[50px] rounded-2xl border border-stone-200 bg-stone-50/80 pl-4 pr-9 text-[15px] font-medium text-[#1c1917] focus:outline-none focus:ring-2 focus:ring-[#B8864A]/15 focus:border-[#B8864A] focus:bg-white transition appearance-none"
                >
                  {GCC_PHONE_OPTIONS.map((o) => (
                    <option key={o.code} value={o.code}>
                      {o.label} {o.code}
                    </option>
                  ))}
                </select>
                <svg
                  className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path
                    fillRule="evenodd"
                    d="M5.22 8.22a.75.75 0 0 1 1.06 0L10 11.94l3.72-3.72a.75.75 0 1 1 1.06 1.06l-4.25 4.25a.75.75 0 0 1-1.06 0L5.22 9.28a.75.75 0 0 1 0-1.06z"
                    clipRule="evenodd"
                  />
                </svg>
              </div>
              <input
                type="tel"
                inputMode="numeric"
                required
                value={phoneDigits}
                onChange={(e) => {
                  const digits = e.target.value
                    .replace(/\D/g, '')
                    .slice(0, phoneRegion.maxDigits);
                  setPhoneDigits(digits);
                }}
                maxLength={phoneRegion.maxDigits}
                placeholder={t(lang, 'phonePlaceholder')}
                className={`${inputClass} flex-1 min-w-0`}
              />
            </div>
          </div>

          {/* Email */}
          <div>
            <label className={labelClass}>{t(lang, 'email')}</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t(lang, 'emailPlaceholder')}
              className={inputClass}
            />
          </div>

          {/* Company Name */}
          <div>
            <label className={labelClass}>{t(lang, 'companyName')}</label>
            <input
              type="text"
              required
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              placeholder={t(lang, 'companyNamePlaceholder')}
              className={inputClass}
            />
          </div>

          {/* City */}
          <div>
            <label className={labelClass}>{lang === 'ar' ? '\u0627\u0644\u0645\u062f\u064a\u0646\u0629' : 'City'}</label>
            <AdminSelect
              value={city}
              onChange={setCity}
              options={UAE_CITIES.map(c => ({ value: c, label: c }))}
              className="w-full"
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
      </div>
    </div>
  );
}
