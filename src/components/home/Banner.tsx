import { useState } from 'react';
import { trackContact, trackLead } from '../../lib/analytics';
import { validatePhone, isPhoneComplete } from '../../lib/phoneValidation';
import AdminSelect from '../ui/AdminSelect';

const GCC_PHONE_OPTIONS = [
  { label: 'UAE', code: '+971', maxDigits: 9 },
  { label: 'KSA', code: '+966', maxDigits: 9 },
  { label: 'Qatar', code: '+974', maxDigits: 8 },
  { label: 'Kuwait', code: '+965', maxDigits: 8 },
  { label: 'Oman', code: '+968', maxDigits: 8 },
  { label: 'Bahrain', code: '+973', maxDigits: 8 },
];

export default function Banner() {
  const [area, setArea] = useState('');
  const [phoneRegion, setPhoneRegion] = useState(GCC_PHONE_OPTIONS[0]);
  const [phone, setPhone] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const phoneError = isPhoneComplete(phone, phoneRegion.code)
    ? validatePhone(phone, phoneRegion.code)
    : null;

  const API_BASE = import.meta.env.VITE_API_URL?.trim() || '/api';

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    const numericArea = Number(area);
    if (!area || !Number.isFinite(numericArea) || numericArea <= 0) {
      setError('Area must be a valid number.');
      return;
    }

    if (phone.length !== phoneRegion.maxDigits) {
      setError(`Phone number must be exactly ${phoneRegion.maxDigits} digits for ${phoneRegion.label}.`);
      return;
    }

    if (phoneError) {
      setError(phoneError);
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch(`${API_BASE}/inquiries`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Website Visitor',
          phone: `${phoneRegion.code}${phone}`,
          city: 'Dubai',
          area_range: `${numericArea}m²`,
          message: `Quick booking from home banner. Area: ${numericArea}m².`,
        }),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error || 'Failed to submit booking request.');
      }

      setSuccess('Submitted successfully. Our team will contact you soon.');
      trackContact({ content_name: 'Homepage Banner' });
      trackLead({ content_name: 'Homepage Banner' });
      setArea('');
      setPhone('');
    } catch (submitError: any) {
      setError(submitError?.message || 'Failed to submit booking request.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section className="relative min-h-[420px] overflow-hidden py-8 sm:min-h-[500px] sm:py-10">
      <div
        className="absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{
          backgroundImage: 'url(/images/uae-companies/portfolio/hba-hirsch-bedner/general/6-medium.webp)',
        }}
      />
      <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(0,0,0,0.42)_0%,rgba(0,0,0,0.28)_38%,rgba(0,0,0,0.2)_100%)]" />

      <div className="relative z-10 mx-auto grid max-w-6xl items-center gap-8 px-4 sm:px-6 lg:grid-cols-[340px_1fr] lg:gap-16">
        <form
          onSubmit={handleSubmit}
          className="overflow-hidden rounded-[20px] border border-white/80 bg-white/94 shadow-[0_18px_44px_rgba(28,25,23,0.14)] backdrop-blur-sm"
        >
          <div className="space-y-3.5 px-6 py-5">
            <div>
              <h2 className="text-[22px] font-semibold tracking-tight text-[#1c1917]">Book a Design</h2>
            </div>

            <div className="rounded-[20px] border border-stone-200 bg-stone-50/70 px-4 py-3.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.65)]">
              <label className="mb-1 block text-[11px] font-medium uppercase tracking-[0.14em] text-stone-500">Area</label>
              <div className="flex items-center justify-between gap-4">
                <input
                  type="text"
                  inputMode="numeric"
                  value={area}
                  onChange={(event) => {
                    const digitsOnly = event.target.value.replace(/\D/g, '');
                    setArea(digitsOnly);
                  }}
                  className="w-full bg-transparent text-[1.65rem] font-semibold text-[#1c1917] outline-none placeholder:text-stone-300"
                  placeholder="Enter area"
                />
                <span className="shrink-0 text-2xl font-semibold text-stone-700">m²</span>
              </div>
            </div>

            <div className={`rounded-[20px] border ${phoneError ? 'border-red-300' : 'border-stone-200'} bg-stone-50/70 px-4 py-3.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.65)]`}>
              <label className="mb-1 block text-[11px] font-medium uppercase tracking-[0.14em] text-stone-500">Phone/WA Number</label>
              <div className="grid grid-cols-[112px_1fr] items-center gap-3">
                <AdminSelect
                  value={phoneRegion.code}
                  onChange={(val) => {
                    const nextRegion = GCC_PHONE_OPTIONS.find((option) => option.code === val) || GCC_PHONE_OPTIONS[0];
                    setPhoneRegion(nextRegion);
                    setPhone((current) => current.slice(0, nextRegion.maxDigits));
                  }}
                  options={GCC_PHONE_OPTIONS.map((option) => ({ value: option.code, label: `${option.label} ${option.code}` }))}
                  className="w-full"
                />
                <input
                  type="tel"
                  inputMode="numeric"
                  value={phone}
                  onChange={(event) => {
                    const digitsOnly = event.target.value.replace(/\D/g, '').slice(0, phoneRegion.maxDigits);
                    setPhone(digitsOnly);
                  }}
                  maxLength={phoneRegion.maxDigits}
                  className="min-w-0 w-full bg-transparent text-base font-medium text-[#1c1917] outline-none placeholder:text-stone-300"
                  placeholder={`Enter ${phoneRegion.maxDigits}-digit number`}
                />
              </div>
              {phoneError && <p className="text-[12px] text-red-600 mt-1.5">{phoneError}</p>}
            </div>

            {error && (
              <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[12px] leading-5 text-red-700">
                {error}
              </p>
            )}

            {success && (
              <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-[12px] leading-5 text-emerald-700">
                {success}
              </p>
            )}

            <p className="text-left text-[11px] leading-5 text-stone-500">
              Share your area and phone number. Our team will contact you to discuss a custom design brief and recommend the right studio.
            </p>

            <button
              type="submit"
              disabled={isSubmitting}
              className="flex h-12 w-full items-center justify-center rounded-[20px] bg-[#B8864A] text-lg font-semibold text-white shadow-[0_16px_28px_rgba(184,134,74,0.24)] transition hover:bg-[#a4763f]"
            >
              {isSubmitting ? 'Submitting...' : 'Book Now'}
            </button>
          </div>
        </form>

        <div className="max-w-2xl text-white lg:justify-self-end">
          <p className="mb-3 text-xs font-medium uppercase tracking-[0.32em] text-white/80">
            Tailored For UAE Homes
          </p>
          <h1 className="font-serif text-4xl font-semibold tracking-tight text-white sm:text-5xl md:text-[3.5rem]">
            Bespoke Design Services
            <br />
            for Villas, Apartments
            <br />
            and Signature Spaces
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-white/88 sm:text-lg">
            Connect with curated design partners for concept development, space planning, material direction and premium residential interiors across Dubai and the UAE.
          </p>
        </div>
      </div>
    </section>
  );
}
