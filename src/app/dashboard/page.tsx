'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Check, MapPin, Phone, Ruler, DollarSign, ImagePlus,
  Trash2, Eye, GripVertical, X, ChevronLeft, ChevronRight, FolderOpen, Briefcase,
} from 'lucide-react';
import { api } from '@/lib/api';
import { getDroppedImageFiles } from '@/lib/dropFiles';
import WelcomeHeader from '@/components/portal/WelcomeHeader';
import OnboardingStepper, { type PortalStep } from '@/components/portal/OnboardingStepper';
import {
  convertProjectImagesForUpload, estimateDataUrlBytes, formatFileSize,
  MAX_ESTIMATED_PAYLOAD_BYTES, MAX_TOTAL_UPLOAD_BYTES, buildUploadSizeMessage,
} from '@/lib/projectImageUpload';
import { useSiteLocale } from '@/contexts/SiteLocaleContext';
import { countryFromLang } from '@/lib/country';

/* ── Constants ── */

const AREA_OPTIONS = ['<50m²', '50-100m²', '100-200m²', '200-500m²', '>500m²'];
const STAGE_OPTIONS = ['Researching', 'Has Design', 'Ready to Start', 'In Progress'];
const BUDGET_OPTIONS_BY_COUNTRY: Record<string, string[]> = {
  ae: ['<50K AED', '50-100K', '100-300K', '300K-1M', '>1M AED'],
  vn: ['<200M VND', '200-500M', '500M-1B', '1-2B', '2B+ VND'],
};

const fieldCls = "h-12 w-full rounded-lg border border-stone-200 bg-white px-4 text-[#2c2c2c] outline-none focus:border-[#b8864a] focus:ring-2 focus:ring-[#b8864a]/35 transition-colors";
const textareaCls = "w-full rounded-lg border border-stone-200 bg-white px-4 py-3 text-[#2c2c2c] outline-none focus:border-[#b8864a] focus:ring-2 focus:ring-[#b8864a]/35 resize-none transition-colors";
const labelCls = "mb-2 block text-sm font-semibold text-stone-700";
const tagActive = "border-[#b8864a] bg-[#b8864a] text-white";
const tagInactive = "border-stone-200 bg-stone-50 text-stone-700 hover:border-[#b8864a]/45";

/* ── Types ── */

interface Profile {
  area_range: string;
  city: string;
  address: string;
  phone: string;
  stage: string;
  budget_range: string;
  notes: string;
}

interface UserData {
  id: number;
  full_name: string;
  email: string;
  phone: string;
  city: string;
  avatar_url: string;
  created_at: string;
}

const EMPTY: Profile = { area_range: '', city: '', address: '', phone: '', stage: '', budget_range: '', notes: '' };

function reorder<T>(items: T[], from: number, to: number): T[] {
  if (from === to) return items;
  const next = [...items];
  const [m] = next.splice(from, 1);
  next.splice(to, 0, m);
  return next;
}

/* ── Checklist builder ── */

interface ChecklistStep {
  step: number;
  label: string;
  desc: string;
  done: boolean;
  to: string;
  actionLabel: string;
}

function buildChecklist(profile: Profile | null, photoCount: number): ChecklistStep[] {
  const hasReq = !!(profile?.area_range && profile?.city && profile?.phone);
  return [
    {
      step: 1,
      label: 'Submit Requirements',
      desc: hasReq ? 'Project details saved' : 'Add area, city & phone',
      done: hasReq,
      to: '#requirements',
      actionLabel: hasReq ? 'Edit Details' : 'Complete Now',
    },
    {
      step: 2,
      label: 'Upload Photos',
      desc: photoCount > 0 ? `${photoCount} photo${photoCount !== 1 ? 's' : ''} uploaded` : 'Share before/after photos',
      done: photoCount > 0,
      to: '#photos',
      actionLabel: photoCount > 0 ? 'Add More' : 'Upload Now',
    },
    {
      step: 3,
      label: 'Get Matched',
      desc: 'Browse verified companies and send your needs',
      done: false,
      to: '/companies',
      actionLabel: 'Browse Companies',
    },
  ];
}

/* ════════════════════════════════════════════════════════════
   Main Component
   ════════════════════════════════════════════════════════════ */

export default function HomeownerDashboardPage() {
  const { lang } = useSiteLocale();
  const c = countryFromLang(lang);
  const EMIRATES = c.cities;
  const BUDGET_OPTIONS = BUDGET_OPTIONS_BY_COUNTRY[c.code];
  const router = useRouter();
  const [user, setUser] = useState<UserData | null>(null);
  const [switchingRole, setSwitchingRole] = useState(false);

  const handleSwitchToCompany = async () => {
    setSwitchingRole(true);
    try {
      await api.post('/auth/switch-role', { role: 'company' });
      localStorage.setItem('active_role', 'company');
      router.push('/company');
    } catch {
      setSwitchingRole(false);
    }
  };

  const [profile, setProfile] = useState<Profile>({ ...EMPTY, city: c.defaultCity });
  const [isNew, setIsNew] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveText, setSaveText] = useState('');
  const saveTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  /* image board */
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [imageFingerprints, setImageFingerprints] = useState<string[]>([]);
  const [coverIndex, setCoverIndex] = useState(0);
  const [isPrepping, setIsPrepping] = useState(false);
  const [isDropActive, setIsDropActive] = useState(false);
  const [draggedIdx, setDraggedIdx] = useState<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);
  const [previewIdx, setPreviewIdx] = useState<number | null>(null);
  const [uploadNotice, setUploadNotice] = useState('');

  /* ── Load ── */
  useEffect(() => {
    (async () => {
      let userPhone = '';
      try {
        const me = await api.get('/auth/me');
        if (me.user) { setUser(me.user); userPhone = me.user.phone || ''; }
      } catch { /* ignore */ }
      try {
        const res = await api.get('/auth/homeowner/profile');
        const d = res.profile || res.data || res;
        if (d && d.area_range) {
          setProfile({
            area_range: d.area_range || '',
            city: d.city || c.defaultCity,
            address: d.address || '',
            phone: d.phone || userPhone || '',
            stage: d.stage || '',
            budget_range: d.budget_range || '',
            notes: d.notes || '',
          });
          setIsNew(false);
        } else if (userPhone) {
          setProfile(prev => ({ ...prev, phone: userPhone }));
        }
      } catch {
        if (userPhone) { setProfile(prev => ({ ...prev, phone: userPhone })); }
      }
      setLoading(false);
    })();
  }, []);

  useEffect(() => {
    const handler = (e: Event) => {
      const phone = (e as CustomEvent).detail?.phone;
      if (phone) setProfile(prev => ({ ...prev, phone }));
    };
    window.addEventListener('phone-saved', handler);
    return () => window.removeEventListener('phone-saved', handler);
  }, []);

  /* ── Auto-save ── */
  const saveProfile = useCallback(async () => {
    if (!profile.area_range || !profile.city || !profile.phone) return;
    setSaving(true); setSaveText('Saving...');
    try {
      await api.post('/auth/homeowner/profile', profile);
      setIsNew(false); setSaveText('Saved');
      setTimeout(() => setSaveText(''), 2000);
    } catch { setSaveText('Save failed'); }
    finally { setSaving(false); }
  }, [profile]);

  const triggerSave = () => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(saveProfile, 600);
  };

  const set = (field: string, val: string) => setProfile(prev => ({ ...prev, [field]: val }));
  const setAndSave = (field: string, val: string) => { set(field, val); triggerSave(); };

  /* ── Image board ── */
  const addFiles = async (files: FileList | File[]) => {
    const raw = Array.from(files).filter(f => f.type.startsWith('image/'));
    const existing = new Set(imageFingerprints.filter(Boolean));
    const unique = raw.filter(f => !existing.has(`${f.name}:${f.size}:${f.lastModified}`));
    if (!unique.length) { setUploadNotice('No new images or all duplicates.'); return; }
    const totalBytes = unique.reduce((s, f) => s + f.size, 0);
    if (totalBytes > MAX_TOTAL_UPLOAD_BYTES) { setUploadNotice(buildUploadSizeMessage(totalBytes)); return; }
    setIsPrepping(true); setUploadNotice('');
    try {
      const prepared = await convertProjectImagesForUpload(unique);
      const existBytes = imageUrls.reduce((s, u) => s + estimateDataUrlBytes(u), 0);
      if (existBytes + prepared.estimatedPayloadBytes > MAX_ESTIMATED_PAYLOAD_BYTES) {
        setUploadNotice(`Gallery too large. Keep under ${formatFileSize(MAX_ESTIMATED_PAYLOAD_BYTES)}.`); return;
      }
      setImageUrls(prev => [...prev, ...prepared.dataUrls]);
      setImageFingerprints(prev => [...prev, ...unique.map(f => `${f.name}:${f.size}:${f.lastModified}`)]);
    } catch (e: unknown) {
      setUploadNotice(e instanceof Error ? e.message : 'Failed');
    } finally { setIsPrepping(false); }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.length) { await addFiles(e.target.files); e.target.value = ''; }
  };
  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault(); setIsDropActive(false);
    const result = await getDroppedImageFiles(e);
    if (result.files.length > 0) await addFiles(result.files);
  };
  const removeImage = (i: number) => {
    setImageUrls(prev => prev.filter((_, idx) => idx !== i));
    setImageFingerprints(prev => prev.filter((_, idx) => idx !== i));
    if (coverIndex >= i && coverIndex > 0) setCoverIndex(c => c - 1);
  };
  const moveImage = (from: number, to: number) => {
    setImageUrls(prev => reorder(prev, from, to));
    setImageFingerprints(prev => reorder(prev, from, to));
    if (coverIndex === from) setCoverIndex(to);
  };

  if (loading) return <div className="flex items-center justify-center py-20 text-stone-400">Loading...</div>;

  const firstName = (user?.full_name || '').split(' ')[0] || 'there';
  const checklist = buildChecklist(isNew ? null : profile, imageUrls.length);

  const goStep = (to: string) => {
    if (to.startsWith('#')) {
      document.querySelector(to)?.scrollIntoView({ behavior: 'smooth' });
    } else {
      router.push(to);
    }
  };

  const portalSteps: PortalStep[] = checklist.map((s) => ({
    label: s.label,
    desc: s.desc,
    done: s.done,
    actionLabel: s.actionLabel,
    onAction: () => goStep(s.to),
  }));

  return (
    <div className="w-full">

      <div className="mx-auto max-w-[1080px] space-y-6">

        {/* ── Welcome header ── */}
        <WelcomeHeader
          title={`Hi ${firstName}, let's renovate!`}
          subtitle="Complete the steps below to get matched with the right company."
        />

        {/* ── Getting Started stepper ── */}
        <OnboardingStepper steps={portalSteps} />

        {/* ── Company switch banner ── */}
        <div className="rounded-2xl border border-[#b8864a]/20 bg-[#b8864a]/5 px-5 py-3.5 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Briefcase className="w-4 h-4 text-[#b8864a] shrink-0" />
            <span className="text-sm text-[#2c2c2c]">Are you a renovation company? This is the homeowner dashboard.</span>
          </div>
          <button
            onClick={handleSwitchToCompany}
            disabled={switchingRole}
            className="shrink-0 text-sm font-semibold text-[#b8864a] hover:underline disabled:opacity-50"
          >
            {switchingRole ? 'Switching…' : 'Switch to Business →'}
          </button>
        </div>

        {/* ── 表单 + 照片 双列 ── */}
        <div className="grid gap-4 items-start xl:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">

        {/* 左：Renovation Requirements 表单 */}
        <section className="rounded-[24px] border border-stone-200 bg-white shadow-[0_20px_60px_rgba(28,18,8,0.05)]">

          {/* Card header */}
          <div className="flex items-center justify-between gap-4 px-6 pt-6 pb-5 border-b border-stone-100">
            <div>
              <h2 id="requirements" className="text-xl font-bold text-[#2c2c2c]">Renovation Requirements</h2>
              <p className="mt-0.5 text-sm text-stone-500">Fill in your project details. Changes save automatically.</p>
            </div>
            {saveText && (
              <span className={`text-sm font-medium flex items-center gap-1.5 ${saveText === 'Saved' ? 'text-emerald-600' : 'text-stone-400'}`}>
                {saving && <span className="inline-block w-3 h-3 border-2 border-[#b8864a] border-t-transparent rounded-full animate-spin" />}
                {saveText}
              </span>
            )}
          </div>

          <div className="px-6 py-5 space-y-6">

            {/* ── Section: Property Details ── */}
            <div>
              <h3 className="text-xs font-semibold text-stone-400 uppercase tracking-wider mb-4">Property Details</h3>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {/* Area */}
                <div className="md:col-span-2">
                  <label className={labelCls}>
                    <Ruler className="inline w-3.5 h-3.5 text-[#b8864a] mr-1" />
                    Property Area <span className="text-red-500">*</span>
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {AREA_OPTIONS.map(opt => (
                      <button key={opt} type="button" onClick={() => setAndSave('area_range', profile.area_range === opt ? '' : opt)}
                        className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${profile.area_range === opt ? tagActive : tagInactive}`}>
                        {opt}
                      </button>
                    ))}
                  </div>
                </div>

                {/* City */}
                <div>
                  <label className={labelCls}>
                    <MapPin className="inline w-3.5 h-3.5 text-[#b8864a] mr-1" />
                    City <span className="text-red-500">*</span>
                  </label>
                  <select value={profile.city} onChange={e => { set('city', e.target.value); triggerSave(); }}
                    className={fieldCls + " appearance-none cursor-pointer"}>
                    {EMIRATES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>

                {/* Phone */}
                <div>
                  <label className={labelCls}>
                    <Phone className="inline w-3.5 h-3.5 text-[#b8864a] mr-1" />
                    Phone <span className="text-red-500">*</span>
                  </label>
                  <input type="tel" value={profile.phone} onChange={e => set('phone', e.target.value)}
                    onBlur={triggerSave} placeholder={c.phonePlaceholder} className={fieldCls} />
                </div>

                {/* Address */}
                <div className="md:col-span-2">
                  <label className={labelCls}>Address</label>
                  <input type="text" value={profile.address} onChange={e => set('address', e.target.value)}
                    onBlur={triggerSave} placeholder="Your property address" className={fieldCls} />
                </div>
              </div>
            </div>

            <hr className="border-stone-100" />

            {/* ── Section: Project Details ── */}
            <div>
              <h3 className="text-xs font-semibold text-stone-400 uppercase tracking-wider mb-4">Project Details</h3>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {/* Stage */}
                <div className="md:col-span-2">
                  <label className={labelCls}>Project Stage</label>
                  <div className="flex flex-wrap gap-2">
                    {STAGE_OPTIONS.map(opt => (
                      <button key={opt} type="button" onClick={() => setAndSave('stage', profile.stage === opt ? '' : opt)}
                        className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${profile.stage === opt ? tagActive : tagInactive}`}>
                        {opt}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Budget */}
                <div className="md:col-span-2">
                  <label className={labelCls}><DollarSign className="inline w-3.5 h-3.5 text-[#b8864a] mr-1" />Budget</label>
                  <div className="flex flex-wrap gap-2">
                    {BUDGET_OPTIONS.map(opt => (
                      <button key={opt} type="button" onClick={() => setAndSave('budget_range', profile.budget_range === opt ? '' : opt)}
                        className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${profile.budget_range === opt ? tagActive : tagInactive}`}>
                        {opt}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Notes */}
                <div className="md:col-span-2">
                  <label className={labelCls}>Notes</label>
                  <textarea value={profile.notes} rows={3} onChange={e => set('notes', e.target.value)}
                    onBlur={triggerSave} placeholder="Style preferences, special requirements..." className={textareaCls} />
                </div>
              </div>
            </div>

          </div>
        </section>

        {/* 右：Renovation Photos 卡片（sticky，进页面即可见） */}
        <section id="photos" className="rounded-[24px] border border-stone-200 bg-white shadow-[0_20px_60px_rgba(28,18,8,0.05)] xl:sticky xl:top-6">
          <div className="flex items-start justify-between gap-3 px-6 pt-6 pb-5 border-b border-stone-100">
            <div>
              <h2 className="text-xl font-bold text-[#2c2c2c]">Renovation Photos</h2>
              <p className="mt-0.5 text-sm text-stone-500">
                {imageUrls.length > 0
                  ? `${imageUrls.length} photos · ${formatFileSize(imageUrls.reduce((s, u) => s + estimateDataUrlBytes(u), 0))}`
                  : 'Share before/after photos of your renovation journey'}
              </p>
            </div>
            {imageUrls[coverIndex] && (
              <div className="w-[80px] rounded-xl border border-stone-200 bg-stone-50 p-1.5 shrink-0">
                <div className="text-[10px] font-semibold text-stone-500 mb-1">Cover</div>
                <div className="aspect-video w-full rounded-lg bg-cover bg-center"
                  style={{ backgroundImage: `url(${imageUrls[coverIndex]})` }} />
              </div>
            )}
          </div>

          <div className="px-6 py-5">

              {uploadNotice && (
                <div className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 flex items-center justify-between">
                  {uploadNotice}
                  <button type="button" onClick={() => setUploadNotice('')}><X className="w-3 h-3" /></button>
                </div>
              )}

              <input id="ho-gallery" type="file" accept="image/*" multiple className="hidden" onChange={handleFileSelect} disabled={isPrepping} />
              <input id="ho-folder" type="file" accept="image/*" multiple {...{ webkitdirectory: '', directory: '' } as React.InputHTMLAttributes<HTMLInputElement>} className="hidden" onChange={handleFileSelect} disabled={isPrepping} />

              <label htmlFor="ho-gallery"
                onDrop={handleDrop}
                onDragOver={e => { e.preventDefault(); setIsDropActive(true); }}
                onDragLeave={() => setIsDropActive(false)}
                className={`flex cursor-pointer items-center gap-3 rounded-2xl border border-dashed px-3 py-3 transition ${
                  isDropActive ? 'border-[#b8864a] bg-amber-50' : 'border-stone-300 bg-stone-50 hover:bg-stone-100'
                }`}>
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white shadow-sm">
                  <ImagePlus className="h-5 w-5 text-stone-500" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-semibold text-[#2c2c2c]">{isPrepping ? 'Processing...' : 'Drop photos or folders here'}</div>
                  <div className="text-xs text-stone-500">Before, during, after — share your renovation journey</div>
                </div>
                <label htmlFor="ho-folder" onClick={e => e.stopPropagation()}
                  className="shrink-0 flex items-center gap-1.5 rounded-lg border border-stone-200 bg-white px-3 py-2 text-xs font-semibold text-stone-700 cursor-pointer hover:bg-stone-50">
                  <FolderOpen className="w-3.5 h-3.5" /> Select Folder
                </label>
              </label>

              <div className="mt-3">
                {imageUrls.length > 0 ? (
                  <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                    {imageUrls.map((url, i) => (
                      <div key={i} draggable
                        onDragStart={() => setDraggedIdx(i)}
                        onDragOver={e => { e.preventDefault(); if (dragOverIdx !== i) setDragOverIdx(i); }}
                        onDrop={e => { e.preventDefault(); if (draggedIdx !== null) moveImage(draggedIdx, i); setDraggedIdx(null); setDragOverIdx(null); }}
                        onDragEnd={() => { setDraggedIdx(null); setDragOverIdx(null); }}
                        className={`group relative aspect-square overflow-hidden rounded-xl border bg-stone-100 transition ${
                          coverIndex === i ? 'border-[#b8864a] ring-2 ring-[#b8864a]/35' : dragOverIdx === i ? 'border-[#b8864a]/70' : 'border-stone-200'
                        } ${draggedIdx === i ? 'opacity-80 cursor-grabbing' : 'cursor-grab'}`}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={url} alt="" className="h-full w-full object-cover" />
                        {coverIndex === i && <div className="absolute left-1.5 top-1.5 rounded-full bg-[#b8864a] px-2 py-0.5 text-[10px] font-semibold text-white">Cover</div>}
                        <div className="absolute right-1.5 top-1.5 rounded-full bg-black/55 p-1 text-white"><GripVertical className="h-3.5 w-3.5" /></div>
                        <div className="absolute inset-0 bg-black/45 opacity-0 group-hover:opacity-100 transition" />
                        <div className="absolute inset-x-1.5 bottom-1.5 grid h-6 grid-cols-3 gap-1 opacity-0 group-hover:opacity-100 transition">
                          <button type="button" onClick={() => setPreviewIdx(i)} className="rounded-md bg-white text-[10px] font-semibold text-stone-700"><Eye className="mx-auto h-3 w-3" /></button>
                          <button type="button" onClick={() => setCoverIndex(i)} className="rounded-md bg-white text-[10px] font-semibold text-stone-700">{coverIndex === i ? '✓' : 'Set'}</button>
                          <button type="button" onClick={() => removeImage(i)} className="rounded-md bg-white text-[10px] font-semibold text-red-600"><Trash2 className="mx-auto h-3 w-3" /></button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-2xl border border-stone-200 bg-stone-50 px-4 py-8 text-center text-sm text-stone-400">
                    Upload photos to share your renovation progress with the community.
                  </div>
                )}
              </div>
            </div>
          </section>
        </div>
      </div>

      {/* ── Image preview lightbox ── */}
      {previewIdx !== null && imageUrls[previewIdx] && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-4xl rounded-2xl bg-white p-4 shadow-2xl">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-sm font-semibold text-stone-700">{previewIdx + 1} / {imageUrls.length}</span>
              <button type="button" onClick={() => setPreviewIdx(null)} className="rounded-full p-1 text-stone-500 hover:bg-stone-100"><X className="h-4 w-4" /></button>
            </div>
            <div className="relative flex items-center justify-center rounded-xl bg-stone-100">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={imageUrls[previewIdx]} alt="" className="max-h-[65vh] w-auto object-contain" />
              {imageUrls.length > 1 && (<>
                <button type="button" onClick={() => setPreviewIdx(p => (p ?? 0) === 0 ? imageUrls.length - 1 : (p ?? 0) - 1)} className="absolute left-3 rounded-full bg-white/90 p-2"><ChevronLeft className="h-4 w-4" /></button>
                <button type="button" onClick={() => setPreviewIdx(p => ((p ?? 0) + 1) % imageUrls.length)} className="absolute right-3 rounded-full bg-white/90 p-2"><ChevronRight className="h-4 w-4" /></button>
              </>)}
            </div>
            <div className="mt-3 flex justify-end gap-2">
              <button type="button" onClick={() => setCoverIndex(previewIdx)} className="rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm font-semibold text-stone-700">
                {coverIndex === previewIdx ? 'Current Cover' : 'Set as Cover'}
              </button>
              <button type="button" onClick={() => { removeImage(previewIdx); setPreviewIdx(p => imageUrls.length <= 1 ? null : Math.min(p ?? 0, imageUrls.length - 2)); }}
                className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-600">Remove</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
