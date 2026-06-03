'use client';
import { useState, useEffect, useCallback, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { adminApi } from '@/lib/adminApi';
import { Spinner } from '@/components/ui/Spinner';
import { useAdminT } from '@/hooks/useAdminLang';
import AdminSelect from '@/components/ui/AdminSelect';
import { MapPin, ExternalLink, X, ClipboardList } from 'lucide-react';
import { formatAdminDateTime, ADMIN_TIME_CLS } from '@/lib/formatTime';

interface VisitRecord {
  id: number;
  company_name: string;
  interviewer_name: string;
  linked_company_name: string | null;
  status: 'draft' | 'submitted';
  submitted_at: string | null;
  created_at: string;
}

interface PhotoEntry {
  url: string;
  lat?: number;
  lng?: number;
  timestamp?: string;
}

interface VisitRecordDetail extends VisitRecord {
  company_ref_id: number | null;
  section_1: Record<string, string | string[]> | null;
  section_2: Record<string, string | string[]> | null;
  section_3: Record<string, string | string[]> | null;
  section_4: Record<string, string | string[]> | null;
  section_5: Record<string, string | string[]> | null;
  section_6: Record<string, string | string[]> | null;
  section_7: Record<string, string | string[]> | null;
  section_8: Record<string, string | string[]> | null;
  section_9: Record<string, string | string[]> | null;
  photos?: string | PhotoEntry[] | null;
}

const STATUS_OPTIONS = [
  { value: '', label: 'All Status' },
  { value: 'submitted', label: 'Submitted' },
  { value: 'draft', label: 'Draft' },
];

const SECTIONS = [
  {
    title: 'Section 1: Company Basic Information',
    key: 'section_1',
    fields: [
      { key: 'company_type', label: 'Company Type' },
      { key: 'year_established', label: 'Year Established' },
      { key: 'registration_location', label: 'Registration Location' },
      { key: 'company_size', label: 'Company Size' },
      { key: 'licenses', label: 'Licenses / Certifications' },
    ],
  },
  {
    title: 'Section 2: Core Business',
    key: 'section_2',
    fields: [
      { key: 'main_business_scope', label: 'Main Business Scope' },
      { key: 'one_stop_service', label: 'One-Stop Service' },
      { key: 'main_client_types', label: 'Main Client Types' },
    ],
  },
  {
    title: 'Section 3: Team Structure',
    key: 'section_3',
    fields: [
      { key: 'total_employees', label: 'Total Employees' },
      { key: 'design_team_size', label: 'Design Team Size' },
      { key: 'pm_team_size', label: 'PM Team Size' },
      { key: 'construction_team', label: 'Construction Team' },
      { key: 'management_background', label: 'Management Background' },
      { key: 'owner_nationality', label: 'Owner Nationality' },
    ],
  },
  {
    title: 'Section 4: Projects & Performance',
    key: 'section_4',
    fields: [
      { key: 'projects_last_year', label: 'Projects Last Year' },
      { key: 'annual_revenue_aed', label: 'Annual Revenue (AED)' },
      { key: 'typical_contract_value', label: 'Typical Contract Value' },
      { key: 'main_project_types', label: 'Main Project Types' },
    ],
  },
  {
    title: 'Section 5: Supply Chain',
    key: 'section_5',
    fields: [
      { key: 'main_material_sources', label: 'Main Material Sources' },
      { key: 'stable_supply_chain', label: 'Stable Supply Chain' },
      { key: 'open_to_chinese_supply', label: 'Open to Chinese Supply' },
    ],
  },
  {
    title: 'Section 6: Strengths & Challenges',
    key: 'section_6',
    fields: [
      { key: 'key_strengths', label: 'Key Strengths' },
      { key: 'main_challenges', label: 'Main Challenges' },
    ],
  },
  {
    title: 'Section 7: Cooperation Intent',
    key: 'section_7',
    fields: [
      { key: 'interest_in_chinese_platform', label: 'Interest in Chinese Platform' },
      { key: 'support_needed', label: 'Support Needed' },
      { key: 'preferred_cooperation_model', label: 'Preferred Cooperation Model' },
    ],
  },
  {
    title: 'Section 8: Additional Information',
    key: 'section_8',
    fields: [
      { key: 'stable_developer_clients', label: 'Stable Developer Clients' },
      { key: 'avg_project_duration', label: 'Avg Project Duration' },
      { key: 'client_acquisition_channels', label: 'Client Acquisition Channels' },
      { key: 'design_software', label: 'Design Software' },
      { key: 'standardized_quotation', label: 'Standardized Quotation' },
    ],
  },
  {
    title: 'Section 9: Strategic Questions',
    key: 'section_9',
    fields: [
      { key: 'open_to_material_construction_split', label: 'Material + Construction Split' },
      { key: 'willing_to_share_client_resources', label: 'Share Client Resources' },
      { key: 'concerns_about_chinese_supply', label: 'Concerns About Chinese Supply' },
      { key: 'interested_in_showroom_collab', label: 'Showroom Collaboration' },
    ],
  },
];

function parseSection(raw: unknown): Record<string, string | string[]> {
  if (!raw) return {};
  if (typeof raw === 'string') {
    try { return JSON.parse(raw); } catch { return {}; }
  }
  return raw as Record<string, string | string[]>;
}

function FieldValue({ value }: { value: string | string[] | undefined }) {
  if (!value || (Array.isArray(value) && value.length === 0) || value === '') {
    return <span className="text-stone-300 text-sm">—</span>;
  }
  const arr = Array.isArray(value) ? value : [value];
  return (
    <div className="flex flex-wrap gap-1.5">
      {arr.map((v, i) => (
        <span key={i} className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-[#b8864a]/10 text-[#b8864a]">
          {v}
        </span>
      ))}
    </div>
  );
}

function AdminVisitRecordsContent() {
  const { t } = useAdminT();
  const searchParams = useSearchParams();
  const [records, setRecords] = useState<VisitRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [detail, setDetail] = useState<VisitRecordDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

  const fetchRecords = useCallback(async () => {
    setLoading(true);
    try {
      const data = await adminApi.getInterviews();
      setRecords(data.interviews || []);
    } catch (err) {
      console.error('[AdminVisitRecords] Failed to fetch records:', err);
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchRecords(); }, [fetchRecords]);

  // Auto-open a record when navigating back from company detail (?detail=N)
  useEffect(() => {
    const detailId = searchParams.get('detail');
    if (detailId) {
      openDetail(Number(detailId));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openDetail = async (id: number) => {
    setSelectedId(id);
    setDetail(null);
    setDetailLoading(true);
    try {
      const data = await adminApi.getInterview(id);
      setDetail(data.interview || data);
    } catch (err) {
      console.error('[AdminVisitRecords] Failed to fetch interview detail:', err);
    }
    setDetailLoading(false);
  };

  const filtered = records.filter(r => {
    if (statusFilter && r.status !== statusFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        r.company_name.toLowerCase().includes(q) ||
        r.interviewer_name.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const formatDate = (s: string | null) => formatAdminDateTime(s);

  const lightbox = lightboxUrl ? (
    <div
      className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center"
      onClick={() => setLightboxUrl(null)}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={lightboxUrl} alt="Photo" className="max-w-full max-h-full object-contain" />
      <button
        onClick={() => setLightboxUrl(null)}
        className="absolute top-4 right-4 w-10 h-10 rounded-full bg-black/50 flex items-center justify-center"
      >
        <X className="w-5 h-5 text-white" />
      </button>
    </div>
  ) : null;

  // Detail view
  if (selectedId !== null) {
    return (
      <div className="space-y-4">
        <button
          onClick={() => { setSelectedId(null); setDetail(null); setLightboxUrl(null); }}
          className="flex items-center gap-1.5 text-sm text-stone-500 hover:text-stone-800"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
          {t('Back to Records', '返回访谈列表')}
        </button>

        {detailLoading || !detail ? (
          <div className="flex justify-center py-16"><Spinner /></div>
        ) : (
          <>
            <div className="bg-white rounded-xl border border-stone-200 p-5 space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h1 className="text-lg font-bold text-[#2c2c2c]">{detail.company_name || '—'}</h1>
                    {detail.linked_company_name && detail.linked_company_name !== detail.company_name && (
                      <span className="text-xs text-stone-400 flex items-center gap-1">
                        → {detail.linked_company_name}
                        {detail.company_ref_id && (
                          <a
                            href={`/admin/companies/${detail.company_ref_id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[#b8864a] hover:opacity-70"
                          >
                            <ExternalLink size={12} />
                          </a>
                        )}
                      </span>
                    )}
                  </div>
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                    detail.status === 'submitted' ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-700'
                  }`}>
                    {detail.status === 'submitted' ? t('Submitted', '已提交') : t('Draft', '草稿')}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-3 text-sm pt-1 border-t border-stone-100">
                <div>
                  <div className="text-xs text-stone-400 mb-0.5">{t('Interviewer', '采访人')}</div>
                  <div className="font-medium text-[#2c2c2c]">{detail.interviewer_name}</div>
                </div>
                <div>
                  <div className="text-xs text-stone-400 mb-0.5">{t('Interview Subject', '访谈对象')}</div>
                  {detail.company_ref_id ? (
                    <a
                      href={`/admin/companies/${detail.company_ref_id}?from=visit-records&recordId=${detail.id}`}
                      className="font-medium text-[#b8864a] hover:underline"
                    >
                      {detail.company_name || '—'}
                    </a>
                  ) : (
                    <div className="font-medium text-[#2c2c2c]">{detail.company_name || '—'}</div>
                  )}
                </div>
                <div>
                  <div className="text-xs text-stone-400 mb-0.5">{t('Created', '创建时间')}</div>
                  <div className="text-stone-600">{formatDate(detail.created_at)}</div>
                </div>
                <div>
                  <div className="text-xs text-stone-400 mb-0.5">{t('Submitted', '提交时间')}</div>
                  <div className="text-stone-600">{formatDate(detail.submitted_at)}</div>
                </div>
                <div>
                  <div className="text-xs text-stone-400 mb-0.5">{t('Record ID', '记录编号')}</div>
                  <div className="text-stone-600">#{detail.id}</div>
                </div>
              </div>
            </div>

            {/* Photos */}
            {(() => {
              const raw = detail.photos;
              const photos: PhotoEntry[] = raw
                ? (typeof raw === 'string' ? JSON.parse(raw) : raw) as PhotoEntry[]
                : [];
              if (photos.length === 0) return null;
              return (
                <div className="bg-white rounded-xl border border-stone-200 p-5">
                  <h2 className="text-xs font-semibold text-stone-400 uppercase tracking-wide border-l-2 border-[#b8864a] pl-2 mb-3">
                    Photos ({photos.length})
                  </h2>
                  <div className="flex flex-wrap gap-2">
                    {photos.map((p, i) => (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        key={i}
                        src={p.url}
                        alt={`Photo ${i + 1}`}
                        onClick={() => setLightboxUrl(p.url)}
                        className="w-24 h-24 object-cover rounded-lg border border-stone-200 cursor-pointer hover:opacity-80 transition"
                      />
                    ))}
                  </div>
                </div>
              );
            })()}

            {SECTIONS.map(section => {
              const sectionData = parseSection(detail[section.key as keyof VisitRecordDetail]);
              const hasAnyData = section.fields.some(f => {
                const v = sectionData[f.key];
                return v && (Array.isArray(v) ? v.length > 0 : v !== '');
              });
              if (!hasAnyData) return null;
              return (
                <div key={section.key} className="bg-white rounded-xl border border-stone-200 p-5 space-y-4">
                  <h2 className="text-xs font-semibold text-stone-400 uppercase tracking-wide border-l-2 border-[#b8864a] pl-2">
                    {section.title}
                  </h2>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">
                    {section.fields.map(field => {
                      const val = sectionData[field.key];
                      const isEmpty = !val || (Array.isArray(val) ? val.length === 0 : val === '');
                      if (isEmpty) return null;
                      return (
                        <div key={field.key}>
                          <div className="text-xs text-stone-400 mb-1.5">{field.label}</div>
                          <FieldValue value={val} />
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </>
        )}
      {lightbox}
    </div>
  );
  }

  // List view — only reachable when selectedId === null
  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <MapPin className="w-5 h-5 text-[#b8864a]" />
          <h1 className="text-xl font-bold text-[#2c2c2c]">{t('Visit Records', '访谈记录')}</h1>
          <span className="text-sm text-stone-400">{records.length}</span>
        </div>
        <div className="flex items-center gap-2">
          <a
            href="/admin/survey-questions"
            className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border border-stone-200 bg-white text-xs font-medium text-stone-600 hover:bg-stone-50 hover:text-[#b8864a] transition"
          >
            <ClipboardList className="w-3.5 h-3.5" />
            {t('Survey Questions', '问卷题目')}
          </a>
          <a
            href="/field/survey"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border border-stone-200 bg-white text-xs font-medium text-stone-600 hover:bg-stone-50 hover:text-[#b8864a] transition"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            {t('Interview Page', '访谈提交页')}
          </a>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 mb-4">
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder={t('Search company / staff…', '搜索公司 / 人员…')}
          className="basis-full sm:basis-auto sm:flex-1 h-9 px-3 rounded-lg border border-stone-200 bg-stone-50 text-[15px] placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-[#B8864A]/15 focus:border-[#B8864A] focus:bg-white min-w-0"
        />
        <AdminSelect
          value={statusFilter}
          onChange={setStatusFilter}
          options={STATUS_OPTIONS}
          size="sm"
          className="w-36"
        />
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Spinner /></div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-stone-400 text-sm">{t('No records found.', '暂无记录。')}</div>
      ) : (
        <div className="bg-white rounded-xl border border-stone-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-stone-100 text-left">
                <th className="px-4 py-3 font-medium text-stone-500">#</th>
                <th className="px-4 py-3 font-medium text-stone-500">{t('Company', '公司')}</th>
                <th className="px-4 py-3 font-medium text-stone-500">{t('Interviewer', '采访人')}</th>
                <th className="px-4 py-3 font-medium text-stone-500">{t('Status', '状态')}</th>
                <th className="px-4 py-3 font-medium text-stone-500">{t('Submitted', '提交时间')}</th>
                <th className="px-4 py-3 font-medium text-stone-500">{t('Created', '创建时间')}</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(r => (
                <tr
                  key={r.id}
                  className="border-b border-stone-50 hover:bg-stone-50 transition-colors cursor-pointer"
                  onClick={() => openDetail(r.id)}
                >
                  <td className="px-4 py-3 text-stone-400">{r.id}</td>
                  <td className="px-4 py-3">
                    <div className="font-medium text-[#2c2c2c]">{r.company_name || '—'}</div>
                    {r.linked_company_name && r.linked_company_name !== r.company_name && (
                      <div className="text-xs text-stone-400 mt-0.5">→ {r.linked_company_name}</div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-stone-600">{r.interviewer_name}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                      r.status === 'submitted' ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-700'
                    }`}>
                      {r.status === 'submitted' ? t('Submitted', '已提交') : t('Draft', '草稿')}
                    </span>
                  </td>
                  <td className={`px-4 py-3 ${ADMIN_TIME_CLS}`}>{formatDate(r.submitted_at)}</td>
                  <td className={`px-4 py-3 ${ADMIN_TIME_CLS}`}>{formatDate(r.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default function AdminVisitRecordsPage() {
  return (
    <Suspense fallback={<div />}>
      <AdminVisitRecordsContent />
    </Suspense>
  );
}
