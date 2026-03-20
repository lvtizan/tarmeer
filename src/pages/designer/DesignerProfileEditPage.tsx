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
  const { profile, setAvatar, saveProfile } = useDesigner();
  const [form, setForm] = useState({
    fullName: profile.fullName,
    email: profile.email,
    phone: profile.phone,
    city: profile.city,
    address: profile.address,
    bio: profile.bio,
    title: profile.title,
    avatarUrl: profile.avatarUrl,
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
        avatarUrl: form.avatarUrl,
        title: form.title,
      });
      setSaved(true);
    } catch (err: any) {
      const msg: string = err.message || '';
      if (msg.includes('413') || msg.includes('too large') || msg.includes('过大')) {
        setError('Profile photo is too large. Please choose a smaller image and try again.');
      } else if (msg.includes('Network error') || msg.includes('fetch')) {
        setError('Network error. Please check your connection and try again.');
      } else {
        setError(msg || 'Failed to save profile. Please try again.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // 压缩图片到指定大小以内
  const compressImage = (file: File, maxSizeKB: number): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target?.result as string;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');

          if (!ctx) {
            reject(new Error('Failed to compress image'));
            return;
          }

          // 设置最大尺寸
          const MAX_DIMENSION = 1200;
          let width = img.width;
          let height = img.height;

          if (width > height) {
            if (width > MAX_DIMENSION) {
              height = (height * MAX_DIMENSION) / width;
              width = MAX_DIMENSION;
            }
          } else {
            if (height > MAX_DIMENSION) {
              width = (width * MAX_DIMENSION) / height;
              height = MAX_DIMENSION;
            }
          }

          canvas.width = width;
          canvas.height = height;

          // 绘制图片
          ctx.drawImage(img, 0, 0, width, height);

          // 逐步压缩直到满足大小要求
          const maxSizeBytes = maxSizeKB * 1024;
          let quality = 0.9;
          let compressedDataUrl = canvas.toDataURL('image/jpeg', quality);

          // 如果初始压缩就满足要求，直接返回
          if (compressedDataUrl.length <= maxSizeBytes) {
            resolve(compressedDataUrl);
            return;
          }

          // 二分法寻找合适的压缩质量
          let minQuality = 0.1;
          let maxQuality = 0.9;
          let iterations = 0;
          const maxIterations = 10;

          while (iterations < maxIterations) {
            quality = (minQuality + maxQuality) / 2;
            compressedDataUrl = canvas.toDataURL('image/jpeg', quality);

            if (compressedDataUrl.length <= maxSizeBytes) {
              minQuality = quality;
            } else {
              maxQuality = quality;
            }

            iterations++;

            // 如果范围足够小，使用较小的质量
            if (maxQuality - minQuality < 0.05) {
              break;
            }
          }

          // 使用找到的质量再压缩一次
          const finalQuality = minQuality;
          compressedDataUrl = canvas.toDataURL('image/jpeg', finalQuality);

          resolve(compressedDataUrl);
        };
        img.onerror = () => reject(new Error('Failed to load image'));
      };
      reader.onerror = () => reject(new Error('Failed to read file'));
    });
  };

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // 验证文件类型
    if (!file.type.startsWith('image/')) {
      setError('Please select a valid image file (JPG, PNG).');
      return;
    }

    // 文件大小上限 10MB（原始文件，压缩前）
    if (file.size > 10 * 1024 * 1024) {
      setError('Image file must be under 10MB. Please choose a smaller image.');
      return;
    }

    setError(null);

    try {
      // 无论图片大小，统一走压缩流程，确保 data URL ≤ 500KB，payload 不超过 nginx 限制
      const TARGET_SIZE_KB = 500;
      const compressedDataUrl = await compressImage(file, TARGET_SIZE_KB);
      setAvatar(compressedDataUrl);
      setForm((prev) => ({ ...prev, avatarUrl: compressedDataUrl }));
      setSaved(false);
    } catch (err) {
      setError('Failed to process image. Please try a different image.');
      console.error('Image compression error:', err);
    }
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
              <p className="text-xs text-stone-500 mt-1">JPG, PNG. Large images will be auto-compressed.</p>
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
