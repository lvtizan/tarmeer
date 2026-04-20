import { useEffect, useState, useCallback, useMemo } from 'react';
import { Globe, RefreshCw, Save, Users, Building2, MessageSquare, ChevronDown, ChevronRight, BarChart3, AreaChart as AreaChartIcon } from 'lucide-react';
import { adminApi } from '../../lib/adminApi';
import { useAdmin } from '../../contexts/AdminContext';
import { useAdminT } from '../../hooks/useAdminLang';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, PieChart, Pie, Cell, AreaChart, Area,
} from 'recharts';

/* ─── Types ─── */

interface DetailItem {
  name: string;
  email?: string;
  phone?: string;
  city?: string;
  projects?: number;
  company?: string;
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

  const sections: Array<{ label: string; color: string; count: number; items: DetailItem[] }> = [
    { label: '业主', color: COLOR_HOMEOWNER, count: row.new_homeowners, items: row.homeowner_list || [] },
    { label: '装企', color: COLOR_COMPANY, count: row.new_companies, items: row.company_list || [] },
    { label: '询盘', color: COLOR_INQUIRY, count: row.new_inquiries, items: row.inquiry_list || [] },
  ];

  return (
    <div className="bg-white border border-stone-200 rounded-2xl shadow-lg px-4 py-3 text-xs max-w-[320px]">
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
                <div key={i} className="truncate">{item.name}{item.city ? ` (${item.city})` : ''}</div>
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

  if (!hasPermission('can_view_stats')) {
    return <div className="text-[#6b6b6b]">{t('You do not have permission to view analytics.', '您没有查看分析数据的权限。')}</div>;
  }

  return (
    <div className="w-full">
      {/* Page title */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-[#2c2c2c]">{t('Analytics', '数据分析')}</h1>
      </div>

      {/* Tab buttons */}
      <div className="flex items-center gap-1 mb-6">
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

      {activeTab === 'registration' && <RegistrationTab />}
      {activeTab === 'visitor' && <VisitorTabPlaceholder />}
    </div>
  );
}

/* ─── Tab 2 Placeholder ─── */

function VisitorTabPlaceholder() {
  const { t } = useAdminT();
  return (
    <div className="bg-white rounded-2xl border border-stone-200 shadow-sm p-12 text-center">
      <Globe className="w-12 h-12 mx-auto text-stone-300 mb-4" />
      <p className="text-[15px] text-[#6b6b6b]">{t('Visitor data (coming soon)', '访客数据（开发中）')}</p>
    </div>
  );
}

/* ─── Tab 1: Registration Data ─── */

function RegistrationTab() {
  const { t } = useAdminT();
  const [days, setDays] = useState<DaysOption>(30);
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
      {/* Time range selector */}
      <div className="flex items-center justify-end">
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
      </div>

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
        />
        <SummaryCard
          icon={<Building2 className="w-5 h-5" />}
          iconColor={COLOR_COMPANY}
          label={t('New Companies', '新增装企')}
          value={totals.new_companies}
          change={comparison.companies}
          loading={loading}
          days={days}
        />
        <SummaryCard
          icon={<MessageSquare className="w-5 h-5" />}
          iconColor={COLOR_INQUIRY}
          label={t('New Inquiries', '新增询盘')}
          value={totals.new_inquiries}
          change={comparison.inquiries}
          loading={loading}
          days={days}
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
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#a8a29e' }} tickFormatter={(v: string) => v.slice(5)} />
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
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#a8a29e' }} tickFormatter={(v: string) => v.slice(5)} />
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
                    data={sources.company_types.map((s) => ({ name: s.type || t('Unknown', '未知'), value: s.count }))}
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
  icon, iconColor, label, value, change, loading, days,
}: {
  icon: React.ReactNode;
  iconColor: string;
  label: string;
  value: number;
  change: number;
  loading: boolean;
  days: number;
}) {
  const { t } = useAdminT();
  return (
    <div className="bg-white rounded-2xl border border-stone-200 shadow-sm p-5">
      <div className="flex items-center gap-3 mb-3">
        <div className="w-10 h-10 rounded-2xl flex items-center justify-center" style={{ background: `${iconColor}15`, color: iconColor }}>
          {icon}
        </div>
        <span className="text-sm font-medium text-stone-500">{label}</span>
      </div>
      <div className="text-3xl font-bold text-[#2c2c2c]">
        {loading ? '...' : value.toLocaleString()}
      </div>
      <div className="flex items-center gap-2 mt-1">
        {change !== 0 && (
          <span className={`text-xs font-medium ${change > 0 ? 'text-green-600' : 'text-red-500'}`}>
            {change > 0 ? '+' : ''}{change}%
          </span>
        )}
        <span className="text-xs text-[#6b6b6b]">{t(`Last ${days} days`, `近${days}天`)}</span>
      </div>
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
