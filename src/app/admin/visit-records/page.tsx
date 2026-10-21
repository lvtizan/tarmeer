'use client';
import { useState, useEffect, useLayoutEffect, useCallback, useRef, Suspense, type CSSProperties } from 'react';
import { adminApi, fieldApi } from '@/lib/adminApi';
import { showConfirm } from '@/components/ui/ConfirmModal';
import { Spinner } from '@/components/ui/Spinner';
import { useAdminT } from '@/hooks/useAdminLang';
import { useAdminCountry } from '@/contexts/AdminCountryContext';
import AdminSelect from '@/components/ui/AdminSelect';
import { MapPin, ExternalLink, X, ClipboardList, Trash2, FileText, Download, Pencil, History } from 'lucide-react';
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
  section_9?: any;  // Service areas (displayed in list column)
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
  section_9: any;  // { areas: [{ emirate, sectors:[{group,districts}] }] } (legacy structure compatibility)
  filled_by?: string | null;  // Public survey filler (optional)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  location_pin?: any;  // { lat, lng, address }
  attachments?: string | AttachmentEntry[] | null;
  photos?: string | PhotoEntry[] | null;
}

// Format service areas into a single text line (for table)
function svcAreaToLine(a: SvcArea): string {
  const parts = a.sectors.map(s => {
    const ds = s.districts.join(', ');
    return s.group ? (ds ? `${s.group}: ${ds}` : s.group) : ds;
  }).filter(Boolean);
  const tail = parts.join('; ');
  return tail ? `${a.emirate} — ${tail}` : a.emirate;
}

// Parse attachment JSON (compatible with string or parsed array), filter dirty entries without url
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

function cleanVal(v: string): string {
  if (!v) return '';
  let s = v.trim();
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
    s = s.slice(1, -1);
  }
  return s.trim();
}

function parseJsonPairs(str: string): Record<string, string> {
  const pairs: Record<string, string> = {};
  if (!str) return pairs;
  const unescaped = str.replace(/\\"/g, '"');
  const regex = /"([a-zA-Z0-9_]+)"\s*:\s*(?:"([^"]*)"|(\[[^\]]*\])|([^,}]+))/g;
  let m;
  while ((m = regex.exec(unescaped)) !== null) {
    const k = m[1];
    const val = m[2] !== undefined ? m[2] : (m[3] !== undefined ? m[3] : (m[4] || '').trim());
    pairs[k] = val;
  }
  return pairs;
}

function formatKeyLabel(key: string): string {
  if (!key) return '';
  const match = key.match(/^section_(\d+)$/);
  if (match) return `Section ${match[1]}`;
  return key
    .replace(/_/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase());
}

interface ParsedDiff {
  label: string;
  from: string;
  to: string;
}

function parseEditSummary(raw: string): ParsedDiff[] {
  if (!raw || raw.trim() === 'Initial submission') {
    return [{ label: '', from: '', to: 'Initial submission' }];
  }
  if (raw.trim() === 'Re-submitted (no field changes)') {
    return [{ label: '', from: '', to: 'Re-submitted (no field changes)' }];
  }
  if (raw.startsWith('Admin updated:')) {
    return [{ label: 'Admin update', from: '', to: raw.replace(/^Admin updated:\s*/, '') }];
  }

  const items = raw.split(/;\s*(?=[a-zA-Z0-9_]+:)/g);
  const diffs: ParsedDiff[] = [];

  for (const item of items) {
    const colonIdx = item.indexOf(':');
    if (colonIdx === -1) {
      diffs.push({ label: '', from: '', to: cleanVal(item) });
      continue;
    }
    const rawKey = item.slice(0, colonIdx).trim();
    const valueChange = item.slice(colonIdx + 1).trim();
    const arrowMatch = valueChange.match(/\s*(?:->|→)\s*/);

    if (!arrowMatch) {
      diffs.push({ label: formatKeyLabel(rawKey), from: '', to: cleanVal(valueChange) });
      continue;
    }

    const arrowIdx = arrowMatch.index || 0;
    const arrowLen = arrowMatch[0].length;
    const rawFrom = valueChange.slice(0, arrowIdx).trim();
    const rawTo = valueChange.slice(arrowIdx + arrowLen).trim();
    const cleanFrom = cleanVal(rawFrom);
    const cleanTo = cleanVal(rawTo);

    const fromPairs = parseJsonPairs(cleanFrom);
    const toPairs = parseJsonPairs(cleanTo);
    const hasJson = Object.keys(fromPairs).length > 0 || Object.keys(toPairs).length > 0;

    if (hasJson) {
      const allKeys = Array.from(new Set([...Object.keys(fromPairs), ...Object.keys(toPairs)]));
      let subDiffCount = 0;
      for (const k of allKeys) {
        const fv = fromPairs[k] || '';
        const tv = toPairs[k] || '';
        if (fv !== tv) {
          diffs.push({
            label: `${formatKeyLabel(rawKey)} · ${formatKeyLabel(k)}`,
            from: fv || '—',
            to: tv || '—',
          });
          subDiffCount++;
        }
      }
      if (subDiffCount === 0) {
        diffs.push({ label: formatKeyLabel(rawKey), from: '—', to: 'Updated' });
      }
    } else {
      diffs.push({
        label: formatKeyLabel(rawKey),
        from: cleanFrom || '—',
        to: cleanTo || '—',
      });
    }
  }

  return diffs;
}

function renderEditSummary(raw: string) {
  const diffs = parseEditSummary(raw);
  if (diffs.length === 1 && !diffs[0].label && !diffs[0].from) {
    return <span className="text-sm text-stone-500 italic">{diffs[0].to}</span>;
  }
  return (
    <div className="flex flex-wrap gap-1.5 mt-1.5 text-sm">
      {diffs.map((d, idx) => (
        <div
          key={idx}
          className="inline-flex items-center gap-1.5 text-sm bg-stone-50 px-2.5 py-0.5 rounded border border-stone-200/70"
        >
          {d.label && <span className="font-semibold text-stone-700">{d.label}:</span>}
          {d.from && d.from !== '—' && (
            <>
              <span className="text-stone-400 font-mono line-through max-w-[180px] truncate" title={d.from}>
                {d.from}
              </span>
              <span className="text-stone-300">→</span>
            </>
          )}
          <span className="text-stone-800 font-mono font-medium max-w-[260px] truncate" title={d.to}>
            {d.to}
          </span>
        </div>
      ))}
    </div>
  );
}

function AdminVisitRecordsContent() {
  const { t: _rawT } = useAdminT();
  const t = (en: string, _zh?: string) => en;
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
  const detailBackRef = useRef<HTMLDivElement>(null);
  const detailOverviewRef = useRef<HTMLDivElement>(null);
  const [detailBackHeight, setDetailBackHeight] = useState(0);
  const [detailOverviewHeight, setDetailOverviewHeight] = useState(0);

  useLayoutEffect(() => {
    const nodes = [detailBackRef.current, detailOverviewRef.current].filter((node): node is HTMLDivElement => node !== null);
    if (!nodes.length || typeof ResizeObserver === 'undefined') return;
    const measure = () => {
      const backHeight = Math.ceil(detailBackRef.current?.getBoundingClientRect().height || 0);
      const overviewHeight = Math.ceil(detailOverviewRef.current?.getBoundingClientRect().height || 0);
      setDetailBackHeight(current => current === backHeight ? current : backHeight);
      setDetailOverviewHeight(current => current === overviewHeight ? current : overviewHeight);
    };
    measure();
    const observer = new ResizeObserver(measure);
    nodes.forEach(node => observer.observe(node));
    return () => observer.disconnect();
  }, [detail, bindOpen]);

  const recordStickyOffset = detailBackHeight + detailOverviewHeight + 16;

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
      title: `Delete ${count} visit record(s)`,
      message: 'This action cannot be undone. Records will be permanently deleted.',
      requireText: 'DELETE',
      onConfirm: async () => {
        setDeleting(true);
        try {
          await adminApi.deleteInterviews(ids, country);
          setSelected(new Set());
          await fetchRecords();
        } catch {
          alert('Failed to delete visit records. Please retry.');
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

  // Bind company: Search companies within the record's country (country data isolation), PATCH company_ref on select
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
      alert('Failed to bind company. Please retry.');
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
      alert('Failed to unbind company. Please retry.');
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
      <div className="space-y-2.5">
        <div
          ref={detailBackRef}
          className="xl:sticky xl:top-0 xl:z-30 xl:bg-[#fafaf9] -mx-4 md:-mx-6 px-4 md:px-6 py-1.5"
        >
          <div className="mx-auto max-w-[1500px] w-full flex items-center justify-between">
            <button
              onClick={closeDetail}
              className="flex items-center gap-1.5 text-base font-medium text-stone-600 hover:text-stone-900 transition-colors py-1"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
              {t('Back to Records', 'Back to Records')}
            </button>
          </div>
        </div>

        <div className="mx-auto max-w-[1500px] w-full space-y-2.5">
          {detailError ? (
            <div role="alert" className="rounded-xl border border-red-200 bg-white p-5 text-base text-red-600">{t('Record could not be loaded.', 'Record could not be loaded.')} <button className="underline" onClick={() => openDetail(selectedId)}>{t('Retry', 'Retry')}</button></div>
          ) : detailLoading || !detail ? (
            <div className="flex justify-center py-16"><Spinner /></div>
          ) : (
            <>
              <div ref={detailOverviewRef} style={{ '--record-detail-back-height': `${detailBackHeight}px` } as CSSProperties} className="w-full bg-white rounded-xl border border-stone-200/80 p-3.5 sm:px-5 sm:py-3 xl:sticky xl:top-[var(--record-detail-back-height)] xl:z-20 shadow-xs">
              <div className="flex flex-wrap items-center justify-between gap-3">
                {/* Left: Company name + bind status + inline metadata */}
                <div className="min-w-0">
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <h1 className="text-lg sm:text-xl font-bold text-[#2c2c2c] leading-snug break-words [overflow-wrap:anywhere]">{detail.company_name || '—'}</h1>
                    {/* Bind status + actions */}
                    <div className="flex items-center gap-2 flex-wrap">
                      {detail.company_ref_id ? (
                        <>
                          <span className="text-base text-stone-500 flex items-center gap-1">
                            → {detail.linked_company_name || `#${detail.company_ref_id}`}
                            <a
                              href={detail.company_ref_source === 'profile' ? `/admin/profile-companies/${detail.company_ref_id}` : `/admin/companies/${detail.company_ref_id}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-[#b8864a] hover:opacity-70"
                            >
                              <ExternalLink size={14} />
                            </a>
                          </span>
                          <button
                            type="button"
                            onClick={() => { setBindOpen(v => !v); setBindQuery(detail.company_name || ''); if (!bindOpen) handleBindSearch(detail.company_name || ''); }}
                            className="text-base text-stone-500 hover:text-[#b8864a] underline decoration-dotted font-medium"
                          >{t('Rebind', 'Rebind')}</button>
                          <button
                            type="button"
                            onClick={handleUnbind}
                            disabled={binding}
                            className="text-base text-stone-500 hover:text-red-500 underline decoration-dotted disabled:opacity-50 font-medium"
                          >{t('Unbind', 'Unbind')}</button>
                        </>
                      ) : (
                        <>
                          <span className="text-sm px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-600 font-medium">{t('Not bound', 'Not bound')}</span>
                          <button
                            type="button"
                            onClick={() => { setBindOpen(v => !v); setBindQuery(detail.company_name || ''); if (!bindOpen) handleBindSearch(detail.company_name || ''); }}
                            className="text-base text-[#b8864a] hover:underline font-medium"
                          >{t('Bind company', 'Bind company')}</button>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Clean inline meta text without borders or boxes */}
                  <div className="flex items-center gap-2 sm:gap-2.5 flex-wrap text-base text-stone-500 mt-1">
                    {[
                      detail.interviewer_name ? (
                        <span key="interviewer">{t('Interviewer', 'Interviewer')}: <strong className="font-medium text-stone-800">{detail.interviewer_name}</strong></span>
                      ) : null,
                      detail.filled_by ? (
                        <span key="filled_by">{t('Filled by', 'Filled by')}: <strong className="font-medium text-stone-800">{detail.filled_by}</strong></span>
                      ) : null,
                      <span key="created_at" className={ADMIN_TIME_CLS}>{formatDate(detail.created_at)}</span>,
                      detail.submitted_at ? (
                        <span key="submitted_at">{t('Submitted', 'Submitted')}: <span className={ADMIN_TIME_CLS}>{formatDate(detail.submitted_at)}</span></span>
                      ) : null,
                      <span key="id" className="font-mono text-stone-400">#{detail.id}</span>,
                    ].filter(Boolean).map((item, idx) => (
                      <span key={idx} className="inline-flex items-center gap-2 sm:gap-2.5">
                        {idx > 0 && <span className="text-stone-300">·</span>}
                        {item}
                      </span>
                    ))}
                  </div>

                  {/* Bind search panel */}
                  {bindOpen && (
                    <div className="mt-2 w-full sm:w-96 border border-stone-200 rounded-xl bg-stone-50/60 p-3">
                      <input
                        value={bindQuery}
                        onChange={(e) => handleBindSearch(e.target.value)}
                        placeholder={t('Search companies in this country…', 'Search companies in this country…')}
                        autoFocus
                        className="w-full h-10 px-3 rounded-lg border border-stone-200 bg-white text-base focus:outline-none focus:ring-2 focus:ring-[#b8864a]/15 focus:border-[#b8864a]"
                      />
                      <div className="mt-2 max-h-48 overflow-y-auto space-y-1">
                        {bindSearching ? (
                          <p className="text-sm text-stone-400 py-2 text-center">{t('Searching…', 'Searching…')}</p>
                        ) : bindError ? (
                          <p className="text-sm text-red-500 py-2 text-center">{t('Search failed, please retry', 'Search failed, please retry')}</p>
                        ) : bindResults.length === 0 ? (
                          <p className="text-sm text-stone-400 py-2 text-center">{bindQuery.trim() ? t('No match', 'No match') : t('Type to search', 'Type to search')}</p>
                        ) : bindResults.map(c => (
                          <button
                            key={`${c.source}-${c.id}`}
                            type="button"
                            disabled={binding}
                            onClick={() => handleBind(c)}
                            className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg bg-white border border-stone-100 hover:border-[#b8864a]/50 text-left transition-colors disabled:opacity-50"
                          >
                            <span className="flex-1 min-w-0 text-base text-[#2c2c2c] truncate">{c.name}</span>
                            {c.city && <span className="text-sm text-stone-400 shrink-0">{c.city}</span>}
                            <span className={`text-xs px-2 py-0.5 rounded shrink-0 ${c.source === 'profile' ? 'bg-blue-50 text-blue-600' : 'bg-stone-100 text-stone-500'}`}>
                              {c.source === 'profile' ? t('Registered', 'Registered') : t('Directory', 'Directory')}
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Right: Actions + Status Stamp */}
                <div className="w-full sm:w-auto min-w-0 flex items-center gap-2 print:hidden flex-wrap sm:flex-nowrap">
                  <button type="button" onClick={handleExport} className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-lg border border-stone-200 bg-white text-base font-medium text-stone-700 hover:bg-stone-50 transition"><Download size={15}/>{t('Export JSON', 'Export JSON')}</button>
                  <button type="button" onClick={() => window.print()} className="inline-flex items-center h-9 px-3.5 rounded-lg border border-stone-200 bg-white text-base font-medium text-stone-700 hover:bg-stone-50 transition">{t('Print', 'Print')}</button>
                  {detail.status === 'submitted' && (
                    <a
                      href={`/field/survey?edit=${detail.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      title={t('Edit (field staff login required)', 'Edit (field staff login required)')}
                      className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-lg bg-[#b8864a] text-white text-base font-medium hover:bg-[#a07640] transition"
                    >
                      <Pencil className="w-4 h-4" />
                      {t('Edit', 'Edit')}
                    </a>
                  )}

                  {/* Divider separating interactive action buttons from official status stamp */}
                  <div className="hidden sm:block w-px h-6 bg-stone-200 mx-1" aria-hidden="true" />

                  {/* Status Stamp */}
                  <div className="select-none pointer-events-none shrink-0" aria-label={`Status: ${detail.status === 'submitted' ? 'Submitted' : 'Draft'}`}>
                    {detail.status === 'submitted' ? (
                      <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md border-2 border-emerald-600/90 bg-emerald-50/70 text-emerald-800 text-xs sm:text-sm font-bold uppercase tracking-wider shadow-2xs -rotate-2 ring-1 ring-emerald-600/20">
                        <svg className="w-3.5 h-3.5 stroke-[2.5]" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                        <span>{t('Submitted', 'Submitted')}</span>
                      </div>
                    ) : (
                      <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md border-2 border-dashed border-amber-600/80 bg-amber-50/70 text-amber-800 text-xs sm:text-sm font-bold uppercase tracking-wider -rotate-2 ring-1 ring-amber-600/20">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                        <span>{t('Draft', 'Draft')}</span>
                      </div>
                    )}
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
                  <h2 className="text-sm sm:text-base font-semibold text-stone-700 uppercase tracking-wide border-l-2 border-[#b8864a] pl-2 mb-3">
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

            {/* Attachments - Files uploaded via survey (images/PDF/docs). Stored in company_interviews.attachments */}
            {(() => {
              const attachments = parseAttachments(detail.attachments);
              if (attachments.length === 0) return null;
              return (
                <div className="bg-white rounded-xl border border-stone-200 p-5">
                  <h2 className="text-sm sm:text-base font-semibold text-stone-700 uppercase tracking-wide border-l-2 border-[#b8864a] pl-2 mb-3">
                    {t('Attachments', 'Attachments')} ({attachments.length})
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
                            <p className="text-base font-medium text-[#2c2c2c] truncate">{name}</p>
                            <p className="text-sm text-stone-400">
                              {formatBytes(att.size)}
                              {att.field_key ? `${att.size ? ' · ' : ''}${att.field_key}` : ''}
                            </p>
                          </div>
                          <a
                            href={att.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="shrink-0 inline-flex items-center gap-1 text-sm font-medium text-[#b8864a] hover:underline"
                            title={t('Open / Download', 'Open / Download')}
                          >
                            <Download className="w-3.5 h-3.5" />
                            <span className="hidden sm:inline">{t('Open', 'Open')}</span>
                          </a>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })()}

            {parseRecordSchema(detail.schema_snapshot).length > 0 ? (
              <VerificationRecordSections record={detail as unknown as Record<string, unknown>} schema={detail.schema_snapshot} stickyOffset={recordStickyOffset}/>
            ) : !schemaLoaded ? <div className="flex justify-center py-4"><Spinner /></div> : (
              <>
                {schemaError && <p role="alert" className="text-base text-red-600">{t('Survey labels could not be loaded. Saved answers are shown below.', 'Survey labels could not be loaded. Saved answers are shown below.')} <button onClick={loadSchema} className="underline">{t('Retry', 'Retry')}</button></p>}
                <VerificationRecordSections record={detail as unknown as Record<string, unknown>} schema={activeSchema} stickyOffset={recordStickyOffset}/>
              </>
            )}

            {/* Additional sections aligned with the main questionnaire content column */}
            {(() => {
              const areas = parseServiceAreas(detail.section_9);
              const pin = (() => {
                const raw = detail.location_pin;
                if (!raw) return null;
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                let p: any = raw;
                if (typeof raw === 'string') { try { p = JSON.parse(raw); } catch { return null; } }
                if (!Number.isFinite(Number(p?.lat)) || !Number.isFinite(Number(p?.lng)) || p.lat == null || p.lng == null) return null;
                return p;
              })();
              const hasExtras = areas.length > 0 || Boolean(pin) || editLogs.length > 0;
              if (!hasExtras) return null;

              return (
                <div className="mx-auto min-w-0 max-w-[1500px] xl:grid xl:grid-cols-[232px_minmax(0,1fr)] xl:gap-7">
                  <div className="hidden xl:block" />
                  <div className="min-w-0 space-y-3">
                    {/* Service Area */}
                    {areas.length > 0 && (
                      <div className="bg-white rounded-xl border border-stone-200/80 overflow-hidden shadow-xs">
                        <div className="px-5 py-3 bg-stone-50 border-b border-stone-100">
                          <h2 className="text-xs sm:text-sm font-semibold text-stone-500 uppercase tracking-wider">{t('Service Area', 'Service Area')}</h2>
                        </div>
                        <div className="divide-y divide-stone-50">
                          {areas.map((a, i) => (
                            <div key={i} className="px-5 py-3.5">
                              <div className="text-base font-medium text-[#2c2c2c] mb-1.5">
                                {areas.length > 1 ? `${t('Area', 'Area')} ${i + 1} — ` : ''}{a.emirate || '—'}
                              </div>
                              <div className="space-y-1.5">
                                {a.sectors.map((s, j) => (
                                  <div key={j} className="flex items-start gap-2 flex-wrap">
                                    {s.group && <span className="text-sm text-stone-500 pt-0.5">{s.group}:</span>}
                                    <div className="flex flex-wrap gap-1.5">
                                      {s.districts.length > 0
                                        ? s.districts.map(d => (
                                            <span key={d} className="px-2.5 py-0.5 rounded-md bg-[#b8864a]/10 text-[#b8864a] text-sm font-medium">{d}</span>
                                          ))
                                        : <span className="text-sm text-stone-300">—</span>}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Company Address Pin */}
                    {pin && (
                      <div className="bg-white rounded-xl border border-stone-200/80 overflow-hidden shadow-xs">
                        <div className="px-5 py-3 bg-stone-50 border-b border-stone-100">
                          <h2 className="text-xs sm:text-sm font-semibold text-stone-500 uppercase tracking-wider">{t('Company Address Pin', 'Company Address Pin')}</h2>
                        </div>
                        <div className="px-5 py-3.5">
                          {typeof pin.address === 'string' && pin.address && <p className="text-base text-[#2c2c2c] mb-1">{pin.address}</p>}
                          <a
                            href={`https://www.google.com/maps?q=${pin.lat},${pin.lng}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm text-[#b8864a] hover:underline"
                          >
                            {Number(pin.lat).toFixed(5)}, {Number(pin.lng).toFixed(5)} ↗
                          </a>
                        </div>
                      </div>
                    )}

                    {/* Edit Logs — collapsible compact card */}
                    {editLogs.length > 0 && (
                      <details className="group bg-white rounded-xl border border-stone-200/80 overflow-hidden shadow-xs">
                        <summary className="px-4 py-2.5 sm:px-5 sm:py-3 bg-stone-50/60 hover:bg-stone-100/70 cursor-pointer flex items-center justify-between transition-colors list-none select-none">
                          <div className="flex items-center gap-2">
                            <History className="w-4 h-4 text-stone-400" />
                            <h2 className="text-base font-semibold text-stone-700 uppercase tracking-wider">{t('Edit History', 'Edit History')} ({editLogs.length})</h2>
                          </div>
                          <span className="text-xs text-stone-400 group-open:rotate-180 transition-transform">▾</span>
                        </summary>
                        <div className="p-3.5 sm:p-4 space-y-3 max-h-80 overflow-y-auto divide-y divide-stone-100">
                          {editLogs.map((log, i) => (
                            <div key={log.id} className={`flex gap-3 ${i > 0 ? 'pt-3' : ''}`}>
                              <div className="flex-shrink-0 w-6 h-6 rounded-full bg-stone-100 flex items-center justify-center text-xs text-stone-500 font-semibold mt-0.5">
                                {i + 1}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap text-base">
                                  <span className="font-medium text-stone-800">{log.editor_name}</span>
                                  <span className="text-stone-400 text-sm">{formatDate(log.edited_at)}</span>
                                </div>
                                {renderEditSummary(log.edit_summary)}
                              </div>
                            </div>
                          ))}
                        </div>
                      </details>
                    )}
                  </div>
                </div>
              );
            })()}
          </>
        )}
        </div>
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
          <h1 className="text-xl sm:text-2xl font-bold text-[#2c2c2c]">{t('Visit Records', 'Visit Records')}</h1>
          <span className="text-base text-stone-400 font-normal">{recordsCountry === country ? records.length : 0}</span>
        </div>
        <div className="flex items-center gap-2">
          <a
            href="/admin/survey-questions"
            className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-lg border border-stone-200 bg-white text-sm sm:text-base font-medium text-stone-700 hover:bg-stone-50 hover:text-[#b8864a] transition"
            title={t('Survey Questions', 'Survey Questions')}
          >
            <ClipboardList className="w-4 h-4" />
            <span className="hidden sm:inline">{t('Survey Questions', 'Survey Questions')}</span>
          </a>
          <a
            href="/field/survey"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-lg border border-stone-200 bg-white text-sm sm:text-base font-medium text-stone-700 hover:bg-stone-50 hover:text-[#b8864a] transition"
            title={t('Interview Page', 'Interview Page')}
          >
            <ExternalLink className="w-4 h-4" />
            <span className="hidden sm:inline">{t('Interview Page', 'Interview Page')}</span>
          </a>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 mb-4">
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder={t('Search company / staff…', 'Search company / staff…')}
          className="basis-full sm:basis-auto sm:flex-1 h-10 px-3.5 rounded-lg border border-stone-200 bg-white text-base placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-[#B8864A]/15 focus:border-[#B8864A] focus:bg-white min-w-0"
        />
        <AdminSelect
          value={statusFilter}
          onChange={setStatusFilter}
          options={STATUS_OPTIONS}
          size="sm"
          className="w-40"
        />
      </div>

      {recordsCountry === country && selected.size > 0 && (
        <div className="flex items-center justify-between px-4 py-2.5 mb-2 rounded-lg bg-red-50 border border-red-100">
          <span className="text-base font-medium text-red-700">{selected.size} selected</span>
          <button
            onClick={handleBatchDelete}
            disabled={deleting}
            className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-lg bg-red-600 text-white text-base font-medium hover:bg-red-700 disabled:opacity-50 transition"
          >
            <Trash2 className="w-4 h-4" />
            {deleting ? 'Deleting…' : 'Delete selected'}
          </button>
        </div>
      )}

      {loading || recordsCountry !== country ? (
        <div className="flex justify-center py-16"><Spinner /></div>
      ) : listError ? (
        <div role="alert" className="py-10 text-center text-base text-red-600">{t('Records could not be loaded.', 'Records could not be loaded.')} <button onClick={fetchRecords} className="underline">{t('Retry', 'Retry')}</button></div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-stone-400 text-base">{t('No records found.', 'No records found.')}</div>
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
                  <button type="button" aria-label={`${t("Select record", "Select record")} #${r.id}`} aria-pressed={selected.has(r.id)} onKeyDown={event => event.stopPropagation()} className="w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors"
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
                      <div className="font-medium text-[#2c2c2c] text-base leading-snug">{r.company_name || '—'}</div>
                      {r.linked_company_name && r.linked_company_name !== r.company_name && r.company_ref_id && (
                        <a
                          href={`${r.company_ref_source === 'profile' ? `/admin/profile-companies/${r.company_ref_id}` : `/admin/companies/${r.company_ref_id}`}`}
                          onClick={e => e.stopPropagation()}
                          className="text-sm text-[#b8864a] hover:underline flex items-center gap-0.5 mt-0.5"
                        >
                          → {r.linked_company_name}
                        </a>
                      )}
                    </div>
                    <span className={`flex-shrink-0 inline-flex items-center px-2.5 py-0.5 rounded-full text-sm font-medium ${
                      r.status === 'submitted' ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'
                    }`}>
                      {r.status === 'submitted' ? t('Submitted', 'Submitted') : t('Draft', 'Draft')}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-sm text-stone-500 flex-wrap">
                    <span className="font-medium text-stone-700">{r.interviewer_name}</span>
                    <span className={ADMIN_TIME_CLS}>{formatDate(r.submitted_at || r.created_at)}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Desktop table */}
          <div className="hidden sm:block bg-white rounded-xl border border-stone-200 overflow-x-auto">
            <table className="w-full min-w-[900px] text-base">
              <thead>
                <tr className="border-b border-stone-100 text-left">
                  <th className="px-4 py-3.5">
                    <input
                      type="checkbox"
                      checked={filtered.length > 0 && filtered.every(r => selected.has(r.id))}
                      onChange={e => handleSelectAll(e.target.checked)}
                      className="rounded border-stone-300"
                    />
                  </th>
                  <th className="px-4 py-3.5 font-semibold text-stone-600 text-sm sm:text-base">#</th>
                  <th className="px-4 py-3.5 font-semibold text-stone-600 text-sm sm:text-base">{t('Company', 'Company')}</th>
                  <th className="px-4 py-3.5 font-semibold text-stone-600 text-sm sm:text-base">{t('Service Area', 'Service Area')}</th>
                  <th className="px-4 py-3.5 font-semibold text-stone-600 text-sm sm:text-base">{t('Interviewer', 'Interviewer')}</th>
                  <th className="px-4 py-3.5 font-semibold text-stone-600 text-sm sm:text-base">{t('Status', 'Status')}</th>
                  <th className="px-4 py-3.5 font-semibold text-stone-600 text-sm sm:text-base">{t('Submitted', 'Submitted')}</th>
                  <th className="px-4 py-3.5 font-semibold text-stone-600 text-sm sm:text-base">{t('Created', 'Created')}</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(r => (
                  <tr
                    key={r.id}
                    className={`border-b border-stone-50 hover:bg-stone-50 transition-colors cursor-pointer ${selected.has(r.id) ? 'bg-amber-50/40' : ''}`}
                    onClick={() => showDetail(r.id)}
                  >
                    <td className="px-4 py-3.5" onClick={e => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={selected.has(r.id)}
                        onChange={e => handleSelectOne(r.id, e.target.checked)}
                        className="rounded border-stone-300"
                      />
                    </td>
                    <td className="px-4 py-3.5 text-stone-400 text-sm sm:text-base">{r.id}</td>
                    <td className="px-4 py-3.5">
                      <div className="font-medium text-[#2c2c2c] text-base">{r.company_name || '—'}</div>
                      {r.linked_company_name && r.linked_company_name !== r.company_name && r.company_ref_id && (
                        <a
                          href={`${r.company_ref_source === 'profile' ? `/admin/profile-companies/${r.company_ref_id}` : `/admin/companies/${r.company_ref_id}`}`}
                          onClick={e => e.stopPropagation()}
                          className="text-sm text-[#b8864a] hover:underline mt-0.5 flex items-center gap-1"
                        >
                          → {r.linked_company_name}
                        </a>
                      )}
                    </td>
                    <td className="px-4 py-3.5 text-stone-600 max-w-[260px] text-sm sm:text-base">
                      {(() => {
                        const areas = parseServiceAreas(r.service_areas ?? r.section_9);
                        if (areas.length === 0) return <span className="text-stone-300">—</span>;
                        return (
                          <div className="space-y-0.5">
                            {areas.map((a, i) => (
                              <div key={i} className="text-sm text-stone-600 truncate" title={svcAreaToLine(a)}>{svcAreaToLine(a)}</div>
                            ))}
                          </div>
                        );
                      })()}
                    </td>
                    <td className="px-4 py-3.5 text-stone-700 text-base">{r.interviewer_name}</td>
                    <td className="px-4 py-3.5">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-sm font-medium ${
                        r.status === 'submitted' ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'
                      }`}>
                        {r.status === 'submitted' ? t('Submitted', 'Submitted') : t('Draft', 'Draft')}
                      </span>
                    </td>
                    <td className={`px-4 py-3.5 text-sm sm:text-base ${ADMIN_TIME_CLS}`}>{formatDate(r.submitted_at)}</td>
                    <td className={`px-4 py-3.5 text-sm sm:text-base ${ADMIN_TIME_CLS}`}>{formatDate(r.created_at)}</td>
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
