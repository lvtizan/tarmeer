export interface SupplierLibraryProduct {
  id: number;
  title?: string | null;
  title_translated?: string | null;
  description?: string | null;
  description_translated?: string | null;
  category?: string | null;
  specs?: Array<{ label?: unknown; value?: unknown }> | string | null;
}

interface ProductSpec {
  label?: unknown;
  value?: unknown;
}

export interface IndexedSupplierProduct<T extends SupplierLibraryProduct> {
  product: T;
  series: string;
  searchText: string;
}

const FALLBACK_SERIES = 'Other materials';

export function parseSupplierProductSpecs(raw: SupplierLibraryProduct['specs']): ProductSpec[] {
  const normalize = (items: unknown[]): ProductSpec[] => items.flatMap((item) => {
    if (typeof item === 'string') {
      const separator = item.indexOf(':');
      if (separator < 1) return [];
      return [{ label: item.slice(0, separator).trim(), value: item.slice(separator + 1).trim() }];
    }
    if (!item || typeof item !== 'object') return [];
    return [item as ProductSpec];
  });
  if (Array.isArray(raw)) return normalize(raw);
  if (typeof raw !== 'string') return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? normalize(parsed) : [];
  } catch {
    return [];
  }
}

export function normalizeSupplierProductSearch(value: unknown): string {
  return String(value || '').normalize('NFKC').toLocaleLowerCase();
}

export function getSupplierProductSeries(
  product: SupplierLibraryProduct,
  categoryLabel: (category: string) => string,
): string {
  const specs = parseSupplierProductSpecs(product.specs);
  const series = specs.find((spec) => /series|系列/i.test(String(spec.label || '')))?.value;
  if (typeof series === 'string' && series.trim()) return series.trim().slice(0, 120);
  if (product.category) return categoryLabel(product.category);
  return FALLBACK_SERIES;
}

export function indexSupplierProducts<T extends SupplierLibraryProduct>(
  products: T[],
  categoryLabel: (category: string) => string,
): IndexedSupplierProduct<T>[] {
  return products.map((product) => {
    const series = getSupplierProductSeries(product, categoryLabel);
    const specs = parseSupplierProductSpecs(product.specs);
    return {
      product,
      series,
      searchText: normalizeSupplierProductSearch([
        product.title,
        product.title_translated,
        product.description,
        product.description_translated,
        product.category ? categoryLabel(product.category) : '',
        series,
        ...specs.flatMap((spec) => [spec.label, spec.value]),
      ].join(' ')),
    };
  });
}

export function filterIndexedSupplierProducts<T extends SupplierLibraryProduct>(
  products: IndexedSupplierProduct<T>[],
  selectedSeries: string | null,
  query: string,
): T[] {
  const normalizedQuery = normalizeSupplierProductSearch(query.trim());
  return products
    .filter((item) => !selectedSeries || item.series === selectedSeries)
    .filter((item) => !normalizedQuery || item.searchText.includes(normalizedQuery))
    .map((item) => item.product);
}
