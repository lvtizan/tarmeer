export interface SupplierCategoryOption {
  value: string;
  label: string;
  label_zh?: string | null;
}

export const SUPPLIER_FALLBACK_CATEGORY_VALUES = [
  'furniture', 'new_materials', 'lighting', 'tiles', 'curtains', 'stone',
  'boards', 'decor', 'paint', 'art_paint', 'doors_windows', 'kitchen_bath',
  'hardware', 'flooring', 'stairs', 'plants',
];

const FALLBACK_CATEGORY_LABELS: Record<string, Pick<SupplierCategoryOption, 'label' | 'label_zh'>> = {
  lighting: { label: 'Lighting Fixtures', label_zh: '照明灯具' },
};

export function humanizeSupplierCategory(value: string): string {
  return value.replace(/_/g, ' ').replace(/\b\w/g, (m) => m.toUpperCase());
}

export function getSupplierFallbackCategoryLabel(value: string): Pick<SupplierCategoryOption, 'label' | 'label_zh'> {
  return FALLBACK_CATEGORY_LABELS[value] ?? { label: humanizeSupplierCategory(value) };
}

export function buildSupplierFallbackCategoryOptions(): SupplierCategoryOption[] {
  return SUPPLIER_FALLBACK_CATEGORY_VALUES.map((value) => ({
    value,
    ...getSupplierFallbackCategoryLabel(value),
  }));
}
