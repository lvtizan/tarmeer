'use client';

import { useState, useEffect } from 'react';
import { Plus, Trash2, ImagePlus, X } from 'lucide-react';
import AdminSelect from '@/components/ui/AdminSelect';
import ImageUploadZone from '@/components/ui/ImageUploadZone';
import { useAdminT } from '@/hooks/useAdminLang';
import { ScreenSpinner } from '@/components/ui/Spinner';
import { PRODUCT_UNITS, formatProductPrice } from '@/lib/supplierProductUnits';
import { getCountry } from '@/lib/country';

const API_BASE = process.env.NEXT_PUBLIC_API_URL?.trim() || '/api';

function getToken() {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('supplier_token');
}
function authHeaders() { return { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` }; }

const inputCls = 'w-full h-[50px] px-5 rounded-2xl border border-stone-200 bg-stone-50/80 text-[15px] text-[#1c1917] placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-[#B8864A]/15 focus:border-[#B8864A] focus:bg-white transition';
const labelCls = 'block text-sm font-medium text-stone-500 mb-1.5';

interface Product {
  id: number;
  title?: string;
  description?: string;
  category?: string;
  image_url: string;
  image_urls?: string[];
  price?: number | null;
  price_unit?: string | null;
  price_from?: 0 | 1 | boolean;
}

export default function SupplierProductsPage() {
  const { t } = useAdminT();

  const CATEGORY_OPTIONS = [
    { value: '', label: t('No category', '无品类') },
    { value: 'furniture', label: t('Furniture', '家具') },
    { value: 'stone', label: t('Stone', '石材') },
    { value: 'lighting', label: t('Lighting', '灯具') },
    { value: 'plants', label: t('Plants', '植物景观') },
    { value: 'flooring', label: t('Flooring', '地板') },
    { value: 'kitchen', label: t('Kitchen', '厨卫') },
    { value: 'curtains', label: t('Curtains', '窗帘纺织') },
    { value: 'paint', label: t('Paint', '涂料') },
    { value: 'hardware', label: t('Hardware', '五金配件') },
    { value: 'other', label: t('Other', '其他') },
  ];

  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);

  // new product form
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newCat, setNewCat] = useState('');
  const [newImageUrls, setNewImageUrls] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const [newPrice, setNewPrice] = useState('');
  const [newUnit, setNewUnit] = useState('');          // '' = 未选；'__custom__' = 自定义
  const [newUnitCustom, setNewUnitCustom] = useState('');
  const [newPriceFrom, setNewPriceFrom] = useState(false);
  const [currency, setCurrency] = useState('AED');

  useEffect(() => {
    fetch(`${API_BASE}/suppliers/me/products`, { headers: authHeaders() as HeadersInit })
      .then(r => r.json())
      .then(data => { if (data?.products) setProducts(data.products); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetch(`${API_BASE}/suppliers/me/profile`, { headers: authHeaders() as HeadersInit })
      .then(r => r.json())
      .then(data => { if (data?.profile?.country) setCurrency(getCountry(data.profile.country).currency); })
      .catch(() => {});
  }, []);

  const UNIT_OPTIONS = [
    { value: '', label: t('Select unit', '选择单位') },
    ...PRODUCT_UNITS.map(u => ({ value: u.value, label: u.zh === u.en ? u.zh : `${u.zh} / ${u.en}` })),
    { value: '__custom__', label: t('Custom…', '自定义…') },
  ];

  const handleAdd = async () => {
    if (newImageUrls.length === 0) { setMsg(t('Please upload at least one image.', '请至少上传一张图片。')); return; }
    const priceNum = Number(newPrice);
    if (!Number.isFinite(priceNum) || priceNum <= 0) { setMsg(t('Please enter a valid price.', '请输入有效价格。')); return; }
    const unitVal = newUnit === '__custom__' ? newUnitCustom.trim() : newUnit;
    if (!unitVal) { setMsg(t('Please select or enter a unit.', '请选择或填写单位。')); return; }
    setSaving(true);
    setMsg('');
    try {
      const res = await fetch(`${API_BASE}/suppliers/me/products`, {
        method: 'POST',
        headers: authHeaders() as HeadersInit,
        body: JSON.stringify({
          title: newTitle || null,
          description: newDesc || null,
          category: newCat || null,
          image_urls: newImageUrls,
          price: priceNum,
          price_unit: unitVal,
          price_from: newPriceFrom,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setProducts(prev => [...prev, data.product]);
      setNewTitle(''); setNewDesc(''); setNewCat(''); setNewImageUrls([]);
      setNewPrice(''); setNewUnit(''); setNewUnitCustom(''); setNewPriceFrom(false);
      setAdding(false);
    } catch (err: unknown) {
      setMsg(err instanceof Error ? err.message : t('Failed.', '失败。'));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    await fetch(`${API_BASE}/suppliers/me/products/${id}`, { method: 'DELETE', headers: authHeaders() as HeadersInit });
    setProducts(prev => prev.filter(p => p.id !== id));
  };

  if (loading) return <ScreenSpinner />;

  return (
    <div className="max-w-4xl space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-[#2c2c2c]">{t('Products', '产品')}</h1>
          <p className="text-sm text-stone-500 mt-1">{t(`${products.length} product${products.length !== 1 ? 's' : ''} uploaded`, `已上传 ${products.length} 件产品`)}</p>
        </div>
        {!adding && (
          <button onClick={() => setAdding(true)} className="btn-primary flex items-center gap-2">
            <Plus className="w-4 h-4" /> {t('Add Product', '添加产品')}
          </button>
        )}
      </div>

      {/* Add product form */}
      {adding && (
        <div className="bg-white rounded-2xl border border-stone-200 p-5 sm:p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-[15px] font-semibold text-[#2c2c2c]">{t('New Product', '新增产品')}</h2>
            <button onClick={() => { setAdding(false); setMsg(''); }} className="text-stone-400 hover:text-stone-600 transition p-1">
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Image picker */}
          <div>
            <label className={labelCls}>{t('Product Image *', '产品图片 *')}</label>
            <ImageUploadZone
              value={newImageUrls}
              onUpload={setNewImageUrls}
              uploadUrl={`${API_BASE}/suppliers/me/upload-image`}
              getHeaders={() => ({ Authorization: `Bearer ${getToken()}` })}
              label={t('Click, drag or paste to upload', '点击、拖放或粘贴截图上传')}
              sublabel="JPG · PNG · WebP"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>{t('Title', '产品名称')}</label>
              <input type="text" value={newTitle} onChange={e => setNewTitle(e.target.value)}
                placeholder={t('Product name', '请输入产品名称')} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>{t('Category', '品类')}</label>
              <AdminSelect options={CATEGORY_OPTIONS} value={newCat} onChange={setNewCat} />
            </div>
            <div>
              <label className={labelCls}>{t('Price *', '价格 *')}</label>
              <div className="flex items-center gap-2">
                <span className="text-sm text-stone-400 shrink-0">{currency}</span>
                <input type="number" min="0" step="0.01" value={newPrice} onChange={e => setNewPrice(e.target.value)}
                  placeholder="0.00" className={inputCls} />
              </div>
              <label className="mt-2 flex items-center gap-2 text-xs text-stone-500 cursor-pointer">
                <input type="checkbox" checked={newPriceFrom} onChange={e => setNewPriceFrom(e.target.checked)}
                  className="rounded border-stone-300 text-[#b8864a] focus:ring-[#B8864A]/30" />
                {t('Price is "from" (starting price)', '此为起价（from）')}
              </label>
            </div>
            <div>
              <label className={labelCls}>{t('Unit *', '单位 *')}</label>
              <AdminSelect options={UNIT_OPTIONS} value={newUnit} onChange={setNewUnit} />
              {newUnit === '__custom__' && (
                <input type="text" value={newUnitCustom} onChange={e => setNewUnitCustom(e.target.value)}
                  placeholder={t('e.g. per pallet', '如：每托盘')} className={`${inputCls} mt-2`} />
              )}
            </div>
            <div className="sm:col-span-2">
              <label className={labelCls}>{t('Description', '产品描述')}</label>
              <textarea value={newDesc} onChange={e => setNewDesc(e.target.value)} rows={3}
                placeholder={t('Brief description', '简短描述')}
                className="w-full px-5 py-3 rounded-2xl border border-stone-200 bg-stone-50/80 text-[15px] text-[#1c1917] placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-[#B8864A]/15 focus:border-[#B8864A] focus:bg-white transition resize-none" />
            </div>
          </div>

          {msg && <p className="text-sm text-red-600 bg-red-50 px-4 py-2 rounded-2xl">{msg}</p>}

          <div className="flex justify-end gap-3">
            <button onClick={() => { setAdding(false); setMsg(''); }}
              className="h-11 px-5 rounded-2xl border border-stone-200 text-[15px] text-stone-600 hover:bg-stone-50 transition">
              {t('Cancel', '取消')}
            </button>
            <button onClick={handleAdd} disabled={saving || newImageUrls.length === 0 || !(Number(newPrice) > 0) || !(newUnit === '__custom__' ? newUnitCustom.trim() : newUnit)} className="btn-primary flex items-center gap-2 disabled:opacity-50">
              <Plus className="w-4 h-4" />
              {saving ? t('Saving...', '保存中...') : t('Add Product', '添加产品')}
            </button>
          </div>
        </div>
      )}

      {/* Products grid */}
      {products.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {products.map(p => (
            <div key={p.id} className="group relative bg-white rounded-2xl border border-stone-200 overflow-hidden">
              <div className="aspect-[3/4] bg-stone-100 relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.image_url} alt={p.title || ''} className="w-full h-full object-cover" />
                {Array.isArray(p.image_urls) && p.image_urls.length > 1 && (
                  <span className="absolute bottom-1.5 right-1.5 bg-black/50 text-white text-[10px] px-1.5 py-0.5 rounded-md">
                    +{p.image_urls.length - 1}
                  </span>
                )}
              </div>
              <div className="p-3">
                {p.category && (
                  <p className="text-[10px] font-semibold text-[#b8864a] uppercase tracking-wider mb-0.5">{p.category}</p>
                )}
                <p className="text-sm font-medium text-[#2c2c2c] line-clamp-1">{p.title || t('Untitled', '未命名')}</p>
                {p.description && (
                  <p className="text-xs text-stone-500 line-clamp-2 mt-0.5">{p.description}</p>
                )}
                {(() => { const txt = formatProductPrice(p.price, p.price_unit ?? null, !!p.price_from, currency); return txt ? <p className="text-sm font-semibold text-[#b8864a] mt-1">{txt}</p> : null; })()}
              </div>
              <button onClick={() => handleDelete(p.id)}
                className="absolute top-2 right-2 w-7 h-7 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition"
                aria-label="Delete">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      ) : !adding ? (
        <div className="bg-white rounded-2xl border border-stone-200 flex flex-col items-center justify-center py-20 text-center">
          <div className="w-16 h-16 rounded-2xl bg-stone-100 flex items-center justify-center mb-4">
            <ImagePlus className="w-8 h-8 text-stone-300" />
          </div>
          <h3 className="text-[15px] font-semibold text-[#2c2c2c] mb-2">{t('No products yet', '暂无产品')}</h3>
          <p className="text-sm text-stone-500">{t('Add your first product to showcase your materials.', '添加第一件产品，开始展示您的建材。')}</p>
        </div>
      ) : null}
    </div>
  );
}
