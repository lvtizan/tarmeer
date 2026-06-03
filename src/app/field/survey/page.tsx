'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Camera, X } from 'lucide-react';
import { fieldApi } from '@/lib/adminApi';
import ChipSelect from '@/components/field/ChipSelect';
import WatermarkCamera, { type CapturedPhoto } from '@/components/field/WatermarkCamera';

interface SurveyField {
  key: string;
  label: string;
  type: string;
  options: string[];
}

interface SurveySection {
  title: string;
  key: string;
  fields: SurveyField[];
}

type SectionData = Record<string, string | string[]>;
type AllSections = { [key: string]: SectionData };

interface PhotoRecord {
  _id?: string;      // local unique ID for update targeting
  dataUrl: string;   // local preview (always available)
  url: string;       // server URL (empty until upload completes)
  uploading?: boolean;
  error?: string;
  lat?: number;
  lng?: number;
  timestamp: string;
}

interface DraftData {
  id: number;
  company_name?: string;
  company_ref_id?: number;
  [key: string]: unknown;
}

interface CompanySuggestion {
  id: number;
  name: string;
  city?: string;
  source?: string;
}

export default function FieldSurveyPage() {
  const [draftId, setDraftId] = useState<number | null>(null);
  const [companyName, setCompanyName] = useState('');
  const [companyRefId, setCompanyRefId] = useState<number | null>(null);
  const [companyRefName, setCompanyRefName] = useState('');
  const [companyRefSource, setCompanyRefSource] = useState<string>('uae');
  const [sections, setSections] = useState<AllSections>({});
  const [schema, setSchema] = useState<SurveySection[] | null>(null);
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'idle'>('idle');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [companySuggestions, setCompanySuggestions] = useState<CompanySuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const [photos, setPhotos] = useState<PhotoRecord[]>([]);
  const [lightboxPhoto, setLightboxPhoto] = useState<PhotoRecord | null>(null);
  const [companyNameError, setCompanyNameError] = useState(false);
  const [companySearchQuery, setCompanySearchQuery] = useState('');
  const [companySearching, setCompanySearching] = useState(false);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const companySearchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const companyNameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    (async () => {
      try {
        const { schema: remoteSchema } = await fieldApi.getSurveySchema() as { schema: SurveySection[] | null };
        if (remoteSchema && Array.isArray(remoteSchema) && remoteSchema.length > 0) {
          setSchema(remoteSchema);
        }
      } catch { /* schema unavailable */ }

      try {
        const storedId = typeof window !== 'undefined' ? localStorage.getItem('field_draft_id') : null;
        if (storedId) {
          const { draft } = await fieldApi.getDraft(Number(storedId)) as { draft: DraftData };
          if (draft) {
            hydrateDraft(draft);
            return;
          }
        }
        const { id } = await fieldApi.createDraft() as { id: number };
        setDraftId(id);
        if (typeof window !== 'undefined') localStorage.setItem('field_draft_id', String(id));
      } catch { /* silent */ }
    })();
  }, []);

  function hydrateDraft(draft: DraftData) {
    setDraftId(draft.id);
    setCompanyName(draft.company_name || '');
    setCompanyRefId(draft.company_ref_id || null);
    const restored: AllSections = {};
    for (let i = 1; i <= 9; i++) {
      const key = `section_${i}`;
      if (draft[key]) {
        try {
          restored[key] = typeof draft[key] === 'string' ? JSON.parse(draft[key] as string) : draft[key] as SectionData;
        } catch {
          restored[key] = {};
        }
      }
    }
    setSections(restored);
    if (draft.photos) {
      const raw = typeof draft.photos === 'string' ? JSON.parse(draft.photos as string) : draft.photos;
      if (Array.isArray(raw)) {
        setPhotos((raw as PhotoRecord[]).map(p => ({ ...p, dataUrl: p.url || '' })));
      }
    }
  }

  async function handlePhotoTaken(captured: CapturedPhoto) {
    const photoId = Date.now().toString();
    const record: PhotoRecord = {
      dataUrl: captured.dataUrl,
      url: '',
      uploading: !!draftId,
      lat: captured.lat,
      lng: captured.lng,
      timestamp: captured.timestamp,
    };
    setPhotos(prev => [...prev, { ...record, _id: photoId }]);
    if (!draftId) return; // show photo locally; upload skipped (no draft yet)
    try {
      const { url } = await fieldApi.uploadPhoto(draftId, captured.blob, {
        lat: captured.lat,
        lng: captured.lng,
        timestamp: captured.timestamp,
      });
      setPhotos(prev => prev.map((p) => p._id === photoId ? { ...p, url, uploading: false } : p));
    } catch {
      setPhotos(prev => prev.map((p) => p._id === photoId ? { ...p, uploading: false, error: 'Upload failed' } : p));
    }
  }

  function removePhoto(idx: number) {
    setPhotos(prev => prev.filter((_, i) => i !== idx));
  }

  const triggerSave = useCallback((id: number, cName: string, cRefId: number | null, cRefSource: string, secs: AllSections) => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(async () => {
      setSaveStatus('saving');
      try {
        await fieldApi.saveDraft(id, {
          company_name: cName,
          company_ref_id: cRefId,
          company_ref_source: cRefSource,
          ...Object.fromEntries(Object.entries(secs).map(([k, v]) => [k, v])),
        });
        setSaveStatus('saved');
      } catch {
        setSaveStatus('idle');
      }
    }, 500);
  }, []);

  function updateSection(sectionKey: string, fieldKey: string, value: string | string[]) {
    setSections((prev) => {
      const updated = { ...prev, [sectionKey]: { ...(prev[sectionKey] || {}), [fieldKey]: value } };
      if (draftId) triggerSave(draftId, companyName, companyRefId, companyRefSource, updated);
      return updated;
    });
  }

  function handleCompanySearchChange(val: string) {
    setCompanySearchQuery(val);
    // Clear any previously selected company when user starts re-typing
    if (companyRefId) {
      setCompanyRefId(null);
      setCompanyRefName('');
      setCompanyName('');
    }
    if (companySearchTimerRef.current) clearTimeout(companySearchTimerRef.current);
    if (val.length >= 1) {
      setCompanySearching(true);
      companySearchTimerRef.current = setTimeout(async () => {
        try {
          const { results } = await fieldApi.searchCompanies(val) as { results: CompanySuggestion[] };
          setCompanySuggestions(results);
          setShowSuggestions(results.length > 0);
        } catch {
          setShowSuggestions(false);
        } finally {
          setCompanySearching(false);
        }
      }, 300);
    } else {
      setCompanySuggestions([]);
      setShowSuggestions(false);
      setCompanySearching(false);
    }
  }

  function selectCompany(company: CompanySuggestion) {
    const src = company.source || 'uae';
    setCompanyRefId(company.id);
    setCompanyRefName(company.name);
    setCompanyName(company.name);
    setCompanyRefSource(src);
    setCompanySearchQuery('');
    setShowSuggestions(false);
    setCompanyNameError(false);
    if (draftId) triggerSave(draftId, company.name, company.id, src, sections);
  }

  function clearSelectedCompany() {
    setCompanyRefId(null);
    setCompanyRefName('');
    setCompanyName('');
    setCompanyRefSource('uae');
    setCompanySearchQuery('');
    setShowSuggestions(false);
    // Persist the cleared company to server so reload doesn't restore old company
    if (draftId) triggerSave(draftId, '', null, 'uae', sections);
    setTimeout(() => companyNameRef.current?.focus(), 50);
  }

  async function handleSubmit() {
    // Validate: must select a company from the system
    if (!companyRefId) {
      setCompanyNameError(true);
      companyNameRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      companyNameRef.current?.focus();
      return;
    }
    if (!draftId) {
      alert('Draft not ready yet — please wait a moment and try again.');
      return;
    }
    setIsSubmitting(true);
    try {
      await fieldApi.submit(draftId);
      if (typeof window !== 'undefined') localStorage.removeItem('field_draft_id');
      setSubmitted(true);
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'Failed to submit');
    } finally {
      setIsSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-[#faf9f7] flex flex-col items-center justify-center px-6">
        <div className="w-full max-w-sm bg-white rounded-3xl shadow-sm border border-stone-100 px-8 py-10 flex flex-col items-center text-center">
          <div className="w-16 h-16 rounded-full bg-green-50 flex items-center justify-center mb-5">
            <svg className="w-8 h-8 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="text-xl font-bold text-[#1c1917] mb-2">Interview Submitted</h1>
          <p className="text-stone-400 text-[14px] mb-8">Record saved successfully.</p>
          <button
            onClick={() => {
              if (typeof window !== 'undefined') localStorage.removeItem('field_draft_id');
              window.location.reload();
            }}
            className="btn-primary w-full"
          >
            Start New Interview
          </button>
        </div>
      </div>
    );
  }

  /* ── 未选公司：搜索界面 ── */
  if (!companyRefId) {
    return (
      <div className="min-h-screen bg-[#faf9f7] flex flex-col">
        {/* Hero 引导区 */}
        <div className="bg-white border-b border-stone-100 px-6 pt-12 pb-8 text-center">
          <div className="w-14 h-14 rounded-2xl bg-[#b8864a]/10 flex items-center justify-center mx-auto mb-4">
            <svg className="w-7 h-7 text-[#b8864a]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-[#1c1917] mb-2">Field Survey</h1>
          <p className="text-[15px] text-stone-500 leading-relaxed">
            Search for a registered company<br />then tap <strong className="font-semibold text-[#b8864a]">Match</strong> to start the survey
          </p>
        </div>

        {/* 搜索区 */}
        <div className="flex-1 px-4 pt-5 max-w-lg mx-auto w-full">
          <input
            ref={companyNameRef}
            value={companySearchQuery}
            onChange={(e) => handleCompanySearchChange(e.target.value)}
            placeholder="Search company name…"
            autoComplete="off"
            autoFocus
            className="w-full h-[52px] px-5 rounded-2xl border border-stone-200 bg-white text-[15px] text-[#1c1917] placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-[#B8864A]/15 focus:border-[#B8864A] shadow-sm"
          />
          {companySuggestions.length > 0 && (
            <div className="mt-3 bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden">
              {companySuggestions.map((c) => (
                <div
                  key={c.id}
                  className="flex items-center gap-3 px-4 py-3.5 border-b border-stone-100 last:border-0"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-[15px] font-medium text-[#1c1917] truncate">{c.name}</p>
                    {c.city && <p className="text-xs text-stone-400 mt-0.5">{c.city}</p>}
                  </div>
                  <button
                    type="button"
                    onClick={() => selectCompany(c)}
                    className="shrink-0 h-8 px-4 rounded-full bg-[#b8864a] text-white text-sm font-semibold active:opacity-80 transition-opacity"
                  >
                    Match
                  </button>
                </div>
              ))}
            </div>
          )}
          {companySearchQuery.length >= 1 && !companySearching && companySuggestions.length === 0 && (
            <p className="mt-6 text-center text-sm text-stone-400">No companies found</p>
          )}
          {companySearchQuery.length === 0 && (
            <p className="mt-6 text-center text-xs text-stone-300">Type to search companies</p>
          )}
        </div>
      </div>
    );
  }

  /* ── 已选公司：问卷界面 ── */
  return (
    <div className="min-h-screen bg-[#faf9f7] pb-28">
      {/* 顶部：已选公司 + 保存状态 */}
      <div className="sticky top-0 z-10 bg-white border-b border-stone-200 px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="flex-1 min-w-0">
            <p className="text-xs text-stone-400 leading-none mb-0.5">Surveying</p>
            <p className="text-[15px] font-semibold text-[#1c1917] truncate">{companyRefName}</p>
          </div>
          <button
            type="button"
            onClick={clearSelectedCompany}
            className="shrink-0 text-xs text-stone-400 hover:text-[#b8864a] transition-colors font-medium"
          >
            Change
          </button>
          <span className={`shrink-0 text-xs ${saveStatus === 'saving' ? 'text-stone-400' : saveStatus === 'saved' ? 'text-green-600' : 'text-stone-300'}`}>
            {saveStatus === 'saving' ? 'Saving…' : saveStatus === 'saved' ? '✓ Saved' : ''}
          </span>
        </div>
      </div>

      <div className="px-4 pt-6 space-y-8 max-w-lg mx-auto">
        {/* Photos section */}
        <div>
          <h2 className="text-base font-bold text-[#2c2c2c] mb-3 pl-3 border-l-4 border-[#b8864a]">
            Photos {photos.length > 0 && <span className="text-stone-400 font-normal text-sm">({photos.length})</span>}
          </h2>
          {photos.length > 0 && (
            <div className="grid grid-cols-3 gap-2 mb-3">
              {photos.map((photo, idx) => (
                <div key={photo._id || idx} className="relative aspect-square rounded-xl overflow-hidden border border-stone-200 bg-stone-100">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={photo.dataUrl || photo.url}
                    alt={`Photo ${idx + 1}`}
                    className="w-full h-full object-cover cursor-pointer"
                    onClick={() => setLightboxPhoto(photo)}
                  />
                  {photo.uploading && (
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                      <div className="w-4 h-4 border border-white/40 border-t-white rounded-full animate-spin" />
                    </div>
                  )}
                  {photo.error && (
                    <div className="absolute bottom-0 left-0 right-0 bg-red-500/80 text-white text-[10px] text-center py-0.5">failed</div>
                  )}
                  <button
                    onClick={() => removePhoto(idx)}
                    className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/60 flex items-center justify-center"
                  >
                    <X className="w-3 h-3 text-white" />
                  </button>
                </div>
              ))}
            </div>
          )}
          <p className="text-xs text-stone-400">{photos.length === 0 ? 'No photos yet — tap 📷 below to add.' : 'Tap a photo to enlarge · tap 📷 to add more.'}</p>
        </div>

        {!schema ? (
          <div className="flex justify-center py-8">
            <div className="w-5 h-5 border-2 border-[#b8864a]/30 border-t-[#b8864a] rounded-full animate-spin" />
          </div>
        ) : schema.map((section) => (
          <div key={section.key}>
            <h2 className="text-base font-bold text-[#2c2c2c] mb-4 pl-3 border-l-4 border-[#b8864a]">
              {section.title}
            </h2>
            <div className="space-y-5">
              {section.fields.map((field) => {
                const sectionData = sections[section.key] || {};
                const val = sectionData[field.key] ?? (field.type === 'multi' ? [] : '');
                return (
                  <div key={field.key}>
                    <label className="block text-sm font-medium text-stone-500 mb-2">{field.label}</label>
                    <ChipSelect
                      options={field.options}
                      value={val}
                      multi={field.type === 'multi'}
                      onChange={(v) => updateSection(section.key, field.key, v)}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-stone-200 px-4 py-3 flex gap-3">
        <button
          onClick={() => setShowCamera(true)}
          className="flex items-center justify-center gap-2 h-12 px-5 rounded-2xl border-2 border-[#b8864a] text-[#b8864a] font-semibold text-[15px] active:bg-[#b8864a]/10 transition flex-shrink-0"
        >
          <Camera className="w-5 h-5" />
          <span>Photo</span>
        </button>
        <button
          onClick={handleSubmit}
          disabled={isSubmitting}
          className="btn-primary flex-1 h-12 disabled:opacity-50"
        >
          {isSubmitting ? 'Submitting…' : 'Submit Survey'}
        </button>
      </div>

      {/* Watermark Camera overlay */}
      {showCamera && (
        <WatermarkCamera
          onClose={() => setShowCamera(false)}
          onPhotoTaken={handlePhotoTaken}
        />
      )}

      {/* Lightbox */}
      {lightboxPhoto && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center"
          onClick={() => setLightboxPhoto(null)}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={lightboxPhoto.dataUrl || lightboxPhoto.url}
            alt="Photo preview"
            className="max-w-full max-h-full object-contain"
          />
          <button
            onClick={() => setLightboxPhoto(null)}
            className="absolute top-4 right-4 w-10 h-10 rounded-full bg-black/50 flex items-center justify-center"
          >
            <X className="w-5 h-5 text-white" />
          </button>
        </div>
      )}
    </div>
  );
}
