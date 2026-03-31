import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { adminApi } from '../../lib/adminApi';

type StatusFilter = 'all' | 'new' | 'contacted' | 'resolved' | 'archived';

interface InquiryRecord {
  id: number;
  name: string;
  phone: string;
  city: string;
  area_range: string;
  message: string | null;
  designer_id: number | null;
  company_id: number | null;
  designer_name: string | null;
  company_name: string | null;
  status: 'new' | 'contacted' | 'resolved' | 'archived';
  admin_notes: string | null;
  created_at: string;
}

const STATUS_BADGE: Record<string, string> = {
  new: 'bg-blue-100 text-blue-700',
  contacted: 'bg-amber-100 text-amber-700',
  resolved: 'bg-green-100 text-green-700',
  archived: 'bg-stone-100 text-stone-500',
};

export default function AdminInquiriesPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [inquiries, setInquiries] = useState<InquiryRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(() => Math.max(1, Number(searchParams.get('page') || '1')));
  const [statusFilter, setStatusFilter] = useState<StatusFilter>(() => {
    const s = searchParams.get('status');
    return s === 'new' || s === 'contacted' || s === 'resolved' || s === 'archived' ? s : 'all';
  });
  const [search, setSearch] = useState(() => searchParams.get('search') || '');
  const [error, setError] = useState('');

  // Expanded detail
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [editNotes, setEditNotes] = useState('');
  const [editStatus, setEditStatus] = useState('');
  const [updating, setUpdating] = useState(false);

  const loadInquiries = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const result = await adminApi.getInquiries({
        page, limit: 20,
        status: statusFilter === 'all' ? undefined : statusFilter,
        search: search || undefined,
      });
      setInquiries(result.inquiries);
      setTotal(result.pagination.total);
    } catch (err: any) {
      setError(err.message || 'Failed to load inquiries.');
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter, search]);

  useEffect(() => { loadInquiries(); }, [loadInquiries]);

  useEffect(() => {
    const params: Record<string, string> = {};
    if (page > 1) params.page = String(page);
    if (statusFilter !== 'all') params.status = statusFilter;
    if (search) params.search = search;
    setSearchParams(params, { replace: true });
  }, [page, statusFilter, search, setSearchParams]);

  const totalPages = Math.ceil(total / 20);

  const handleExpand = (inquiry: InquiryRecord) => {
    if (expandedId === inquiry.id) {
      setExpandedId(null);
    } else {
      setExpandedId(inquiry.id);
      setEditNotes(inquiry.admin_notes || '');
      setEditStatus(inquiry.status);
    }
  };

  const handleUpdate = async (id: number) => {
    setUpdating(true);
    try {
      await adminApi.updateInquiryStatus(id, editStatus, editNotes);
      setExpandedId(null);
      loadInquiries();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setUpdating(false);
    }
  };

  const handleExport = () => {
    const url = adminApi.getInquiriesExportUrl({
      status: statusFilter === 'all' ? undefined : statusFilter,
    });
    window.open(url, '_blank');
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-stone-800">Inquiries</h1>
        <button
          onClick={handleExport}
          className="px-4 py-2 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 transition"
        >
          Export Excel
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-end">
        <div>
          <label className="block text-xs font-medium text-stone-500 mb-1">Status</label>
          <select
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value as StatusFilter); setPage(1); }}
            className="h-9 px-3 border border-stone-200 rounded-lg text-sm bg-white"
          >
            <option value="all">All Status</option>
            <option value="new">New</option>
            <option value="contacted">Contacted</option>
            <option value="resolved">Resolved</option>
            <option value="archived">Archived</option>
          </select>
        </div>
        <div className="flex-1 min-w-[200px]">
          <label className="block text-xs font-medium text-stone-500 mb-1">Search</label>
          <input
            type="text" value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder="Name or phone..."
            className="h-9 w-full px-3 border border-stone-200 rounded-lg text-sm bg-white"
          />
        </div>
      </div>

      {error && <div className="text-red-600 bg-red-50 px-4 py-2 rounded-lg text-sm">{error}</div>}

      {/* Table */}
      <div className="bg-white rounded-xl border border-stone-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-stone-50 border-b border-stone-200">
                <th className="text-left px-4 py-3 font-medium text-stone-600">Name</th>
                <th className="text-left px-4 py-3 font-medium text-stone-600">Phone</th>
                <th className="text-left px-4 py-3 font-medium text-stone-600">City</th>
                <th className="text-left px-4 py-3 font-medium text-stone-600">Area</th>
                <th className="text-left px-4 py-3 font-medium text-stone-600">For</th>
                <th className="text-left px-4 py-3 font-medium text-stone-600">Status</th>
                <th className="text-left px-4 py-3 font-medium text-stone-600">Date</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} className="text-center py-12 text-stone-400">Loading...</td></tr>
              ) : inquiries.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-12 text-stone-400">No inquiries found</td></tr>
              ) : inquiries.map((inq) => (
                <>
                  <tr
                    key={inq.id}
                    className={`border-b border-stone-100 hover:bg-stone-50 cursor-pointer transition ${expandedId === inq.id ? 'bg-stone-50' : ''}`}
                    onClick={() => handleExpand(inq)}
                  >
                    <td className="px-4 py-3 font-medium text-stone-800">{inq.name}</td>
                    <td className="px-4 py-3 text-stone-600">{inq.phone}</td>
                    <td className="px-4 py-3 text-stone-600">{inq.city}</td>
                    <td className="px-4 py-3 text-stone-600">{inq.area_range}</td>
                    <td className="px-4 py-3 text-stone-500 text-xs">
                      {inq.designer_name || inq.company_name || '—'}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_BADGE[inq.status]}`}>
                        {inq.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-stone-500 text-xs">
                      {new Date(inq.created_at).toLocaleDateString()}
                    </td>
                  </tr>
                  {expandedId === inq.id && (
                    <tr key={`${inq.id}-detail`} className="bg-stone-50">
                      <td colSpan={7} className="px-4 py-4">
                        <div className="space-y-3 max-w-2xl">
                          {inq.message && (
                            <div>
                              <span className="text-xs font-medium text-stone-500">Message:</span>
                              <p className="text-sm text-stone-700 mt-1">{inq.message}</p>
                            </div>
                          )}
                          <div className="flex gap-4 items-end">
                            <div>
                              <label className="block text-xs font-medium text-stone-500 mb-1">Status</label>
                              <select
                                value={editStatus}
                                onChange={(e) => setEditStatus(e.target.value)}
                                className="h-9 px-3 border border-stone-200 rounded-lg text-sm bg-white"
                              >
                                <option value="new">New</option>
                                <option value="contacted">Contacted</option>
                                <option value="resolved">Resolved</option>
                                <option value="archived">Archived</option>
                              </select>
                            </div>
                            <div className="flex-1">
                              <label className="block text-xs font-medium text-stone-500 mb-1">Admin Notes</label>
                              <input
                                type="text"
                                value={editNotes}
                                onChange={(e) => setEditNotes(e.target.value)}
                                placeholder="Add notes..."
                                className="h-9 w-full px-3 border border-stone-200 rounded-lg text-sm bg-white"
                              />
                            </div>
                            <button
                              onClick={() => handleUpdate(inq.id)}
                              disabled={updating}
                              className="h-9 px-4 bg-[#b8864a] text-white text-sm rounded-lg hover:bg-[#a07840] disabled:opacity-50"
                            >
                              {updating ? '...' : 'Save'}
                            </button>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-stone-100">
            <span className="text-xs text-stone-500">Page {page} of {totalPages} ({total} total)</span>
            <div className="flex gap-2">
              <button onClick={() => setPage(Math.max(1, page - 1))} disabled={page <= 1} className="px-3 py-1 text-xs border rounded-lg hover:bg-stone-50 disabled:opacity-30">Prev</button>
              <button onClick={() => setPage(Math.min(totalPages, page + 1))} disabled={page >= totalPages} className="px-3 py-1 text-xs border rounded-lg hover:bg-stone-50 disabled:opacity-30">Next</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
