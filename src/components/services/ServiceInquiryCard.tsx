import { useState } from 'react';
import SelectField from '../form/SelectField';

const UAE_CITIES = ['Dubai', 'Abu Dhabi', 'Sharjah', 'Ajman', 'Ras Al Khaimah', 'Fujairah', 'Umm Al Quwain'];
const AREA_SIZES = ['< 50 m²', '50 - 100 m²', '100 - 200 m²', '200 - 500 m²', '500 m²+'];

interface ServiceInquiryCardProps {
  title: string;
  subtitle?: string;
  submitLabel?: string;
  className?: string;
  cardClassName?: string;
  inline?: boolean;
}

export default function ServiceInquiryCard({
  title,
  subtitle = "Tell us about your project and we'll connect you.",
  submitLabel = 'Send Message',
  className = '',
  cardClassName = '',
  inline = false,
}: ServiceInquiryCardProps) {
  const [form, setForm] = useState({
    name: '',
    phone: '',
    city: '',
    areaSize: '',
    message: '',
  });

  const canSubmit = Boolean(form.name && form.phone && form.city && form.areaSize);

  return (
    <div className={['w-full', className].filter(Boolean).join(' ')}>
      {inline ? (
        <div className={cardClassName}>
          <p className="text-sm font-semibold text-[#1c1917] mb-1">{title}</p>
          <p className="text-xs text-stone-500 mb-4">{subtitle}</p>
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
            }}
          >
            <input
              type="text"
              placeholder="Your name"
              value={form.name}
              onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
              className="h-12 w-full rounded-lg border border-stone-200 bg-stone-50 px-4 text-sm text-[#2c2c2c] focus:border-[#b8864a] focus:ring-2 focus:ring-[#b8864a]/40 outline-none transition-colors"
            />
            <input
              type="tel"
              placeholder="Phone number"
              value={form.phone}
              onChange={(e) => setForm((prev) => ({ ...prev, phone: e.target.value }))}
              className="h-12 w-full rounded-lg border border-stone-200 bg-stone-50 px-4 text-sm text-[#2c2c2c] focus:border-[#b8864a] focus:ring-2 focus:ring-[#b8864a]/40 outline-none transition-colors"
            />
            <SelectField
              value={form.city}
              onChange={(e) => setForm((prev) => ({ ...prev, city: e.target.value }))}
            >
              <option value="">Select city</option>
              {UAE_CITIES.map((city) => (
                <option key={city} value={city}>{city}</option>
              ))}
            </SelectField>
            <SelectField
              value={form.areaSize}
              onChange={(e) => setForm((prev) => ({ ...prev, areaSize: e.target.value }))}
            >
              <option value="">Select area size</option>
              {AREA_SIZES.map((size) => (
                <option key={size} value={size}>{size}</option>
              ))}
            </SelectField>
            <textarea
              placeholder="Message (optional)"
              rows={3}
              value={form.message}
              onChange={(e) => setForm((prev) => ({ ...prev, message: e.target.value }))}
              className="w-full rounded-lg border border-stone-200 bg-stone-50 px-4 py-3 text-sm text-[#2c2c2c] resize-none focus:border-[#b8864a] focus:ring-2 focus:ring-[#b8864a]/40 outline-none transition-colors"
            />
            <button
              type="submit"
              disabled={!canSubmit}
              className="w-full h-12 bg-[#1c1917] hover:bg-[#b8864a] text-white text-sm font-semibold rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitLabel}
            </button>
          </form>
        </div>
      ) : (
        <div className={[
          'border border-stone-200 rounded-xl p-5 bg-white',
          cardClassName,
        ].filter(Boolean).join(' ')}>
          <p className="text-sm font-semibold text-[#1c1917] mb-1">{title}</p>
          <p className="text-xs text-stone-500 mb-4">{subtitle}</p>

          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
            }}
          >
            <input
              type="text"
              placeholder="Your name"
              value={form.name}
              onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
              className="h-12 w-full rounded-lg border border-stone-200 bg-stone-50 px-4 text-sm text-[#2c2c2c] focus:border-[#b8864a] focus:ring-2 focus:ring-[#b8864a]/40 outline-none transition-colors"
            />
            <input
              type="tel"
              placeholder="Phone number"
              value={form.phone}
              onChange={(e) => setForm((prev) => ({ ...prev, phone: e.target.value }))}
              className="h-12 w-full rounded-lg border border-stone-200 bg-stone-50 px-4 text-sm text-[#2c2c2c] focus:border-[#b8864a] focus:ring-2 focus:ring-[#b8864a]/40 outline-none transition-colors"
            />
            <SelectField
              value={form.city}
              onChange={(e) => setForm((prev) => ({ ...prev, city: e.target.value }))}
            >
              <option value="">Select city</option>
              {UAE_CITIES.map((city) => (
                <option key={city} value={city}>{city}</option>
              ))}
            </SelectField>
            <SelectField
              value={form.areaSize}
              onChange={(e) => setForm((prev) => ({ ...prev, areaSize: e.target.value }))}
            >
              <option value="">Select area size</option>
              {AREA_SIZES.map((size) => (
                <option key={size} value={size}>{size}</option>
              ))}
            </SelectField>
            <textarea
              placeholder="Message (optional)"
              rows={3}
              value={form.message}
              onChange={(e) => setForm((prev) => ({ ...prev, message: e.target.value }))}
              className="w-full rounded-lg border border-stone-200 bg-stone-50 px-4 py-3 text-sm text-[#2c2c2c] resize-none focus:border-[#b8864a] focus:ring-2 focus:ring-[#b8864a]/40 outline-none transition-colors"
            />
            <button
              type="submit"
              disabled={!canSubmit}
              className="w-full h-12 bg-[#1c1917] hover:bg-[#b8864a] text-white text-sm font-semibold rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitLabel}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
