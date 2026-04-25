import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { adminApi } from '../../lib/adminApi';
import { useAdminT } from '../../hooks/useAdminLang';
import { showToast } from '../../components/ui/Toast';
import SmartImage from '../../components/ui/SmartImage';
import {
  ArrowLeft, Trash2, ExternalLink, Pencil,
  Package, Layers, FolderOpen, FileText, Download, MapPin,
} from 'lucide-react';

// ── InfoRow (same pattern as AdminRegisteredCompanyDetailPage) ───────────────
function InfoRow({ label, value, isLink }: { label: string; value: string; isLink?: boolean }) {
  return (
    <div className="flex gap-2">
      <span className="text-stone-400 w-20 flex-shrink-0 text-sm">{label}</span>
      {isLink ? (
        <a href={value} target="_blank" rel="noopener noreferrer"
          className="text-[#b8864a] hover:underline truncate text-sm">{value}</a>
      ) : (
        <span className="text-stone-700 text-sm">{value}</span>
      )}
    </div>
  );
}

const STATUS_COLORS: Record<string, string> = {
  approved: 'bg-emerald-50 text-emerald-700',
  rejected: 'bg-red-50 text-red-700',
  pending: 'bg-amber-50 text-amber-700',
};

export default function AdminSupplierDetailPage() {
  const { t } = useAdminT();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [supplier, setSupplier] = useState<any>(null);
  const [products, setProducts] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [catalogs, setCatalogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

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
          images: typeof p.images === 'string'
            ? (() => { try { return JSON.parse(p.images); } catch { return []; } })()
            : (p.images || []),
        })));
      })
      .catch(() => showToast(t('Failed to load supplier', '加载失败'), 'error'))
      .finally(() => setLoading(false));
  }, [id]);

  const handleStatus = async (status: string) => {
    setIsSubmitting(true);
    try {
      await adminApi.request(`/suppliers/${id}/status`, {
        method: 'PUT',
        body: JSON.stringify({ status }),
      });
      setSupplier((s: any) => ({ ...s, status }));
      showToast(t('Status updated', '状态已更新'), 'success');
    } catch {
      showToast(t('Failed to update status', '更新状态失败'), 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    setIsSubmitting(true);
    try {
      await adminApi.request(`/suppliers/${id}`, { method: 'DELETE' });
      showToast(t('Supplier deleted', '供应商已删除'), 'success');
      navigate('/admin/suppliers');
    } catch {
      showToast(t('Failed to delete', '删除失败'), 'error');
      setShowDeleteModal(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) return <div className="py-20 text-center text-stone-400">{t('Loading...', '加载中...')}</div>;
  if (!supplier) return <div className="py-20 text-center text-stone-500">{t('Supplier not found', '供应商不存在')}</div>;

  const cats = (() => {
    if (!supplier.categories) return [];
    if (Array.isArray(supplier.categories)) return supplier.categories;
    try { return JSON.parse(supplier.categories); } catch { return []; }
  })();

  return (
    <div className="space-y-4 max-w-4xl">

      {/* Back */}
      <button
        onClick={() => navigate('/admin/suppliers')}
        className="flex items-center gap-1.5 text-sm text-stone-500 hover:text-stone-800"
      >
        <ArrowLeft className="w-4 h-4" />
        {t('Back to Suppliers', '返回供应商列表')}
      </button>

      <div className="flex gap-6 items-start">

        {/* ===== LEFT PANEL ===== */}
        <div className="w-72 flex-shrink-0 space-y-4">

          {/* Card 1: Header */}
          <div className="bg-white rounded-xl border border-stone-200 p-5 space-y-3">
            {/* Logo */}
            {supplier.logo_url && (
              <SmartImage
                src={supplier.logo_url}
                alt={supplier.company_name}
                className="w-16 h-16 rounded-xl object-contain bg-stone-50 border border-stone-100"
              />
            )}

            {/* Name */}
            <h1 className="text-lg font-bold text-stone-800 leading-snug">
              {supplier.company_name}
            </h1>

            {/* Tags: origin + status */}
            <div className="flex flex-wrap gap-1.5">
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                supplier.origin === 'china'
                  ? 'bg-red-50 text-red-600'
                  : 'bg-stone-100 text-stone-600'
              }`}>
                {supplier.origin === 'china' ? '🇨🇳 China' : '🇦🇪 Dubai'}
              </span>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[supplier.status] || 'bg-stone-100 text-stone-600'}`}>
                {supplier.status}
              </span>
            </div>

            {/* Action links — below tags */}
            <div className="flex flex-wrap gap-1">
              <button
                onClick={() => showToast(t('Edit not yet available', '编辑功能待开发'), 'error')}
                className="inline-flex items-center gap-1 px-2 py-1 text-xs text-stone-500 hover:text-stone-800 hover:bg-stone-100 rounded-lg transition-colors"
              >
                <Pencil size={14} /> {t('Edit', '编辑')}
              </button>
              {supplier.slug && (
                <a
                  href={`/materials/suppliers/${supplier.slug}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 px-2 py-1 text-xs text-stone-500 hover:text-stone-800 hover:bg-stone-100 rounded-lg transition-colors"
                >
                  <ExternalLink size={14} /> {t('Preview', '预览')}
                </a>
              )}
              <button
                onClick={() => setShowDeleteModal(true)}
                className="inline-flex items-center gap-1 px-2 py-1 text-xs text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors"
              >
                <Trash2 size={14} /> {t('Delete', '删除')}
              </button>
            </div>

            {/* Description */}
            {supplier.description && (
              <p className="text-sm text-stone-600 leading-relaxed">{supplier.description}</p>
            )}

            {/* Audit CTA — same style as AdminRegisteredCompanyDetailPage */}
            {supplier.status === 'pending' && (
              <div className="flex gap-2 pt-1">
                <button
                  onClick={() => handleStatus('approved')}
                  disabled={isSubmitting}
                  className="flex-1 py-2 rounded-lg bg-green-600 text-white text-sm font-medium hover:bg-green-700 disabled:opacity-50 transition"
                >
                  {t('Approve', '通过')}
                </button>
                <button
                  onClick={() => handleStatus('rejected')}
                  disabled={isSubmitting}
                  className="flex-1 py-2 rounded-lg bg-red-50 text-red-600 text-sm font-medium hover:bg-red-100 border border-red-200 disabled:opacity-50 transition"
                >
                  {t('Reject', '拒绝')}
                </button>
              </div>
            )}
            {supplier.status === 'approved' && (
              <button
                onClick={() => handleStatus('rejected')}
                disabled={isSubmitting}
                className="w-full py-2 rounded-lg bg-red-50 text-red-600 text-sm font-medium hover:bg-red-100 border border-red-200 disabled:opacity-50 transition"
              >
                {t('Reject', '拒绝')}
              </button>
            )}
            {supplier.status === 'rejected' && (
              <button
                onClick={() => handleStatus('approved')}
                disabled={isSubmitting}
                className="w-full py-2 rounded-lg bg-green-600 text-white text-sm font-medium hover:bg-green-700 disabled:opacity-50 transition"
              >
                {t('Approve', '通过')}
              </button>
            )}
          </div>

          {/* Card 2: Details */}
          <div className="bg-white rounded-xl border border-stone-200 p-5 space-y-2.5">
            <h2 className="text-xs font-semibold text-stone-500 uppercase tracking-wide mb-3">
              {t('Details', '详情')}
            </h2>
            <InfoRow label={t('Origin', '产地')} value={supplier.origin === 'china' ? '🇨🇳 China' : '🇦🇪 Dubai'} />
            {supplier.contact_phone && <InfoRow label={t('Phone', '电话')} value={supplier.contact_phone} />}
            {supplier.whatsapp && <InfoRow label="WhatsApp" value={supplier.whatsapp} />}
            {supplier.website && <InfoRow label={t('Website', '网站')} value={supplier.website} isLink />}
            {supplier.has_physical_store ? (
              <div className="flex gap-2">
                <span className="text-stone-400 w-20 flex-shrink-0 text-sm">{t('Store', '线下店')}</span>
                <span className="text-stone-700 text-sm flex items-start gap-1">
                  <MapPin className="w-3.5 h-3.5 text-[#b8864a] mt-0.5 shrink-0" />
                  {supplier.store_address || t('Yes', '有')}
                </span>
              </div>
            ) : (
              <InfoRow label={t('Store', '线下店')} value={t('No physical store', '无线下门店')} />
            )}
            {cats.length > 0 && (
              <div className="flex gap-2">
                <span className="text-stone-400 w-20 flex-shrink-0 text-sm pt-0.5">{t('Categories', '品类')}</span>
                <div className="flex flex-wrap gap-1">
                  {cats.map((c: string) => (
                    <span key={c} className="text-xs px-2 py-0.5 rounded-full bg-stone-100 text-stone-600">{c}</span>
                  ))}
                </div>
              </div>
            )}
            <div className="pt-1 border-t border-stone-100">
              <InfoRow
                label={t('Joined', '加入时间')}
                value={new Date(supplier.created_at).toLocaleString(undefined, {
                  year: 'numeric', month: '2-digit', day: '2-digit',
                  hour: '2-digit', minute: '2-digit',
                })}
              />
            </div>
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
                {t('No projects yet', '暂无项目')}
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
                            {imgs.length} {t('photos', '张')}
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
                {t('No products yet', '暂无产品')}
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
                          {c.file_size > 1048576
                            ? `${(c.file_size / 1048576).toFixed(1)} MB`
                            : `${(c.file_size / 1024).toFixed(0)} KB`}
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

      {/* Delete confirm modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl p-6 shadow-xl max-w-sm w-full mx-4 space-y-4">
            <h2 className="text-base font-bold text-[#2c2c2c]">
              {t('Delete Supplier?', '删除供应商？')}
            </h2>
            <p className="text-sm text-stone-500">
              {t('This will permanently delete the supplier and all their data. This cannot be undone.', '这将永久删除该供应商及其所有数据，无法恢复。')}
            </p>
            <div className="flex gap-2 pt-1">
              <button
                onClick={handleDelete}
                disabled={isSubmitting}
                className="flex-1 py-2 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700 disabled:opacity-50 transition"
              >
                {t('Delete', '确认删除')}
              </button>
              <button
                onClick={() => setShowDeleteModal(false)}
                className="flex-1 py-2 rounded-lg bg-stone-100 text-stone-600 text-sm font-medium hover:bg-stone-200 transition"
              >
                {t('Cancel', '取消')}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
