import { useEffect, useState } from 'react';
import { adminApi, AnalyticsEventRecord, AnalyticsOverview } from '../../lib/adminApi';
import { formatCount } from '../../lib/formatNumber';
import { useAdmin } from '../../contexts/AdminContext';
import { ADMIN_ANALYTICS_PAGE_SIZE } from '../../lib/constants';
import { PageSpinner } from '../../components/ui/Spinner';

const INITIAL_OVERVIEW: AnalyticsOverview = {
  total_events: 0,
  unique_visitors: 0,
  page_views: 0,
  apply_clicks: 0,
  whatsapp_clicks: 0,
  contact_submits: 0,
};

// Page name mapping configuration
const PAGE_NAME_MAP: Record<string, string> = {
  '/': 'Home',
  '/designers': 'Designers',
  '/designers/apply': 'Join as Designer',
  '/auth': 'Login / Register',
  '/login': 'Login / Register',
  '/register': 'Login / Register',
  '/verify-email': 'Verify Email',
  '/forgot-password': 'Forgot Password',
  '/reset-password': 'Reset Password',
  '/materials': 'Materials',
  '/services/new-home-design': 'New Home Design Service',
  '/services/soft-decoration': 'Soft Decoration Service',
  '/contact': 'Contact',
  '/privacy': 'Privacy Policy',
  '/designer/dashboard': 'Designer Dashboard',
  '/designer/profile': 'Designer Profile Edit',
  '/designer/projects': 'Designer Projects',
  '/designer/upload': 'Designer Upload',
  '/admin': 'Admin Dashboard',
  '/admin/designers': 'Admin Designers',
  '/admin/visitors': 'Admin Visitors',
  '/admin/analytics': 'Admin Analytics',
  '/admin/admins': 'Admin Users',
};

// Pattern-based page name mapping
const PAGE_NAME_PATTERNS: Array<{ pattern: RegExp; name: string }> = [
  { pattern: /^\/designers\/.*\/projects\/.*/, name: 'Designer Project Detail' },
  { pattern: /^\/designers\/.*/, name: 'Designer Profile' },
  { pattern: /^\/materials\/brands\/.*/, name: 'Brand Detail' },
  { pattern: /^\/materials\/.*/, name: 'Material Category' },
];

function getReadablePageName(rawPath: string | null): string {
  const trimmed = rawPath?.trim() || '';
  let path = trimmed;

  // Handle full URLs
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    try {
      path = new URL(trimmed).pathname || '/';
    } catch {
      path = trimmed;
    }
  }

  if (!path) return 'Unknown Page';

  // Check exact matches first
  if (PAGE_NAME_MAP[path]) {
    return PAGE_NAME_MAP[path];
  }

  // Check pattern matches
  for (const { pattern, name } of PAGE_NAME_PATTERNS) {
    if (pattern.test(path)) {
      return name;
    }
  }

  // Return original path if no match found
  return path;
}

export default function AdminAnalyticsPage() {
  const { hasPermission } = useAdmin();
  const [overview, setOverview] = useState<AnalyticsOverview>(INITIAL_OVERVIEW);
  const [topPages, setTopPages] = useState<Array<{ page_path: string; page_views: number; visitors: number; events?: number }>>([]);
  const [events, setEvents] = useState<AnalyticsEventRecord[]>([]);
  const [eventName, setEventName] = useState('');
  const [pagePath, setPagePath] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!hasPermission('can_view_stats')) {
      setLoading(false);
      return;
    }
    load();
  }, [hasPermission, page]);

  const load = async () => {
    setLoading(true);
    try {
      const [overviewResult, eventsResult] = await Promise.all([
        adminApi.getAnalyticsOverview(),
        adminApi.getAnalyticsEvents({ page, limit: ADMIN_ANALYTICS_PAGE_SIZE, eventName: eventName || undefined, pagePath: pagePath || undefined }),
      ]);
      setOverview(overviewResult.overview);
      setTopPages(overviewResult.topPages || []);
      setEvents(eventsResult.events);
      setTotalPages(Math.max(1, eventsResult.pagination.pages || 1));
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = async () => {
    setPage(1);
    await load();
  };

  if (!hasPermission('can_view_stats')) {
    return <div className="text-stone-500">You do not have permission to view analytics.</div>;
  }

  return (
    <div className="max-w-6xl mx-auto">
      <h1 className="text-3xl font-bold text-[#2c2c2c] mb-2">Traffic Analytics</h1>
      <p className="text-stone-500 text-sm mb-8">Google-compatible event tracking plus first-party detailed event logs.</p>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3 mb-8">
        <StatCard label="Total Events" value={formatCount(overview.total_events)} />
        <StatCard label="Unique Visitors" value={formatCount(overview.unique_visitors)} />
        <StatCard label="Page Views" value={formatCount(overview.page_views)} />
        <StatCard label="Apply Clicks" value={formatCount(overview.apply_clicks)} />
        <StatCard label="WhatsApp Clicks" value={formatCount(overview.whatsapp_clicks)} />
        <StatCard label="Contact Submits" value={formatCount(overview.contact_submits)} />
      </div>

      <PageVisitorsChart rows={topPages} />

      <div className="rounded-lg border border-stone-200 bg-white p-4 mb-4">
        <div className="grid grid-cols-1 md:grid-cols-[1fr_1fr_auto] gap-3">
          <input
            value={eventName}
            onChange={(e) => setEventName(e.target.value)}
            placeholder="Filter by event name (e.g. click_whatsapp)"
            className="h-10 rounded border border-stone-200 px-3 text-sm"
          />
          <input
            value={pagePath}
            onChange={(e) => setPagePath(e.target.value)}
            placeholder="Filter by page path (e.g. /designers)"
            className="h-10 rounded border border-stone-200 px-3 text-sm"
          />
          <button
            type="button"
            onClick={applyFilters}
            className="h-10 rounded px-4 text-sm font-semibold text-white bg-[#b8864a]"
          >
            Apply
          </button>
        </div>
      </div>

      <div className="rounded-lg border border-stone-200 bg-white overflow-hidden">
        {loading ? (
          <PageSpinner text="Loading analytics..." />
        ) : (
          <table className="w-full text-sm table-fixed">
            <colgroup>
              <col className="w-[22%]" />
              <col className="w-[14%]" />
              <col className="w-[26%]" />
              <col className="w-[18%]" />
              <col className="w-[20%]" />
            </colgroup>
            <thead>
              <tr className="border-b border-stone-200 text-stone-500">
                <th className="py-3 px-4 text-left">Time</th>
                <th className="py-3 px-4 text-left">Event</th>
                <th className="py-3 px-4 text-left">Page</th>
                <th className="py-3 px-4 text-left">IP</th>
                <th className="py-3 px-4 text-left">Location</th>
              </tr>
            </thead>
            <tbody>
              {events.map((item) => (
                <tr key={item.id} className="border-b border-stone-100">
                  <td className="py-3 px-4 text-stone-500 truncate">{new Date(item.created_at).toLocaleString()}</td>
                  <td className="py-3 px-4 font-medium text-[#2c2c2c] truncate">{item.event_name}</td>
                  <td className="py-3 px-4 text-stone-600">
                    <div className="font-medium text-stone-700 truncate">{getReadablePageName(item.page_path)}</div>
                  </td>
                  <td className="py-3 px-4 text-stone-600 truncate">{item.viewer_ip || '-'}</td>
                  <td className="py-3 px-4 text-stone-600 truncate">{item.location_label || 'Unknown'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="mt-4 flex items-center justify-end gap-2">
        <button
          type="button"
          disabled={page <= 1}
          onClick={() => setPage((p) => Math.max(1, p - 1))}
          className="h-9 rounded border border-stone-200 px-3 disabled:opacity-40"
        >
          Prev
        </button>
        <span className="text-sm text-stone-500">{page} / {totalPages}</span>
        <button
          type="button"
          disabled={page >= totalPages}
          onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
          className="h-9 rounded border border-stone-200 px-3 disabled:opacity-40"
        >
          Next
        </button>
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

function PageVisitorsChart({ rows }: { rows: Array<{ page_path: string; page_views: number; visitors: number; events?: number }> }) {
  const maxVisitors = rows.reduce((max, row) => {
    const visitors = Number(row.visitors ?? row.events) || 0;
    return Math.max(max, visitors);
  }, 0);

  return (
    <div className="rounded-lg border border-stone-200 bg-white p-4 mb-4">
      <h2 className="text-lg font-semibold text-[#2c2c2c] mb-1">Page Visitors</h2>
      <p className="text-xs text-stone-500 mb-4">Unique visitors by page (Top 10)</p>

      {rows.length === 0 ? (
        <div className="text-sm text-stone-500 py-6">No page visitor data yet.</div>
      ) : (
        <div className="space-y-3">
          {rows.map((row) => {
            const visitors = Number(row.visitors ?? row.events) || 0;
            const pageViews = Number(row.page_views ?? row.events) || 0;
            const widthPct = maxVisitors > 0 ? Math.max(6, Math.round((visitors / maxVisitors) * 100)) : 6;
            return (
              <div key={`${row.page_path}-${visitors}-${pageViews}`} className="grid grid-cols-[220px_1fr_140px] items-center gap-3">
                <div className="text-sm text-stone-700 truncate" title={getReadablePageName(row.page_path)}>
                  {getReadablePageName(row.page_path)}
                </div>
                <div className="h-3 rounded bg-stone-100 overflow-hidden">
                  <div className="h-full rounded bg-[#b8864a]" style={{ width: `${widthPct}%` }} />
                </div>
                <div className="text-xs text-right text-stone-500">
                  {formatCount(visitors)} visitors / {formatCount(pageViews)} views
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
