import { useState, useRef } from 'react';
import { useDesigner } from '../../contexts/DesignerContext';
import Avatar from '../../components/ui/Avatar';
import SelectField from '../../components/form/SelectField';
import { sanitizePersonName, sanitizePhoneDigits } from '../../lib/formInputRules';

const PRIMARY = '#b8864a';
const CITIES = [
  { value: '', label: 'Select City' },
  { value: 'Dubai', label: 'Dubai' },
  { value: 'Sharjah', label: 'Sharjah' },
  { value: 'Abu Dhabi', label: 'Abu Dhabi' },
  { value: 'Ajman', label: 'Ajman' },
];

export default function DesignerProfileEditPage() {
  const { profile, setProfile, setAvatar, saveProfile } = useDesigner();
  const [form, setForm] = useState({
    fullName: profile.fullName,
    email: profile.email,
    phone: profile.phone,
    city: profile.city,
    address: profile.address,
    bio: profile.bio,
    title: profile.title,
  });
  const [saved, setSaved] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name } = e.target;
    let { value } = e.target;
    if (name === 'fullName') {
      value = sanitizePersonName(value);
    }
    if (name === 'phone') {
      value = sanitizePhoneDigits(value);
    }
    setForm((prev) => ({ ...prev, [name]: value }));
    setSaved(false);
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);
    try {
      await saveProfile({
        fullName: form.fullName,
        email: form.email,
        phone: form.phone,
        city: form.city,
        address: form.address,
        bio: form.bio,
        avatarUrl: profile.avatarUrl,
        title: form.title,
      });
      setProfile(form);
      setSaved(true);
    } catch (err: any) {
      setError(err.message || 'Failed to save profile.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setAvatar(reader.result as string);
    reader.readAsDataURL(file);
    setSaved(false);
  };

  return (
    <div className="w-full">
      <div className="mx-auto w-full max-w-[980px] px-2 md:px-4">
      <h1 className="mb-1.5 text-3xl font-bold text-[#2c2c2c]">Profile</h1>
      <p className="mb-6 text-sm text-stone-500">Update your personal and professional information.</p>

      {error && (
        <div className="mb-6 p-4 rounded-lg border border-red-200 bg-red-50 text-sm text-red-700">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Avatar */}
        <div className="bg-white rounded-lg border border-stone-200 p-5">
          <h2 className="mb-3 text-lg font-bold text-[#2c2c2c]">Profile Photo</h2>
          <div className="flex min-h-[92px] items-center gap-5">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleAvatarChange}
            />
            <Avatar 
              name={profile.fullName || 'New User'} 
              avatarUrl={profile.avatarUrl} 
              size="xl" 
              editable 
              onClick={() => fileInputRef.current?.click()}
            />
            <div>
              <p className="text-sm font-semibold text-[#2c2c2c]">Click avatar to change</p>
              <p className="text-xs text-stone-500 mt-1">JPG, PNG. Max 2MB.</p>
            </div>
          </div>
        </div>

        {/* Personal info */}
        <div className="bg-white rounded-lg border border-stone-200 p-5">
          <h2 className="mb-3 text-lg font-bold text-[#2c2c2c]">Personal Information</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-sm font-semibold text-stone-700 mb-1">Full Name *</label>
              <input
                name="fullName"
                type="text"
                required
                value={form.fullName}
                onChange={handleChange}
                className="h-12 w-full rounded-lg border border-stone-200 bg-stone-50 px-4 text-[#2c2c2c] focus:border-[#b8864a] focus:ring-2 focus:ring-[#b8864a]/40 outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-stone-700 mb-1">Professional Title</label>
              <input
                name="title"
                type="text"
                value={form.title}
                onChange={handleChange}
                placeholder="e.g. Senior Interior Designer"
                className="w-full rounded-lg border border-stone-200 bg-stone-50 px-4 py-3 text-[#2c2c2c] focus:border-[#b8864a] focus:ring-2 focus:ring-[#b8864a]/40 outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-stone-700 mb-1">Email *</label>
              <input
                name="email"
                type="email"
                required
                value={form.email}
                readOnly
                className="h-12 w-full rounded-lg border border-stone-200 bg-stone-100 px-4 text-[#2c2c2c] outline-none cursor-not-allowed"
              />
              <p className="mt-1 text-xs text-stone-500">Email is managed by your account and cannot be edited here.</p>
            </div>
            <div>
              <label className="block text-sm font-semibold text-stone-700 mb-1">Phone / WhatsApp *</label>
              <input
                name="phone"
                type="tel"
                required
                value={form.phone}
                onChange={handleChange}
                placeholder="+971 50 123 4567"
                inputMode="numeric"
                className="h-12 w-full rounded-lg border border-stone-200 bg-stone-50 px-4 text-[#2c2c2c] focus:border-[#b8864a] focus:ring-2 focus:ring-[#b8864a]/40 outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-stone-700 mb-1">City</label>
              <SelectField
                  name="city"
                  value={form.city}
                  onChange={handleChange}
                  className="pr-10"
                >
                  {CITIES.map((c) => (
                    <option key={c.value || 'empty'} value={c.value}>
                      {c.label}
                    </option>
                  ))}
              </SelectField>
            </div>
            <div className="sm:col-span-2">
              <label className="block text-sm font-semibold text-stone-700 mb-1">Address</label>
              <input
                name="address"
                type="text"
                value={form.address}
                onChange={handleChange}
                placeholder="Full address"
                className="h-12 w-full rounded-lg border border-stone-200 bg-stone-50 px-4 text-[#2c2c2c] focus:border-[#b8864a] focus:ring-2 focus:ring-[#b8864a]/40 outline-none"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-sm font-semibold text-stone-700 mb-1">Bio</label>
              <textarea
                name="bio"
                rows={4}
                value={form.bio}
                onChange={handleChange}
                placeholder="Brief description of your experience and style..."
                className="w-full rounded-lg border border-stone-200 bg-stone-50 px-4 py-3 text-[#2c2c2c] focus:border-[#b8864a] focus:ring-2 focus:ring-[#b8864a]/40 outline-none resize-y"
              />
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4 pt-1">
          <button
            type="submit"
            disabled={isSubmitting}
            className="rounded-lg h-11 px-6 text-white text-sm font-bold cursor-pointer"
            style={{ backgroundColor: PRIMARY }}
          >
            {isSubmitting ? 'Saving...' : 'Save Changes'}
          </button>
          {saved && (
            <span className="text-sm text-green-600 font-medium">Profile saved.</span>
          )}
        </div>
      </form>
      </div>
    </div>
  );
}
