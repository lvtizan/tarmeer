'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { api } from '@/lib/api';
import { useSiteLocale } from '@/contexts/SiteLocaleContext';
import { useServiceCategories } from '@/hooks/useServiceCategories';
import { resolveImageUrl } from '@/lib/imageUrl';
import { validatePhone, isPhoneComplete } from '@/lib/phoneValidation';
import {
  User, Award, Inbox, BarChart3, Plus, X, Upload, FileText,
  ExternalLink, Loader2, Phone as PhoneIcon,
} from 'lucide-react';

const API_BASE = process.env.NEXT_PUBLIC_API_URL?.trim() || '/api';

const INPUT_CLS = 'w-full h-10 px-3 rounded-lg border border-stone-200 bg-stone-50 text-sm focus:outline-none focus:ring-2 focus:ring-[#b8864a]/30 focus:border-[#b8864a] focus:bg-white';

interface WorkItem {
  from: string;
  to: string;
  org: string;
  role: string;
}

interface ExpertProfileResponse {
  profile: null | {
    id: number;
    slug: string;
    full_name: string;
    avatar_url: string | null;
    services: string[];
    birth_year: number | null;
    experience_years: number | null;
    city: string | null;
    bio: string | null;
    skills: string[];
    work_history: WorkItem[];
    certificates: string[];
    license_url: string | null;
    phone: string | null;
    status: 'pending' | 'approved' | 'rejected';
    is_certified: boolean;
    is_signed: boolean;
  };
}

interface InquiryItem {
  id: number;
  name: string;
  phone: string;
  message: string;
  created_at: string;
}

const KNOWN_CODES = ['+971', '+84', '+966', '+86', '+974', '+965', '+968', '+973', '+91', '+44', '+1'];

function splitPhone(raw: string | null, defaultCode: string): { code: string; digits: string } {
  if (!raw) return { code: defaultCode, digits: '' };
  const trimmed = raw.trim();
  for (const code of KNOWN_CODES) {
    if (trimmed.startsWith(code)) {
      return { code, digits: trimmed.slice(code.length).replace(/\D/g, '') };
    }
  }
  return { code: defaultCode, digits: trimmed.replace(/\D/g, '') };
}

function isPdf(url: string): boolean {
  return url.toLowerCase().split('?')[0].endsWith('.pdf');
}

async function uploadExpertFile(file: File): Promise<string> {
  const fd = new FormData();
  fd.append('file', file, file.name);
  const token = api.getToken();
  const res = await fetch(`${API_BASE}/experts/me/upload`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    body: fd,
  });
  if (!res.ok) {
    let msg = `Upload failed (${res.status})`;
    try {
      const j = await res.json();
      if (j?.error) msg = j.error;
    } catch { /* ignore */ }
    throw new Error(msg);
  }
  const j = await res.json();
  return j.url as string;
}

export default function ExpertCenterPage() {
  const { lang, tr } = useSiteLocale();
  const t = tr.expert;
  const defaultCode = lang === 'vi' ? '+84' : '+971';
  const categories = useServiceCategories();

  const [loading, setLoading] = useState(true);
  const [profileExists, setProfileExists] = useState(false);
  const [status, setStatus] = useState<'pending' | 'approved' | 'rejected' | null>(null);
  const [slug, setSlug] = useState('');

  // Profile form
  const [fullName, setFullName] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [services, setServices] = useState<string[]>([]);
  const [birthYear, setBirthYear] = useState('');
  const [experienceYears, setExperienceYears] = useState('');
  const [city, setCity] = useState('');
  const [bio, setBio] = useState('');
  const [skills, setSkills] = useState<string[]>([]);
  const [skillInput, setSkillInput] = useState('');
  const [workHistory, setWorkHistory] = useState<WorkItem[]>([]);
  const [phoneCode, setPhoneCode] = useState(defaultCode);
  const [phoneDigits, setPhoneDigits] = useState('');
  const [phoneTouched, setPhoneTouched] = useState(false);

  // Documents
  const [certificates, setCertificates] = useState<string[]>([]);
  const [licenseUrl, setLicenseUrl] = useState('');

  // UI state
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [uploadingCert, setUploadingCert] = useState(false);
  const [uploadingLicense, setUploadingLicense] = useState(false);

  const avatarInputRef = useRef<HTMLInputElement>(null);
  const certInputRef = useRef<HTMLInputElement>(null);
  const licenseInputRef = useRef<HTMLInputElement>(null);

  // Inbox & stats
  const [inquiries, setInquiries] = useState<InquiryItem[]>([]);
  const [stats, setStats] = useState<{ phoneReveals: number; inquiries: number }>({ phoneReveals: 0, inquiries: 0 });

  const applyProfile = useCallback((p: NonNullable<ExpertProfileResponse['profile']>) => {
    setProfileExists(true);
    setStatus(p.status);
    setSlug(p.slug || '');
    setFullName(p.full_name || '');
    setAvatarUrl(p.avatar_url || '');
    setServices(Array.isArray(p.services) ? p.services : []);
    setBirthYear(p.birth_year != null ? String(p.birth_year) : '');
    setExperienceYears(p.experience_years != null ? String(p.experience_years) : '');
    setCity(p.city || '');
    setBio(p.bio || '');
    setSkills(Array.isArray(p.skills) ? p.skills : []);
    setWorkHistory(Array.isArray(p.work_history) ? p.work_history.map(w => ({
      from: w?.from || '', to: w?.to || '', org: w?.org || '', role: w?.role || '',
    })) : []);
    setCertificates(Array.isArray(p.certificates) ? p.certificates : []);
    setLicenseUrl(p.license_url || '');
    const { code, digits } = splitPhone(p.phone, defaultCode);
    setPhoneCode(code);
    setPhoneDigits(digits);
  }, [defaultCode]);

  useEffect(() => {
    let mounted = true;
    Promise.allSettled([
      api.get('/experts/me'),
      api.get('/experts/me/inquiries'),
      api.get('/experts/me/stats'),
    ]).then(([profRes, inqRes, statsRes]) => {
      if (!mounted) return;
      if (profRes.status === 'fulfilled') {
        const data = profRes.value as ExpertProfileResponse;
        if (data?.profile) applyProfile(data.profile);
      }
      if (inqRes.status === 'fulfilled') {
        const data = inqRes.value as { inquiries?: InquiryItem[] };
        setInquiries(data?.inquiries || []);
      }
      if (statsRes.status === 'fulfilled') {
        const data = statsRes.value as { phoneReveals?: number; inquiries?: number };
        setStats({ phoneReveals: Number(data?.phoneReveals || 0), inquiries: Number(data?.inquiries || 0) });
      }
      setLoading(false);
    });
    return () => { mounted = false; };
  }, [applyProfile]);

  const toggleService = (sub: string) => {
    setServices(prev => prev.includes(sub) ? prev.filter(s => s !== sub) : [...prev, sub]);
  };

  const addSkill = () => {
    const v = skillInput.trim();
    if (!v) return;
    if (!skills.includes(v)) setSkills(prev => [...prev, v]);
    setSkillInput('');
  };

  const handleAvatarFile = async (file: File | undefined) => {
    if (!file) return;
    setUploadingAvatar(true);
    try {
      const url = await uploadExpertFile(file);
      setAvatarUrl(url);
    } catch (err: unknown) {
      setSaveMsg({ type: 'error', text: err instanceof Error ? err.message : t.uploadFailed });
    }
    setUploadingAvatar(false);
  };

  const handleCertFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploadingCert(true);
    try {
      for (const file of Array.from(files)) {
        const url = await uploadExpertFile(file);
        setCertificates(prev => [...prev, url]);
      }
    } catch (err: unknown) {
      setSaveMsg({ type: 'error', text: err instanceof Error ? err.message : t.uploadFailed });
    }
    setUploadingCert(false);
  };

  const handleLicenseFile = async (file: File | undefined) => {
    if (!file) return;
    setUploadingLicense(true);
    try {
      const url = await uploadExpertFile(file);
      setLicenseUrl(url);
    } catch (err: unknown) {
      setSaveMsg({ type: 'error', text: err instanceof Error ? err.message : t.uploadFailed });
    }
    setUploadingLicense(false);
  };

  const phoneError = phoneTouched ? validatePhone(phoneDigits, phoneCode) : null;

  const handleSave = async () => {
    setSaveMsg(null);
    if (!fullName.trim()) {
      setSaveMsg({ type: 'error', text: t.fullNameRequired });
      return;
    }
    if (phoneDigits) {
      const err = validatePhone(phoneDigits, phoneCode);
      if (err || !isPhoneComplete(phoneDigits, phoneCode)) {
        setPhoneTouched(true);
        setSaveMsg({ type: 'error', text: err || t.phoneIncomplete });
        return;
      }
    }
    const wasFirst = !profileExists;
    setSaving(true);
    try {
      const body = {
        full_name: fullName.trim(),
        avatar_url: avatarUrl || null,
        services,
        birth_year: birthYear ? parseInt(birthYear, 10) : null,
        experience_years: experienceYears ? parseInt(experienceYears, 10) : null,
        city: city.trim() || null,
        bio: bio.trim() || null,
        skills,
        work_history: workHistory.filter(w => w.from || w.to || w.org || w.role),
        certificates,
        license_url: licenseUrl || null,
        phone: phoneDigits ? `${phoneCode}${phoneDigits}` : null,
      };
      await api.post('/experts/me', body);
      // Re-fetch to pick up status / slug (first save creates a pending profile)
      try {
        const data = await api.get('/experts/me') as ExpertProfileResponse;
        if (data?.profile) applyProfile(data.profile);
      } catch { /* ignore */ }
      setSaveMsg({
        type: 'success',
        text: wasFirst
          ? t.submittedPending
          : t.saved,
      });
    } catch (err: unknown) {
      setSaveMsg({ type: 'error', text: err instanceof Error ? err.message : t.failedToSave });
    }
    setSaving(false);
  };

  if (loading) {
    return (
      <div className="flex justify-center py-24 text-stone-400">
        <Loader2 className="w-6 h-6 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-5 pb-12">
      {/* Header + status badge */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold text-[#2c2c2c]">{t.expertCenter}</h1>
        <div className="flex items-center gap-2">
          {status === 'pending' && (
            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-amber-50 text-amber-700">
              {t.pendingReview}
            </span>
          )}
          {status === 'approved' && (
            <>
              <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-green-50 text-green-700">
                {t.live}
              </span>
              {slug && (
                <a
                  href={`/experts/${slug}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs font-medium text-[#b8864a] hover:underline"
                >
                  {t.viewMyPage}
                  <ExternalLink className="w-3 h-3" />
                </a>
              )}
            </>
          )}
          {status === 'rejected' && (
            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-red-50 text-red-600">
              {t.rejected}
            </span>
          )}
        </div>
      </div>

      {!profileExists && (
        <div className="bg-[#f5f0e8] border border-[#d4c4a8] text-[#8a6534] text-sm rounded-xl px-4 py-3">
          {t.completeBanner}
        </div>
      )}

      {/* ── Section 1: My Profile ── */}
      <section className="bg-white rounded-xl border border-stone-200 p-5">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-stone-700 mb-4">
          <User className="w-4 h-4 text-[#b8864a]" />
          {t.myProfile}
        </h2>

        {/* Avatar + name */}
        <div className="flex items-start gap-4 mb-4">
          <div className="shrink-0">
            <button
              type="button"
              onClick={() => avatarInputRef.current?.click()}
              className="relative w-20 h-20 rounded-full bg-stone-100 border border-stone-200 overflow-hidden flex items-center justify-center text-stone-400 hover:border-[#b8864a] transition"
              title={t.uploadAvatar}
            >
              {avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={resolveImageUrl(avatarUrl)} alt="avatar" className="w-full h-full object-cover" />
              ) : (
                <Upload className="w-5 h-5" />
              )}
              {uploadingAvatar && (
                <span className="absolute inset-0 bg-white/70 flex items-center justify-center">
                  <Loader2 className="w-5 h-5 animate-spin text-[#b8864a]" />
                </span>
              )}
            </button>
            <input
              ref={avatarInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={e => { handleAvatarFile(e.target.files?.[0]); e.target.value = ''; }}
            />
            <p className="text-[11px] text-stone-400 text-center mt-1">{t.avatar}</p>
          </div>
          <div className="flex-1 min-w-0">
            <label className="block text-xs font-medium text-stone-500 mb-1">
              {t.fullName} <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={fullName}
              onChange={e => setFullName(e.target.value)}
              className={INPUT_CLS}
              placeholder={t.yourFullName}
            />
          </div>
        </div>

        {/* Services multi-select */}
        <div className="mb-4">
          <label className="block text-xs font-medium text-stone-500 mb-2">{t.services}</label>
          <div className="space-y-3">
            {categories.map(cat => (
              <div key={cat.name}>
                <p className="text-[11px] font-semibold tracking-wide uppercase text-stone-400 mb-1.5">{cat.name}</p>
                <div className="flex flex-wrap gap-1.5">
                  {cat.subs.map(sub => {
                    const active = services.includes(sub);
                    return (
                      <button
                        key={sub}
                        type="button"
                        onClick={() => toggleService(sub)}
                        className={`px-2.5 py-1 rounded-full text-xs border transition ${
                          active
                            ? 'bg-[#b8864a] text-white border-[#b8864a]'
                            : 'bg-stone-50 text-stone-600 border-stone-200 hover:border-[#b8864a]/50'
                        }`}
                      >
                        {sub}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Birth year / experience / city */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
          <div>
            <label className="block text-xs font-medium text-stone-500 mb-1">{t.birthYear}</label>
            <input
              type="number"
              min={1940}
              max={2010}
              value={birthYear}
              onChange={e => setBirthYear(e.target.value)}
              className={INPUT_CLS}
              placeholder="1990"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-stone-500 mb-1">{t.yearsExperience}</label>
            <input
              type="number"
              min={0}
              max={60}
              value={experienceYears}
              onChange={e => setExperienceYears(e.target.value)}
              className={INPUT_CLS}
              placeholder="5"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-stone-500 mb-1">{t.city}</label>
            <input
              type="text"
              value={city}
              onChange={e => setCity(e.target.value)}
              className={INPUT_CLS}
              placeholder={t.cityPlaceholder}
            />
          </div>
        </div>

        {/* Bio */}
        <div className="mb-4">
          <label className="block text-xs font-medium text-stone-500 mb-1">{t.introduction}</label>
          <textarea
            value={bio}
            onChange={e => setBio(e.target.value)}
            rows={4}
            className="w-full px-3 py-2 rounded-lg border border-stone-200 bg-stone-50 text-sm focus:outline-none focus:ring-2 focus:ring-[#b8864a]/30 focus:border-[#b8864a] focus:bg-white resize-y"
            placeholder={t.bioPlaceholder}
          />
        </div>

        {/* Skills */}
        <div className="mb-4">
          <label className="block text-xs font-medium text-stone-500 mb-1">{t.skills}</label>
          <div className="flex flex-wrap gap-1.5 mb-2">
            {skills.map(s => (
              <span key={s} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs bg-[#f5f0e8] text-[#8a6534]">
                {s}
                <button type="button" onClick={() => setSkills(prev => prev.filter(x => x !== s))} className="hover:text-red-500">
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
          </div>
          <input
            type="text"
            value={skillInput}
            onChange={e => setSkillInput(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') {
                e.preventDefault();
                addSkill();
              }
            }}
            className={INPUT_CLS}
            placeholder={t.skillPlaceholder}
          />
        </div>

        {/* Work history */}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <label className="block text-xs font-medium text-stone-500">{t.workHistory}</label>
            <button
              type="button"
              onClick={() => setWorkHistory(prev => [...prev, { from: '', to: '', org: '', role: '' }])}
              className="inline-flex items-center gap-1 text-xs font-medium text-[#b8864a] hover:underline"
            >
              <Plus className="w-3.5 h-3.5" />
              {t.add}
            </button>
          </div>
          {workHistory.length === 0 ? (
            <p className="text-xs text-stone-400">{t.noWorkHistory}</p>
          ) : (
            <div className="space-y-2">
              {workHistory.map((w, idx) => (
                <div key={idx} className="grid grid-cols-2 sm:grid-cols-[80px_80px_1fr_1fr_auto] gap-2 items-center">
                  <input
                    type="text"
                    value={w.from}
                    onChange={e => setWorkHistory(prev => prev.map((x, i) => i === idx ? { ...x, from: e.target.value } : x))}
                    className={INPUT_CLS}
                    placeholder={t.from}
                  />
                  <input
                    type="text"
                    value={w.to}
                    onChange={e => setWorkHistory(prev => prev.map((x, i) => i === idx ? { ...x, to: e.target.value } : x))}
                    className={INPUT_CLS}
                    placeholder={t.to}
                  />
                  <input
                    type="text"
                    value={w.org}
                    onChange={e => setWorkHistory(prev => prev.map((x, i) => i === idx ? { ...x, org: e.target.value } : x))}
                    className={INPUT_CLS}
                    placeholder={t.companyOrg}
                  />
                  <input
                    type="text"
                    value={w.role}
                    onChange={e => setWorkHistory(prev => prev.map((x, i) => i === idx ? { ...x, role: e.target.value } : x))}
                    className={INPUT_CLS}
                    placeholder={t.role}
                  />
                  <button
                    type="button"
                    onClick={() => setWorkHistory(prev => prev.filter((_, i) => i !== idx))}
                    className="text-stone-400 hover:text-red-500 transition p-1 justify-self-end"
                    title={t.remove}
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Phone */}
        <div>
          <label className="block text-xs font-medium text-stone-500 mb-1">{t.contactPhone}</label>
          <div className="flex gap-2">
            <span className="inline-flex items-center h-10 px-3 rounded-lg border border-stone-200 bg-stone-100 text-sm text-stone-600 shrink-0">
              {phoneCode}
            </span>
            <input
              type="tel"
              inputMode="numeric"
              value={phoneDigits}
              onChange={e => { setPhoneDigits(e.target.value.replace(/\D/g, '')); setPhoneTouched(true); }}
              className={`${INPUT_CLS} ${phoneError ? 'border-red-400' : ''}`}
              placeholder={t.phoneNumber}
            />
          </div>
          {phoneError && <p className="text-xs text-red-500 mt-1">{phoneError}</p>}
        </div>
      </section>

      {/* ── Section 2: Documents ── */}
      <section className="bg-white rounded-xl border border-stone-200 p-5">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-stone-700 mb-4">
          <Award className="w-4 h-4 text-[#b8864a]" />
          {t.documents}
        </h2>

        {/* Certificates */}
        <div className="mb-5">
          <label className="block text-xs font-medium text-stone-500 mb-2">{t.certificates}</label>
          <div className="flex flex-wrap gap-2">
            {certificates.map((url, idx) => (
              <div key={`${url}-${idx}`} className="relative w-20 h-20 rounded-lg border border-stone-200 overflow-hidden bg-stone-50 group">
                {isPdf(url) ? (
                  <a href={resolveImageUrl(url)} target="_blank" rel="noopener noreferrer" className="w-full h-full flex flex-col items-center justify-center gap-1 text-stone-500 hover:text-[#b8864a]">
                    <FileText className="w-6 h-6" />
                    <span className="text-[10px]">PDF</span>
                  </a>
                ) : (
                  <a href={resolveImageUrl(url)} target="_blank" rel="noopener noreferrer">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={resolveImageUrl(url)} alt={`certificate ${idx + 1}`} className="w-full h-full object-cover" />
                  </a>
                )}
                <button
                  type="button"
                  onClick={() => setCertificates(prev => prev.filter((_, i) => i !== idx))}
                  className="absolute top-0.5 right-0.5 w-5 h-5 rounded-full bg-black/50 text-white flex items-center justify-center hover:bg-red-500 transition"
                  title={t.remove}
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={() => certInputRef.current?.click()}
              disabled={uploadingCert}
              className="w-20 h-20 rounded-lg border border-dashed border-stone-300 flex flex-col items-center justify-center gap-1 text-stone-400 hover:border-[#b8864a] hover:text-[#b8864a] transition disabled:opacity-50"
            >
              {uploadingCert ? <Loader2 className="w-5 h-5 animate-spin" /> : <Plus className="w-5 h-5" />}
              <span className="text-[10px]">{t.upload}</span>
            </button>
            <input
              ref={certInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,application/pdf"
              multiple
              className="hidden"
              onChange={e => { handleCertFiles(e.target.files); e.target.value = ''; }}
            />
          </div>
          <p className="text-[11px] text-stone-400 mt-1.5">{t.certHint}</p>
        </div>

        {/* Business license */}
        <div>
          <label className="block text-xs font-medium text-stone-500 mb-2">{t.businessLicense}</label>
          <div className="flex items-center gap-2">
            {licenseUrl ? (
              <div className="relative w-20 h-20 rounded-lg border border-stone-200 overflow-hidden bg-stone-50">
                {isPdf(licenseUrl) ? (
                  <a href={resolveImageUrl(licenseUrl)} target="_blank" rel="noopener noreferrer" className="w-full h-full flex flex-col items-center justify-center gap-1 text-stone-500 hover:text-[#b8864a]">
                    <FileText className="w-6 h-6" />
                    <span className="text-[10px]">PDF</span>
                  </a>
                ) : (
                  <a href={resolveImageUrl(licenseUrl)} target="_blank" rel="noopener noreferrer">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={resolveImageUrl(licenseUrl)} alt="license" className="w-full h-full object-cover" />
                  </a>
                )}
                <button
                  type="button"
                  onClick={() => setLicenseUrl('')}
                  className="absolute top-0.5 right-0.5 w-5 h-5 rounded-full bg-black/50 text-white flex items-center justify-center hover:bg-red-500 transition"
                  title={t.remove}
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => licenseInputRef.current?.click()}
                disabled={uploadingLicense}
                className="w-20 h-20 rounded-lg border border-dashed border-stone-300 flex flex-col items-center justify-center gap-1 text-stone-400 hover:border-[#b8864a] hover:text-[#b8864a] transition disabled:opacity-50"
              >
                {uploadingLicense ? <Loader2 className="w-5 h-5 animate-spin" /> : <Upload className="w-5 h-5" />}
                <span className="text-[10px]">{t.upload}</span>
              </button>
            )}
            <input
              ref={licenseInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,application/pdf"
              className="hidden"
              onChange={e => { handleLicenseFile(e.target.files?.[0]); e.target.value = ''; }}
            />
          </div>
          <p className="text-[11px] text-stone-400 mt-1.5">
            {t.licenseHint}
          </p>
        </div>
      </section>

      {/* Save */}
      <div className="space-y-2">
        {saveMsg && (
          <div className={`text-sm rounded-lg px-3 py-2 border ${
            saveMsg.type === 'success'
              ? 'text-green-700 bg-green-50 border-green-200'
              : 'text-red-600 bg-red-50 border-red-200'
          }`}>
            {saveMsg.text}
          </div>
        )}
        <button
          type="button"
          onClick={handleSave}
          disabled={saving || uploadingAvatar || uploadingCert || uploadingLicense}
          className="w-full sm:w-auto h-11 px-8 rounded-lg bg-[#b8864a] text-white text-sm font-medium hover:bg-[#a67c47] transition-colors disabled:opacity-50"
        >
          {saving
            ? t.savingDots
            : profileExists
              ? t.saveChanges
              : t.submitForReview}
        </button>
      </div>

      {/* ── Section 3: Inbox ── */}
      <section className="bg-white rounded-xl border border-stone-200 p-5">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-stone-700 mb-4">
          <Inbox className="w-4 h-4 text-[#b8864a]" />
          {t.messageInbox}
          {inquiries.length > 0 && <span className="text-xs text-stone-400 font-normal">{inquiries.length}</span>}
        </h2>
        {inquiries.length === 0 ? (
          <p className="text-sm text-stone-400">{t.noMessages}</p>
        ) : (
          <div className="divide-y divide-stone-100">
            {inquiries.map(q => (
              <div key={q.id} className="py-3 first:pt-0 last:pb-0">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mb-1">
                  <span className="text-sm font-medium text-[#2c2c2c]">{q.name}</span>
                  {q.phone && (
                    <a href={`tel:${q.phone}`} className="inline-flex items-center gap-1 text-xs text-[#b8864a] hover:underline">
                      <PhoneIcon className="w-3 h-3" />
                      {q.phone}
                    </a>
                  )}
                  <span className="text-xs text-stone-400 ml-auto">
                    {q.created_at ? new Date(q.created_at).toLocaleString(lang === 'vi' ? 'vi-VN' : 'en-GB') : ''}
                  </span>
                </div>
                <p className="text-sm text-stone-600 whitespace-pre-line">{q.message}</p>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ── Section 4: My Stats ── */}
      <section className="bg-white rounded-xl border border-stone-200 p-5">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-stone-700 mb-4">
          <BarChart3 className="w-4 h-4 text-[#b8864a]" />
          {t.myStats}
        </h2>
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-xl bg-stone-50 border border-stone-100 p-4 text-center">
            <p className="text-2xl font-bold text-[#2c2c2c] tabular-nums">{stats.phoneReveals}</p>
            <p className="text-xs text-stone-500 mt-1">{t.phoneReveals}</p>
          </div>
          <div className="rounded-xl bg-stone-50 border border-stone-100 p-4 text-center">
            <p className="text-2xl font-bold text-[#2c2c2c] tabular-nums">{stats.inquiries}</p>
            <p className="text-xs text-stone-500 mt-1">{t.messagesReceived}</p>
          </div>
        </div>
      </section>
    </div>
  );
}
