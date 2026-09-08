export function supplierFromProductsHref(slug: string): string {
  return `/materials/suppliers/${encodeURIComponent(slug)}?from=products`;
}
