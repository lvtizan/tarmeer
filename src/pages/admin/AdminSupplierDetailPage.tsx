import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { adminApi } from '../../lib/adminApi';
import { useAdminT } from '../../hooks/useAdminLang';
import { showToast } from '../../components/ui/Toast';
import SmartImage from '../../components/ui/SmartImage';
import {
  ArrowLeft, Trash2, ExternalLink, Pencil,
  Package, Layers, FolderOpen, FileText, Download, MapPin, ImageIcon,
  Plus, X, Upload,
} from 'lucide-react';

// ── InfoRow ───────────────────────────────────────────────────────────────────
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

const inputCls = 'w-full h-9 px-3 rounded-lg border border-stone-200 bg-stone-50 text-sm text-[#1c1917] placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-[#B8864A]/15 focus:border-[#B8864A]';
const PRODUCT_CATEGORIES = ['wardrobe', 'kitchen', 'furniture', 'stone', 'lighting', 'plants', 'flooring', 'curtains', 'paint', 'hardware', 'other'];

// ── Project Form Modal ────────────────────────────────────────────────────────
interface ProjectFormState {
  title: string;
  location: string;
  year: string;
  area_sqm: string;
  budget: string;
  description: string;
  images: string[];
}

function emptyProjectForm(): ProjectFormState {
  return { title: '', location: '', year: '', area_sqm: '', budget: '', description: '', images: [] };
}

function projectToForm(p: any): ProjectFormState {
  const imgs = Array.isArray(p.images) ? p.images
    : (() => { try { return JSON.parse(p.images || '[]'); } catch { return []; } })();
  return {
    title: p.title || '',
    location: p.location || '',
    year: p.year ? String(p.year) : '',
    area_sqm: p.area_sqm ? String(p.area_sqm) : '',
    budget: p.budget || '',
    description: p.description || '',
    images: imgs,
  };
}

interface ProjectModalProps {
  supplierId: number;
  editingProject: any | null; // null = add mode
  onClose: () => void;
  onSaved: (project: any, isNew: boolean) => void;
  t: (en: string, zh: string) => string;
}

function ProjectModal({ supplierId, editingProject, onClose, onSaved, t }: ProjectModalProps) {
  const [form, setForm] = useState<ProjectFormState>(
    editingProject ? projectToForm(editingProject) : emptyProjectForm()
  );
  const [saving, setSaving] = useState(false);
  const [uploadingImg, setUploadingImg] = useState(false);
  const imgInputRef = useRef<HTMLInputElement>(null);

  const set = (k: keyof ProjectFormState, v: string) => setForm(f => ({ ...f, [k]: v }));

  const handleUploadImage = async (file: File) => {
    setUploadingImg(true);
    try {
      const fd = new FormData();
      fd.append('file', file, file.name);
      const token = adminApi.getToken ? adminApi.getToken() : localStorage.getItem('admin_token');
      const API_BASE = (import.meta.env.VITE_API_URL?.trim() || '/api') + '/admin';
      const res = await fetch(`${API_BASE}/suppliers/${supplierId}/project-image`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        body: fd,
      });
      if (!res.ok) throw new Error(`Upload failed: ${res.status}`);
      const data = await res.json();
      setForm(f => ({ ...f, images: [...f.images, data.url] }));
    } catch (e: any) {
      showToast(e.message || 'Upload failed', 'error');
    } finally {
      setUploadingImg(false);
      if (imgInputRef.current) imgInputRef.current.value = '';
    }
  };

  const removeImage = (idx: number) => {
    setForm(f => ({ ...f, images: f.images.filter((_, i) => i !== idx) }));
  };

  const handleSave = async () => {
    if (!form.title.trim()) { showToast(t('Title is required', '请填写标题'), 'error'); return; }
    setSaving(true);
    try {
      const body = {
        title: form.title.trim(),
        description: form.description.trim() || null,
        location: form.location.trim() || null,
        area_sqm: form.area_sqm ? Number(form.area_sqm) : null,
        budget: form.budget.trim() || null,
        year: form.year.trim() || null,
        images: form.images,
      };
      let data: any;
      if (editingProject) {
        data = await adminApi.request(`/suppliers/${supplierId}/projects/${editingProject.id}`, {
          method: 'PUT', body: JSON.stringify(body),
        });
      } else {
        data = await adminApi.request(`/suppliers/${supplierId}/projects`, {
          method: 'POST', body: JSON.stringify(body),
        });
      }
      const proj = {
        ...data.project,
        images: (() => {
          const raw = data.project?.images;
          if (Array.isArray(raw)) return raw;
          try { return JSON.parse(raw || '[]'); } catch { return []; }
        })(),
      };
      onSaved(proj, !editingProject);
      showToast(editingProject ? t('Project updated', '项目已更新') : t('Project added', '项目已添加'), 'success');
    } catch (e: any) {
      showToast(e.message || t('Save failed', '保存失败'), 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-stone-100">
          <h2 className="text-base font-bold text-[#2c2c2c]">
            {editingProject ? t('Edit Project', '编辑项目') : t('Add Project', '添加项目')}
          </h2>
          <button onClick={onClose} className="text-stone-400 hover:text-stone-600 p-1">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Title */}
          <div>
            <label className="block text-xs font-medium text-stone-500 mb-1">{t('Title *', '标题 *')}</label>
            <input type="text" value={form.title} onChange={e => set('title', e.target.value)}
              placeholder={t('e.g. Modern Living Room Renovation', '如：现代风格客厅改造')}
              className={inputCls} />
          </div>

          {/* Location + Year */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-stone-500 mb-1">{t('Location', '地点')}</label>
              <input type="text" value={form.location} onChange={e => set('location', e.target.value)}
                placeholder="Dubai" className={inputCls} />
            </div>
            <div>
              <label className="block text-xs font-medium text-stone-500 mb-1">{t('Year', '年份')}</label>
              <input type="text" value={form.year} onChange={e => set('year', e.target.value)}
                placeholder="2024" className={inputCls} />
            </div>
          </div>

          {/* Area + Budget */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-stone-500 mb-1">{t('Area (m²)', '面积（㎡）')}</label>
              <input type="number" value={form.area_sqm} onChange={e => set('area_sqm', e.target.value)}
                placeholder="120" className={inputCls} />
            </div>
            <div>
              <label className="block text-xs font-medium text-stone-500 mb-1">{t('Budget', '预算')}</label>
              <input type="text" value={form.budget} onChange={e => set('budget', e.target.value)}
                placeholder="AED 50,000" className={inputCls} />
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-medium text-stone-500 mb-1">{t('Description', '描述')}</label>
            <textarea value={form.description} onChange={e => set('description', e.target.value)}
              rows={3} placeholder={t('Project description...', '项目描述...')}
              className="w-full px-3 py-2 rounded-lg border border-stone-200 bg-stone-50 text-sm text-[#1c1917] placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-[#B8864A]/15 focus:border-[#B8864A] resize-none" />
          </div>

          {/* Images */}
          <div>
            <label className="block text-xs font-medium text-stone-500 mb-2">
              {t('Images', '图片')} ({form.images.length})
            </label>
            {form.images.length > 0 && (
              <div className="grid grid-cols-4 gap-2 mb-2">
                {form.images.map((url, i) => (
                  <div key={i} className="relative aspect-square rounded-lg overflow-hidden bg-stone-100 group">
                    <img src={url} alt="" className="w-full h-full object-cover" />
                    <button
                      onClick={() => removeImage(i)}
                      className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/60 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <input
              ref={imgInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={e => {
                const file = e.target.files?.[0];
                if (file) handleUploadImage(file);
              }}
            />
            <button
              onClick={() => imgInputRef.current?.click()}
              disabled={uploadingImg}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-dashed border-stone-300 text-xs text-stone-500 hover:border-[#b8864a] hover:text-[#b8864a] transition disabled:opacity-50"
            >
              <Upload className="w-3.5 h-3.5" />
              {uploadingImg ? t('Uploading...', '上传中...') : t('Upload Image', '上传图片')}
            </button>
          </div>
        </div>

        <div className="flex justify-end gap-2 px-5 pb-5">
          <button onClick={onClose}
            className="px-4 py-2 rounded-lg bg-stone-100 text-stone-600 text-sm font-medium hover:bg-stone-200 transition">
            {t('Cancel', '取消')}
          </button>
          <button onClick={handleSave} disabled={saving}
            className="px-4 py-2 rounded-lg bg-[#b8864a] text-white text-sm font-medium hover:bg-[#a07540] disabled:opacity-50 transition">
            {saving ? t('Saving...', '保存中...') : t('Save', '保存')}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Product Edit Modal ────────────────────────────────────────────────────────
interface ProductEditModalProps {
  supplierId: number;
  product: any;
  onClose: () => void;
  onSaved: (product: any) => void;
  t: (en: string, zh: string) => string;
}

function ProductEditModal({ supplierId, product, onClose, onSaved, t }: ProductEditModalProps) {
  const [title, setTitle] = useState(product.title || '');
  const [category, setCategory] = useState(product.category || '');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      const data = await adminApi.request(`/suppliers/${supplierId}/products/${product.id}`, {
        method: 'PUT',
        body: JSON.stringify({ title: title.trim() || null, category: category || null }),
      });
      onSaved(data.product);
      showToast(t('Product updated', '产品已更新'), 'success');
    } catch (e: any) {
      showToast(e.message || t('Save failed', '保存失败'), 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm">
        <div className="flex items-center justify-between p-5 border-b border-stone-100">
          <h2 className="text-base font-bold text-[#2c2c2c]">{t('Edit Product', '编辑产品')}</h2>
          <button onClick={onClose} className="text-stone-400 hover:text-stone-600 p-1">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-5 space-y-4">
          {product.image_url && (
            <img src={product.image_url} alt="" className="w-full aspect-[4/3] object-cover rounded-lg bg-stone-100" />
          )}
          <div>
            <label className="block text-xs font-medium text-stone-500 mb-1">{t('Title', '名称')}</label>
            <input type="text" value={title} onChange={e => setTitle(e.target.value)}
              placeholder={t('Product title', '产品名称')} className={inputCls} />
          </div>
          <div>
            <label className="block text-xs font-medium text-stone-500 mb-1">{t('Category', '分类')}</label>
            <select value={category} onChange={e => setCategory(e.target.value)}
              className={inputCls + ' cursor-pointer'}>
              <option value="">{t('No category', '不分类')}</option>
              {PRODUCT_CATEGORIES.map(c => (
                <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="flex justify-end gap-2 px-5 pb-5">
          <button onClick={onClose}
            className="px-4 py-2 rounded-lg bg-stone-100 text-stone-600 text-sm font-medium hover:bg-stone-200 transition">
            {t('Cancel', '取消')}
          </button>
          <button onClick={handleSave} disabled={saving}
            className="px-4 py-2 rounded-lg bg-[#b8864a] text-white text-sm font-medium hover:bg-[#a07540] disabled:opacity-50 transition">
            {saving ? t('Saving...', '保存中...') : t('Save', '保存')}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
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

  // Project modal state
  const [showProjectModal, setShowProjectModal] = useState(false);
  const [editingProject, setEditingProject] = useState<any | null>(null);

  // Product edit modal state
  const [editingProduct, setEditingProduct] = useState<any | null>(null);

  const handleReplaceImage = async (file: File, productId: number) => {
    if (!supplier) return;
    setReplacingId(productId);
    try {
      const result = await adminApi.replaceSupplierProductImage(supplier.id, productId, file);
      const bust = `${result.image_url}?t=${Date.now()}`;
      setProducts(prev => prev.map(p => p.id === productId ? { ...p, image_url: bust } : p));
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
      await adminApi.request(`/suppliers/${id}/status`, { method: 'PUT', body: JSON.stringify({ status }) });
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
      await adminApi.request(`/suppliers/${id}`, { method: 'PUT', body: JSON.stringify({ cover_image_url: imgUrl }) });
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
    if (!newProduct.image_url.trim()) { showToast(t('Image URL is required', '请填写图片地址'), 'error'); return; }
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

  const handleDeleteProject = async (projectId: number) => {
    if (!confirm(t('Delete this project?', '确认删除该项目？'))) return;
    try {
      await adminApi.request(`/suppliers/${id}/projects/${projectId}`, { method: 'DELETE' });
      setProjects(prev => prev.filter(p => p.id !== projectId));
      showToast(t('Project deleted', '项目已删除'), 'success');
    } catch {
      showToast(t('Failed to delete', '删除失败'), 'error');
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

      {/* Hidden file input for product image replace */}
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

      {/* Project Modal */}
      {showProjectModal && supplier && (
        <ProjectModal
          supplierId={supplier.id}
          editingProject={editingProject}
          onClose={() => { setShowProjectModal(false); setEditingProject(null); }}
          onSaved={(proj, isNew) => {
            if (isNew) {
              setProjects(prev => [proj, ...prev]);
            } else {
              setProjects(prev => prev.map(p => p.id === proj.id ? proj : p));
            }
            setShowProjectModal(false);
            setEditingProject(null);
          }}
          t={t}
        />
      )}

      {/* Product Edit Modal */}
      {editingProduct && supplier && (
        <ProductEditModal
          supplierId={supplier.id}
          product={editingProduct}
          onClose={() => setEditingProduct(null)}
          onSaved={(updated) => {
            setProducts(prev => prev.map(p => p.id === updated.id ? { ...p, ...updated } : p));
            setEditingProduct(null);
          }}
          t={t}
        />
      )}

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
            {supplier.logo_url && (
              <SmartImage
                src={supplier.logo_url}
                alt={supplier.company_name}
                className="w-16 h-16 rounded-xl object-contain bg-stone-50 border border-stone-100"
              />
            )}
            <h1 className="text-lg font-bold text-stone-800 leading-snug">{supplier.company_name}</h1>
            <div className="flex flex-wrap gap-1.5">
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                supplier.origin === 'china' ? 'bg-red-50 text-red-600' : 'bg-stone-100 text-stone-600'
              }`}>
                {supplier.origin === 'china' ? '🇨🇳 China' : '🇦🇪 Dubai'}
              </span>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[supplier.status] || 'bg-stone-100 text-stone-600'}`}>
                {supplier.status}
              </span>
            </div>
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
                  target="_blank" rel="noopener noreferrer"
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
            {supplier.description && (
              <p className="text-sm text-stone-600 leading-relaxed">{supplier.description}</p>
            )}
            {supplier.status === 'pending' && (
              <div className="flex gap-2 pt-1">
                <button onClick={() => handleStatus('approved')} disabled={isSubmitting}
                  className="flex-1 py-2 rounded-lg bg-green-600 text-white text-sm font-medium hover:bg-green-700 disabled:opacity-50 transition">
                  {t('Approve', '通过')}
                </button>
                <button onClick={() => handleStatus('rejected')} disabled={isSubmitting}
                  className="flex-1 py-2 rounded-lg bg-red-50 text-red-600 text-sm font-medium hover:bg-red-100 border border-red-200 disabled:opacity-50 transition">
                  {t('Reject', '拒绝')}
                </button>
              </div>
            )}
            {supplier.status === 'approved' && (
              <button onClick={() => handleStatus('rejected')} disabled={isSubmitting}
                className="w-full py-2 rounded-lg bg-red-50 text-red-600 text-sm font-medium hover:bg-red-100 border border-red-200 disabled:opacity-50 transition">
                {t('Reject', '拒绝')}
              </button>
            )}
            {supplier.status === 'rejected' && (
              <button onClick={() => handleStatus('approved')} disabled={isSubmitting}
                className="w-full py-2 rounded-lg bg-green-600 text-white text-sm font-medium hover:bg-green-700 disabled:opacity-50 transition">
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

          {/* Card 3: Cover Preview */}
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
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-stone-500 uppercase tracking-wider flex items-center gap-2">
                <Layers className="w-4 h-4" />
                {t('Projects', '项目')}
                <span className="font-normal text-stone-400 normal-case tracking-normal">({projects.length})</span>
              </h2>
              <button
                onClick={() => { setEditingProject(null); setShowProjectModal(true); }}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-lg bg-[#b8864a]/10 text-[#b8864a] hover:bg-[#b8864a]/20 transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                {t('Add Project', '添加项目')}
              </button>
            </div>

            {projects.length === 0 ? (
              <div className="bg-white rounded-xl border border-stone-200 p-8 text-center text-stone-400 text-sm">
                {t('No projects yet', '暂无项目')}
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-4">
                {projects.map(proj => {
                  const imgs = Array.isArray(proj.images) ? proj.images : [];
                  return (
                    <div key={proj.id} className="bg-white rounded-xl border border-stone-200 overflow-hidden group relative">
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
                        {/* Edit + Delete overlay */}
                        <div className="absolute top-1.5 right-1.5 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => { setEditingProject(proj); setShowProjectModal(true); }}
                            className="w-6 h-6 rounded-md bg-white/95 text-stone-700 flex items-center justify-center shadow-sm hover:bg-[#b8864a] hover:text-white transition-colors"
                            title={t('Edit', '编辑')}
                          >
                            <Pencil className="w-3 h-3" />
                          </button>
                          <button
                            onClick={() => handleDeleteProject(proj.id)}
                            className="w-6 h-6 rounded-md bg-white/95 text-stone-700 flex items-center justify-center shadow-sm hover:bg-red-500 hover:text-white transition-colors"
                            title={t('Delete', '删除')}
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
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
                  className={inputCls}
                />
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder={t('Title (optional)', '名称（可选）')}
                    value={newProduct.title}
                    onChange={e => setNewProduct(v => ({ ...v, title: e.target.value }))}
                    className={inputCls + ' flex-1'}
                  />
                  <select
                    value={newProduct.category}
                    onChange={e => setNewProduct(v => ({ ...v, category: e.target.value }))}
                    className="h-9 px-3 rounded-lg border border-stone-200 bg-stone-50 text-sm text-[#1c1917] focus:outline-none focus:ring-2 focus:ring-[#B8864A]/15 focus:border-[#B8864A]"
                  >
                    <option value="">{t('Category', '分类')}</option>
                    {PRODUCT_CATEGORIES.map(c => (
                      <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>
                    ))}
                  </select>
                </div>
                <div className="flex gap-2">
                  <button onClick={handleAddProduct} disabled={addingProduct}
                    className="px-4 py-1.5 rounded-lg bg-[#b8864a] text-white text-xs font-medium hover:bg-[#a07540] disabled:opacity-50 transition">
                    {addingProduct ? t('Adding...', '添加中...') : t('Add', '确认添加')}
                  </button>
                  <button
                    onClick={() => { setShowAddProduct(false); setNewProduct({ image_url: '', title: '', category: '' }); }}
                    className="px-4 py-1.5 rounded-lg bg-stone-100 text-stone-600 text-xs font-medium hover:bg-stone-200 transition">
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
                        {/* Delete — top right */}
                        <button
                          onClick={() => handleDeleteProduct(p.id)}
                          className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-black/60 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600"
                          title={t('Delete', '删除')}
                        >
                          <X className="w-3 h-3" />
                        </button>
                        {/* Edit — top left */}
                        <button
                          onClick={() => setEditingProduct(p)}
                          className="absolute top-1.5 left-1.5 inline-flex items-center gap-1 px-2 py-1 rounded-md bg-white/95 text-stone-700 text-[10px] font-medium shadow-md opacity-0 group-hover:opacity-100 transition-opacity hover:bg-[#b8864a] hover:text-white"
                          title={t('Edit', '编辑')}
                        >
                          <Pencil className="w-3 h-3" />
                          {t('Edit', '编辑')}
                        </button>
                        {/* Replace — triggered from edit button area, kept for compatibility */}
                        <button
                          onClick={() => {
                            replaceTargetRef.current = p.id;
                            fileInputRef.current?.click();
                          }}
                          disabled={replacingId === p.id}
                          className="absolute bottom-0 inset-x-0 py-1 bg-black/60 text-white text-[10px] font-medium opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1"
                          title={t('Replace image', '更换图片')}
                        >
                          {replacingId === p.id
                            ? <span className="text-[10px]">…</span>
                            : <Upload className="w-3 h-3" />}
                          {t('Replace Image', '更换图片')}
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
                    target="_blank" rel="noopener noreferrer"
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

      {/* Delete Supplier confirm modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl p-6 shadow-xl max-w-sm w-full mx-4 space-y-4">
            <h2 className="text-base font-bold text-[#2c2c2c]">{t('Delete Supplier?', '删除供应商？')}</h2>
            <p className="text-sm text-stone-500">
              {t('This will permanently delete the supplier and all their data. This cannot be undone.', '这将永久删除该供应商及其所有数据，无法恢复。')}
            </p>
            <div className="flex gap-2 pt-1">
              <button onClick={handleDelete} disabled={isSubmitting}
                className="flex-1 py-2 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700 disabled:opacity-50 transition">
                {t('Delete', '确认删除')}
              </button>
              <button onClick={() => setShowDeleteModal(false)}
                className="flex-1 py-2 rounded-lg bg-stone-100 text-stone-600 text-sm font-medium hover:bg-stone-200 transition">
                {t('Cancel', '取消')}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
