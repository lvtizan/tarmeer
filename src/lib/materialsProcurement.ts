export const PROCUREMENT_FILTER_KEYS = ['q', 'category', 'currency', 'unit', 'origin', 'availability', 'material', 'spec', 'lead_time_max', 'price_min', 'price_max', 'sort'] as const;
export type ProcurementFilters = Partial<Record<typeof PROCUREMENT_FILTER_KEYS[number], string>>;
export function readProcurementFilters(params: URLSearchParams | { get(key: string): string | null }): ProcurementFilters {
  return Object.fromEntries(PROCUREMENT_FILTER_KEYS.map(key => [key, params.get(key)?.trim().slice(0, 160) || '']).filter(([, value]) => value));
}
export function safeMaterialsReturn(value: string | null | undefined): string {
  if (!value || value.length > 2000) return '/materials?tab=products';
  try {
    const url = new URL(value, 'https://local.invalid');
    return url.origin === 'https://local.invalid' && url.pathname === '/materials' ? url.pathname + url.search : '/materials?tab=products';
  } catch { return '/materials?tab=products'; }
}
export function materialProductTitle(product: { id: number; title?: string | null; category?: string | null }): string {
  const title = product.title?.trim();
  if (title && !/^(material|product|new material|untitled)$/i.test(title)) return title;
  return `Product ${product.id} · Details under review`;
}
export function materialsPositionKey(search: string): string {
  const params = new URLSearchParams(search);
  params.sort();
  return `materials-position:${params}`;
}
export function recordMaterialsPosition(): void {
  if (typeof window === 'undefined' || window.location.pathname !== '/materials') return;
  try { sessionStorage.setItem(materialsPositionKey(window.location.search), String(window.scrollY)); } catch { /* storage may be disabled */ }
}

export function mergeProcurementFilters(current: ProcurementFilters, changes: ProcurementFilters): ProcurementFilters {
  const next = Object.fromEntries(Object.entries({ ...current, ...changes }).filter(([, value]) => Boolean(value))) as ProcurementFilters;
  if (!next.category) delete next.spec;
  if (!next.currency || !next.unit) {
    delete next.price_min;
    delete next.price_max;
    if (next.sort?.startsWith('price_')) delete next.sort;
  }
  return next;
}

type DirectoryPage<T> = {
  products: T[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
  error?: string;
};
/** Rebuild deep-list DOM before restoring scroll, even after a detail-page reload/cache expiry. */
export async function restoreDirectoryPages<T extends { id: number }>(
  load: (page: number) => Promise<DirectoryPage<T>>,
  requestedPage: number,
  isActive: () => boolean = () => true,
): Promise<DirectoryPage<T>> {
  let result = await load(1);
  const target = Number.isSafeInteger(requestedPage) ? Math.max(1, requestedPage) : 1;
  const products = new Map(result.products.map(product => [product.id, product]));
  while (!result.error && isActive() && result.pagination.page < Math.min(target, result.pagination.totalPages)) {
    const next = await load(result.pagination.page + 1);
    if (next.error) return next; // Keep the saved destination for an explicit retry.
    for (const product of next.products) products.set(product.id, product);
    result = next;
  }
  return { ...result, products: [...products.values()] };
}
