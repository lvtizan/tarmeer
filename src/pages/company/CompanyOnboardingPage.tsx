import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../lib/api';
import AdminSelect from '../../components/ui/AdminSelect';
import Navbar from '../../components/Navbar';
import { useServices } from '../../hooks/useServices';
import {
  convertProjectImagesForUpload,
  estimateDataUrlBytes,
  MAX_ESTIMATED_PAYLOAD_BYTES,
  MAX_TOTAL_UPLOAD_BYTES,
  buildUploadSizeMessage,
} from '../../lib/projectImageUpload';
import { getDroppedImageFiles } from '../../lib/dropFiles';

/* ── Constants ── */

const GCC_PHONE_OPTIONS = [
  { label: 'UAE', code: '+971', maxDigits: 9 },
  { label: 'KSA', code: '+966', maxDigits: 9 },
  { label: 'Qatar', code: '+974', maxDigits: 8 },
  { label: 'Kuwait', code: '+965', maxDigits: 8 },
  { label: 'Oman', code: '+968', maxDigits: 8 },
  { label: 'Bahrain', code: '+973', maxDigits: 8 },
];

const STYLES = [
  { value: '', label: 'Select style (optional)' },
  { value: 'modern', label: 'Modern Contemporary' },
  { value: 'islamic', label: 'Modern Islamic' },
  { value: 'classic', label: 'Neo-Classic' },
  { value: 'minimalist', label: 'Minimalist' },
  { value: 'industrial', label: 'Industrial' },
];

const CITIES = ['Dubai', 'Abu Dhabi', 'Sharjah', 'Ajman', 'Ras Al Khaimah', 'Fujairah', 'Umm Al Quwain'];


const SPECIALTIES = [
  'Villa', 'Apartment', 'Commercial', 'Hospitality', 'Retail', 'Office',
  'Education', 'Healthcare', 'F&B', 'Mixed-Use',
];

const COMPANY_TYPES = [
  { value: 'renovation_company', label: 'Renovation Company' },
  { value: 'design_studio', label: 'Interior Design Studio' },
  { value: 'general_contractor', label: 'General Contractor' },
  { value: 'mep_contractor', label: 'MEP Contractor' },
  { value: 'maintenance_company', label: 'Maintenance Company' },
  { value: 'specialty_trade', label: 'Specialty Trade' },
  { value: 'landscaping', label: 'Landscaping' },
  { value: 'furnishing', label: 'Furnishing' },
];

const CITY_OPTIONS = [
  { value: '', label: 'Select city' },
  ...CITIES.map((c) => ({ value: c, label: c })),
];

/* ── Input class ── */

const INPUT_CLS =
  'w-full h-[50px] px-5 rounded-2xl border border-stone-200 bg-stone-50/80 text-[15px] text-[#1c1917] placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-[#B8864A]/15 focus:border-[#B8864A] focus:bg-white transition';

const LABEL_CLS = 'block text-xs font-medium uppercase tracking-wider text-stone-500 mb-1.5';

/* ── Component ── */

export default function CompanyOnboardingPage() {
  const navigate = useNavigate();
  const SERVICES = useServices();

  /* state */
  const [step, setStep] = useState(0); // 0 = loading
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // step 1
  const [companyName, setCompanyName] = useState('');
  const [contactPerson, setContactPerson] = useState('');
  const [phoneRegion, setPhoneRegion] = useState(GCC_PHONE_OPTIONS[0]);
  const [phoneDigits, setPhoneDigits] = useState('');

  // step 2
  const [projectTitle, setProjectTitle] = useState('');
  const [city, setCity] = useState('');
  const [style, setStyle] = useState('');
  const [images, setImages] = useState<string[]>([]);
  const [prepping, setPrepping] = useState(false);
  const [dropActive, setDropActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  // step 3
  const [description, setDescription] = useState('');
  const [services, setServices] = useState<string[]>([]);
  const [specialties, setSpecialties] = useState<string[]>([]);
  const [website, setWebsite] = useState('');
  const [companyType, setCompanyType] = useState('renovation_company');

  // cached profile data for step 2/3 re-posts
  const [profileData, setProfileData] = useState<{ company_name: string; contact_person: string; phone: string }>({
    company_name: '',
    contact_person: '',
    phone: '',
  });

  /* on mount: check auth + onboarding state */
  useEffect(() => {
    (async () => {
      try {
        const [meRes, profileRes] = await Promise.all([
          api.get('/auth/me'),
          api.get('/auth/company/profile').catch(() => null),
        ]);

        const user = meRes?.user || meRes;
        if (user?.full_name) setContactPerson(user.full_name);

        // pre-fill phone from user
        if (user?.phone) {
          const match = GCC_PHONE_OPTIONS.find((o) => user.phone.startsWith(o.code));
          if (match) {
            setPhoneRegion(match);
            setPhoneDigits(user.phone.slice(match.code.length));
          }
        }

        const profile = profileRes?.profile || null;
        const projectCount = profileRes?.projectCount || 0;
        const onboardingStep = profile?.onboarding_step ?? 0;

        // Read pending signup data (saved during /for-companies registration)
        let pending: any = null;
        try {
          const raw = sessionStorage.getItem('pending_company_profile');
          if (raw) { pending = JSON.parse(raw); sessionStorage.removeItem('pending_company_profile'); }
        } catch { /* ignore */ }
        // Also check company_signup_prefill (inline login path)
        if (!pending) {
          try {
            const raw2 = sessionStorage.getItem('company_signup_prefill');
            if (raw2) { pending = JSON.parse(raw2); sessionStorage.removeItem('company_signup_prefill'); }
          } catch { /* ignore */ }
        }

        if (profile) {
          setProfileData({
            company_name: profile.company_name || '',
            contact_person: profile.contact_person || '',
            phone: profile.phone || '',
          });
          if (profile.company_name) setCompanyName(profile.company_name);
          if (profile.contact_person) setContactPerson(profile.contact_person);
          if (profile.company_type) setCompanyType(profile.company_type);
        }

        // Apply pending data if profile fields are empty
        if (pending && (!profile?.company_name || !profile?.contact_person)) {
          if (pending.company_name) setCompanyName(pending.company_name);
          if (pending.contact_person) setContactPerson(pending.contact_person);
          if (pending.company_type) setCompanyType(pending.company_type);
          if (pending.phone) {
            const match = GCC_PHONE_OPTIONS.find((o: any) => pending.phone.startsWith(o.code));
            if (match) {
              setPhoneRegion(match);
              setPhoneDigits(pending.phone.slice(match.code.length));
            }
          }
          // Auto-save the pending data to profile
          try {
            await api.post('/auth/company/profile', {
              company_name: pending.company_name || '',
              contact_person: pending.contact_person || '',
              phone: pending.phone || '',
              company_type: pending.company_type || 'renovation_company',
              city: pending.city || '',
              description: '',
              services: pending.services || ['Interior Design'],
              establishment_year: pending.establishment_year || null,
              signup_source: pending.signup_source || 'for-companies-landing',
              onboarding_step: 1,
            });
            setProfileData({
              company_name: pending.company_name || '',
              contact_person: pending.contact_person || '',
              phone: pending.phone || '',
            });
          } catch { /* best-effort */ }
        }

        // redirect or resume
        if (onboardingStep >= 2 && projectCount > 0) {
          navigate('/company/dashboard', { replace: true });
          return;
        }

        if (onboardingStep >= 1) {
          setStep(2);
        } else if (profile?.company_name && profile?.contact_person) {
          // Profile already created during registration — auto-advance past step 1
          try {
            await api.post('/auth/company/profile', {
              company_name: profile.company_name,
              contact_person: profile.contact_person,
              phone: profile.phone || '',
              company_type: profile.company_type || 'renovation_company',
              onboarding_step: 1,
            });
          } catch { /* ignore, best-effort */ }
          setStep(2);
        } else {
          setStep(1);
        }
      } catch {
        setStep(1);
      } finally {
        setLoading(false);
      }
    })();
  }, [navigate]);

  /* helpers */

  const fullPhone = `${phoneRegion.code}${phoneDigits}`;

  const toggleTag = (list: string[], setList: (v: string[]) => void, tag: string) => {
    setList(list.includes(tag) ? list.filter((t) => t !== tag) : [...list, tag]);
  };

  const addFiles = async (fileList: FileList | File[]) => {
    const files = Array.from(fileList).filter((f) => f.type.startsWith('image/'));
    if (files.length === 0) return;

    const totalBytes = files.reduce((s, f) => s + f.size, 0);
    if (totalBytes > MAX_TOTAL_UPLOAD_BYTES) {
      setError(buildUploadSizeMessage(totalBytes));
      return;
    }

    setPrepping(true);
    setError('');
    try {
      const result = await convertProjectImagesForUpload(files);
      const existingBytes = images.reduce((s, u) => s + estimateDataUrlBytes(u), 0);
      if (existingBytes + result.estimatedPayloadBytes > MAX_ESTIMATED_PAYLOAD_BYTES) {
        setError('Total images too large. Remove some and try again.');
        return;
      }
      setImages((prev) => [...prev, ...result.dataUrls]);
    } catch (err: any) {
      setError(err.message || 'Failed to process images.');
    } finally {
      setPrepping(false);
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setDropActive(false);
    const result = await getDroppedImageFiles(e);
    if (result.files.length > 0) {
      if (result.folderName && !projectTitle.trim()) {
        setProjectTitle(result.folderName);
      }
      await addFiles(result.files);
    }
  };

  const removeImage = (index: number) => {
    setImages((prev) => prev.filter((_, i) => i !== index));
  };

  /* step handlers */

  const handleStep1 = async () => {
    setError('');
    if (!companyName.trim()) { setError('Company name is required.'); return; }
    if (!contactPerson.trim()) { setError('Contact person is required.'); return; }
    if (phoneDigits.length !== phoneRegion.maxDigits) {
      setError(`Phone number must be exactly ${phoneRegion.maxDigits} digits for ${phoneRegion.label}.`);
      return;
    }

    setSaving(true);
    try {
      await api.post('/auth/company/profile', {
        company_name: companyName.trim(),
        contact_person: contactPerson.trim(),
        phone: fullPhone,
        company_type: 'renovation_company',
        onboarding_step: 1,
      });
      await api.put('/auth/me', { phone: fullPhone });

      setProfileData({
        company_name: companyName.trim(),
        contact_person: contactPerson.trim(),
        phone: fullPhone,
      });
      setStep(2);
    } catch (err: any) {
      setError(err?.response?.data?.error || err.message || 'Something went wrong');
    } finally {
      setSaving(false);
    }
  };

  const handleStep2 = async () => {
    setError('');
    if (!projectTitle.trim()) { setError('Project title is required.'); return; }
    if (!city) { setError('City is required.'); return; }
    if (images.length === 0) { setError('Please upload at least one photo.'); return; }

    setSaving(true);
    try {
      await api.post('/projects', {
        title: projectTitle.trim(),
        description: '',
        location: city,
        style: style || null,
        images: images,
        tags: [],
        status: 'pending',
      });

      await api.post('/auth/company/profile', {
        company_name: profileData.company_name,
        contact_person: profileData.contact_person,
        phone: profileData.phone,
        company_type: companyType || 'renovation_company',
        onboarding_step: 2,
      });

      setStep(3);
    } catch (err: any) {
      setError(err?.response?.data?.error || err.message || 'Something went wrong');
    } finally {
      setSaving(false);
    }
  };

  const handleStep3 = async (skip: boolean) => {
    setError('');
    setSaving(true);
    try {
      const payload: Record<string, any> = {
        company_name: profileData.company_name,
        contact_person: profileData.contact_person,
        phone: profileData.phone,
        company_type: companyType || 'renovation_company',
        onboarding_step: 3,
      };

      if (!skip) {
        if (description.trim()) payload.description = description.trim();
        if (services.length > 0) payload.services = services;
        if (specialties.length > 0) payload.specialties = specialties;
        if (website.trim()) payload.website = website.trim();
        if (companyType) payload.company_type = companyType;
      }

      await api.post('/auth/company/profile', payload);
      navigate('/company/dashboard', { replace: true });
    } catch (err: any) {
      setError(err?.response?.data?.error || err.message || 'Something went wrong');
    } finally {
      setSaving(false);
    }
  };

  /* progress bar */
  const ProgressBar = () => (
    <div className="flex items-center justify-center gap-0 py-6">
      {[1, 2, 3].map((s, i) => (
        <div key={s} className="flex items-center">
          <div
            className={`w-3 h-3 rounded-full transition-colors ${
              s <= step ? 'bg-[#b8864a]' : 'bg-stone-300'
            }`}
          />
          {i < 2 && (
            <div
              className={`w-12 h-0.5 transition-colors ${
                s < step ? 'bg-[#b8864a]' : 'bg-stone-300'
              }`}
            />
          )}
        </div>
      ))}
    </div>
  );

  /* loading state */
  if (loading) {
    return (
      <div className="min-h-screen bg-[#faf9f7]">
        <Navbar />
        <div className="flex items-center justify-center py-32">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#b8864a] border-t-transparent" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#faf9f7]">
      <Navbar />
      <ProgressBar />

      <div className="mx-auto max-w-[640px] px-4 pb-16">
        {/* Error banner */}
        {error && (
          <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* ── Step 1: Company Basics ── */}
        {step === 1 && (
          <div>
            <h1 className="font-serif text-2xl font-bold text-[#2c2c2c]">Tell us about your company</h1>
            <p className="mt-1 text-sm text-stone-500">This takes about 10 seconds</p>

            <div className="mt-8 space-y-5">
              <div>
                <label className={LABEL_CLS}>Company Name *</label>
                <input
                  type="text"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  placeholder="Your company name"
                  className={INPUT_CLS}
                />
              </div>

              <div>
                <label className={LABEL_CLS}>Contact Person *</label>
                <input
                  type="text"
                  value={contactPerson}
                  onChange={(e) => setContactPerson(e.target.value)}
                  placeholder="Full name"
                  className={INPUT_CLS}
                />
              </div>

              <div>
                <label className={LABEL_CLS}>Phone *</label>
                <div className="grid grid-cols-[130px_1fr] gap-2">
                  <div className="relative">
                    <select
                      value={phoneRegion.code}
                      onChange={(e) => {
                        const next = GCC_PHONE_OPTIONS.find((o) => o.code === e.target.value) || GCC_PHONE_OPTIONS[0];
                        setPhoneRegion(next);
                        setPhoneDigits((d) => d.slice(0, next.maxDigits));
                      }}
                      className="appearance-none w-full h-[50px] pl-4 pr-9 rounded-2xl border border-stone-200 bg-stone-50/80 text-[15px] text-[#1c1917] focus:outline-none focus:ring-2 focus:ring-[#B8864A]/15 focus:border-[#B8864A] focus:bg-white transition cursor-pointer"
                    >
                      {GCC_PHONE_OPTIONS.map((o) => (
                        <option key={o.code} value={o.code}>
                          {o.label} {o.code}
                        </option>
                      ))}
                    </select>
                    <svg
                      className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400 pointer-events-none"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                  <input
                    type="tel"
                    inputMode="numeric"
                    value={phoneDigits}
                    onChange={(e) => {
                      const digits = e.target.value.replace(/\D/g, '').slice(0, phoneRegion.maxDigits);
                      setPhoneDigits(digits);
                    }}
                    maxLength={phoneRegion.maxDigits}
                    placeholder={`Enter ${phoneRegion.maxDigits}-digit number`}
                    className={INPUT_CLS}
                  />
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={handleStep1}
              disabled={saving}
              className="btn-primary mt-8 w-full h-[50px] rounded-2xl text-[15px] font-semibold"
            >
              {saving ? 'Saving...' : 'Continue'}
            </button>
          </div>
        )}

        {/* ── Step 2: Upload First Project ── */}
        {step === 2 && (
          <div>
            <h1 className="font-serif text-2xl font-bold text-[#2c2c2c]">Upload your first project</h1>

            <div className="mt-4 rounded-2xl bg-[#b8864a]/[0.08] p-4 mb-6">
              <p className="text-sm text-[#2c2c2c]">
                The more project photos you upload, the higher you rank in search results.
              </p>
            </div>

            <div className="space-y-5">
              <div>
                <label className={LABEL_CLS}>Project Title *</label>
                <input
                  type="text"
                  value={projectTitle}
                  onChange={(e) => setProjectTitle(e.target.value)}
                  placeholder="e.g. Modern Villa in Dubai Hills"
                  className={INPUT_CLS}
                />
              </div>

              <div>
                <label className={LABEL_CLS}>City *</label>
                <AdminSelect
                  value={city}
                  onChange={setCity}
                  options={CITY_OPTIONS}
                  className="w-full"
                />
              </div>

              <div>
                <label className={LABEL_CLS}>Style</label>
                <AdminSelect
                  value={style}
                  onChange={setStyle}
                  options={STYLES}
                  className="w-full"
                />
              </div>

              {/* Drop zone */}
              <div>
                <label className={LABEL_CLS}>Project Photos *</label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files?.length) {
                      addFiles(e.target.files);
                      e.target.value = '';
                    }
                  }}
                />
                <input
                  ref={folderInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  {...({ webkitdirectory: '', directory: '' } as any)}
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files?.length) {
                      addFiles(e.target.files);
                      e.target.value = '';
                    }
                  }}
                />

                <div
                  onClick={() => fileInputRef.current?.click()}
                  onDrop={handleDrop}
                  onDragOver={(e) => { e.preventDefault(); setDropActive(true); }}
                  onDragLeave={() => setDropActive(false)}
                  className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition ${
                    dropActive
                      ? 'border-[#b8864a] bg-[#b8864a]/5'
                      : 'border-stone-300 hover:border-[#b8864a]/40'
                  }`}
                >
                  <svg className="mx-auto mb-3 h-10 w-10 text-stone-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <p className="text-sm font-medium text-stone-600">Drop photos here or click to browse</p>
                  <p className="mt-1 text-xs text-stone-400">Supports folders</p>
                </div>

                <button
                  type="button"
                  onClick={() => folderInputRef.current?.click()}
                  className="mt-2 text-sm font-medium text-[#b8864a] hover:underline"
                >
                  Upload Folder
                </button>

                {prepping && (
                  <p className="mt-2 text-sm text-stone-500">Processing images...</p>
                )}
              </div>

              {/* Thumbnails */}
              {images.length > 0 && (
                <div>
                  <p className="text-sm font-medium text-stone-600 mb-2">{images.length} photo{images.length > 1 ? 's' : ''} selected</p>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {images.map((src, i) => (
                      <div key={i} className="relative group aspect-square rounded-xl overflow-hidden bg-stone-100">
                        <img src={src} alt="" className="w-full h-full object-cover" />
                        <button
                          type="button"
                          onClick={() => removeImage(i)}
                          className="absolute top-1.5 right-1.5 w-6 h-6 flex items-center justify-center rounded-full bg-black/60 text-white text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          &times;
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={handleStep2}
              disabled={saving || images.length === 0 || !projectTitle.trim()}
              className="btn-primary mt-8 w-full h-[50px] rounded-2xl text-[15px] font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? 'Saving...' : 'Save & Continue'}
            </button>
          </div>
        )}

        {/* ── Step 3: Complete Profile ── */}
        {step === 3 && (
          <div>
            <h1 className="font-serif text-2xl font-bold text-[#2c2c2c]">Complete your profile</h1>

            <div className="mt-4 rounded-2xl bg-[#b8864a]/[0.08] p-4 mb-6">
              <p className="text-sm text-[#2c2c2c]">
                A complete profile gets 3x more inquiries and ranks higher in search.
              </p>
            </div>

            <div className="space-y-5">
              <div>
                <label className={LABEL_CLS}>Description</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Tell potential clients about your company..."
                  className="w-full min-h-[120px] px-5 py-4 rounded-2xl border border-stone-200 bg-stone-50/80 text-[15px] text-[#1c1917] placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-[#B8864A]/15 focus:border-[#B8864A] focus:bg-white transition resize-y"
                />
              </div>

              <div>
                <label className={LABEL_CLS}>Services</label>
                <div className="flex flex-wrap gap-2">
                  {SERVICES.map((opt) => (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => toggleTag(services, setServices, opt)}
                      className={`px-4 py-2 rounded-2xl text-sm font-medium border transition ${
                        services.includes(opt)
                          ? 'border-[#b8864a] bg-[#b8864a] text-white'
                          : 'border-stone-200 bg-stone-50 text-stone-700 hover:border-[#b8864a]/45'
                      }`}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className={LABEL_CLS}>Specialties</label>
                <div className="flex flex-wrap gap-2">
                  {SPECIALTIES.map((opt) => (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => toggleTag(specialties, setSpecialties, opt)}
                      className={`px-4 py-2 rounded-2xl text-sm font-medium border transition ${
                        specialties.includes(opt)
                          ? 'border-[#b8864a] bg-[#b8864a] text-white'
                          : 'border-stone-200 bg-stone-50 text-stone-700 hover:border-[#b8864a]/45'
                      }`}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className={LABEL_CLS}>Website</label>
                <input
                  type="url"
                  value={website}
                  onChange={(e) => setWebsite(e.target.value)}
                  placeholder="https://yourcompany.com"
                  className={INPUT_CLS}
                />
              </div>

              <div>
                <label className={LABEL_CLS}>Company Type</label>
                <AdminSelect
                  value={companyType}
                  onChange={setCompanyType}
                  options={[{ value: '', label: 'Select type' }, ...COMPANY_TYPES]}
                  className="w-full"
                />
              </div>
            </div>

            <div className="mt-8 flex gap-3">
              <button
                type="button"
                onClick={() => handleStep3(true)}
                disabled={saving}
                className="flex-1 h-[50px] rounded-2xl border border-stone-300 text-[15px] font-medium text-stone-600 hover:bg-stone-100 transition disabled:opacity-50"
              >
                Skip for now
              </button>
              <button
                type="button"
                onClick={() => handleStep3(false)}
                disabled={saving}
                className="btn-primary flex-1 h-[50px] rounded-2xl text-[15px] font-semibold"
              >
                {saving ? 'Saving...' : 'Finish'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
