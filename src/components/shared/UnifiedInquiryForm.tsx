'use client';

/**
 * UnifiedInquiryForm — shared inquiry form for company + expert detail pages.
 *
 * Two variants:
 *  - 'company': name + phone + city + area + (optional) message. Submits via
 *    api.post('/inquiries') with company_id and fires Meta contact/lead events.
 *    Preserves the existing company-page look exactly (live page, zero regression).
 *  - 'expert' : name + phone (country-code split + validation) + message. Submits
 *    via fetch('/api/inquiries') with expert_id. bg-white inputs + gold button.
 *
 * Replaces ServiceInquiryCard's detail-page usage and ExpertInquiryForm.
 */

import { useState } from 'react';
import { CheckCircle2 } from 'lucide-react';
import { api } from '../../lib/api';
import SelectField from '../form/SelectField';
import { trackContact, trackLead } from '../../lib/analytics';
import { validatePhone, isPhoneComplete, phoneDigitCount } from '../../lib/phoneValidation';

const UAE_CITIES = [
  'Dubai',
  'Abu Dhabi',
  'Sharjah',
  'Ajman',
  'Ras Al Khaimah',
  'Fujairah',
  'Umm Al Quwain',
];

const VN_CITIES = [
  'Hồ Chí Minh',
  'Hà Nội',
  'Đà Nẵng',
  'Bình Dương',
  'Đồng Nai',
  'Cần Thơ',
  'Hải Phòng',
  'Nha Trang',
];

interface UnifiedInquiryFormProps {
  variant: 'company' | 'expert';
  isVn?: boolean;

  // ── company variant ──
  /** Heading (company variant card). */
  title?: string;
  subtitle?: string;
  submitLabel?: string;
  className?: string;
  cardClassName?: string;
  /** Render bare form body (no card chrome). */
  inline?: boolean;
  /** Company ID (company_profiles). */
  companyId?: number;
  companyName?: string;
  companySlug?: string;
  /** Minimal company mode: only phone + area. */
  minimal?: boolean;

  // ── expert variant ──
  expertId?: number;
}

// ───────────────────────── company variant ─────────────────────────

function CompanyInquiryForm({
  isVn = false,
  title = '',
  subtitle = "Tell us about your project and we'll connect you.",
  submitLabel = 'Send Message',
  className = '',
  cardClassName = '',
  inline = false,
  companyId,
  companyName,
  companySlug,
  minimal = false,
}: UnifiedInquiryFormProps) {
  const CITIES = isVn ? VN_CITIES : UAE_CITIES;
  const [form, setForm] = useState({
    name: '',
    phone: '',
    city: '',
    areaSize: '',
    message: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  const canSubmit = minimal
    ? Boolean(form.phone && form.areaSize)
    : Boolean(form.name && form.phone && form.city && form.areaSize);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit || submitting) return;
    setSubmitting(true);
    setError('');
    try {
      await api.post('/inquiries', {
        name: form.name || undefined,
        phone: form.phone,
        city: form.city || undefined,
        area_range: `${Number(form.areaSize)}m²`,
        message: form.message || undefined,
        company_id: companyId || undefined,
        source_company_name: companyName || undefined,
        source_company_slug: companySlug || undefined,
        source_page: typeof window !== 'undefined' ? window.location.href : '',
      });
      setSubmitted(true);
      trackContact({ content_name: companyName || 'Service Page', content_id: companySlug || '' });
      trackLead({ content_name: companyName || 'Service Page', content_id: companySlug || '' });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to submit. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className={['w-full', className].filter(Boolean).join(' ')}>
        <div
          className={[
            inline ? '' : 'border border-stone-200 rounded-xl p-5 bg-white',
            cardClassName,
          ]
            .filter(Boolean)
            .join(' ')}
        >
          <div className="text-center py-4">
            <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-emerald-100 flex items-center justify-center">
              <svg
                className="w-6 h-6 text-emerald-600"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
            </div>
            <p className="text-sm font-semibold text-[#1c1917]">Message sent!</p>
            <p className="text-xs text-stone-500 mt-1">We&apos;ll get back to you soon.</p>
          </div>
        </div>
      </div>
    );
  }

  const inputCls =
    'h-12 w-full rounded-lg border border-stone-200 bg-white px-4 text-sm text-[#2c2c2c] focus:border-[#b8864a] focus:ring-2 focus:ring-[#b8864a]/40 outline-none transition-colors';

  const formContent = (
    <form className="space-y-3" onSubmit={handleSubmit}>
      {error && (
        <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>
      )}
      {!minimal && (
        <input
          type="text"
          placeholder="Your name"
          value={form.name}
          onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
          className={inputCls}
        />
      )}
      <input
        type="tel"
        placeholder="Phone number"
        value={form.phone}
        onChange={(e) => setForm((prev) => ({ ...prev, phone: e.target.value }))}
        className={inputCls}
      />
      {!minimal && (
        <SelectField
          value={form.city}
          onChange={(e) => setForm((prev) => ({ ...prev, city: e.target.value }))}
        >
          <option value="">{isVn ? 'Chọn thành phố' : 'Select city'}</option>
          {CITIES.map((city) => (
            <option key={city} value={city}>
              {city}
            </option>
          ))}
        </SelectField>
      )}
      <div className="relative">
        <input
          type="number"
          min={1}
          step={1}
          placeholder="Project area (m²)"
          value={form.areaSize}
          onChange={(e) => setForm((prev) => ({ ...prev, areaSize: e.target.value }))}
          className={inputCls + ' pr-12'}
        />
        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs text-stone-400 pointer-events-none">
          m²
        </span>
      </div>
      {!minimal && (
        <textarea
          placeholder="Message (optional)"
          rows={3}
          value={form.message}
          onChange={(e) => setForm((prev) => ({ ...prev, message: e.target.value }))}
          className="w-full rounded-lg border border-stone-200 bg-white px-4 py-3 text-sm text-[#2c2c2c] resize-none focus:border-[#b8864a] focus:ring-2 focus:ring-[#b8864a]/40 outline-none transition-colors"
        />
      )}
      <button
        type="submit"
        disabled={!canSubmit || submitting}
        className="w-full h-12 bg-[#b8864a] hover:bg-[#a07640] text-white text-sm font-semibold rounded-lg transition disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {submitting ? 'Sending...' : submitLabel}
      </button>
    </form>
  );

  return (
    <div className={['w-full', className].filter(Boolean).join(' ')}>
      {inline ? (
        <div className={cardClassName}>
          <p className="text-sm font-semibold text-[#1c1917] mb-1">{title}</p>
          <p className="text-xs text-stone-500 mb-4">{subtitle}</p>
          {formContent}
        </div>
      ) : (
        <div
          className={[
            'border border-stone-200 rounded-xl p-5 bg-white',
            cardClassName,
          ]
            .filter(Boolean)
            .join(' ')}
        >
          <p className="text-sm font-semibold text-[#1c1917] mb-1">{title}</p>
          <p className="text-xs text-stone-500 mb-4">{subtitle}</p>
          {formContent}
        </div>
      )}
    </div>
  );
}

// ───────────────────────── expert variant ─────────────────────────

function ExpertInquiryFormBody({
  expertId,
  isVn = false,
}: {
  expertId: number;
  isVn?: boolean;
}) {
  const countryCode = isVn ? '+84' : '+971';
  const [name, setName] = useState('');
  const [digits, setDigits] = useState('');
  const [message, setMessage] = useState('');
  const [touched, setTouched] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  const phoneError = touched ? validatePhone(digits, countryCode) : null;
  const phoneComplete = isPhoneComplete(digits, countryCode);
  const canSubmit = Boolean(
    name.trim() && message.trim() && phoneComplete && !validatePhone(digits, countryCode)
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit || submitting) return;
    setSubmitting(true);
    setError('');
    try {
      const res = await fetch('/api/inquiries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          phone: countryCode + digits,
          message: message.trim(),
          expert_id: expertId,
          area_range: 'N/A',
          source_page: typeof window !== 'undefined' ? window.location.href : '',
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(
          (data as { message?: string })?.message || `Request failed (${res.status})`
        );
      }
      setSubmitted(true);
    } catch (err: unknown) {
      setError(
        err instanceof Error && err.message
          ? err.message
          : isVn
          ? 'Gửi không thành công, vui lòng thử lại.'
          : 'Failed to submit. Please try again.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="text-center py-6">
        <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-emerald-100 flex items-center justify-center">
          <CheckCircle2 className="w-6 h-6 text-emerald-600" />
        </div>
        <p className="text-sm font-semibold text-[#1c1917]">
          {isVn ? 'Đã gửi tin nhắn!' : 'Message sent!'}
        </p>
        <p className="text-xs text-stone-500 mt-1">
          {isVn ? 'Chuyên gia sẽ liên hệ với bạn sớm.' : "We'll get back to you soon."}
        </p>
      </div>
    );
  }

  const inputCls =
    'h-11 w-full rounded-lg border border-stone-200 bg-white px-4 text-sm text-[#2c2c2c] placeholder:text-stone-400 focus:border-[#b8864a] focus:ring-2 focus:ring-[#b8864a]/30 outline-none transition-colors';

  return (
    <form className="space-y-3" onSubmit={handleSubmit}>
      {error && <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}
      <input
        type="text"
        placeholder={isVn ? 'Họ và tên' : 'Your name'}
        value={name}
        onChange={(e) => setName(e.target.value)}
        className={inputCls}
      />
      <div>
        <div
          className={`flex h-11 rounded-lg border bg-white overflow-hidden focus-within:ring-2 transition ${
            phoneError
              ? 'border-red-400 focus-within:border-red-400 focus-within:ring-red-400/20'
              : 'border-stone-200 focus-within:border-[#b8864a] focus-within:ring-[#b8864a]/30'
          }`}
        >
          <span className="flex items-center px-3 text-sm text-stone-500 border-r border-stone-200 bg-stone-50 shrink-0">
            {countryCode}
          </span>
          <input
            type="tel"
            placeholder={'0'.repeat(phoneDigitCount(countryCode))}
            value={digits}
            maxLength={phoneDigitCount(countryCode)}
            onChange={(e) => setDigits(e.target.value.replace(/[^0-9]/g, ''))}
            onBlur={() => setTouched(true)}
            className="flex-1 h-full px-3 bg-transparent text-sm text-[#2c2c2c] placeholder:text-stone-400 focus:outline-none min-w-0"
          />
        </div>
        {phoneError && <p className="text-xs text-red-500 mt-1.5">{phoneError}</p>}
      </div>
      <textarea
        placeholder={isVn ? 'Nội dung tin nhắn' : 'Your message'}
        rows={4}
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        className="w-full rounded-lg border border-stone-200 bg-white px-4 py-3 text-sm text-[#2c2c2c] placeholder:text-stone-400 resize-none focus:border-[#b8864a] focus:ring-2 focus:ring-[#b8864a]/30 outline-none transition-colors"
      />
      <button
        type="submit"
        disabled={!canSubmit || submitting}
        className="w-full h-11 bg-[#b8864a] hover:bg-[#a07640] text-white text-sm font-semibold rounded-lg transition disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {submitting
          ? isVn
            ? 'Đang gửi...'
            : 'Sending...'
          : isVn
          ? 'Gửi tin nhắn'
          : 'Send Message'}
      </button>
    </form>
  );
}

// ───────────────────────── dispatcher ─────────────────────────

export default function UnifiedInquiryForm(props: UnifiedInquiryFormProps) {
  if (props.variant === 'expert') {
    return <ExpertInquiryFormBody expertId={props.expertId as number} isVn={props.isVn} />;
  }
  return <CompanyInquiryForm {...props} />;
}
