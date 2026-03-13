import { useState, useEffect, useCallback } from 'react';
import { ChevronUp, ChevronDown } from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import { adminApi, Designer } from '../../lib/adminApi';
import { useAdmin } from '../../contexts/AdminContext';

type StatusFilter = 'all' | 'pending' | 'approved' | 'rejected';

export default function AdminDesignersPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { hasPermission } = useAdmin();
  const [designers, setDesigners] = useState<Designer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(() => Math.max(1, Number(searchParams.get('page') || '1')));
  const [statusFilter, setStatusFilter] = useState<StatusFilter>(() => {
    const status = searchParams.get('status');
    return status === 'pending' || status === 'approved' || status === 'rejected' ? status : 'all';
  });
  const [search, setSearch] = useState(() => searchParams.get('search') || '');
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [rejectModal, setRejectModal] = useState<{ id: number; name: string } | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [viewMode, setViewMode] = useState<'list' | 'sort'>(() => searchParams.get('view') === 'sort' ? 'sort' : 'list');
  const [sortOrder, setSortOrder] = useState<{ id: number; displayOrder: number }[]>([]);
  const [pageError, setPageError] = useState<string | null>(null);

  const canApprove = hasPermission('can_approve');
  const canSort = hasPermission('can_sort');

  const loadDesigners = useCallback(async () => {
    setIsLoading(true);
    setPageError(null);
    try {
      const result = await adminApi.getDesigners({
        status: statusFilter === 'all' ? undefined : statusFilter,
        search: search || undefined,
        page,
        limit: 20,
        sortBy: viewMode === 'sort' ? 'display_order' : 'created_at',
        sortOrder: 'DESC',
      });
      setDesigners(result.designers);
      setTotal(result.pagination.total);
      
      if (viewMode === 'sort') {
        setSortOrder(result.designers.map((d: Designer, index: number) => ({
          id: d.id,
          displayOrder: d.display_order || index,
        })));
      }
    } catch (error: any) {
      console.error('Error loading designers:', error);
      setPageError(error.message || 'Failed to load designers.');
    } finally {
      setIsLoading(false);
    }
  }, [statusFilter, search, page, viewMode]);

  useEffect(() => {
    loadDesigners();
  }, [loadDesigners]);

  // Reset selection when filters change
  useEffect(() => {
    setSelectedIds([]);
  }, [statusFilter, search, page]);

  useEffect(() => {
    if (!canSort && viewMode === 'sort') {
      setViewMode('list');
    }
  }, [canSort, viewMode]);

  useEffect(() => {
    const next = new URLSearchParams();
    if (statusFilter !== 'all') next.set('status', statusFilter);
    if (search) next.set('search', search);
    if (page > 1) next.set('page', String(page));
    if (viewMode === 'sort') next.set('view', 'sort');
    setSearchParams(next, { replace: true });
  }, [statusFilter, search, page, viewMode, setSearchParams]);

  const handleSelectAll = () => {
    if (selectedIds.length === designers.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(designers.map(d => d.id));
    }
  };

  const handleSelect = (id: number) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const handleApprove = async (id: number) => {
    try {
      await adminApi.approveDesigner(id);
      await loadDesigners();
    } catch (error: any) {
      setPageError(error.message);
    }
  };

  const handleReject = async () => {
    if (!rejectModal) return;
    
    if (!rejectReason.trim()) {
      setPageError('Please provide a rejection reason');
      return;
    }

    setIsSubmitting(true);
    try {
      await adminApi.rejectDesigner(rejectModal.id, rejectReason);
      setRejectModal(null);
      setRejectReason('');
      await loadDesigners();
    } catch (error: any) {
      setPageError(error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleBulkApprove = async () => {
    if (selectedIds.length === 0) return;

    if (!confirm(`Approve ${selectedIds.length} designer(s)?`)) return;

    setIsSubmitting(true);
    try {
      await adminApi.bulkApproveDesigners(selectedIds);
      setSelectedIds([]);
      await loadDesigners();
    } catch (error: any) {
      setPageError(error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSaveOrder = async () => {
    setIsSubmitting(true);
    try {
      await adminApi.updateDesignerOrder(sortOrder);
      await loadDesigners();
    } catch (error: any) {
      setPageError(error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const moveDesignerUp = (index: number) => {
    if (index === 0) return;
    const newOrder = [...sortOrder];
    [newOrder[index - 1], newOrder[index]] = [newOrder[index], newOrder[index - 1]];
    // Update displayOrder values
    newOrder.forEach((item, i) => {
      item.displayOrder = newOrder.length - i;
    });
    setSortOrder(newOrder);
  };

  const moveDesignerDown = (index: number) => {
    if (index === sortOrder.length - 1) return;
    const newOrder = [...sortOrder];
    [newOrder[index], newOrder[index + 1]] = [newOrder[index + 1], newOrder[index]];
    // Update displayOrder values
    newOrder.forEach((item, i) => {
      item.displayOrder = newOrder.length - i;
    });
    setSortOrder(newOrder);
  };

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      pending: 'bg-yellow-100 text-yellow-700',
      approved: 'bg-green-100 text-green-700',
      rejected: 'bg-red-100 text-red-700',
    };
    return (
      <span className={`px-2.5 py-1 text-xs font-medium rounded-full ${styles[status]}`}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    );
  };

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-[#2c2c2c]">Designer Management</h1>
        <div className="flex gap-2">
          <button
            onClick={() => setViewMode('list')}
            className={`px-4 py-2 text-sm rounded-lg transition-colors ${
              viewMode === 'list'
                ? 'bg-[#b8864a] text-white'
                : 'bg-white border border-stone-200 text-stone-600 hover:bg-stone-50'
            }`}
          >
            List View
          </button>
          {canSort && (
            <button
              onClick={() => setViewMode('sort')}
              className={`px-4 py-2 text-sm rounded-lg transition-colors ${
                viewMode === 'sort'
                  ? 'bg-[#b8864a] text-white'
                  : 'bg-white border border-stone-200 text-stone-600 hover:bg-stone-50'
              }`}
            >
              Sort Order
            </button>
          )}
        </div>
      </div>

      {pageError && (
        <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {pageError}
        </div>
      )}

      {/* Filters */}
      <div className="bg-white p-4 rounded-lg border border-stone-200 mb-6">
        <div className="flex flex-wrap gap-4 items-center">
          {/* Status filter */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-stone-500">Status:</span>
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value as StatusFilter);
                setPage(1);
              }}
              className="px-3 py-2 border border-stone-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#b8864a]/40 focus:border-[#b8864a]"
            >
              <option value="all">All</option>
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
            </select>
          </div>

          {/* Search */}
          <div className="flex-1 min-w-[200px]">
            <input
              type="text"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Search by name, email, or city..."
              className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#b8864a]/40 focus:border-[#b8864a]"
            />
          </div>

          {/* Bulk actions */}
          {canApprove && selectedIds.length > 0 && viewMode === 'list' && (
            <button
              onClick={handleBulkApprove}
              disabled={isSubmitting}
              className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700 disabled:opacity-50"
            >
              Approve Selected ({selectedIds.length})
            </button>
          )}
        </div>
      </div>

      {/* Sort Mode */}
      {viewMode === 'sort' && canSort && (
        <div className="mb-4">
          <p className="text-sm text-stone-500 mb-2">
            Drag or use arrows to change the display order. Higher positions appear first on the homepage.
          </p>
          <button
            onClick={handleSaveOrder}
            disabled={isSubmitting}
            className="px-4 py-2 bg-[#b8864a] text-white rounded-lg text-sm hover:bg-[#a67c47] disabled:opacity-50"
          >
            Save Order
          </button>
        </div>
      )}

      {/* Results count */}
      <div className="text-sm text-stone-500 mb-4">
        {total} designer{total !== 1 ? 's' : ''} found
      </div>

      {/* Designer List */}
      {isLoading ? (
        <div className="text-center py-12 text-stone-500">Loading...</div>
      ) : designers.length === 0 ? (
        <div className="bg-white rounded-lg border border-stone-200 p-12 text-center">
          <p className="text-stone-500">No designers found</p>
        </div>
      ) : viewMode === 'list' || !canSort ? (
        <div className="bg-white rounded-lg border border-stone-200 overflow-hidden">
          <table className="w-full">
            <thead className="bg-stone-50">
              <tr>
                {canApprove && (
                  <th className="w-12 px-4 py-3">
                    <input
                      type="checkbox"
                      checked={selectedIds.length === designers.length && designers.length > 0}
                      onChange={handleSelectAll}
                      className="w-4 h-4 rounded border-stone-300 text-[#b8864a] focus:ring-[#b8864a]"
                    />
                  </th>
                )}
                <th className="text-left py-3 px-4 text-sm font-medium text-stone-500">Designer</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-stone-500">Contact</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-stone-500">Status</th>
                <th className="text-right py-3 px-4 text-sm font-medium text-stone-500">Views</th>
                <th className="text-right py-3 px-4 text-sm font-medium text-stone-500">Projects</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-stone-500">Registered</th>
                <th className="text-right py-3 px-4 text-sm font-medium text-stone-500">Actions</th>
              </tr>
            </thead>
            <tbody>
              {designers.map((designer) => (
                <tr key={designer.id} className="border-t border-stone-100 hover:bg-stone-50">
                  {canApprove && (
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(designer.id)}
                        onChange={() => handleSelect(designer.id)}
                        className="w-4 h-4 rounded border-stone-300 text-[#b8864a] focus:ring-[#b8864a]"
                      />
                    </td>
                  )}
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-3">
                      {designer.avatar_url ? (
                        <img
                          src={designer.avatar_url}
                          alt=""
                          className="w-10 h-10 rounded-full object-cover"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-stone-200 flex items-center justify-center">
                          <span className="text-stone-500">
                            {designer.full_name.charAt(0).toUpperCase()}
                          </span>
                        </div>
                      )}
                      <div>
                        <Link to={`/admin/designers/${designer.id}`} className="font-medium text-[#2c2c2c] hover:text-[#b8864a]">
                          {designer.full_name}
                        </Link>
                        <p className="text-sm text-stone-500">{designer.city || 'No city'}</p>
                      </div>
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    <p className="text-sm text-[#2c2c2c]">{designer.email}</p>
                    <p className="text-sm text-stone-500">{designer.phone || 'No phone'}</p>
                  </td>
                  <td className="py-3 px-4">{getStatusBadge(designer.status)}</td>
                  <td className="py-3 px-4 text-right text-sm">
                    {designer.total_profile_views || 0}
                  </td>
                  <td className="py-3 px-4 text-right text-sm">
                    {designer.project_count || 0}
                  </td>
                  <td className="py-3 px-4 text-sm text-stone-500">
                    {new Date(designer.created_at).toLocaleDateString()}
                  </td>
                  <td className="py-3 px-4 text-right">
                    {canApprove && designer.status === 'pending' && (
                      <div className="flex gap-2 justify-end">
                        <button
                          onClick={() => handleApprove(designer.id)}
                          className="px-3 py-1.5 bg-green-600 text-white text-sm rounded hover:bg-green-700"
                        >
                          Approve
                        </button>
                        <button
                          onClick={() => setRejectModal({ id: designer.id, name: designer.full_name })}
                          className="px-3 py-1.5 bg-red-600 text-white text-sm rounded hover:bg-red-700"
                        >
                          Reject
                        </button>
                      </div>
                    )}
                    {designer.status === 'rejected' && designer.rejection_reason && (
                      <span className="text-xs text-red-600" title={designer.rejection_reason}>
                        Rejected: {designer.rejection_reason.substring(0, 30)}...
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        /* Sort Mode */
        <div className="space-y-2">
          {sortOrder.map((item, index) => {
            const designer = designers.find((entry) => entry.id === item.id);
            if (!designer) return null;

            return (
            <div
              key={designer.id}
              className="bg-white rounded-lg border border-stone-200 p-4 flex items-center gap-4"
            >
              <div className="flex flex-col gap-1">
                <button
                  type="button"
                  onClick={() => moveDesignerUp(index)}
                  disabled={index === 0}
                  className="w-6 h-6 flex items-center justify-center text-stone-400 hover:text-stone-600 disabled:opacity-30"
                  aria-label="Move up"
                >
                  <ChevronUp className="w-5 h-5" />
                </button>
                <button
                  type="button"
                  onClick={() => moveDesignerDown(index)}
                  disabled={index === sortOrder.length - 1}
                  className="w-6 h-6 flex items-center justify-center text-stone-400 hover:text-stone-600 disabled:opacity-30"
                  aria-label="Move down"
                >
                  <ChevronDown className="w-5 h-5" />
                </button>
              </div>
              <div className="w-8 text-center text-sm font-medium text-stone-400">
                {index + 1}
              </div>
              {designer.avatar_url ? (
                <img src={designer.avatar_url} alt="" className="w-10 h-10 rounded-full object-cover" />
              ) : (
                <div className="w-10 h-10 rounded-full bg-stone-200 flex items-center justify-center">
                  <span className="text-stone-500">{designer.full_name.charAt(0)}</span>
                </div>
              )}
              <div className="flex-1">
                <Link to={`/admin/designers/${designer.id}`} className="font-medium text-[#2c2c2c] hover:text-[#b8864a]">
                  {designer.full_name}
                </Link>
                <p className="text-sm text-stone-500">{designer.city}</p>
              </div>
              <div className="text-right">
                <p className="text-sm font-medium">{designer.total_profile_views || 0} views</p>
                <p className="text-xs text-stone-500">{designer.project_count || 0} projects</p>
              </div>
            </div>
          );
          })}
          <button
            onClick={handleSaveOrder}
            disabled={isSubmitting}
            className="mt-4 px-6 py-2.5 bg-[#b8864a] text-white rounded-lg font-medium hover:bg-[#a67c47] disabled:opacity-50"
          >
            {isSubmitting ? 'Saving...' : 'Save Display Order'}
          </button>
        </div>
      )}

      {/* Pagination */}
      {total > 20 && viewMode === 'list' && (
        <div className="mt-6 flex justify-center gap-2">
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-4 py-2 border border-stone-200 rounded-lg text-sm disabled:opacity-50"
          >
            Previous
          </button>
          <span className="px-4 py-2 text-sm text-stone-600">
            Page {page} of {Math.ceil(total / 20)}
          </span>
          <button
            onClick={() => setPage(p => p + 1)}
            disabled={page >= Math.ceil(total / 20)}
            className="px-4 py-2 bg-white border border-stone-200 rounded-lg text-sm hover:bg-stone-50 disabled:opacity-50"
          >
            Next
          </button>
        </div>
      )}

      {/* Reject Modal */}
      {rejectModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold text-[#2c2c2c] mb-2">
              Reject Designer
            </h3>
            <p className="text-sm text-stone-600 mb-4">
              Rejecting: <strong>{rejectModal.name}</strong>
            </p>
            <div className="mb-4">
              <label className="block text-sm font-medium text-stone-700 mb-1">
                Rejection Reason *
              </label>
              <textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                rows={3}
                className="w-full px-3 py-2.5 border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#b8864a]/40 focus:border-[#b8864a]"
                placeholder="Please explain why this designer is being rejected..."
              />
            </div>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => {
                  setRejectModal(null);
                  setRejectReason('');
                }}
                className="px-4 py-2 text-stone-600 hover:text-[#2c2c2c]"
              >
                Cancel
              </button>
              <button
                onClick={handleReject}
                disabled={isSubmitting || !rejectReason.trim()}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
              >
                {isSubmitting ? 'Rejecting...' : 'Reject Designer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
