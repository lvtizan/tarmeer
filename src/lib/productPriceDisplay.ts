import { createElement, type ReactElement } from 'react';
// @ts-expect-error Node's native TypeScript test runner requires the explicit extension.
import { formatProductPrice, type ProductPriceFields } from './supplierProductUnits.ts';

export function buildProductPriceLabel(product: ProductPriceFields, fallbackCurrency: string): string {
  return formatProductPrice(
    product.price,
    product.price_unit,
    product.price_from,
    product.price_currency || fallbackCurrency,
    product.price_max,
    'en',
  );
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
