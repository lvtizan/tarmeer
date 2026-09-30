'use client';
import Link from 'next/link';
import { ArrowRight, Play } from 'lucide-react';
import { supplierFromProductsHref } from '@/lib/materialsNavigation';
import { materialProductTitle, recordMaterialsPosition } from '@/lib/materialsProcurement';
import type { ProductPriceFields } from '@/lib/supplierProductUnits';
import ProductPriceLine from './ProductPriceLine';
import MaterialImage from './MaterialImage';
type HubProduct = ProductPriceFields & {
  id: number; title: string | null; image_url: string; supplier_slug: string | null; supplier_name: string | null;
  category?: string | null; video_url?: string | null; model?: string | null; material?: string | null; availability?: string | null; lead_time_days?: number | null;
};
export default function HubProductCard({ product, returnTo }: { product: HubProduct; returnTo?: string }) {
  const title = materialProductTitle(product);
  const href = `/materials/products/${product.id}${returnTo ? `?returnTo=${encodeURIComponent(returnTo)}` : ''}`;
  const slug = product.supplier_slug && /^[a-zA-Z0-9_-]+$/.test(product.supplier_slug) ? product.supplier_slug : null;
  return <article className="group min-w-0">
    <div className="relative aspect-[4/3] overflow-hidden rounded-xl border border-stone-200 bg-white">
      <MaterialImage key={product.image_url} src={product.image_url} alt={title} />
      <Link href={href} onClick={recordMaterialsPosition} aria-label={`View ${title}`} className="absolute inset-0 rounded-xl focus-visible:ring-2 focus-visible:ring-[#b8864a]" />
      {product.video_url && <span className="pointer-events-none absolute right-2 top-2 inline-flex items-center gap-1 rounded-full bg-black/75 px-2 py-1 text-[10px] font-semibold text-white"><Play className="h-3 w-3" />Video</span>}
    </div>
    <Link href={href} onClick={recordMaterialsPosition} className="mt-2 block hover:text-[#92652e]"><h3 className="line-clamp-2 min-h-10 text-sm font-medium leading-5 text-stone-900">{title}</h3></Link>
    <p className="mt-1 truncate text-xs text-stone-600">{product.model ? `Model: ${product.model}` : product.material || 'Specifications to confirm'}</p>
    <ProductPriceLine product={product} />
    <p className="mt-1 text-xs text-stone-600">{product.availability === 'uae_stock' ? 'UAE stock · confirm quantity' : product.availability === 'china_order' ? 'Order from China' : 'Availability to confirm'}{product.lead_time_days != null ? ` · ${product.lead_time_days} days` : ''}</p>
    <div className="mt-2 flex flex-wrap items-center justify-between gap-1 border-t border-stone-200 pt-2 text-xs">
      <span className="text-stone-600">Via Tarmeer</span>
      {slug && <Link href={supplierFromProductsHref(slug)} className="inline-flex items-center gap-1 font-semibold text-[#92652e]">View supplier<ArrowRight className="h-3 w-3" /></Link>}
    </div>
  </article>;
}
