import { useState } from 'react';
import { api } from '../../lib/api';
import SelectField from '../form/SelectField';
import { trackContact, trackLead } from '../../lib/analytics';

const UAE_CITIES = ['Dubai', 'Abu Dhabi', 'Sharjah', 'Ajman', 'Ras Al Khaimah', 'Fujairah', 'Umm Al Quwain'];
const AREA_SIZES = ['< 50 m²', '50 - 100 m²', '100 - 200 m²', '200 - 500 m²', '500 m²+'];

// Map display labels to DB-stored values
const AREA_SIZE_MAP: Record<string, string> = {
  '< 50 m²': '< 50m²',
  '50 - 100 m²': '50-100m²',
  '100 - 200 m²': '100-200m²',
  '200 - 500 m²': '200-500m²',
  '500 m²+': '500m²+',
};

interface ServiceInquiryCardProps {
  title: string;
  subtitle?: string;
  submitLabel?: string;
  className?: string;
  cardClassName?: string;
  inline?: boolean;
  /** Company ID (for company_profiles) */
  companyId?: number;
  /** Company name for source tracking (works for both directory and registered companies) */
  companyName?: string;
  /** Company slug/id for linking back to company page */
  companySlug?: string;
  /** Minimal mode: only phone + area (used on homepage) */
  minimal?: boolean;
}

export default function ServiceInquiryCard({
  title,
  subtitle = "Tell us about your project and we'll connect you.",
  submitLabel = 'Send Message',
  className = '',
  cardClassName = '',
  inline = false,
  companyId,
  companyName,
  companySlug,
  minimal = false,
}: ServiceInquiryCardProps) {
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
        area_range: AREA_SIZE_MAP[form.areaSize] || form.areaSize,
        message: form.message || undefined,
        company_id: companyId || undefined,
        source_company_name: companyName || undefined,
        source_company_slug: companySlug || undefined,
        source_page: window.location.pathname,
      });
      setSubmitted(true);
      trackContact({ content_name: companyName || 'Service Page', content_id: companySlug || '' });
      trackLead({ content_name: companyName || 'Service Page', content_id: companySlug || '' });
    } catch (err: any) {
      setError(err.message || 'Failed to submit. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className={['w-full', className].filter(Boolean).join(' ')}>
        <div className={[
          inline ? '' : 'border border-stone-200 rounded-xl p-5 bg-white',
          cardClassName,
        ].filter(Boolean).join(' ')}>
          <div className="text-center py-4">
            <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-emerald-100 flex items-center justify-center">
              <svg className="w-6 h-6 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
            </div>
            <p className="text-sm font-semibold text-[#1c1917]">Message sent!</p>
            <p className="text-xs text-stone-500 mt-1">We'll get back to you soon.</p>
          </div>
        </div>
      </div>
    );
  }

  const inputCls = "h-12 w-full rounded-lg border border-stone-200 bg-stone-50 px-4 text-sm text-[#2c2c2c] focus:border-[#b8864a] focus:ring-2 focus:ring-[#b8864a]/40 outline-none transition-colors";

  const formContent = (
    <form className="space-y-3" onSubmit={handleSubmit}>
      {error && (
        <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>
      )}
      {!minimal && (
        <input type="text" placeholder="Your name" value={form.name}
          onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
          className={inputCls} />
      )}
      <input type="tel" placeholder="Phone number" value={form.phone}
        onChange={(e) => setForm((prev) => ({ ...prev, phone: e.target.value }))}
        className={inputCls} />
      {!minimal && (
        <SelectField value={form.city} onChange={(e) => setForm((prev) => ({ ...prev, city: e.target.value }))}>
          <option value="">Select city</option>
          {UAE_CITIES.map((city) => (<option key={city} value={city}>{city}</option>))}
        </SelectField>
      )}
      <SelectField value={form.areaSize} onChange={(e) => setForm((prev) => ({ ...prev, areaSize: e.target.value }))}>
        <option value="">Select area size</option>
        {AREA_SIZES.map((size) => (<option key={size} value={size}>{size}</option>))}
      </SelectField>
      {!minimal && (
        <textarea placeholder="Message (optional)" rows={3} value={form.message}
          onChange={(e) => setForm((prev) => ({ ...prev, message: e.target.value }))}
          className="w-full rounded-lg border border-stone-200 bg-stone-50 px-4 py-3 text-sm text-[#2c2c2c] resize-none focus:border-[#b8864a] focus:ring-2 focus:ring-[#b8864a]/40 outline-none transition-colors" />
      )}
      <button type="submit" disabled={!canSubmit || submitting}
        className="w-full h-12 bg-[#1c1917] hover:bg-[#b8864a] text-white text-sm font-semibold rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed">
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
        <div className={[
          'border border-stone-200 rounded-xl p-5 bg-white',
          cardClassName,
        ].filter(Boolean).join(' ')}>
          <p className="text-sm font-semibold text-[#1c1917] mb-1">{title}</p>
          <p className="text-xs text-stone-500 mb-4">{subtitle}</p>
          {formContent}
        </div>
      )}
    </div>
  );
}
