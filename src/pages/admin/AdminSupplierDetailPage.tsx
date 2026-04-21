import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { adminApi } from '../../lib/adminApi';
import { useAdminT } from '../../hooks/useAdminLang';
import { ArrowLeft, Check, X, Trash2, ExternalLink } from 'lucide-react';

export default function AdminSupplierDetailPage() {
  const { t } = useAdminT();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [supplier, setSupplier] = useState<any>(null);
  const [products, setProducts] = useState<any[]>([]);
  const [catalogs, setCatalogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    adminApi.request(`/suppliers/${id}`)
      .then(data => {
        setSupplier(data.supplier);
        setProducts(data.products || []);
        setCatalogs(data.catalogs || []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [id]);

  const handleStatus = async (status: string) => {
    await adminApi.request(`/suppliers/${id}/status`, { method: 'PUT', body: JSON.stringify({ status }) });
    setSupplier((s: any) => ({ ...s, status }));
  };

  const handleDelete = async () => {
    if (!confirm('Delete this supplier and all their data?')) return;
    await adminApi.request(`/suppliers/${id}`, { method: 'DELETE' });
    navigate('/admin/suppliers');
  };

  if (loading) return <div className="py-20 text-center text-stone-400">Loading...</div>;
  if (!supplier) return <div className="py-20 text-center text-stone-500">Supplier not found</div>;

  const cats = (() => {
    if (!supplier.categories) return [];
    if (Array.isArray(supplier.categories)) return supplier.categories;
    try { return JSON.parse(supplier.categories); } catch { return []; }
  })();

  return (
    <div>
      <button onClick={() => navigate('/admin/suppliers')} className="flex items-center gap-1.5 text-sm text-stone-500 hover:text-[#b8864a] mb-5">
        <ArrowLeft className="w-4 h-4" /> {t('Back to Suppliers', '返回供应商列表')}
      </button>

      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-[#2c2c2c]">{supplier.company_name}</h1>
          <p className="text-sm text-stone-500">{supplier.user_email} · {supplier.user_name}</p>
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-xs font-bold px-3 py-1 rounded-full ${
            supplier.status === 'approved' ? 'bg-emerald-50 text-emerald-600' :
            supplier.status === 'rejected' ? 'bg-red-50 text-red-600' : 'bg-amber-50 text-amber-600'
          }`}>{supplier.status}</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Info */}
        <div className="lg:col-span-2 space-y-5">
          <div className="bg-white rounded-xl border border-stone-200 p-5 space-y-3">
            <h2 className="text-sm font-semibold text-stone-500 uppercase tracking-wider">{t('Details', '详情')}</h2>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div><span className="text-stone-400">{t('Origin', '产地')}</span>
                <p className="font-medium mt-0.5">{supplier.origin === 'china' ? '🇨🇳 China' : '🇦🇪 Dubai'}</p></div>
              <div><span className="text-stone-400">{t('Phone', '电话')}</span>
                <p className="font-medium mt-0.5">{supplier.contact_phone || '—'}</p></div>
              <div><span className="text-stone-400">{t('WhatsApp', 'WhatsApp')}</span>
                <p className="font-medium mt-0.5">{supplier.whatsapp || '—'}</p></div>
              <div><span className="text-stone-400">{t('Website', '网站')}</span>
                <p className="font-medium mt-0.5">{supplier.website ? <a href={supplier.website} target="_blank" rel="noopener noreferrer" className="text-[#b8864a] hover:underline flex items-center gap-1">{supplier.website} <ExternalLink className="w-3 h-3" /></a> : '—'}</p></div>
              <div><span className="text-stone-400">{t('Store', '线下店')}</span>
                <p className="font-medium mt-0.5">{supplier.has_physical_store ? supplier.store_address || 'Yes' : 'No'}</p></div>
              <div><span className="text-stone-400">{t('Joined', '加入时间')}</span>
                <p className="font-medium mt-0.5">{new Date(supplier.created_at).toLocaleString(undefined, { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}</p></div>
            </div>
            {cats.length > 0 && (
              <div>
                <span className="text-stone-400 text-sm">{t('Categories', '品类')}</span>
                <div className="flex flex-wrap gap-1.5 mt-1">
                  {cats.map((c: string) => <span key={c} className="text-[11px] px-2 py-0.5 rounded-full bg-stone-100 text-stone-600">{c}</span>)}
                </div>
              </div>
            )}
            {supplier.description && (
              <div>
                <span className="text-stone-400 text-sm">{t('Description', '简介')}</span>
                <p className="text-sm text-[#2c2c2c] mt-1 whitespace-pre-line">{supplier.description}</p>
              </div>
            )}
          </div>

          {/* Products */}
          {products.length > 0 && (
            <div className="bg-white rounded-xl border border-stone-200 p-5">
              <h2 className="text-sm font-semibold text-stone-500 uppercase tracking-wider mb-3">{t('Products', '产品')} ({products.length})</h2>
              <div className="grid grid-cols-4 gap-2">
                {products.map(p => (
                  <div key={p.id}>
                    <div className="aspect-[4/3] rounded-lg overflow-hidden bg-stone-100 border border-stone-200">
                      <img src={p.image_url} alt={p.title || ''} className="w-full h-full object-cover" />
                    </div>
                    {p.title && <p className="text-[11px] text-stone-500 mt-1 truncate">{p.title}</p>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Catalogs */}
          {catalogs.length > 0 && (
            <div className="bg-white rounded-xl border border-stone-200 p-5">
              <h2 className="text-sm font-semibold text-stone-500 uppercase tracking-wider mb-3">{t('Catalogs', '目录')} ({catalogs.length})</h2>
              <div className="space-y-2">
                {catalogs.map(c => (
                  <a key={c.id} href={c.file_url} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-2 p-2 rounded-lg bg-stone-50 hover:bg-stone-100 transition text-sm">
                    📄 {c.title}
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Actions sidebar */}
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-stone-200 p-5 space-y-3">
            <h2 className="text-sm font-semibold text-stone-500 uppercase tracking-wider">{t('Actions', '操作')}</h2>
            {supplier.status !== 'approved' && (
              <button onClick={() => handleStatus('approved')}
                className="w-full flex items-center justify-center gap-2 h-10 rounded-xl bg-emerald-500 text-white text-sm font-semibold hover:bg-emerald-600 transition">
                <Check className="w-4 h-4" /> {t('Approve', '通过')}
              </button>
            )}
            {supplier.status !== 'rejected' && (
              <button onClick={() => handleStatus('rejected')}
                className="w-full flex items-center justify-center gap-2 h-10 rounded-xl bg-stone-100 text-stone-600 text-sm font-semibold hover:bg-stone-200 transition">
                <X className="w-4 h-4" /> {t('Reject', '拒绝')}
              </button>
            )}
            {supplier.status !== 'pending' && (
              <button onClick={() => handleStatus('pending')}
                className="w-full flex items-center justify-center gap-2 h-10 rounded-xl bg-stone-100 text-stone-600 text-sm font-semibold hover:bg-stone-200 transition">
                {t('Reset to Pending', '重置为待审核')}
              </button>
            )}
            <hr className="border-stone-100" />
            <button onClick={handleDelete}
              className="w-full flex items-center justify-center gap-2 h-10 rounded-xl bg-red-50 text-red-600 text-sm font-semibold hover:bg-red-100 transition">
              <Trash2 className="w-4 h-4" /> {t('Delete', '删除')}
            </button>
          </div>

          {supplier.slug && (
            <a href={`/materials/suppliers/${supplier.slug}`} target="_blank" rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 h-10 rounded-xl border border-stone-200 text-sm text-stone-600 hover:bg-stone-50 transition">
              <ExternalLink className="w-4 h-4" /> {t('View Public Page', '查看公开页面')}
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
