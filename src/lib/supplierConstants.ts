export const ORIGIN_LABEL: Record<'china' | 'dubai', string> = {
  china: '🇨🇳 China',
  dubai: '🇦🇪 Dubai',
};

/**
 * 公开供应商“通用标题”：用品类而非真实厂家名（藏身份 + 保 SEO 品类关键词）。
 * 与后端 server/dist/lib/supplierRedact.js 的 supplierPublicTitle 同口径。
 * 例：["system_windows"] → "System Windows Supplier"。
 */
export function supplierPublicTitle(categories: unknown): string {
  let arr: unknown = categories;
  if (typeof arr === 'string') {
    try { arr = JSON.parse(arr); } catch { arr = []; }
  }
  const first = Array.isArray(arr) && arr[0] ? String(arr[0]) : '';
  const label = first
    ? first.replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim().replace(/\b\w/g, (ch) => ch.toUpperCase())
    : 'Building Materials';
  return `${label} Supplier`;
}

// For light backgrounds (supplier cards, list pages)
export const ORIGIN_BADGE_CLASS: Record<'china' | 'dubai', string> = {
  china: 'bg-red-50 text-red-600',
  dubai: 'bg-emerald-50 text-emerald-700',
};

// For dark/overlay backgrounds (supplier detail hero)
export const ORIGIN_HERO_BADGE_CLASS: Record<'china' | 'dubai', string> = {
  china: 'bg-red-500/20 text-red-200 border border-red-400/20',
  dubai: 'bg-emerald-500/20 text-emerald-200 border border-emerald-400/20',
};
