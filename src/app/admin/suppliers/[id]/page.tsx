'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter, useParams, useSearchParams } from 'next/navigation';
import { adminApi } from '@/lib/adminApi';
import { resolveImageUrl } from '@/lib/imageUrl';
import SupplierEditModal from '@/components/admin/SupplierEditModal';
import { useAdminT } from '@/hooks/useAdminLang';
import { showToast } from '@/components/ui/Toast';
import SmartImage from '@/components/ui/SmartImage';
import {
  ArrowLeft, Trash2, ExternalLink, Pencil, Check, Star,
  Package, Layers, FolderOpen, FileText, Download, MapPin, ImageIcon,
  Plus, X, Upload, Eye, EyeOff,
} from 'lucide-react';
import { PRODUCT_CURRENCIES, parsePriceInput } from '@/lib/supplierProductUnits';

function InfoRow({ label, value, isLink }: { label: string; value: string; isLink?: boolean }) {
  return (
    <div className="flex gap-2">
      <span className="text-stone-400 w-20 flex-shrink-0 text-sm">{label}</span>
      {isLink ? (
        <a href={value} target="_blank" rel="noopener noreferrer" className="text-[#b8864a] hover:underline truncate text-sm">{value}</a>
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

// 表单配色铁律(AGENTS.md)：输入框背景必须 bg-white，禁 bg-stone-50 灰底
const inputCls = 'w-full h-9 px-3 rounded-lg border border-stone-200 bg-white text-sm text-[#1c1917] placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-[#B8864A]/15 focus:border-[#B8864A]';
const whiteInputCls = inputCls;

/* ── 产品补充字段（specs / certifications / application_scenes）── */

// 应用场景 slug（本页独立来源；主站无公开材料 feed）
const APPLICATION_SCENES: { slug: string; label: string }[] = [
  { slug: 'feature-wall', label: 'Feature Walls' },
  { slug: 'flooring', label: 'Flooring' },
  { slug: 'countertop', label: 'Countertops & Surfaces' },
  { slug: 'kitchen-bath', label: 'Kitchen & Bath' },
  { slug: 'lighting', label: 'Lighting' },
  { slug: 'furniture', label: 'Furniture' },
  { slug: 'outdoor-garden', label: 'Outdoor & Garden' },
  { slug: 'decor', label: 'Décor & Accents' },
];

// 场景中文标注（slug 与 APPLICATION_SCENES 对齐）
const SCENE_ZH: Record<string, string> = {
  'feature-wall': '特色墙',
  'flooring': '地面',
  'countertop': '台面',
  'kitchen-bath': '厨卫',
  'lighting': '灯光',
  'furniture': '家具',
  'outdoor-garden': '户外',
  'decor': '软装',
};

interface ProductSpecRow { label: string; value: string }

interface ProductExtraFields {
  specs: ProductSpecRow[];
  certifications: string[];
  application_scenes: string[];
}

function emptyExtraFields(): ProductExtraFields {
  return { specs: [], certifications: [], application_scenes: [] };
}

/** 后端可能返回 JSON 字符串或已 parse 的数组，两种都兼容 */
function parseJsonArray<T>(raw: unknown): T[] {
  if (Array.isArray(raw)) return raw as T[];
  if (typeof raw === 'string' && raw.trim()) {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? (parsed as T[]) : [];
    } catch { return []; }
  }
  return [];
}

function productToExtraFields(p: { specs?: unknown; certifications?: unknown; application_scenes?: unknown }): ProductExtraFields {
  return {
    specs: parseJsonArray<ProductSpecRow>(p.specs).map(s => ({ label: String(s?.label ?? ''), value: String(s?.value ?? '') })),
    certifications: parseJsonArray<string>(p.certifications).map(String),
    application_scenes: parseJsonArray<string>(p.application_scenes).map(String),
  };
}

/** 提交前清洗：specs 去掉空行、certifications 去空白 */
function cleanExtraFields(e: ProductExtraFields): ProductExtraFields {
  return {
    specs: e.specs.map(s => ({ label: s.label.trim(), value: s.value.trim() })).filter(s => s.label && s.value),
    certifications: e.certifications.map(c => c.trim()).filter(Boolean),
    application_scenes: e.application_scenes,
  };
}

function ProductExtraFieldsEditor({ value, onChange, t }: {
  value: ProductExtraFields;
  onChange: (v: ProductExtraFields) => void;
  t: (en: string, zh: string) => string;
}) {
  const [certInput, setCertInput] = useState('');

  const setSpec = (idx: number, key: keyof ProductSpecRow, v: string) => {
    onChange({ ...value, specs: value.specs.map((s, i) => i === idx ? { ...s, [key]: v } : s) });
  };
  const addSpecRow = () => onChange({ ...value, specs: [...value.specs, { label: '', value: '' }] });
  const removeSpecRow = (idx: number) => onChange({ ...value, specs: value.specs.filter((_, i) => i !== idx) });

  const addCert = () => {
    const c = certInput.trim();
    if (!c) return;
    if (!value.certifications.includes(c)) {
      onChange({ ...value, certifications: [...value.certifications, c] });
    }
    setCertInput('');
  };
  const removeCert = (c: string) => onChange({ ...value, certifications: value.certifications.filter(x => x !== c) });

  const toggleScene = (slug: string) => {
    onChange({
      ...value,
      application_scenes: value.application_scenes.includes(slug)
        ? value.application_scenes.filter(s => s !== slug)
        : [...value.application_scenes, slug],
    });
  };

  return (
    <div className="space-y-4">
      {/* 规格（键值对行编辑器） */}
      <div>
        <label className="block text-xs font-medium text-stone-500 mb-1.5">{t('Specs', '规格')}</label>
        <div className="space-y-2">
          {value.specs.map((s, i) => (
            <div key={i} className="flex items-center gap-2">
              <input
                type="text"
                value={s.label}
                onChange={e => setSpec(i, 'label', e.target.value)}
                placeholder={t('Label (e.g. Thickness)', '名称（如 厚度）')}
                className={whiteInputCls + ' flex-1'}
              />
              <input
                type="text"
                value={s.value}
                onChange={e => setSpec(i, 'value', e.target.value)}
                placeholder={t('Value (e.g. 12mm)', '值（如 12mm）')}
                className={whiteInputCls + ' flex-1'}
              />
              <button
                type="button"
                onClick={() => removeSpecRow(i)}
                className="w-7 h-7 flex items-center justify-center rounded-lg text-stone-400 hover:text-red-500 hover:bg-red-50 transition shrink-0"
                title={t('Remove row', '删除该行')}
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={addSpecRow}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-dashed border-stone-300 text-xs text-stone-500 hover:border-[#b8864a] hover:text-[#b8864a] transition"
          >
            <Plus className="w-3.5 h-3.5" />{t('Add Spec', '添加规格')}
          </button>
        </div>
      </div>

      {/* 认证（标签输入：回车添加，点 x 删除） */}
      <div>
        <label className="block text-xs font-medium text-stone-500 mb-1.5">{t('Certifications', '认证')}</label>
        {value.certifications.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-2">
            {value.certifications.map(c => (
              <span key={c} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-stone-100 text-stone-700 text-xs">
                {c}
                <button
                  type="button"
                  onClick={() => removeCert(c)}
                  className="text-stone-400 hover:text-red-500 transition"
                  title={t('Remove', '删除')}
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
          </div>
        )}
        <input
          type="text"
          value={certInput}
          onChange={e => setCertInput(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter') { e.preventDefault(); addCert(); }
          }}
          placeholder={t('Type and press Enter (e.g. CE / ISO 9001)', '输入后回车添加（如 CE / ISO 9001）')}
          className={whiteInputCls}
        />
      </div>

      {/* 应用场景（多选） */}
      <div>
        <label className="block text-xs font-medium text-stone-500 mb-1.5">{t('Application Scenes', '应用场景')}</label>
        <div className="grid grid-cols-2 gap-x-3 gap-y-1.5">
          {APPLICATION_SCENES.map(scene => (
            <label key={scene.slug} className="flex items-center gap-2 text-sm text-stone-700 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={value.application_scenes.includes(scene.slug)}
                onChange={() => toggleScene(scene.slug)}
                className="accent-[#b8864a]"
              />
              {t(scene.label, SCENE_ZH[scene.slug] ?? scene.label)}
            </label>
          ))}
        </div>
      </div>
    </div>
  );
}

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

function projectToForm(p: { title?: string; location?: string; year?: number; area_sqm?: number; budget?: string; description?: string; images?: string[] | string }): ProjectFormState {
  const imgs = Array.isArray(p.images) ? p.images
    : (() => { try { return JSON.parse((p.images as string) || '[]'); } catch { return []; } })();
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
  editingProject: { id?: number; title?: string; location?: string; year?: number; area_sqm?: number; budget?: string; description?: string; images?: string[] | string } | null;
  onClose: () => void;
  onSaved: (project: { id: number; images: string[]; title?: string }, isNew: boolean) => void;
  t: (en: string, zh: string) => string;
}

function ProjectModal({ supplierId, editingProject, onClose, onSaved, t }: ProjectModalProps) {
  const [form, setForm] = useState<ProjectFormState>(
    editingProject ? projectToForm(editingProject) : emptyProjectForm()
  );
  const [saving, setSaving] = useState(false);
  const [uploadingImg, setUploadingImg] = useState(false);
  const [activeImg, setActiveImg] = useState(0);
  const imgInputRef = useRef<HTMLInputElement>(null);

  const set = (k: keyof ProjectFormState, v: string) => setForm(f => ({ ...f, [k]: v }));

  const handleUploadImage = async (file: File) => {
    setUploadingImg(true);
    try {
      const fd = new FormData();
      fd.append('file', file, file.name);
      const token = adminApi.getToken();
      const API_BASE = (process.env.NEXT_PUBLIC_API_URL?.trim() || '/api') + '/admin';
      const res = await fetch(`${API_BASE}/suppliers/${supplierId}/project-image`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        body: fd,
      });
      if (!res.ok) throw new Error(`Upload failed: ${res.status}`);
      const data = await res.json();
      setForm(f => ({ ...f, images: [...f.images, data.url] }));
      setActiveImg(Number.MAX_SAFE_INTEGER); // 上传后展示最新图(curIdx 会钳到最后一张)
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : 'Upload failed', 'error');
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
      let data: { project: { id: number; images: string[] | string; title?: string } };
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
          try { return JSON.parse((raw as string) || '[]'); } catch { return []; }
        })(),
      };
      onSaved(proj, !editingProject);
      showToast(editingProject ? t('Project updated', '项目已更新') : t('Project added', '项目已添加'), 'success');
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : t('Save failed', '保存失败'), 'error');
    } finally {
      setSaving(false);
    }
  };

  const curIdx = form.images.length ? Math.min(activeImg, form.images.length - 1) : 0;
  // 图库(大图+缩略图+上传/删除)——桌面在左栏、移动在右栏顶部复用
  const gallery = (
    <>
      <div className="relative flex flex-1 items-center justify-center overflow-hidden p-4">
        {form.images.length > 0
          ? <img src={resolveImageUrl(form.images[curIdx])} alt="" className="max-h-full max-w-full object-contain" />
          : <span className="text-sm text-stone-400">{t('No image yet', '暂无图片')}</span>}
        {form.images.length > 1 && (
          <>
            <button type="button" onClick={() => setActiveImg(Math.max(0, curIdx - 1))} disabled={curIdx === 0} className="absolute left-3 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-white/80 text-stone-700 shadow hover:bg-white disabled:opacity-30">‹</button>
            <button type="button" onClick={() => setActiveImg(Math.min(form.images.length - 1, curIdx + 1))} disabled={curIdx === form.images.length - 1} className="absolute right-3 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-white/80 text-stone-700 shadow hover:bg-white disabled:opacity-30">›</button>
          </>
        )}
      </div>
      <div className="flex shrink-0 gap-2 overflow-x-auto border-t border-stone-200 bg-white p-3">
        {form.images.map((url, i) => (
          <div key={i} className="relative shrink-0">
            <button type="button" onClick={() => setActiveImg(i)} className={`h-14 w-20 overflow-hidden rounded-lg border-2 ${i === curIdx ? 'border-[#b8864a]' : 'border-transparent opacity-70 hover:opacity-100'}`}>
              <img src={resolveImageUrl(url)} alt="" className="h-full w-full object-cover" />
            </button>
            <button type="button" onClick={() => removeImage(i)} className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-white hover:bg-red-600"><X className="h-3 w-3" /></button>
          </div>
        ))}
        <button type="button" onClick={() => imgInputRef.current?.click()} disabled={uploadingImg} className="flex h-14 w-20 shrink-0 flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-stone-300 text-[10px] text-stone-400 hover:border-[#b8864a] hover:text-[#b8864a] disabled:opacity-50">
          <Upload className="h-4 w-4" />{uploadingImg ? '...' : t('Add', '上传')}
        </button>
      </div>
    </>
  );
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      {/* 上传 input 只渲一次(桌面/移动图库共用同一 ref,避免两个 input 抢 ref) */}
      <input ref={imgInputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={e => { const file = e.target.files?.[0]; if (file) handleUploadImage(file); }} />
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-7xl h-[88vh] flex overflow-hidden">
        {/* 左 7：图库 */}
        <div className="hidden md:flex md:w-[70%] flex-col bg-stone-100">{gallery}</div>
        {/* 右 3：属性字段(可编辑) */}
        <div className="flex w-full flex-col border-l border-stone-100 md:w-[30%]">
          <div className="flex shrink-0 items-center justify-between border-b border-stone-100 px-4 py-3">
            <h2 className="text-sm font-bold text-[#2c2c2c]">{editingProject ? t('Edit Project', '编辑项目') : t('Add Project', '添加项目')}</h2>
            <button onClick={onClose} className="p-1 text-stone-400 hover:text-stone-600"><X className="h-5 w-5" /></button>
          </div>
          <div className="flex-1 space-y-4 overflow-y-auto p-4">
            {/* 移动端图库(桌面在左栏) */}
            <div className="flex flex-col rounded-lg bg-stone-100 md:hidden">{gallery}</div>
            <div>
              <label className="mb-1 block text-xs font-medium text-stone-500">{t('Title *', '标题 *')}</label>
              <input type="text" value={form.title} onChange={e => set('title', e.target.value)} placeholder={t('e.g. Modern Living Room Renovation', '如：现代风格客厅改造')} className={inputCls} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-stone-500">{t('Location', '地点')}</label>
              <input type="text" value={form.location} onChange={e => set('location', e.target.value)} placeholder="Dubai" className={inputCls} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-stone-500">{t('Year', '年份')}</label>
              <input type="text" value={form.year} onChange={e => set('year', e.target.value)} placeholder="2024" className={inputCls} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-stone-500">{t('Area (m²)', '面积（㎡）')}</label>
              <input type="number" value={form.area_sqm} onChange={e => set('area_sqm', e.target.value)} placeholder="120" className={inputCls} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-stone-500">{t('Budget', '预算')}</label>
              <input type="text" value={form.budget} onChange={e => set('budget', e.target.value)} placeholder="AED 50,000" className={inputCls} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-stone-500">{t('Description', '描述')}</label>
              <textarea value={form.description} onChange={e => set('description', e.target.value)} rows={4} placeholder={t('Project description...', '项目描述...')} className="w-full resize-none rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm text-[#1c1917] placeholder:text-stone-400 focus:border-[#B8864A] focus:outline-none focus:ring-2 focus:ring-[#B8864A]/15" />
            </div>
          </div>
          <div className="flex shrink-0 justify-end gap-2 border-t border-stone-100 px-4 py-3">
            <button onClick={onClose} className="rounded-lg bg-stone-100 px-4 py-2 text-sm font-medium text-stone-600 transition hover:bg-stone-200">{t('Cancel', '取消')}</button>
            <button onClick={handleSave} disabled={saving} className="rounded-lg bg-[#b8864a] px-4 py-2 text-sm font-medium text-white transition hover:bg-[#a07540] disabled:opacity-50">
              {saving ? t('Saving...', '保存中...') : t('Save', '保存')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

interface ProductEditModalProps {
  supplierId: number;
  product: { id: number; image_url?: string; title?: string; category?: string; description?: string | null; price?: number | string | null; price_unit?: string | null; price_currency?: string | null; price_from?: number | string | null; specs?: unknown; certifications?: unknown; application_scenes?: unknown };
  onClose: () => void;
  onSaved: (product: { id: number; title?: string; category?: string; specs?: unknown; certifications?: unknown; application_scenes?: unknown }) => void;
  t: (en: string, zh: string) => string;
}

function ProductEditModal({ supplierId, product, onClose, onSaved, t }: ProductEditModalProps) {
  const [title, setTitle] = useState(product.title || '');
  const [category, setCategory] = useState(product.category || '');
  const [description, setDescription] = useState(product.description || '');
  const [price, setPrice] = useState(product.price != null ? String(product.price) : '');
  const [priceUnit, setPriceUnit] = useState(product.price_unit || '');
  // '' = 未指定（沿用旧数据语义：展示层按供应商国家回落）。绝不默认成 AED——
  // 否则管理员一保存就把 VN 供应商的"未指定"硬写成 AED。
  const [priceCurrency, setPriceCurrency] = useState(product.price_currency || '');
  // price_from 是布尔标志（价格是否显示为"起价"），不是数值
  const [priceFrom, setPriceFrom] = useState(!!product.price_from);
  const [extras, setExtras] = useState<ProductExtraFields>(() => productToExtraFields(product));
  const [saving, setSaving] = useState(false);
  // 描述框:默认4行(min-h),超4行随内容自动撑高
  const descRef = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const el = descRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = el.scrollHeight + 'px';
  }, [description]);
  // 品类下拉：接后台可管理的「产品分类」(子类按大类分组)，替代写死常量
  const [catGroups, setCatGroups] = useState<Array<{ value: string; label: string; children: Array<{ value: string; label: string }> }>>([]);
  useEffect(() => {
    adminApi.request('/enums/product-categories').then((d) => {
      const rows = (d.categories || []) as Array<{ value: string; label: string; parent_value: string | null; is_enabled: number }>;
      const on = rows.filter((r) => r.is_enabled);
      setCatGroups(on.filter((r) => !r.parent_value).map((g) => ({ value: g.value, label: g.label, children: on.filter((c) => c.parent_value === g.value) })));
    }).catch(() => { /* 拉不到就只保留当前值 */ });
  }, []);
  const catInList = catGroups.some((g) => g.children.some((c) => c.value === category));

  const handleSave = async () => {
    // 价格留空 = 清除价格（合法）；填了但解析不出数字则中止，绝不静默存成 null
    const parsed = parsePriceInput(price);
    if (!parsed.ok && parsed.reason !== 'empty') {
      showToast(parsed.reason === 'range'
        ? t('Price must be a single number, not a range. Enter the lowest price and tick "from".', '价格只能填一个数字，不能填区间。请填最低价并勾选「起」价。')
        : t('Please enter a valid number greater than 0.', '请填写大于 0 的数字。'), 'error');
      return;
    }
    setSaving(true);
    try {
      const cleaned = cleanExtraFields(extras);
      const data = await adminApi.request(`/suppliers/${supplierId}/products/${product.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          title: title.trim() || null,
          category: category || null,
          description: description.trim() || null,
          price: parsed.ok ? parsed.value : null,
          price_unit: priceUnit.trim() || null,
          price_currency: parsed.ok ? (priceCurrency || null) : null,
          price_from: priceFrom ? 1 : 0,
          specs: cleaned.specs,
          certifications: cleaned.certifications,
          application_scenes: cleaned.application_scenes,
        }),
      });
      onSaved(data.product);
      showToast(t('Product updated', '产品已更新'), 'success');
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : t('Save failed', '保存失败'), 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      {/* 7:3 布局——左大图(浅底,非黑 lightbox)占大头,右侧一列 input */}
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-7xl h-[88vh] flex overflow-hidden">
        {/* 左 7：大图——object-contain 完整显示全图(不裁切),浅底,居中留白 */}
        <div className="hidden md:flex md:w-[70%] items-center justify-center bg-stone-100 overflow-hidden p-4">
          {product.image_url
            ? <img src={resolveImageUrl(product.image_url)} alt={title || ''} className="max-w-full max-h-full object-contain" />
            : <span className="text-stone-400 text-sm">{t('No image', '无图片')}</span>}
        </div>
        {/* 右 3：输入列 */}
        <div className="flex w-full flex-col md:w-[30%] min-w-0 border-l border-stone-100">
          <div className="flex items-center justify-between border-b border-stone-100 px-4 py-3 shrink-0">
            <h2 className="text-sm font-bold text-[#2c2c2c]">{t('Edit Product', '编辑产品')}</h2>
            <button onClick={onClose} className="text-stone-400 hover:text-stone-600 p-1"><X className="w-5 h-5" /></button>
          </div>
          <div className="flex-1 space-y-4 overflow-y-auto p-4">
            {/* 移动端顶部小图(桌面端已在左侧大图展示) */}
            {product.image_url && <img src={resolveImageUrl(product.image_url)} alt="" className="md:hidden w-full aspect-video object-cover rounded-lg bg-stone-100" />}
            <div>
              <label className="block text-xs font-medium text-stone-500 mb-1">{t('Title', '名称')}</label>
              <input type="text" value={title} onChange={e => setTitle(e.target.value)} placeholder={t('Product title', '产品名称')} className={inputCls} />
            </div>
            <div>
              <label className="block text-xs font-medium text-stone-500 mb-1">{t('Category', '分类')}</label>
              <select value={category} onChange={e => setCategory(e.target.value)} className={inputCls + ' cursor-pointer'}>
                <option value="">{t('No category', '不分类')}</option>
                {catGroups.map(g => (
                  <optgroup key={g.value} label={g.label}>
                    {g.children.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                  </optgroup>
                ))}
                {/* 当前值不在管理列表里(旧/脏数据)也保留可见，避免保存时丢失 */}
                {category && !catInList && <option value={category}>{category}（{t('current', '当前')}）</option>}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-stone-500 mb-1">{t('Description', '描述')}</label>
              <textarea ref={descRef} value={description} onChange={e => setDescription(e.target.value)} rows={4}
                placeholder={t('Product description', '产品描述')}
                className={inputCls + ' resize-none py-2 leading-relaxed min-h-[108px] overflow-hidden'} />
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="block text-xs font-medium text-stone-500 mb-1">{t('Currency', '币种')}</label>
                <select value={priceCurrency} onChange={e => setPriceCurrency(e.target.value)} className={inputCls + ' cursor-pointer'}>
                  <option value="">{t('By country', '按国家')}</option>
                  {PRODUCT_CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-stone-500 mb-1">{t('Price', '价格')}</label>
                {/* text 而非 number：number 框会把区间价等非法输入静默读成空串，导致价格被清成 null */}
                <input type="text" inputMode="decimal" value={price} onChange={e => setPrice(e.target.value)} placeholder="0" className={inputCls} />
              </div>
              <div>
                <label className="block text-xs font-medium text-stone-500 mb-1">{t('Unit', '单位')}</label>
                <input type="text" value={priceUnit} onChange={e => setPriceUnit(e.target.value)} placeholder={t('e.g. /m²', '如 /m²')} className={inputCls} />
              </div>
            </div>
            <label className="flex items-center gap-2 text-xs font-medium text-stone-600 cursor-pointer select-none">
              <input type="checkbox" checked={priceFrom} onChange={e => setPriceFrom(e.target.checked)} className="h-4 w-4 rounded border-stone-300 text-[#b8864a] focus:ring-[#b8864a]/40" />
              {t("Show price as 'from' (starting price)", '价格显示为「起」价（起步价）')}
            </label>
            <ProductExtraFieldsEditor value={extras} onChange={setExtras} t={t} />
          </div>
          <div className="flex justify-end gap-2 border-t border-stone-100 px-4 py-3 shrink-0">
            <button onClick={onClose} className="px-4 py-2 rounded-lg bg-stone-100 text-stone-600 text-sm font-medium hover:bg-stone-200 transition">{t('Cancel', '取消')}</button>
            <button onClick={handleSave} disabled={saving} className="px-4 py-2 rounded-lg bg-[#b8864a] text-white text-sm font-medium hover:bg-[#a07540] disabled:opacity-50 transition">
              {saving ? t('Saving...', '保存中...') : t('Save', '保存')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function AdminSupplierDetailPage() {
  const routeParams = useParams();
  const id = routeParams?.id as string | undefined;
  const { t } = useAdminT();
  const router = useRouter();
  const searchParams = useSearchParams();
  // 返回目标：从上架统计(?from=report)进来则回到该报表并带回日期筛选，否则回外层供应商列表
  const fromReport = searchParams.get('from') === 'report';
  const backHref = fromReport
    ? `/admin/supplier-report?rf=${encodeURIComponent(searchParams.get('rf') || '')}&rt=${encodeURIComponent(searchParams.get('rt') || '')}`
    : '/admin/suppliers';

  const [supplier, setSupplier] = useState<{
    id: number; company_name: string; logo_url?: string; origin: string; status: string;
    description?: string; cover_image_url?: string; is_published?: number; slug?: string;
    contact_phone?: string; user_phone?: string; whatsapp?: string; website?: string;
    has_physical_store?: boolean; store_address?: string; categories?: string[] | string;
    created_at: string;
  } | null>(null);
  const [products, setProducts] = useState<Array<{ id: number; image_url: string; title?: string; category?: string; description?: string | null; price?: number | string | null; price_unit?: string | null; price_currency?: string | null; price_from?: number | string | null; specs?: unknown; certifications?: unknown; application_scenes?: unknown }>>([]);
  const [projects, setProjects] = useState<Array<{ id: number; title: string; location?: string; year?: number; area_sqm?: number; images: string[]; is_published?: number; description?: string; budget?: string }>>([]);
  const [catalogs, setCatalogs] = useState<Array<{ id: number; title: string; file_url: string; file_size?: number }>>([]);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showAddProduct, setShowAddProduct] = useState(false);
  const [newProduct, setNewProduct] = useState({ image_url: '', title: '', category: '' });
  const [newProductExtras, setNewProductExtras] = useState<ProductExtraFields>(emptyExtraFields());
  // 新增产品的品类下拉也接后台「产品分类」(子类按大类分组)，与编辑弹窗一致
  const [prodCatGroups, setProdCatGroups] = useState<Array<{ value: string; label: string; children: Array<{ value: string; label: string }> }>>([]);
  useEffect(() => {
    adminApi.request('/enums/product-categories').then((d) => {
      const rows = (d.categories || []) as Array<{ value: string; label: string; parent_value: string | null; is_enabled: number }>;
      const on = rows.filter((r) => r.is_enabled);
      setProdCatGroups(on.filter((r) => !r.parent_value).map((g) => ({ value: g.value, label: g.label, children: on.filter((c) => c.parent_value === g.value) })));
    }).catch(() => { /* 拉不到就空 */ });
  }, []);
  const [addingProduct, setAddingProduct] = useState(false);
  const [replacingId, setReplacingId] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const replaceTargetRef = useRef<number | null>(null);
  const [showProjectModal, setShowProjectModal] = useState(false);
  const [editingProject, setEditingProject] = useState<{ id?: number; title?: string; location?: string; year?: number; area_sqm?: number; budget?: string; description?: string; images?: string[] | string } | null>(null);
  const [togglingPublished, setTogglingPublished] = useState(false);
  const [editingProduct, setEditingProduct] = useState<{ id: number; image_url?: string; title?: string; category?: string; description?: string | null; price?: number | string | null; price_unit?: string | null; price_currency?: string | null; price_from?: number | string | null; specs?: unknown; certifications?: unknown; application_scenes?: unknown } | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingCatalogId, setEditingCatalogId] = useState<number | null>(null);
  const [editingCatalogTitle, setEditingCatalogTitle] = useState('');
  const [savingCatalogId, setSavingCatalogId] = useState<number | null>(null);
  const catalogInputRef = useRef<HTMLInputElement>(null);

  const startEditCatalog = (c: { id: number; title: string }) => {
    setEditingCatalogId(c.id);
    setEditingCatalogTitle(c.title);
    setTimeout(() => { catalogInputRef.current?.focus(); catalogInputRef.current?.select(); }, 30);
  };
  const cancelEditCatalog = () => { setEditingCatalogId(null); setEditingCatalogTitle(''); };
  const saveCatalogTitle = async (catalogId: number) => {
    const title = editingCatalogTitle.trim();
    if (!title) { showToast(t('Name cannot be empty', '名称不能为空'), 'error'); return; }
    setSavingCatalogId(catalogId);
    try {
      await adminApi.request(`/suppliers/catalogs/${catalogId}/title`, { method: 'PATCH', body: JSON.stringify({ title }) });
      setCatalogs(prev => prev.map(c => c.id === catalogId ? { ...c, title } : c));
      setEditingCatalogId(null);
      setEditingCatalogTitle('');
      showToast(t('Catalog renamed', '目录已重命名'), 'success');
    } catch { showToast(t('Failed to rename', '重命名失败'), 'error'); }
    finally { setSavingCatalogId(null); }
  };

  const handleReplaceImage = async (file: File, productId: number) => {
    if (!supplier) return;
    setReplacingId(productId);
    try {
      const result = await adminApi.replaceSupplierProductImage(supplier.id, productId, file);
      const bust = `${result.image_url}?t=${Date.now()}`;
      setProducts(prev => prev.map(p => p.id === productId ? { ...p, image_url: bust } : p));
      showToast(t('Image replaced', '图片已更换'), 'success');
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : t('Replace failed', '替换失败'), 'error');
    } finally {
      setReplacingId(null);
      replaceTargetRef.current = null;
    }
  };

  const fetchSupplier = useCallback(() => {
    if (!id) { setLoading(false); return; }
    adminApi.request(`/suppliers/${id}`)
      .then((data: {
        supplier: typeof supplier;
        products?: typeof products;
        catalogs?: typeof catalogs;
        projects?: Array<{ id: number; title: string; location?: string; year?: number; area_sqm?: number; images: string[] | string; is_published?: number }>;
      }) => {
        setSupplier(data.supplier);
        setProducts(data.products || []);
        setCatalogs(data.catalogs || []);
        const raw = data.projects || [];
        setProjects(raw.map((p) => ({
          ...p,
          images: typeof p.images === 'string'
            ? (() => { try { return JSON.parse(p.images as string); } catch { return []; } })()
            : (p.images || []),
        })));
      })
      .catch(() => showToast(t('Failed to load supplier', '加载失败'), 'error'))
      .finally(() => setLoading(false));
  }, [id, t]);

  useEffect(() => { fetchSupplier(); }, [fetchSupplier]);

  const handleStatus = async (status: string) => {
    setIsSubmitting(true);
    try {
      await adminApi.request(`/suppliers/${id}/status`, { method: 'PUT', body: JSON.stringify({ status }) });
      setSupplier((s) => s ? { ...s, status } : s);
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
      router.push('/admin/suppliers');
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
      setSupplier((s) => s ? { ...s, cover_image_url: imgUrl } : s);
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
      const cleanedExtras = cleanExtraFields(newProductExtras);
      const data = await adminApi.request(`/suppliers/${id}/products`, {
        method: 'POST',
        body: JSON.stringify({
          image_url: newProduct.image_url.trim(),
          title: newProduct.title.trim() || null,
          category: newProduct.category || null,
          sort_order: products.length,
          specs: cleanedExtras.specs,
          certifications: cleanedExtras.certifications,
          application_scenes: cleanedExtras.application_scenes,
        }),
      });
      setProducts(prev => [...prev, data.product]);
      setNewProduct({ image_url: '', title: '', category: '' });
      setNewProductExtras(emptyExtraFields());
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

  const handleTogglePublished = async (isPublished: boolean) => {
    if (!supplier) return;
    setTogglingPublished(true);
    try {
      await adminApi.toggleSupplierPublished(supplier.id, isPublished);
      setSupplier((s) => s ? { ...s, is_published: isPublished ? 1 : 0 } : s);
      showToast(isPublished ? t('Supplier published', '供应商已上架') : t('Supplier unpublished', '供应商已下架'), 'success');
    } catch {
      showToast(t('Failed to update', '操作失败'), 'error');
    } finally {
      setTogglingPublished(false);
    }
  };

  const handleToggleProjectPublished = async (projectId: number, isPublished: boolean) => {
    if (!supplier) return;
    try {
      await adminApi.toggleSupplierProjectPublished(supplier.id, projectId, isPublished);
      setProjects(prev => prev.map(p => p.id === projectId ? { ...p, is_published: isPublished ? 1 : 0 } : p));
      showToast(isPublished ? t('Project published', '项目已上架') : t('Project hidden', '项目已隐藏'), 'success');
    } catch {
      showToast(t('Failed to update', '操作失败'), 'error');
    }
  };

  if (loading) return <div className="py-20 text-center text-stone-400">{t('Loading...', '加载中...')}</div>;
  if (!supplier) return <div className="py-20 text-center text-stone-500">{t('Supplier not found', '供应商不存在')}</div>;

  const cats = (() => {
    if (!supplier.categories) return [];
    if (Array.isArray(supplier.categories)) return supplier.categories;
    try { return JSON.parse(supplier.categories as string); } catch { return []; }
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
            const normalized = { ...proj, title: proj.title ?? '', images: proj.images as string[] };
            if (isNew) {
              setProjects(prev => [normalized, ...prev]);
            } else {
              setProjects(prev => prev.map(p => p.id === proj.id ? { ...p, ...normalized } : p));
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
            // 保留 p.image_url：编辑器不改图，避免覆盖掉换图后带缓存戳的 URL
            setProducts(prev => prev.map(p => p.id === updated.id ? { ...p, ...updated, image_url: p.image_url } : p));
            setEditingProduct(null);
          }}
          t={t}
        />
      )}

      {/* Back */}
      <button onClick={() => router.push(backHref)} className="flex items-center gap-1.5 text-sm text-stone-500 hover:text-stone-800">
        <ArrowLeft className="w-4 h-4" />
        {fromReport ? t('Back to Listing Report', '返回上架统计') : t('Back to Suppliers', '返回供应商列表')}
      </button>

      <div className="flex gap-6 items-start">
        {/* LEFT PANEL */}
        <div className="w-72 flex-shrink-0 space-y-4">
          {/* Header card */}
          <div className="bg-white rounded-xl border border-stone-200 p-5 space-y-3">
            {supplier.logo_url && (
              <SmartImage src={supplier.logo_url} alt={supplier.company_name} className="w-16 h-16 rounded-xl object-contain bg-stone-50 border border-stone-100" />
            )}
            <h1 className="text-lg font-bold text-stone-800 leading-snug">{supplier.company_name}</h1>
            <div className="flex flex-wrap gap-1.5">
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${supplier.origin === 'china' ? 'bg-red-50 text-red-600' : 'bg-stone-100 text-stone-600'}`}>
                {supplier.origin === 'china' ? '🇨🇳 China' : '🇦🇪 Dubai'}
              </span>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[supplier.status] || 'bg-stone-100 text-stone-600'}`}>{supplier.status}</span>
            </div>
            <div className="flex flex-wrap gap-1">
              <button onClick={() => setShowEditModal(true)} className="inline-flex items-center gap-1 px-2 py-1 text-xs text-stone-500 hover:text-stone-800 hover:bg-stone-100 rounded-lg transition-colors"><Pencil size={14} /> {t('Edit', '编辑')}</button>
              {supplier.slug && (
                <a href={`/materials/suppliers/${supplier.slug}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 px-2 py-1 text-xs text-stone-500 hover:text-stone-800 hover:bg-stone-100 rounded-lg transition-colors">
                  <ExternalLink size={14} /> {t('Preview', '预览')}
                </a>
              )}
              <button onClick={() => setShowDeleteModal(true)} className="inline-flex items-center gap-1 px-2 py-1 text-xs text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors"><Trash2 size={14} /> {t('Delete', '删除')}</button>
            </div>
            {supplier.description && <p className="text-sm text-stone-600 leading-relaxed">{supplier.description}</p>}
            {supplier.status === 'pending' && (
              <div className="flex gap-2 pt-1">
                <button onClick={() => handleStatus('approved')} disabled={isSubmitting} className="flex-1 py-2 rounded-lg bg-green-600 text-white text-sm font-medium hover:bg-green-700 disabled:opacity-50 transition">{t('Approve', '通过')}</button>
                <button onClick={() => handleStatus('rejected')} disabled={isSubmitting} className="flex-1 py-2 rounded-lg bg-red-50 text-red-600 text-sm font-medium hover:bg-red-100 border border-red-200 disabled:opacity-50 transition">{t('Reject', '拒绝')}</button>
              </div>
            )}
            {supplier.status === 'approved' && (
              <button onClick={() => handleStatus('rejected')} disabled={isSubmitting} className="w-full py-2 rounded-lg bg-red-50 text-red-600 text-sm font-medium hover:bg-red-100 border border-red-200 disabled:opacity-50 transition">{t('Reject', '拒绝')}</button>
            )}
            {supplier.status === 'rejected' && (
              <button onClick={() => handleStatus('approved')} disabled={isSubmitting} className="w-full py-2 rounded-lg bg-green-600 text-white text-sm font-medium hover:bg-green-700 disabled:opacity-50 transition">{t('Approve', '通过')}</button>
            )}
            {supplier.status === 'approved' && (
              <button
                onClick={() => handleTogglePublished(!(supplier.is_published !== 0))}
                disabled={togglingPublished}
                className={`w-full py-2 rounded-lg text-sm font-medium border transition disabled:opacity-50 flex items-center justify-center gap-1.5 ${
                  supplier.is_published !== 0
                    ? 'bg-stone-50 border-stone-200 text-stone-600 hover:bg-amber-50 hover:border-amber-300 hover:text-amber-700'
                    : 'bg-amber-50 border-amber-300 text-amber-700 hover:bg-stone-50 hover:border-stone-200 hover:text-stone-600'
                }`}
              >
                {supplier.is_published !== 0
                  ? <><EyeOff size={14} />{t('Unpublish', '下架')}</>
                  : <><Eye size={14} />{t('Re-publish', '上架')}</>
                }
              </button>
            )}
          </div>

          {/* Details card */}
          <div className="bg-white rounded-xl border border-stone-200 p-5 space-y-2.5">
            <h2 className="text-xs font-semibold text-stone-500 uppercase tracking-wide mb-3">{t('Details', '详情')}</h2>
            <InfoRow label={t('Origin', '产地')} value={supplier.origin === 'china' ? '🇨🇳 China' : '🇦🇪 Dubai'} />
            {(supplier.contact_phone || supplier.user_phone) && <InfoRow label={t('Phone', '电话')} value={supplier.contact_phone || supplier.user_phone || ''} />}
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
                  {cats.map((c: string) => <span key={c} className="text-xs px-2 py-0.5 rounded-full bg-stone-100 text-stone-600">{c}</span>)}
                </div>
              </div>
            )}
            <div className="pt-1 border-t border-stone-100">
              <InfoRow label={t('Joined', '加入时间')} value={new Date(supplier.created_at).toLocaleString(undefined, { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })} />
            </div>
          </div>

          {/* Cover Preview */}
          {supplier.cover_image_url && (
            <div className="bg-white rounded-xl border border-stone-200 p-4 space-y-2">
              <h2 className="text-xs font-semibold text-stone-500 uppercase tracking-wide">{t('Cover Image', '封面图')}</h2>
              <div className="aspect-video w-full rounded-lg overflow-hidden bg-stone-100 border border-stone-200">
                <img src={supplier.cover_image_url} alt="cover" className="w-full h-full object-cover" />
              </div>
              <p className="text-[11px] text-stone-400">{t('Hover over any image below to change', '鼠标移到下方图片可更换')}</p>
            </div>
          )}
        </div>

        {/* RIGHT PANEL */}
        <div className="flex-1 min-w-0 space-y-5">
          {/* Projects */}
          <section>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-stone-500 uppercase tracking-wider flex items-center gap-2">
                <Layers className="w-4 h-4" />
                {t('Projects', '项目')}
                <span className="font-normal text-stone-400 normal-case tracking-normal">({projects.length})</span>
              </h2>
              <button onClick={() => { setEditingProject(null); setShowProjectModal(true); }} className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-lg bg-[#b8864a]/10 text-[#b8864a] hover:bg-[#b8864a]/20 transition-colors">
                <Plus className="w-3.5 h-3.5" />{t('Add Project', '添加项目')}
              </button>
            </div>
            {projects.length === 0 ? (
              <div className="bg-white rounded-xl border border-stone-200 p-8 text-center text-stone-400 text-sm">{t('No projects yet', '暂无项目')}</div>
            ) : (
              <div className="grid grid-cols-3 gap-4">
                {projects.map(proj => {
                  const imgs = Array.isArray(proj.images) ? proj.images : [];
                  return (
                    <div key={proj.id} className="bg-white rounded-xl border border-stone-200 overflow-hidden group relative">
                      <div className="aspect-video bg-stone-100 overflow-hidden relative">
                        {imgs[0] ? (
                          <img src={resolveImageUrl(imgs[0])} alt={proj.title} onClick={() => { setEditingProject(proj); setShowProjectModal(true); }} className="w-full h-full object-cover cursor-pointer group-hover:scale-105 transition-transform duration-300" loading="lazy" />
                        ) : (
                          <div onClick={() => { setEditingProject(proj); setShowProjectModal(true); }} className="w-full h-full flex items-center justify-center text-stone-300 cursor-pointer"><Layers className="w-8 h-8" /></div>
                        )}
                        {imgs.length > 1 && (
                          <span className="absolute bottom-2 right-2 text-[11px] bg-black/50 text-white px-1.5 py-0.5 rounded-md group-hover:opacity-0 transition-opacity">{imgs.length} {t('photos', '张')}</span>
                        )}
                        <div className="absolute top-1.5 right-1.5 flex gap-1 opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto transition-opacity">
                          {imgs[0] && (() => {
                            const isCover = supplier.cover_image_url === imgs[0];
                            return (
                              <button onClick={() => setCover(imgs[0])} className={`flex flex-col items-center gap-0.5 px-1.5 py-1 rounded-md shadow-sm transition-colors ${isCover ? 'bg-[#b8864a] text-white opacity-100' : 'bg-white/95 text-stone-700 hover:bg-[#b8864a] hover:text-white'}`} title={isCover ? t('Currently set as cover', '当前封面') : t('Set as Cover', '设为封面')}>
                                {isCover ? <Check className="w-3 h-3" /> : <ImageIcon className="w-3 h-3" />}
                                <span className="text-[9px] leading-none">{t('Cover', '封面')}</span>
                              </button>
                            );
                          })()}
                          <button onClick={() => handleToggleProjectPublished(proj.id, !proj.is_published)} className={`flex flex-col items-center gap-0.5 px-1.5 py-1 rounded-md shadow-sm transition-colors ${proj.is_published !== 0 ? 'bg-white/95 text-stone-700 hover:bg-amber-500 hover:text-white' : 'bg-amber-500 text-white hover:bg-white/95 hover:text-amber-600'}`} title={proj.is_published !== 0 ? t('Hide project', '隐藏项目') : t('Show project', '显示项目')}>
                            {proj.is_published !== 0 ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                            <span className="text-[9px] leading-none">{proj.is_published !== 0 ? t('Hide', '隐藏') : t('Show', '显示')}</span>
                          </button>
                          <button onClick={() => { setEditingProject(proj); setShowProjectModal(true); }} className="flex flex-col items-center gap-0.5 px-1.5 py-1 rounded-md bg-white/95 text-stone-700 shadow-sm hover:bg-[#b8864a] hover:text-white transition-colors" title={t('Edit', '编辑')}>
                            <Pencil className="w-3 h-3" /><span className="text-[9px] leading-none">{t('Edit', '编辑')}</span>
                          </button>
                          <button onClick={() => handleDeleteProject(proj.id)} className="flex flex-col items-center gap-0.5 px-1.5 py-1 rounded-md bg-white/95 text-stone-700 shadow-sm hover:bg-red-500 hover:text-white transition-colors" title={t('Delete', '删除')}>
                            <Trash2 className="w-3 h-3" /><span className="text-[9px] leading-none">{t('Delete', '删除')}</span>
                          </button>
                        </div>
                        {proj.is_published === 0 && (
                          <div className="absolute inset-0 bg-black/40 flex items-center justify-center pointer-events-none">
                            <span className="bg-amber-500 text-white text-[11px] font-medium px-2 py-0.5 rounded-md flex items-center gap-1"><EyeOff className="w-3 h-3" />{t('Hidden', '已隐藏')}</span>
                          </div>
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
              <button onClick={() => setShowAddProduct(v => !v)} className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-lg bg-[#b8864a]/10 text-[#b8864a] hover:bg-[#b8864a]/20 transition-colors">
                <Plus className="w-3.5 h-3.5" />{t('Add Image', '添加图片')}
              </button>
            </div>
            {showAddProduct && (
              <div className="bg-white rounded-xl border border-[#b8864a]/30 p-4 mb-3 space-y-3">
                <p className="text-xs font-medium text-stone-500">{t('Add Product Image', '添加产品图')}</p>
                <input type="text" placeholder={t('Image URL (e.g. /uploads/suppliers/68/xxx.jpg)', '图片地址（如 /uploads/suppliers/68/xxx.jpg）')} value={newProduct.image_url} onChange={e => setNewProduct(v => ({ ...v, image_url: e.target.value }))} className={inputCls} />
                <div className="flex gap-2">
                  <input type="text" placeholder={t('Title (optional)', '名称（可选）')} value={newProduct.title} onChange={e => setNewProduct(v => ({ ...v, title: e.target.value }))} className={inputCls + ' flex-1'} />
                  <select value={newProduct.category} onChange={e => setNewProduct(v => ({ ...v, category: e.target.value }))} className="h-9 px-3 rounded-lg border border-stone-200 bg-white text-sm text-[#1c1917] focus:outline-none focus:ring-2 focus:ring-[#B8864A]/15 focus:border-[#B8864A]">
                    <option value="">{t('Category', '分类')}</option>
                    {prodCatGroups.map(g => (
                      <optgroup key={g.value} label={g.label}>
                        {g.children.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                      </optgroup>
                    ))}
                  </select>
                </div>
                <ProductExtraFieldsEditor value={newProductExtras} onChange={setNewProductExtras} t={t} />
                <div className="flex gap-2">
                  <button onClick={handleAddProduct} disabled={addingProduct} className="px-4 py-1.5 rounded-lg bg-[#b8864a] text-white text-xs font-medium hover:bg-[#a07540] disabled:opacity-50 transition">{addingProduct ? t('Adding...', '添加中...') : t('Add', '确认添加')}</button>
                  <button onClick={() => { setShowAddProduct(false); setNewProduct({ image_url: '', title: '', category: '' }); setNewProductExtras(emptyExtraFields()); }} className="px-4 py-1.5 rounded-lg bg-stone-100 text-stone-600 text-xs font-medium hover:bg-stone-200 transition">{t('Cancel', '取消')}</button>
                </div>
              </div>
            )}
            {products.length === 0 ? (
              <div className="bg-white rounded-xl border border-stone-200 p-8 text-center text-stone-400 text-sm">{t('No products yet', '暂无产品')}</div>
            ) : (
              <div className="bg-white rounded-xl border border-stone-200 p-4">
                <div className="grid grid-cols-3 xl:grid-cols-4 gap-3">
                  {products.map((p) => {
                    const isCover = !!supplier.cover_image_url && supplier.cover_image_url === p.image_url;
                    return (
                      <div key={p.id} className="group">
                        <div className="aspect-video rounded-lg overflow-hidden bg-stone-100 border border-stone-200 relative">
                          <img src={resolveImageUrl(p.image_url)} alt={p.title || ''} onClick={() => setEditingProduct(p)} className="w-full h-full object-cover cursor-pointer" loading="lazy" />
                          {/* 右上角悬停操作组(复用装企交互:圆角按钮·图标在上+小字);当前封面则常显。透明时禁点击,让点图直接开编辑器 */}
                          <div className={`absolute top-1.5 right-1.5 flex gap-1 transition-opacity ${isCover ? 'opacity-100' : 'opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto'}`}>
                            <button onClick={() => setEditingProduct(p)} className="flex flex-col items-center gap-0.5 px-1.5 py-1 rounded-md shadow-sm bg-white/95 text-stone-700 hover:bg-[#b8864a] hover:text-white transition-colors" title={t('Edit', '编辑')}>
                              <Pencil className="w-3 h-3" />
                              <span className="text-[9px] leading-none">{t('Edit', '编辑')}</span>
                            </button>
                            <button onClick={() => setCover(p.image_url)} className={`flex flex-col items-center gap-0.5 px-1.5 py-1 rounded-md shadow-sm transition-colors ${isCover ? 'bg-[#b8864a] text-white' : 'bg-white/95 text-stone-700 hover:bg-[#b8864a] hover:text-white'}`} title={isCover ? t('Currently cover', '当前封面') : t('Set as cover', '设为封面')}>
                              {isCover ? <Check className="w-3 h-3" /> : <Star className="w-3 h-3" />}
                              <span className="text-[9px] leading-none">{t('Cover', '封面')}</span>
                            </button>
                            <button onClick={() => handleDeleteProduct(p.id)} className="flex flex-col items-center gap-0.5 px-1.5 py-1 rounded-md shadow-sm bg-white/95 text-stone-700 hover:bg-red-600 hover:text-white transition-colors" title={t('Delete', '删除')}>
                              <X className="w-3 h-3" />
                              <span className="text-[9px] leading-none">{t('Delete', '删除')}</span>
                            </button>
                          </div>
                          <button
                            onClick={() => { replaceTargetRef.current = p.id; fileInputRef.current?.click(); }}
                            disabled={replacingId === p.id}
                            className="absolute bottom-0 inset-x-0 py-1 bg-black/60 text-white text-[10px] font-medium opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto transition-opacity flex items-center justify-center gap-1"
                            title={t('Replace image', '更换图片')}
                          >
                            {replacingId === p.id ? <span className="text-[10px]">…</span> : <Upload className="w-3 h-3" />}
                            {t('Replace Image', '更换图片')}
                          </button>
                        </div>
                        {p.category && <p className="text-[10px] text-[#b8864a] uppercase tracking-wide mt-1">{p.category}</p>}
                        {p.title && <p className="text-[11px] text-stone-500 truncate">{p.title}</p>}
                      </div>
                    );
                  })}
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
                {catalogs.map((c) => {
                  const isEditing = editingCatalogId === c.id;
                  const isSaving = savingCatalogId === c.id;
                  return (
                    <div key={c.id} className="flex items-center gap-3 p-3 rounded-xl bg-white border border-stone-200 hover:border-[#b8864a]/40 hover:shadow-sm transition group">
                      <a href={c.file_url} target="_blank" rel="noopener noreferrer"
                        onClick={e => isEditing && e.preventDefault()}
                        className="w-9 h-9 rounded-lg bg-red-50 flex items-center justify-center shrink-0 hover:bg-red-100 transition">
                        <FileText className="w-4 h-4 text-red-500" />
                      </a>
                      <div className="flex-1 min-w-0">
                        {isEditing ? (
                          <input
                            ref={catalogInputRef}
                            value={editingCatalogTitle}
                            onChange={e => setEditingCatalogTitle(e.target.value)}
                            onKeyDown={e => { if (e.key === 'Enter') saveCatalogTitle(c.id); if (e.key === 'Escape') cancelEditCatalog(); }}
                            onBlur={() => { if (!isSaving) cancelEditCatalog(); }}
                            disabled={isSaving}
                            className="w-full h-8 px-2 rounded-lg border border-[#b8864a] bg-white text-sm text-[#2c2c2c] focus:outline-none focus:ring-2 focus:ring-[#B8864A]/20"
                          />
                        ) : (
                          <>
                            <p className="text-sm font-medium text-[#2c2c2c] truncate">{c.title}</p>
                            {c.file_size && (
                              <p className="text-xs text-stone-400 mt-0.5">
                                {c.file_size > 1048576 ? `${(c.file_size / 1048576).toFixed(1)} MB` : `${(c.file_size / 1024).toFixed(0)} KB`}
                              </p>
                            )}
                          </>
                        )}
                      </div>
                      {isEditing ? (
                        <div className="flex items-center gap-1 shrink-0">
                          <button onClick={() => saveCatalogTitle(c.id)} disabled={isSaving}
                            className="w-7 h-7 flex items-center justify-center rounded-lg text-green-600 hover:bg-green-50 transition disabled:opacity-50" title={t('Save', '保存')}>
                            <Check className="w-4 h-4" />
                          </button>
                          <button onClick={cancelEditCatalog} disabled={isSaving}
                            className="w-7 h-7 flex items-center justify-center rounded-lg text-stone-400 hover:bg-stone-100 transition disabled:opacity-50" title={t('Cancel', '取消')}>
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1 shrink-0">
                          <button onClick={() => startEditCatalog(c)}
                            className="w-7 h-7 flex items-center justify-center rounded-lg text-stone-300 hover:text-[#b8864a] hover:bg-stone-100 transition opacity-0 group-hover:opacity-100" title={t('Rename', '重命名')}>
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <a href={c.file_url} target="_blank" rel="noopener noreferrer"
                            className="w-7 h-7 flex items-center justify-center rounded-lg text-stone-300 hover:text-[#b8864a] hover:bg-stone-100 transition">
                            <Download className="w-4 h-4" />
                          </a>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          )}
        </div>
      </div>

      {/* Supplier edit modal */}
      {showEditModal && supplier && (
        <SupplierEditModal supplierId={supplier.id} onClose={() => setShowEditModal(false)} onSaved={() => { setShowEditModal(false); fetchSupplier(); }} />
      )}

      {/* Delete confirm modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl p-6 shadow-xl max-w-sm w-full mx-4 space-y-4">
            <h2 className="text-base font-bold text-[#2c2c2c]">{t('Delete Supplier?', '删除供应商？')}</h2>
            <p className="text-sm text-stone-500">{t('This will permanently delete the supplier and all their data. This cannot be undone.', '这将永久删除该供应商及其所有数据，无法恢复。')}</p>
            <div className="flex gap-2 pt-1">
              <button onClick={handleDelete} disabled={isSubmitting} className="flex-1 py-2 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700 disabled:opacity-50 transition">{t('Delete', '确认删除')}</button>
              <button onClick={() => setShowDeleteModal(false)} className="flex-1 py-2 rounded-lg bg-stone-100 text-stone-600 text-sm font-medium hover:bg-stone-200 transition">{t('Cancel', '取消')}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
