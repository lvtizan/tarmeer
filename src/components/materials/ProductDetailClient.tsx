'use client';

// 新材料产品详情页 client — spec §1.2
// 数据由 server page（fetchMaterialProduct）SSR 传入，无客户端二次拉取。
// 铁律：主图/相关卡 aspect-video；无内容模块（specs/certifications/related）整块隐藏；
// 表单桌面 sticky 侧栏 + 移动端内容底部双位置（参照专家页模式）。

import { useState } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { BadgeCheck, ArrowRight, ChevronRight } from 'lucide-react';
import SmartImage from '@/components/ui/SmartImage';
import SourcingRequestForm from '@/components/sourcing/SourcingRequestForm';
import MaterialProductCard from './MaterialProductCard';
import { ORIGIN_LABEL, ORIGIN_BADGE_CLASS } from '@/lib/supplierConstants';
import { APPLICATION_SCENES, type PublicMaterialProduct, type SupplierCatalog } from '@/lib/materialsApi';

// pdf.js 阅读器懒加载：只在客户端、独立 chunk，不进初始包（不看图册的用户零成本）
// loading 占位预留 16:9 空间 → 避免标题短暂悬在塌陷的空白上 + 布局抖动(CLS)
const CatalogReader = dynamic(() => import('./CatalogReader'), {
  ssr: false,
  loading: () => (
    <div className="flex w-full aspect-video items-center justify-center rounded-2xl bg-[#1c1917]">
      <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/25 border-t-[#e6c88f]" />
    </div>
  ),
});

interface ProductDetailClientProps {
  product: PublicMaterialProduct;
  related: PublicMaterialProduct[];
  catalogs?: SupplierCatalog[];
}

function sceneLabel(slug: string): string {
  return APPLICATION_SCENES.find((s) => s.slug === slug)?.label ?? slug;
}

/** 供应商卡：logo + 名称 + origin 徽标 + 链接到供应商主页 */
function SupplierCard({ product }: { product: PublicMaterialProduct }) {
  if (!product.supplier_name) return null;
  const initial = product.supplier_name[0]?.toUpperCase() || 'S';
  const inner = (
    <div className="flex items-center gap-3 p-4 rounded-2xl border border-stone-200 bg-white hover:border-[#b8864a]/40 hover:shadow-sm transition group">
      {product.supplier_logo ? (
        <SmartImage
          src={product.supplier_logo}
          alt={product.supplier_name}
          className="w-12 h-12 rounded-xl object-contain border border-stone-100 bg-white p-1 shrink-0"
        />
      ) : (
        <div className="w-12 h-12 rounded-xl bg-[#f5f0e8] flex items-center justify-center text-lg font-bold text-[#b8864a] shrink-0">
          {initial}
        </div>
      )}
      <div className="flex-1 min-w-0">
        <p className="text-[10px] font-medium text-stone-400 uppercase tracking-wider">Supplier</p>
        <div className="flex items-center gap-2 min-w-0">
          <p className="text-sm font-semibold text-[#1c1917] truncate group-hover:text-[#b8864a] transition-colors">
            {product.supplier_name}
          </p>
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${ORIGIN_BADGE_CLASS[product.supplier_origin]}`}>
            {ORIGIN_LABEL[product.supplier_origin]}
          </span>
        </div>
      </div>
      {product.supplier_slug && (
        <ChevronRight className="w-4 h-4 text-stone-300 group-hover:text-[#b8864a] transition-colors shrink-0" />
      )}
    </div>
  );
  return product.supplier_slug ? (
    <Link href={`/materials/suppliers/${product.supplier_slug}`} className="block">
      {inner}
    </Link>
  ) : (
    inner
  );
}

/** 品名 + category/scene 标签（桌面侧栏与移动头部两处复用） */
function ProductHeading({ product, asH1 }: { product: PublicMaterialProduct; asH1?: boolean }) {
  const name = product.title || 'New Material';
  const Tag = asH1 ? 'h1' : 'p';
  return (
    <div>
      {product.category && (
        <p className="text-[11px] font-semibold text-[#b8864a] uppercase tracking-wider">
          {product.category}
        </p>
      )}
      <Tag className="font-serif text-[24px] sm:text-[28px] text-[#1c1917] font-medium leading-tight mt-1">
        {name}
      </Tag>
      {product.application_scenes.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-3">
          {product.application_scenes.map((slug) => (
            <span
              key={slug}
              className="px-2.5 py-0.5 text-[11px] text-stone-500 border border-stone-200 rounded-2xl"
            >
              {sceneLabel(slug)}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}


export default function ProductDetailClient({ product, related, catalogs = [] }: ProductDetailClientProps) {
  const name = product.title || 'New Material';
  const images = product.image_urls.length ? product.image_urls : product.image_url ? [product.image_url] : [];
  const [mainIdx, setMainIdx] = useState(0);
  const [lightboxIdx, setLightboxIdx] = useState<number | null>(null);

  const sampleForm = (
    <SourcingRequestForm
      variant="sample"
      productId={product.id}
      productTitle={name}
      supplierId={product.supplier_id}
    />
  );

  return (
    <div className="min-h-screen bg-[#faf9f7]">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-4 pb-12 sm:pb-16">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-1.5 text-xs text-stone-400 mb-6">
          <Link href="/" className="hover:text-[#b8864a] transition-colors">Home</Link>
          <span>/</span>
          <Link href="/materials" className="hover:text-[#b8864a] transition-colors">Materials</Link>
          <span>/</span>
          <Link href="/materials/new-materials" className="hover:text-[#b8864a] transition-colors">New Materials</Link>
          <span>/</span>
          <span className="text-stone-600 font-medium truncate max-w-[240px]">{name}</span>
        </nav>

        {/* 移动端头部（桌面上品名在右侧 sticky 栏） */}
        <div className="lg:hidden mb-5">
          <ProductHeading product={product} asH1 />
        </div>

        <div className="grid lg:grid-cols-[minmax(0,1fr)_380px] gap-8 lg:gap-12 items-start">
          {/* ===== 左：图集 + 内容 ===== */}
          <div className="min-w-0 space-y-10">
            {/* Gallery */}
            {images.length > 0 && (
              <div>
                {/* 主图 + 保障蒙层：黑块不再单占一段，改叠在图底部（渐变托底），省空间、按设计稿 */}
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setLightboxIdx(mainIdx)}
                    className="block w-full aspect-video rounded-2xl overflow-hidden bg-stone-100 border border-stone-200 cursor-zoom-in"
                    aria-label={`View ${name} full size`}
                  >
                    <SmartImage
                      src={images[mainIdx]}
                      variant="medium"
                      alt={name}
                      className="w-full h-full object-cover"
                    />
                  </button>
                  {/* 保障蒙层（容器 pointer-events-none 让点击穿透去开大图；链接区单独 auto 可点） */}
                  <div className="pointer-events-none absolute inset-x-0 bottom-0 rounded-b-2xl bg-gradient-to-t from-black/85 via-black/45 to-transparent px-4 pt-12 pb-4 sm:px-6">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                      <div className="min-w-0">
                        <p className="font-serif text-base sm:text-lg font-medium text-white">From China, Guaranteed Locally</p>
                        <p className="mt-0.5 hidden sm:block text-[12.5px] leading-relaxed text-white/70 max-w-xl">
                          Inspected before shipping and backed by our UAE team — delivery, installation & after-sales, all handled here.
                        </p>
                      </div>
                      <div className="pointer-events-auto flex shrink-0 gap-3">
                        <Link href="/guarantee" className="inline-flex items-center gap-1 text-[13px] font-medium text-[#e6c88f] hover:text-white transition-colors">
                          Our Guarantee <ArrowRight className="w-3.5 h-3.5" />
                        </Link>
                        <Link href="/services/china-sourcing" className="inline-flex items-center gap-1 text-[13px] font-medium text-[#e6c88f] hover:text-white transition-colors">
                          How Sourcing Works <ArrowRight className="w-3.5 h-3.5" />
                        </Link>
                      </div>
                    </div>
                  </div>
                </div>
                {images.length > 1 && (
                  <div className="grid grid-cols-5 sm:grid-cols-6 gap-2 mt-2">
                    {images.map((img, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => setMainIdx(i)}
                        aria-label={`Photo ${i + 1} of ${name}`}
                        className={`aspect-video rounded-lg overflow-hidden bg-stone-100 border transition ${
                          i === mainIdx ? 'border-[#b8864a] ring-1 ring-[#b8864a]' : 'border-stone-200 hover:border-[#b8864a]/50'
                        }`}
                      >
                        <SmartImage
                          src={img}
                          variant="thumb"
                          alt=""
                          loading="lazy"
                          className="w-full h-full object-cover"
                        />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* 产品图册（供应商 PDF → 电子书）— 无 catalog 时 CatalogReader 返回 null 自动隐藏 */}
            {catalogs.length > 0 && (
              <div>
                <h2 className="text-lg font-semibold text-[#1c1917] mb-4">Product Catalog</h2>
                <CatalogReader catalogs={catalogs} />
              </div>
            )}

            {/* Specifications — 空则整块隐藏 */}
            {product.specs.length > 0 && (
              <div>
                <h2 className="text-lg font-semibold text-[#1c1917] mb-4">Specifications</h2>
                <div className="rounded-2xl border border-stone-200 bg-white overflow-hidden">
                  {product.specs.map((spec, i) => (
                    <div
                      key={`${spec.label}-${i}`}
                      className={`grid grid-cols-[minmax(120px,35%)_1fr] text-sm ${i > 0 ? 'border-t border-stone-100' : ''}`}
                    >
                      <div className="px-4 py-3 bg-stone-50/70 text-stone-500 font-medium">{spec.label}</div>
                      <div className="px-4 py-3 text-[#1c1917]">{spec.value}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Certifications — 空则整块隐藏 */}
            {product.certifications.length > 0 && (
              <div>
                <h2 className="text-lg font-semibold text-[#1c1917] mb-4">Certifications</h2>
                <div className="flex flex-wrap gap-2">
                  {product.certifications.map((cert) => (
                    <span
                      key={cert}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white border border-stone-200 text-sm text-[#1c1917]"
                    >
                      <BadgeCheck className="w-4 h-4 text-[#b8864a]" />
                      {cert}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Description — 空则整块隐藏 */}
            {product.description && (
              <div>
                <h2 className="text-lg font-semibold text-[#1c1917] mb-3">About This Material</h2>
                <p className="text-[15px] text-[#2c2c2c] leading-relaxed whitespace-pre-line">
                  {product.description}
                </p>
              </div>
            )}

            {/* From China Guaranteed Locally 已改为主图底部蒙层（见 Gallery），不再单占一段 */}

            {/* 移动端表单（sticky 侧栏桌面 only，内容底部补充显示） */}
            <div className="lg:hidden space-y-4">
              <SupplierCard product={product} />
              {sampleForm}
            </div>
          </div>

          {/* ===== 右：sticky 侧栏（桌面 only）===== */}
          <aside className="hidden lg:block">
            <div className="sticky top-24 space-y-5">
              {/* h1 只在移动头部出现一次（全 DOM 唯一），侧栏用 p 避免双 h1 */}
              <ProductHeading product={product} />
              <SupplierCard product={product} />
              {sampleForm}
            </div>
          </aside>
        </div>

        {/* Related Materials — 空则整块隐藏 */}
        {related.length > 0 && (
          <div className="mt-14 pt-10 border-t border-stone-200/60">
            <h2 className="font-serif text-[22px] sm:text-[26px] text-[#1c1917] font-medium mb-6">
              Related Materials
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-8">
              {related.slice(0, 8).map((p) => (
                <MaterialProductCard key={p.id} product={p} />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ===== Lightbox（参照 SupplierDetailClient 模式）===== */}
      {lightboxIdx !== null && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex flex-col items-center justify-center p-4"
          onClick={() => setLightboxIdx(null)}
        >
          <button
            className="absolute top-4 right-4 text-white/70 hover:text-white text-3xl z-10"
            onClick={() => setLightboxIdx(null)}
            aria-label="Close"
          >
            ×
          </button>
          <div
            className="flex flex-col items-center gap-3 max-w-full"
            onClick={(e: React.MouseEvent) => e.stopPropagation()}
          >
            <SmartImage
              src={images[lightboxIdx]}
              alt={name}
              className="max-w-full max-h-[75vh] object-contain rounded-lg"
            />
          </div>
          {lightboxIdx > 0 && (
            <button
              className="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white text-xl transition"
              onClick={(e) => { e.stopPropagation(); setLightboxIdx((i) => (i !== null ? i - 1 : i)); }}
              aria-label="Previous photo"
            >
              ‹
            </button>
          )}
          {lightboxIdx < images.length - 1 && (
            <button
              className="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white text-xl transition"
              onClick={(e) => { e.stopPropagation(); setLightboxIdx((i) => (i !== null ? i + 1 : i)); }}
              aria-label="Next photo"
            >
              ›
            </button>
          )}
        </div>
      )}
    </div>
  );
}
