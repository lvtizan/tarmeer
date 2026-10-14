import { parseSupplierProductSpecs } from './supplierProductLibrary';

interface GalleryProduct {
  image_url?: string | null;
  image_urls?: string[] | null;
  specs?: Parameters<typeof parseSupplierProductSpecs>[0];
}

export function isFullSlabProduct(product: GalleryProduct): boolean {
  return parseSupplierProductSpecs(product.specs).some(spec =>
    String(spec.label).trim().toLowerCase() === 'display format' &&
    String(spec.value).trim().toLowerCase() === 'full slab');
}

export function getMaterialSpecifications<T extends { label: string }>(specs: T[]): T[] {
  return specs.filter(spec => spec.label.trim().toLowerCase() !== 'display format');
}

/** Imported application references have their own asset directory, preserving the existing API. */
export function getMaterialGallery(product: GalleryProduct) {
  const fullSlab = isFullSlabProduct(product);
  const urls = product.image_urls?.length ? product.image_urls : product.image_url ? [product.image_url] : [];
  const unique = [...new Set(urls.filter(url => typeof url === 'string' && url.trim()))];
  const applicationImages: string[] = [];
  const productImages: string[] = [];
  for (const url of unique) {
    let application = false;
    try {
      application = fullSlab && /\/applications\/[^/]+\.webp$/i.test(new URL(url, 'https://www.tarmeer.com').pathname);
    } catch { /* Invalid legacy values remain in the existing image error flow. */ }
    (application ? applicationImages : productImages).push(url);
  }
  return { fullSlab, productImages, applicationImages };
}
