'use client';

import { useSiteLocale } from '@/contexts/SiteLocaleContext';
import { countryFromLang } from '@/lib/country';
import { formatProductPrice, type ProductPriceFields } from '@/lib/supplierProductUnits';

export default function ProductPriceLine({ product, compact = false }: { product: ProductPriceFields; compact?: boolean }) {
  const country = countryFromLang(useSiteLocale().lang);
  const label = formatProductPrice(
    product.price,
    product.price_unit,
    product.price_from,
    product.price_currency || country.currency,
    product.price_max,
    'en',
  );

  if (!label) return null;

  return (
    <p className={compact
      ? 'mt-1 min-h-4 truncate text-[10px] font-semibold leading-4 text-[#b8864a]'
      : 'mt-1 min-h-5 text-sm font-semibold leading-5 text-[#b8864a]'}>
      {label}
    </p>
  );
}
