'use client';

import { useState, useEffect, useRef } from 'react';
import { X, Package } from 'lucide-react';
import { adminApi } from '@/lib/adminApi';
import AdminSelect from '@/components/ui/AdminSelect';
import PhoneCountryInput from '@/components/ui/PhoneCountryInput';
import { showToast } from '@/components/ui/Toast';
import { showConfirm } from '@/components/ui/ConfirmModal';
import { getCountry } from '@/lib/country';
import { PRODUCT_CURRENCIES, PRODUCT_UNITS, formatProductPrice, parseProductPriceRange } from '@/lib/supplierProductUnits';

// ── Types ─────────────────────────────────────────────────────────────────────
interface SupplierData {
  id: number;
  company_name: string;
  description: string | null;
  origin: 'china' | 'dubai';
  categories: string[] | string | null;
  has_physical_store: number;
  store_address: string | null;
  google_maps_url: string | null;
  contact_phone: string | null;
  whatsapp: string | null;
  website: string | null;
  status: string;
  country?: string;
}

interface Product {
  id: number;
  title: string | null;
  category: string | null;
  image_url: string;
  sort_order: number;
  price?: number | null;
  price_max?: number | null;
  price_unit?: string | null;
  price_currency?: string | null;
  price_from?: number | boolean | null;
}

// 产品分类枚举（两级：大类 parent_value=null / 子类 parent_value=大类value）
interface ProdCat {
  value: string;
  label: string;
  label_zh: string | null;
  parent_value: string | null;
  is_enabled: number;
}

interface Props {
  supplierId: number;
  onClose: () => void;
  onSaved: () => void;
}

const labelCls = 'block text-xs font-medium text-stone-500 mb-1';
const inputCls =
  'w-full h-9 px-3 rounded-lg border border-stone-200 bg-stone-50/80 text-sm text-[#1c1917] placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-[#B8864A]/15 focus:border-[#B8864A] focus:bg-white transition';

// ── ProductAddModal ────────────────────────────────────────────────────────────
function ProductAddModal({
  supplierId,
  categoryOptions,
  onClose,
  onAdded,
}: {
  supplierId: number;
  categoryOptions: { value: string; label: string }[];
  onClose: () => void;
  onAdded: (product: Product) => void;
}) {
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [price, setPrice] = useState('');
  const [priceMax, setPriceMax] = useState('');
  const [priceUnit, setPriceUnit] = useState('');
  const [priceCurrency, setPriceCurrency] = useState('');
  const [priceFrom, setPriceFrom] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleUpload = async (file: File) => {
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file, file.name);
      const token = typeof window !== 'undefined' ? localStorage.getItem('admin_token') : null;
      const API_BASE = (process.env.NEXT_PUBLIC_API_URL?.trim() || '/api') + '/admin';
      const res = await fetch(`${API_BASE}/suppliers/${supplierId}/project-image`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        body: fd,
      });
      if (!res.ok) throw new Error('Upload failed');
      const data = await res.json();
      setImageUrl(data.url);
    } catch (e: unknown) {
      showToast((e instanceof Error ? e.message : null) || 'Upload failed', 'error');
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const handleSave = async () => {
    if (!imageUrl) { showToast('请先上传图片', 'error'); return; }
    const parsed = parseProductPriceRange(price, priceMax);
    if (!parsed.ok) {
      showToast(parsed.field === 'min' ? '最低价必填，且必须是大于 0、最多两位小数的数字。'
        : parsed.reason === 'below_min' ? '最高价必须大于或等于最低价。'
          : '最高价必须是大于 0、最多两位小数的数字，或留空。', 'error');
      return;
    }
    if (!priceUnit) { showToast('请选择单位。', 'error'); return; }
    setSaving(true);
    try {
      const data = await adminApi.request(`/suppliers/${supplierId}/products`, {
        method: 'POST',
        body: JSON.stringify({
          title: title.trim() || null, category: category || null, image_url: imageUrl,
          price: parsed.min, price_max: parsed.max, price_unit: priceUnit,
          price_currency: priceCurrency || null, price_from: parsed.max == null && priceFrom ? 1 : 0,
        }),
      }) as { product: Product };
      onAdded(data.product);
      showToast('产品已添加', 'success');
    } catch (e: unknown) {
      showToast((e instanceof Error ? e.message : null) || '保存失败', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm">
        <div className="flex items-center justify-between p-5 border-b border-stone-100">
          <h3 className="text-base font-bold text-[#2c2c2c]">添加产品</h3>
          <button onClick={onClose} className="text-stone-400 hover:text-stone-600 p-1"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label className={labelCls}>图片 *</label>
            {imageUrl ? (
              <div className="relative w-24 h-24 rounded-lg overflow-hidden bg-stone-100">
                <img src={imageUrl} alt="" className="w-full h-full object-cover" />
                <button
                  onClick={() => setImageUrl('')}
                  className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-red-600"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ) : (
              <button
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-dashed border-stone-300 text-xs text-stone-500 hover:border-[#b8864a] hover:text-[#b8864a] transition disabled:opacity-50"
              >
                {uploading ? '上传中...' : '+ 上传图片'}
              </button>
            )}
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) handleUpload(f); }}
            />
          </div>
          <div>
            <label className={labelCls}>标题</label>
            <input className={inputCls} value={title} onChange={e => setTitle(e.target.value)} placeholder="产品名称" />
          </div>
          <div>
            <label className={labelCls}>分类</label>
            <AdminSelect
              size="sm"
              value={category}
              onChange={setCategory}
              options={[
                { value: '', label: '选择分类' },
                ...categoryOptions,
                // 当前值不在管理列表(旧/脏数据)也保留可见,避免保存时丢失
                ...(category && !categoryOptions.some(o => o.value === category) ? [{ value: category, label: category }] : []),
              ]}
              className="w-full"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div><label className={labelCls}>最低价 *</label><input type="text" inputMode="decimal" className={inputCls + ' bg-white'} value={price} onChange={e => setPrice(e.target.value)} placeholder="0.00" /></div>
            <div><label className={labelCls}>最高价（选填）</label><input type="text" inputMode="decimal" className={inputCls + ' bg-white'} value={priceMax} onChange={e => setPriceMax(e.target.value)} placeholder="0.00" /></div>
            <div><label className={labelCls}>币种</label><select className={inputCls + ' bg-white'} value={priceCurrency} onChange={e => setPriceCurrency(e.target.value)}><option value="">按国家</option>{PRODUCT_CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}</select></div>
            <div><label className={labelCls}>单位 *</label><select className={inputCls + ' bg-white'} value={priceUnit} onChange={e => setPriceUnit(e.target.value)}><option value="">选择单位</option>{PRODUCT_UNITS.map(u => <option key={u.value} value={u.value}>{u.zh} / {u.en}</option>)}</select></div>
          </div>
          <label className="flex items-center gap-2 text-xs text-stone-600"><input type="checkbox" checked={priceFrom} onChange={e => setPriceFrom(e.target.checked)} />未填写最高价时显示为起价</label>
        </div>
        <div className="flex justify-end gap-2 px-5 pb-5">
          <button onClick={onClose} className="px-4 h-9 text-sm text-stone-600 hover:text-stone-900 rounded-lg hover:bg-stone-100 transition">取消</button>
          <button
            onClick={handleSave}
            disabled={saving || uploading}
            className="px-5 h-9 text-sm bg-[#b8864a] text-white rounded-lg hover:bg-[#a07540] disabled:opacity-50 font-medium transition"
          >
            {saving ? '保存中...' : '保存'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── ProductEditInlineModal ─────────────────────────────────────────────────────
function ProductEditInlineModal({
  supplierId,
  product,
  categoryOptions,
  onClose,
  onSaved,
}: {
  supplierId: number;
  product: Product;
  categoryOptions: { value: string; label: string }[];
  onClose: () => void;
  onSaved: (product: Product) => void;
}) {
  const [title, setTitle] = useState(product.title || '');
  const [category, setCategory] = useState(product.category || '');
  const [price, setPrice] = useState(product.price != null ? String(product.price) : '');
  const [priceMax, setPriceMax] = useState(product.price_max != null ? String(product.price_max) : '');
  const [priceUnit, setPriceUnit] = useState(product.price_unit || '');
  const [priceCurrency, setPriceCurrency] = useState(product.price_currency || '');
  const [priceFrom, setPriceFrom] = useState(!!product.price_from);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    const priceDirty = price !== (product.price != null ? String(product.price) : '')
      || priceMax !== (product.price_max != null ? String(product.price_max) : '')
      || priceUnit !== (product.price_unit || '') || priceCurrency !== (product.price_currency || '')
      || priceFrom !== !!product.price_from;
    const parsed = parseProductPriceRange(price, priceMax);
    if (priceDirty && !parsed.ok) {
      showToast(parsed.field === 'min' ? '最低价必填，且必须是大于 0、最多两位小数的数字。'
        : parsed.reason === 'below_min' ? '最高价必须大于或等于最低价。'
          : '最高价必须是大于 0、最多两位小数的数字，或留空。', 'error');
      return;
    }
    if (priceDirty && !priceUnit) { showToast('请选择单位。', 'error'); return; }
    setSaving(true);
    try {
      const data = await adminApi.request(`/suppliers/${supplierId}/products/${product.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          title: title.trim() || null, category: category || null,
          ...(priceDirty && parsed.ok ? {
            price: parsed.min, price_max: parsed.max, price_unit: priceUnit,
            price_currency: priceCurrency || null, price_from: parsed.max == null && priceFrom ? 1 : 0,
          } : {}),
        }),
      }) as { product: Product };
      onSaved(data.product);
      showToast('产品已更新', 'success');
    } catch (e: unknown) {
      showToast((e instanceof Error ? e.message : null) || '保存失败', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm">
        <div className="flex items-center justify-between p-5 border-b border-stone-100">
          <h3 className="text-base font-bold text-[#2c2c2c]">编辑产品</h3>
          <button onClick={onClose} className="text-stone-400 hover:text-stone-600 p-1"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label className={labelCls}>标题</label>
            <input className={inputCls} value={title} onChange={e => setTitle(e.target.value)} />
          </div>
          <div>
            <label className={labelCls}>分类</label>
            <AdminSelect
              size="sm"
              value={category}
              onChange={setCategory}
              options={[
                { value: '', label: '无分类' },
                ...categoryOptions,
                // 当前值不在管理列表(旧/脏数据)也保留可见,避免保存时丢失
                ...(category && !categoryOptions.some(o => o.value === category) ? [{ value: category, label: category }] : []),
              ]}
              className="w-full"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div><label className={labelCls}>最低价 *</label><input type="text" inputMode="decimal" className={inputCls + ' bg-white'} value={price} onChange={e => setPrice(e.target.value)} placeholder="0.00" /></div>
            <div><label className={labelCls}>最高价（选填）</label><input type="text" inputMode="decimal" className={inputCls + ' bg-white'} value={priceMax} onChange={e => setPriceMax(e.target.value)} placeholder="0.00" /></div>
            <div><label className={labelCls}>币种</label><select className={inputCls + ' bg-white'} value={priceCurrency} onChange={e => setPriceCurrency(e.target.value)}><option value="">按国家</option>{PRODUCT_CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}</select></div>
            <div><label className={labelCls}>单位 *</label><select className={inputCls + ' bg-white'} value={priceUnit} onChange={e => setPriceUnit(e.target.value)}><option value="">选择单位</option>{PRODUCT_UNITS.map(u => <option key={u.value} value={u.value}>{u.zh} / {u.en}</option>)}{priceUnit && !PRODUCT_UNITS.some(u => u.value === priceUnit) && <option value={priceUnit}>{priceUnit}</option>}</select></div>
          </div>
          <label className="flex items-center gap-2 text-xs text-stone-600"><input type="checkbox" checked={priceFrom} onChange={e => setPriceFrom(e.target.checked)} />未填写最高价时显示为起价</label>
        </div>
        <div className="flex justify-end gap-2 px-5 pb-5">
          <button onClick={onClose} className="px-4 h-9 text-sm text-stone-600 rounded-lg hover:bg-stone-100 transition">取消</button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-5 h-9 text-sm bg-[#b8864a] text-white rounded-lg hover:bg-[#a07540] disabled:opacity-50 font-medium transition"
          >
            {saving ? '保存中...' : '保存'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Modal ────────────────────────────────────────────────────────────────
type Tab = 'info' | 'products';

export default function SupplierEditModal({ supplierId, onClose, onSaved }: Props) {
  const [activeTab, setActiveTab] = useState<Tab>('info');
  const [data, setData] = useState<Partial<SupplierData>>({});
  const [products, setProducts] = useState<Product[]>([]);
  // 产品分类枚举全树(大类+子类),分类 picker(大类 tab)与产品内联弹窗下拉共用
  const [prodCatTree, setProdCatTree] = useState<ProdCat[]>([]);
  // 当前选中的大类 tab(parent_value=null 的 value)
  const [activeCatTab, setActiveCatTab] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [showAddProduct, setShowAddProduct] = useState(false);
  const descRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const el = descRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = Math.max(el.scrollHeight, 120) + 'px';
  }, [data.description]);

  useEffect(() => {
    Promise.all([
      adminApi.request(`/suppliers/${supplierId}`),
      adminApi.request('/enums/product-categories').catch(() => ({ categories: [] })),
    ]).then(([detail, prodCatsRes]) => {
      const d = detail as { supplier?: Partial<SupplierData>; products?: Product[] };
      const pc = prodCatsRes as { categories?: ProdCat[] };
      const s = d.supplier || {};
      if (typeof s.categories === 'string') {
        try { s.categories = JSON.parse(s.categories); } catch { s.categories = []; }
      }
      if (!Array.isArray(s.categories)) s.categories = [];
      setData(s);
      setProducts(d.products || []);
      // 只保留启用项;大类(parent_value=null) + 子类都留在树里,picker 与产品下拉共用
      const tree = (pc.categories || []).filter((c) => c.is_enabled !== 0);
      setProdCatTree(tree);
      // 默认选中第一个大类 tab
      const firstTop = tree.find((c) => !c.parent_value);
      if (firstTop) setActiveCatTab(firstTop.value);
    }).catch((e: unknown) => setError((e instanceof Error ? e.message : null) || 'Failed to load'))
      .finally(() => setLoading(false));
  }, [supplierId]);

  const set = (key: keyof SupplierData, val: unknown) =>
    setData(prev => ({ ...prev, [key]: val }));

  const toggleCategory = (val: string) => {
    const cats: string[] = Array.isArray(data.categories) ? data.categories : [];
    set('categories', cats.includes(val) ? cats.filter(c => c !== val) : [...cats, val]);
  };

  const handleSave = async () => {
    setSaving(true);
    setError('');
    try {
      const payload: Record<string, unknown> = {
        company_name: data.company_name,
        description: data.description,
        origin: data.origin,
        categories: data.categories,
        has_physical_store: data.has_physical_store,
        store_address: data.has_physical_store ? (data.store_address || null) : null,
        google_maps_url: data.has_physical_store ? (data.google_maps_url || null) : null,
        contact_phone: data.contact_phone,
        whatsapp: data.whatsapp,
        website: data.website,
        status: data.status,
      };
      await adminApi.request(`/suppliers/${supplierId}`, {
        method: 'PUT',
        body: JSON.stringify(payload),
      });
      onSaved();
      onClose();
    } catch (e: unknown) {
      setError((e instanceof Error ? e.message : null) || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteProduct = (product: Product) => {
    showConfirm({
      title: `确定删除产品"${product.title || '未命名'}"？`,
      onConfirm: async () => {
        try {
          await adminApi.request(`/suppliers/${supplierId}/products/${product.id}`, { method: 'DELETE' });
          setProducts(prev => prev.filter(p => p.id !== product.id));
          showToast('产品已删除', 'success');
        } catch (e: unknown) {
          showToast((e instanceof Error ? e.message : null) || '删除失败', 'error');
        }
      },
    });
  };

  if (loading) return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl p-8 text-stone-500 text-sm">Loading…</div>
    </div>
  );

  const selectedCats: string[] = Array.isArray(data.categories) ? data.categories : [];
  // 大类 tabs / 子类 chips
  const topCats = prodCatTree.filter(c => !c.parent_value);
  const childCats = prodCatTree.filter(c => !!c.parent_value);
  // 产品内联新增/编辑弹窗下拉:扁平的启用子类(与旧 productCats 口径一致)
  const productCats = childCats.map(c => ({ value: c.value, label: c.label }));
  const knownChildValues = new Set(childCats.map(c => c.value));
  // 已选但不在当前分类树里的旧值(遗留/脏数据)——单列出来,保存时不静默丢弃
  const legacyCats = selectedCats.filter(v => !knownChildValues.has(v));
  const activeChildren = childCats.filter(c => c.parent_value === activeCatTab);

  return (
    <>
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
        <div
          className="bg-white rounded-2xl w-[50vw] min-w-[640px] max-w-[900px] h-[80vh] flex flex-col shadow-xl"
          onClick={e => e.stopPropagation()}
        >
          <div className="flex-shrink-0 border-b border-stone-200 px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-1">
              {(['info', 'products'] as Tab[]).map(tab => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-4 py-1.5 rounded-lg text-sm font-medium transition ${
                    activeTab === tab
                      ? 'bg-[#b8864a] text-white'
                      : 'text-stone-500 hover:text-stone-800 hover:bg-stone-100'
                  }`}
                >
                  {tab === 'info' ? '基本信息' : `产品 (${products.length})`}
                </button>
              ))}
            </div>
            <button onClick={onClose} className="p-1 hover:bg-stone-100 rounded-lg transition">
              <X className="w-5 h-5 text-stone-500" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-6 py-5">
            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>
            )}

            {activeTab === 'info' && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className={labelCls}>公司名称</label>
                    <input className={inputCls} value={data.company_name || ''} onChange={e => set('company_name', e.target.value)} />
                  </div>
                  <div>
                    <label className={labelCls}>来源地</label>
                    <AdminSelect
                      size="sm"
                      value={data.origin || ''}
                      onChange={val => set('origin', val)}
                      options={[
                        { value: 'china', label: 'China' },
                        { value: 'dubai', label: 'Dubai' },
                      ]}
                      className="w-full"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className={labelCls}>联系电话</label>
                    <PhoneCountryInput value={data.contact_phone || ''} onChange={val => set('contact_phone', val)} size="sm" />
                  </div>
                  <div>
                    <label className={labelCls}>WhatsApp</label>
                    <input className={inputCls} value={data.whatsapp || ''} onChange={e => set('whatsapp', e.target.value)} placeholder="+971..." />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className={labelCls}>网站</label>
                    <input className={inputCls} value={data.website || ''} onChange={e => set('website', e.target.value)} placeholder="https://..." />
                  </div>
                  <div>
                    <label className={labelCls}>状态</label>
                    <AdminSelect
                      size="sm"
                      value={data.status || ''}
                      onChange={val => set('status', val)}
                      options={[
                        { value: 'pending', label: 'Pending' },
                        { value: 'approved', label: 'Approved' },
                        { value: 'rejected', label: 'Rejected' },
                      ]}
                      className="w-full"
                    />
                  </div>
                </div>

                <div>
                  <label className={labelCls}>描述</label>
                  <textarea
                    ref={descRef}
                    className="w-full px-3 py-2 rounded-lg border border-stone-200 bg-stone-50/80 text-sm text-[#1c1917] placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-[#B8864A]/15 focus:border-[#B8864A] focus:bg-white transition resize-none overflow-hidden"
                    style={{ minHeight: '120px' }}
                    value={data.description || ''}
                    onChange={e => set('description', e.target.value)}
                  />
                </div>

                {topCats.length > 0 && (
                  <div>
                    <label className={labelCls}>分类</label>
                    {/* 大类 tabs */}
                    <div className="flex flex-wrap gap-1 mt-1 border-b border-stone-100 pb-2">
                      {topCats.map(top => {
                        const on = activeCatTab === top.value;
                        // 该大类下已选子类数量,给 tab 一个计数徽标
                        const count = childCats.filter(c => c.parent_value === top.value && selectedCats.includes(c.value)).length;
                        return (
                          <button
                            key={top.value}
                            type="button"
                            onClick={() => setActiveCatTab(top.value)}
                            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${
                              on
                                ? 'bg-[#b8864a] text-white'
                                : 'text-stone-500 hover:text-stone-800 hover:bg-stone-100'
                            }`}
                          >
                            {top.label}
                            {top.label_zh && <span className={`ml-1 text-xs ${on ? 'text-white/70' : 'text-stone-400'}`}>{top.label_zh}</span>}
                            {count > 0 && (
                              <span className={`ml-1.5 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[11px] font-semibold ${on ? 'bg-white/25 text-white' : 'bg-[#b8864a]/15 text-[#b8864a]'}`}>{count}</span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                    {/* 当前大类的子类 chips(多选切换) */}
                    <div className="flex flex-wrap gap-2 mt-3">
                      {activeChildren.length === 0 && (
                        <p className="text-xs text-stone-400 py-1">该大类暂无子分类</p>
                      )}
                      {activeChildren.map(cat => {
                        const on = selectedCats.includes(cat.value);
                        return (
                          <button
                            key={cat.value}
                            type="button"
                            onClick={() => toggleCategory(cat.value)}
                            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition border ${
                              on
                                ? 'bg-[#b8864a] text-white border-[#b8864a]'
                                : 'bg-white border-stone-200 text-stone-700 hover:border-[#b8864a]/60 hover:text-[#b8864a]'
                            }`}
                          >
                            {cat.label}
                            {cat.label_zh && <span className={`ml-1 text-xs ${on ? 'text-white/70' : 'text-stone-400'}`}>{cat.label_zh}</span>}
                          </button>
                        );
                      })}
                    </div>
                    {/* 遗留/未分类:不在当前分类树里的旧值,保留可见+可移除,避免保存时静默丢失 */}
                    {legacyCats.length > 0 && (
                      <div className="mt-3">
                        <p className="text-xs text-stone-400 mb-1.5">其他 / 未分类（旧数据，点击可移除）</p>
                        <div className="flex flex-wrap gap-2">
                          {legacyCats.map(val => (
                            <button
                              key={val}
                              type="button"
                              onClick={() => toggleCategory(val)}
                              title="点击移除该旧分类"
                              className="px-3 py-1.5 rounded-lg text-sm font-medium transition border border-dashed border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-100"
                            >
                              {val}
                              <X className="inline w-3 h-3 ml-1 -mt-0.5" />
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                <div>
                  <label className={labelCls}>实体店</label>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => set('has_physical_store', data.has_physical_store ? 0 : 1)}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${
                        data.has_physical_store ? 'bg-[#b8864a]' : 'bg-stone-200'
                      }`}
                    >
                      <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition ${
                        data.has_physical_store ? 'translate-x-6' : 'translate-x-1'
                      }`} />
                    </button>
                    <span className="text-sm text-stone-600">{data.has_physical_store ? '有实体店' : '无实体店'}</span>
                  </div>
                </div>

                {!!data.has_physical_store && (
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className={labelCls}>店铺地址</label>
                      <input className={inputCls} value={data.store_address || ''} onChange={e => set('store_address', e.target.value)} />
                    </div>
                    <div>
                      <label className={labelCls}>Google Maps URL</label>
                      <input className={inputCls} value={data.google_maps_url || ''} onChange={e => set('google_maps_url', e.target.value)} placeholder="https://maps.google.com/..." />
                    </div>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'products' && (
              <div className="space-y-2">
                {products.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-16 text-stone-400">
                    <Package className="w-10 h-10 mb-3" />
                    <p className="text-sm">暂无产品</p>
                  </div>
                )}
                {products.map(product => {
                  const priceLabel = formatProductPrice(
                    product.price, product.price_unit, !!product.price_from,
                    product.price_currency || getCountry(data.country || 'ae').currency,
                    product.price_max,
                  );
                  return (
                  <div key={product.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-stone-50 group">
                    <img src={product.image_url} alt="" className="w-10 h-10 rounded-lg object-cover shrink-0 bg-stone-100" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-[#2c2c2c] truncate">
                        {product.title || <span className="text-stone-400">未命名</span>}
                      </p>
                      {product.category && <p className="text-xs text-stone-400">{product.category}</p>}
                      {priceLabel && <p className="text-xs font-semibold text-[#b8864a]">{priceLabel}</p>}
                    </div>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition shrink-0">
                      <button
                        onClick={() => setEditingProduct(product)}
                        className="px-3 h-7 text-xs rounded-lg bg-stone-100 text-stone-600 hover:bg-stone-200 transition"
                      >
                        编辑
                      </button>
                      <button
                        onClick={() => handleDeleteProduct(product)}
                        className="px-3 h-7 text-xs rounded-lg bg-red-50 text-red-600 hover:bg-red-100 transition"
                      >
                        删除
                      </button>
                    </div>
                  </div>
                  );
                })}
                <button
                  onClick={() => setShowAddProduct(true)}
                  className="mt-2 flex items-center gap-1.5 px-3 py-2 rounded-lg border border-dashed border-stone-300 text-sm text-stone-500 hover:border-[#b8864a] hover:text-[#b8864a] transition w-full justify-center"
                >
                  + 添加产品
                </button>
              </div>
            )}
          </div>

          {activeTab === 'info' && (
            <div className="flex-shrink-0 border-t border-stone-200 px-6 py-4 flex items-center justify-end gap-3">
              <button onClick={onClose} className="px-4 h-9 text-sm text-stone-600 hover:text-stone-900 rounded-lg hover:bg-stone-100 transition">
                取消
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-5 h-9 text-sm bg-[#b8864a] text-white rounded-lg hover:bg-[#a07540] disabled:opacity-50 font-medium transition"
              >
                {saving ? '保存中…' : '保存'}
              </button>
            </div>
          )}
        </div>
      </div>

      {editingProduct && (
        <ProductEditInlineModal
          supplierId={supplierId}
          product={editingProduct}
          categoryOptions={productCats}
          onClose={() => setEditingProduct(null)}
          onSaved={updated => {
            setProducts(prev => prev.map(p => p.id === updated.id ? updated : p));
            setEditingProduct(null);
          }}
        />
      )}
      {showAddProduct && (
        <ProductAddModal
          supplierId={supplierId}
          categoryOptions={productCats}
          onClose={() => setShowAddProduct(false)}
          onAdded={product => {
            setProducts(prev => [...prev, product]);
            setShowAddProduct(false);
          }}
        />
      )}
    </>
  );
}
