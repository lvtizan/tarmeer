import { useEffect, useState } from 'react';
import { Globe } from 'lucide-react';
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

interface CompanyVisitorRow {
  page_path: string;
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
      const [overviewResult, visitorOverview, companyResult] = await Promise.all([
        adminApi.getAnalyticsOverview(),
        adminApi.getVisitorOverview(),
        adminApi.getCompanyVisitors(),
      ]);
      setOverview(overviewResult.overview);
      setVisitorIpCount(visitorOverview.uniqueIpCount);
      setCompanyVisitors(companyResult.companies || []);
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
            const slug = extractCompanySlug(row.page_path);
            const name = slugToName(slug);

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
