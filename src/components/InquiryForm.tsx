import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronDown, Phone, Send, User, MessageSquare } from 'lucide-react';
import { trackContact, trackLead } from '../lib/analytics';
import { validatePhone, isPhoneComplete } from '../lib/phoneValidation';

const API_BASE = import.meta.env.VITE_API_URL?.trim() || '/api';

const GCC_CODES = ['+971', '+966', '+974', '+965', '+968', '+973'] as const;

/** Parse a full phone string like "+971 50 123 4567" into { code, digits }. */
function parsePhone(raw: string): { code: string; digits: string } | null {
  const stripped = raw.replace(/[\s\-()]/g, '');
  for (const code of GCC_CODES) {
    if (stripped.startsWith(code)) {
      return { code, digits: stripped.slice(code.length) };
    }
  }
  return null;
}

const UAE_CITIES = ['Dubai', 'Abu Dhabi', 'Sharjah', 'Ajman', 'Ras Al Khaimah', 'Fujairah', 'Umm Al Quwain'];
const AREA_RANGES = [
  { label: '< 50m\u00B2', value: '< 50m\u00B2' },
  { label: '50-100m\u00B2', value: '50-100m\u00B2' },
  { label: '100-200m\u00B2', value: '100-200m\u00B2' },
  { label: '200-500m\u00B2', value: '200-500m\u00B2' },
  { label: '500m\u00B2+', value: '500m\u00B2+' },
];

interface InquiryFormProps {
  companyId?: number | string;
  recipientName?: string;
}

export default function InquiryForm({ companyId, recipientName = 'our team' }: InquiryFormProps) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [city, setCity] = useState('');
  const [areaRange, setAreaRange] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  const parsed = parsePhone(phone);
  const phoneError = parsed && isPhoneComplete(parsed.digits, parsed.code)
    ? validatePhone(parsed.digits, parsed.code)
    : null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !phone || !city || !areaRange) return;
    if (phoneError) {
      setError(phoneError);
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      const res = await fetch(`${API_BASE}/inquiries`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          phone,
          city,
          area_range: areaRange,
          message: message || undefined,
          company_id: companyId || undefined,
          source_page: window.location.pathname,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to submit');
      }

      setSubmitted(true);
      trackContact({ content_name: recipientName || 'Unknown' });
      trackLead({ content_name: recipientName || 'Unknown', content_id: String(companyId || '') });
    } catch (err: any) {
      setError(err.message || 'Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="bg-white rounded-2xl border border-stone-100 p-6 text-center">
        <div className="w-14 h-14 rounded-full bg-green-50 flex items-center justify-center mx-auto mb-4">
          <Send className="w-6 h-6 text-green-600" />
        </div>
        <h3 className="font-serif text-lg font-semibold text-[#1c1917] mb-2">Request Sent</h3>
        <p className="text-sm text-stone-500 leading-relaxed">
          Thank you! {recipientName} will get back to you shortly.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-stone-100 overflow-hidden">
      <div className="bg-[#1c1917] px-6 py-5">
        <h3 className="font-serif text-lg text-white font-medium">Request a Consultation</h3>
        <p className="text-white/60 text-sm mt-1">Tell us about your project</p>
      </div>

      <form onSubmit={handleSubmit} className="p-6 space-y-4">
        {/* Name */}
        <div>
          <label className="block text-xs font-medium text-stone-500 uppercase tracking-wider mb-1.5">Name</label>
          <div className="relative">
            <User className="w-4 h-4 text-stone-400 absolute left-4 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              placeholder="Your name"
              className="w-full h-11 pl-11 pr-4 bg-stone-50 border border-stone-200 rounded-xl text-sm text-[#1c1917] placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-[#c6a065]/30 focus:border-[#c6a065] transition"
            />
          </div>
        </div>

        {/* Phone */}
        <div>
          <label className="block text-xs font-medium text-stone-500 uppercase tracking-wider mb-1.5">Phone Number</label>
          <div className="relative">
            <Phone className="w-4 h-4 text-stone-400 absolute left-4 top-1/2 -translate-y-1/2" />
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              required
              placeholder="+971 50 123 4567"
              className={`w-full h-11 pl-11 pr-4 bg-stone-50 border ${phoneError ? 'border-red-300' : 'border-stone-200'} rounded-xl text-sm text-[#1c1917] placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-[#c6a065]/30 focus:border-[#c6a065] transition`}
            />
          </div>
          {phoneError && <p className="text-[12px] text-red-600 mt-1.5">{phoneError}</p>}
        </div>

        {/* City */}
        <div>
          <label className="block text-xs font-medium text-stone-500 uppercase tracking-wider mb-1.5">City</label>
          <div className="relative">
            <select
              value={city}
              onChange={(e) => setCity(e.target.value)}
              required
              className="w-full appearance-none h-11 px-4 pr-10 bg-stone-50 border border-stone-200 rounded-xl text-sm text-[#1c1917] focus:outline-none focus:ring-2 focus:ring-[#c6a065]/30 focus:border-[#c6a065] transition"
            >
              <option value="">Select city</option>
              {UAE_CITIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
            <ChevronDown className="w-4 h-4 text-stone-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
        </div>

        {/* Area Range */}
        <div>
          <label className="block text-xs font-medium text-stone-500 uppercase tracking-wider mb-1.5">Project Area</label>
          <div className="relative">
            <select
              value={areaRange}
              onChange={(e) => setAreaRange(e.target.value)}
              required
              className="w-full appearance-none h-11 px-4 pr-10 bg-stone-50 border border-stone-200 rounded-xl text-sm text-[#1c1917] focus:outline-none focus:ring-2 focus:ring-[#c6a065]/30 focus:border-[#c6a065] transition"
            >
              <option value="">Select area range</option>
              {AREA_RANGES.map((r) => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </select>
            <ChevronDown className="w-4 h-4 text-stone-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
        </div>

        {/* Message (optional) */}
        <div>
          <label className="block text-xs font-medium text-stone-500 uppercase tracking-wider mb-1.5">
            Message <span className="text-stone-400 normal-case">(optional)</span>
          </label>
          <div className="relative">
            <MessageSquare className="w-4 h-4 text-stone-400 absolute left-4 top-3" />
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Describe your project..."
              rows={3}
              className="w-full pl-11 pr-4 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-sm text-[#1c1917] placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-[#c6a065]/30 focus:border-[#c6a065] transition resize-none"
            />
          </div>
        </div>

        {error && (
          <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>
        )}

        {/* Submit */}
        <button
          type="submit"
          disabled={submitting || !name || !phone || !city || !areaRange}
          className="w-full h-12 rounded-xl bg-[#c6a065] text-white font-semibold text-sm hover:bg-[#b8860b] disabled:opacity-50 disabled:cursor-not-allowed transition flex items-center justify-center gap-2"
        >
          {submitting ? (
            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            <>
              <Send className="w-4 h-4" />
              Request Consultation
            </>
          )}
        </button>

        <p className="text-[11px] text-stone-400 text-center leading-relaxed">
          By submitting, you agree to our <Link to="/privacy" className="underline hover:text-stone-600">Privacy Policy</Link>
        </p>
      </form>
    </div>
  );
}
