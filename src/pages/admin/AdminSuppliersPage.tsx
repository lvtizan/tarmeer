import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { adminApi } from '../../lib/adminApi';
import { Spinner } from '../../components/ui/Spinner';
import { useAdminT } from '../../hooks/useAdminLang';
import { Package, Trash2 } from 'lucide-react';

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
}

export default function AdminSuppliersPage() {
  const { t } = useAdminT();
  const navigate = useNavigate();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [originFilter, setOriginFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const fetchSuppliers = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = { limit: '50' };
      if (search) params.search = search;
      if (originFilter) params.origin = originFilter;
      if (statusFilter) params.status = statusFilter;
      const qs = new URLSearchParams(params).toString();
      const data = await adminApi.request(`/suppliers?${qs}`);
      setSuppliers(data.suppliers || []);
    } catch {}
    setLoading(false);
  }, [search, originFilter, statusFilter]);

  useEffect(() => { fetchSuppliers(); }, [fetchSuppliers]);

  const parseCats = (cats: string[] | string | null): string[] => {
    if (!cats) return [];
    if (Array.isArray(cats)) return cats;
    try { return JSON.parse(cats); } catch { return []; }
  };

  const handleDelete = async (id: number, name: string) => {
    if (!confirm(`Delete supplier "${name}" and all their data?`)) return;
    try {
      await adminApi.request(`/suppliers/${id}`, { method: 'DELETE' });
      fetchSuppliers();
    } catch {}
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-[#2c2c2c]">{t('Suppliers', '供应商')}</h1>
      </div>

      <div className="flex flex-wrap items-center gap-3 mb-4">
        <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder={t('Search...', '搜索...')}
          className="h-9 px-3 w-56 rounded-lg border border-stone-200 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-[#b8864a]/30" />
        <select value={originFilter} onChange={e => setOriginFilter(e.target.value)}
          className="h-9 px-3 rounded-lg border border-stone-200 text-sm bg-white">
          <option value="">{t('All Origins', '全部产地')}</option>
          <option value="china">🇨🇳 China</option>
          <option value="dubai">🇦🇪 Dubai</option>
        </select>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
          className="h-9 px-3 rounded-lg border border-stone-200 text-sm bg-white">
          <option value="">{t('All Status', '全部状态')}</option>
          <option value="pending">{t('Pending', '待审核')}</option>
          <option value="approved">{t('Approved', '已通过')}</option>
          <option value="rejected">{t('Rejected', '已拒绝')}</option>
        </select>
      </div>

      {loading ? <Spinner /> : suppliers.length === 0 ? (
        <div className="py-16 text-center">
          <Package className="w-10 h-10 text-stone-300 mx-auto mb-3" />
          <p className="text-stone-500">{t('No suppliers found', '暂无供应商')}</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-stone-200 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-stone-50 border-b border-stone-200">
                <th className="text-left px-4 py-3 font-medium text-stone-600">{t('Company', '公司')}</th>
                <th className="text-left px-4 py-3 font-medium text-stone-600">{t('Origin', '产地')}</th>
                <th className="text-left px-4 py-3 font-medium text-stone-600">{t('Categories', '品类')}</th>
                <th className="text-left px-4 py-3 font-medium text-stone-600">{t('Status', '状态')}</th>
                <th className="text-left px-4 py-3 font-medium text-stone-600">{t('Products', '产品')}</th>
                <th className="text-left px-4 py-3 font-medium text-stone-600">{t('Joined', '加入时间')}</th>
                <th className="text-left px-4 py-3 font-medium text-stone-600"></th>
              </tr>
            </thead>
            <tbody>
              {suppliers.map(s => (
                <tr key={s.id} className="border-b border-stone-100 hover:bg-stone-50/50 cursor-pointer"
                  onClick={() => navigate(`/admin/suppliers/${s.id}`)}>
                  <td className="px-4 py-3">
                    <div className="font-medium text-[#2c2c2c]">{s.company_name}</div>
                    <div className="text-xs text-stone-400">{s.user_email}</div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      s.origin === 'china' ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-600'
                    }`}>{s.origin === 'china' ? '🇨🇳' : '🇦🇪'} {s.origin}</span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {parseCats(s.categories).slice(0, 2).map(c => (
                        <span key={c} className="text-[10px] px-1.5 py-0.5 rounded bg-stone-100 text-stone-500">{c}</span>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      s.status === 'approved' ? 'bg-emerald-50 text-emerald-600' :
                      s.status === 'rejected' ? 'bg-red-50 text-red-600' : 'bg-amber-50 text-amber-600'
                    }`}>{s.status}</span>
                  </td>
                  <td className="px-4 py-3 text-stone-600">{s.product_count}</td>
                  <td className="px-4 py-3 text-stone-500 text-xs">
                    {new Date(s.created_at).toLocaleString(undefined, { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
                  </td>
                  <td className="px-4 py-3">
                    <button onClick={e => { e.stopPropagation(); handleDelete(s.id, s.company_name); }}
                      className="text-stone-300 hover:text-red-500 transition">
                      <Trash2 className="w-4 h-4" />
                    </button>
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
