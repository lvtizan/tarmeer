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

/** 单位是否有效：预设码 或 非空自定义文本。 */
export function isValidUnit(unit: unknown): boolean {
  if (typeof unit !== 'string') return false;
  return unit.trim().length > 0;
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
  lang: 'zh' | 'en' = 'zh',
): string {
  if (price == null || Number.isNaN(Number(price))) return '';
  const num = Number(price);
  const amount = num.toLocaleString('en-US', { maximumFractionDigits: 2 });
  const fromTxt = from ? (lang === 'en' ? ' (from)' : ' 起') : '';
  const u = unitLabel(unit, lang);
  const unitTxt = u ? ` / ${u}` : '';
  return `${currency} ${amount}${fromTxt}${unitTxt}`;
}
