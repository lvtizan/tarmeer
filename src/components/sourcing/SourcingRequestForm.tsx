'use client';

// 采购线索统一表单 — 四变体：sample(样品申请) / visit(到店预约) / sourcing(采购咨询) / designer_partner(设计师合作)
// 契约见 docs/plans/china-materials-revamp-spec.md §3.2。
// 表单配色铁律：输入框 bg-white；主按钮金色 bg-[#b8864a] hover:bg-[#a07640]，disabled 只降透明度。

import { useState } from 'react';
import { api } from '@/lib/api';
import { trackContact, trackLead } from '@/lib/analytics';
import { COUNTRY } from '@/lib/country';
import { validatePhone, isPhoneComplete, phoneDigitCount } from '@/lib/phoneValidation';

export type SourcingRequestVariant = 'sample' | 'visit' | 'sourcing' | 'designer_partner';

interface SourcingRequestFormProps {
  variant: SourcingRequestVariant;
  /** sample 变体必传：申请样品的产品 */
  productId?: number;
  productTitle?: string;
  supplierId?: number;
  title?: string;
  subtitle?: string;
  submitLabel?: string;
  className?: string;
  /** 无边框卡片模式（嵌入既有容器时用） */
  inline?: boolean;
}

const VARIANT_COPY: Record<SourcingRequestVariant, { title: string; subtitle: string; submitLabel: string; successTitle: string; successBody: string }> = {
  sample: {
    title: 'Request a Sample',
    subtitle: 'We deliver material samples across the UAE.',
    submitLabel: 'Request Sample',
    successTitle: 'Sample request received!',
    successBody: 'Our material consultant will contact you to arrange delivery.',
  },
  visit: {
    title: 'Book a Showroom Visit',
    subtitle: 'See the latest materials from China at our selection center.',
    submitLabel: 'Book a Visit',
    successTitle: 'Visit booked!',
    successBody: 'We will confirm your appointment shortly.',
  },
  sourcing: {
    title: 'Plan Your China Sourcing',
    subtitle: 'Tell us about your project and material needs.',
    submitLabel: 'Get Started',
    successTitle: 'Request received!',
    successBody: 'A sourcing specialist will reach out within one business day.',
  },
  designer_partner: {
    title: 'Become a Material Partner',
    subtitle: 'Trade pricing, exclusive first looks and sourcing support for designers.',
    submitLabel: 'Apply to Join',
    successTitle: 'Application received!',
    successBody: 'Our partnerships team will contact you soon.',
  },
};

const inputCls =
  'h-12 w-full rounded-lg border border-stone-200 bg-white px-4 text-sm text-[#2c2c2c] focus:border-[#b8864a] focus:ring-2 focus:ring-[#b8864a]/30 outline-none transition-colors placeholder:text-stone-400';

export default function SourcingRequestForm({
  variant,
  productId,
  productTitle,
  supplierId,
  title,
  subtitle,
  submitLabel,
  className = '',
  inline = false,
}: SourcingRequestFormProps) {
  const copy = VARIANT_COPY[variant];
  const cities = COUNTRY.ae.cities;
  // 手机号铁律：validatePhone + isPhoneComplete（页面为 AE 专属，固定 +971 前缀，对齐 UnifiedInquiryForm expert 变体）
  const phoneCode = COUNTRY.ae.phoneCode;
  const [form, setForm] = useState({
    name: '',
    phoneDigits: '',
    email: '',
    companyName: '',
    city: '',
    message: '',
    preferredDate: '',
  });
  const [phoneTouched, setPhoneTouched] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  const needsEmail = variant === 'designer_partner';
  const needsCompany = variant === 'designer_partner';
  const needsCity = variant === 'sample' || variant === 'sourcing';
  const needsDate = variant === 'visit';

  const phoneError = phoneTouched ? validatePhone(form.phoneDigits, phoneCode) : null;
  const phoneOk = isPhoneComplete(form.phoneDigits, phoneCode) && !validatePhone(form.phoneDigits, phoneCode);

  const canSubmit = Boolean(
    form.name.trim() &&
    phoneOk &&
    (!needsEmail || form.email.trim()) &&
    (!needsCompany || form.companyName.trim())
  );

  const set = (key: keyof typeof form) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => setForm((prev) => ({ ...prev, [key]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit || submitting) return;
    setSubmitting(true);
    setError('');
    try {
      await api.post('/sourcing-requests', {
        request_type: variant,
        name: form.name.trim(),
        phone: phoneCode + form.phoneDigits,
        email: form.email.trim() || undefined,
        company_name: form.companyName.trim() || undefined,
        city: form.city || undefined,
        message: form.message.trim() || undefined,
        preferred_date: form.preferredDate || undefined,
        product_id: productId || undefined,
        supplier_profile_id: supplierId || undefined,
        source_page: typeof window !== 'undefined' ? window.location.href : undefined,
      });
      setSubmitted(true);
      const content = productTitle || copy.title;
      trackContact({ content_name: content, content_id: String(productId ?? variant) });
      trackLead({ content_name: content, content_id: String(productId ?? variant) });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to submit. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const cardCls = inline ? '' : 'border border-stone-200 rounded-xl p-5 bg-white';

  if (submitted) {
    return (
      <div className={['w-full', className].filter(Boolean).join(' ')}>
        <div className={cardCls}>
          <div className="text-center py-4">
            <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-emerald-100 flex items-center justify-center">
              <svg className="w-6 h-6 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <p className="text-sm font-semibold text-[#1c1917]">{copy.successTitle}</p>
            <p className="text-xs text-stone-500 mt-1">{copy.successBody}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={['w-full', className].filter(Boolean).join(' ')}>
      <div className={cardCls}>
        <p className="text-sm font-semibold text-[#1c1917] mb-1">{title ?? copy.title}</p>
        <p className="text-xs text-stone-500 mb-4">{subtitle ?? copy.subtitle}</p>
        {variant === 'sample' && productTitle && (
          <p className="text-xs text-stone-600 bg-stone-50 border border-stone-100 rounded-lg px-3 py-2 mb-3">
            Sample: <span className="font-medium text-[#1c1917]">{productTitle}</span>
          </p>
        )}
        <form className="space-y-3" onSubmit={handleSubmit}>
          {error && <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}
          <input type="text" placeholder="Your name" value={form.name} onChange={set('name')} className={inputCls} />
          <div>
            <div className="flex gap-2">
              <span className="inline-flex items-center h-12 px-3 rounded-lg border border-stone-200 bg-stone-50 text-sm text-stone-500 shrink-0">
                {phoneCode}
              </span>
              <input
                type="tel"
                inputMode="numeric"
                placeholder={'0'.repeat(phoneDigitCount(phoneCode))}
                maxLength={phoneDigitCount(phoneCode)}
                value={form.phoneDigits}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, phoneDigits: e.target.value.replace(/\D/g, '') }))
                }
                onBlur={() => setPhoneTouched(true)}
                className={`${inputCls} ${phoneError ? 'border-red-300 focus:border-red-400 focus:ring-red-200' : ''}`}
              />
            </div>
            {phoneError && <p className="text-xs text-red-600 mt-1">{phoneError}</p>}
          </div>
          {needsEmail && (
            <input type="email" placeholder="Email" value={form.email} onChange={set('email')} className={inputCls} />
          )}
          {needsCompany && (
            <input
              type="text"
              placeholder="Studio / company name"
              value={form.companyName}
              onChange={set('companyName')}
              className={inputCls}
            />
          )}
          {needsCity && (
            <div className="relative">
              <select value={form.city} onChange={set('city')} className={`${inputCls} appearance-none cursor-pointer pr-10`}>
                <option value="">Select city (optional)</option>
                {cities.map((city) => (
                  <option key={city} value={city}>
                    {city}
                  </option>
                ))}
              </select>
              <svg
                className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#b8864a]"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          )}
          {needsDate && (
            <input
              type="date"
              value={form.preferredDate}
              onChange={set('preferredDate')}
              className={inputCls}
              min={new Date().toISOString().slice(0, 10)}
              aria-label="Preferred visit date"
            />
          )}
          <textarea
            placeholder={variant === 'designer_partner' ? 'Tell us about your studio & projects (optional)' : 'Message (optional)'}
            rows={3}
            value={form.message}
            onChange={set('message')}
            className="w-full rounded-lg border border-stone-200 bg-white px-4 py-3 text-sm text-[#2c2c2c] resize-none focus:border-[#b8864a] focus:ring-2 focus:ring-[#b8864a]/30 outline-none transition-colors placeholder:text-stone-400"
          />
          <button
            type="submit"
            disabled={!canSubmit || submitting}
            className="w-full h-12 bg-[#b8864a] hover:bg-[#a07640] text-white text-sm font-semibold rounded-lg transition disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {submitting ? 'Sending...' : submitLabel ?? copy.submitLabel}
          </button>
        </form>
      </div>
    </div>
  );
}
