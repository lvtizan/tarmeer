import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { safeRemoveItem } from '../lib/storage';

const GCC_PHONE_OPTIONS = [
  { label: 'UAE', code: '+971', maxDigits: 9 },
  { label: 'KSA', code: '+966', maxDigits: 9 },
  { label: 'Qatar', code: '+974', maxDigits: 8 },
  { label: 'Kuwait', code: '+965', maxDigits: 8 },
  { label: 'Oman', code: '+968', maxDigits: 8 },
  { label: 'Bahrain', code: '+973', maxDigits: 8 },
];

export default function PhoneRequiredModal() {
  const navigate = useNavigate();
  const [visible, setVisible] = useState(false);
  const [country, setCountry] = useState(GCC_PHONE_OPTIONS[0]);
  const [digits, setDigits] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    // Check localStorage user for phone
    try {
      const raw = localStorage.getItem('user');
      if (raw) {
        const user = JSON.parse(raw);
        if (!user.phone) {
          setVisible(true);
        }
      }
    } catch {
      // If parsing fails, do nothing
    }
  }, []);

  // Block escape key
  useEffect(() => {
    if (!visible) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') e.preventDefault();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [visible]);

  if (!visible) return null;

  const isValid = digits.length === country.maxDigits;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isValid) {
      setError(`Phone number must be exactly ${country.maxDigits} digits for ${country.label}.`);
      return;
    }

    setLoading(true);
    setError('');

    try {
      const phone = `${country.code}${digits}`;
      const res = await api.updateProfile({ phone });

      // Update localStorage with the returned user data
      if (res.user) {
        localStorage.setItem('user', JSON.stringify(res.user));
      } else {
        // Fallback: patch existing user object
        try {
          const raw = localStorage.getItem('user');
          if (raw) {
            const user = JSON.parse(raw);
            user.phone = phone;
            localStorage.setItem('user', JSON.stringify(user));
          }
        } catch { /* ignore */ }
      }

      // Notify other components (e.g. profile pages) that phone was saved
      window.dispatchEvent(new CustomEvent('phone-saved', { detail: { phone } }));

      setVisible(false);
    } catch (err: any) {
      const message = err?.message || 'Failed to update phone number. Please try again.';
      if (/invalid authentication token|not authenticated|unauthorized/i.test(message)) {
        api.clearToken();
        safeRemoveItem('user');
        safeRemoveItem('active_role');
        setVisible(false);
        navigate('/auth', { replace: true });
        return;
      }
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  function handleDigitsChange(val: string) {
    // Only allow digits, enforce max length
    const cleaned = val.replace(/\D/g, '').slice(0, country.maxDigits);
    setDigits(cleaned);
    if (error) setError('');
  }

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50">
      <div className="w-full max-w-md mx-4 bg-white rounded-2xl shadow-xl p-8">
        <h2 className="text-xl font-bold text-[#2c2c2c] mb-2">
          Phone Number Required
        </h2>
        <p className="text-[15px] text-[#6b6b6b] mb-6">
          Please provide your phone number to continue using the dashboard.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-sm font-medium text-stone-500 block mb-1.5">
              Phone Number
            </label>
            <div className="flex gap-2">
              {/* Country code selector */}
              <select
                value={country.code}
                onChange={(e) => {
                  const found = GCC_PHONE_OPTIONS.find(o => o.code === e.target.value);
                  if (found) {
                    setCountry(found);
                    setDigits('');
                    setError('');
                  }
                }}
                className="h-[50px] px-3 rounded-2xl border border-stone-200 bg-stone-50/80 text-[15px] text-[#1c1917] focus:outline-none focus:ring-2 focus:ring-[#B8864A]/15 focus:border-[#B8864A] focus:bg-white appearance-none cursor-pointer"
              >
                {GCC_PHONE_OPTIONS.map(opt => (
                  <option key={opt.code} value={opt.code}>
                    {opt.label} {opt.code}
                  </option>
                ))}
              </select>

              {/* Phone digits input */}
              <input
                type="tel"
                inputMode="numeric"
                value={digits}
                onChange={(e) => handleDigitsChange(e.target.value)}
                placeholder={`${'0'.repeat(country.maxDigits)}`}
                className="flex-1 h-[50px] px-5 rounded-2xl border border-stone-200 bg-stone-50/80 text-[15px] text-[#1c1917] placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-[#B8864A]/15 focus:border-[#B8864A] focus:bg-white"
                autoFocus
              />
            </div>
            {error && (
              <p className="mt-1.5 text-sm text-red-600">{error}</p>
            )}
          </div>

          <button
            type="submit"
            disabled={loading || !isValid}
            className="btn-primary w-full disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Saving...' : 'Continue'}
          </button>
        </form>
      </div>
    </div>
  );
}
