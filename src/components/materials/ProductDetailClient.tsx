'use client';

// 新材料产品详情页 client — spec §1.2
// 数据由 server page（fetchMaterialProduct）SSR 传入，无客户端二次拉取。
// 铁律：主图/相关卡 aspect-video；无内容模块（specs/certifications/related）整块隐藏；
// 表单桌面 sticky 侧栏 + 移动端内容底部双位置（参照专家页模式）。

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { BadgeCheck, ArrowLeft, ChevronRight, PlayCircle } from 'lucide-react';
import SmartImage from '@/components/ui/SmartImage';
import SourcingRequestForm from '@/components/sourcing/SourcingRequestForm';
import MaterialProductCard from './MaterialProductCard';
import { ORIGIN_LABEL, ORIGIN_BADGE_CLASS } from '@/lib/supplierConstants';
import { APPLICATION_SCENES, type PublicMaterialProduct, type SupplierCatalog } from '@/lib/materialsApi';
import { useProductCategoryLabels } from '@/lib/useProductCategoryLabels';
import { supplierFromProductsHref } from '@/lib/materialsNavigation';
import { materialProductTitle, safeMaterialsReturn } from '@/lib/materialsProcurement';
import Lightbox from '@/components/flooring/Lightbox';
import MaterialImage from './MaterialImage';
import { trackMaterialEvent } from '@/lib/materialsAnalytics';
import { countryFromLang } from '@/lib/country';
import { useSiteLocale } from '@/contexts/SiteLocaleContext';
import ProductPriceLine from './ProductPriceLine';
import { resolveImageUrl } from '@/lib/imageUrl';

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
  returnTo?: string;
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
        <p className="text-[10px] font-medium text-stone-600 uppercase tracking-wider">Sourcing reference</p>
        <div className="flex items-center gap-2 min-w-0">
          <p className="text-sm font-semibold text-[#1c1917] truncate group-hover:text-[#b8864a] transition-colors">
            Supplier #{product.supplier_id} · via Tarmeer
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
    <Link href={supplierFromProductsHref(product.supplier_slug)} className="block">
      {inner}
    </Link>
  ) : (
    inner
  );
}

/** 品名 + category/scene 标签（桌面侧栏与移动头部两处复用） */
function ProductHeading({ product }: { product: PublicMaterialProduct }) {
  const catLabel = useProductCategoryLabels();
  const name = materialProductTitle(product);
  return (
    <div>
      {product.category && (
        <p className="text-[11px] font-semibold text-[#b8864a] uppercase tracking-wider">
          {catLabel(product.category)}
        </p>
      )}
      <p className="font-serif text-[24px] sm:text-[28px] text-[#1c1917] font-medium leading-tight mt-1">
        {name}
      </p>
      {product.model && <p className="mt-2 text-sm text-stone-700">Model: {product.model}</p>}
      <ProductPriceLine product={product} />
      <div className="mt-3 space-y-1 border-t border-stone-200 pt-3 text-xs leading-relaxed text-stone-600">
        <p>Price basis: {product.price_basis || (product.price_from ? 'Starting specification to be confirmed' : 'Selected specification to be confirmed')}.</p>
        {product.price_unit?.toUpperCase() === 'SHEET' && <p>Sheet dimensions: {product.specs.find(s => /dimension|size/i.test(s.label))?.value || 'to be confirmed'}.</p>}
        <p>Tax, shipping and installation: inclusion to be confirmed in your quote.</p>
        <p>Availability: {product.availability === 'uae_stock' ? 'UAE stock — quantity to confirm' : product.availability === 'china_order' ? 'Order from China' : product.availability === 'made_to_order' ? 'Made to order' : 'to be confirmed'}. Delivery: {product.lead_time_days != null ? `${product.lead_time_days} days (supplier estimate; confirm for your order)` : 'to be confirmed'}.</p>
      </div>
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


export default function ProductDetailClient({ product, related, catalogs = [], returnTo }: ProductDetailClientProps) {
  const name = materialProductTitle(product);
  const country = countryFromLang(useSiteLocale().lang).code;
  useEffect(() => { trackMaterialEvent('materials_product_view', country, product.id); }, [country, product.id]);
  const images = product.image_urls.length ? product.image_urls : product.image_url ? [product.image_url] : [];
  const [mainIdx, setMainIdx] = useState(0);
  const [lightboxIdx, setLightboxIdx] = useState<number | null>(null);

  const sampleForm = (
    <SourcingRequestForm
      variant="quote"
      productId={product.id}
      productTitle={name}
      productModel={product.model || undefined}
      quantityUnit={product.price_unit || undefined}
      supplierId={product.supplier_id}
    />
  );

  return (
    <div className="min-h-screen bg-[#faf9f7]">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-4 pb-12 sm:pb-16">
        <h1 className="sr-only">{name}</h1>
        {/* 显式返回：回到新材料主页（比面包屑更好点） */}
        <Link
          href={safeMaterialsReturn(returnTo)}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-stone-500 hover:text-[#b8864a] transition-colors mb-4"
        >
          <ArrowLeft className="w-4 h-4" /> Back to products
        </Link>

        {/* Breadcrumb */}
        <nav className="flex items-center gap-1.5 text-xs text-stone-400 mb-6">
          <Link href="/" className="hover:text-[#b8864a] transition-colors">Home</Link>
          <span>/</span>
          <Link href="/materials" className="hover:text-[#b8864a] transition-colors">Materials</Link>
          <span>/</span>
          <span className="text-stone-600 font-medium truncate max-w-[240px]">{name}</span>
        </nav>

        {/* 移动端头部（桌面上品名在右侧 sticky 栏） */}
        <div className="lg:hidden mb-5">
          <ProductHeading product={product} />
        </div>

        <div className="grid lg:grid-cols-[minmax(0,1fr)_380px] gap-8 lg:gap-12 items-start">
          {/* ===== 左：图集 + 内容 ===== */}
          <div className="min-w-0 space-y-10">
            {/* Gallery */}
            {images.length === 0 && <div className="aspect-video overflow-hidden rounded-2xl border border-stone-200"><MaterialImage alt={name} /></div>}
            {images.length > 0 && (
              <div>
                {/* 主图 + 保障蒙层：黑块不再单占一段，改叠在图底部（渐变托底），省空间、按设计稿 */}
                <div className="relative">
                  <div className="relative aspect-video overflow-hidden rounded-2xl border border-stone-200 bg-white">
                    <MaterialImage key={images[mainIdx]} src={images[mainIdx]} alt={name} eager />
                    <button type="button" onClick={() => setLightboxIdx(mainIdx)} aria-label={`View ${name} full size`} className="absolute bottom-3 right-3 rounded-full border border-stone-300 bg-white px-3 py-2 text-xs font-medium text-stone-800">View full image</button>
                  </div>
                  <p className="mt-3 text-sm leading-relaxed text-stone-700">Tarmeer receives your inquiry and coordinates with this supplier. Specifications, delivery and service scope are confirmed in your quote.</p>
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
                          className="w-full h-full object-contain"
                        />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {product.video_url && (
              <section aria-labelledby="material-video-heading">
                <h2 id="material-video-heading" className="mb-4 flex items-center gap-2 text-lg font-semibold text-[#1c1917]">
                  <PlayCircle className="h-5 w-5 text-[#b8864a]" /> Material video
                </h2>
                <div className="aspect-video overflow-hidden rounded-2xl border border-stone-200 bg-black">
                  <video
                    controls
                    playsInline
                    preload="metadata"
                    poster={resolveImageUrl(images[0] || product.image_url)}
                    className="h-full w-full object-contain"
                  >
                    <source src={resolveImageUrl(product.video_url)} type="video/mp4" />
                    Your browser does not support video playback.
                  </video>
                </div>
              </section>
            )}

            {/* 产品图册（供应商 PDF → 电子书）— 无 catalog 时 CatalogReader 返回 null 自动隐藏 */}
            {catalogs.length > 0 && (
              <div>
                <h2 className="text-lg font-semibold text-[#1c1917] mb-4">Product Catalog</h2>
                <CatalogReader catalogs={catalogs} />
              </div>
            )}

            {/* Specifications — 空则整块隐藏 */}
            {product.specs.length === 0 && <p className="rounded-xl border border-stone-200 bg-white p-4 text-sm text-stone-700">Specifications have not yet been supplied. Include your requirements in the inquiry.</p>}
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
                <h2 className="text-lg font-semibold text-[#1c1917] mb-4">Supplier-provided certifications</h2>
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

      {lightboxIdx !== null && <Lightbox shots={images.map(src => ({ src: resolveImageUrl(src), alt: name, label: name }))} alt={name} index={lightboxIdx} setIndex={update => setLightboxIdx(previous => update(previous ?? 0))} onClose={() => setLightboxIdx(null)} />}
    </div>
  );
}
