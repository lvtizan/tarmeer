'use client';

import { useState, useEffect, useRef } from 'react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ArrowUp, ArrowLeft, X,
  Package, Layers, MapPin,
  Maximize2, Banknote,
} from 'lucide-react';
import SmartImage from '@/components/ui/SmartImage';
import ServiceInquiryCard from '@/components/services/ServiceInquiryCard';
import { sanitizeDescription } from '@/lib/materialsApi';
import { ORIGIN_LABEL, ORIGIN_HERO_BADGE_CLASS, supplierPublicTitle } from '@/lib/supplierConstants';
import { useProductCategoryLabels } from '@/lib/useProductCategoryLabels';
import ProductPriceLine from './ProductPriceLine';
import { countryFromLang } from '@/lib/country';
import { useSiteLocale } from '@/contexts/SiteLocaleContext';

// PDF 图册电子书阅读器（pdf.js/预渲染 WebP），懒加载单独 chunk
const CatalogReader = dynamic(() => import('./CatalogReader'), {
  ssr: false,
  loading: () => (
    <div className="flex w-full aspect-video flex-col items-center justify-center gap-3 rounded-2xl bg-[#1c1917] px-10">
      <span className="text-sm text-white/70">Loading…</span>
      <div className="h-1.5 w-52 max-w-[75%] overflow-hidden rounded-full bg-white/15">
        <div className="h-full w-1/3 animate-pulse rounded-full bg-[#e6c88f]" />
      </div>
    </div>
  ),
});

const API_BASE = process.env.NEXT_PUBLIC_API_URL?.trim() || '/api';

export interface SupplierProfile {
  id: number;
  company_name: string;
  slug: string;
  description: string;
  logo_url: string | null;
  origin: 'china' | 'dubai';
  categories: string[] | string | null;
  has_physical_store: number;
  store_address: string | null;
  google_maps_url: string | null;
  website: string | null;
}

export interface Product {
  id: number;
  title: string | null;
  description: string | null;
  image_url: string;
  category: string | null;
  sort_order: number;
  title_translated: string | null;
  description_translated: string | null;
  price: number | null;
  price_max: number | null;
  price_unit: string | null;
  price_currency: 'AED' | 'CNY' | 'USD' | 'VND' | null;
  price_from: boolean;
}

interface Project {
  id: number;
  title: string;
  description: string | null;
  location: string | null;
  year: string | null;
  area_sqm: number | null;
  budget: string | null;
  images: string[] | string | null;
  materials?: Product[];
}

interface Catalog {
  id: number;
  title: string;
  file_url: string;
  file_size: number | null;
  created_at: string;
}

interface SupplierDetailClientProps {
  slug: string;
  // SSR seed：服务端把 supplier+products 传进来 → 首屏 SSR 直接渲染真实内容(非转圈)，消除软 404
  initialSupplier?: SupplierProfile | null;
  initialProducts?: Product[];
}

export default function SupplierDetailClient({ slug, initialSupplier = null, initialProducts = [] }: SupplierDetailClientProps) {
  const router = useRouter();
  const country = countryFromLang(useSiteLocale().lang);
  const requestIdentity = `${country.code}:${slug}`;
  const [supplier, setSupplier] = useState<SupplierProfile | null>(initialSupplier);
  const [products, setProducts] = useState<Product[]>(initialProducts);
  const [projects, setProjects] = useState<Project[]>([]);
  const [catalogs, setCatalogs] = useState<Catalog[]>([]);
  const [loading, setLoading] = useState(!initialSupplier);
  const [lightbox, setLightbox] = useState<{
    images: string[];
    labels?: (string | null)[];
    idx: number;
  } | null>(null);
  const openLightbox = (images: string[], idx: number, labels?: (string | null)[]) =>
    setLightbox({ images, labels, idx });
  const closeLightbox = () => setLightbox(null);
  const [productCatFilter, setProductCatFilter] = useState<string | null>(null);
  const [logoError, setLogoError] = useState(false);

  const [showFloatingForm, setShowFloatingForm] = useState(false);
  const [floatingFormDismissed, setFloatingFormDismissed] = useState(false);
  const mobileFormRef = useRef<HTMLDivElement>(null);
  const productsRef = useRef<HTMLDivElement>(null);
  const projectsRef = useRef<HTMLDivElement>(null);
  const [activeSection, setActiveSection] = useState<'products' | 'projects'>('products');
  const hydratedIdentityRef = useRef(requestIdentity);
  const [loadedIdentity, setLoadedIdentity] = useState(requestIdentity);
  // 产品分类 value→label 映射(单一数据源 product_categories),否则买家页直接显示原始 value 如 NEW_MATERIALS。
  const catLabel = useProductCategoryLabels();

  const scrollTo = (ref: React.RefObject<HTMLDivElement | null>) => {
    ref.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  useEffect(() => {
    if (!slug) return;
    let active = true;
    const identityChanged = hydratedIdentityRef.current !== requestIdentity;
    hydratedIdentityRef.current = requestIdentity;
    if (identityChanged) {
      setSupplier(null);
      setProducts([]);
      setProjects([]);
      setCatalogs([]);
      setLightbox(null);
      setProductCatFilter(null);
      setLogoError(false);
      setShowFloatingForm(false);
      setFloatingFormDismissed(false);
      setActiveSection('products');
      setLoading(true);
    }
    Promise.all([
      fetch(`${API_BASE}/suppliers/detail/${slug}?country=${country.code}`, {
        headers: { 'x-country': country.code },
      }).then(r => { if (!r.ok) throw new Error(); return r.json(); }),
      fetch(`${API_BASE}/suppliers/detail/${slug}/projects?country=${country.code}`, {
        headers: { 'x-country': country.code },
      }).then(r => r.ok ? r.json() : { projects: [] }),
    ])
      .then(([detail, projData]) => {
        if (!active) return;
        setSupplier(detail.supplier);
        setProducts(detail.products || []);
        setCatalogs(detail.catalogs || []);
        setProjects((projData.projects || []).map((p: { images?: string | string[] | null; [key: string]: unknown }) => ({
          ...p,
          images: typeof p.images === 'string' ? JSON.parse(p.images) : (p.images || []),
        })));
      })
      .catch(() => {
        if (!active) return;
        if (!initialSupplier || identityChanged) setSupplier(null);
      }) // 首次同 identity hydration 瞬时失败保留 SSR；路由/跨国失败绝不保留旧实体
      .finally(() => {
        if (!active) return;
        setLoadedIdentity(requestIdentity);
        setLoading(false);
      });
    return () => { active = false; };
  }, [slug, country.code]);

  useEffect(() => {
    const handleScroll = () => {
      if (!floatingFormDismissed) setShowFloatingForm(window.scrollY > 400);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [floatingFormDismissed]);

  useEffect(() => {
    if (!supplier) return;
    const sections = [
      { ref: productsRef, key: 'products' as const },
      { ref: projectsRef, key: 'projects' as const },
    ];
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            const found = sections.find(s => s.ref.current === entry.target);
            if (found) setActiveSection(found.key);
          }
        }
      },
      { rootMargin: '-20% 0px -60% 0px', threshold: 0 }
    );
    sections.forEach(s => { if (s.ref.current) observer.observe(s.ref.current); });
    return () => observer.disconnect();
  }, [supplier]);

  const handleBack = () => router.push('/materials?tab=suppliers');

  const parseCategories = (cats: string[] | string | null): string[] => {
    if (!cats) return [];
    if (Array.isArray(cats)) return cats;
    try { return JSON.parse(cats); } catch { return []; }
  };

  const contentStale = loadedIdentity !== requestIdentity;
  if (loading || contentStale) return (
    <div className="min-h-screen flex items-center justify-center bg-[#faf9f7]">
      <div className="w-8 h-8 border-2 border-[#b8864a]/30 border-t-[#b8864a] rounded-full animate-spin" />
    </div>
  );

  if (!supplier) return (
    <div className="min-h-screen flex items-center justify-center bg-[#faf9f7]">
      <div className="text-center">
        <h1 className="text-xl font-bold text-[#2c2c2c] mb-4">Supplier not found</h1>
        <button onClick={handleBack} className="text-[#b8864a] hover:underline text-[15px]">Back to Suppliers</button>
      </div>
    </div>
  );

  const categoryList = parseCategories(supplier.categories);
  const heroImage = products.length > 0 ? products[0].image_url : null;
  // 公开去标识：可见标题用品类通用名(与 SEO 一致),不显示遮蔽后的星号厂家名
  const publicTitle = supplierPublicTitle(supplier.categories);
  const prettyCat = (c: string) => c.replace(/[_-]+/g, ' ').replace(/\b\w/g, (m) => m.toUpperCase());
  const initial = publicTitle?.[0]?.toUpperCase() || 'S';

  const statItems: { label: string; count: number }[] = [];
  if (products.length > 0) statItems.push({ label: 'Products', count: products.length });
  if (projects.length > 0) statItems.push({ label: 'Projects', count: projects.length });
  if (catalogs.length > 0) statItems.push({ label: 'Catalogs', count: catalogs.length });

  const productCategories = [...new Set(products.map(p => p.category).filter(Boolean))] as string[];

  // 没上传内容的模块整块隐藏，对应 tab 也不显示（下方 map 里按 count 跳过，避免点了滚动到空白）
  // 画册不在 tab 里（已移到 hero 区展示）；tab 仅产品/项目
  const tabItems = [
    { key: 'products' as const, label: 'Products', icon: Package, count: products.length, ref: productsRef },
    { key: 'projects' as const, label: 'Projects', icon: Layers, count: projects.length, ref: projectsRef },
  ];

  return (
    <div className="min-h-screen bg-[#faf9f7] overflow-x-clip">
      {/* ========== Hero ========== */}
      <div className="relative overflow-hidden">
        {heroImage ? (
          <div className="absolute inset-0">
            <SmartImage src={heroImage} variant="medium" alt="" className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-r from-[#1c1917]/90 via-[#1c1917]/75 to-[#1c1917]/60" />
          </div>
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-[#1c1917] via-[#2c2520] to-[#3d3028]" />
        )}

        <div className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 pt-6 pb-10 sm:pt-8 sm:pb-14">
          <button
            onClick={handleBack}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-white/75 hover:text-white transition-colors mb-4"
          >
            <ArrowLeft className="w-4 h-4" /> Back to Suppliers
          </button>
          <nav className="flex items-center gap-1.5 text-xs text-white/50 mb-8">
            <Link href="/" className="hover:text-white transition-colors">Home</Link>
            <span>/</span>
            <Link href="/materials?tab=suppliers" className="hover:text-white transition-colors">Materials</Link>
            <span>/</span>
            <span className="text-white/80 truncate max-w-[200px]">{publicTitle}</span>
          </nav>

          <div className={catalogs.length > 0 ? 'grid items-start gap-8 lg:grid-cols-[55fr_45fr] lg:gap-12' : ''}>
            {/* 左：品牌信息 + 数据 */}
            <div className="min-w-0">
              <div className="flex items-start gap-5 sm:gap-6">
                {/* Logo */}
                {supplier.logo_url && !logoError ? (
                  <SmartImage
                    src={supplier.logo_url}
                    alt={publicTitle}
                    className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl object-contain border border-white/10 bg-white/10 backdrop-blur-sm p-2 shrink-0"
                    onError={() => setLogoError(true)}
                  />
                ) : (
                  <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-white/10 backdrop-blur-sm border border-white/10 flex items-center justify-center text-2xl sm:text-3xl font-bold text-white/80 shrink-0">
                    {initial}
                  </div>
                )}

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 flex-wrap">
                    <h1 className="text-xl sm:text-2xl font-bold text-white">{publicTitle}</h1>
                    <span className={`text-[11px] font-semibold px-3 py-1 rounded-full backdrop-blur-sm ${ORIGIN_HERO_BADGE_CLASS[supplier.origin]}`}>
                      {ORIGIN_LABEL[supplier.origin]}
                    </span>
                  </div>

                  {categoryList.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-3">
                      {categoryList.map(c => (
                        <span key={c} className="text-[11px] px-2.5 py-0.5 rounded-full bg-white/10 text-white/70 border border-white/5">
                          {prettyCat(c)}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* 公开去标识：不渲染带星号的自填简介,改用品类导语 */}
                  <p className="mt-3 text-sm text-white/60 leading-relaxed line-clamp-2 max-w-xl">
                    Verified {publicTitle.toLowerCase()} on Tarmeer — browse products, projects and catalogs below.
                  </p>
                </div>
              </div>

              {statItems.length > 0 && (
                <div className="flex items-center gap-6 mt-8 pt-6 border-t border-white/10">
                  {statItems.map((s, i) => (
                    <div key={i} className="text-center">
                      <p className="text-xl sm:text-2xl font-bold text-white">{s.count}</p>
                      <p className="text-xs text-white/50 mt-0.5">{s.label}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 右：PDF 电子书（供应商有 catalog 才显示；桌面右侧、移动端在文案下方），复用 flooring hero 同款控件 */}
            {catalogs.length > 0 && (
              <div className="w-full">
                <CatalogReader
                  catalogs={catalogs}
                  download={{
                    // 公开去标识：线索 payload 也用品类通用名（遮蔽可见渲染≠遮蔽序列化 payload，见 FA-14）；归因靠 companyId/slug
                    companyName: publicTitle,
                    companyId: supplier.id,
                    companySlug: supplier.slug,
                  }}
                />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* About 区已移除：公开去标识后简介为遮蔽星号、地址隐藏；Hero 已用品类导语承载 */}

      {/* ========== Sticky Tab Strip ========== */}
      <div className="sticky top-14 sm:top-16 z-40 bg-[#faf9f7]/95 backdrop-blur-sm">
        <div className="overflow-x-auto scrollbar-none">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 flex items-center gap-1">
            {tabItems.map(({ key, label, icon: Icon, count, ref }) => count === 0 ? null : (
              <button
                key={key}
                onClick={() => scrollTo(ref)}
                className={`flex items-center gap-2 px-4 py-3.5 text-sm font-medium whitespace-nowrap border-b-2 transition-all ${
                  activeSection === key
                    ? 'border-[#b8864a] text-[#b8864a]'
                    : 'border-transparent text-stone-500 hover:text-stone-700'
                }`}
              >
                <Icon className="w-4 h-4" />
                {label}
                {count > 0 && (
                  <span className={`text-[11px] px-2 py-0.5 rounded-full ${
                    activeSection === key ? 'bg-[#b8864a]/10 text-[#b8864a]' : 'bg-stone-100 text-stone-400'
                  }`}>{count}</span>
                )}
              </button>
            ))}

            <button
              onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
              className="ml-auto p-2 rounded-full text-stone-400 hover:text-[#b8864a] hover:bg-stone-100 transition shrink-0"
              aria-label="Back to top"
            >
              <ArrowUp className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* ========== Main Content ========== */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-10">
        <div className="min-[1700px]:flex">
          <div className="min-w-0 min-[1700px]:flex-1 space-y-10">
            {/* Products section — 无产品则整块隐藏，不显示空状态 */}
            {products.length > 0 && (
            <div ref={productsRef} id="section-products" className="scroll-mt-28">
              <h2 className="text-lg font-semibold text-[#2c2c2c] mb-4 flex items-center gap-2">
                <Package className="w-5 h-5" style={{ color: 'var(--color-tarmeer-primary)' }} />
                Products
                <span className="text-sm font-normal text-stone-400">({products.length})</span>
              </h2>
                <>
                  {productCategories.length > 1 && (
                    <div className="flex flex-wrap gap-2 mb-4">
                      <button onClick={() => setProductCatFilter(null)}
                        className={`px-3 py-1.5 rounded-2xl text-xs font-medium transition ${!productCatFilter ? 'bg-[#b8864a] text-white' : 'bg-stone-100 text-stone-600 hover:bg-stone-200'}`}>All</button>
                      {productCategories.map(cat => (
                        <button key={cat} onClick={() => setProductCatFilter(cat)}
                          className={`px-3 py-1.5 rounded-2xl text-xs font-medium transition ${productCatFilter === cat ? 'bg-[#b8864a] text-white' : 'bg-stone-100 text-stone-600 hover:bg-stone-200'}`}>{catLabel(cat)}</button>
                      ))}
                    </div>
                  )}
                  {/* 瀑布流(masonry)：图按自然比例(w-full h-auto)自适应，高图高/宽图宽，无留白无裁切 */}
                  <div className="columns-2 sm:columns-3 gap-4 [column-fill:_balance]">
                    {products.filter(p => !productCatFilter || p.category === productCatFilter).map((p) => (
                      <div key={p.id} className="group mb-4 break-inside-avoid cursor-pointer" onClick={() => openLightbox(products.map(x => x.image_url), products.indexOf(p), products.map(x => x.title))}>
                        <div className="rounded-2xl overflow-hidden bg-white border border-stone-200">
                          <SmartImage
                            src={p.image_url}
                            variant="thumb"
                            alt={p.title || ''}
                            className="w-full h-auto group-hover:scale-105 transition duration-300"
                            loading="lazy"
                          />
                        </div>
                        {p.category && <p className="text-[10px] font-medium text-[#b8864a] uppercase tracking-wider mt-2">{catLabel(p.category)}</p>}
                        {(p.title_translated || p.title) && (
                          // 标题作可爬内链 → 产品详情页(供应商页已 SSR,链接进 HTML；图片点击仍开 lightbox，stopPropagation 隔开)
                          <Link
                            href={`/materials/products/${p.id}`}
                            onClick={(e) => e.stopPropagation()}
                            className="block text-[15px] font-medium text-[#2c2c2c] mt-0.5 truncate hover:text-[#b8864a] transition-colors"
                          >
                            {p.title_translated || p.title}
                          </Link>
                        )}
                        <ProductPriceLine product={p} />
                        {(() => {
                          // 与产品详情页同源清洗：合作方同步残留的出厂价/MOQ 不外显（spec §6）
                          const desc = sanitizeDescription(p.description_translated || p.description);
                          return desc ? <p className="text-xs text-[#6b6b6b] mt-0.5 line-clamp-2">{desc}</p> : null;
                        })()}
                      </div>
                    ))}
                  </div>
                </>
            </div>
            )}

            {/* Projects section — 无项目则整块隐藏，不显示空状态 */}
            {projects.length > 0 && (
            <div ref={projectsRef} id="section-projects" className="scroll-mt-28">
              <h2 className="text-lg font-semibold text-[#2c2c2c] mb-4 flex items-center gap-2">
                <Layers className="w-5 h-5" style={{ color: 'var(--color-tarmeer-primary)' }} />
                Projects
                <span className="text-sm font-normal text-stone-400">({projects.length})</span>
              </h2>
                <div className="space-y-6">
                  {projects.map(proj => {
                    const imgs = Array.isArray(proj.images) ? proj.images : [];
                    const materials = Array.isArray(proj.materials) ? proj.materials : [];
                    return (
                      <div key={proj.id} className="bg-white rounded-2xl border border-stone-200 overflow-hidden">
                        {imgs.length > 0 && (
                          <div className="grid grid-cols-2 sm:grid-cols-3 gap-1">
                            {imgs.map((img, i) => (
                              <div key={i} className="cursor-pointer group relative" onClick={() => router.push(`/materials/suppliers/${slug}/projects/${proj.id}?photo=${i}`)}>
                                <SmartImage src={img} alt={`${proj.title} ${i + 1}`} className="w-full aspect-[4/3] object-cover group-hover:brightness-90 transition duration-200" loading="lazy" />
                                {i === imgs.length - 1 && imgs.length > 6 && (
                                  <div className="absolute inset-0 bg-black/50 flex items-center justify-center text-white text-sm font-semibold">
                                    +{imgs.length - 6} more
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                        <div className="p-5">
                          <h3 className="text-[15px] font-semibold text-[#2c2c2c]">{proj.title}</h3>
                          {proj.description && <p className="text-sm text-stone-500 mt-1 leading-relaxed">{proj.description}</p>}
                          <div className="flex flex-wrap gap-3 mt-2">
                            {proj.location && (
                              <span className="inline-flex items-center gap-1 text-xs text-stone-500">
                                <MapPin className="w-3.5 h-3.5 text-[#b8864a] shrink-0" />{proj.location}
                              </span>
                            )}
                            {proj.area_sqm && (
                              <span className="inline-flex items-center gap-1 text-xs text-stone-500">
                                <Maximize2 className="w-3.5 h-3.5 text-[#b8864a] shrink-0" />{proj.area_sqm} m²
                              </span>
                            )}
                            {proj.budget && (
                              <span className="inline-flex items-center gap-1 text-xs text-stone-500">
                                <Banknote className="w-3.5 h-3.5 text-[#b8864a] shrink-0" />{proj.budget}
                              </span>
                            )}
                            {proj.year && (
                              <span className="text-xs text-stone-400">{proj.year}</span>
                            )}
                          </div>
                          {materials.length > 0 && (
                            <div className="mt-5 pt-4 border-t border-stone-100">
                              <p className="text-[11px] font-semibold uppercase tracking-wider text-stone-500 mb-3">Materials Used In This Project</p>
                              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                {materials.slice(0, 6).map((m) => (
                                  <div key={m.id} className="rounded-2xl border border-stone-200 overflow-hidden bg-stone-50/40">
                                    <div className="aspect-[4/3] bg-stone-100">
                                      <SmartImage src={m.image_url} alt={m.title || ''} className="w-full h-full object-cover" loading="lazy" />
                                    </div>
                                    <div className="p-2.5">
                                      {m.category && <p className="text-[10px] font-medium text-[#b8864a] uppercase tracking-wider">{catLabel(m.category)}</p>}
                                      <p className="text-xs font-medium text-[#2c2c2c] line-clamp-1 mt-0.5">{m.title || 'Material'}</p>
                                      {m.description && <p className="text-[11px] text-stone-500 line-clamp-2 mt-1">{m.description}</p>}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
            </div>
            )}

            {/* 画册已移到 hero 区右侧展示（复用 flooring hero 同款电子书控件），此处不再重复渲染 */}

            {/* Inline inquiry form — shown on screens < 1700px */}
            <div ref={mobileFormRef} className="min-[1700px]:hidden">
              <ServiceInquiryCard
                title="Contact this Supplier"
                leadTag="Material Inquiry"
                companyName={publicTitle}
                companySlug={supplier.slug}
                companyId={supplier.id}
              />
            </div>
          </div>

          {/* Sticky sidebar — 1700px+ */}
          <div className="hidden min-[1700px]:block w-72 shrink-0 ml-8" style={{ marginRight: '-320px' }}>
            <div className="sticky top-[112px]">
              <ServiceInquiryCard
                title="Contact this Supplier"
                leadTag="Material Inquiry"
                companyName={publicTitle}
                companySlug={supplier.slug}
                companyId={supplier.id}
              />
            </div>
          </div>
        </div>
      </div>

      {/* ========== Floating CTA ========== */}
      <AnimatePresence>
        {showFloatingForm && !floatingFormDismissed && (
          <motion.div
            initial={{ y: 80, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 80, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            className="min-[1700px]:hidden fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-stone-200 px-4 py-3 flex items-center gap-3 shadow-lg"
          >
            <button
              className="btn-primary flex-1 py-3 text-[15px]"
              onClick={() => mobileFormRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
            >
              Send Inquiry
            </button>
            <button
              onClick={() => setFloatingFormDismissed(true)}
              className="w-11 h-11 rounded-full border border-stone-200 flex items-center justify-center text-stone-400 hover:text-stone-600 transition shrink-0"
              aria-label="Dismiss"
            >
              <X className="w-4 h-4" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ========== Lightbox ========== */}
      {lightbox !== null && (
        <div className="fixed inset-0 z-50 bg-black/90 flex flex-col items-center justify-center p-4" onClick={closeLightbox}>
          <button className="absolute top-4 right-4 text-white/70 hover:text-white text-3xl z-10" onClick={closeLightbox}>
            ×
          </button>
          <div className="flex flex-col items-center gap-3 max-w-full" onClick={(e: React.MouseEvent) => e.stopPropagation()}>
            <SmartImage
              src={lightbox.images[lightbox.idx]}
              alt={lightbox.labels?.[lightbox.idx] || ''}
              className="max-w-full max-h-[75vh] object-contain rounded-lg"
            />
            {lightbox.labels?.[lightbox.idx] && (
              <div className="bg-black/60 backdrop-blur-sm text-white px-5 py-2.5 rounded-xl text-sm font-medium">
                {lightbox.labels[lightbox.idx]}
              </div>
            )}
          </div>
          {lightbox.idx > 0 && (
            <button
              className="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white text-xl transition"
              onClick={e => { e.stopPropagation(); setLightbox(lb => lb && ({ ...lb, idx: lb.idx - 1 })); }}
            >
              ‹
            </button>
          )}
          {lightbox.idx < lightbox.images.length - 1 && (
            <button
              className="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white text-xl transition"
              onClick={e => { e.stopPropagation(); setLightbox(lb => lb && ({ ...lb, idx: lb.idx + 1 })); }}
            >
              ›
            </button>
          )}
        </div>
      )}
    </div>
  );
}
