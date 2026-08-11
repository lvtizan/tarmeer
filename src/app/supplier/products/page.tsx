'use client';

import { useState, useEffect, useRef } from 'react';
import { Plus, Trash2, ImagePlus, X, Pencil } from 'lucide-react';
import AdminSelect from '@/components/ui/AdminSelect';
import ImageUploadZone from '@/components/ui/ImageUploadZone';
import { useAdminT } from '@/hooks/useAdminLang';
import { ScreenSpinner } from '@/components/ui/Spinner';
import { PRODUCT_UNITS, PRODUCT_CURRENCIES, formatProductPrice, parseProductPriceRange, isValidCurrency, buildProductPriceSubmission } from '@/lib/supplierProductUnits';
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
  title_translated?: string | null;
  description_translated?: string | null;
  category?: string;
  image_url: string;
  image_urls?: string[];
  price?: number | null;
  price_max?: number | null;
  price_unit?: string | null;
  price_currency?: string | null;
  price_from?: 0 | 1 | boolean;
  sort_order?: number;
}

export default function SupplierProductsPage() {
  const { t } = useAdminT();

  // 品类选项从权威分类拉取(GET /suppliers/product-categories → product_categories 启用子类),
  // 禁止硬编码——否则供应商写入 supplier_products.category 的会是旧 token(污染真源)。
  const [categoryOptions, setCategoryOptions] = useState<{ value: string; label: string }[]>([
    { value: '', label: t('No category', '无品类') },
  ]);
  useEffect(() => {
    fetch(`${API_BASE}/suppliers/product-categories`)
      .then((r) => r.json())
      .then((d: { categories?: { value: string; label: string; label_zh?: string | null }[] }) => {
        const cats = (d.categories || []).map((c) => ({
          value: c.value,
          label: c.label_zh && c.label_zh !== c.label ? `${c.label} · ${c.label_zh}` : c.label,
        }));
        setCategoryOptions([{ value: '', label: t('No category', '无品类') }, ...cats]);
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  // null = 新增；非空 = 正在编辑该产品(走弹层 + PUT)
  const [editingId, setEditingId] = useState<number | null>(null);
  const editingIdRef = useRef<number | null>(null);
  const editingExplicitCurrencyRef = useRef<string | null>(null);
  const currencyTouchedRef = useRef(false);

  // new product form
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newCat, setNewCat] = useState('');
  const [newImageUrls, setNewImageUrls] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const [newPrice, setNewPrice] = useState('');
  const [newPriceMax, setNewPriceMax] = useState('');
  const [originalPriceFields, setOriginalPriceFields] = useState<Pick<Product, 'price' | 'price_max' | 'price_unit' | 'price_currency' | 'price_from'> | null>(null);
  const [priceError, setPriceError] = useState('');
  const [priceErrorField, setPriceErrorField] = useState<'min' | 'max' | 'unit' | null>(null);
  const [newUnit, setNewUnit] = useState('');          // '' = 未选；'__custom__' = 自定义
  const [newUnitCustom, setNewUnitCustom] = useState('');
  const [newPriceFrom, setNewPriceFrom] = useState(false);
  /** 站点默认币种（由供应商所属国家决定），作为新产品的初始值和旧产品的兜底展示 */
  const [currency, setCurrency] = useState('AED');
  const [newCurrency, setNewCurrency] = useState('AED');
  const [newTitleEn, setNewTitleEn] = useState('');
  const [newDescEn, setNewDescEn] = useState('');
  const [translating, setTranslating] = useState<'title' | 'desc' | null>(null);

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
      .then(data => {
        if (!data?.profile?.country) return;
        // 国家币种未必在报价白名单内（将来加国家时）→ 兜底到白名单首项，避免提交被后端 400
        const raw = getCountry(data.profile.country).currency;
        const cur = isValidCurrency(raw) ? raw : PRODUCT_CURRENCIES[0];
        setCurrency(cur);
        if (!currencyTouchedRef.current && (editingIdRef.current == null || editingExplicitCurrencyRef.current == null)) setNewCurrency(cur);
      })
      .catch(() => {});
  }, []);

  const UNIT_OPTIONS = [
    { value: '', label: t('Select unit', '选择单位') },
    ...PRODUCT_UNITS.map(u => ({ value: u.value, label: u.zh === u.en ? u.zh : `${u.zh} / ${u.en}` })),
    { value: '__custom__', label: t('Custom…', '自定义…') },
  ];

  const CURRENCY_OPTIONS = PRODUCT_CURRENCIES.map(c => ({ value: c, label: c }));

  const priceRange = parseProductPriceRange(newPrice, newPriceMax);
  const priceHint = priceRange.ok || (!newPrice.trim() && !newPriceMax.trim()) ? ''
    : priceRange.field === 'min'
      ? t('Minimum price must be a positive number with up to 2 decimal places.', '最低价必须是大于 0、最多两位小数的数字。')
      : priceRange.reason === 'below_min'
        ? t('Maximum price must be greater than or equal to the minimum price.', '最高价必须大于或等于最低价。')
        : t('Maximum price must be a positive number with up to 2 decimal places.', '最高价必须是大于 0、最多两位小数的数字。');
  const displayedPriceError = priceHint || priceError;
  const displayedPriceErrorField = priceHint ? (priceRange.ok ? null : priceRange.field) : priceErrorField;

  const resetForm = () => {
    setNewTitle(''); setNewDesc(''); setNewCat(''); setNewImageUrls([]);
    setNewPrice(''); setNewPriceMax(''); setOriginalPriceFields(null); setPriceError(''); setPriceErrorField(null); setNewUnit(''); setNewUnitCustom(''); setNewPriceFrom(false);
    setNewCurrency(currency);
    setNewTitleEn(''); setNewDescEn('');
    setMsg('');
  };

  // 关闭表单(新增面板 / 编辑弹层通用)
  const closeForm = () => { setAdding(false); editingIdRef.current = null; editingExplicitCurrencyRef.current = null; currencyTouchedRef.current = false; setEditingId(null); resetForm(); };

  // 打开新增(内联面板)
  const openAdd = () => { resetForm(); editingIdRef.current = null; editingExplicitCurrencyRef.current = null; currencyTouchedRef.current = false; setEditingId(null); setNewCurrency(currency); setAdding(true); };

  // 打开编辑弹层：用产品当前数据预填(含已有图片，支持加图/换图)
  const openEdit = (p: Product) => {
    setNewTitle(p.title || '');
    setNewTitleEn(p.title_translated || '');
    setNewDesc(p.description || '');
    setNewDescEn(p.description_translated || '');
    setNewCat(p.category || '');
    const imgs = Array.isArray(p.image_urls) && p.image_urls.length > 0 ? p.image_urls : (p.image_url ? [p.image_url] : []);
    setNewImageUrls(imgs);
    setNewPrice(p.price != null ? String(p.price) : '');
    setNewPriceMax(p.price_max != null ? String(p.price_max) : '');
    setOriginalPriceFields({ price: p.price, price_max: p.price_max, price_unit: p.price_unit, price_currency: p.price_currency, price_from: p.price_from });
    const unit = p.price_unit || '';
    if (unit && PRODUCT_UNITS.some(u => u.value === unit)) { setNewUnit(unit); setNewUnitCustom(''); }
    else if (unit) { setNewUnit('__custom__'); setNewUnitCustom(unit); }
    else { setNewUnit(''); setNewUnitCustom(''); }
    setNewPriceFrom(!!p.price_from);
    const explicitCurrency = p.price_currency && isValidCurrency(p.price_currency) ? p.price_currency : null;
    editingExplicitCurrencyRef.current = explicitCurrency;
    currencyTouchedRef.current = false;
    setNewCurrency(explicitCurrency || currency);
    setMsg('');
    setAdding(false);
    editingIdRef.current = p.id;
    setEditingId(p.id);
  };

  const translateField = async (text: string): Promise<string> => {
    if (!text.trim()) return '';
    const res = await fetch(`${API_BASE}/suppliers/me/translate`, {
      method: 'POST', headers: authHeaders() as HeadersInit, body: JSON.stringify({ text }),
    });
    const data = await res.json();
    return data?.translated || '';
  };
  const autoTranslateTitle = async (force = false) => {
    if (!newTitle.trim() || (newTitleEn.trim() && !force)) return;
    setTranslating('title');
    try { setNewTitleEn(await translateField(newTitle)); } finally { setTranslating(null); }
  };
  const autoTranslateDesc = async (force = false) => {
    if (!newDesc.trim() || (newDescEn.trim() && !force)) return;
    setTranslating('desc');
    try { setNewDescEn(await translateField(newDesc)); } finally { setTranslating(null); }
  };

  // 新增(POST) / 编辑(PUT) 共用保存逻辑，按 editingId 分支
  const handleSave = async () => {
    if (newImageUrls.length === 0) { setMsg(t('Please upload at least one image.', '请至少上传一张图片。')); return; }
    const unitVal = newUnit === '__custom__' ? newUnitCustom.trim() : newUnit;
    const priceDirty = editingId == null || originalPriceFields == null
      || newPrice !== (originalPriceFields.price != null ? String(originalPriceFields.price) : '')
      || newPriceMax !== (originalPriceFields.price_max != null ? String(originalPriceFields.price_max) : '')
      || unitVal !== (originalPriceFields.price_unit || '')
      || newCurrency !== (originalPriceFields.price_currency || currency)
      || newPriceFrom !== !!originalPriceFields.price_from;
    const priceSubmission = buildProductPriceSubmission({
      min: newPrice, max: newPriceMax, unit: unitVal, currency: newCurrency, from: newPriceFrom, dirty: priceDirty,
    });
    if (!priceSubmission.ok) {
      setPriceErrorField(priceSubmission.field); setPriceError(priceSubmission.field === 'min'
        ? t('Enter a minimum price greater than 0 with up to 2 decimal places.', '请填写大于 0、最多两位小数的最低价。')
        : priceSubmission.field === 'unit'
          ? t('Please select or enter a unit.', '请选择或填写单位。')
        : priceSubmission.reason === 'below_min'
          ? t('Maximum price must be greater than or equal to the minimum price.', '最高价必须大于或等于最低价。')
          : t('Enter a maximum price greater than 0 with up to 2 decimal places, or leave it blank.', '最高价请填写大于 0、最多两位小数的数字，或留空。'));
      return;
    }
    setSaving(true);
    setMsg('');
    try {
      const isEdit = editingId != null;
      const res = await fetch(`${API_BASE}/suppliers/me/products${isEdit ? `/${editingId}` : ''}`, {
        method: isEdit ? 'PUT' : 'POST',
        headers: authHeaders() as HeadersInit,
        body: JSON.stringify({
          title: newTitle || null,
          description: newDesc || null,
          title_translated: newTitleEn || null,
          description_translated: newDescEn || null,
          category: newCat || null,
          image_urls: newImageUrls,
          ...priceSubmission.payload,
          // 编辑时回传原 sort_order：后端 updateProduct 用 sort_order=? (非 COALESCE)，
          // 不回传会被重写成 0，将来接入拖拽排序会乱序。JSON.stringify 会丢弃 undefined（新增时不发）。
          sort_order: isEdit ? (products.find(p => p.id === editingId)?.sort_order ?? 0) : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      if (isEdit) {
        // 用服务端返回整行覆盖，但 image_urls 用本地已解析的数组(服务端返回的是 JSON 字符串)
        setProducts(prev => prev.map(p => p.id === editingId ? { ...p, ...data.product, image_urls: newImageUrls } : p));
      } else {
        setProducts(prev => [...prev, data.product]);
      }
      closeForm();
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

  // 表单主体(图片区 + 字段 + 底部按钮)——新增面板与编辑弹层共用，单一真源避免两套表单漂移
  const formInner = (
    <>
      {/* Image picker：预填已有图片，支持加图/换图/删图 */}
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
            onBlur={() => autoTranslateTitle()}
            placeholder={t('Product name', '请输入产品名称')} className={inputCls} />
          <div className="mt-2">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-stone-400">{t('English name (auto, editable)', '英文名称（自动翻译，可改）')}</span>
              <button type="button" onClick={() => autoTranslateTitle(true)} disabled={!newTitle.trim() || translating === 'title'}
                className="text-xs text-[#b8864a] hover:underline disabled:opacity-40">
                {translating === 'title' ? t('Translating…', '翻译中…') : t('Re-translate', '重新翻译')}
              </button>
            </div>
            <input type="text" value={newTitleEn} onChange={e => setNewTitleEn(e.target.value)}
              placeholder={t('Auto-filled after you type the name', '填完名称后自动翻译')} className={inputCls} />
          </div>
        </div>
        <div>
          <label className={labelCls}>{t('Category', '品类')}</label>
          <AdminSelect
            options={newCat && !categoryOptions.some(o => o.value === newCat)
              ? [...categoryOptions, { value: newCat, label: newCat }]
              : categoryOptions}
            value={newCat} onChange={setNewCat} />
        </div>
        <div className="sm:col-span-2">
          <label className={labelCls}>{t('Price range', '价格区间')}</label>
          <div className="flex items-center gap-2">
            {/* 币种可选：中国供应商常按人民币报价，站点币种只作默认值 */}
            <div className="w-[104px] shrink-0">
              <label htmlFor="supplier-price-currency" className="sr-only">{t('Currency', '币种')}</label>
              <AdminSelect id="supplier-price-currency" options={CURRENCY_OPTIONS} value={newCurrency} onChange={(value) => { currencyTouchedRef.current = true; setNewCurrency(value); }} />
            </div>
            <div className="grid flex-1 grid-cols-2 gap-2">
              <div>
                <label htmlFor="supplier-price-min" className="mb-1 block text-xs text-stone-500">{t('Minimum price *', '最低价 *')}</label>
                <input id="supplier-price-min" type="text" inputMode="decimal" value={newPrice} onChange={e => { setNewPrice(e.target.value); setPriceError(''); setPriceErrorField(null); }}
                  aria-describedby={displayedPriceErrorField === 'min' ? 'supplier-price-error' : undefined} aria-invalid={displayedPriceErrorField === 'min'}
                  placeholder="0.00" className={`${inputCls} bg-white`} />
              </div>
              <div>
                <label htmlFor="supplier-price-max" className="mb-1 block text-xs text-stone-500">{t('Maximum price (optional)', '最高价（选填）')}</label>
                <input id="supplier-price-max" type="text" inputMode="decimal" value={newPriceMax} onChange={e => { setNewPriceMax(e.target.value); setPriceError(''); setPriceErrorField(null); }}
                  aria-describedby={displayedPriceErrorField === 'max' ? 'supplier-price-error' : undefined} aria-invalid={displayedPriceErrorField === 'max'}
                  placeholder="0.00" className={`${inputCls} bg-white`} />
              </div>
            </div>
          </div>
          {displayedPriceError && <p id="supplier-price-error" role="alert" className="mt-1.5 text-xs text-red-600">{displayedPriceError}</p>}
          <label className="mt-2 flex items-center gap-2 text-xs text-stone-500 cursor-pointer">
            <input type="checkbox" checked={newPriceFrom} onChange={e => setNewPriceFrom(e.target.checked)}
              className="rounded border-stone-300 text-[#b8864a] focus:ring-[#B8864A]/30" />
            {t('Show as a starting price when no maximum is provided', '未填写最高价时显示为起价')}
          </label>
        </div>
        <div>
          <label htmlFor="supplier-price-unit" className={labelCls}>{t('Unit *', '单位 *')}</label>
          <AdminSelect id="supplier-price-unit" options={UNIT_OPTIONS} value={newUnit} onChange={(value) => { setNewUnit(value); setPriceError(''); setPriceErrorField(null); }} columns={2}
            error={displayedPriceErrorField === 'unit'} aria-describedby={displayedPriceErrorField === 'unit' ? 'supplier-price-error' : undefined} aria-invalid={displayedPriceErrorField === 'unit'} />
          {newUnit === '__custom__' && (
            <input id="supplier-price-unit-custom" type="text" value={newUnitCustom} onChange={e => { setNewUnitCustom(e.target.value); setPriceError(''); setPriceErrorField(null); }}
              aria-label={t('Custom unit', '自定义单位')} aria-describedby={displayedPriceErrorField === 'unit' ? 'supplier-price-error' : undefined} aria-invalid={displayedPriceErrorField === 'unit'}
              placeholder={t('e.g. per pallet', '如：每托盘')} className={`${inputCls} mt-2`} />
          )}
        </div>
        <div className="sm:col-span-2">
          <label className={labelCls}>{t('Description', '产品描述')}</label>
          <textarea value={newDesc} onChange={e => setNewDesc(e.target.value)} rows={3}
            onBlur={() => autoTranslateDesc()}
            placeholder={t('Brief description', '简短描述')}
            className="w-full px-5 py-3 rounded-2xl border border-stone-200 bg-stone-50/80 text-[15px] text-[#1c1917] placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-[#B8864A]/15 focus:border-[#B8864A] focus:bg-white transition resize-none" />
          <div className="mt-2">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-stone-400">{t('English description (auto, editable)', '英文描述（自动翻译，可改）')}</span>
              <button type="button" onClick={() => autoTranslateDesc(true)} disabled={!newDesc.trim() || translating === 'desc'}
                className="text-xs text-[#b8864a] hover:underline disabled:opacity-40">
                {translating === 'desc' ? t('Translating…', '翻译中…') : t('Re-translate', '重新翻译')}
              </button>
            </div>
            <textarea value={newDescEn} onChange={e => setNewDescEn(e.target.value)} rows={2}
              placeholder={t('Auto-filled after you type the description', '填完描述后自动翻译')}
              className="w-full px-5 py-3 rounded-2xl border border-stone-200 bg-stone-50/80 text-[15px] text-[#1c1917] placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-[#B8864A]/15 focus:border-[#B8864A] focus:bg-white transition resize-none" />
          </div>
        </div>
      </div>

      {msg && <p className="text-sm text-red-600 bg-red-50 px-4 py-2 rounded-2xl">{msg}</p>}

      <div className="flex justify-end gap-3">
        <button onClick={closeForm}
          className="h-11 px-5 rounded-2xl border border-stone-200 text-[15px] text-stone-600 hover:bg-stone-50 transition">
          {t('Cancel', '取消')}
        </button>
        {/* 只在"正在进行中"时禁用。校验不通过不置灰——交给 handleSave 报出具体原因，
            否则用户只看到一个灰按钮，无从知道哪一栏有问题（供应商无法保存产品的成因）。 */}
        <button onClick={handleSave} disabled={saving || translating !== null} className="btn-primary flex items-center gap-2 disabled:opacity-50">
          <Plus className="w-4 h-4" />
          {saving ? t('Saving...', '保存中...') : editingId != null ? t('Save Changes', '保存修改') : t('Add Product', '添加产品')}
        </button>
      </div>
    </>
  );

  return (
    <div className="max-w-4xl space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-[#2c2c2c]">{t('Products', '产品')}</h1>
          <p className="text-sm text-stone-500 mt-1">{t(`${products.length} product${products.length !== 1 ? 's' : ''} uploaded`, `已上传 ${products.length} 件产品`)}</p>
        </div>
        {/* 开表单时同步默认币种：profile 若在挂载后才返回，避免表单停留在初始 AED 而误存错币种 */}
        {!adding && editingId == null && (
          <button onClick={openAdd} className="btn-primary flex items-center gap-2">
            <Plus className="w-4 h-4" /> {t('Add Product', '添加产品')}
          </button>
        )}
      </div>

      {/* 新增产品：内联面板 */}
      {adding && (
        <div className="bg-white rounded-2xl border border-stone-200 p-5 sm:p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-[15px] font-semibold text-[#2c2c2c]">{t('New Product', '新增产品')}</h2>
            <button onClick={closeForm} className="text-stone-400 hover:text-stone-600 transition p-1">
              <X className="w-5 h-5" />
            </button>
          </div>
          {formInner}
        </div>
      )}

      {/* 编辑产品：弹层(支持加图/换图) */}
      {editingId != null && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 backdrop-blur-sm p-4 sm:p-8" onClick={closeForm}>
          <div className="w-full max-w-2xl rounded-2xl bg-white p-5 sm:p-6 space-y-4 shadow-xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h2 className="text-[15px] font-semibold text-[#2c2c2c]">{t('Edit Product', '编辑产品')}</h2>
              <button onClick={closeForm} className="text-stone-400 hover:text-stone-600 transition p-1">
                <X className="w-5 h-5" />
              </button>
            </div>
            {formInner}
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
                <img src={p.image_url} alt={p.title || ''} className="w-full h-full object-contain" />
                {Array.isArray(p.image_urls) && p.image_urls.length > 1 && (
                  <span className="absolute bottom-1.5 left-1.5 bg-black/50 text-white text-[10px] px-1.5 py-0.5 rounded-md">
                    +{p.image_urls.length - 1}
                  </span>
                )}
                {/* 编辑/换图：图片右下角，hover 显现 */}
                <button onClick={() => openEdit(p)}
                  className="absolute bottom-2 right-2 w-8 h-8 bg-white/95 text-stone-600 border border-stone-200 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition hover:text-[#b8864a] shadow-sm"
                  aria-label={t('Edit', '编辑')}>
                  <Pencil className="w-4 h-4" />
                </button>
              </div>
              <div className="p-3">
                {p.category && (
                  <p className="text-[10px] font-semibold text-[#b8864a] uppercase tracking-wider mb-0.5">{p.category}</p>
                )}
                <p className="text-sm font-medium text-[#2c2c2c] line-clamp-1">{p.title || t('Untitled', '未命名')}</p>
                {p.description && (
                  <p className="text-xs text-stone-500 line-clamp-2 mt-0.5">{p.description}</p>
                )}
                {(() => { const txt = formatProductPrice(p.price, p.price_unit ?? null, !!p.price_from, p.price_currency || currency, p.price_max); return txt ? <p className="text-sm font-semibold text-[#b8864a] mt-1">{txt}</p> : null; })()}
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
