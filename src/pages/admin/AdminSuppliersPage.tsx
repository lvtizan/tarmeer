import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { adminApi } from '../../lib/adminApi';
import { Spinner } from '../../components/ui/Spinner';
import { showToast } from '../../components/ui/Toast';
import { useAdminT } from '../../hooks/useAdminLang';
import { Package, Trash2, Pencil, Check, X, ExternalLink } from 'lucide-react';
import AdminRowActions from '../../components/admin/AdminRowActions';
import AdminSelect from '../../components/ui/AdminSelect';
import DeleteReasonModal from '../../components/admin/DeleteReasonModal';
import { formatAdminDateTime, ADMIN_TIME_CLS } from '../../lib/formatTime';

interface Supplier {
  id: number;
  company_name: string;
  slug: string;
  origin: 'china' | 'dubai';
  categories: string[] | string | null;
  status: string;
  has_physical_store: number;
  user_email: string;
  user_name: string;
  product_count: number;
  catalog_count: number;
  created_at: string;
  home_display_order: number;
  list_display_order: number;
  weight_score: number | null;
}

export default function AdminSuppliersPage() {
  const { t } = useAdminT();
  const navigate = useNavigate();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [originFilter, setOriginFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [productSort, setProductSort] = useState<'asc' | 'desc' | null>(null);
  const [joinedSort, setJoinedSort] = useState<'asc' | 'desc' | null>(null);
  const [deleteModal, setDeleteModal] = useState<{ id: number; name: string } | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [editingOrder, setEditingOrder] = useState<Record<string, string>>({});
  const [orderToast, setOrderToast] = useState<{ msg: string; key: string } | null>(null);

  const fetchSuppliers = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = { limit: '50' };
      if (originFilter) params.origin = originFilter;
      if (statusFilter) params.status = statusFilter;
      const qs = new URLSearchParams(params).toString();
      const data = await adminApi.request(`/suppliers?${qs}`);
      setSuppliers(data.suppliers || []);
    } catch {}
    setLoading(false);
  }, [originFilter, statusFilter]);

  useEffect(() => { fetchSuppliers(); }, [fetchSuppliers]);

  const parseCats = (cats: string[] | string | null): string[] => {
    if (!cats) return [];
    if (Array.isArray(cats)) return cats;
    try { return JSON.parse(cats); } catch { return []; }
  };

  const handleStatus = async (id: number, status: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await adminApi.request(`/suppliers/${id}/status`, { method: 'PUT', body: JSON.stringify({ status }) });
      setSuppliers(list => list.map(s => s.id === id ? { ...s, status } : s));
      showToast(t('Status updated', '状态已更新'), 'success');
    } catch {
      showToast(t('Failed to update status', '更新状态失败'), 'error');
    }
  };

  const handleDeleteConfirm = async (reason: string) => {
    if (!deleteModal) return;
    setDeleteLoading(true);
    try {
      await adminApi.request(`/suppliers/${deleteModal.id}`, { method: 'DELETE', body: JSON.stringify({ reason }) });
      setDeleteModal(null);
      fetchSuppliers();
    } catch {}
    setDeleteLoading(false);
  };

  const getEditKey = (id: number, type: string) => `${type}-${id}`;

  const showOrderToast = (msg: string, key: string) => {
    setOrderToast({ msg, key });
    setTimeout(() => setOrderToast(null), 2000);
  };

  const handleOrderBlur = async (id: number, type: 'home' | 'list', original: number) => {
    const key = getEditKey(id, type);
    const raw = editingOrder[key];
    if (raw === undefined) return;
    const value = parseInt(raw) || 0;
    setEditingOrder(prev => { const next = { ...prev }; delete next[key]; return next; });
    if (value === original) return;
    try {
      if (type === 'home') {
        await adminApi.setSupplierHomeOrder(id, value);
      } else {
        await adminApi.setSupplierListOrder(id, value);
      }
      showOrderToast(`${type === 'home' ? '首页' : '列表'}排序已设为 ${value}`, key);
      fetchSuppliers();
    } catch {
      showToast(t('Failed to update order', '排序更新失败'), 'error');
    }
  };

  return (
    <div>
      {deleteModal && (
        <DeleteReasonModal
          names={[deleteModal.name]}
          onConfirm={handleDeleteConfirm}
          onCancel={() => setDeleteModal(null)}
          loading={deleteLoading}
        />
      )}

      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-[#2c2c2c]">{t('Suppliers', '供应商')}</h1>
        <a
          href="/start-suppliers"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border border-stone-200 bg-white text-xs font-medium text-stone-600 hover:bg-stone-50 hover:text-[#b8864a] transition"
        >
          <ExternalLink className="w-3.5 h-3.5" />
          {t('Supplier Guide', '供应商教程页')}
        </a>
      </div>

      <div className="flex items-center justify-end gap-2 mb-4">
        <AdminSelect
          size="sm"
          value={originFilter}
          onChange={setOriginFilter}
          options={[
            { value: '', label: t('All Origins', '全部产地') },
            { value: 'china', label: '🇨🇳 China' },
            { value: 'dubai', label: '🇦🇪 Dubai' },
          ]}
        />
        <AdminSelect
          size="sm"
          value={statusFilter}
          onChange={setStatusFilter}
          options={[
            { value: '', label: t('All Status', '全部状态') },
            { value: 'pending', label: t('Pending', '待审核') },
            { value: 'approved', label: t('Approved', '已通过') },
            { value: 'rejected', label: t('Rejected', '已拒绝') },
          ]}
        />
      </div>

      {loading ? <Spinner /> : suppliers.length === 0 ? (
        <div className="py-16 text-center">
          <Package className="w-10 h-10 text-stone-300 mx-auto mb-3" />
          <p className="text-[15px] text-stone-500">{t('No suppliers found', '暂无供应商')}</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-stone-200 overflow-x-auto">
          <table className="w-full text-[15px]">
            <thead>
              <tr className="bg-stone-50 border-b border-stone-200 text-sm">
                <th className="text-left px-4 py-3 font-medium text-stone-600">{t('Company', '公司')}</th>
                <th className="text-left px-4 py-3 font-medium text-stone-600">{t('Origin', '产地')}</th>
                <th className="text-left px-4 py-3 font-medium text-stone-600">{t('Categories', '品类')}</th>
                <th className="text-left px-4 py-3 font-medium text-stone-600">{t('Status', '状态')}</th>
                <th
                  className="text-left px-4 py-3 font-medium text-stone-600 cursor-pointer select-none hover:text-stone-800"
                  onClick={() => setProductSort(s => s === 'desc' ? 'asc' : 'desc')}
                >
                  {t('Products', '产品')} {productSort === 'asc' ? '↑' : productSort === 'desc' ? '↓' : <span className="text-stone-300">↕</span>}
                </th>
                <th className="text-left px-4 py-3 font-medium text-stone-600 whitespace-nowrap">首页排序</th>
                <th className="text-left px-4 py-3 font-medium text-stone-600 whitespace-nowrap">列表排序</th>
                <th className="text-left px-4 py-3 font-medium text-stone-600 whitespace-nowrap">权重</th>
                <th
                  className="text-left px-4 py-3 font-medium text-stone-600 cursor-pointer select-none hover:text-stone-800"
                  onClick={() => setJoinedSort(s => s === 'desc' ? 'asc' : 'desc')}
                >
                  {t('Joined', '加入时间')} {joinedSort === 'asc' ? '↑' : joinedSort === 'desc' ? '↓' : <span className="text-stone-300">↕</span>}
                </th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {((() => {
                let list = [...suppliers];
                if (productSort) list.sort((a, b) => productSort === 'asc' ? a.product_count - b.product_count : b.product_count - a.product_count);
                if (joinedSort) list.sort((a, b) => {
                  const d = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
                  return joinedSort === 'asc' ? d : -d;
                });
                return list;
              })()).map(s => (
                <tr
                  key={s.id}
                  className="border-b border-stone-100 hover:bg-stone-50/50 cursor-pointer"
                  onClick={() => navigate(`/admin/suppliers/${s.id}`)}
                >
                  {/* Company name + email */}
                  <td className="px-4 py-3">
                    <div className="text-[16px] font-semibold text-[#2c2c2c] leading-tight">{s.company_name}</div>
                    <div className="text-[14px] text-stone-400 mt-0.5">{s.user_email}</div>
                  </td>

                  {/* Origin */}
                  <td className="px-4 py-3">
                    <span className={`text-[15px] font-medium px-2.5 py-0.5 rounded-full ${
                      s.origin === 'china' ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-600'
                    }`}>
                      {s.origin === 'china' ? '🇨🇳 China' : '🇦🇪 Dubai'}
                    </span>
                  </td>

                  {/* Categories */}
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {parseCats(s.categories).slice(0, 2).map(c => (
                        <span key={c} className="text-[13px] px-2 py-0.5 rounded-full bg-stone-100 text-stone-600">{c}</span>
                      ))}
                    </div>
                  </td>

                  {/* Status */}
                  <td className="px-4 py-3">
                    <span className={`text-[15px] font-medium px-2.5 py-0.5 rounded-full ${
                      s.status === 'approved' ? 'bg-emerald-50 text-emerald-600' :
                      s.status === 'rejected' ? 'bg-red-50 text-red-600' : 'bg-amber-50 text-amber-600'
                    }`}>
                      {s.status}
                    </span>
                  </td>

                  {/* Product count */}
                  <td className="px-4 py-3 text-[15px] text-stone-600">{s.product_count}</td>

                  {/* Home display order */}
                  <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                    <div className="relative">
                      {orderToast?.key === getEditKey(s.id, 'home') && (
                        <div className="absolute -top-8 left-0 bg-white border border-stone-200 text-stone-700 text-xs px-2.5 py-1 rounded-lg shadow-sm whitespace-nowrap">{orderToast.msg}</div>
                      )}
                      <input
                        type="number"
                        value={editingOrder[getEditKey(s.id, 'home')] ?? (s.home_display_order || 0)}
                        onChange={e => setEditingOrder(prev => ({ ...prev, [getEditKey(s.id, 'home')]: e.target.value }))}
                        onBlur={() => handleOrderBlur(s.id, 'home', s.home_display_order || 0)}
                        onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
                        className="w-16 px-2 py-1 text-xs border rounded"
                      />
                    </div>
                  </td>

                  {/* List display order */}
                  <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                    <div className="relative">
                      {orderToast?.key === getEditKey(s.id, 'list') && (
                        <div className="absolute -top-8 left-0 bg-white border border-stone-200 text-stone-700 text-xs px-2.5 py-1 rounded-lg shadow-sm whitespace-nowrap">{orderToast.msg}</div>
                      )}
                      <input
                        type="number"
                        value={editingOrder[getEditKey(s.id, 'list')] ?? (s.list_display_order || 0)}
                        onChange={e => setEditingOrder(prev => ({ ...prev, [getEditKey(s.id, 'list')]: e.target.value }))}
                        onBlur={() => handleOrderBlur(s.id, 'list', s.list_display_order || 0)}
                        onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
                        className="w-16 px-2 py-1 text-xs border rounded"
                      />
                    </div>
                  </td>

                  {/* Weight score */}
                  <td className="px-4 py-3 text-stone-600 text-[15px] tabular-nums font-mono">{s.weight_score ?? '—'}</td>

                  {/* Joined date */}
                  <td className={`px-4 py-3 ${ADMIN_TIME_CLS}`}>
                    {formatAdminDateTime(s.created_at)}
                  </td>

                  {/* Actions */}
                  <td className="px-4 py-3">
                    <AdminRowActions actions={[
                      {
                        icon: <Pencil size={14} />,
                        label: t('Edit', '编辑'),
                        variant: 'default',
                        onClick: e => { e.stopPropagation(); navigate(`/admin/suppliers/${s.id}`); },
                      },
                      ...(s.status !== 'approved' ? [{
                        icon: <Check size={14} />,
                        label: t('Approve', '通过'),
                        variant: 'success' as const,
                        onClick: (e: React.MouseEvent) => handleStatus(s.id, 'approved', e),
                      }] : []),
                      ...(s.status !== 'rejected' ? [{
                        icon: <X size={14} />,
                        label: t('Reject', '拒绝'),
                        variant: 'warning' as const,
                        onClick: (e: React.MouseEvent) => handleStatus(s.id, 'rejected', e),
                      }] : []),
                      {
                        icon: <Trash2 size={14} />,
                        label: t('Delete', '删除'),
                        variant: 'danger' as const,
                        onClick: e => { e.stopPropagation(); setDeleteModal({ id: s.id, name: s.company_name }); },
                      },
                    ]} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
