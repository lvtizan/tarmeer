// 供应商产品价格单位 — 建材外贸常用单位（单一真相源，禁止他处硬编码）。
// 中英标签：供应商门户用 useAdminT 选 zh/en；公共详情默认显示 label（zh）。

export interface ProductUnit {
  /** 入库存储值（预设用大写英文码；自定义直接存用户文本） */
  value: string;
  /** 英文显示 */
  en: string;
  /** 中文显示 */
  zh: string;
}

/** 建材外贸常用单位。CONTAINER 用于整柜报价。 */
export const PRODUCT_UNITS: ProductUnit[] = [
  { value: 'PCS', en: 'pcs', zh: '件' },
  { value: 'SET', en: 'set', zh: '套' },
  { value: 'SQM', en: '㎡', zh: '㎡' },
  { value: 'LM', en: 'linear m', zh: '延米' },
  { value: 'M', en: 'm', zh: '米' },
  { value: 'CBM', en: 'm³', zh: 'm³' },
  { value: 'KG', en: 'kg', zh: '千克' },
  { value: 'TON', en: 'ton', zh: '吨' },
  { value: 'ROLL', en: 'roll', zh: '卷' },
  { value: 'CTN', en: 'carton', zh: '箱' },
  { value: 'BAG', en: 'bag', zh: '袋' },
  { value: 'SHEET', en: 'sheet', zh: '张' },
  { value: 'CONTAINER', en: 'container', zh: '货柜' },
];

const UNIT_MAP = new Map(PRODUCT_UNITS.map(u => [u.value, u]));

/**
 * 供应商可选报价币种（单一真相源）。
 * 中国供应商按人民币报价是常态，站点币种（profile.country → AED/VND）只作默认值。
 * ⚠️ 后端 server/dist/controllers/supplierProductController.js 有一份同源白名单，改这里必须同步改那里。
 */
export const PRODUCT_CURRENCIES = ['AED', 'CNY', 'USD', 'VND'] as const;
export type ProductCurrency = (typeof PRODUCT_CURRENCIES)[number];

export interface ProductPriceFields {
  price: number | null;
  price_max: number | null;
  price_unit: string | null;
  price_currency: ProductCurrency | null;
  price_from: boolean;
}

/** 币种是否在白名单内。 */
export function isValidCurrency(currency: unknown): currency is ProductCurrency {
  return typeof currency === 'string' && (PRODUCT_CURRENCIES as readonly string[]).includes(currency);
}

const DECIMAL_PRICE_RE = /^\d{1,10}(?:\.\d{1,2})?$/;
const MAX_PRICE_CENTS = 999_999_999_999;

function parseDecimalPrice(value: unknown): { value: number; cents: number } | null {
  if (typeof value !== 'string' && typeof value !== 'number') return null;
  if (typeof value === 'number' && (!Number.isFinite(value) || !Number.isSafeInteger(Math.trunc(value)))) return null;
  const text = typeof value === 'string' ? value.trim() : String(value);
  if (!DECIMAL_PRICE_RE.test(text)) return null;
  const [whole, fraction = ''] = text.split('.');
  const cents = Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
  if (!Number.isSafeInteger(cents) || cents <= 0 || cents > MAX_PRICE_CENTS) return null;
  return { value: Number(text), cents };
}

function normalizePositivePrice(value: unknown): number | null {
  return parseDecimalPrice(value)?.value ?? null;
}

/** 把不可信 API 行中的五个价格字段收窄为公共前端契约。 */
export function normalizeProductPriceFields(value: unknown): ProductPriceFields {
  const row = value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
  const price = normalizePositivePrice(row.price);
  const hasPriceMax = row.price_max != null;
  const priceMax = hasPriceMax ? normalizePositivePrice(row.price_max) : null;
  const validRange = price !== null && (!hasPriceMax || (priceMax !== null && priceMax >= price));
  const unit = typeof row.price_unit === 'string' ? row.price_unit.trim() : '';
  return {
    price: validRange ? price : null,
    price_max: validRange ? priceMax : null,
    price_unit: unit || null,
    price_currency: isValidCurrency(row.price_currency) ? row.price_currency : null,
    price_from: row.price_from === true || row.price_from === 1 || row.price_from === '1',
  };
}

/** 单位是否有效：预设码 或 非空自定义文本。 */
export function isValidUnit(unit: unknown): boolean {
  if (typeof unit !== 'string') return false;
  return unit.trim().length > 0;
}

/** parsePriceInput 的失败原因：空 / 区间价 / 其它非法输入。 */
export type PriceParseFailure = 'empty' | 'range' | 'invalid';
export type PriceParseResult =
  | { ok: true; value: number }
  | { ok: false; reason: PriceParseFailure };

/** 区间价写法：120-200 / 120~200 / 120 — 200 / 120 到 200 / 120 至 200。 */
const RANGE_RE = /\d\s*(?:[-–—~～]|到|至)\s*\d/;

/**
 * 解析用户手填的价格文本。
 *
 * 存在的理由：价格输入框曾用 `<input type="number">`，浏览器对非法数字（如区间价 "120-200"）
 * 的 value sanitization 会把 value 读成空串——界面上还显示着 120-200，程序拿到的却是 ''，
 * 提交按钮永久置灰且不给任何提示（FA：供应商无法保存产品）。改用 text 输入 + 本函数显式解析，
 * 让每一种失败都有明确原因，绝不静默。
 */
export function parsePriceInput(raw: string): PriceParseResult {
  const s = raw.trim();
  if (!s) return { ok: false, reason: 'empty' };
  if (RANGE_RE.test(s)) return { ok: false, reason: 'range' };
  const parsed = parseDecimalPrice(s);
  if (!parsed) return { ok: false, reason: 'invalid' };
  return { ok: true, value: parsed.value };
}

export type ProductPriceRangeParseResult =
  | { ok: true; min: number; max: number | null }
  | { ok: false; field: 'min' | 'max'; reason: 'required' | 'invalid' | 'below_min' };

/** Parse the two form fields together so every product entry point enforces one range contract. */
export function parseProductPriceRange(minRaw: string, maxRaw: string): ProductPriceRangeParseResult {
  const min = parsePriceInput(minRaw);
  if (!min.ok) {
    return { ok: false, field: 'min', reason: min.reason === 'empty' ? 'required' : 'invalid' };
  }
  if (!maxRaw.trim()) return { ok: true, min: min.value, max: null };
  const max = parsePriceInput(maxRaw);
  if (!max.ok) return { ok: false, field: 'max', reason: 'invalid' };
  const minCents = parseDecimalPrice(minRaw)?.cents;
  const maxCents = parseDecimalPrice(maxRaw)?.cents;
  if (minCents == null || maxCents == null) return { ok: false, field: 'max', reason: 'invalid' };
  if (maxCents < minCents) return { ok: false, field: 'max', reason: 'below_min' };
  return { ok: true, min: min.value, max: max.value };
}

export type ProductPriceSubmissionResult =
  | { ok: true; payload: Partial<ProductPriceFields> }
  | { ok: false; field: 'min' | 'max' | 'unit'; reason: 'required' | 'invalid' | 'below_min' };

/** Shared save-boundary behavior for supplier portal and both admin product editors. */
export function buildProductPriceSubmission(input: {
  min: string;
  max: string;
  unit: string;
  currency: string;
  from: boolean;
  dirty: boolean;
}): ProductPriceSubmissionResult {
  if (!input.dirty) return { ok: true, payload: {} };
  const parsed = parseProductPriceRange(input.min, input.max);
  if (!parsed.ok) return parsed;
  const unit = input.unit.trim();
  if (!unit) return { ok: false, field: 'unit', reason: 'required' };
  return {
    ok: true,
    payload: {
      price: parsed.min,
      price_max: parsed.max,
      price_unit: unit,
      price_currency: isValidCurrency(input.currency) ? input.currency : null,
      price_from: parsed.max == null && input.from,
    },
  };
}

/** 把存储的 unit 值转成显示文本（预设码→中文 label；自定义→原样）。 */
export function unitLabel(unit?: string | null, lang: 'zh' | 'en' = 'zh'): string {
  if (!unit) return '';
  const preset = UNIT_MAP.get(unit);
  if (preset) return lang === 'en' ? preset.en : preset.zh;
  return unit; // 自定义文本
}

/**
 * 格式化价格展示。无价格(null/undefined)返回空串 → 调用方据此不渲染价格块。
 * 例：formatProductPrice(1200, 'SQM', true, 'AED') => 'AED 1,200 起 / ㎡'
 */
export function formatProductPrice(
  price: number | null | undefined,
  unit: string | null | undefined,
  from: boolean,
  currency: string,
  priceMaxOrLang: number | null | undefined | 'zh' | 'en' = null,
  lang: 'zh' | 'en' = 'zh',
): string {
  const legacyLang = typeof priceMaxOrLang === 'string' ? priceMaxOrLang : null;
  const priceMax = legacyLang ? null : priceMaxOrLang;
  const displayLang = legacyLang ?? lang;
  if (price == null || !Number.isFinite(Number(price)) || Number(price) <= 0) return '';
  const num = Number(price);
  const formatAmount = (value: number) => value.toLocaleString('en-US', { maximumFractionDigits: 2 });
  let amount = formatAmount(num);
  if (priceMax != null) {
    const max = Number(priceMax);
    if (!Number.isFinite(max) || max <= 0 || max < num) return '';
    amount += `–${formatAmount(max)}`;
  }
  const fromTxt = priceMax == null && from ? (displayLang === 'en' ? ' (from)' : ' 起') : '';
  const u = unitLabel(unit, displayLang);
  const unitTxt = u ? ` / ${u}` : '';
  return `${currency} ${amount}${fromTxt}${unitTxt}`;
}
