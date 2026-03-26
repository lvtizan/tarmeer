import { useEffect, useState } from 'react';
import { adminApi, AnalyticsEventRecord, AnalyticsOverview } from '../../lib/adminApi';
import { formatCount } from '../../lib/formatNumber';
import { useAdmin } from '../../contexts/AdminContext';

const PAGE_SIZE = 30;

const INITIAL_OVERVIEW: AnalyticsOverview = {
  total_events: 0,
  unique_visitors: 0,
  page_views: 0,
  apply_clicks: 0,
  whatsapp_clicks: 0,
  contact_submits: 0,
};

export default function AdminAnalyticsPage() {
  const { hasPermission } = useAdmin();
  const [overview, setOverview] = useState<AnalyticsOverview>(INITIAL_OVERVIEW);
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
        adminApi.getAnalyticsEvents({ page, limit: PAGE_SIZE, eventName: eventName || undefined, pagePath: pagePath || undefined }),
      ]);
      setOverview(overviewResult.overview);
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

      <div className="rounded-lg border border-stone-200 bg-white overflow-x-auto">
        {loading ? (
          <div className="p-6 text-stone-500">Loading analytics...</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-stone-200 text-stone-500">
                <th className="py-3 px-4 text-left">Time</th>
                <th className="py-3 px-4 text-left">Event</th>
                <th className="py-3 px-4 text-left">Path</th>
                <th className="py-3 px-4 text-left">IP</th>
                <th className="py-3 px-4 text-left">Location</th>
              </tr>
            </thead>
            <tbody>
              {events.map((item) => (
                <tr key={item.id} className="border-b border-stone-100">
                  <td className="py-3 px-4 text-stone-500">{new Date(item.created_at).toLocaleString()}</td>
                  <td className="py-3 px-4 font-medium text-[#2c2c2c]">{item.event_name}</td>
                  <td className="py-3 px-4 text-stone-600">{item.page_path || '-'}</td>
                  <td className="py-3 px-4 text-stone-600">{item.viewer_ip || '-'}</td>
                  <td className="py-3 px-4 text-stone-600">{item.location_label || 'Unknown'}</td>
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
