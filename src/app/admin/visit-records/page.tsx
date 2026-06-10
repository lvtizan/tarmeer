'use client';
import { useState, useEffect, useCallback, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { adminApi, fieldApi } from '@/lib/adminApi';
import { showConfirm } from '@/components/ui/ConfirmModal';
import { Spinner } from '@/components/ui/Spinner';
import { useAdminT } from '@/hooks/useAdminLang';
import { useAdminCountry } from '@/contexts/AdminCountryContext';
import AdminSelect from '@/components/ui/AdminSelect';
import { MapPin, ExternalLink, X, ClipboardList, Trash2 } from 'lucide-react';
import { formatAdminDateTime, ADMIN_TIME_CLS } from '@/lib/formatTime';

interface VisitRecord {
  id: number;
  company_name: string;
  interviewer_name: string;
  linked_company_name: string | null;
  company_ref_id: number | null;
  company_ref_source: string | null;
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

interface BindCandidate {
  id: number;
  name: string;
  city: string | null;
  source: 'uae' | 'profile';
}

interface VisitRecordDetail extends VisitRecord {
  country?: string;
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

interface EditLog {
  id: number;
  editor_id: number;
  editor_name: string;
  edit_summary: string;
  edited_at: string;
}

interface SchemaField {
  key: string;
  label: string;
}

interface SchemaSection {
  title: string;
  key: string;
  fields: SchemaField[];
}

const STATUS_OPTIONS = [
  { value: '', label: 'All Status' },
  { value: 'submitted', label: 'Submitted' },
  { value: 'draft', label: 'Draft' },
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
  if (arr.length === 1) {
    return <span className="text-sm font-medium text-[#2c2c2c]">{arr[0]}</span>;
  }
  return (
    <div className="flex flex-wrap gap-1.5">
      {arr.map((v, i) => (
        <span key={i} className="inline-flex items-center px-2 py-0.5 rounded text-sm font-medium bg-stone-100 text-stone-700">
          {v}
        </span>
      ))}
    </div>
  );
}

function AdminVisitRecordsContent() {
  const { t } = useAdminT();
  const { country } = useAdminCountry();
  const searchParams = useSearchParams();
  const [records, setRecords] = useState<VisitRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [detail, setDetail] = useState<VisitRecordDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const [activeSchema, setActiveSchema] = useState<SchemaSection[]>([]);
  const [schemaLoaded, setSchemaLoaded] = useState(false);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [deleting, setDeleting] = useState(false);
  const [editLogs, setEditLogs] = useState<EditLog[]>([]);
  const [bindOpen, setBindOpen] = useState(false);
  const [bindQuery, setBindQuery] = useState('');
  const [bindResults, setBindResults] = useState<BindCandidate[]>([]);
  const [bindSearching, setBindSearching] = useState(false);
  const [binding, setBinding] = useState(false);

  useEffect(() => {
    fieldApi.getSurveySchema()
      .then((res: { schema: SchemaSection[] | null }) => {
        if (res?.schema && Array.isArray(res.schema) && res.schema.length > 0) {
          setActiveSchema(res.schema);
        }
      })
      .catch(() => {})
      .finally(() => setSchemaLoaded(true));
  }, []);

  const fetchRecords = useCallback(async () => {
    setLoading(true);
    try {
      const data = await adminApi.getInterviews(country);
      setRecords(data.interviews || []);
    } catch {}
    setLoading(false);
  }, [country]);

  useEffect(() => { fetchRecords(); }, [fetchRecords]);

  // Auto-open a record when navigating back from company detail (?detail=N)
  useEffect(() => {
    const detailId = searchParams.get('detail');
    if (detailId) {
      openDetail(Number(detailId));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSelectAll = (checked: boolean) => {
    setSelected(checked ? new Set(filtered.map(r => r.id)) : new Set());
  };

  const handleSelectOne = (id: number, checked: boolean) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (checked) next.add(id); else next.delete(id);
      return next;
    });
  };

  const handleBatchDelete = async () => {
    const count = selected.size;
    const ids = Array.from(selected);
    showConfirm({
      title: `删除 ${count} 条访谈记录`,
      message: '此操作不可恢复，记录将被永久删除。',
      requireText: 'DELETE',
      onConfirm: async () => {
        setDeleting(true);
        try {
          await adminApi.deleteInterviews(ids);
          setSelected(new Set());
          await fetchRecords();
        } catch {
          alert('删除失败，请重试');
        }
        setDeleting(false);
      },
    });
  };

  const openDetail = async (id: number) => {
    setSelectedId(id);
    setDetail(null);
    setDetailLoading(true);
    setBindOpen(false); setBindQuery(''); setBindResults([]);
    try {
      const data = await adminApi.getInterview(id);
      setDetail(data.interview || data);
      setEditLogs(data.edit_logs || []);
    } catch {}
    setDetailLoading(false);
  };

  // 绑定公司：按访谈所属国家搜索（国家数据隔离），选中后 PATCH company_ref
  const handleBindSearch = async (q: string) => {
    setBindQuery(q);
    if (!q.trim()) { setBindResults([]); return; }
    setBindSearching(true);
    try {
      const { results } = await fieldApi.searchCompanies(q.trim(), detail?.country || country) as { results: BindCandidate[] };
      setBindResults(results || []);
    } catch {
      setBindResults([]);
    } finally {
      setBindSearching(false);
    }
  };

  const handleBind = async (candidate: BindCandidate) => {
    if (!detail || binding) return;
    setBinding(true);
    try {
      await adminApi.updateInterview(detail.id, {
        company_ref_id: candidate.id,
        company_ref_source: candidate.source,
      });
      setBindOpen(false); setBindQuery(''); setBindResults([]);
      await openDetail(detail.id);
      await fetchRecords();
    } catch {
      alert(t('Failed to bind company', '绑定失败，请重试'));
    } finally {
      setBinding(false);
    }
  };

  const handleUnbind = async () => {
    if (!detail || binding) return;
    setBinding(true);
    try {
      await adminApi.updateInterview(detail.id, { company_ref_id: null });
      await openDetail(detail.id);
      await fetchRecords();
    } catch {
      alert(t('Failed to unbind', '解绑失败，请重试'));
    } finally {
      setBinding(false);
    }
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
          onClick={() => { setSelectedId(null); setDetail(null); setLightboxUrl(null); setEditLogs([]); }}
          className="flex items-center gap-1.5 text-sm text-stone-500 hover:text-stone-800"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
          {t('Back to Records', '返回访谈列表')}
        </button>

        {detailLoading || !detail ? (
          <div className="flex justify-center py-16"><Spinner /></div>
        ) : (
          <>
            <div className="bg-white rounded-xl border border-stone-200 p-4 sm:p-5">
              {/* Title row: company name + status badge */}
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="min-w-0">
                  <h1 className="text-[17px] sm:text-[22px] font-bold text-[#2c2c2c] leading-snug">{detail.company_name || '—'}</h1>
                  {/* 绑定状态 + 操作 */}
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    {detail.company_ref_id ? (
                      <>
                        <span className="text-xs text-stone-400 flex items-center gap-1">
                          → {detail.linked_company_name || `#${detail.company_ref_id}`}
                          <a
                            href={detail.company_ref_source === 'profile' ? `/admin/profile-companies/${detail.company_ref_id}` : `/admin/companies/${detail.company_ref_id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[#b8864a] hover:opacity-70"
                          >
                            <ExternalLink size={12} />
                          </a>
                        </span>
                        <button
                          type="button"
                          onClick={() => { setBindOpen(v => !v); setBindQuery(detail.company_name || ''); if (!bindOpen) handleBindSearch(detail.company_name || ''); }}
                          className="text-xs text-stone-400 hover:text-[#b8864a] underline decoration-dotted"
                        >{t('Rebind', '改绑')}</button>
                        <button
                          type="button"
                          onClick={handleUnbind}
                          disabled={binding}
                          className="text-xs text-stone-400 hover:text-red-500 underline decoration-dotted disabled:opacity-50"
                        >{t('Unbind', '解绑')}</button>
                      </>
                    ) : (
                      <>
                        <span className="text-xs px-2 py-0.5 rounded-full bg-amber-50 text-amber-600">{t('Not bound', '未绑定公司')}</span>
                        <button
                          type="button"
                          onClick={() => { setBindOpen(v => !v); setBindQuery(detail.company_name || ''); if (!bindOpen) handleBindSearch(detail.company_name || ''); }}
                          className="text-xs text-[#b8864a] hover:underline font-medium"
                        >{t('Bind company', '绑定公司')}</button>
                      </>
                    )}
                  </div>
                  {/* 绑定搜索面板 */}
                  {bindOpen && (
                    <div className="mt-2 w-full sm:w-96 border border-stone-200 rounded-xl bg-stone-50/60 p-3">
                      <input
                        value={bindQuery}
                        onChange={(e) => handleBindSearch(e.target.value)}
                        placeholder={t('Search companies in this country…', '搜索本国公司…')}
                        autoFocus
                        className="w-full h-9 px-3 rounded-lg border border-stone-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#b8864a]/15 focus:border-[#b8864a]"
                      />
                      <div className="mt-2 max-h-48 overflow-y-auto space-y-1">
                        {bindSearching ? (
                          <p className="text-xs text-stone-400 py-2 text-center">{t('Searching…', '搜索中…')}</p>
                        ) : bindResults.length === 0 ? (
                          <p className="text-xs text-stone-400 py-2 text-center">{bindQuery.trim() ? t('No match', '无匹配公司') : t('Type to search', '输入公司名搜索')}</p>
                        ) : bindResults.map(c => (
                          <button
                            key={`${c.source}-${c.id}`}
                            type="button"
                            disabled={binding}
                            onClick={() => handleBind(c)}
                            className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg bg-white border border-stone-100 hover:border-[#b8864a]/50 text-left transition-colors disabled:opacity-50"
                          >
                            <span className="flex-1 min-w-0 text-sm text-[#2c2c2c] truncate">{c.name}</span>
                            {c.city && <span className="text-xs text-stone-400 shrink-0">{c.city}</span>}
                            <span className={`text-[10px] px-1.5 py-0.5 rounded shrink-0 ${c.source === 'profile' ? 'bg-blue-50 text-blue-600' : 'bg-stone-100 text-stone-500'}`}>
                              {c.source === 'profile' ? t('Registered', '注册') : t('Directory', '目录')}
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
                <span className={`flex-shrink-0 mt-0.5 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                  detail.status === 'submitted' ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'
                }`}>
                  {detail.status === 'submitted' ? t('Submitted', '已提交') : t('Draft', '草稿')}
                </span>
              </div>

              {/* Meta — compact inline on mobile, grid on desktop */}
              <div className="pt-3 border-t border-stone-100">
                {/* Mobile: values only, no labels */}
                <div className="sm:hidden space-y-1 text-sm">
                  <div className="flex items-center gap-2 flex-wrap text-stone-600">
                    {detail.interviewer_name && <span className="font-medium text-[#2c2c2c]">{detail.interviewer_name}</span>}
                    {detail.company_name && <>
                      <span className="text-stone-300">·</span>
                      {detail.company_ref_id ? (
                        <a
                          href={`${detail.company_ref_source === 'profile' ? `/admin/profile-companies/${detail.company_ref_id}` : `/admin/companies/${detail.company_ref_id}`}?from=visit-records&recordId=${detail.id}`}
                          className="text-[#b8864a] hover:underline inline-flex items-center gap-0.5"
                        >
                          {detail.company_name}<ExternalLink size={11} />
                        </a>
                      ) : (
                        <a href={`/admin/companies?search=${encodeURIComponent(detail.company_name)}`} className="text-stone-500 inline-flex items-center gap-0.5">
                          {detail.company_name}<ExternalLink size={11} className="text-stone-400" />
                        </a>
                      )}
                    </>}
                  </div>
                  <div className={`flex items-center gap-2 flex-wrap ${ADMIN_TIME_CLS}`}>
                    <span>{formatDate(detail.created_at)}</span>
                    {detail.submitted_at && <>
                      <span className="text-stone-300">→</span>
                      <span>{formatDate(detail.submitted_at)}</span>
                    </>}
                    <span className="text-stone-300">·</span>
                    <span>#{detail.id}</span>
                  </div>
                </div>

                {/* Desktop: 5-col English info bar */}
                <div className="hidden sm:flex items-start gap-0 text-sm divide-x divide-stone-100">
                  <div className="pr-6">
                    <div className="text-[11px] font-semibold text-stone-400 uppercase tracking-wider mb-1">Interviewer</div>
                    <div className="font-medium text-[#2c2c2c]">{detail.interviewer_name || '—'}</div>
                  </div>
                  <div className="px-6">
                    <div className="text-[11px] font-semibold text-stone-400 uppercase tracking-wider mb-1">Subject</div>
                    {detail.company_ref_id ? (
                      <a
                        href={`${detail.company_ref_source === 'profile' ? `/admin/profile-companies/${detail.company_ref_id}` : `/admin/companies/${detail.company_ref_id}`}?from=visit-records&recordId=${detail.id}`}
                        className="font-medium text-[#b8864a] hover:underline inline-flex items-center gap-1"
                      >
                        {detail.company_name || '—'}<ExternalLink size={12} />
                      </a>
                    ) : (
                      <div className="flex items-center gap-1.5">
                        <span className="font-medium text-[#2c2c2c]">{detail.company_name || '—'}</span>
                        {detail.company_name && (
                          <a href={`/admin/companies?search=${encodeURIComponent(detail.company_name)}`} title="Search in companies" className="text-stone-400 hover:text-[#b8864a] transition-colors">
                            <ExternalLink size={12} />
                          </a>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="px-6">
                    <div className="text-[11px] font-semibold text-stone-400 uppercase tracking-wider mb-1">Created</div>
                    <div className={ADMIN_TIME_CLS}>{formatDate(detail.created_at)}</div>
                  </div>
                  <div className="px-6">
                    <div className="text-[11px] font-semibold text-stone-400 uppercase tracking-wider mb-1">Submitted</div>
                    <div className={ADMIN_TIME_CLS}>{formatDate(detail.submitted_at) || '—'}</div>
                  </div>
                  <div className="pl-6">
                    <div className="text-[11px] font-semibold text-stone-400 uppercase tracking-wider mb-1">ID</div>
                    <div className="text-stone-500">#{detail.id}</div>
                  </div>
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
                  <h2 className="text-xs font-semibold text-stone-700 uppercase tracking-wide border-l-2 border-[#b8864a] pl-2 mb-3">
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

            {!schemaLoaded ? (
              <div className="flex justify-center py-4"><Spinner /></div>
            ) : activeSchema.map(section => {
              const sectionData = parseSection(detail[section.key as keyof VisitRecordDetail]);
              const hasAnyData = section.fields.some(f => {
                const v = sectionData[f.key];
                return v && (Array.isArray(v) ? v.length > 0 : v !== '');
              });
              if (!hasAnyData) return null;
              return (
                <div key={section.key} className="bg-white rounded-xl border border-stone-200 overflow-hidden">
                  <div className="px-5 py-3 bg-stone-50 border-b border-stone-100">
                    <h2 className="text-[11px] font-semibold text-stone-400 uppercase tracking-widest">{section.title}</h2>
                  </div>
                  <div className="divide-y divide-stone-50">
                    {section.fields.map(field => {
                      const val = sectionData[field.key];
                      const isEmpty = !val || (Array.isArray(val) ? val.length === 0 : val === '');
                      if (isEmpty) return null;
                      return (
                        <div key={field.key} className="flex items-start gap-4 px-5 py-3.5">
                          <div className="w-28 sm:w-28 sm:w-52 flex-shrink-0 text-sm text-stone-600 pt-0.5 leading-snug">{field.label}</div>
                          <div className="flex-1 min-w-0"><FieldValue value={val} /></div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}

            {editLogs.length > 0 && (
              <div className="bg-white rounded-xl border border-stone-200 overflow-hidden">
                <div className="px-5 py-3 bg-stone-50 border-b border-stone-100">
                  <h2 className="text-[11px] font-semibold text-stone-400 uppercase tracking-widest">修改历史 ({editLogs.length})</h2>
                </div>
                <div className="p-5 space-y-3">
                  {editLogs.map((log, i) => (
                    <div key={log.id} className="flex gap-3">
                      <div className="flex-shrink-0 w-6 h-6 rounded-full bg-stone-100 flex items-center justify-center text-xs text-stone-500 font-medium mt-0.5">
                        {i + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-medium text-stone-800">{log.editor_name}</span>
                          <span className="text-xs text-stone-400">{formatDate(log.edited_at)}</span>
                        </div>
                        <p className="text-xs text-stone-500 mt-0.5 leading-relaxed break-words">{log.edit_summary}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
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
            title={t('Survey Questions', '问卷题目')}
          >
            <ClipboardList className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{t('Survey Questions', '问卷题目')}</span>
          </a>
          <a
            href="/field/survey"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border border-stone-200 bg-white text-xs font-medium text-stone-600 hover:bg-stone-50 hover:text-[#b8864a] transition"
            title={t('Interview Page', '访谈提交页')}
          >
            <ExternalLink className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{t('Interview Page', '访谈提交页')}</span>
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

      {selected.size > 0 && (
        <div className="flex items-center justify-between px-4 py-2.5 mb-2 rounded-lg bg-red-50 border border-red-100">
          <span className="text-sm text-red-700">已选 {selected.size} 条</span>
          <button
            onClick={handleBatchDelete}
            disabled={deleting}
            className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg bg-red-600 text-white text-xs font-medium hover:bg-red-700 disabled:opacity-50 transition"
          >
            <Trash2 className="w-3.5 h-3.5" />
            {deleting ? '删除中…' : '删除所选'}
          </button>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-16"><Spinner /></div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-stone-400 text-sm">{t('No records found.', '暂无记录。')}</div>
      ) : (
        <>
          {/* Mobile cards */}
          <div className="sm:hidden space-y-2">
            {filtered.map(r => (
              <div
                key={r.id}
                className={`bg-white rounded-xl border flex items-stretch cursor-pointer transition-colors ${selected.has(r.id) ? 'border-amber-300 bg-amber-50/30' : 'border-stone-200'}`}
                onClick={() => openDetail(r.id)}
              >
                {/* Checkbox — large touch target on left */}
                <div
                  className="flex-shrink-0 flex items-center justify-center w-12"
                  onClick={e => { e.stopPropagation(); handleSelectOne(r.id, !selected.has(r.id)); }}
                >
                  <div className="w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors"
                    style={{ borderColor: selected.has(r.id) ? '#b8864a' : '#d1cdc7', backgroundColor: selected.has(r.id) ? '#b8864a' : 'white' }}
                  >
                    {selected.has(r.id) && (
                      <svg className="w-3 h-3 text-white" viewBox="0 0 12 12" fill="none">
                        <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </div>
                </div>

                {/* Card content */}
                <div className="flex-1 min-w-0 p-4">
                  <div className="flex items-start justify-between gap-2 mb-1.5">
                    <div className="min-w-0 flex-1">
                      <div className="font-medium text-[#2c2c2c] text-[15px] leading-snug">{r.company_name || '—'}</div>
                      {r.linked_company_name && r.linked_company_name !== r.company_name && r.company_ref_id && (
                        <a
                          href={`${r.company_ref_source === 'profile' ? `/admin/profile-companies/${r.company_ref_id}` : `/admin/companies/${r.company_ref_id}`}`}
                          onClick={e => e.stopPropagation()}
                          className="text-xs text-[#b8864a] hover:underline flex items-center gap-0.5 mt-0.5"
                        >
                          → {r.linked_company_name}
                        </a>
                      )}
                    </div>
                    <span className={`flex-shrink-0 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                      r.status === 'submitted' ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'
                    }`}>
                      {r.status === 'submitted' ? t('Submitted', '已提交') : t('Draft', '草稿')}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-stone-500 flex-wrap">
                    <span className="font-medium text-stone-600">{r.interviewer_name}</span>
                    <span className={ADMIN_TIME_CLS}>{formatDate(r.submitted_at || r.created_at)}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Desktop table */}
          <div className="hidden sm:block bg-white rounded-xl border border-stone-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-stone-100 text-left">
                  <th className="px-4 py-3">
                    <input
                      type="checkbox"
                      checked={filtered.length > 0 && filtered.every(r => selected.has(r.id))}
                      onChange={e => handleSelectAll(e.target.checked)}
                      className="rounded border-stone-300"
                    />
                  </th>
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
                    className={`border-b border-stone-50 hover:bg-stone-50 transition-colors cursor-pointer ${selected.has(r.id) ? 'bg-amber-50/40' : ''}`}
                    onClick={() => openDetail(r.id)}
                  >
                    <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={selected.has(r.id)}
                        onChange={e => handleSelectOne(r.id, e.target.checked)}
                        className="rounded border-stone-300"
                      />
                    </td>
                    <td className="px-4 py-3 text-stone-400">{r.id}</td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-[#2c2c2c]">{r.company_name || '—'}</div>
                      {r.linked_company_name && r.linked_company_name !== r.company_name && r.company_ref_id && (
                        <a
                          href={`${r.company_ref_source === 'profile' ? `/admin/profile-companies/${r.company_ref_id}` : `/admin/companies/${r.company_ref_id}`}`}
                          onClick={e => e.stopPropagation()}
                          className="text-xs text-[#b8864a] hover:underline mt-0.5 flex items-center gap-1"
                        >
                          → {r.linked_company_name}
                        </a>
                      )}
                    </td>
                    <td className="px-4 py-3 text-stone-600">{r.interviewer_name}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                        r.status === 'submitted' ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'
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
        </>
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
