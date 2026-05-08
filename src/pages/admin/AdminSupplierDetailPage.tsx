import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { adminApi } from '../../lib/adminApi';
import { useAdminT } from '../../hooks/useAdminLang';
import { showToast } from '../../components/ui/Toast';
import SmartImage from '../../components/ui/SmartImage';
import { useRef } from 'react';
import {
  ArrowLeft, Trash2, ExternalLink, Pencil,
  Package, Layers, FolderOpen, FileText, Download, MapPin, ImageIcon, Plus, X, Upload,
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
  const [showAddProduct, setShowAddProduct] = useState(false);
  const [newProduct, setNewProduct] = useState({ image_url: '', title: '', category: '' });
  const [addingProduct, setAddingProduct] = useState(false);
  const [replacingId, setReplacingId] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const replaceTargetRef = useRef<number | null>(null);

  const handleReplaceImage = async (file: File, productId: number) => {
    if (!supplier) return;
    setReplacingId(productId);
    try {
      const result = await adminApi.replaceSupplierProductImage(supplier.id, productId, file);
      // 加 ?t=… 强刷绕过浏览器缓存（同 url 替换 image 时浏览器看 cache hit）
      const bust = `${result.image_url}?t=${Date.now()}`;
      setProducts((prev) => prev.map((p) => p.id === productId ? { ...p, image_url: bust } : p));
      showToast(t('Image replaced', '图片已更换'), 'success');
    } catch (err: any) {
      showToast(err?.message || t('Replace failed', '替换失败'), 'error');
    } finally {
      setReplacingId(null);
      replaceTargetRef.current = null;
    }
  };
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

  const setCover = async (imgUrl: string) => {
    try {
      await adminApi.request(`/suppliers/${id}`, {
        method: 'PUT',
        body: JSON.stringify({ cover_image_url: imgUrl }),
      });
      setSupplier((s: any) => ({ ...s, cover_image_url: imgUrl }));
      showToast(t('Cover updated', '封面已更新'), 'success');
    } catch {
      showToast(t('Failed', '设置失败'), 'error');
    }
  };

  const handleDeleteProduct = async (productId: number) => {
    if (!confirm(t('Delete this product image?', '确认删除这张产品图？'))) return;
    try {
      await adminApi.request(`/suppliers/${id}/products/${productId}`, { method: 'DELETE' });
      setProducts(prev => prev.filter(p => p.id !== productId));
      showToast(t('Product deleted', '产品图已删除'), 'success');
    } catch {
      showToast(t('Failed to delete', '删除失败'), 'error');
    }
  };

  const handleAddProduct = async () => {
    if (!newProduct.image_url.trim()) {
      showToast(t('Image URL is required', '请填写图片地址'), 'error');
      return;
    }
    setAddingProduct(true);
    try {
      const data = await adminApi.request(`/suppliers/${id}/products`, {
        method: 'POST',
        body: JSON.stringify({
          image_url: newProduct.image_url.trim(),
          title: newProduct.title.trim() || null,
          category: newProduct.category || null,
          sort_order: products.length,
        }),
      });
      setProducts(prev => [...prev, data.product]);
      setNewProduct({ image_url: '', title: '', category: '' });
      setShowAddProduct(false);
      showToast(t('Product added', '产品图已添加'), 'success');
    } catch {
      showToast(t('Failed to add product', '添加失败'), 'error');
    } finally {
      setAddingProduct(false);
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
    <div className="space-y-4">

      {/* Hidden file input — 给"更换图片"按钮共用，targetId 在 ref 里 */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          const targetId = replaceTargetRef.current;
          e.target.value = '';
          if (file && targetId) handleReplaceImage(file, targetId);
        }}
      />

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
            {(supplier.contact_phone || supplier.user_phone) && (
              <InfoRow label={t('Phone', '电话')} value={supplier.contact_phone || supplier.user_phone} />
            )}
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

          {/* Card 3: Current Cover Preview */}
          {supplier.cover_image_url && (
            <div className="bg-white rounded-xl border border-stone-200 p-4 space-y-2">
              <h2 className="text-xs font-semibold text-stone-500 uppercase tracking-wide">
                {t('Cover Image', '封面图')}
              </h2>
              <div className="aspect-video w-full rounded-lg overflow-hidden bg-stone-100 border border-stone-200">
                <img src={supplier.cover_image_url} alt="cover" className="w-full h-full object-cover" />
              </div>
              <p className="text-[11px] text-stone-400">{t('Hover over any image below to change', '鼠标移到下方图片可更换')}</p>
            </div>
          )}

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
              <div className="grid grid-cols-3 gap-4">
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
                        {imgs[0] && (
                          <button
                            onClick={() => setCover(imgs[0])}
                            className="absolute inset-x-0 bottom-0 py-1.5 bg-black/60 text-white text-[11px] font-medium opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1"
                          >
                            <ImageIcon className="w-3 h-3" />
                            {t('Set as Cover', '设为封面')}
                          </button>
                        )}
                        {imgs.length > 1 && (
                          <span className="absolute bottom-2 right-2 text-[11px] bg-black/50 text-white px-1.5 py-0.5 rounded-md group-hover:opacity-0 transition-opacity">
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
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-stone-500 uppercase tracking-wider flex items-center gap-2">
                <Package className="w-4 h-4" />
                {t('Products', '产品')}
                <span className="font-normal text-stone-400 normal-case tracking-normal">({products.length})</span>
              </h2>
              <button
                onClick={() => setShowAddProduct(v => !v)}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-lg bg-[#b8864a]/10 text-[#b8864a] hover:bg-[#b8864a]/20 transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                {t('Add Image', '添加图片')}
              </button>
            </div>

            {/* Add product form */}
            {showAddProduct && (
              <div className="bg-white rounded-xl border border-[#b8864a]/30 p-4 mb-3 space-y-3">
                <p className="text-xs font-medium text-stone-500">{t('Add Product Image', '添加产品图')}</p>
                <input
                  type="text"
                  placeholder={t('Image URL (e.g. /uploads/suppliers/68/xxx.jpg)', '图片地址（如 /uploads/suppliers/68/xxx.jpg）')}
                  value={newProduct.image_url}
                  onChange={e => setNewProduct(v => ({ ...v, image_url: e.target.value }))}
                  className="w-full h-9 px-3 rounded-lg border border-stone-200 bg-stone-50 text-sm text-[#1c1917] placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-[#B8864A]/15 focus:border-[#B8864A]"
                />
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder={t('Title (optional)', '名称（可选）')}
                    value={newProduct.title}
                    onChange={e => setNewProduct(v => ({ ...v, title: e.target.value }))}
                    className="flex-1 h-9 px-3 rounded-lg border border-stone-200 bg-stone-50 text-sm text-[#1c1917] placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-[#B8864A]/15 focus:border-[#B8864A]"
                  />
                  <select
                    value={newProduct.category}
                    onChange={e => setNewProduct(v => ({ ...v, category: e.target.value }))}
                    className="h-9 px-3 rounded-lg border border-stone-200 bg-stone-50 text-sm text-[#1c1917] focus:outline-none focus:ring-2 focus:ring-[#B8864A]/15 focus:border-[#B8864A]"
                  >
                    <option value="">{t('Category', '分类')}</option>
                    <option value="wardrobe">{t('Wardrobe', '衣柜')}</option>
                    <option value="kitchen">{t('Kitchen', '橱柜')}</option>
                    <option value="furniture">{t('Furniture', '家具')}</option>
                    <option value="other">{t('Other', '其他')}</option>
                  </select>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={handleAddProduct}
                    disabled={addingProduct}
                    className="px-4 py-1.5 rounded-lg bg-[#b8864a] text-white text-xs font-medium hover:bg-[#a07540] disabled:opacity-50 transition"
                  >
                    {addingProduct ? t('Adding...', '添加中...') : t('Add', '确认添加')}
                  </button>
                  <button
                    onClick={() => { setShowAddProduct(false); setNewProduct({ image_url: '', title: '', category: '' }); }}
                    className="px-4 py-1.5 rounded-lg bg-stone-100 text-stone-600 text-xs font-medium hover:bg-stone-200 transition"
                  >
                    {t('Cancel', '取消')}
                  </button>
                </div>
              </div>
            )}

            {products.length === 0 ? (
              <div className="bg-white rounded-xl border border-stone-200 p-8 text-center text-stone-400 text-sm">
                {t('No products yet', '暂无产品')}
              </div>
            ) : (
              <div className="bg-white rounded-xl border border-stone-200 p-4">
                <div className="grid grid-cols-3 xl:grid-cols-4 gap-3">
                  {products.map((p: any) => (
                    <div key={p.id} className="group">
                      <div className="aspect-[4/3] rounded-lg overflow-hidden bg-stone-100 border border-stone-200 relative">
                        <img src={p.image_url} alt={p.title || ''} className="w-full h-full object-cover" loading="lazy" />
                        {/* Delete button — top right */}
                        <button
                          onClick={() => handleDeleteProduct(p.id)}
                          className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-black/60 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600"
                          title={t('Delete', '删除')}
                        >
                          <X className="w-3 h-3" />
                        </button>
                        {/* Replace image — top left */}
                        <button
                          onClick={() => {
                            replaceTargetRef.current = p.id;
                            fileInputRef.current?.click();
                          }}
                          disabled={replacingId === p.id}
                          className="absolute top-1.5 left-1.5 inline-flex items-center gap-1 px-2 py-1 rounded-md bg-white/95 text-stone-700 text-[10px] font-medium shadow-md opacity-0 group-hover:opacity-100 transition-opacity hover:bg-white disabled:opacity-50"
                          title={t('Replace image', '更换图片')}
                        >
                          {replacingId === p.id
                            ? <span className="text-[10px]">…</span>
                            : <Upload className="w-3 h-3" />}
                          {t('Replace', '更换图片')}
                        </button>
                        {/* Set as cover — bottom bar */}
                        <button
                          onClick={() => setCover(p.image_url)}
                          className="absolute inset-x-0 bottom-0 py-1 bg-black/60 text-white text-[10px] font-medium opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1"
                        >
                          <ImageIcon className="w-2.5 h-2.5" />
                          {t('Set as Cover', '设为封面')}
                        </button>
                      </div>
                      {p.category && (
                        <p className="text-[10px] text-[#b8864a] uppercase tracking-wide mt-1">{p.category}</p>
                      )}
                      {p.title && <p className="text-[11px] text-stone-500 truncate">{p.title}</p>}
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
