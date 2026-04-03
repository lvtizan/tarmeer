import { useState, useEffect, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight, Check, MapPin, Phone, Ruler, DollarSign, ImagePlus,
  Trash2, Eye, GripVertical, X, ChevronLeft, ChevronRight, FolderOpen,
} from 'lucide-react';
import { api } from '../../lib/api';
import Avatar from '../../components/ui/Avatar';
import {
  convertProjectImagesForUpload, estimateDataUrlBytes, formatFileSize,
  MAX_ESTIMATED_PAYLOAD_BYTES, MAX_TOTAL_UPLOAD_BYTES, buildUploadSizeMessage,
} from '../../lib/projectImageUpload';

/* ── Constants ── */

const AREA_OPTIONS = ['<50m²', '50-100m²', '100-200m²', '200-500m²', '>500m²'];
const EMIRATES = ['Dubai','Abu Dhabi','Sharjah','Ajman','Ras Al Khaimah','Fujairah','Umm Al Quwain'];
const STAGE_OPTIONS = ['Researching', 'Has Design', 'Ready to Start', 'In Progress'];
const BUDGET_OPTIONS = ['<50K AED', '50-100K', '100-300K', '300K-1M', '>1M AED'];

const fieldCls = "h-12 w-full rounded-lg border border-stone-200 bg-stone-50 px-4 text-[#2c2c2c] outline-none focus:border-[#b8864a] focus:ring-2 focus:ring-[#b8864a]/35 transition-colors";
const textareaCls = "w-full rounded-lg border border-stone-200 bg-stone-50 px-4 py-3 text-[#2c2c2c] outline-none focus:border-[#b8864a] focus:ring-2 focus:ring-[#b8864a]/35 resize-none transition-colors";
const labelCls = "mb-2 block text-sm font-semibold text-stone-700";
const tagActive = "border-[#b8864a] bg-[#b8864a] text-white";
const tagInactive = "border-stone-200 bg-stone-50 text-stone-700 hover:border-[#b8864a]/45";

/* ── Types ── */

interface Profile {
  area_range: string; city: string; address: string; phone: string;
  stage: string; budget_range: string; notes: string;
}
interface UserData {
  id: number; full_name: string; email: string; phone: string;
  city: string; avatar_url: string; created_at: string;
}

const EMPTY: Profile = { area_range:'', city:'Dubai', address:'', phone:'', stage:'', budget_range:'', notes:'' };

function reorder<T>(items: T[], from: number, to: number): T[] {
  if (from === to) return items;
  const next = [...items]; const [m] = next.splice(from, 1); next.splice(to, 0, m); return next;
}

/* ── Checklist builder ── */

function buildChecklist(profile: Profile | null, photoCount: number) {
  const hasReq = !!(profile?.area_range && profile?.city && profile?.phone);
  return [
    { step: 1, title: 'Submit renovation requirements', description: 'Area, city, phone and budget — helps us match you with companies.', done: hasReq, to: '#requirements' },
    { step: 2, title: 'Upload renovation progress', description: 'Share before/after photos of your project. Optional but helps others!', done: photoCount > 0, to: '#photos' },
    { step: 3, title: 'Get matched with a company', description: 'Our team will connect you with a verified renovation company.', done: false, to: '/companies' },
  ];
}

/* ════════════════════════════════════════════════════════════
   Main Component
   ════════════════════════════════════════════════════════════ */

export default function HomeownerDashboardPage() {
  const [user, setUser] = useState<UserData | null>(null);
  const [profile, setProfile] = useState<Profile>(EMPTY);
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
      try {
        const me = await api.get('/auth/me');
        if (me.user) setUser(me.user);
      } catch {}
      try {
        const res = await api.get('/auth/homeowner/profile');
        const d = res.profile || res.data || res;
        if (d && d.area_range) { setProfile({ area_range: d.area_range || '', city: d.city || 'Dubai', address: d.address || '', phone: d.phone || '', stage: d.stage || '', budget_range: d.budget_range || '', notes: d.notes || '' }); setIsNew(false); }
      } catch {}
      setLoading(false);
    })();
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
    } catch (e: any) { setUploadNotice(e.message || 'Failed'); }
    finally { setIsPrepping(false); }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.length) { await addFiles(e.target.files); e.target.value = ''; }
  };
  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault(); setIsDropActive(false);
    if (e.dataTransfer.files?.length) await addFiles(e.dataTransfer.files);
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
  const completedSteps = checklist.filter(c => c.done).length;

  return (
    <div className="w-full">
      <div className="mx-auto w-full max-w-[1440px] px-6 lg:px-7 space-y-6">

        {/* ── Sticky top bar ── */}
        <div className="sticky top-3 z-20 rounded-[24px] border border-stone-200 bg-[#faf9f7]/95 px-5 py-3.5 shadow-[0_12px_30px_rgba(28,18,8,0.08)] backdrop-blur md:px-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-[#2c2c2c]">Hi {firstName}, let's renovate!</h1>
              <p className="text-sm text-stone-500">Complete the steps below to get matched with a company.</p>
            </div>
            <div className="flex items-center gap-3">
              {saveText && (
                <span className={`text-sm font-medium ${saveText === 'Saved' ? 'text-emerald-600' : 'text-stone-400'}`}>
                  {saving && <span className="inline-block w-3 h-3 border-2 border-[#b8864a] border-t-transparent rounded-full animate-spin mr-1.5 align-middle" />}
                  {saveText}
                </span>
              )}
            </div>
          </div>
          {/* Checklist bar */}
          <div className="mt-3 rounded-2xl border border-stone-200 bg-white px-4 py-3">
            <div className="text-sm font-semibold text-[#2c2c2c] mb-2">Get Started — {completedSteps}/{checklist.length} done</div>
            <div className="space-y-2">
              {checklist.map(item => (
                <a key={item.step} href={item.to}
                  className="flex items-center gap-3 group">
                  <div className={`shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                    item.done ? 'bg-[#b8864a]/10 text-[#b8864a]' : 'bg-stone-100 text-stone-400'
                  }`}>
                    {item.done ? <Check className="w-3.5 h-3.5" /> : item.step}
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className={`text-sm font-medium ${item.done ? 'text-stone-400 line-through' : 'text-[#2c2c2c] group-hover:text-[#b8864a]'}`}>{item.title}</span>
                  </div>
                  {!item.done && <ArrowRight className="w-3.5 h-3.5 text-stone-300 group-hover:text-[#b8864a]" />}
                </a>
              ))}
            </div>
          </div>
        </div>

        {/* ══════ Two column grid ══════ */}
        <div id="requirements" className="grid w-full items-start gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,0.8fr)]">

          {/* ── LEFT: Renovation Requirements ── */}
          <section className="rounded-[24px] border border-stone-200 bg-white p-5 shadow-[0_20px_60px_rgba(28,18,8,0.05)]">
            <div className="mb-4">
              <h2 className="text-lg font-bold text-[#2c2c2c]">Renovation Requirements</h2>
              <p className="text-sm text-stone-500">Fill in your project details. Changes save automatically.</p>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {/* Area */}
              <div className="md:col-span-2">
                <label className={labelCls}><Ruler className="inline w-3.5 h-3.5 text-[#b8864a] mr-1" />Property Area *</label>
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
                <label className={labelCls}><MapPin className="inline w-3.5 h-3.5 text-[#b8864a] mr-1" />City *</label>
                <select value={profile.city} onChange={e => { set('city', e.target.value); triggerSave(); }}
                  className={fieldCls + " appearance-none cursor-pointer"}>
                  {EMIRATES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>

              {/* Phone */}
              <div>
                <label className={labelCls}><Phone className="inline w-3.5 h-3.5 text-[#b8864a] mr-1" />Phone *</label>
                <input type="tel" value={profile.phone} onChange={e => set('phone', e.target.value)}
                  onBlur={triggerSave} placeholder="+971 50 123 4567" className={fieldCls} />
              </div>

              {/* Address */}
              <div className="md:col-span-2">
                <label className={labelCls}>Address</label>
                <input type="text" value={profile.address} onChange={e => set('address', e.target.value)}
                  onBlur={triggerSave} placeholder="Your property address" className={fieldCls} />
              </div>

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
          </section>

          {/* ── RIGHT: Profile Summary ── */}
          <aside className="space-y-4 xl:sticky xl:top-28 xl:self-start">
            <section className="rounded-[24px] border border-stone-200 bg-white p-5 shadow-[0_18px_50px_rgba(28,18,8,0.06)]">
              <h2 className="text-lg font-bold text-[#2c2c2c] mb-4">Profile Summary</h2>
              <div className="flex items-center gap-4 mb-5">
                <Avatar name={user?.full_name || 'U'} avatarUrl={user?.avatar_url} size="lg" />
                <div>
                  <h3 className="text-lg font-bold text-[#2c2c2c]">{user?.full_name || 'Your Name'}</h3>
                  <p className="text-sm text-stone-500">{user?.email}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-stone-50 rounded-xl border border-stone-100 px-4 py-3">
                  <div className="text-[11px] text-stone-400 uppercase tracking-wider mb-1">City</div>
                  <div className="text-sm font-semibold text-[#2c2c2c]">{profile.city || 'Not set'}</div>
                </div>
                <div className="bg-stone-50 rounded-xl border border-stone-100 px-4 py-3">
                  <div className="text-[11px] text-stone-400 uppercase tracking-wider mb-1">Area</div>
                  <div className="text-sm font-semibold text-[#2c2c2c]">{profile.area_range || 'Not set'}</div>
                </div>
                <div className="bg-stone-50 rounded-xl border border-stone-100 px-4 py-3">
                  <div className="text-[11px] text-stone-400 uppercase tracking-wider mb-1">Stage</div>
                  <div className="text-sm font-semibold text-[#2c2c2c]">{profile.stage || 'Not set'}</div>
                </div>
                <div className="bg-stone-50 rounded-xl border border-stone-100 px-4 py-3">
                  <div className="text-[11px] text-stone-400 uppercase tracking-wider mb-1">Budget</div>
                  <div className="text-sm font-semibold text-[#2c2c2c]">{profile.budget_range || 'Not set'}</div>
                </div>
              </div>
              <Link to="/dashboard/profile" className="mt-4 block text-center text-sm font-medium text-[#b8864a] hover:text-[#a67c47]">
                Edit personal info →
              </Link>
            </section>
          </aside>
        </div>

        {/* ══════ Renovation Progress Photos ══════ */}
        <section id="photos" className="rounded-[24px] border border-stone-200 bg-white p-[18px] shadow-[0_18px_50px_rgba(28,18,8,0.06)]">
          <div className="mb-2.5 flex items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-[#2c2c2c]">My Renovation Progress</h2>
              <p className="mt-0.5 text-xs text-stone-500">
                {imageUrls.length > 0
                  ? `${imageUrls.length} photos · ${formatFileSize(imageUrls.reduce((s, u) => s + estimateDataUrlBytes(u), 0))}`
                  : 'Upload before/after photos of your renovation journey'}
              </p>
            </div>
            {imageUrls[coverIndex] && (
              <div className="w-[128px] rounded-xl border border-stone-200 bg-stone-50 p-1.5">
                <div className="text-[10px] font-semibold text-stone-500">Cover</div>
                <div className="mt-1 aspect-video w-full rounded-lg bg-cover bg-center"
                  style={{ backgroundImage: `url(${imageUrls[coverIndex]})` }} />
              </div>
            )}
          </div>

          {uploadNotice && (
            <div className="mb-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 flex items-center justify-between">
              {uploadNotice}
              <button type="button" onClick={() => setUploadNotice('')}><X className="w-3 h-3" /></button>
            </div>
          )}

          {/* Drop zone */}
          <input id="ho-gallery" type="file" accept="image/*" multiple className="hidden" onChange={handleFileSelect} disabled={isPrepping} />
          <input id="ho-folder" type="file" accept="image/*" multiple {...{ webkitdirectory: '', directory: '' } as any} className="hidden" onChange={handleFileSelect} disabled={isPrepping} />

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
              <div className="text-xs text-stone-500">Share your renovation progress — before, during, after!</div>
            </div>
            <label htmlFor="ho-folder" onClick={e => e.stopPropagation()}
              className="shrink-0 flex items-center gap-1.5 rounded-lg border border-stone-200 bg-white px-3 py-2 text-xs font-semibold text-stone-700 cursor-pointer hover:bg-stone-50">
              <FolderOpen className="w-3.5 h-3.5" /> Select Folder
            </label>
          </label>

          {/* Image grid */}
          <div className="mt-3 max-h-[420px] overflow-y-auto">
            {imageUrls.length > 0 ? (
              <div className="grid grid-cols-4 gap-2 sm:grid-cols-5 lg:grid-cols-6">
                {imageUrls.map((url, i) => (
                  <div key={i} draggable
                    onDragStart={() => setDraggedIdx(i)}
                    onDragOver={e => { e.preventDefault(); if (dragOverIdx !== i) setDragOverIdx(i); }}
                    onDrop={e => { e.preventDefault(); if (draggedIdx !== null) moveImage(draggedIdx, i); setDraggedIdx(null); setDragOverIdx(null); }}
                    onDragEnd={() => { setDraggedIdx(null); setDragOverIdx(null); }}
                    className={`group relative aspect-square overflow-hidden rounded-xl border bg-stone-100 transition ${
                      coverIndex === i ? 'border-[#b8864a] ring-2 ring-[#b8864a]/35' : dragOverIdx === i ? 'border-[#b8864a]/70' : 'border-stone-200'
                    } ${draggedIdx === i ? 'opacity-80 cursor-grabbing' : 'cursor-grab'}`}>
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
              <div className="rounded-2xl border border-stone-200 bg-stone-50 px-4 py-10 text-center text-sm text-stone-500">
                Upload photos to share your renovation progress with the community.
              </div>
            )}
          </div>
        </section>
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
