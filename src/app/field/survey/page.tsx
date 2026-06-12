'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Camera, X, MapPin, Trash2, Paperclip, FileText } from 'lucide-react';
import { fieldApi } from '@/lib/adminApi';
import ChipSelect from '@/components/field/ChipSelect';
import SearchableSelect from '@/components/field/SearchableSelect';
import WatermarkCamera, { type CapturedPhoto } from '@/components/field/WatermarkCamera';
import MapPinModal, { type PinResult } from '@/components/field/MapPinModal';
import { UAE_EMIRATES } from '@/lib/uae-locations';

interface SurveyField {
  key: string;
  label: string;
  type: string;
  options: string[];
  required?: boolean;
}

interface SurveySection {
  title: string;
  key: string;
  fields: SurveyField[];
}

type SectionData = Record<string, string | string[]>;
type AllSections = { [key: string]: SectionData };

interface PhotoRecord {
  _id?: string;
  dataUrl: string;
  url: string;
  uploading?: boolean;
  error?: string;
  lat?: number;
  lng?: number;
  timestamp: string;
  field_key?: string;
}

interface AttachmentRecord {
  _id?: string;
  name: string;
  url: string;
  type: string;
  size?: number;
  uploading?: boolean;
  error?: string;
}

interface DraftData {
  id: number;
  company_name?: string;
  company_ref_id?: number;
  company_ref_source?: string;
  [key: string]: unknown;
}

export default function FieldSurveyPage() {
  const [draftId, setDraftId] = useState<number | null>(null);
  const [companyName, setCompanyName] = useState('');
  const [companyRefId, setCompanyRefId] = useState<number | null>(null);
  const [companyRefSource, setCompanyRefSource] = useState<string>('uae');
  const [sections, setSections] = useState<AllSections>({});
  const [schema, setSchema] = useState<SurveySection[] | null>(null);
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'idle'>('idle');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const [photos, setPhotos] = useState<PhotoRecord[]>([]);
  const [attachments, setAttachments] = useState<AttachmentRecord[]>([]);
  const [lightboxPhoto, setLightboxPhoto] = useState<PhotoRecord | null>(null);
  const [companyNameError, setCompanyNameError] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Set<string>>(new Set());
  const [editingInterviewId, setEditingInterviewId] = useState<number | null>(null);
  const [locEmirate, setLocEmirate] = useState('');
  const [locGroup, setLocGroup] = useState('');
  const [locDistricts, setLocDistricts] = useState<string[]>([]);
  const [locationPin, setLocationPin] = useState<PinResult | null>(null);
  const [showMapPin, setShowMapPin] = useState(false);
  const [activePhotoFieldKey, setActivePhotoFieldKey] = useState<string | null>(null);
  const [initializing, setInitializing] = useState(true);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const companyNameRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
        let loaded = false;
        if (storedId) {
          const { draft } = await fieldApi.getDraft(Number(storedId)) as { draft: DraftData };
          if (draft) {
            hydrateDraft(draft);
            loaded = true;
          }
        }
        if (!loaded) {
          const { id } = await fieldApi.createDraft() as { id: number };
          setDraftId(id);
          if (typeof window !== 'undefined') localStorage.setItem('field_draft_id', String(id));
        }
      } catch (err: unknown) {
        const status = (err as { status?: number })?.status;
        if (status === 401 || status === 403) {
          alert('Session expired — please refresh the page and log in again.');
        }
      } finally {
        setInitializing(false);
      }
    })();
  }, []);

  function hydrateDraft(draft: DraftData) {
    setDraftId(draft.id);
    setCompanyName(draft.company_name || '');
    setCompanyRefId(draft.company_ref_id || null);
    setCompanyRefSource(draft.company_ref_source || 'uae');
    const restored: AllSections = {};
    for (let i = 1; i <= 8; i++) {
      const key = `section_${i}`;
      if (draft[key]) {
        try {
          restored[key] = typeof draft[key] === 'string' ? JSON.parse(draft[key] as string) : draft[key] as SectionData;
        } catch {
          restored[key] = {};
        }
      }
    }
    if (draft.section_9) {
      try {
        const loc = typeof draft.section_9 === 'string' ? JSON.parse(draft.section_9 as string) : draft.section_9 as { emirate?: string; group?: string; district?: string; districts?: string[] };
        if (loc.emirate) setLocEmirate(String(loc.emirate));
        if (loc.group) setLocGroup(String(loc.group));
        // districts 多选；兼容旧数据的单个 district 字符串
        if (Array.isArray(loc.districts)) setLocDistricts(loc.districts);
        else if (loc.district) setLocDistricts([String(loc.district)]);
      } catch { /* ignore */ }
    }
    setSections(restored);
    if (draft.photos) {
      const raw = typeof draft.photos === 'string' ? JSON.parse(draft.photos as string) : draft.photos;
      if (Array.isArray(raw)) {
        setPhotos((raw as PhotoRecord[]).map(p => ({ ...p, dataUrl: p.url || '' })));
      }
    }
    if (draft.attachments) {
      const raw = typeof draft.attachments === 'string' ? JSON.parse(draft.attachments as string) : draft.attachments;
      if (Array.isArray(raw)) {
        setAttachments(raw as AttachmentRecord[]);
      }
    }
    if (draft.location_pin) {
      const raw = typeof draft.location_pin === 'string' ? JSON.parse(draft.location_pin as string) : draft.location_pin;
      if (raw?.lat && raw?.lng) setLocationPin(raw as PinResult);
    }
  }

  async function handlePhotoTaken(captured: CapturedPhoto, fieldKey: string | null) {
    const photoId = Date.now().toString();
    const record: PhotoRecord = {
      dataUrl: captured.dataUrl,
      url: '',
      uploading: !!draftId,
      lat: captured.lat,
      lng: captured.lng,
      timestamp: captured.timestamp,
      field_key: fieldKey ?? undefined,
    };
    setPhotos(prev => [...prev, { ...record, _id: photoId }]);
    if (!draftId) return;
    try {
      const { url } = await fieldApi.uploadPhoto(draftId, captured.blob, {
        lat: captured.lat,
        lng: captured.lng,
        timestamp: captured.timestamp,
        field_key: fieldKey,
      });
      setPhotos(prev => prev.map((p) => p._id === photoId ? { ...p, url, uploading: false } : p));
    } catch {
      setPhotos(prev => prev.map((p) => p._id === photoId ? { ...p, uploading: false, error: 'Upload failed' } : p));
    }
  }

  async function handleFilesSelected(files: FileList) {
    if (!draftId) return;
    for (const file of Array.from(files)) {
      const attId = `${Date.now()}-${Math.random()}`;
      setAttachments(prev => [...prev, { _id: attId, name: file.name, url: '', type: file.type, size: file.size, uploading: true }]);
      try {
        const result = await fieldApi.uploadAttachment(draftId, file);
        setAttachments(prev => prev.map(a => a._id === attId ? { ...a, url: result.url, uploading: false } : a));
      } catch {
        setAttachments(prev => prev.map(a => a._id === attId ? { ...a, uploading: false, error: 'Upload failed' } : a));
      }
    }
  }

  const triggerSave = useCallback((
    id: number, cName: string, cRefId: number | null, cRefSource: string,
    secs: AllSections,
    loc?: { emirate: string; group: string; districts: string[] },
    locPin?: PinResult | null,
  ) => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(async () => {
      setSaveStatus('saving');
      try {
        await fieldApi.saveDraft(id, {
          company_name: cName,
          company_ref_id: cRefId,
          company_ref_source: cRefSource,
          ...Object.fromEntries(Object.entries(secs).map(([k, v]) => [k, v])),
          ...(loc !== undefined ? { section_9: loc } : {}),
          ...(locPin !== undefined ? { location_pin: locPin } : {}),
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
      if (draftId) triggerSave(draftId, companyName, companyRefId, companyRefSource, updated, { emirate: locEmirate, group: locGroup, districts: locDistricts }, locationPin);
      return updated;
    });
  }

  function updateLocation(emirate: string, group: string, districts: string[]) {
    setLocEmirate(emirate);
    setLocGroup(group);
    setLocDistricts(districts);
    if (draftId) triggerSave(draftId, companyName, companyRefId, companyRefSource, sections, { emirate, group, districts }, locationPin);
  }

  function validateRequired(): boolean {
    if (!schema) return true;
    const errors = new Set<string>();
    for (const section of schema) {
      for (const field of section.fields) {
        if (!field.required) continue;
        const val = (sections[section.key] || {})[field.key];
        const isEmpty = !val || (Array.isArray(val) ? val.length === 0 : String(val).trim() === '');
        if (isEmpty) errors.add(`${section.key}.${field.key}`);
      }
    }
    setFieldErrors(errors);
    return errors.size === 0;
  }

  async function handleSubmit() {
    if (!companyName.trim()) {
      setCompanyNameError(true);
      companyNameRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      companyNameRef.current?.focus();
      return;
    }
    if (!validateRequired()) {
      // scroll to first error
      const firstErr = document.querySelector('[data-field-error="true"]');
      firstErr?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    if (!draftId) {
      alert('Draft not ready yet — please wait a moment and try again.');
      return;
    }
    setIsSubmitting(true);
    try {
      await fieldApi.saveDraft(draftId, {
        company_name: companyName,
        company_ref_id: companyRefId,
        company_ref_source: companyRefSource,
        ...sections,
        section_9: { emirate: locEmirate, group: locGroup, districts: locDistricts },
        location_pin: locationPin,
      });
      if (editingInterviewId) {
        await fieldApi.reSubmit(editingInterviewId, {
          company_name: companyName,
          company_ref_id: companyRefId,
          company_ref_source: companyRefSource,
          ...sections,
          section_9: { emirate: locEmirate, group: locGroup, districts: locDistricts },
          location_pin: locationPin,
        });
        setEditingInterviewId(null);
      } else {
        await fieldApi.submit(draftId);
        if (typeof window !== 'undefined') localStorage.removeItem('field_draft_id');
      }
      setSubmitted(true);
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'Failed to submit');
    } finally {
      setIsSubmitting(false);
    }
  }

  if (initializing) {
    return (
      <div className="min-h-screen bg-[#faf9f7] flex items-center justify-center">
        <div className="w-10 h-10 border-2 border-[#b8864a]/30 border-t-[#b8864a] rounded-full animate-spin" />
      </div>
    );
  }

  if (submitted) {
    const isBound = companyRefSource === 'profile' && companyRefId;
    return (
      <div className="min-h-screen bg-[#faf9f7] flex flex-col items-center justify-center px-6">
        <div className="w-full max-w-sm bg-white rounded-3xl shadow-sm border border-stone-100 px-8 py-10 flex flex-col items-center text-center">
          <div className="w-16 h-16 rounded-full bg-green-50 flex items-center justify-center mb-5">
            <svg className="w-8 h-8 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="text-xl font-bold text-[#1c1917] mb-2">Interview Submitted</h1>
          <p className="text-stone-400 text-[14px] mb-6">Record saved successfully.</p>

          {/* Company profile prompt */}
          <div className="w-full rounded-2xl bg-amber-50 border border-amber-200 px-5 py-4 mb-6 text-left">
            <p className="text-[13px] font-semibold text-amber-800 mb-1">
              {isBound ? 'Complete your company profile' : 'Register your company on Tarmeer'}
            </p>
            <p className="text-[12px] text-amber-700 mb-3">
              {isBound
                ? 'Add photos, services, and project cases to attract more clients.'
                : 'Create a free company account to showcase your work and get inquiries from clients.'}
            </p>
            <a
              href={isBound ? '/company' : '/for-companies'}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center h-9 px-5 rounded-full bg-[#b8864a] text-white text-[13px] font-semibold hover:bg-[#a07640] transition-colors"
            >
              {isBound ? 'Go to Company Dashboard →' : 'Register Now →'}
            </a>
          </div>

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

  return (
    <div className="min-h-screen bg-[#faf9f7] pb-28">
      {/* 顶部：标题 + 保存状态 */}
      <div className="sticky top-0 z-10 bg-white border-b border-stone-200 px-4 py-3 flex items-center gap-2">
        <span className="flex-1 min-w-0 text-[15px] font-semibold text-[#1c1917] truncate">
          {companyName.trim() || 'Field Survey'}
        </span>
        {editingInterviewId && (
          <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 font-medium shrink-0">
            Editing #{editingInterviewId}
          </span>
        )}
        <span className={`shrink-0 text-xs ${saveStatus === 'saving' ? 'text-stone-400' : saveStatus === 'saved' ? 'text-green-600' : 'text-stone-300'}`}>
          {saveStatus === 'saving' ? 'Saving…' : saveStatus === 'saved' ? '✓ Saved' : ''}
        </span>
      </div>

      <div className="px-4 pt-6 space-y-8 max-w-lg mx-auto">
        {/* 公司名称 */}
        <div>
          <label className="block text-sm font-medium text-stone-500 mb-2">
            Company Name <span className="text-red-400">*</span>
          </label>
          <input
            ref={companyNameRef}
            value={companyName}
            onChange={(e) => {
              const v = e.target.value;
              setCompanyName(v);
              setCompanyNameError(false);
              if (companyRefId) { setCompanyRefId(null); setCompanyRefSource('uae'); }
              if (draftId) triggerSave(draftId, v, null, 'uae', sections, { emirate: locEmirate, group: locGroup, districts: locDistricts }, locationPin);
            }}
            placeholder="Enter company name…"
            autoComplete="off"
            className={`w-full h-[52px] px-5 rounded-2xl border bg-white text-[15px] text-[#1c1917] placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-[#B8864A]/15 focus:border-[#B8864A] shadow-sm ${companyNameError ? 'border-red-400' : 'border-stone-200'}`}
          />
          {companyNameError && (
            <p className="mt-1.5 text-xs text-red-500">Please enter the company name first</p>
          )}
        </div>

        {!schema ? (
          <div className="flex justify-center py-8">
            <div className="w-5 h-5 border-2 border-[#b8864a]/30 border-t-[#b8864a] rounded-full animate-spin" />
          </div>
        ) : schema.map((section, sectionIndex) => (
          <div key={section.key}>
            <h2 className="text-base font-bold text-[#2c2c2c] mb-4 pl-3 border-l-4 border-[#b8864a]">
              {section.title}
            </h2>
            <div className="space-y-5">
              {section.fields.map((field) => {
                const sectionData = sections[section.key] || {};
                const val = sectionData[field.key] ?? (field.type === 'multi' ? [] : field.type === 'text' ? '' : '');
                const otherVal = String(sectionData[`${field.key}__other`] ?? '');
                const fKey = `${section.key}.${field.key}`;
                const errKey = `${section.key}.${field.key}`;
                const hasError = fieldErrors.has(errKey);
                const fieldPhotos = photos.filter(p => p.field_key === fKey);
                return (
                  <div key={field.key} data-field-error={hasError ? 'true' : undefined}>
                    <label className={`block text-sm font-medium mb-2 ${hasError ? 'text-red-500' : 'text-stone-500'}`}>
                      {field.label}
                      {field.required && <span className="text-red-400 ml-1">*</span>}
                    </label>
                    {field.type === 'text' ? (
                      <textarea
                        value={String(val)}
                        onChange={(e) => {
                          updateSection(section.key, field.key, e.target.value);
                          if (hasError && e.target.value.trim()) {
                            setFieldErrors(prev => { const s = new Set(prev); s.delete(errKey); return s; });
                          }
                        }}
                        placeholder="Enter answer…"
                        rows={3}
                        className={`w-full px-4 py-3 rounded-xl border bg-white text-[15px] text-[#1c1917] placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-[#b8864a]/15 focus:border-[#b8864a] resize-none ${hasError ? 'border-red-400' : 'border-stone-200'}`}
                      />
                    ) : (
                      <ChipSelect
                        options={field.options}
                        value={val}
                        multi={field.type === 'multi'}
                        onChange={(v) => {
                          updateSection(section.key, field.key, v);
                          if (hasError) {
                            const notEmpty = Array.isArray(v) ? v.length > 0 : Boolean(v);
                            if (notEmpty) setFieldErrors(prev => { const s = new Set(prev); s.delete(errKey); return s; });
                          }
                        }}
                        otherText={otherVal}
                        onOtherTextChange={(t) => updateSection(section.key, `${field.key}__other`, t)}
                      />
                    )}
                    {hasError && (
                      <p className="mt-1.5 text-xs text-red-500">This field is required</p>
                    )}
                    <button
                      type="button"
                      onClick={() => { setActivePhotoFieldKey(fKey); setShowCamera(true); }}
                      className="mt-2 flex items-center gap-1.5 h-[44px] px-4 rounded-2xl border border-stone-200 bg-white text-stone-600 hover:border-[#b8864a]/50 hover:text-[#b8864a] text-[13px] font-medium transition-colors active:opacity-70"
                    >
                      <Camera className="w-4 h-4" />
                      <span>{fieldPhotos.length > 0 ? `${fieldPhotos.length} Photo${fieldPhotos.length > 1 ? 's' : ''}` : 'Photo'}</span>
                    </button>
                    {fieldPhotos.length > 0 && (
                      <div className="grid grid-cols-4 gap-1.5 mt-2">
                        {fieldPhotos.map((photo, idx) => (
                          <div key={photo._id || idx} className="relative aspect-square rounded-lg overflow-hidden border border-stone-200 bg-stone-100">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={photo.dataUrl || photo.url}
                              alt={`Photo ${idx + 1}`}
                              className="w-full h-full object-cover cursor-pointer"
                              onClick={() => setLightboxPhoto(photo)}
                            />
                            {photo.uploading && (
                              <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                                <div className="w-3 h-3 border border-white/40 border-t-white rounded-full animate-spin" />
                              </div>
                            )}
                            {photo.error && (
                              <div className="absolute bottom-0 left-0 right-0 bg-red-500/80 text-white text-[10px] text-center py-0.5">failed</div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}

              {/* 服务区域（仅插在第一节之后）*/}
              {sectionIndex === 0 && (() => {
                const emirateData = UAE_EMIRATES.find((e) => e.label === locEmirate);
                const isDubai = !!emirateData?.groups;
                const groupData = emirateData?.groups?.find((g) => g.label === locGroup);
                const level2Options = isDubai ? emirateData.groups!.map((g) => g.label) : (emirateData?.districts ?? []);
                const level3Options = isDubai ? (groupData?.districts ?? []) : [];
                return (
                <>
                  <div>
                    <h2 className="text-base font-bold text-[#2c2c2c] mb-4 pl-3 border-l-4 border-[#b8864a]">
                      Service Area
                    </h2>
                    <div className="space-y-3">
                      <div>
                        <label className="block text-sm font-medium text-stone-500 mb-2">Emirate</label>
                        <SearchableSelect
                          options={UAE_EMIRATES.map((e) => e.label)}
                          value={locEmirate}
                          placeholder="Select emirate…"
                          onChange={(v) => updateLocation(v, '', [])}
                        />
                      </div>
                      {/* 迪拜：先选 Sector/Area（单选），再多选 District；其他酋长国直接多选 District */}
                      {locEmirate && isDubai && (
                        <div>
                          <label className="block text-sm font-medium text-stone-500 mb-2">Sector / Area</label>
                          <SearchableSelect
                            options={level2Options}
                            value={locGroup}
                            placeholder="Select sector…"
                            onChange={(v) => updateLocation(locEmirate, v, [])}
                          />
                        </div>
                      )}
                      {locEmirate && (!isDubai || locGroup) && (() => {
                        const districtOptions = isDubai ? level3Options : level2Options;
                        return (
                          <div>
                            <label className="block text-sm font-medium text-stone-500 mb-2">
                              District <span className="text-stone-400 font-normal">(select all that apply)</span>
                            </label>
                            <ChipSelect
                              options={districtOptions}
                              value={locDistricts}
                              multi={true}
                              onChange={(v) => updateLocation(locEmirate, locGroup, Array.isArray(v) ? v : v ? [v] : [])}
                            />
                          </div>
                        );
                      })()}
                    </div>
                  </div>

                  <div>
                    <h2 className="text-base font-bold text-[#2c2c2c] mb-4 pl-3 border-l-4 border-[#b8864a]">
                      Company Address Pin
                    </h2>
                    {locationPin ? (
                      <div className="flex items-center gap-3 p-3 rounded-xl bg-green-50 border border-green-200">
                        <MapPin className="w-4 h-4 text-green-600 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-green-800 font-medium truncate">{locationPin.address || 'Pinned'}</p>
                          <p className="text-xs text-green-600">{locationPin.lat.toFixed(5)}, {locationPin.lng.toFixed(5)}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setShowMapPin(true)}
                          className="text-xs text-green-600 hover:text-green-800 font-medium shrink-0"
                        >
                          Edit
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setShowMapPin(true)}
                        className="w-full h-12 rounded-xl border-2 border-dashed border-stone-200 flex items-center justify-center gap-2 text-stone-400 hover:border-[#b8864a] hover:text-[#b8864a] transition-colors"
                      >
                        <MapPin className="w-4 h-4" />
                        <span className="text-sm">Pin on Google Maps</span>
                      </button>
                    )}
                  </div>
                </>
                );
              })()}
            </div>
          </div>
        ))}

        {/* 附件上传 */}
        {schema && schema.length > 0 && (
          <div>
            <h2 className="text-base font-bold text-[#2c2c2c] mb-4 pl-3 border-l-4 border-[#b8864a]">
              Attachments
            </h2>
            <p className="text-xs text-stone-400 mb-3">Images, PDFs, Word documents — multiple files supported</p>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/*,.pdf,.doc,.docx,.xls,.xlsx"
              className="hidden"
              onChange={(e) => { if (e.target.files?.length) handleFilesSelected(e.target.files); e.target.value = ''; }}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-2 h-[44px] px-4 rounded-2xl border border-stone-200 bg-white text-stone-600 hover:border-[#b8864a]/50 hover:text-[#b8864a] text-[13px] font-medium transition-colors"
            >
              <Paperclip className="w-4 h-4" />
              Add Files
            </button>

            {attachments.length > 0 && (
              <div className="mt-3 space-y-2">
                {attachments.map((att, idx) => (
                  <div key={att._id || idx} className="flex items-center gap-3 px-4 py-3 rounded-xl border border-stone-200 bg-white">
                    {att.type.startsWith('image/') ? (
                      att.url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={att.url} alt={att.name} className="w-10 h-10 rounded-lg object-cover shrink-0 border border-stone-200" />
                      ) : (
                        <div className="w-10 h-10 rounded-lg bg-stone-100 shrink-0 flex items-center justify-center">
                          <Camera className="w-4 h-4 text-stone-400" />
                        </div>
                      )
                    ) : (
                      <div className="w-10 h-10 rounded-lg bg-amber-50 shrink-0 flex items-center justify-center">
                        <FileText className="w-5 h-5 text-[#b8864a]" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-medium text-[#1c1917] truncate">{att.name}</p>
                      {att.size && <p className="text-xs text-stone-400">{(att.size / 1024).toFixed(0)} KB</p>}
                      {att.error && <p className="text-xs text-red-500">{att.error}</p>}
                    </div>
                    {att.uploading ? (
                      <div className="w-4 h-4 border border-stone-300 border-t-[#b8864a] rounded-full animate-spin shrink-0" />
                    ) : (
                      <button
                        type="button"
                        onClick={() => setAttachments(prev => prev.filter((_, i) => i !== idx))}
                        className="shrink-0 text-stone-300 hover:text-red-400 transition-colors"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-stone-200 px-4 py-3">
        <button
          onClick={handleSubmit}
          disabled={isSubmitting}
          className="btn-primary w-full h-12 disabled:opacity-50"
        >
          {isSubmitting ? 'Submitting…' : 'Submit Survey'}
        </button>
      </div>

      {showCamera && (
        <WatermarkCamera
          onClose={() => { setShowCamera(false); setActivePhotoFieldKey(null); }}
          onPhotoTaken={(photo) => handlePhotoTaken(photo, activePhotoFieldKey)}
        />
      )}

      {showMapPin && (
        <MapPinModal
          initialAddress={locationPin?.address ?? companyName}
          onClose={() => setShowMapPin(false)}
          onConfirm={(result) => {
            setLocationPin(result);
            setShowMapPin(false);
            if (draftId) triggerSave(draftId, companyName, companyRefId, companyRefSource, sections, { emirate: locEmirate, group: locGroup, districts: locDistricts }, result);
          }}
        />
      )}

      {lightboxPhoto && (
        <div
          className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center"
          onClick={() => setLightboxPhoto(null)}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={lightboxPhoto.dataUrl || lightboxPhoto.url}
            alt="Photo preview"
            className="max-w-full max-h-full object-contain"
            onClick={(e) => e.stopPropagation()}
          />
          <button
            onClick={() => setLightboxPhoto(null)}
            className="absolute top-4 right-4 w-10 h-10 rounded-full bg-black/50 flex items-center justify-center"
          >
            <X className="w-5 h-5 text-white" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setPhotos(prev => prev.filter(p => p._id ? p._id !== lightboxPhoto._id : p !== lightboxPhoto));
              setLightboxPhoto(null);
            }}
            className="absolute bottom-8 right-6 w-12 h-12 rounded-full bg-black/50 flex items-center justify-center"
          >
            <Trash2 className="w-5 h-5 text-white" />
          </button>
        </div>
      )}
    </div>
  );
}
