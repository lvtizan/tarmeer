import { useEffect, useState, useCallback } from 'react';
import { Globe, RefreshCw, Save } from 'lucide-react';
import { adminApi, AnalyticsOverview, VisitorRecord } from '../../lib/adminApi';
import { formatCount } from '../../lib/formatNumber';
import { useAdmin } from '../../contexts/AdminContext';
import { PageSpinner } from '../../components/ui/Spinner';

const PRIMARY = '#b8864a';

const INITIAL_OVERVIEW: AnalyticsOverview = {
  total_events: 0,
  unique_visitors: 0,
  page_views: 0,
  apply_clicks: 0,
  whatsapp_clicks: 0,
  contact_submits: 0,
};

const GOOGLE_ANALYTICS_URL = 'https://analytics.google.com/analytics/web/#/p488498498/reports/intelligenthome';

const VISITOR_PAGE_SIZE = 50;

interface DailyRegistrationRow {
  stat_date: string;
  homeowner_count: number;
  company_count: number;
}

interface CompanyVisitorRow {
  page_path: string;
  company_name: string;
  slug: string;
  unique_visitors: number;
  total_views: number;
  cities: Array<{ city: string; visitors: number }>;
}

function extractCompanySlug(pagePath: string): string {
  // /companies/some-slug -> some-slug
  const match = pagePath.match(/^\/companies\/(.+)/);
  return match ? match[1] : pagePath;
}

function slugToName(slug: string): string {
  return slug.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

export default function AdminAnalyticsPage() {
  const { hasPermission } = useAdmin();
  const [overview, setOverview] = useState<AnalyticsOverview>(INITIAL_OVERVIEW);
  const [visitorIpCount, setVisitorIpCount] = useState(0);
  const [companyVisitors, setCompanyVisitors] = useState<CompanyVisitorRow[]>([]);
  const [dailyRegistrations, setDailyRegistrations] = useState<DailyRegistrationRow[]>([]);
  const [visitors, setVisitors] = useState<VisitorRecord[]>([]);
  const [visitorTotal, setVisitorTotal] = useState(0);
  const [visitorPage, setVisitorPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [visitorsLoading, setVisitorsLoading] = useState(false);

  useEffect(() => {
    if (!hasPermission('can_view_stats')) {
      setLoading(false);
      return;
    }
    loadInitial();
  }, [hasPermission]);

  useEffect(() => {
    if (!hasPermission('can_view_stats')) return;
    loadVisitors();
  }, [hasPermission, visitorPage]);

  const loadInitial = async () => {
    setLoading(true);
    try {
      const [overviewResult, visitorOverview, companyResult, regResult] = await Promise.all([
        adminApi.getAnalyticsOverview(),
        adminApi.getVisitorOverview(),
        adminApi.getCompanyVisitors(),
        adminApi.getDailyRegistrations(),
      ]);
      setOverview(overviewResult.overview);
      setVisitorIpCount(visitorOverview.uniqueIpCount);
      setCompanyVisitors(companyResult.companies || []);
      setDailyRegistrations(regResult.dailyRegistrations || []);
    } finally {
      setLoading(false);
    }
  };

  const loadVisitors = async () => {
    setVisitorsLoading(true);
    try {
      const result = await adminApi.getVisitors({ page: visitorPage, limit: VISITOR_PAGE_SIZE });
      setVisitors(result.visitors);
      setVisitorTotal(result.pagination.total);
    } finally {
      setVisitorsLoading(false);
    }
  };

  if (!hasPermission('can_view_stats')) {
    return <div className="text-stone-500">You do not have permission to view analytics.</div>;
  }

  if (loading) {
    return <PageSpinner text="Loading analytics..." />;
  }

  const visitorTotalPages = Math.max(1, Math.ceil(visitorTotal / VISITOR_PAGE_SIZE));

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-2">
        <h1 className="text-3xl font-bold text-[#2c2c2c]">Analytics</h1>
        <a
          href={GOOGLE_ANALYTICS_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-stone-200 text-sm font-medium text-stone-700 hover:border-[#b8864a] hover:text-[#b8864a] transition"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M22.84 2.998v17.958c0 1.68-1.356 3.044-3.03 3.044h-.06c-1.674 0-3.03-1.364-3.03-3.044V2.998c0-1.68 1.356-3.044 3.03-3.044h.06c1.674 0 3.03 1.364 3.03 3.044zm-7.26 8.967v9.013c0 1.674-1.356 3.03-3.03 3.03h-.06c-1.674 0-3.03-1.356-3.03-3.03v-9.013c0-1.674 1.356-3.03 3.03-3.03h.06c1.674 0 3.03 1.356 3.03 3.03zM8.34 20.97a3.03 3.03 0 11-6.06 0 3.03 3.03 0 016.06 0z"/></svg>
          Google Analytics
        </a>
      </div>
      <p className="text-stone-500 text-sm mb-8">Platform traffic overview, company visitors, and visitor IP records.</p>

      {/* Top Row: 6 Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3 mb-8">
        <StatCard label="Total Events" value={formatCount(overview.total_events)} />
        <div className="rounded-lg border border-stone-200 bg-white p-4">
          <p className="text-xs text-stone-500 uppercase tracking-wide flex items-center gap-1.5">
            <Globe className="w-3.5 h-3.5" />
            Visitor IPs
          </p>
          <p className="text-xl font-bold text-[#2c2c2c] mt-1">{formatCount(visitorIpCount)}</p>
          <a href="#visitor-list" className="text-xs font-semibold mt-1 inline-block" style={{ color: PRIMARY }}>
            View visitor list &rarr;
          </a>
        </div>
        <StatCard label="Page Views" value={formatCount(overview.page_views)} />
        <StatCard label="Apply Clicks" value={formatCount(overview.apply_clicks)} />
        <StatCard label="WhatsApp Clicks" value={formatCount(overview.whatsapp_clicks)} />
        <StatCard label="Contact Submits" value={formatCount(overview.contact_submits)} />
      </div>

      {/* Daily Registrations Chart */}
      <DailyRegistrationsChart rows={dailyRegistrations} />

      {/* Company Visitors Chart */}
      <CompanyVisitorsChart rows={companyVisitors} />

      {/* Visitor List */}
      <div id="visitor-list" className="rounded-lg border border-stone-200 bg-white overflow-hidden">
        <div className="px-4 py-3 border-b border-stone-200">
          <h2 className="text-lg font-semibold text-[#2c2c2c]">Visitor IPs</h2>
          <p className="text-xs text-stone-500">Unique visitor IP records and their most recent access location. Total: {visitorTotal}</p>
        </div>
        {visitorsLoading ? (
          <PageSpinner text="Loading visitor records..." />
        ) : visitors.length === 0 ? (
          <div className="p-6 text-stone-500">No visitor records yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-stone-200">
                  <th className="py-3 px-4 text-left text-sm font-medium text-stone-500">No.</th>
                  <th className="py-3 px-4 text-left text-sm font-medium text-stone-500">Visitor IP</th>
                  <th className="py-3 px-4 text-left text-sm font-medium text-stone-500">Location</th>
                  <th className="py-3 px-4 text-left text-sm font-medium text-stone-500">Last Visit</th>
                </tr>
              </thead>
              <tbody>
                {visitors.map((item, index) => (
                  <tr key={`${item.ip}-${index}`} className="border-b border-stone-100">
                    <td className="py-3 px-4 text-sm text-stone-600">{(visitorPage - 1) * VISITOR_PAGE_SIZE + index + 1}</td>
                    <td className="py-3 px-4 text-sm font-medium text-[#2c2c2c]">{item.ip}</td>
                    <td className="py-3 px-4 text-sm text-stone-600">{item.location || 'Unknown'}</td>
                    <td className="py-3 px-4 text-sm text-stone-500">
                      {item.lastVisitedAt ? new Date(item.lastVisitedAt).toLocaleString() : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Visitor Pagination */}
      <div className="mt-4 flex items-center justify-between text-sm mb-8">
        <div className="text-stone-500">Total unique IPs: {visitorTotal}</div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setVisitorPage((prev) => Math.max(1, prev - 1))}
            disabled={visitorPage <= 1 || visitorsLoading}
            className="rounded border border-stone-200 px-3 py-1.5 text-stone-700 disabled:opacity-40"
          >
            Previous
          </button>
          <span className="text-stone-600">{visitorPage} / {visitorTotalPages}</span>
          <button
            type="button"
            onClick={() => setVisitorPage((prev) => Math.min(visitorTotalPages, prev + 1))}
            disabled={visitorPage >= visitorTotalPages || visitorsLoading}
            className="rounded border border-stone-200 px-3 py-1.5 text-stone-700 disabled:opacity-40"
          >
            Next
          </button>
        </div>
      </div>

      {/* Weight Configuration */}
      <WeightConfigCard />
    </div>
  );
}

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

function WeightConfigCard() {
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
    <div className="rounded-lg border border-stone-200 bg-white p-5 mb-8">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-semibold text-[#2c2c2c]">Weight Configuration</h2>
          <p className="text-xs text-stone-500">Configure how company sort weight is calculated.</p>
        </div>
        <button
          onClick={handleRecalculate}
          disabled={recalculating}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-stone-200 text-sm font-medium text-stone-700 hover:border-[#b8864a] hover:text-[#b8864a] transition disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${recalculating ? 'animate-spin' : ''}`} />
          {recalculating ? 'Recalculating...' : 'Recalculate Now'}
        </button>
      </div>

      {toast && (
        <div className="mb-4 px-3 py-2 rounded-lg bg-green-50 border border-green-200 text-green-700 text-sm">{toast}</div>
      )}

      {configs.length === 0 ? (
        <p className="text-sm text-stone-500">No weight config found. Backend may not have this feature enabled yet.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {configs.map((cfg) => (
            <div key={cfg.key} className="border border-stone-200 rounded-lg p-4">
              <label className="block text-sm font-medium text-stone-600 mb-1">{WEIGHT_CONFIG_LABELS[cfg.key] || cfg.key}</label>
              <div className="flex gap-2">
                <input
                  type="number"
                  value={editValues[cfg.key] ?? cfg.value}
                  onChange={(e) => setEditValues((prev) => ({ ...prev, [cfg.key]: e.target.value }))}
                  className="flex-1 px-3 py-2 border border-stone-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#b8864a]/15 focus:border-[#b8864a]"
                />
                <button
                  onClick={() => handleSave(cfg.key)}
                  disabled={saving === cfg.key || editValues[cfg.key] === undefined}
                  className="px-3 py-2 rounded-lg bg-[#b8864a] text-white text-sm font-medium hover:bg-[#a67c47] transition disabled:opacity-40"
                >
                  <Save className="w-4 h-4" />
                </button>
              </div>
              <p className="text-xs text-stone-400 mt-1">Last updated: {cfg.updated_at ? new Date(cfg.updated_at).toLocaleString() : 'N/A'}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-stone-200 bg-white p-4">
      <p className="text-xs text-stone-500 uppercase tracking-wide">{label}</p>
      <p className="text-xl font-bold text-[#2c2c2c] mt-1">{value}</p>
    </div>
  );
}

function DailyRegistrationsChart({ rows }: { rows: DailyRegistrationRow[] }) {
  const maxCount = rows.reduce(
    (max, r) => Math.max(max, Number(r.homeowner_count) || 0, Number(r.company_count) || 0),
    0
  );
  const CHART_H = 220;

  const formatDate = (d: string) => {
    const date = new Date(d);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  return (
    <div className="rounded-lg border border-stone-200 bg-white p-4 mb-6">
      <h2 className="text-lg font-semibold text-[#2c2c2c] mb-1">Daily Registrations</h2>
      <p className="text-xs text-stone-500 mb-4">Homeowner vs. Company signups per day</p>

      <div className="flex items-center gap-4 text-xs text-stone-600 mb-3">
        <span className="inline-flex items-center gap-1.5"><span className="inline-block w-3 h-3 rounded-sm bg-[#b8864a]" />Homeowner</span>
        <span className="inline-flex items-center gap-1.5"><span className="inline-block w-3 h-3 rounded-sm bg-[#6b6b6b]" />Company</span>
      </div>

      {rows.length === 0 ? (
        <div className="text-sm text-stone-500 py-6">No registration data yet.</div>
      ) : (
        <div className="overflow-x-auto">
          <div className="flex items-end gap-4 pt-8" style={{ minHeight: CHART_H + 48 }}>
            {rows.map((r) => {
              const h = Number(r.homeowner_count) || 0;
              const c = Number(r.company_count) || 0;
              const hPx = maxCount > 0 ? Math.max(h > 0 ? 2 : 0, Math.round((h / maxCount) * CHART_H)) : 0;
              const cPx = maxCount > 0 ? Math.max(c > 0 ? 2 : 0, Math.round((c / maxCount) * CHART_H)) : 0;
              return (
                <div key={r.stat_date} className="flex flex-col items-center gap-2 shrink-0">
                  <div className="flex items-end gap-1" style={{ height: CHART_H }}>
                    <div className="relative flex flex-col items-center justify-end" style={{ width: 18, height: CHART_H }}>
                      <span className="absolute text-[11px] font-medium text-[#2c2c2c] tabular-nums" style={{ bottom: hPx + 24 }}>{h}</span>
                      <div className="rounded-t-sm bg-[#b8864a]" style={{ width: 18, height: hPx }} />
                    </div>
                    <div className="relative flex flex-col items-center justify-end" style={{ width: 18, height: CHART_H }}>
                      <span className="absolute text-[11px] font-medium text-[#2c2c2c] tabular-nums" style={{ bottom: cPx + 24 }}>{c}</span>
                      <div className="rounded-t-sm bg-[#6b6b6b]" style={{ width: 18, height: cPx }} />
                    </div>
                  </div>
                  <span className="text-[11px] text-stone-500 whitespace-nowrap">{formatDate(r.stat_date)}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function CompanyVisitorsChart({ rows }: { rows: CompanyVisitorRow[] }) {
  const maxVisitors = rows.reduce((max, row) => Math.max(max, Number(row.unique_visitors) || 0), 0);

  return (
    <div className="rounded-lg border border-stone-200 bg-white p-4 mb-6">
      <h2 className="text-lg font-semibold text-[#2c2c2c] mb-1">Company Visitors</h2>
      <p className="text-xs text-stone-500 mb-4">Unique visitors by company (Top 10)</p>

      {rows.length === 0 ? (
        <div className="text-sm text-stone-500 py-6">No company visitor data yet.</div>
      ) : (
        <div className="space-y-4">
          {rows.map((row) => {
            const visitors = Number(row.unique_visitors) || 0;
            const views = Number(row.total_views) || 0;
            const widthPct = maxVisitors > 0 ? Math.max(6, Math.round((visitors / maxVisitors) * 100)) : 6;
            const slug = row.slug || extractCompanySlug(row.page_path);
            const name = row.company_name || slugToName(slug);

            return (
              <div key={row.page_path}>
                <a
                  href={`/companies/${slug}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block hover:bg-stone-50 rounded -mx-2 px-2 py-1 transition-colors"
                >
                  <div className="grid grid-cols-[200px_1fr_160px] items-center gap-3">
                    <div className="text-sm text-stone-700 font-medium truncate" title={name}>
                      {name}
                    </div>
                    <div className="h-3 rounded bg-stone-100 overflow-hidden">
                      <div className="h-full rounded bg-[#b8864a]" style={{ width: `${widthPct}%` }} />
                    </div>
                    <div className="text-xs text-right text-stone-500">
                      {formatCount(visitors)} visitors / {formatCount(views)} views
                    </div>
                  </div>
                  {row.cities && row.cities.length > 0 && (
                    <div className="ml-[200px] mt-1 text-xs text-stone-400 pl-3">
                      {row.cities.map((c, i) => (
                        <span key={c.city}>
                          {i > 0 && <span className="mx-1">&middot;</span>}
                          {c.city} {c.visitors}
                        </span>
                      ))}
                    </div>
                  )}
                </a>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
