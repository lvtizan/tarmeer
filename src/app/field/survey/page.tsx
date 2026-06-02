'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Camera, X } from 'lucide-react';
import { fieldApi } from '@/lib/adminApi';
import ChipSelect from '@/components/field/ChipSelect';
import WatermarkCamera, { type CapturedPhoto } from '@/components/field/WatermarkCamera';

const SECTIONS = [
  {
    title: 'Section 1: Company Basic Information',
    key: 'section_1',
    fields: [
      { key: 'company_type', label: 'Company Type', type: 'single', options: ['Local', 'Joint Venture', 'Foreign'] },
      { key: 'year_established', label: 'Year Established', type: 'single', options: ['Before 2000', '2000-2010', '2010-2015', '2015-2020', '2020+'] },
      { key: 'registration_location', label: 'Registration Location', type: 'single', options: ['Dubai', 'Abu Dhabi', 'Sharjah', 'Other UAE', 'Outside UAE'] },
      { key: 'company_size', label: 'Company Size', type: 'single', options: ['1-10', '10-30', '30-100', '100+'] },
      { key: 'licenses', label: 'Licenses / Certifications', type: 'multi', options: ['Dubai Municipality', 'DEWA Approved', 'ISO Certified', 'RERA', 'Other'] },
    ],
  },
  {
    title: 'Section 2: Core Business',
    key: 'section_2',
    fields: [
      { key: 'main_business_scope', label: 'Main Business Scope', type: 'multi', options: ['Interior Design', 'Fit-out', 'FF&E', 'MEP', 'Joinery', 'Landscaping'] },
      { key: 'one_stop_service', label: 'One-Stop Service (Design + Build + Materials + Furniture)?', type: 'single', options: ['Yes', 'No', 'Partial'] },
      { key: 'main_client_types', label: 'Main Client Types', type: 'multi', options: ['Residential', 'Commercial', 'Hospitality', 'Retail', 'Government', 'F&B'] },
    ],
  },
  {
    title: 'Section 3: Team Structure',
    key: 'section_3',
    fields: [
      { key: 'total_employees', label: 'Total Employees', type: 'single', options: ['1-10', '11-30', '31-100', '100+'] },
      { key: 'design_team_size', label: 'Design Team Size', type: 'single', options: ['0', '1-3', '4-10', '10+'] },
      { key: 'pm_team_size', label: 'Project Management Team Size', type: 'single', options: ['0', '1-3', '4-10', '10+'] },
      { key: 'construction_team', label: 'Construction Team', type: 'single', options: ['In-house', 'Outsourced', 'Hybrid'] },
      { key: 'management_background', label: 'Management Background', type: 'multi', options: ['UAE Local', 'Arab', 'South Asian', 'Chinese', 'European', 'Mixed'] },
      { key: 'owner_nationality', label: 'Owner / Shareholder Nationality', type: 'multi', options: ['Emirati', 'Arab', 'Indian', 'Pakistani', 'Chinese', 'European', 'Other'] },
    ],
  },
  {
    title: 'Section 4: Projects & Performance',
    key: 'section_4',
    fields: [
      { key: 'projects_last_year', label: 'Projects Completed Last Year', type: 'single', options: ['1-5', '6-20', '21-50', '50+'] },
      { key: 'annual_revenue_aed', label: 'Annual Revenue (AED)', type: 'single', options: ['< 1M', '1-5M', '5-20M', '20-50M', '50M+'] },
      { key: 'typical_contract_value', label: 'Typical Contract Value Range', type: 'single', options: ['< 100K', '100K-500K', '500K-2M', '2M+'] },
      { key: 'main_project_types', label: 'Main Project Types', type: 'multi', options: ['Villa', 'Apartment', 'Office', 'Retail', 'Hotel', 'Restaurant', 'Government'] },
    ],
  },
  {
    title: 'Section 5: Supply Chain',
    key: 'section_5',
    fields: [
      { key: 'main_material_sources', label: 'Main Material Sources', type: 'multi', options: ['China', 'Italy', 'Germany', 'Local UAE', 'India', 'Turkey', 'Mixed'] },
      { key: 'stable_supply_chain', label: 'Stable Supply Chain?', type: 'single', options: ['Yes', 'No', 'Partially'] },
      { key: 'open_to_chinese_supply', label: 'Open to Chinese Material Supply?', type: 'single', options: ['Very Interested', 'Open', 'Neutral', 'Not Interested'] },
    ],
  },
  {
    title: 'Section 6: Strengths & Challenges',
    key: 'section_6',
    fields: [
      { key: 'key_strengths', label: 'Key Strengths', type: 'multi', options: ['Design Capability', 'Speed', 'Price', 'Quality', 'Relationships', 'After-sales'] },
      { key: 'main_challenges', label: 'Main Challenges', type: 'multi', options: ['Material Cost', 'Labour', 'Cash Flow', 'Competition', 'Finding Clients', 'Logistics'] },
    ],
  },
  {
    title: 'Section 7: Cooperation Intent',
    key: 'section_7',
    fields: [
      { key: 'interest_in_chinese_platform', label: 'Interest in Cooperating with Chinese Supply Platform', type: 'single', options: ['Very Interested', 'Interested', 'Maybe', 'Not Interested'] },
      { key: 'support_needed', label: 'Support Needed', type: 'multi', options: ['Sourcing', 'Logistics', 'Quality Control', 'Payment Terms', 'Showroom', 'Training'] },
      { key: 'preferred_cooperation_model', label: 'Preferred Cooperation Model', type: 'single', options: ['Platform Membership', 'Per-project', 'Revenue Share', 'Exclusive Supply'] },
    ],
  },
  {
    title: 'Section 8: Additional Information',
    key: 'section_8',
    fields: [
      { key: 'stable_developer_clients', label: 'Stable Developer / Client Resources?', type: 'single', options: ['Yes', 'No', 'Some'] },
      { key: 'avg_project_duration', label: 'Average Project Duration', type: 'single', options: ['< 1 month', '1-3 months', '3-6 months', '6+ months'] },
      { key: 'client_acquisition_channels', label: 'Client Acquisition Channels', type: 'multi', options: ['Referral', 'Social Media', 'Tenders', 'Direct Sales', 'Repeat Clients', 'Platforms'] },
      { key: 'design_software', label: 'Design Software Used', type: 'multi', options: ['AutoCAD', '3ds Max', 'SketchUp', 'Revit', 'Lumion', 'Other'] },
      { key: 'standardized_quotation', label: 'Standardized Quotation System?', type: 'single', options: ['Yes', 'No', 'In Progress'] },
    ],
  },
  {
    title: 'Section 9: Strategic Questions',
    key: 'section_9',
    fields: [
      { key: 'open_to_material_construction_split', label: 'Open to Material + Construction Separation Model?', type: 'single', options: ['Yes', 'No', 'Need to Discuss'] },
      { key: 'willing_to_share_client_resources', label: 'Willing to Share Client Resources for Joint Projects?', type: 'single', options: ['Yes', 'No', 'Case by Case'] },
      { key: 'concerns_about_chinese_supply', label: 'Main Concerns About Chinese Supply Chain', type: 'multi', options: ['Quality', 'Delivery Time', 'Communication', 'MOQ', 'After-sales', 'None'] },
      { key: 'interested_in_showroom_collab', label: 'Interested in Showroom / Sample Collaboration?', type: 'single', options: ['Very Interested', 'Interested', 'Maybe', 'Not Interested'] },
    ],
  },
];

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
}

export default function FieldSurveyPage() {
  const [draftId, setDraftId] = useState<number | null>(null);
  const [companyName, setCompanyName] = useState('');
  const [companyRefId, setCompanyRefId] = useState<number | null>(null);
  const [companyRefName, setCompanyRefName] = useState('');
  const [sections, setSections] = useState<AllSections>({});
  const [schema, setSchema] = useState(SECTIONS);
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
      // Load survey schema from API (falls back to hardcoded SECTIONS)
      try {
        const { schema: remoteSchema } = await fieldApi.getSurveySchema() as { schema: typeof SECTIONS | null };
        if (remoteSchema && Array.isArray(remoteSchema) && remoteSchema.length > 0) {
          setSchema(remoteSchema as typeof SECTIONS);
        }
      } catch { /* keep hardcoded fallback */ }

      try {
        const storedId = typeof window !== 'undefined' ? localStorage.getItem('field_draft_id') : null;
        if (storedId) {
          const { draft } = await fieldApi.getDraft() as { draft: DraftData };
          if (draft && draft.id === Number(storedId)) {
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

  const triggerSave = useCallback((id: number, cName: string, cRefId: number | null, secs: AllSections) => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(async () => {
      setSaveStatus('saving');
      try {
        await fieldApi.saveDraft(id, {
          company_name: cName,
          company_ref_id: cRefId,
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
      if (draftId) triggerSave(draftId, companyName, companyRefId, updated);
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
    if (val.length > 1) {
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
    setCompanyRefId(company.id);
    setCompanyRefName(company.name);
    setCompanyName(company.name);
    setCompanySearchQuery('');
    setShowSuggestions(false);
    setCompanyNameError(false);
    if (draftId) triggerSave(draftId, company.name, company.id, sections);
  }

  function clearSelectedCompany() {
    setCompanyRefId(null);
    setCompanyRefName('');
    setCompanyName('');
    setCompanySearchQuery('');
    setShowSuggestions(false);
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
        <div className="text-5xl mb-4">✓</div>
        <h1 className="text-xl font-bold text-[#2c2c2c] mb-2">Interview Submitted</h1>
        <p className="text-stone-500 text-[15px] mb-8">Record saved successfully.</p>
        <button
          onClick={() => {
            if (typeof window !== 'undefined') localStorage.removeItem('field_draft_id');
            window.location.reload();
          }}
          className="btn-primary w-full max-w-xs"
        >
          Start New Interview
        </button>
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
          <h1 className="text-2xl font-bold text-[#1c1917] mb-2">装企实地调研</h1>
          <p className="text-[15px] text-stone-500 leading-relaxed">
            搜索系统内已登记的装企<br />点击「匹配」后开始填写调研问卷
          </p>
        </div>

        {/* 搜索区 */}
        <div className="flex-1 px-4 pt-5 max-w-lg mx-auto w-full">
          <input
            ref={companyNameRef}
            value={companySearchQuery}
            onChange={(e) => handleCompanySearchChange(e.target.value)}
            placeholder="输入公司名称搜索…"
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
                    匹配
                  </button>
                </div>
              ))}
            </div>
          )}
          {companySearchQuery.length > 1 && !companySearching && companySuggestions.length === 0 && (
            <p className="mt-6 text-center text-sm text-stone-400">未找到匹配的企业</p>
          )}
          {companySearchQuery.length === 0 && (
            <p className="mt-6 text-center text-xs text-stone-300">输入至少 2 个字符开始搜索</p>
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
            <p className="text-xs text-stone-400 leading-none mb-0.5">正在调研</p>
            <p className="text-[15px] font-semibold text-[#1c1917] truncate">{companyRefName}</p>
          </div>
          <button
            type="button"
            onClick={clearSelectedCompany}
            className="shrink-0 text-xs text-stone-400 hover:text-[#b8864a] transition-colors font-medium"
          >
            重新选择
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
            现场照片 {photos.length > 0 && <span className="text-stone-400 font-normal text-sm">({photos.length})</span>}
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
          <p className="text-xs text-stone-400">{photos.length === 0 ? '暂无照片 — 点击下方📷拍摄' : '点击照片放大 · 点击📷继续拍摄'}</p>
        </div>

        {schema.map((section) => (
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
          <span>拍照</span>
        </button>
        <button
          onClick={handleSubmit}
          disabled={isSubmitting}
          className="btn-primary flex-1 h-12 disabled:opacity-50"
        >
          {isSubmitting ? '提交中…' : '提交调研'}
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
