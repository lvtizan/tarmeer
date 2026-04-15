import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { t, type Lang } from '../../i18n/forCompanies';
import AdminSelect from '../ui/AdminSelect';
import { validatePhone, isPhoneComplete } from '../../lib/phoneValidation';

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
  const [city, setCity] = useState('Dubai');

  // Phone validation
  const phoneError = isPhoneComplete(phoneDigits, phoneRegion.code)
    ? validatePhone(phoneDigits, phoneRegion.code)
    : null;

  // UI state
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

    if (phoneError) { setError(phoneError); return; }
    if (!isPhoneComplete(phoneDigits, phoneRegion.code)) { setError(lang === 'ar' ? 'يرجى إدخال رقم هاتف كامل' : 'Please enter a complete phone number'); return; }
    if (!companyType) { setError(lang === 'ar' ? 'يرجى اختيار نوع الشركة' : 'Please select a company type'); return; }

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

        <form onSubmit={handleFormSubmit} className="space-y-4">
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
                className={`${inputClass} flex-1 min-w-0 ${phoneError ? 'border-red-300 focus:border-red-400 focus:ring-red-200/30' : ''}`}
              />
            </div>
            {phoneError && (
              <p className="mt-1.5 text-[12px] text-red-600">{phoneError}</p>
            )}
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

          {/* Company Type */}
          <div>
            <label className={labelClass}>{t(lang, 'companyType')}</label>
            <AdminSelect
              value={companyType}
              onChange={setCompanyType}
              options={[
                { value: '', label: t(lang, 'companyTypePlaceholder') },
                ...COMPANY_TYPES.map(ct => ({ value: ct.value, label: t(lang, ct.labelKey) })),
              ]}
              className="w-full"
            />
          </div>

          {/* Year of Establishment */}
          <div>
            <label className={labelClass}>{t(lang, 'yearEstablished')}</label>
            <input
              type="number"
              min="1900"
              max="2026"
              value={establishmentYear}
              onChange={(e) => setEstablishmentYear(e.target.value)}
              placeholder={t(lang, 'yearPlaceholder')}
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
