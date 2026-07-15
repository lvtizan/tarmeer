'use client';

// 新材料产品详情页 client — spec §1.2
// 数据由 server page（fetchMaterialProduct）SSR 传入，无客户端二次拉取。
// 铁律：主图/相关卡 aspect-video；无内容模块（specs/certifications/related）整块隐藏；
// 表单桌面 sticky 侧栏 + 移动端内容底部双位置（参照专家页模式）。

import { useState } from 'react';
import Link from 'next/link';
import { BadgeCheck, ShieldCheck, ArrowRight, ChevronRight } from 'lucide-react';
import SmartImage from '@/components/ui/SmartImage';
import SourcingRequestForm from '@/components/sourcing/SourcingRequestForm';
import MaterialProductCard from './MaterialProductCard';
import { ORIGIN_LABEL, ORIGIN_BADGE_CLASS } from '@/lib/supplierConstants';
import { APPLICATION_SCENES, type PublicMaterialProduct } from '@/lib/materialsApi';

interface ProductDetailClientProps {
  product: PublicMaterialProduct;
  related: PublicMaterialProduct[];
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

/** 「From China, Guaranteed Locally」信任条（/guarantee 与 /services/china-sourcing 由并行 agent 开发） */
function TrustBar() {
  return (
    <div className="relative isolate rounded-2xl bg-[#1c1917] p-6 sm:p-8 overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_80%_at_10%_0%,rgba(184,134,74,0.18),transparent_60%)]" />
      <div className="relative flex flex-col sm:flex-row sm:items-center gap-5">
        <span className="inline-flex w-12 h-12 rounded-2xl bg-[#b8864a]/15 text-[#c6a065] items-center justify-center shrink-0">
          <ShieldCheck className="w-6 h-6" />
        </span>
        <div className="flex-1">
          <p className="text-white font-serif text-lg font-medium">From China, Guaranteed Locally</p>
          <p className="text-white/60 text-[13px] leading-relaxed mt-1">
            Every material we source is inspected before shipping and backed by our UAE team —
            delivery, installation support and after-sales, all handled here.
          </p>
        </div>
        <div className="flex flex-col sm:items-end gap-2 shrink-0">
          <Link
            href="/guarantee"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-[#c6a065] hover:text-white transition-colors"
          >
            Our Guarantee <ArrowRight className="w-3.5 h-3.5" />
          </Link>
          <Link
            href="/services/china-sourcing"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-[#c6a065] hover:text-white transition-colors"
          >
            How Sourcing Works <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function ProductDetailClient({ product, related }: ProductDetailClientProps) {
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

            <TrustBar />

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
