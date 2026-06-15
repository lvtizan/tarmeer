'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { safeRemoveItem } from '@/lib/storage';
import { useSiteLocale } from '@/contexts/SiteLocaleContext';

const GCC_PHONE_OPTIONS = [
  { label: 'UAE', code: '+971', maxDigits: 9 },
  { label: 'KSA', code: '+966', maxDigits: 9 },
  { label: 'Qatar', code: '+974', maxDigits: 8 },
  { label: 'Kuwait', code: '+965', maxDigits: 8 },
  { label: 'Oman', code: '+968', maxDigits: 8 },
  { label: 'Bahrain', code: '+973', maxDigits: 8 },
];

export default function PhoneRequiredModal({ blocking = false }: { blocking?: boolean }) {
  const router = useRouter();
  const [visible, setVisible] = useState(false);
  const [checking, setChecking] = useState(blocking);
  const [country, setCountry] = useState(GCC_PHONE_OPTIONS[0]);
  const [digits, setDigits] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const tm = useSiteLocale().tr.modals;

  useEffect(() => {
    // Always verify with API — localStorage may be stale (e.g. after email verification auto-login)
    async function checkPhone() {
      try {
        const res = await api.get('/auth/me');
        if (res.user) {
          if (!res.user.phone) {
            setVisible(true);
          } else {
            // Backfill phone into localStorage if missing
            try {
              const raw = localStorage.getItem('user');
              if (raw) {
                const u = JSON.parse(raw);
                if (!u.phone) { u.phone = res.user.phone; localStorage.setItem('user', JSON.stringify(u)); }
              }
            } catch { /* ignore */ }
          }
        }
      } catch { /* not logged in, skip */ }
    }
    checkPhone().finally(() => setChecking(false));
  }, []);

  // Block escape key — MUST be before any early returns (React hooks rule)
  useEffect(() => {
    if (!visible) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') e.preventDefault();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [visible]);

  // In blocking mode, show loading while checking
  if (blocking && checking) {
    return (
      <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50">
        <div className="text-white text-lg">{tm.loading}</div>
      </div>
    );
  }

  if (!visible) return null;

  const isValid = digits.length === country.maxDigits;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isValid) {
      setError(tm.phoneDigitError(country.maxDigits, country.label));
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
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : tm.phoneUpdateFailed;
      if (/invalid authentication token|not authenticated|unauthorized/i.test(message)) {
        api.clearToken();
        safeRemoveItem('user');
        safeRemoveItem('active_role');
        setVisible(false);
        router.replace('/auth');
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
          {tm.phoneRequiredTitle}
        </h2>
        <p className="text-[15px] text-[#6b6b6b] mb-3">
          {tm.phoneRequiredDesc1}
        </p>
        <p className="text-[13px] text-stone-400 mb-6">
          {tm.phoneRequiredDesc2}
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-sm font-medium text-stone-500 block mb-1.5">
              {tm.phoneNumberLabel}
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
            {loading ? tm.saving : tm.continue}
          </button>
        </form>
      </div>
    </div>
  );
}
