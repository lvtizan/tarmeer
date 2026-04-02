import { useEffect, useState } from 'react';
import { adminApi, VisitorRecord } from '../../lib/adminApi';
import { useAdmin } from '../../contexts/AdminContext';

const PAGE_SIZE = 50;

export default function AdminVisitorsPage() {
  const { hasPermission } = useAdmin();
  const [isLoading, setIsLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState<VisitorRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!hasPermission('can_view_stats')) {
      setIsLoading(false);
      return;
    }

    const run = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const result = await adminApi.getVisitors({ page, limit: PAGE_SIZE });
        setRows(result.visitors);
        setTotal(result.pagination.total);
      } catch (err: any) {
        setError(err?.message || 'Failed to load visitor records.');
      } finally {
        setIsLoading(false);
      }
    };

    run();
  }, [hasPermission, page]);

  if (!hasPermission('can_view_stats')) {
    return <div className="text-stone-500">You do not have permission to view visitor statistics.</div>;
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-2">
        <h1 className="text-3xl font-bold text-[#2c2c2c]">Visitor Statistics</h1>
        <a
          href="https://analytics.google.com/analytics/web/#/p488498498/reports/intelligenthome"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-stone-200 text-sm font-medium text-stone-700 hover:border-[#b8864a] hover:text-[#b8864a] transition"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M22.84 2.998v17.958c0 1.68-1.356 3.044-3.03 3.044h-.06c-1.674 0-3.03-1.364-3.03-3.044V2.998c0-1.68 1.356-3.044 3.03-3.044h.06c1.674 0 3.03 1.364 3.03 3.044zm-7.26 8.967v9.013c0 1.674-1.356 3.03-3.03 3.03h-.06c-1.674 0-3.03-1.356-3.03-3.03v-9.013c0-1.674 1.356-3.03 3.03-3.03h.06c1.674 0 3.03 1.356 3.03 3.03zM8.34 20.97a3.03 3.03 0 11-6.06 0 3.03 3.03 0 016.06 0z"/></svg>
          Google Analytics
        </a>
      </div>
      <p className="text-stone-500 text-sm mb-6">Unique visitor IP records and their most recent access location.</p>

      <div className="rounded-lg border border-stone-200 bg-white">
        {isLoading ? (
          <div className="p-6 text-stone-500">Loading visitor records...</div>
        ) : error ? (
          <div className="p-6 text-red-600">{error}</div>
        ) : rows.length === 0 ? (
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
                {rows.map((item, index) => (
                  <tr key={`${item.ip}-${index}`} className="border-b border-stone-100">
                    <td className="py-3 px-4 text-sm text-stone-600">{(page - 1) * PAGE_SIZE + index + 1}</td>
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

      <div className="mt-4 flex items-center justify-between text-sm">
        <div className="text-stone-500">Total unique IPs: {total}</div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setPage((prev) => Math.max(1, prev - 1))}
            disabled={page <= 1 || isLoading}
            className="rounded border border-stone-200 px-3 py-1.5 text-stone-700 disabled:opacity-40"
          >
            Previous
          </button>
          <span className="text-stone-600">{page} / {totalPages}</span>
          <button
            type="button"
            onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
            disabled={page >= totalPages || isLoading}
            className="rounded border border-stone-200 px-3 py-1.5 text-stone-700 disabled:opacity-40"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}
