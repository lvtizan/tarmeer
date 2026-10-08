'use client';
import { useState, useEffect, useLayoutEffect, useCallback, useRef, Suspense } from 'react';
import { adminApi, fieldApi } from '@/lib/adminApi';
import { showConfirm } from '@/components/ui/ConfirmModal';
import { Spinner } from '@/components/ui/Spinner';
import { useAdminT } from '@/hooks/useAdminLang';
import { useAdminCountry } from '@/contexts/AdminCountryContext';
import AdminSelect from '@/components/ui/AdminSelect';
import { MapPin, ExternalLink, X, ClipboardList, Trash2, FileText, Download, Pencil } from 'lucide-react';
import VerificationRecordSections from '@/components/admin/VerificationRecordSections';
import { parseRecordSchema, parseRecordFiles, exportRecordPayload, parseRecordServiceAreas as parseServiceAreas, type RecordServiceArea as SvcArea } from '@/components/admin/VerificationRecordModel';
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  service_areas?: unknown;
  section_9?: any;  // 服务区域（列表列展示）
}

interface PhotoEntry {
  url: string;
  lat?: number;
  lng?: number;
  timestamp?: string;
}

interface AttachmentEntry {
  url: string;
  name?: string;
  type?: string;
  size?: number;
  field_key?: string;
  uploaded_at?: string;
}

interface BindCandidate {
  id: number;
  name: string;
  city: string | null;
  source: 'uae' | 'profile';
}

interface VisitRecordDetail extends VisitRecord {
  country?: string;
  schema_snapshot?: unknown;
  schema_version?: string;
  verification_data?: unknown;
  section_1: Record<string, string | string[]> | null;
  section_2: Record<string, string | string[]> | null;
  section_3: Record<string, string | string[]> | null;
  section_4: Record<string, string | string[]> | null;
  section_5: Record<string, string | string[]> | null;
  section_6: Record<string, string | string[]> | null;
  section_7: Record<string, string | string[]> | null;
  section_8: Record<string, string | string[]> | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  section_9: any;  // { areas: [{ emirate, sectors:[{group,districts}] }] }（兼容旧结构）
  filled_by?: string | null;  // 公开问卷填写人（非必填）
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  location_pin?: any;  // { lat, lng, address }
  attachments?: string | AttachmentEntry[] | null;
  photos?: string | PhotoEntry[] | null;
}

// 一套区域压成一行文本（列表用）
function svcAreaToLine(a: SvcArea): string {
  const parts = a.sectors.map(s => {
    const ds = s.districts.join(', ');
    return s.group ? (ds ? `${s.group}: ${ds}` : s.group) : ds;
  }).filter(Boolean);
  const tail = parts.join('; ');
  return tail ? `${a.emirate} — ${tail}` : a.emirate;
}

// 解析附件 JSON（兼容字符串 / 已解析数组），过滤无 url 的脏数据
function parseAttachments(raw: unknown): AttachmentEntry[] {
  if (!raw) return [];
  let obj: unknown = raw;
  if (typeof raw === 'string') { try { obj = JSON.parse(raw); } catch { return []; } }
  if (!Array.isArray(obj)) return [];
  return parseRecordFiles(obj);
}

function formatBytes(bytes?: number): string {
  if (!bytes || bytes <= 0) return '';
  const units = ['B', 'KB', 'MB', 'GB'];
  let v = bytes;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) { v /= 1024; i++; }
  return `${v.toFixed(v >= 10 || i === 0 ? 0 : 1)} ${units[i]}`;
}

interface EditLog {
  id: number;
  editor_id: number;
  editor_name: string;
  edit_summary: string;
  edited_at: string;
}

const STATUS_OPTIONS = [
  { value: '', label: 'All Status' },
  { value: 'submitted', label: 'Submitted' },
  { value: 'draft', label: 'Draft' },
];

function AdminVisitRecordsContent() {
  const { t } = useAdminT();
  const { country } = useAdminCountry();
  const [records, setRecords] = useState<VisitRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState(false);
  const [detailError, setDetailError] = useState(false);
  const [schemaError, setSchemaError] = useState(false);
  const [recordsCountry, setRecordsCountry] = useState(country);
  const [detailCountry, setDetailCountry] = useState(country);
  const countryRef = useRef(country);
  const detailCountryRef = useRef(country);
  useLayoutEffect(() => { countryRef.current = country; }, [country]);
  const listRequest = useRef(0);
  const schemaRequest = useRef(0);
  const detailRequest = useRef(0);
  const bindRequest = useRef(0);
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const selectedIdRef = useRef<number | null>(null);
  const [detail, setDetail] = useState<VisitRecordDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const [activeSchema, setActiveSchema] = useState<unknown>(null);
  const [schemaLoaded, setSchemaLoaded] = useState(false);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [deleting, setDeleting] = useState(false);
  const [editLogs, setEditLogs] = useState<EditLog[]>([]);
  const [bindOpen, setBindOpen] = useState(false);
  const [bindQuery, setBindQuery] = useState('');
  const [bindResults, setBindResults] = useState<BindCandidate[]>([]);
  const [bindSearching, setBindSearching] = useState(false);
  const [bindError, setBindError] = useState(false);
  const [binding, setBinding] = useState(false);

  const loadSchema = useCallback(async () => {
    const request = ++schemaRequest.current;
    const requestedCountry = country;
    setSchemaLoaded(false); setSchemaError(false); setActiveSchema(null);
    try {
      const res = await fieldApi.getSurveySchema(country, 'legacy') as { schema: unknown };
      if (request === schemaRequest.current && countryRef.current === requestedCountry) setActiveSchema(res?.schema ?? null);
    } catch { if (request === schemaRequest.current && countryRef.current === requestedCountry) setSchemaError(true); }
    finally { if (request === schemaRequest.current && countryRef.current === requestedCountry) setSchemaLoaded(true); }
  }, [country]);
  useEffect(() => { void loadSchema(); }, [loadSchema]);

  const fetchRecords = useCallback(async () => {
    const request = ++listRequest.current;
    const requestedCountry = country;
    setLoading(true); setListError(false);
    try {
      const data = await adminApi.getInterviews(country);
      if (request === listRequest.current && countryRef.current === requestedCountry) {
        setRecords(data.interviews || []); setRecordsCountry(requestedCountry);
      }
    } catch { if (request === listRequest.current && countryRef.current === requestedCountry) { setRecords([]); setRecordsCountry(requestedCountry); setListError(true); } }
    finally { if (request === listRequest.current && countryRef.current === requestedCountry) setLoading(false); }
  }, [country]);

  useEffect(() => {
    ++detailRequest.current; ++bindRequest.current;
    setSelectedId(null); setDetail(null); setSelected(new Set()); setEditLogs([]);
    setBindOpen(false); setBindResults([]); setLightboxUrl(null); setSearch(''); setStatusFilter('');
    void fetchRecords();
  }, [fetchRecords]);

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
          await adminApi.deleteInterviews(ids, country);
          setSelected(new Set());
          await fetchRecords();
        } catch {
          alert('删除失败，请重试');
        }
        setDeleting(false);
      },
    });
  };

  const openDetail = useCallback(async (id: number) => {
    const request = ++detailRequest.current;
    ++bindRequest.current;
    const requestedCountry = country;
    detailCountryRef.current = country;
    setDetailCountry(country); setDetailError(false); setEditLogs([]);
    selectedIdRef.current = id;
    setSelectedId(id);
    setDetail(null);
    setDetailLoading(true);
    setBindOpen(false); setBindQuery(''); setBindResults([]); setBindError(false);
    try {
      const data = await adminApi.getInterview(id, country);
      if (request !== detailRequest.current || countryRef.current !== requestedCountry) return;
      const record = data.interview || data;
      if (record.country && record.country !== requestedCountry) throw new Error('Country mismatch');
      setDetail(record); setEditLogs(data.edit_logs || []);
    } catch { if (request === detailRequest.current && countryRef.current === requestedCountry) setDetailError(true); }
    finally { if (request === detailRequest.current && countryRef.current === requestedCountry) setDetailLoading(false); }
  }, [country]);

  const showDetail = (id: number) => {
    const url = new URL(window.location.href);
    url.searchParams.set('detail', String(id));
    url.hash = '';
    window.history.pushState({}, '', `${url.pathname}${url.search}`);
    void openDetail(id);
  };

  const closeDetail = () => {
    ++detailRequest.current; ++bindRequest.current;
    selectedIdRef.current = null;
    setSelectedId(null); setDetail(null); setLightboxUrl(null); setEditLogs([]);
    const url = new URL(window.location.href);
    url.searchParams.delete('detail');
    url.hash = '';
    window.history.pushState({}, '', `${url.pathname}${url.search}`);
  };

  // Keep the selected record in the URL so a section hash can be copied or restored with browser history.
  useEffect(() => {
    const syncDetailFromUrl = () => {
      const detailId = new URLSearchParams(window.location.search).get('detail');
      if (detailId && /^\d+$/.test(detailId) && Number(detailId) > 0) {
        const id = Number(detailId);
        if (selectedIdRef.current !== id || detailCountryRef.current !== country) void openDetail(id);
        return;
      }
      ++detailRequest.current; ++bindRequest.current;
      selectedIdRef.current = null;
      setSelectedId(null); setDetail(null); setLightboxUrl(null); setEditLogs([]);
    };
    syncDetailFromUrl();
    window.addEventListener('popstate', syncDetailFromUrl);
    return () => window.removeEventListener('popstate', syncDetailFromUrl);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openDetail]);

  // 绑定公司：按访谈所属国家搜索（国家数据隔离），选中后 PATCH company_ref
  const handleBindSearch = async (q: string) => {
    const request = ++bindRequest.current;
    const requestedCountry = country;
    setBindQuery(q);
    setBindError(false);
    if (!q.trim()) { setBindResults([]); setBindSearching(false); return; }
    setBindSearching(true);
    try {
      const { results } = await fieldApi.searchCompanies(q.trim(), detail?.country || country) as { results: BindCandidate[] };
      if (request === bindRequest.current && countryRef.current === requestedCountry) setBindResults(results || []);
    } catch {
      if (request === bindRequest.current && countryRef.current === requestedCountry) { setBindResults([]); setBindError(true); }
    } finally {
      if (request === bindRequest.current && countryRef.current === requestedCountry) setBindSearching(false);
    }
  };

  const handleBind = async (candidate: BindCandidate) => {
    if (!detail || binding) return;
    setBinding(true);
    try {
      await adminApi.updateInterview(detail.id, {
        company_ref_id: candidate.id,
        company_ref_source: candidate.source,
      }, country);
      if (countryRef.current !== country) return;
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
      await adminApi.updateInterview(detail.id, { company_ref_id: null, company_ref_source: null }, country);
      if (countryRef.current !== country) return;
      await openDetail(detail.id);
      await fetchRecords();
    } catch {
      alert(t('Failed to unbind', '解绑失败，请重试'));
    } finally {
      setBinding(false);
    }
  };

  const filtered = (recordsCountry === country ? records : []).filter(r => {
    if (statusFilter && r.status !== statusFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        (r.company_name || '').toLowerCase().includes(q) ||
        (r.interviewer_name || '').toLowerCase().includes(q)
      );
    }
    return true;
  });

  const formatDate = (s: string | null) => formatAdminDateTime(s);

  const handleExport = () => {
    if (!detail || detailCountry !== country) return;
    const payload = exportRecordPayload(detail as unknown as Record<string, unknown>, activeSchema);
    const url = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }));
    const link = document.createElement('a');
    link.href = url; link.download = `tarmeer-verification-${detail.id}.json`;
    document.body.appendChild(link); link.click(); link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

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
  if (selectedId !== null && detailCountry === country) {
    return (
      <div className="space-y-4">
        <button
          onClick={closeDetail}
          className="flex items-center gap-1.5 text-sm text-stone-500 hover:text-stone-800"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
          {t('Back to Records', '返回访谈列表')}
        </button>

        {detailError ? (
          <div role="alert" className="rounded-xl border border-red-200 bg-white p-5 text-sm text-red-600">{t('Record could not be loaded.', '记录加载失败。')} <button className="underline" onClick={() => openDetail(selectedId)}>{t('Retry', '重试')}</button></div>
        ) : detailLoading || !detail ? (
          <div className="flex justify-center py-16"><Spinner /></div>
        ) : (
          <>
            <div className="bg-white rounded-xl border border-stone-200 p-4 sm:p-5">
              {/* Title row: company name + status badge */}
              <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
                <div className="min-w-0">
                  <h1 className="text-[17px] sm:text-[22px] font-bold text-[#2c2c2c] leading-snug break-words [overflow-wrap:anywhere]">{detail.company_name || '—'}</h1>
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
                        ) : bindError ? (
                          <p className="text-xs text-red-500 py-2 text-center">{t('Search failed, please retry', '搜索失败，请重试')}</p>
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
                <div className="w-full sm:w-auto min-w-0 max-w-full flex flex-wrap items-center gap-2 print:hidden">
                  <button type="button" onClick={handleExport} className="inline-flex items-center gap-1.5 min-h-9 px-3 rounded-lg border border-stone-200 bg-white text-xs text-stone-600"><Download size={14}/>{t('Export JSON', '导出 JSON')}</button>
                  <button type="button" onClick={() => window.print()} className="inline-flex items-center min-h-9 px-3 rounded-lg border border-stone-200 bg-white text-xs text-stone-600">{t('Print', '打印')}</button>
                  {detail.status === 'submitted' && (
                    <a
                      href={`/field/survey?edit=${detail.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      title={t('Edit (field staff login required)', '编辑（需外勤人员登录）')}
                      className="inline-flex items-center gap-1.5 h-7 px-3 rounded-lg bg-[#b8864a] text-white text-xs font-medium hover:bg-[#a07640] transition"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                      {t('Edit', '编辑')}
                    </a>
                  )}
                  <span className={`mt-0.5 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                    detail.status === 'submitted' ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'
                  }`}>
                    {detail.status === 'submitted' ? t('Submitted', '已提交') : t('Draft', '草稿')}
                  </span>
                </div>
              </div>

              {/* Meta — compact inline on mobile, grid on desktop */}
              <div className="pt-3 border-t border-stone-100">
                {/* Mobile: values only, no labels */}
                <div className="sm:hidden space-y-1 text-sm">
                  <div className="flex items-center gap-2 flex-wrap text-stone-600">
                    {detail.interviewer_name && <span className="font-medium text-[#2c2c2c]">{detail.interviewer_name}</span>}
                    {detail.filled_by && <span>{t("Filled by", "填写人")}: {detail.filled_by}</span>}
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
                <div className="hidden sm:flex flex-wrap items-start gap-y-4 text-sm divide-x divide-stone-100">
                  <div className="pr-6">
                    <div className="text-[11px] font-semibold text-stone-400 uppercase tracking-wider mb-1">Interviewer</div>
                    <div className="font-medium text-[#2c2c2c]">{detail.interviewer_name || '—'}</div>
                  </div>
                  {detail.filled_by && (
                    <div className="px-6">
                      <div className="text-[11px] font-semibold text-stone-400 uppercase tracking-wider mb-1">Filled by</div>
                      <div className="font-medium text-[#2c2c2c]">{detail.filled_by}</div>
                    </div>
                  )}
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
              const photos = parseRecordFiles(detail.photos);
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

            {/* Attachments — 问卷上传的文件（图片/PDF/文档）。后端存于 company_interviews.attachments */}
            {(() => {
              const attachments = parseAttachments(detail.attachments);
              if (attachments.length === 0) return null;
              return (
                <div className="bg-white rounded-xl border border-stone-200 p-5">
                  <h2 className="text-xs font-semibold text-stone-700 uppercase tracking-wide border-l-2 border-[#b8864a] pl-2 mb-3">
                    {t('Attachments', '附件')} ({attachments.length})
                  </h2>
                  <div className="space-y-2">
                    {attachments.map((att, i) => {
                      const isImage = (att.type || '').startsWith('image/');
                      const name = att.name || att.url.split('/').pop() || `file-${i + 1}`;
                      return (
                        <div key={i} className="flex items-center gap-3 px-3 py-2.5 rounded-xl border border-stone-200 bg-stone-50/60">
                          {isImage ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={att.url}
                              alt={name}
                              onClick={() => setLightboxUrl(att.url)}
                              className="w-10 h-10 rounded-md object-cover shrink-0 border border-stone-200 cursor-pointer hover:opacity-80 transition"
                            />
                          ) : (
                            <div className="w-10 h-10 rounded-md bg-amber-50 shrink-0 flex items-center justify-center border border-amber-100">
                              <FileText className="w-5 h-5 text-[#b8864a]" />
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-[#2c2c2c] truncate">{name}</p>
                            <p className="text-xs text-stone-400">
                              {formatBytes(att.size)}
                              {att.field_key ? `${att.size ? ' · ' : ''}${att.field_key}` : ''}
                            </p>
                          </div>
                          <a
                            href={att.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="shrink-0 inline-flex items-center gap-1 text-xs font-medium text-[#b8864a] hover:underline"
                            title={t('Open / Download', '打开 / 下载')}
                          >
                            <Download className="w-3.5 h-3.5" />
                            <span className="hidden sm:inline">{t('Open', '打开')}</span>
                          </a>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })()}

            {parseRecordSchema(detail.schema_snapshot).length > 0 ? (
              <VerificationRecordSections record={detail as unknown as Record<string, unknown>} schema={detail.schema_snapshot}/>
            ) : !schemaLoaded ? <div className="flex justify-center py-4"><Spinner /></div> : (
              <>
                {schemaError && <p role="alert" className="text-sm text-red-600">{t('Survey labels could not be loaded. Saved answers are shown below.', '问卷标签加载失败，下方仍显示已保存的答案。')} <button onClick={loadSchema} className="underline">{t('Retry', '重试')}</button></p>}
                <VerificationRecordSections record={detail as unknown as Record<string, unknown>} schema={activeSchema}/>
              </>
            )}

            {/* Service Area（多套） */}
            {(() => {
              const areas = parseServiceAreas(detail.section_9);
              if (areas.length === 0) return null;
              return (
                <div className="bg-white rounded-xl border border-stone-200 overflow-hidden">
                  <div className="px-5 py-3 bg-stone-50 border-b border-stone-100">
                    <h2 className="text-[11px] font-semibold text-stone-400 uppercase tracking-widest">{t('Service Area', '服务区域')}</h2>
                  </div>
                  <div className="divide-y divide-stone-50">
                    {areas.map((a, i) => (
                      <div key={i} className="px-5 py-3.5">
                        <div className="text-sm font-medium text-[#2c2c2c] mb-1.5">
                          {areas.length > 1 ? `${t('Area', '区域')} ${i + 1} — ` : ''}{a.emirate || '—'}
                        </div>
                        <div className="space-y-1.5">
                          {a.sectors.map((s, j) => (
                            <div key={j} className="flex items-start gap-2 flex-wrap">
                              {s.group && <span className="text-xs text-stone-500 pt-1">{s.group}:</span>}
                              <div className="flex flex-wrap gap-1.5">
                                {s.districts.length > 0
                                  ? s.districts.map(d => (
                                      <span key={d} className="px-2 py-0.5 rounded-md bg-[#b8864a]/10 text-[#b8864a] text-xs">{d}</span>
                                    ))
                                  : <span className="text-xs text-stone-300">—</span>}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}

            {/* Company Address Pin */}
            {(() => {
              const raw = detail.location_pin;
              if (!raw) return null;
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              let pin: any = raw;
              if (typeof raw === 'string') { try { pin = JSON.parse(raw); } catch { return null; } }
              if (!Number.isFinite(Number(pin?.lat)) || !Number.isFinite(Number(pin?.lng)) || pin.lat == null || pin.lng == null) return null;
              return (
                <div className="bg-white rounded-xl border border-stone-200 overflow-hidden">
                  <div className="px-5 py-3 bg-stone-50 border-b border-stone-100">
                    <h2 className="text-[11px] font-semibold text-stone-400 uppercase tracking-widest">{t('Company Address Pin', '公司地址定位')}</h2>
                  </div>
                  <div className="px-5 py-3.5">
                    {typeof pin.address === "string" && pin.address && <p className="text-sm text-[#2c2c2c] mb-1">{pin.address}</p>}
                    <a
                      href={`https://www.google.com/maps?q=${pin.lat},${pin.lng}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-[#b8864a] hover:underline"
                    >
                      {Number(pin.lat).toFixed(5)}, {Number(pin.lng).toFixed(5)} ↗
                    </a>
                  </div>
                </div>
              );
            })()}

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
          <span className="text-sm text-stone-400">{recordsCountry === country ? records.length : 0}</span>
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
          className="basis-full sm:basis-auto sm:flex-1 h-9 px-3 rounded-lg border border-stone-200 bg-white text-[15px] placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-[#B8864A]/15 focus:border-[#B8864A] focus:bg-white min-w-0"
        />
        <AdminSelect
          value={statusFilter}
          onChange={setStatusFilter}
          options={STATUS_OPTIONS}
          size="sm"
          className="w-36"
        />
      </div>

      {recordsCountry === country && selected.size > 0 && (
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

      {loading || recordsCountry !== country ? (
        <div className="flex justify-center py-16"><Spinner /></div>
      ) : listError ? (
        <div role="alert" className="py-10 text-center text-sm text-red-600">{t('Records could not be loaded.', '访谈记录加载失败。')} <button onClick={fetchRecords} className="underline">{t('Retry', '重试')}</button></div>
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
                onClick={() => showDetail(r.id)}
                role="button" tabIndex={0}
                onKeyDown={event => { if (event.target === event.currentTarget && (event.key === "Enter" || event.key === " ")) { event.preventDefault(); showDetail(r.id); } }}
              >
                {/* Checkbox — large touch target on left */}
                <div
                  className="flex-shrink-0 flex items-center justify-center w-12"
                  onClick={e => { e.stopPropagation(); handleSelectOne(r.id, !selected.has(r.id)); }}
                >
                  <button type="button" aria-label={`${t("Select record", "选择记录")} #${r.id}`} aria-pressed={selected.has(r.id)} onKeyDown={event => event.stopPropagation()} className="w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors"
                    style={{ borderColor: selected.has(r.id) ? '#b8864a' : '#d1cdc7', backgroundColor: selected.has(r.id) ? '#b8864a' : 'white' }}
                  >
                    {selected.has(r.id) && (
                      <svg className="w-3 h-3 text-white" viewBox="0 0 12 12" fill="none">
                        <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </button>
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
          <div className="hidden sm:block bg-white rounded-xl border border-stone-200 overflow-x-auto">
            <table className="w-full min-w-[900px] text-sm">
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
                  <th className="px-4 py-3 font-medium text-stone-500">{t('Service Area', '服务区域')}</th>
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
                    onClick={() => showDetail(r.id)}
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
                    <td className="px-4 py-3 text-stone-600 max-w-[260px]">
                      {(() => {
                        const areas = parseServiceAreas(r.service_areas ?? r.section_9);
                        if (areas.length === 0) return <span className="text-stone-300">—</span>;
                        return (
                          <div className="space-y-0.5">
                            {areas.map((a, i) => (
                              <div key={i} className="text-xs text-stone-600 truncate" title={svcAreaToLine(a)}>{svcAreaToLine(a)}</div>
                            ))}
                          </div>
                        );
                      })()}
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
