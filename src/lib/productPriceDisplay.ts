import { createElement, type ReactElement } from 'react';
// @ts-expect-error Node's native TypeScript test runner requires the explicit extension.
import { formatProductPrice, normalizeProductPriceUnit, type ProductPriceFields } from './supplierProductUnits.ts';

export function buildProductPriceLabel(product: ProductPriceFields, _fallbackCurrency: string): string {
  const unit = normalizeProductPriceUnit(product.price_unit, product.price_currency);
  if (!product.price_currency || !unit) return 'Request a quote';
  return formatProductPrice(
    product.price,
    unit,
    product.price_from,
    product.price_currency,
    product.price_max,
    'en',
  ).replace(/\bpcs\b/gi, 'piece').replace(/㎡/g, 'm²') || 'Request a quote';
}

export function ProductPriceText({
  product,
  fallbackCurrency,
  compact = false,
}: {
  product: ProductPriceFields;
  fallbackCurrency: string;
  compact?: boolean;
}): ReactElement | null {
  const label = buildProductPriceLabel(product, fallbackCurrency);
  if (!label) return null;

  return createElement('p', {
    className: compact
      ? 'mt-1 min-h-4 truncate text-[10px] font-semibold leading-4 text-[#b8864a]'
      : 'mt-1 min-h-5 text-sm font-semibold leading-5 text-[#b8864a]',
  }, label);
}
