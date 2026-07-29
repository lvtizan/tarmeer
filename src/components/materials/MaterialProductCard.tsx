'use client';

// 新材料产品卡 — 目录产品流 / 详情页 Related 网格共用
// 铁律：封面 aspect-video；图片走 SmartImage variant（内部 resolveVariantUrl 取 -thumb，缺变体自动回退原图）
// 右上角放大镜 → 就地弹出该材料的图廊（复用 flooring Lightbox，全站放大交互一致）。
import { useState } from 'react';
import Link from 'next/link';
import { ZoomIn } from 'lucide-react';
import SmartImage from '@/components/ui/SmartImage';
import Lightbox, { type LightboxShot } from '@/components/flooring/Lightbox';
import { resolveImageUrl } from '@/lib/imageUrl';
import { ORIGIN_LABEL, ORIGIN_BADGE_CLASS } from '@/lib/supplierConstants';
import type { PublicMaterialProduct } from '@/lib/materialsApi';
import { useProductCategoryLabels } from '@/lib/useProductCategoryLabels';

export default function MaterialProductCard({ product }: { product: PublicMaterialProduct }) {
  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState(0);
  const catLabel = useProductCategoryLabels();
  const title = product.title || 'Material';

  // 图廊用该材料的多图（image_urls），解析成可直接 <img> 的绝对/静态路径
  const images = (product.image_urls.length ? product.image_urls : product.image_url ? [product.image_url] : [])
    .map((u) => resolveImageUrl(u))
    .filter(Boolean);
  const shots: LightboxShot[] = images.map((src, i) => ({
    src,
    alt: title,
    label: images.length > 1 ? `Photo ${i + 1}` : title,
  }));

  return (
    <div className="group relative">
      <Link href={`/materials/products/${product.id}`} className="block">
        <div className="aspect-video overflow-hidden rounded-2xl border border-stone-200 bg-stone-100">
          <SmartImage
            src={product.image_url}
            variant="thumb"
            alt={title}
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        </div>
        {product.category && (
          <p className="mt-3 text-[10px] font-medium uppercase tracking-wider text-[#b8864a]">
            {catLabel(product.category)}
          </p>
        )}
        <h3 className="mt-0.5 line-clamp-1 text-[15px] font-medium text-[#1c1917] transition-colors group-hover:text-[#b8864a]">
          {title}
        </h3>
        {product.supplier_name && (
          <div className="mt-1.5 flex min-w-0 items-center gap-2">
            <span className="truncate text-xs text-stone-500">{product.supplier_name}</span>
            <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${ORIGIN_BADGE_CLASS[product.supplier_origin]}`}>
              {ORIGIN_LABEL[product.supplier_origin]}
            </span>
          </div>
        )}
      </Link>

      {/* 右上角放大镜（复用 flooring 样式）：就地弹图廊，不跳转 */}
      {shots.length > 0 && (
        <button
          type="button"
          onClick={() => { setIndex(0); setOpen(true); }}
          aria-label={`Enlarge ${title}`}
          className="absolute right-2 top-2 inline-flex h-8 w-8 items-center justify-center rounded-full bg-black/45 text-white backdrop-blur transition hover:bg-black/70"
        >
          <ZoomIn className="h-4 w-4" />
        </button>
      )}

      {open && (
        <Lightbox shots={shots} alt={title} index={index} setIndex={setIndex} onClose={() => setOpen(false)} />
      )}
    </div>
  );
}
