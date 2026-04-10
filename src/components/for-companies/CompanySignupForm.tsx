import { useState } from 'react';
import { CheckCircle } from 'lucide-react';
import { t, type Lang } from '../../i18n/forCompanies';

const GCC_PHONE_OPTIONS = [
  { label: 'UAE', code: '+971', maxDigits: 9 },
  { label: 'KSA', code: '+966', maxDigits: 9 },
  { label: 'Qatar', code: '+974', maxDigits: 8 },
  { label: 'Kuwait', code: '+965', maxDigits: 8 },
  { label: 'Oman', code: '+968', maxDigits: 8 },
  { label: 'Bahrain', code: '+973', maxDigits: 8 },
];

const CURRENT_YEAR = new Date().getFullYear();
const YEAR_OPTIONS = Array.from(
  { length: CURRENT_YEAR - 1970 + 1 },
  (_, i) => CURRENT_YEAR - i,
);

const API_BASE = import.meta.env.VITE_API_URL?.trim() || '/api';

interface CompanySignupFormProps {
  lang: Lang;
}

export default function CompanySignupForm({ lang }: CompanySignupFormProps) {
  const [contactName, setContactName] = useState('');
  const [phoneRegion, setPhoneRegion] = useState(GCC_PHONE_OPTIONS[0]);
  const [phoneDigits, setPhoneDigits] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [yearEstablished, setYearEstablished] = useState('');
  const [scopeOfBusiness, setScopeOfBusiness] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dir = lang === 'ar' ? 'rtl' : 'ltr';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!contactName.trim()) return;
    if (!phoneDigits.trim()) return;
    if (!companyName.trim()) return;

    setIsSubmitting(true);
    try {
      const res = await fetch(`${API_BASE}/company-leads`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contactName: contactName.trim(),
          phone: `${phoneRegion.code}${phoneDigits}`,
          companyName: companyName.trim(),
          yearEstablished: yearEstablished || undefined,
          scopeOfBusiness: scopeOfBusiness.trim() || undefined,
          lang,
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || 'Failed to submit. Please try again.');
      }

      setSubmitted(true);
    } catch (err: any) {
      setError(err?.message || 'Something went wrong. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const inputClass =
    'w-full h-[50px] px-5 rounded-2xl border border-stone-200 bg-stone-50/80 text-[15px] text-[#1c1917] placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-[#B8864A]/15 focus:border-[#B8864A] focus:bg-white transition';

  const labelClass = 'block text-xs font-medium uppercase tracking-wider text-stone-500 mb-1.5';

  if (submitted) {
    return (
      <div
        dir={dir}
        className="bg-white rounded-[20px] shadow-[0_18px_44px_rgba(28,25,23,0.14)] px-6 py-10 flex flex-col items-center justify-center text-center min-h-[320px]"
      >
        <div className="w-14 h-14 rounded-full bg-emerald-50 flex items-center justify-center mb-4">
          <CheckCircle className="w-7 h-7 text-emerald-600" />
        </div>
        <p className="text-[15px] text-[#2c2c2c] leading-relaxed max-w-xs">
          {t(lang, 'successMessage')}
        </p>
      </div>
    );
  }

  return (
    <div
      dir={dir}
      className="bg-white rounded-[20px] shadow-[0_18px_44px_rgba(28,25,23,0.14)] overflow-hidden"
    >
      <div className="px-6 py-5 space-y-4">
        <h2 className="text-[18px] font-bold text-[#1c1917] leading-snug">
          {t(lang, 'formTitle')}
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          {/* Contact Name */}
          <div>
            <label className={labelClass}>{t(lang, 'contactName')}</label>
            <input
              type="text"
              required
              value={contactName}
              onChange={(e) => setContactName(e.target.value)}
              placeholder={t(lang, 'contactNamePlaceholder')}
              className={inputClass}
            />
          </div>

          {/* Phone Number */}
          <div>
            <label className={labelClass}>{t(lang, 'phone')}</label>
            <div className="flex gap-2">
              <select
                value={phoneRegion.code}
                onChange={(e) => {
                  const next =
                    GCC_PHONE_OPTIONS.find((o) => o.code === e.target.value) ||
                    GCC_PHONE_OPTIONS[0];
                  setPhoneRegion(next);
                  setPhoneDigits((d) => d.slice(0, next.maxDigits));
                }}
                className="h-[50px] rounded-2xl border border-stone-200 bg-stone-50/80 px-3 text-[15px] font-medium text-[#1c1917] focus:outline-none focus:ring-2 focus:ring-[#B8864A]/15 focus:border-[#B8864A] focus:bg-white transition shrink-0"
              >
                {GCC_PHONE_OPTIONS.map((o) => (
                  <option key={o.code} value={o.code}>
                    {o.label} {o.code}
                  </option>
                ))}
              </select>
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

          {/* Year of Establishment */}
          <div>
            <label className={labelClass}>{t(lang, 'yearEstablished')}</label>
            <div className="relative">
              <select
                value={yearEstablished}
                onChange={(e) => setYearEstablished(e.target.value)}
                className={`${inputClass} appearance-none pr-10`}
              >
                <option value="">{t(lang, 'yearPlaceholder')}</option>
                {YEAR_OPTIONS.map((year) => (
                  <option key={year} value={String(year)}>
                    {year}
                  </option>
                ))}
              </select>
              <svg
                className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400"
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
          </div>

          {/* Scope of Business */}
          <div>
            <label className={labelClass}>{t(lang, 'scopeOfBusiness')}</label>
            <input
              type="text"
              value={scopeOfBusiness}
              onChange={(e) => setScopeOfBusiness(e.target.value)}
              placeholder={t(lang, 'scopePlaceholder')}
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
      </div>
    </div>
  );
}
