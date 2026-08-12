'use client';

import { useSiteLocale } from '@/contexts/SiteLocaleContext';
import { countryFromLang } from '@/lib/country';
import { ProductPriceText } from '@/lib/productPriceDisplay';
import type { ProductPriceFields } from '@/lib/supplierProductUnits';

export default function ProductPriceLine({ product, compact = false }: { product: ProductPriceFields; compact?: boolean }) {
  const country = countryFromLang(useSiteLocale().lang);
  return <ProductPriceText product={product} compact={compact} fallbackCurrency={country.currency} />;
}
