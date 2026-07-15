// 新材料产品卡 — 目录产品流 / 详情页 Related 网格共用
// 铁律：封面 aspect-video；图片走 SmartImage variant（内部 resolveVariantUrl 取 -thumb，缺变体自动回退原图）
import Link from 'next/link';
import SmartImage from '@/components/ui/SmartImage';
import { ORIGIN_LABEL, ORIGIN_BADGE_CLASS } from '@/lib/supplierConstants';
import type { PublicMaterialProduct } from '@/lib/materialsApi';

export default function MaterialProductCard({ product }: { product: PublicMaterialProduct }) {
  return (
    <Link href={`/materials/products/${product.id}`} className="group block">
      <div className="aspect-video rounded-2xl overflow-hidden bg-stone-100 border border-stone-200">
        <SmartImage
          src={product.image_url}
          variant="thumb"
          alt={product.title || 'Material'}
          loading="lazy"
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
        />
      </div>
      {product.category && (
        <p className="text-[10px] font-medium text-[#b8864a] uppercase tracking-wider mt-3">
          {product.category}
        </p>
      )}
      <h3 className="text-[15px] font-medium text-[#1c1917] mt-0.5 line-clamp-1 group-hover:text-[#b8864a] transition-colors">
        {product.title || 'Material'}
      </h3>
      {product.supplier_name && (
        <div className="flex items-center gap-2 mt-1.5 min-w-0">
          <span className="text-xs text-stone-500 truncate">{product.supplier_name}</span>
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${ORIGIN_BADGE_CLASS[product.supplier_origin]}`}>
            {ORIGIN_LABEL[product.supplier_origin]}
          </span>
        </div>
      )}
    </Link>
  );
}
