import { useEffect, useState, useCallback, useMemo, lazy, Suspense } from 'react';
import { Globe, RefreshCw, Save, Users, Building2, MessageSquare, ChevronDown, ChevronRight, BarChart3, AreaChart as AreaChartIcon, Eye, MousePointerClick, Phone, FileText } from 'lucide-react';
import { adminApi } from '../../lib/adminApi';
import { useAdmin } from '../../contexts/AdminContext';
import { useAdminT } from '../../hooks/useAdminLang';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, PieChart, Pie, Cell, AreaChart, Area,
  ComposedChart, Line, LineChart,
} from 'recharts';
import type { AnalyticsOverview } from '../../lib/adminApi';

function lazyRetry<T extends React.ComponentType<any>>(factory: () => Promise<{ default: T }>) {
  return lazy(() => factory().catch(() => factory().catch(() => { window.location.reload(); return factory(); })));
}

const UAEMapSVG = lazyRetry(() => import('../../components/admin/UAEMapLeaflet'));

/* ─── Types ─── */

interface DetailItem {
  name: string;
  email?: string;
  phone?: string;
  city?: string;
  projects?: number;
  company?: string;
  area_range?: string;
}

interface DayRow {
  date: string;
  new_homeowners: number;
  new_companies: number;
  new_inquiries: number;
  homeowner_list?: DetailItem[];
  company_list?: DetailItem[];
  inquiry_list?: DetailItem[];
}

interface StatsData {
  data: DayRow[];
  totals: { new_homeowners: number; new_companies: number; new_inquiries: number };
  days: number;
}

/* ─── Company Type Labels (中英双语，DB key → display) ─── */
// IMPORTANT: Keep in sync with UAEMapSVG.tsx and server-side VALID_COMPANY_TYPES.
// Rule: always show zh when admin lang=zh, en when lang=en.
export const COMPANY_TYPE_LABELS: Record<string, { zh: string; en: string }> = {
  renovation_company:  { zh: '装修公司',   en: 'Renovation Co.'    },
  design_studio:       { zh: '设计工作室', en: 'Design Studio'      },
  maintenance_company: { zh: '维修公司',   en: 'Maintenance Co.'   },
  mep_contractor:      { zh: 'MEP 承包商', en: 'MEP Contractor'     },
  general_contractor:  { zh: '总承包商',   en: 'General Contractor' },
  landscaping:         { zh: '园林绿化',   en: 'Landscaping'        },
  swimming_pool:       { zh: '游泳池工程', en: 'Swimming Pool'       },
  specialty_trade:     { zh: '专项工程',   en: 'Specialty Trade'    },
  furnishing:          { zh: '软装供应商', en: 'Furnishing'         },
};
export function labelCompanyType(type: string, lang: 'zh' | 'en' = 'zh'): string {
  return COMPANY_TYPE_LABELS[type]?.[lang] ?? type;
}

/* ─── Weight Config (preserved for Tab 2) ─── */

const WEIGHT_CONFIG_LABELS: Record<string, string> = {
  base_profile_score: 'Base Profile Score',
  per_project_score: 'Per Project Score',
  signed_score: 'Signed Bonus',
};

interface WeightConfigEntry {
  key: string;
  value: number;
  updated_at: string;
}

// Exported for use in Tab 2 (visitor data) when implemented
export function WeightConfigCard() {
  const { t } = useAdminT();
  const [configs, setConfigs] = useState<WeightConfigEntry[]>([]);
  const [editValues, setEditValues] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [recalculating, setRecalculating] = useState(false);
  const [toast, setToast] = useState('');

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 3000); };

  const loadConfig = useCallback(async () => {
    try {
      const result = await adminApi.getWeightConfig();
      setConfigs(result.configs || []);
    } catch {
      // silently fail - endpoint may not exist yet
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadConfig(); }, [loadConfig]);

  const handleSave = async (key: string) => {
    const raw = editValues[key];
    if (raw === undefined) return;
    const value = parseInt(raw) || 0;
    setSaving(key);
    try {
      await adminApi.updateWeightConfig(key, value);
      setConfigs((prev) => prev.map((c) => c.key === key ? { ...c, value, updated_at: new Date().toISOString() } : c));
      setEditValues((prev) => { const next = { ...prev }; delete next[key]; return next; });
      showToast(`${WEIGHT_CONFIG_LABELS[key] || key} updated to ${value}`);
    } catch {
      showToast('Failed to save');
    } finally {
      setSaving(null);
    }
  };

  const handleRecalculate = async () => {
    setRecalculating(true);
    try {
      const result = await adminApi.triggerWeightRecalculation();
      showToast(`Recalculated: ${result.updated} companies updated`);
    } catch {
      showToast('Recalculation failed');
    } finally {
      setRecalculating(false);
    }
  };

  if (loading) return null;

  return (
    <div className="bg-white rounded-2xl border border-stone-200 shadow-sm p-5 mb-8">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-sm font-bold text-[#2c2c2c]">{t('Weight Configuration', '权重配置')}</h2>
          <p className="text-xs text-[#6b6b6b]">{t('Configure how company sort weight is calculated.', '配置公司排序权重的计算方式。')}</p>
        </div>
        <button
          onClick={handleRecalculate}
          disabled={recalculating}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-2xl border border-stone-200 text-sm font-medium text-stone-700 hover:border-[#b8864a] hover:text-[#b8864a] transition disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${recalculating ? 'animate-spin' : ''}`} />
          {recalculating ? t('Recalculating...', '重新计算中...') : t('Recalculate Now', '立即重新计算')}
        </button>
      </div>

      {toast && (
        <div className="mb-4 px-3 py-2 rounded-2xl bg-green-50 border border-green-200 text-green-700 text-sm">{toast}</div>
      )}

      {configs.length === 0 ? (
        <p className="text-sm text-[#6b6b6b]">{t('No weight config found. Backend may not have this feature enabled yet.', '未找到权重配置。后端可能尚未启用此功能。')}</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {configs.map((cfg) => (
            <div key={cfg.key} className="border border-stone-200 rounded-2xl p-4">
              <label className="block text-sm font-medium text-stone-500 mb-1">{WEIGHT_CONFIG_LABELS[cfg.key] || cfg.key}</label>
              <div className="flex gap-2">
                <input
                  type="number"
                  value={editValues[cfg.key] ?? cfg.value}
                  onChange={(e) => setEditValues((prev) => ({ ...prev, [cfg.key]: e.target.value }))}
                  className="flex-1 px-3 py-2 border border-stone-200 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-[#b8864a]/15 focus:border-[#b8864a]"
                />
                <button
                  onClick={() => handleSave(cfg.key)}
                  disabled={saving === cfg.key || editValues[cfg.key] === undefined}
                  className="px-3 py-2 rounded-2xl bg-[#b8864a] text-white text-sm font-medium hover:bg-[#a67c47] transition disabled:opacity-40"
                >
                  <Save className="w-4 h-4" />
                </button>
              </div>
              <p className="text-xs text-stone-400 mt-1">{t('Last updated', '最后更新')}: {cfg.updated_at ? new Date(cfg.updated_at).toLocaleString() : 'N/A'}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ─── Constants ─── */

const DAYS_OPTIONS = [7, 30, 90] as const;
type DaysOption = (typeof DAYS_OPTIONS)[number];

const COLOR_HOMEOWNER = '#5b7fcb';
const COLOR_COMPANY = '#B8864A';
const COLOR_INQUIRY = '#6b6b6b';

const PIE_COLORS = ['#B8864A', '#5b7fcb', '#6b6b6b', '#2c6e49', '#e0a86e', '#8b5cf6', '#14b8a6', '#f59e0b'];


/* ─── Custom Recharts Tooltip ─── */

interface ChartTooltipProps {
  active?: boolean;
  payload?: Array<{
    name: string;
    value: number;
    color: string;
    payload: DayRow;
  }>;
  label?: string;
}

function ChartTooltip({ active, payload, label }: ChartTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;
  const row = payload[0]?.payload;
  if (!row) return null;

  const sections: Array<{ label: string; type: 'homeowner' | 'company' | 'inquiry'; color: string; count: number; items: DetailItem[] }> = [
    { label: '业主', type: 'homeowner', color: COLOR_HOMEOWNER, count: row.new_homeowners, items: row.homeowner_list || [] },
    { label: '装企', type: 'company', color: COLOR_COMPANY, count: row.new_companies, items: row.company_list || [] },
    { label: '询盘', type: 'inquiry', color: COLOR_INQUIRY, count: row.new_inquiries, items: row.inquiry_list || [] },
  ];

  const formatItem = (item: DetailItem, type: 'homeowner' | 'company' | 'inquiry'): string => {
    if (type === 'homeowner') {
      // name (city) · phone/email
      let s = item.name;
      if (item.city) s += ` (${item.city})`;
      const contact = item.phone || item.email;
      if (contact) s += ` · ${contact}`;
      return s;
    }
    if (type === 'company') {
      // name (city) · phone/email · N projects
      let s = item.name;
      if (item.city) s += ` (${item.city})`;
      const contact = item.phone || item.email;
      if (contact) s += ` · ${contact}`;
      if (item.projects !== undefined && item.projects !== null) s += ` · ${item.projects} projects`;
      return s;
    }
    // inquiry: name · phone · city · area_range
    let s = item.name;
    if (item.phone) s += ` · ${item.phone}`;
    if (item.city) s += ` · ${item.city}`;
    if (item.area_range) s += ` · ${item.area_range}`;
    return s;
  };

  return (
    <div className="bg-white border border-stone-200 rounded-2xl shadow-lg px-4 py-3 text-xs max-w-[380px]">
      <div className="font-semibold text-[#2c2c2c] mb-2 text-[13px]">{label}</div>
      {sections.map((s) => (
        <div key={s.label} className="mb-2 last:mb-0">
          <div className="flex items-center gap-1.5 mb-0.5">
            <span className="inline-block w-2.5 h-2.5 rounded-sm" style={{ background: s.color }} />
            <span className="text-[#6b6b6b]">{s.label}: <span className="font-medium text-[#2c2c2c]">{s.count}</span></span>
          </div>
          {s.items.length > 0 && (
            <div className="ml-4 text-[#6b6b6b]">
              {s.items.slice(0, 8).map((item, i) => (
                <div key={i} className="truncate">{formatItem(item, s.type)}</div>
              ))}
              {s.items.length > 8 && <div className="text-stone-400">+{s.items.length - 8} more</div>}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

/* ─── Pie Chart Label ─── */

function renderPieLabel(props: any) {
  const { name, percent, value } = props;
  if (!percent || percent < 0.03) return null;
  return `${name || ''} ${value} (${(percent * 100).toFixed(0)}%)`;
}

/* ─── Main Component ─── */

export default function AdminAnalyticsPage() {
  const { t } = useAdminT();
  const { hasPermission } = useAdmin();
  const [activeTab, setActiveTab] = useState<'registration' | 'visitor'>('registration');
  const [days, setDays] = useState<DaysOption>(30);

  if (!hasPermission('can_view_stats')) {
    return <div className="text-[#6b6b6b]">{t('You do not have permission to view analytics.', '您没有查看分析数据的权限。')}</div>;
  }

  return (
    <div className="w-full">
      {/* Page title */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-[#2c2c2c]">{t('Analytics', '数据分析')}</h1>
        <a href="https://analytics.google.com" target="_blank" rel="noopener noreferrer" className="text-sm text-[#B8864A] hover:underline">
          Google Analytics ↗
        </a>
      </div>

      {/* Tab buttons + time range on same row */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-1">
          <button
            onClick={() => setActiveTab('registration')}
            className={`px-5 py-2 rounded-2xl text-sm font-medium transition-colors ${
              activeTab === 'registration'
                ? 'bg-[#B8864A] text-white shadow-sm'
                : 'bg-white border border-stone-200 text-[#6b6b6b] hover:text-[#2c2c2c]'
            }`}
          >
            {t('Registration Data', '注册数据')}
          </button>
          <button
            onClick={() => setActiveTab('visitor')}
            className={`px-5 py-2 rounded-2xl text-sm font-medium transition-colors ${
              activeTab === 'visitor'
                ? 'bg-[#B8864A] text-white shadow-sm'
                : 'bg-white border border-stone-200 text-[#6b6b6b] hover:text-[#2c2c2c]'
            }`}
          >
            {t('Visitor Data', '访客数据')}
          </button>
        </div>
        {activeTab === 'registration' && (
          <div className="flex items-center gap-1 bg-stone-100 rounded-2xl p-1">
            {DAYS_OPTIONS.map((d) => (
              <button
                key={d}
                onClick={() => setDays(d)}
                className={`px-4 py-1.5 rounded-2xl text-xs font-medium transition-colors ${
                  days === d
                    ? 'bg-white text-[#2c2c2c] shadow-sm'
                    : 'text-[#6b6b6b] hover:text-[#2c2c2c]'
                }`}
              >
                {t(`${d} days`, `${d}天`)}
              </button>
            ))}
          </div>
        )}
      </div>

      {activeTab === 'registration' && <RegistrationTab days={days} />}
      {activeTab === 'visitor' && <VisitorTab />}
    </div>
  );
}

/* ─── Tab 2: Visitor Data ─── */

interface CompanyVisitorRow {
  page_path: string;
  company_name: string;
  slug: string;
  unique_visitors: number;
  total_views: number;
  cities: Array<{ city: string; visitors: number }>;
}


function VisitorTab() {
  const { t } = useAdminT();

  const [loading, setLoading] = useState(true);
  const [overview, setOverview] = useState<AnalyticsOverview | null>(null);
  const [visitorOverview, setVisitorOverview] = useState<{ totalVisits: number; uniqueIpCount: number } | null>(null);
  const [companies, setCompanies] = useState<CompanyVisitorRow[]>([]);
  const [dailyData, setDailyData] = useState<Array<{ stat_date: string; page_views: number; unique_visitors: number }>>([]);
  const [companyCities, setCompanyCities] = useState<any[]>([]);
  const [inquiryCities, setInquiryCities] = useState<any[]>([]);
  const [visitorCities, setVisitorCities] = useState<any[]>([]);
  const [homeownerCities, setHomeownerCities] = useState<any[]>([]);
  const [companyTypeCities, setCompanyTypeCities] = useState<Array<{ type: string; count: number; topCities: Array<{ city: string; count: number }> }>>([]);
  const [weightOpen, setWeightOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    Promise.all([
      adminApi.getAnalyticsOverview(),
      adminApi.getCompanyVisitors(),
      adminApi.getDailyVisits(),
      adminApi.getVisitorOverview(),
    ])
      .then(([analyticsRes, companyRes, dailyRes, visitorRes]) => {
        if (cancelled) return;
        setOverview(analyticsRes.overview);
        setCompanies((companyRes.companies || []).slice(0, 10));
        setDailyData(dailyRes.dailyVisits || []);
        setVisitorOverview(visitorRes);
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false); });

    // Realtime data flow:
    //   1. SSE: server pushes 'change' event when company/homeowner/inquiry inserted → instant refetch
    //   2. Polling 30s: safety-net for missed events, also covers visitor_logs (not pushed to keep event volume sane)
    //   3. Visibility: pause polling + close SSE when tab hidden, resume on visible
    const fetchRegSources = () => {
      adminApi.getRegistrationSources().then(data => {
        if (cancelled) return;
        setCompanyCities(data.company_cities || []);
        setInquiryCities(data.inquiry_cities || []);
        setVisitorCities(data.visitor_cities || []);
        setHomeownerCities(data.homeowner_cities || []);
        setCompanyTypeCities(data.company_type_cities || []);
      }).catch(() => {});
    };
    fetchRegSources();

    let pollId: number | null = null;
    const startPolling = () => {
      if (pollId !== null) return;
      pollId = window.setInterval(fetchRegSources, 30000);
    };
    const stopPolling = () => {
      if (pollId !== null) { window.clearInterval(pollId); pollId = null; }
    };
    startPolling();

    // Debounce client-side too (server already throttles 2s, but multiple subscribers
    // may receive bursts; coalesce within 500ms)
    let sseFetchTimer: number | null = null;
    const scheduleFetch = () => {
      if (sseFetchTimer !== null) return;
      sseFetchTimer = window.setTimeout(() => { sseFetchTimer = null; fetchRegSources(); }, 500);
    };

    let es: EventSource | null = null;
    const openSSE = () => {
      if (es) return;
      const token = localStorage.getItem('admin_token');
      if (!token) return;   // not logged in — skip; polling still works
      const apiBase = (import.meta.env.VITE_API_URL || '/api').replace(/\/$/, '');
      try {
        es = new EventSource(`${apiBase}/admin/stats/registration-events?token=${encodeURIComponent(token)}`);
        es.addEventListener('change', () => { if (!cancelled) scheduleFetch(); });
        es.onerror = () => { /* browser auto-reconnects; nothing to do */ };
      } catch { es = null; }
    };
    const closeSSE = () => {
      if (es) { try { es.close(); } catch {} es = null; }
    };
    openSSE();

    const onVisibility = () => {
      if (document.visibilityState === 'hidden') {
        stopPolling();
        closeSSE();
      } else {
        fetchRegSources();   // immediate refresh — may have missed events
        startPolling();
        openSSE();
      }
    };
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      cancelled = true;
      stopPolling();
      closeSSE();
      if (sseFetchTimer !== null) window.clearTimeout(sseFetchTimer);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-[#6b6b6b] text-sm">
        {t('Loading visitor data...', '加载访客数据中...')}
      </div>
    );
  }

  const ov = overview || { total_events: 0, unique_visitors: 0, page_views: 0, apply_clicks: 0, whatsapp_clicks: 0, contact_submits: 0 };
  const uniqueIps = visitorOverview?.uniqueIpCount ?? ov.unique_visitors;

  // Conversion funnel rates (relative to page views)
  const funnelBase = ov.page_views || 1;
  const funnelSteps = [
    { label: t('Page Views', '页面浏览'), value: ov.page_views, pct: 100, color: '#B8864A' },
    { label: t('Apply Clicks', 'Apply 点击'), value: ov.apply_clicks, pct: Math.round((ov.apply_clicks / funnelBase) * 100 * 10) / 10, color: '#C88B5A' },
    { label: t('WhatsApp', 'WhatsApp'), value: ov.whatsapp_clicks, pct: Math.round((ov.whatsapp_clicks / funnelBase) * 100 * 10) / 10, color: '#6B9BB8' },
    { label: t('Contact Form', '联系表单'), value: ov.contact_submits, pct: Math.round((ov.contact_submits / funnelBase) * 100 * 10) / 10, color: '#7B9E7A' },
  ];

  return (
    <div className="space-y-6">
      {/* KPI Horizontal Strip */}
      <div className="bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden">
        <div className="grid grid-cols-2 sm:grid-cols-5 divide-x divide-y sm:divide-y-0 divide-stone-100">
          {[
            { icon: <Globe className="w-4 h-4" />, label: t('Unique Visitors', '独立访客'), value: uniqueIps, sub: t('from visitor logs', 'visitor_logs'), color: '#5b7fcb' },
            { icon: <Eye className="w-4 h-4" />, label: t('Page Views', '页面浏览'), value: ov.page_views, sub: t('last 30 days', '近30天'), color: '#2c6e49' },
            { icon: <MousePointerClick className="w-4 h-4" />, label: t('Apply Clicks', 'Apply 点击'), value: ov.apply_clicks, sub: `${funnelSteps[1].pct}% ${t('of views', '转化率')}`, color: '#B8864A' },
            { icon: <Phone className="w-4 h-4" />, label: t('WhatsApp', 'WhatsApp'), value: ov.whatsapp_clicks, sub: `${funnelSteps[2].pct}% ${t('of views', '转化率')}`, color: '#14b8a6' },
            { icon: <FileText className="w-4 h-4" />, label: t('Contact Submits', '联系提交'), value: ov.contact_submits, sub: `${funnelSteps[3].pct}% ${t('of views', '转化率')}`, color: '#8b5cf6' },
          ].map((kpi, i) => (
            <div key={i} className="px-5 py-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-7 h-7 rounded-xl flex items-center justify-center" style={{ background: `${kpi.color}18`, color: kpi.color }}>
                  {kpi.icon}
                </div>
                <span className="text-xs font-medium text-stone-500 leading-tight">{kpi.label}</span>
              </div>
              <div className="text-2xl font-bold text-[#2c2c2c] leading-none mb-1">{kpi.value.toLocaleString()}</div>
              <div className="text-[10px] text-stone-400">{kpi.sub}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Daily Visit Trend + Conversion Funnel side-by-side */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Daily Visit Trend (takes 2/3) */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-stone-200 shadow-sm p-6">
          <div className="mb-4">
            <h2 className="text-sm font-bold text-[#2c2c2c]">{t('Daily Visit Trend', '每日访问趋势')}</h2>
            <p className="text-xs text-[#6b6b6b] mt-0.5">{t('Page views (bars) & unique visitors (line)', '页面浏览量（柱）& 独立访客（线）')}</p>
          </div>
          {dailyData.length === 0 ? (
            <div className="flex items-center justify-center h-[240px] text-[#6b6b6b] text-sm">{t('No data', '暂无数据')}</div>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <ComposedChart data={dailyData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                <defs>
                  <linearGradient id="pvBarGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#C8975A" stopOpacity={0.92} />
                    <stop offset="100%" stopColor="#B8864A" stopOpacity={0.72} />
                  </linearGradient>
                  <linearGradient id="uvAreaGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#5b7fcb" stopOpacity={0.18} />
                    <stop offset="100%" stopColor="#5b7fcb" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0ede9" vertical={false} />
                <XAxis dataKey="stat_date" tick={{ fontSize: 10, fill: '#a8a29e' }} tickFormatter={(v: string) => v.slice(5, 10)} axisLine={false} tickLine={false} />
                <YAxis yAxisId="left" tick={{ fontSize: 10, fill: '#a8a29e' }} allowDecimals={false} axisLine={false} tickLine={false} width={36} />
                <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10, fill: '#a8a29e' }} allowDecimals={false} axisLine={false} tickLine={false} width={28} />
                <Tooltip
                  contentStyle={{ borderRadius: 16, border: '1px solid #e7e5e4', fontSize: 12, boxShadow: '0 4px 20px rgba(0,0,0,0.08)' }}
                  formatter={(value: any, name: any) => {
                    const labelMap: Record<string, string> = {
                      page_views: t('Page Views', '页面浏览'),
                      unique_visitors: t('Unique Visitors', '独立访客'),
                    };
                    return [value, labelMap[String(name)] || String(name)];
                  }}
                  labelFormatter={(label: any) => String(label)}
                />
                <Bar yAxisId="left" dataKey="page_views" fill="url(#pvBarGrad)" radius={[4, 4, 0, 0]} />
                <Area yAxisId="right" type="monotone" dataKey="unique_visitors" fill="url(#uvAreaGrad)" stroke="#5b7fcb" strokeWidth={2} dot={{ r: 2.5, fill: '#5b7fcb', strokeWidth: 0 }} />
              </ComposedChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Conversion Funnel (takes 1/3) */}
        <div className="bg-white rounded-2xl border border-stone-200 shadow-sm p-6">
          <div className="mb-4">
            <h2 className="text-sm font-bold text-[#2c2c2c]">{t('Conversion Funnel', '转化漏斗')}</h2>
            <p className="text-xs text-[#6b6b6b] mt-0.5">{t('Visitor intent signals', '访客意向信号')}</p>
          </div>
          <div className="space-y-3 mt-6">
            {funnelSteps.map((step, i) => (
              <div key={i}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-medium text-[#2c2c2c]">{step.label}</span>
                  <div className="text-right">
                    <span className="text-xs font-bold text-[#2c2c2c]">{step.value.toLocaleString()}</span>
                    {i > 0 && (
                      <span className="text-[10px] text-[#6b6b6b] ml-1.5">{step.pct}%</span>
                    )}
                  </div>
                </div>
                <div className="h-2 bg-stone-100 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{ width: `${step.pct}%`, backgroundColor: step.color }}
                  />
                </div>
              </div>
            ))}
          </div>

          {/* Conversion rate summary */}
          <div className="mt-5 pt-4 border-t border-stone-100">
            <div className="text-[10px] font-semibold text-stone-400 uppercase tracking-wider mb-2">{t('Overall Conversion', '综合转化')}</div>
            <div className="text-2xl font-bold text-[#B8864A]">
              {ov.page_views > 0
                ? `${Math.round(((ov.apply_clicks + ov.whatsapp_clicks + ov.contact_submits) / ov.page_views) * 100 * 10) / 10}%`
                : '—'
              }
            </div>
            <div className="text-[10px] text-[#6b6b6b] mt-0.5">{t('actions / page views', '互动 / 浏览量')}</div>
          </div>
        </div>
      </div>

      {/* Top 10 Companies */}
      <div className="bg-white rounded-2xl border border-stone-200 shadow-sm p-6">
        <div className="mb-5">
          <h2 className="text-sm font-bold text-[#2c2c2c]">{t('Top 10 Visited Companies', '最受关注的10家公司')}</h2>
          <p className="text-xs text-[#6b6b6b] mt-0.5">{t('Unique visitors · click name to view detail', '独立访客数 · 点击公司名查看详情')}</p>
        </div>
        {companies.length === 0 ? (
          <div className="flex items-center justify-center h-[200px] text-[#6b6b6b] text-sm">{t('No data', '暂无数据')}</div>
        ) : (() => {
          const maxV = companies[0]?.unique_visitors || 1;
          return (
            <div className="space-y-2">
              {companies.map((c) => {
                const displayName = c.company_name.includes('-')
                  ? c.company_name.replace(/-/g, ' ').replace(/\b\w/g, (ch: string) => ch.toUpperCase())
                  : c.company_name;
                // Cap at 75% so even the longest bar leaves clear room for its number
                const barPct = Math.max(4, Math.round((c.unique_visitors / maxV) * 75));
                const cityText = c.cities && c.cities.length > 0
                  ? c.cities.slice(0, 4).map((city) => `${city.city || '—'} (${city.visitors})`).join('  ·  ')
                  : '';
                return (
                  <div key={c.slug} className="relative h-[54px] rounded-xl" style={{ background: '#B8864A12' }}>
                    {/* Bar fill */}
                    <div
                      className="absolute inset-y-0 left-0 rounded-xl transition-all duration-500"
                      style={{ width: `${barPct}%`, background: 'linear-gradient(135deg, #C8975A 0%, #A97540 100%)' }}
                    />
                    {/* Name + cities — padded right so text stays away from number zone */}
                    <div className="absolute inset-0 flex flex-col justify-center px-4" style={{ paddingRight: '28%' }}>
                      <a
                        href={`/companies/${c.slug}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="truncate hover:underline"
                        style={{ fontSize: 14, fontWeight: 700, color: 'white', textShadow: '0 1px 3px rgba(0,0,0,0.28)' }}
                      >
                        {displayName}
                      </a>
                      {cityText && (
                        <div className="truncate" style={{ fontSize: 11, color: 'rgba(255,255,255,0.72)', textShadow: '0 1px 2px rgba(0,0,0,0.2)' }}>
                          {cityText}
                        </div>
                      )}
                    </div>
                    {/* Number — left tracks barPct%, paddingLeft provides the gap */}
                    <span
                      className="absolute top-1/2 -translate-y-1/2 tabular-nums whitespace-nowrap"
                      style={{ left: `${barPct}%`, paddingLeft: 10, fontSize: 18, fontWeight: 700, color: '#6b4a24' }}
                    >
                      {c.unique_visitors}
                    </span>
                  </div>
                );
              })}
            </div>
          );
        })()}
      </div>

      {/* UAE SVG Map */}
      <Suspense fallback={<div className="bg-white rounded-2xl border border-stone-200 shadow-sm p-6 h-[380px] animate-pulse" />}>
        <UAEMapSVG companyCities={companyCities} inquiryCities={inquiryCities} visitorCities={visitorCities} homeownerCities={homeownerCities} companyTypeCities={companyTypeCities} />
      </Suspense>

      {/* Weight Config (collapsible) */}
      <div className="bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden">
        <button
          onClick={() => setWeightOpen((v) => !v)}
          className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-stone-50/50 transition-colors"
        >
          <div>
            <h2 className="text-sm font-bold text-[#2c2c2c]">{t('Weight Configuration', '权重配置')}</h2>
            <p className="text-xs text-[#6b6b6b] mt-0.5">{t('Company sort weight settings', '公司排序权重设置')}</p>
          </div>
          {weightOpen ? <ChevronDown className="w-4 h-4 text-stone-400" /> : <ChevronRight className="w-4 h-4 text-stone-400" />}
        </button>
        {weightOpen && (
          <div className="px-5 pb-5">
            <WeightConfigCard />
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── Tab 1: Registration Data ─── */

function RegistrationTab({ days }: { days: DaysOption }) {
  const { t, lang } = useAdminT();
  const [stats, setStats] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [chartType, setChartType] = useState<'bar' | 'area'>('bar');
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [sources, setSources] = useState<{
    signup_sources: Array<{ source: string; count: number }>;
    company_types: Array<{ type: string; count: number }>;
  } | null>(null);

  useEffect(() => {
    setLoading(true);
    (adminApi.getDailyStats(days) as Promise<StatsData>)
      .then((res) => setStats(res))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [days]);

  useEffect(() => {
    adminApi.getRegistrationSources()
      .then((res) => setSources(res))
      .catch(() => {});
  }, []);

  const data = stats?.data || [];
  const totals = stats?.totals || { new_homeowners: 0, new_companies: 0, new_inquiries: 0 };

  // Period-over-period comparison
  const comparison = useMemo(() => {
    if (!data.length) return { homeowners: 0, companies: 0, inquiries: 0 };
    // current period totals are in `totals`
    // previous period: we need data from before the current range
    // Since getDailyStats only returns `days` worth of data, we approximate:
    // fetch 2x days and compare first half vs second half isn't possible with single call
    // So we'll show the totals only (comparison requires backend support for prev period)
    // For now, return 0 (no comparison data available)
    return { homeowners: 0, companies: 0, inquiries: 0 };
  }, [data, totals]);

  const recentRows = useMemo(() => [...data].reverse().slice(0, 14), [data]);

  const homeownerSpark = useMemo(() => data.map((d) => d.new_homeowners), [data]);
  const companySpark   = useMemo(() => data.map((d) => d.new_companies),  [data]);
  const inquirySpark   = useMemo(() => data.map((d) => d.new_inquiries),  [data]);

  const toggleRow = (date: string) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(date)) next.delete(date);
      else next.add(date);
      return next;
    });
  };

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <SummaryCard
          icon={<Users className="w-5 h-5" />}
          iconColor={COLOR_HOMEOWNER}
          label={t('New Homeowners', '新增业主')}
          value={totals.new_homeowners}
          change={comparison.homeowners}
          loading={loading}
          days={days}
          sparkData={homeownerSpark}
        />
        <SummaryCard
          icon={<Building2 className="w-5 h-5" />}
          iconColor={COLOR_COMPANY}
          label={t('New Companies', '新增装企')}
          value={totals.new_companies}
          change={comparison.companies}
          loading={loading}
          days={days}
          sparkData={companySpark}
        />
        <SummaryCard
          icon={<MessageSquare className="w-5 h-5" />}
          iconColor={COLOR_INQUIRY}
          label={t('New Inquiries', '新增询盘')}
          value={totals.new_inquiries}
          change={comparison.inquiries}
          loading={loading}
          days={days}
          sparkData={inquirySpark}
        />
      </div>

      {/* Daily trend chart */}
      <div className="bg-white rounded-2xl border border-stone-200 shadow-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-sm font-bold text-[#2c2c2c]">{t('Daily Registration Trend', '每日注册趋势')}</h2>
            <p className="text-xs text-[#6b6b6b] mt-0.5">{t('Daily breakdown by type', '按类型每日分布')}</p>
          </div>
          <div className="flex items-center gap-1 bg-stone-100 rounded-2xl p-0.5">
            <button
              onClick={() => setChartType('bar')}
              className={`p-1.5 rounded-xl transition-colors ${chartType === 'bar' ? 'bg-white shadow-sm text-[#2c2c2c]' : 'text-[#6b6b6b]'}`}
              title="Bar Chart"
            >
              <BarChart3 className="w-4 h-4" />
            </button>
            <button
              onClick={() => setChartType('area')}
              className={`p-1.5 rounded-xl transition-colors ${chartType === 'area' ? 'bg-white shadow-sm text-[#2c2c2c]' : 'text-[#6b6b6b]'}`}
              title="Area Chart"
            >
              <AreaChartIcon className="w-4 h-4" />
            </button>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-[300px] text-[#6b6b6b] text-sm">{t('Loading...', '加载中...')}</div>
        ) : data.length === 0 ? (
          <div className="flex items-center justify-center h-[300px] text-[#6b6b6b] text-sm">{t('No data', '暂无数据')}</div>
        ) : (
          <ResponsiveContainer width="100%" height={320}>
            {chartType === 'bar' ? (
              <BarChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e7e5e4" />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#a8a29e' }} tickFormatter={(v: string) => v.slice(5, 10)} />
                <YAxis tick={{ fontSize: 11, fill: '#a8a29e' }} allowDecimals={false} />
                <Tooltip content={<ChartTooltip />} />
                <Legend
                  wrapperStyle={{ fontSize: 12 }}
                  formatter={(value: string) => {
                    const map: Record<string, string> = {
                      new_homeowners: t('Homeowners', '业主'),
                      new_companies: t('Companies', '装企'),
                      new_inquiries: t('Inquiries', '询盘'),
                    };
                    return <span className="text-[#6b6b6b]">{map[value] || value}</span>;
                  }}
                />
                <Bar dataKey="new_homeowners" fill={COLOR_HOMEOWNER} radius={[3, 3, 0, 0]} />
                <Bar dataKey="new_companies" fill={COLOR_COMPANY} radius={[3, 3, 0, 0]} />
                <Bar dataKey="new_inquiries" fill={COLOR_INQUIRY} radius={[3, 3, 0, 0]} />
              </BarChart>
            ) : (
              <AreaChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e7e5e4" />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#a8a29e' }} tickFormatter={(v: string) => v.slice(5, 10)} />
                <YAxis tick={{ fontSize: 11, fill: '#a8a29e' }} allowDecimals={false} />
                <Tooltip content={<ChartTooltip />} />
                <Legend
                  wrapperStyle={{ fontSize: 12 }}
                  formatter={(value: string) => {
                    const map: Record<string, string> = {
                      new_homeowners: t('Homeowners', '业主'),
                      new_companies: t('Companies', '装企'),
                      new_inquiries: t('Inquiries', '询盘'),
                    };
                    return <span className="text-[#6b6b6b]">{map[value] || value}</span>;
                  }}
                />
                <Area type="monotone" dataKey="new_homeowners" fill={COLOR_HOMEOWNER} stroke={COLOR_HOMEOWNER} fillOpacity={0.15} />
                <Area type="monotone" dataKey="new_companies" fill={COLOR_COMPANY} stroke={COLOR_COMPANY} fillOpacity={0.15} />
                <Area type="monotone" dataKey="new_inquiries" fill={COLOR_INQUIRY} stroke={COLOR_INQUIRY} fillOpacity={0.15} />
              </AreaChart>
            )}
          </ResponsiveContainer>
        )}
      </div>

      {/* Pie charts */}
      {sources && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Signup Source Distribution */}
          <div className="bg-white rounded-2xl border border-stone-200 shadow-sm p-6">
            <h2 className="text-sm font-bold text-[#2c2c2c] mb-1">{t('Signup Source Distribution', '注册来源分布')}</h2>
            <p className="text-xs text-[#6b6b6b] mb-4">{t('Where users signed up from', '用户注册来源渠道')}</p>
            {sources.signup_sources.length === 0 ? (
              <div className="flex items-center justify-center h-[220px] text-[#6b6b6b] text-sm">{t('No data', '暂无数据')}</div>
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie
                    data={sources.signup_sources.map((s) => ({ name: s.source || t('Unknown', '未知'), value: s.count }))}
                    cx="50%"
                    cy="50%"
                    outerRadius={90}
                    innerRadius={40}
                    dataKey="value"
                    label={renderPieLabel}
                    labelLine={{ stroke: '#d6d3d1', strokeWidth: 0.5 }}
                  >
                    {sources.signup_sources.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value: any) => [value, t('Count', '数量')]}
                    contentStyle={{ borderRadius: 16, border: '1px solid #e7e5e4', fontSize: 12 }}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Company Type Distribution */}
          <div className="bg-white rounded-2xl border border-stone-200 shadow-sm p-6">
            <h2 className="text-sm font-bold text-[#2c2c2c] mb-1">{t('Company Type Distribution', '装企类型分布')}</h2>
            <p className="text-xs text-[#6b6b6b] mb-4">{t('Registered company types', '注册装企类型分布')}</p>
            {sources.company_types.length === 0 ? (
              <div className="flex items-center justify-center h-[220px] text-[#6b6b6b] text-sm">{t('No data', '暂无数据')}</div>
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie
                    data={sources.company_types.map((s) => ({ name: labelCompanyType(s.type || '', lang === 'en' ? 'en' : 'zh') || t('Unknown', '未知'), value: s.count }))}
                    cx="50%"
                    cy="50%"
                    outerRadius={90}
                    innerRadius={40}
                    dataKey="value"
                    label={renderPieLabel}
                    labelLine={{ stroke: '#d6d3d1', strokeWidth: 0.5 }}
                  >
                    {sources.company_types.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value: any) => [value, t('Count', '数量')]}
                    contentStyle={{ borderRadius: 16, border: '1px solid #e7e5e4', fontSize: 12 }}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      )}

      {/* 14-day detail table */}
      <div className="bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-stone-100">
          <h2 className="text-sm font-bold text-[#2c2c2c]">{t('Last 14 Days Detail', '近14天明细')}</h2>
          <p className="text-xs text-[#6b6b6b] mt-0.5">{t('Click a row to see name lists', '点击行可展开查看名单')}</p>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs text-stone-400 border-b border-stone-100">
              <th className="text-left px-5 py-2.5 font-medium w-8" />
              <th className="text-left px-5 py-2.5 font-medium">{t('Date', '日期')}</th>
              <th className="text-right px-5 py-2.5 font-medium" style={{ color: COLOR_HOMEOWNER }}>{t('Homeowners', '新增业主')}</th>
              <th className="text-right px-5 py-2.5 font-medium" style={{ color: COLOR_COMPANY }}>{t('Companies', '新增装企')}</th>
              <th className="text-right px-5 py-2.5 font-medium" style={{ color: COLOR_INQUIRY }}>{t('Inquiries', '询盘数')}</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} className="text-center py-8 text-[#6b6b6b]">{t('Loading...', '加载中...')}</td></tr>
            ) : recentRows.length === 0 ? (
              <tr><td colSpan={5} className="text-center py-8 text-[#6b6b6b]">{t('No data', '暂无数据')}</td></tr>
            ) : recentRows.map((row) => {
              const hasDetails = (row.homeowner_list?.length || 0) + (row.company_list?.length || 0) + (row.inquiry_list?.length || 0) > 0;
              const isExpanded = expandedRows.has(row.date);
              return (
                <ExpandableRow key={row.date} row={row} hasDetails={hasDetails} isExpanded={isExpanded} onToggle={() => toggleRow(row.date)} />
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ─── Summary Card ─── */

function SummaryCard({
  icon, iconColor, label, value, change, loading, days, sparkData,
}: {
  icon: React.ReactNode;
  iconColor: string;
  label: string;
  value: number;
  change: number;
  loading: boolean;
  days: number;
  sparkData?: number[];
}) {
  const { t } = useAdminT();
  const chartData = (sparkData || []).map((v) => ({ v }));
  return (
    <div className="bg-white rounded-2xl border border-stone-200 shadow-sm p-5 flex items-center gap-4">
      {/* Left: text */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2.5 mb-2.5">
          <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: `${iconColor}15`, color: iconColor }}>
            {icon}
          </div>
          <span className="text-sm font-medium text-stone-500 truncate">{label}</span>
        </div>
        <div className="text-[28px] font-bold text-[#2c2c2c] leading-none">
          {loading ? '...' : value.toLocaleString()}
        </div>
        <div className="flex items-center gap-2 mt-1.5">
          {change !== 0 && (
            <span className={`text-xs font-medium ${change > 0 ? 'text-green-600' : 'text-red-500'}`}>
              {change > 0 ? '+' : ''}{change}%
            </span>
          )}
          <span className="text-xs text-[#6b6b6b]">{t(`Last ${days} days`, `近${days}天`)}</span>
        </div>
      </div>
      {/* Right: sparkline */}
      {chartData.length > 1 && !loading && (
        <div className="flex-shrink-0">
          <LineChart width={110} height={56} data={chartData}>
            <Line type="monotone" dataKey="v" stroke={iconColor} strokeWidth={1.8} dot={false} strokeOpacity={0.85} />
          </LineChart>
        </div>
      )}
    </div>
  );
}

/* ─── Expandable Table Row ─── */

function ExpandableRow({
  row, hasDetails, isExpanded, onToggle,
}: {
  row: DayRow;
  hasDetails: boolean;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  return (
    <>
      <tr
        className={`border-b border-stone-50 transition-colors ${hasDetails ? 'cursor-pointer hover:bg-stone-50/50' : ''}`}
        onClick={hasDetails ? onToggle : undefined}
      >
        <td className="px-3 py-2.5 text-stone-400 w-8">
          {hasDetails && (
            isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />
          )}
        </td>
        <td className="px-5 py-2.5 text-[#6b6b6b] font-mono text-xs">{row.date}</td>
        <td className="px-5 py-2.5 text-right font-medium" style={{ color: row.new_homeowners > 0 ? COLOR_HOMEOWNER : '#d1cec9' }}>
          {row.new_homeowners || '\u2014'}
        </td>
        <td className="px-5 py-2.5 text-right font-medium" style={{ color: row.new_companies > 0 ? COLOR_COMPANY : '#d1cec9' }}>
          {row.new_companies || '\u2014'}
        </td>
        <td className="px-5 py-2.5 text-right font-medium" style={{ color: row.new_inquiries > 0 ? COLOR_INQUIRY : '#d1cec9' }}>
          {row.new_inquiries || '\u2014'}
        </td>
      </tr>
      {isExpanded && hasDetails && (
        <tr className="bg-stone-50/30">
          <td colSpan={5} className="px-8 py-3">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
              {(row.homeowner_list?.length ?? 0) > 0 && (
                <DetailList label="业主" color={COLOR_HOMEOWNER} items={row.homeowner_list!} />
              )}
              {(row.company_list?.length ?? 0) > 0 && (
                <DetailList label="装企" color={COLOR_COMPANY} items={row.company_list!} />
              )}
              {(row.inquiry_list?.length ?? 0) > 0 && (
                <DetailList label="询盘" color={COLOR_INQUIRY} items={row.inquiry_list!} />
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

function DetailList({ label, color, items }: { label: string; color: string; items: DetailItem[] }) {
  return (
    <div>
      <div className="font-medium mb-1" style={{ color }}>{label}</div>
      {items.map((item, i) => (
        <div key={i} className="text-[#6b6b6b] truncate py-0.5">
          {item.name}
          {item.city && <span className="text-stone-400 ml-1">({item.city})</span>}
          {item.phone && <span className="text-stone-400 ml-1">{item.phone}</span>}
        </div>
      ))}
    </div>
  );
}
