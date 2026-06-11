'use client';

import { useState, useEffect } from 'react';
import { Camera, ChevronRight } from 'lucide-react';
import { api } from '@/lib/api';
import Avatar from '@/components/ui/Avatar';
import { useSiteLocale } from '@/contexts/SiteLocaleContext';
import { countryFromLang } from '@/lib/country';

interface UserData {
  full_name?: string;
  email?: string;
  phone?: string;
  city?: string;
}

export default function DashboardProfilePage() {
  const { lang } = useSiteLocale();
  const c = countryFromLang(lang);
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [city, setCity] = useState('');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  const fetchProfile = () => {
    api.getMe()
      .then((data) => {
        const u: UserData = data.user || {};
        setFullName(u.full_name || '');
        setPhone(u.phone || '');
        setCity(u.city || '');
        setEmail(u.email || '');
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchProfile();
  }, []);

  // Re-fetch profile when phone is saved via the forced modal
  useEffect(() => {
    const handler = () => fetchProfile();
    window.addEventListener('phone-saved', handler);
    return () => window.removeEventListener('phone-saved', handler);
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage('');
    try {
      const res = await api.updateProfile({ fullName, phone, city });
      // Keep localStorage in sync so PhoneRequiredModal won't re-trigger
      if (res.user) {
        localStorage.setItem('user', JSON.stringify(res.user));
      }
      setMessage('Profile updated successfully.');
    } catch (err: unknown) {
      setMessage(err instanceof Error ? err.message : 'Failed to update.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="py-20 text-center text-stone-400">Loading...</div>;
  }

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-6 flex items-center gap-2 text-sm text-stone-500">
        <span>Home</span>
        <ChevronRight className="h-4 w-4 text-stone-400" />
        <span className="font-medium text-stone-700">Profile</span>
      </div>

      <div className="mb-6">
        <h1 className="text-[2rem] font-bold tracking-tight text-stone-900">Profile</h1>
        <p className="mt-1 text-sm text-stone-500">
          Update your personal and professional information.
        </p>
      </div>

      <form onSubmit={handleSave} className="space-y-5">
        <section className="rounded-2xl border border-stone-200 bg-white p-5 shadow-[0_1px_2px_rgba(28,25,23,0.04)] md:p-6">
          <h2 className="text-xl font-semibold text-stone-900">Profile Photo</h2>
          <div className="mt-5 flex items-center gap-4 rounded-xl border border-stone-100 bg-stone-50/60 px-4 py-4">
            <div className="relative">
              <Avatar name={fullName || email || 'User'} size="xl" />
              <div className="absolute -bottom-1 -right-1 flex h-8 w-8 items-center justify-center rounded-full border-2 border-white bg-stone-900 text-white shadow-sm">
                <Camera className="h-4 w-4" strokeWidth={1.7} />
              </div>
            </div>
            <div>
              <div className="text-sm font-semibold text-stone-800">Click avatar to change</div>
              <div className="mt-1 text-xs text-stone-500">JPG, PNG. Large images will be auto-compressed.</div>
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-stone-200 bg-white p-5 shadow-[0_1px_2px_rgba(28,25,23,0.04)] md:p-6">
          <h2 className="text-xl font-semibold text-stone-900">Personal Information</h2>

          <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="md:col-span-2">
              <label className="mb-1.5 block text-sm font-medium text-stone-700">
                Full Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="h-12 w-full rounded-xl border border-stone-200 bg-white px-4 text-sm text-stone-800 outline-none transition placeholder:text-stone-400 focus:border-[#b8864a] focus:ring-4 focus:ring-[#b8864a]/10"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-stone-700">
                Phone / WhatsApp <span className="text-red-500">*</span>
              </label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder={c.phonePlaceholder}
                className="h-12 w-full rounded-xl border border-stone-200 bg-white px-4 text-sm text-stone-800 outline-none transition placeholder:text-stone-400 focus:border-[#b8864a] focus:ring-4 focus:ring-[#b8864a]/10"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-stone-700">
                Email <span className="text-red-500">*</span>
              </label>
              <input
                type="email"
                value={email}
                readOnly
                className="h-12 w-full rounded-xl border border-stone-200 bg-stone-50 px-4 text-sm text-stone-500 outline-none"
              />
              <p className="mt-1.5 text-xs text-stone-400">
                Email is managed by your account and cannot be edited here.
              </p>
            </div>

            <div className="md:col-span-2">
              <label className="mb-1.5 block text-sm font-medium text-stone-700">City</label>
              <input
                type="text"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                className="h-12 w-full rounded-xl border border-stone-200 bg-white px-4 text-sm text-stone-800 outline-none transition placeholder:text-stone-400 focus:border-[#b8864a] focus:ring-4 focus:ring-[#b8864a]/10"
              />
            </div>
          </div>
        </section>

        {message && (
          <p className={`rounded-xl px-4 py-3 text-sm ${message.includes('success') ? 'border border-green-200 bg-green-50 text-green-700' : 'border border-red-200 bg-red-50 text-red-600'}`}>
            {message}
          </p>
        )}

        <button
          type="submit"
          disabled={saving}
          className="inline-flex h-11 items-center rounded-xl bg-[#b8864a] px-5 text-sm font-semibold text-white transition hover:bg-[#a4763f] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {saving ? 'Saving...' : 'Save Changes'}
        </button>
      </form>
    </div>
  );
}
