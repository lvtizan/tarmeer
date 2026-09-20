'use client';

import Link from 'next/link';
import { ArrowRight, Play } from 'lucide-react';
import { resolveImageUrl } from '@/lib/imageUrl';
import { supplierFromProductsHref } from '@/lib/materialsNavigation';
import type { ProductPriceFields } from '@/lib/supplierProductUnits';
import ProductPriceLine from './ProductPriceLine';

type HubProduct = ProductPriceFields & {
  id: number;
  title: string | null;
  image_url: string;
  supplier_slug: string | null;
  supplier_name: string | null;
  video_url?: string | null;
};

function isValidSupplierSlug(slug: string | null): slug is string {
  return typeof slug === 'string' && /^[a-zA-Z0-9_-]+$/.test(slug);
}

export default function HubProductCard({ product }: { product: HubProduct }) {
  const title = product.title?.trim() || 'Material';
  const supplierSlug = isValidSupplierSlug(product.supplier_slug) ? product.supplier_slug : null;
  const supplierName = product.supplier_name?.trim() || null;
  const card = (
    <>
      <div className="relative aspect-[4/3] overflow-hidden rounded-2xl border border-stone-200 bg-[#efede8] transition-colors group-hover:border-[#c99a5f]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={resolveImageUrl(product.image_url)}
          alt={`${title}${supplierName ? ` — ${supplierName}` : ''}`}
          loading="lazy"
          className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.025]"
        />
        {product.video_url && (
          <span className="absolute right-2 top-2 inline-flex items-center gap-1 rounded-full bg-black/65 px-2 py-1 text-[10px] font-semibold text-white backdrop-blur-sm">
            <Play className="h-3 w-3 fill-current" /> Video
          </span>
        )}
      </div>
      <div className="pt-3">
        <p className="line-clamp-1 min-h-5 text-[15px] font-medium leading-5 text-[#1c1917] transition-colors group-hover:text-[#a87335]">
          {title}
        </p>
        <div className="min-h-6 min-w-0 overflow-hidden [&>p]:truncate">
          <ProductPriceLine product={product} />
        </div>
        <div className="mt-1.5 flex min-h-5 min-w-0 items-center justify-between gap-3">
          {supplierName && <p className="min-w-0 flex-1 truncate text-[12px] text-stone-500">{supplierName}</p>}
          {supplierSlug && (
            <span className="inline-flex shrink-0 items-center gap-1 text-[12px] font-semibold text-[#a87335] transition group-hover:text-[#855a29]">
              View supplier <ArrowRight className="h-3 w-3" />
            </span>
          )}
        </div>
      </div>
    </>
  );
  const className = 'group block min-w-0 [content-visibility:auto] [contain-intrinsic-size:auto_320px]';

  if (supplierSlug) {
    return (
      <Link href={supplierFromProductsHref(supplierSlug)} className={`${className} cursor-pointer`}>
        {card}
      </Link>
    );
  }

  return <div className={className}>{card}</div>;
}
