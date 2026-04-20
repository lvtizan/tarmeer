import { useState, useEffect, useCallback } from 'react';
import { ChevronUp, ChevronDown, Trash2 } from 'lucide-react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { adminApi, Designer } from '../../lib/adminApi';
import { useAdmin } from '../../contexts/AdminContext';
import { resolveImageUrl } from '../../lib/imageUrl';
import AdminSelect from '../../components/ui/AdminSelect';
import { formatCount } from '../../lib/formatNumber';
import { PageSpinner } from '../../components/ui/Spinner';
import { useAdminT } from '../../hooks/useAdminLang';

type StatusFilter = 'all' | 'pending' | 'approved' | 'rejected';
type DeletedFilter = 'active' | 'deleted' | 'all';
type NumericSortKey = 'total_profile_views' | 'project_count';
type NumericSortDirection = 'asc' | 'desc';

export default function AdminDesignersPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { hasPermission } = useAdmin();
  const { t } = useAdminT();
  const [designers, setDesigners] = useState<Designer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(() => Math.max(1, Number(searchParams.get('page') || '1')));
  const [statusFilter, setStatusFilter] = useState<StatusFilter>(() => {
    const status = searchParams.get('status');
    return status === 'pending' || status === 'approved' || status === 'rejected' ? status : 'all';
  });
  const [search, _setSearch] = useState(() => searchParams.get('search') || '');
  const [deletedFilter, setDeletedFilter] = useState<DeletedFilter>(() => {
    const deleted = searchParams.get('deleted');
    return deleted === 'deleted' || deleted === 'all' ? deleted : 'active';
  });
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [rejectModal, setRejectModal] = useState<{ id: number; name: string } | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [deleteModal, setDeleteModal] = useState<{ id: number; name: string } | null>(null);
  const [bulkDeleteModalOpen, setBulkDeleteModalOpen] = useState(false);
  const [deleteReason, setDeleteReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [viewMode, setViewMode] = useState<'list' | 'sort'>(() => searchParams.get('view') === 'sort' ? 'sort' : 'list');
  const [sortOrder, setSortOrder] = useState<{ id: number; displayOrder: number }[]>([]);
  const [numericSort, setNumericSort] = useState<{ key: NumericSortKey; direction: NumericSortDirection } | null>(null);
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
        deleted: deletedFilter,
        page,
        limit: 20,
        sortBy: viewMode === 'sort' ? 'display_order' : 'created_at',
        sortOrder: 'DESC',
      });
      setDesigners(result.designers);
      setTotal(result.pagination.total);
      
      if (viewMode === 'sort') {
        const totalCount = result.designers.length;
        setSortOrder(result.designers.map((d: Designer, index: number) => ({
          id: d.id,
          displayOrder: typeof d.display_order === 'number' && d.display_order > 0
            ? d.display_order
            : totalCount - index,
        })));
      }
    } catch (error: any) {
      console.error('Error loading designers:', error);
      setPageError(error.message || 'Failed to load designers.');
    } finally {
      setIsLoading(false);
    }
  }, [statusFilter, search, deletedFilter, page, viewMode]);

  useEffect(() => {
    loadDesigners();
  }, [loadDesigners]);

  // Reset selection when filters change
  useEffect(() => {
    setSelectedIds([]);
  }, [statusFilter, search, deletedFilter, page]);

  useEffect(() => {
    if (!canSort && viewMode === 'sort') {
      setViewMode('list');
    }
  }, [canSort, viewMode]);

  useEffect(() => {
    if (deletedFilter !== 'active' && viewMode === 'sort') {
      setViewMode('list');
    }
  }, [deletedFilter, viewMode]);

  useEffect(() => {
    // Preserve params this component doesn't own (e.g. "tab" set by parent page)
    const next = new URLSearchParams(searchParams);
    // Clear own params before re-setting
    next.delete('status');
    next.delete('search');
    next.delete('deleted');
    next.delete('page');
    next.delete('view');
    if (statusFilter !== 'all') next.set('status', statusFilter);
    if (search) next.set('search', search);
    if (deletedFilter !== 'active') next.set('deleted', deletedFilter);
    if (page > 1) next.set('page', String(page));
    if (viewMode === 'sort') next.set('view', 'sort');
    setSearchParams(next, { replace: true });
  }, [statusFilter, search, deletedFilter, page, viewMode, setSearchParams]);

  const selectableDesigners = designers.filter((designer) => !designer.deleted_at);
  const listDesigners = (() => {
    if (!numericSort) return designers;
    const sorted = [...designers];
    const { key, direction } = numericSort;
    sorted.sort((a, b) => {
      const av = Number(a[key] ?? 0);
      const bv = Number(b[key] ?? 0);
      if (av !== bv) return direction === 'asc' ? av - bv : bv - av;
      return Number(b.id) - Number(a.id);
    });
    return sorted;
  })();
  const selectedPendingIds = selectedIds.filter((id) => {
    const designer = designers.find((item) => item.id === id);
    return Boolean(designer && !designer.deleted_at && designer.status === 'pending');
  });

  const handleSelectAll = () => {
    if (selectedIds.length === selectableDesigners.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(selectableDesigners.map(d => d.id));
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

  const handleDelete = async () => {
    if (!deleteModal) return;

    if (!deleteReason.trim()) {
      setPageError('Please provide a delete reason');
      return;
    }

    setIsSubmitting(true);
    try {
      await adminApi.deleteDesigner(deleteModal.id, deleteReason);
      setDeleteModal(null);
      setDeleteReason('');
      setSelectedIds((prev) => prev.filter((id) => id !== deleteModal.id));
      await loadDesigners();
    } catch (error: any) {
      setPageError(error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRestore = async (id: number) => {
    setIsSubmitting(true);
    try {
      await adminApi.restoreDesigner(id);
      await loadDesigners();
    } catch (error: any) {
      setPageError(error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleBulkApprove = async () => {
    if (selectedPendingIds.length === 0) return;

    if (!confirm(`Approve ${selectedPendingIds.length} designer(s)?`)) return;

    setIsSubmitting(true);
    try {
      await adminApi.bulkApproveDesigners(selectedPendingIds);
      setSelectedIds((prev) => prev.filter((id) => !selectedPendingIds.includes(id)));
      await loadDesigners();
    } catch (error: any) {
      setPageError(error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    if (!deleteReason.trim()) {
      setPageError('Please provide a delete reason');
      return;
    }

    setIsSubmitting(true);
    try {
      await adminApi.bulkDeleteDesigners(selectedIds, deleteReason.trim());
      setBulkDeleteModalOpen(false);
      setDeleteReason('');
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

  const handleDisplayOrderChange = (id: number, rawValue: string) => {
    const parsed = Number(rawValue);
    const safeValue = Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 1;
    setSortOrder((prev) => prev.map((item) => (
      item.id === id ? { ...item, displayOrder: safeValue } : item
    )));
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

  const getLifecycleBadge = (designer: Designer) => {
    if (designer.deleted_at) {
      return (
        <span className="px-2.5 py-1 text-xs font-medium rounded-full bg-stone-200 text-stone-700">
          {t('Deleted', '已删除')}
        </span>
      );
    }

    return getStatusBadge(designer.status);
  };

  const toggleNumericSort = (key: NumericSortKey) => {
    setNumericSort((prev) => {
      if (!prev || prev.key !== key) {
        return { key, direction: 'desc' };
      }
      return { key, direction: prev.direction === 'desc' ? 'asc' : 'desc' };
    });
  };

  const getNumericSortIcon = (key: NumericSortKey) => {
    if (!numericSort || numericSort.key !== key) {
      return <ChevronDown className="h-3.5 w-3.5 text-stone-300" />;
    }
    if (numericSort.direction === 'asc') {
      return <ChevronUp className="h-3.5 w-3.5 text-[#b8864a]" />;
    }
    return <ChevronDown className="h-3.5 w-3.5 text-[#b8864a]" />;
  };

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-[#2c2c2c]">{t('Designer Management', '设计师管理')}</h1>
        <div className="flex gap-2">
          <button
            onClick={() => setViewMode('list')}
            className={`px-4 py-2 text-sm rounded-lg transition-colors ${
              viewMode === 'list'
                ? 'bg-[#b8864a] text-white'
                : 'bg-white border border-stone-200 text-stone-600 hover:bg-stone-50'
            }`}
          >
            {t('List View', '列表视图')}
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
              {t('Sort Order', '排序')}
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
      <div className="flex flex-wrap gap-3 items-center mb-6">
        <AdminSelect
          className="!h-9 !px-3 !text-sm"
          value={statusFilter}
          onChange={(val) => { setStatusFilter(val as StatusFilter); setPage(1); }}
          options={[
            { value: 'all', label: t('All Status', '全部状态') },
            { value: 'pending', label: t('Pending', '待审核') },
            { value: 'approved', label: t('Approved', '已通过') },
            { value: 'rejected', label: t('Rejected', '已拒绝') },
          ]}
        />
        <AdminSelect
          className="!h-9 !px-3 !text-sm"
          value={deletedFilter}
          onChange={(val) => { setDeletedFilter(val as DeletedFilter); setPage(1); }}
          options={[
            { value: 'active', label: t('Active', '活跃') },
            { value: 'deleted', label: t('Deleted', '已删除') },
            { value: 'all', label: t('All', '全部') },
          ]}
        />
        {/* Search removed — use global search bar */}
      </div>

      {/* Batch action bar */}
      {canApprove && selectedIds.length > 0 && viewMode === 'list' && (
        <div className="flex items-center gap-3 bg-white border border-stone-200 rounded-2xl px-4 h-11 mb-6">
          <span className="text-sm text-stone-500">{selectedIds.length} {t('selected', '已选')}</span>
          <button
            onClick={handleBulkApprove}
            disabled={isSubmitting || selectedPendingIds.length === 0}
            className="h-8 px-4 text-sm text-white bg-green-600 rounded-xl hover:bg-green-700 transition disabled:opacity-50"
          >
            {t('Approve', '批准')} ({selectedPendingIds.length})
          </button>
          <button
            onClick={() => setBulkDeleteModalOpen(true)}
            disabled={isSubmitting}
            className="flex items-center gap-1.5 h-8 px-3 rounded-xl border border-red-200 bg-white text-red-600 text-sm font-medium hover:bg-red-50 transition disabled:opacity-50"
          >
            <Trash2 size={14} /> {t('Delete', '删除')} ({selectedIds.length})
          </button>
        </div>
      )}

      {/* Sort Mode */}
      {viewMode === 'sort' && canSort && deletedFilter === 'active' && (
        <div className="mb-4">
          <p className="text-sm text-stone-500 mb-2">
            {t('Drag or use arrows to change the display order. Higher positions appear first on the homepage.', '拖拽或使用箭头调整展示顺序。数字越大越靠前。')}
          </p>
          <button
            onClick={handleSaveOrder}
            disabled={isSubmitting}
            className="px-4 py-2 bg-[#b8864a] text-white rounded-lg text-sm hover:bg-[#a67c47] disabled:opacity-50"
          >
            {t('Save Order', '保存排序')}
          </button>
        </div>
      )}

      {/* Results count */}
      <div className="text-sm text-stone-500 mb-4">
        {total} {t('designer', '位设计师')}{total !== 1 ? 's' : ''} {t('found', '')}
      </div>

      {/* Designer List */}
      {isLoading ? (
        <PageSpinner />
      ) : designers.length === 0 ? (
        <div className="bg-white rounded-lg border border-stone-200 p-12 text-center">
          <p className="text-stone-500">{t('No designers found', '暂无设计师')}</p>
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
                      checked={selectableDesigners.length > 0 && selectedIds.length === selectableDesigners.length}
                      onChange={handleSelectAll}
                      className="w-4 h-4 rounded border-stone-300 text-[#b8864a] focus:ring-[#b8864a]"
                    />
                  </th>
                )}
                <th className="text-left py-3 px-4 text-sm font-medium text-stone-500">{t('Designer', '设计师')}</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-stone-500">{t('Contact', '联系方式')}</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-stone-500">{t('Status', '状态')}</th>
                <th className="text-right py-3 px-4 text-sm font-medium text-stone-500">
                  <button
                    type="button"
                    onClick={() => toggleNumericSort('total_profile_views')}
                    className="inline-flex items-center gap-1.5 text-stone-500 hover:text-[#2c2c2c]"
                  >
                    <span>{t('Views', '浏览量')}</span>
                    {getNumericSortIcon('total_profile_views')}
                  </button>
                </th>
                <th className="text-right py-3 px-4 text-sm font-medium text-stone-500">
                  <button
                    type="button"
                    onClick={() => toggleNumericSort('project_count')}
                    className="inline-flex items-center gap-1.5 text-stone-500 hover:text-[#2c2c2c]"
                  >
                    <span>{t('Projects', '项目')}</span>
                    {getNumericSortIcon('project_count')}
                  </button>
                </th>
                <th className="text-left py-3 px-4 text-sm font-medium text-stone-500">{t('Registered', '注册时间')}</th>
                <th className="text-right py-3 px-4 text-sm font-medium text-stone-500">{t('Actions', '操作')}</th>
              </tr>
            </thead>
            <tbody>
              {listDesigners.map((designer) => (
                <tr
                  key={designer.id}
                  className="border-t border-stone-100 hover:bg-stone-50 cursor-pointer"
                  onClick={() => navigate(`/admin/designers/${designer.id}`)}
                >
                  {canApprove && (
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(designer.id)}
                        onChange={() => handleSelect(designer.id)}
                        onClick={(event) => event.stopPropagation()}
                        disabled={designer.deleted_at !== null && designer.deleted_at !== undefined}
                        className="w-4 h-4 rounded border-stone-300 text-[#b8864a] focus:ring-[#b8864a]"
                      />
                    </td>
                  )}
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-3">
                      {resolveImageUrl(designer.avatar_url) ? (
                        <img
                          src={resolveImageUrl(designer.avatar_url)}
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
                        <p className="text-sm text-stone-500">{designer.city || t('No city', '无城市')}</p>
                      </div>
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    <p className="text-sm text-[#2c2c2c]">{designer.email}</p>
                    <p className="text-sm text-stone-500">{designer.phone || t('No phone', '无电话')}</p>
                  </td>
                  <td className="py-3 px-4">{getLifecycleBadge(designer)}</td>
                  <td className="py-3 px-4 text-right text-sm">
                    {formatCount(designer.total_profile_views)}
                  </td>
                  <td className="py-3 px-4 text-right text-sm">
                    {formatCount(designer.project_count)}
                  </td>
                  <td className="py-3 px-4 text-sm text-stone-500">
                    {new Date(designer.created_at).toLocaleDateString()}
                  </td>
                  <td className="py-3 px-4 text-right">
                    <div className="flex flex-col items-end gap-2" onClick={(event) => event.stopPropagation()}>
                      <Link
                        to={`/admin/designers/${designer.id}`}
                        className="inline-flex h-9 items-center rounded-lg border border-[#b8864a]/35 px-3 text-sm font-semibold text-[#b8864a] hover:bg-[#b8864a]/10 hover:text-[#a67c47]"
                      >
                        {t('View details', '查看详情')}
                      </Link>
                    {canApprove && !designer.deleted_at && designer.status === 'pending' && (
                      <div className="flex max-w-[220px] flex-wrap justify-end gap-2">
                        <button
                          onClick={() => handleApprove(designer.id)}
                          className="px-3 py-1.5 bg-green-600 text-white text-sm rounded hover:bg-green-700"
                        >
                          {t('Approve', '通过')}
                        </button>
                        <button
                          onClick={() => setRejectModal({ id: designer.id, name: designer.full_name })}
                          className="px-3 py-1.5 bg-red-600 text-white text-sm rounded hover:bg-red-700"
                        >
                          {t('Reject', '拒绝')}
                        </button>
                      </div>
                    )}
                    {canApprove && designer.deleted_at && (
                      <button
                        onClick={() => handleRestore(designer.id)}
                        disabled={isSubmitting}
                        className="px-3 py-1.5 bg-stone-700 text-white text-sm rounded hover:bg-stone-800 disabled:opacity-50"
                      >
                        {t('Restore', '恢复')}
                      </button>
                    )}
                    {canApprove && !designer.deleted_at && (
                      <button
                        onClick={() => setDeleteModal({ id: designer.id, name: designer.full_name })}
                        disabled={isSubmitting}
                        className="px-3 py-1.5 bg-stone-700 text-white text-sm rounded hover:bg-stone-800 disabled:opacity-50"
                      >
                        {t('Delete', '删除')}
                      </button>
                    )}
                    {designer.status === 'rejected' && designer.rejection_reason && (
                      <span className="block max-w-[220px] truncate text-right text-xs text-red-600 md:max-w-[320px] xl:max-w-[440px]" title={designer.rejection_reason}>
                        {t('Rejected', '已拒绝')}: {designer.rejection_reason}
                      </span>
                    )}
                    {designer.deleted_at && designer.delete_reason && (
                      <span className="block max-w-[220px] truncate text-right text-xs text-stone-500 md:max-w-[320px] xl:max-w-[440px]" title={designer.delete_reason}>
                        {t('Delete reason', '删除原因')}: {designer.delete_reason}
                      </span>
                    )}
                    </div>
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
              <div className="w-20">
                <label className="block text-[10px] text-stone-500 mb-1">{t('Order', '排序')}</label>
                <input
                  type="number"
                  min={1}
                  value={item.displayOrder}
                  onChange={(event) => handleDisplayOrderChange(item.id, event.target.value)}
                  className="w-full h-8 rounded border border-stone-200 px-2 text-xs text-stone-700 focus:outline-none focus:ring-2 focus:ring-[#b8864a]/35 focus:border-[#b8864a]"
                />
              </div>
              {resolveImageUrl(designer.avatar_url) ? (
                <img src={resolveImageUrl(designer.avatar_url)} alt="" className="w-10 h-10 rounded-full object-cover" />
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
                <p className="text-sm font-medium">{formatCount(designer.total_profile_views)} {t('views', '浏览')}</p>
                <p className="text-xs text-stone-500">{formatCount(designer.project_count)} {t('projects', '项目')}</p>
              </div>
            </div>
          );
          })}
          <button
            onClick={handleSaveOrder}
            disabled={isSubmitting}
            className="mt-4 px-6 py-2.5 bg-[#b8864a] text-white rounded-lg font-medium hover:bg-[#a67c47] disabled:opacity-50"
          >
            {isSubmitting ? t('Saving...', '保存中...') : t('Save Display Order', '保存展示顺序')}
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
            {t('Previous', '上一页')}
          </button>
          <span className="px-4 py-2 text-sm text-stone-600">
            {t('Page', '第')} {page} {t('of', '/')} {Math.ceil(total / 20)}
          </span>
          <button
            onClick={() => setPage(p => p + 1)}
            disabled={page >= Math.ceil(total / 20)}
            className="px-4 py-2 bg-white border border-stone-200 rounded-lg text-sm hover:bg-stone-50 disabled:opacity-50"
          >
            {t('Next', '下一页')}
          </button>
        </div>
      )}

      {/* Reject Modal */}
      {rejectModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold text-[#2c2c2c] mb-2">
              {t('Reject Designer', '拒绝设计师')}
            </h3>
            <p className="text-sm text-stone-600 mb-4">
              {t('Rejecting', '正在拒绝')}: <strong>{rejectModal.name}</strong>
            </p>
            <div className="mb-4">
              <label className="block text-sm font-medium text-stone-700 mb-1">
                {t('Rejection Reason', '拒绝原因')} *
              </label>
              <textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                rows={3}
                className="w-full px-3 py-2.5 border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#b8864a]/40 focus:border-[#b8864a]"
                placeholder={t('Please explain why this designer is being rejected...', '请说明拒绝该设计师的原因...')}
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
                {t('Cancel', '取消')}
              </button>
              <button
                onClick={handleReject}
                disabled={isSubmitting || !rejectReason.trim()}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
              >
                {isSubmitting ? t('Rejecting...', '拒绝中...') : t('Reject Designer', '拒绝设计师')}
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold text-[#2c2c2c] mb-2">
              {t('Delete Designer', '删除设计师')}
            </h3>
            <p className="text-sm text-stone-600 mb-4">
              {t('Deleting', '正在删除')}: <strong>{deleteModal.name}</strong>
            </p>
            <div className="mb-4">
              <label className="block text-sm font-medium text-stone-700 mb-1">
                {t('Delete Reason', '删除原因')} *
              </label>
              <textarea
                value={deleteReason}
                onChange={(e) => setDeleteReason(e.target.value)}
                rows={3}
                className="w-full px-3 py-2.5 border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#b8864a]/40 focus:border-[#b8864a]"
                placeholder={t('Please explain why this designer is being deleted...', '请说明删除该设计师的原因...')}
              />
            </div>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => {
                  setDeleteModal(null);
                  setDeleteReason('');
                }}
                className="px-4 py-2 text-stone-600 hover:text-[#2c2c2c]"
              >
                {t('Cancel', '取消')}
              </button>
              <button
                onClick={handleDelete}
                disabled={isSubmitting || !deleteReason.trim()}
                className="px-4 py-2 bg-stone-800 text-white rounded-lg hover:bg-black disabled:opacity-50"
              >
                {isSubmitting ? t('Deleting...', '删除中...') : t('Delete Designer', '删除设计师')}
              </button>
            </div>
          </div>
        </div>
      )}

      {bulkDeleteModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold text-[#2c2c2c] mb-2">
              {t('Delete Selected Designers', '删除已选设计师')}
            </h3>
            <p className="text-sm text-stone-600 mb-4">
              {t('You are deleting', '您正在删除')} <strong>{selectedIds.length}</strong> {t('selected designer(s)', '位已选设计师')}.
            </p>
            <div className="mb-4">
              <label className="block text-sm font-medium text-stone-700 mb-1">
                {t('Delete Reason', '删除原因')} *
              </label>
              <textarea
                value={deleteReason}
                onChange={(e) => setDeleteReason(e.target.value)}
                rows={3}
                className="w-full px-3 py-2.5 border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#b8864a]/40 focus:border-[#b8864a]"
                placeholder={t('Please explain why these designers are being deleted...', '请说明删除这些设计师的原因...')}
              />
            </div>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => {
                  setBulkDeleteModalOpen(false);
                  setDeleteReason('');
                }}
                className="px-4 py-2 text-stone-600 hover:text-[#2c2c2c]"
              >
                {t('Cancel', '取消')}
              </button>
              <button
                onClick={handleBulkDelete}
                disabled={isSubmitting || !deleteReason.trim()}
                className="px-4 py-2 bg-stone-800 text-white rounded-lg hover:bg-black disabled:opacity-50"
              >
                {isSubmitting ? t('Deleting...', '删除中...') : `${t('Delete', '删除')} ${selectedIds.length} ${t('Designers', '位设计师')}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
