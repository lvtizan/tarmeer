import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { adminApi } from '../../lib/adminApi';
import { useAdminT } from '../../hooks/useAdminLang';
import { showToast } from '../../components/ui/Toast';
import SmartImage from '../../components/ui/SmartImage';
import {
  ArrowLeft, Check, X, Trash2, ExternalLink, Pencil,
  Phone, Globe, MapPin, Calendar, Package, Layers, FolderOpen,
  FileText, Download,
} from 'lucide-react';

export default function AdminSupplierDetailPage() {
  const { t } = useAdminT();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [supplier, setSupplier] = useState<any>(null);
  const [products, setProducts] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [catalogs, setCatalogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [descExpanded, setDescExpanded] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (!id) return;
    adminApi.request(`/suppliers/${id}`)
      .then(data => {
        setSupplier(data.supplier);
        setProducts(data.products || []);
        setCatalogs(data.catalogs || []);
        const raw = data.projects || [];
        setProjects(raw.map((p: any) => ({
          ...p,
          images: typeof p.images === 'string' ? (() => { try { return JSON.parse(p.images); } catch { return []; } })() : (p.images || []),
        })));
      })
      .catch(() => showToast(t('Failed to load supplier', '加载供应商失败'), 'error'))
      .finally(() => setLoading(false));
  }, [id]);

  const handleStatus = async (status: string) => {
    try {
      await adminApi.request(`/suppliers/${id}/status`, { method: 'PUT', body: JSON.stringify({ status }) });
      setSupplier((s: any) => ({ ...s, status }));
      showToast(t('Status updated', '状态已更新'), 'success');
    } catch {
      showToast(t('Failed to update status', '更新状态失败'), 'error');
    }
  };

  const handleDelete = async () => {
    try {
      await adminApi.request(`/suppliers/${id}`, { method: 'DELETE' });
      showToast(t('Supplier deleted', '供应商已删除'), 'success');
      navigate('/admin/suppliers');
    } catch {
      showToast(t('Failed to delete', '删除失败'), 'error');
      setConfirmDelete(false);
    }
  };

  if (loading) return <div className="py-20 text-center text-stone-400">{t('Loading...', '加载中...')}</div>;
  if (!supplier) return <div className="py-20 text-center text-stone-500">{t('Supplier not found', '供应商不存在')}</div>;

  const cats = (() => {
    if (!supplier.categories) return [];
    if (Array.isArray(supplier.categories)) return supplier.categories;
    try { return JSON.parse(supplier.categories); } catch { return []; }
  })();

  const statusColors: Record<string, string> = {
    approved: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    rejected: 'bg-red-50 text-red-700 border-red-200',
    pending: 'bg-amber-50 text-amber-700 border-amber-200',
  };

  const initial = supplier.company_name?.[0]?.toUpperCase() || 'S';
  const desc = supplier.description || '';
  const descLong = desc.length > 180;

  return (
    <div>
      <button
        onClick={() => navigate('/admin/suppliers')}
        className="flex items-center gap-1.5 text-sm text-stone-500 hover:text-[#b8864a] mb-5 transition"
      >
        <ArrowLeft className="w-4 h-4" />
        {t('Back to Suppliers', '返回供应商列表')}
      </button>

      <div className="flex gap-6 items-start">

        {/* ===== LEFT PANEL ===== */}
        <div className="w-80 flex-shrink-0 space-y-3">

          {/* Card 1: Header + Actions */}
          <div className="bg-white rounded-xl border border-stone-200 p-5 space-y-4">
            {/* Logo + name row */}
            <div className="flex items-start gap-3">
              {supplier.logo_url ? (
                <SmartImage
                  src={supplier.logo_url}
                  alt={supplier.company_name}
                  className="w-16 h-16 rounded-xl object-contain bg-stone-50 border border-stone-100 shrink-0"
                />
              ) : (
                <div className="w-16 h-16 rounded-xl bg-stone-100 border border-stone-200 flex items-center justify-center text-xl font-bold text-stone-400 shrink-0">
                  {initial}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <h1 className="text-base font-bold text-[#2c2c2c] leading-tight">{supplier.company_name}</h1>
                <p className="text-xs text-stone-400 mt-0.5 truncate">{supplier.user_email} · {supplier.user_name}</p>
              </div>
            </div>

            {/* Tags row: origin + status */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full border ${
                supplier.origin === 'china'
                  ? 'bg-red-50 text-red-600 border-red-200'
                  : 'bg-emerald-50 text-emerald-600 border-emerald-200'
              }`}>
                {supplier.origin === 'china' ? '🇨🇳 China' : '🇦🇪 Dubai'}
              </span>
              <span className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full border ${statusColors[supplier.status] || 'bg-stone-50 text-stone-500 border-stone-200'}`}>
                {supplier.status}
              </span>
            </div>

            {/* Action links row */}
            <div className="flex items-center gap-1 flex-wrap -mx-1">
              <button
                className="flex items-center gap-1 px-2 py-1 text-xs text-stone-500 hover:text-stone-800 hover:bg-stone-100 rounded-lg transition"
                onClick={() => showToast(t('Edit not yet implemented', '编辑功能待开发'), 'error')}
              >
                <Pencil className="w-3.5 h-3.5" /> {t('Edit', '编辑')}
              </button>
              {supplier.slug && (
                <>
                  <a
                    href={`/materials/suppliers/${supplier.slug}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 px-2 py-1 text-xs text-stone-500 hover:text-stone-800 hover:bg-stone-100 rounded-lg transition"
                  >
                    <ExternalLink className="w-3.5 h-3.5" /> {t('Preview', '预览')}
                  </a>
                  <a
                    href={`/materials/suppliers/${supplier.slug}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 px-2 py-1 text-xs text-[#b8864a] hover:bg-[#b8864a]/10 rounded-lg transition"
                  >
                    <ExternalLink className="w-3.5 h-3.5" /> {t('Public Page', '查看公开页面')}
                  </a>
                </>
              )}
              {!confirmDelete ? (
                <button
                  onClick={() => setConfirmDelete(true)}
                  className="flex items-center gap-1 px-2 py-1 text-xs text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg transition ml-auto"
                >
                  <Trash2 className="w-3.5 h-3.5" /> {t('Delete', '删除')}
                </button>
              ) : (
                <div className="flex items-center gap-1 ml-auto">
                  <span className="text-xs text-red-600 font-medium">{t('Sure?', '确认?')}</span>
                  <button onClick={handleDelete} className="px-2 py-1 text-xs bg-red-500 text-white rounded-lg hover:bg-red-600 transition">{t('Yes', '是')}</button>
                  <button onClick={() => setConfirmDelete(false)} className="px-2 py-1 text-xs bg-stone-100 text-stone-600 rounded-lg hover:bg-stone-200 transition">{t('No', '否')}</button>
                </div>
              )}
            </div>

            {/* Divider + Audit CTA */}
            <div className="border-t border-stone-100 pt-3 flex gap-2">
              {supplier.status !== 'approved' && (
                <button
                  onClick={() => handleStatus('approved')}
                  className="flex-1 flex items-center justify-center gap-1.5 h-9 rounded-xl bg-emerald-500 text-white text-sm font-semibold hover:bg-emerald-600 transition"
                >
                  <Check className="w-4 h-4" /> {t('Approve', '通过')}
                </button>
              )}
              {supplier.status !== 'rejected' && (
                <button
                  onClick={() => handleStatus('rejected')}
                  className="flex-1 flex items-center justify-center gap-1.5 h-9 rounded-xl bg-stone-100 text-stone-600 text-sm font-semibold hover:bg-stone-200 transition"
                >
                  <X className="w-4 h-4" /> {t('Reject', '拒绝')}
                </button>
              )}
              {supplier.status !== 'pending' && supplier.status === 'approved' && (
                <button
                  onClick={() => handleStatus('pending')}
                  className="px-3 h-9 rounded-xl bg-stone-100 text-stone-500 text-xs font-medium hover:bg-stone-200 transition"
                >
                  {t('Reset', '重置')}
                </button>
              )}
            </div>
          </div>

          {/* Card 2: Details */}
          <div className="bg-white rounded-xl border border-stone-200 p-5 space-y-4">
            <h2 className="text-xs font-semibold text-stone-500 uppercase tracking-wide">{t('Details', '详情')}</h2>
            <div className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
              <Detail label={t('Origin', '产地')} value={supplier.origin === 'china' ? '🇨🇳 China' : '🇦🇪 Dubai'} />
              <Detail label={t('Joined', '加入时间')} value={new Date(supplier.created_at).toLocaleDateString()} icon={<Calendar className="w-3.5 h-3.5 text-stone-300" />} />
              {supplier.contact_phone && <Detail label={t('Phone', '电话')} value={supplier.contact_phone} icon={<Phone className="w-3.5 h-3.5 text-stone-300" />} />}
              {supplier.whatsapp && <Detail label="WhatsApp" value={supplier.whatsapp} icon={<Phone className="w-3.5 h-3.5 text-stone-300" />} />}
              {supplier.website && (
                <div className="col-span-2">
                  <p className="text-[11px] text-stone-400 mb-0.5">{t('Website', '网站')}</p>
                  <a href={supplier.website} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-1 text-[#b8864a] hover:underline text-xs">
                    <Globe className="w-3.5 h-3.5" />
                    <span className="truncate">{supplier.website}</span>
                  </a>
                </div>
              )}
              {supplier.has_physical_store ? (
                <div className="col-span-2">
                  <p className="text-[11px] text-stone-400 mb-0.5">{t('Store', '线下店')}</p>
                  <p className="text-sm text-[#2c2c2c] flex items-start gap-1">
                    <MapPin className="w-3.5 h-3.5 text-[#b8864a] mt-0.5 shrink-0" />
                    {supplier.store_address || t('Yes', '有')}
                  </p>
                </div>
              ) : (
                <Detail label={t('Store', '线下店')} value={t('No physical store', '无线下门店')} />
              )}
            </div>

            {cats.length > 0 && (
              <div>
                <p className="text-[11px] text-stone-400 mb-1.5">{t('Categories', '品类')}</p>
                <div className="flex flex-wrap gap-1.5">
                  {cats.map((c: string) => (
                    <span key={c} className="text-[11px] px-2 py-0.5 rounded-full bg-stone-100 text-stone-600">{c}</span>
                  ))}
                </div>
              </div>
            )}

            {desc && (
              <div>
                <p className="text-[11px] text-stone-400 mb-1">{t('Description', '简介')}</p>
                <p className={`text-sm text-[#2c2c2c] leading-relaxed ${!descExpanded && descLong ? 'line-clamp-3' : ''}`}>
                  {desc}
                </p>
                {descLong && (
                  <button
                    onClick={() => setDescExpanded(v => !v)}
                    className="text-xs text-[#b8864a] mt-1 hover:underline"
                  >
                    {descExpanded ? t('Show less', '收起') : t('Show more', '展开')}
                  </button>
                )}
              </div>
            )}
          </div>

        </div>

        {/* ===== RIGHT PANEL ===== */}
        <div className="flex-1 min-w-0 space-y-5">

          {/* Projects */}
          <section>
            <h2 className="text-sm font-semibold text-stone-500 uppercase tracking-wider mb-3 flex items-center gap-2">
              <Layers className="w-4 h-4" />
              {t('Projects', '项目')}
              <span className="font-normal text-stone-400 normal-case tracking-normal">({projects.length})</span>
            </h2>
            {projects.length === 0 ? (
              <div className="bg-white rounded-xl border border-stone-200 p-8 text-center text-stone-400 text-sm">
                {t('No projects uploaded yet', '暂无项目')}
              </div>
            ) : (
              <div className="grid grid-cols-2 xl:grid-cols-3 gap-4">
                {projects.map(proj => {
                  const imgs = Array.isArray(proj.images) ? proj.images : [];
                  return (
                    <div key={proj.id} className="bg-white rounded-xl border border-stone-200 overflow-hidden group">
                      <div className="aspect-video bg-stone-100 overflow-hidden relative">
                        {imgs[0] ? (
                          <img
                            src={imgs[0]}
                            alt={proj.title}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                            loading="lazy"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-stone-300">
                            <Layers className="w-8 h-8" />
                          </div>
                        )}
                        {imgs.length > 1 && (
                          <span className="absolute bottom-2 right-2 text-[11px] bg-black/50 text-white px-1.5 py-0.5 rounded-md">
                            {imgs.length} photos
                          </span>
                        )}
                      </div>
                      <div className="p-3 space-y-1">
                        <h3 className="text-sm font-medium text-stone-800 line-clamp-1">{proj.title}</h3>
                        <div className="flex flex-wrap gap-2 text-xs text-stone-400">
                          {proj.location && <span>{proj.location}</span>}
                          {proj.year && <span>· {proj.year}</span>}
                          {proj.area_sqm && <span>· {proj.area_sqm} m²</span>}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* Products */}
          <section>
            <h2 className="text-sm font-semibold text-stone-500 uppercase tracking-wider mb-3 flex items-center gap-2">
              <Package className="w-4 h-4" />
              {t('Products', '产品')}
              <span className="font-normal text-stone-400 normal-case tracking-normal">({products.length})</span>
            </h2>
            {products.length === 0 ? (
              <div className="bg-white rounded-xl border border-stone-200 p-8 text-center text-stone-400 text-sm">
                {t('No products uploaded yet', '暂无产品')}
              </div>
            ) : (
              <div className="bg-white rounded-xl border border-stone-200 p-4">
                <div className="grid grid-cols-3 xl:grid-cols-4 gap-3">
                  {products.map((p: any) => (
                    <div key={p.id}>
                      <div className="aspect-[4/3] rounded-lg overflow-hidden bg-stone-100 border border-stone-200">
                        <img src={p.image_url} alt={p.title || ''} className="w-full h-full object-cover" loading="lazy" />
                      </div>
                      {p.title && <p className="text-[11px] text-stone-500 mt-1 truncate">{p.title}</p>}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>

          {/* Catalogs */}
          {catalogs.length > 0 && (
            <section>
              <h2 className="text-sm font-semibold text-stone-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                <FolderOpen className="w-4 h-4" />
                {t('Catalogs', '目录')}
                <span className="font-normal text-stone-400 normal-case tracking-normal">({catalogs.length})</span>
              </h2>
              <div className="space-y-2">
                {catalogs.map((c: any) => (
                  <a
                    key={c.id}
                    href={c.file_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 p-3 rounded-xl bg-white border border-stone-200 hover:border-[#b8864a]/40 hover:shadow-sm transition group"
                  >
                    <div className="w-9 h-9 rounded-lg bg-red-50 flex items-center justify-center shrink-0 group-hover:bg-red-100 transition">
                      <FileText className="w-4 h-4 text-red-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-[#2c2c2c] truncate">{c.title}</p>
                      {c.file_size && (
                        <p className="text-xs text-stone-400 mt-0.5">
                          {c.file_size > 1048576 ? `${(c.file_size / 1048576).toFixed(1)} MB` : `${(c.file_size / 1024).toFixed(0)} KB`}
                        </p>
                      )}
                    </div>
                    <Download className="w-4 h-4 text-stone-400 group-hover:text-[#b8864a] transition shrink-0" />
                  </a>
                ))}
              </div>
            </section>
          )}

        </div>
      </div>
    </div>
  );
}

function Detail({ label, value, icon }: { label: string; value: string; icon?: React.ReactNode }) {
  return (
    <div>
      <p className="text-[11px] text-stone-400 mb-0.5">{label}</p>
      <p className="text-sm font-medium text-[#2c2c2c] flex items-center gap-1">
        {icon}
        {value}
      </p>
    </div>
  );
}
