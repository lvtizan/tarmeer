'use client';

import { useState, useEffect, useRef } from 'react';
import dynamic from 'next/dynamic';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { motion, useReducedMotion } from 'framer-motion';
import {
  ArrowUp, ArrowLeft, X,
  ArrowRight,
  Package, Layers, MapPin,
  Maximize2, Banknote,
} from 'lucide-react';
import SmartImage from '@/components/ui/SmartImage';
import ServiceInquiryCard from '@/components/services/ServiceInquiryCard';
import { sanitizeDescription } from '@/lib/materialDescription';
import { ORIGIN_LABEL, ORIGIN_HERO_BADGE_CLASS, supplierPublicTitle } from '@/lib/supplierConstants';
import { useProductCategoryLabels } from '@/lib/useProductCategoryLabels';
import { countryFromLang } from '@/lib/country';
import { useSiteLocale } from '@/contexts/SiteLocaleContext';
import { createSupplierIdentityGuard, isSupplierContentStale } from '@/lib/supplierDetailIdentity';
import { buildSupplierProjectGallery } from '@/lib/supplierProjectGallery';
import { resolveImageUrl } from '@/lib/imageUrl';
import { normalizeMaterialVideoUrl } from '@/lib/materialVideo';
import SupplierProductLibrary from './SupplierProductLibrary';

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
  image_urls?: string[] | null;
  video_url?: string | null;
  category: string | null;
  sort_order: number;
  title_translated: string | null;
  description_translated: string | null;
  price: number | null;
  price_max: number | null;
  price_unit: string | null;
  price_currency: 'AED' | 'CNY' | 'USD' | 'VND' | null;
  price_from: boolean;
  specs?: Array<{ label?: unknown; value?: unknown }> | string | null;
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
  file_url?: string;
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
  const searchParams = useSearchParams();
  const originTab = searchParams.get('from') === 'products' ? 'products' : 'suppliers';
  const country = countryFromLang(useSiteLocale().lang);
  const requestIdentity = `${country.code}:${slug}`;
  const [supplier, setSupplier] = useState<SupplierProfile | null>(initialSupplier);
  const [products, setProducts] = useState<Product[]>(initialProducts);
  const [projects, setProjects] = useState<Project[]>([]);
  const [catalogs, setCatalogs] = useState<Catalog[]>([]);
  const [loading, setLoading] = useState(!initialSupplier);
  const [lightbox, setLightbox] = useState<{
    images: string[];
    videoUrl?: string | null;
    label?: string | null;
    idx: number;
  } | null>(null);
  const openProductMedia = (product: Product) => {
    const images = Array.isArray(product.image_urls) && product.image_urls.length > 0
      ? product.image_urls
      : product.image_url ? [product.image_url] : [];
    const videoUrl = normalizeMaterialVideoUrl(product.video_url);
    if (images.length === 0 && !videoUrl) return;
    setLightbox({
      images,
      videoUrl,
      label: product.title_translated || product.title,
      idx: 0,
    });
  };
  const closeLightbox = () => setLightbox(null);
  const [logoError, setLogoError] = useState(false);

  const [inquiryOpen, setInquiryOpen] = useState(false);
  const inquiryPanelRef = useRef<HTMLDivElement>(null);
  const inquiryTriggerRef = useRef<HTMLButtonElement>(null);
  const reduceMotion = useReducedMotion();
  const productsRef = useRef<HTMLDivElement>(null);
  const projectsRef = useRef<HTMLDivElement>(null);
  const [activeSection, setActiveSection] = useState<'products' | 'projects'>('products');
  const hydratedIdentityRef = useRef(requestIdentity);
  const requestGuardRef = useRef(createSupplierIdentityGuard(requestIdentity));
  const [loadedIdentity, setLoadedIdentity] = useState(requestIdentity);
  // 产品分类 value→label 映射(单一数据源 product_categories),否则买家页直接显示原始 value 如 NEW_MATERIALS。
  const catLabel = useProductCategoryLabels();

  const scrollTo = (ref: React.RefObject<HTMLDivElement | null>) => {
    ref.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };
  const openInquiry = () => setInquiryOpen(true);
  const closeInquiry = () => {
    setInquiryOpen(false);
    requestAnimationFrame(() => inquiryTriggerRef.current?.focus());
  };

  useEffect(() => {
    if (!slug) return;
    const requestToken = requestGuardRef.current.begin(requestIdentity);
    const identityChanged = hydratedIdentityRef.current !== requestIdentity;
    hydratedIdentityRef.current = requestIdentity;
    if (identityChanged) {
      setSupplier(null);
      setProducts([]);
      setProjects([]);
      setCatalogs([]);
      setLightbox(null);
      setLogoError(false);
      setInquiryOpen(false);
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
        if (!requestGuardRef.current.isCurrent(requestToken)) return;
        setSupplier(detail.supplier);
        setProducts(detail.products || []);
        setCatalogs(detail.catalogs || []);
        setProjects((projData.projects || []).map((p: { images?: string | string[] | null; [key: string]: unknown }) => ({
          ...p,
          images: typeof p.images === 'string' ? JSON.parse(p.images) : (p.images || []),
        })));
      })
      .catch(() => {
        if (!requestGuardRef.current.isCurrent(requestToken)) return;
        if (!initialSupplier || identityChanged) setSupplier(null);
      }) // 首次同 identity hydration 瞬时失败保留 SSR；路由/跨国失败绝不保留旧实体
      .finally(() => {
        if (!requestGuardRef.current.isCurrent(requestToken)) return;
        setLoadedIdentity(requestIdentity);
        setLoading(false);
      });
    return () => { requestGuardRef.current.cancel(requestToken); };
  }, [slug, country.code]);

  useEffect(() => {
    if (!inquiryOpen) return;
    const panel = inquiryPanelRef.current;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const getFocusable = () => panel?.querySelectorAll<HTMLElement>(
      'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [href], [tabindex]:not([tabindex="-1"])'
    );
    getFocusable()?.[0]?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        closeInquiry();
        return;
      }
      const focusable = getFocusable();
      if (event.key !== 'Tab' || !focusable?.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (!panel?.contains(document.activeElement) || !Array.from(focusable).includes(document.activeElement as HTMLElement)) {
        event.preventDefault();
        (event.shiftKey ? last : first).focus();
        return;
      }
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [inquiryOpen]);

  useEffect(() => {
    const mobile = window.matchMedia('(max-width: 639px)');
    const previousPaddingBottom = document.body.style.paddingBottom;
    const reserveInquiryCtaSpace = () => {
      document.body.style.paddingBottom = mobile.matches
        ? 'calc(4.5rem + env(safe-area-inset-bottom))'
        : previousPaddingBottom;
    };
    reserveInquiryCtaSpace();
    mobile.addEventListener('change', reserveInquiryCtaSpace);
    return () => {
      mobile.removeEventListener('change', reserveInquiryCtaSpace);
      document.body.style.paddingBottom = previousPaddingBottom;
    };
  }, []);

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

  const handleBack = () => router.push(`/materials?tab=${originTab}`);

  const parseCategories = (cats: string[] | string | null): string[] => {
    if (!cats) return [];
    if (Array.isArray(cats)) return cats;
    try { return JSON.parse(cats); } catch { return []; }
  };

  const contentStale = isSupplierContentStale(loadedIdentity, requestIdentity);
  if (loading || contentStale) return (
    <div className="min-h-screen flex items-center justify-center bg-[#faf9f7]">
      <div className="w-8 h-8 border-2 border-[#b8864a]/30 border-t-[#b8864a] rounded-full animate-spin" />
    </div>
  );

  if (!supplier) return (
    <div className="min-h-screen flex items-center justify-center bg-[#faf9f7]">
      <div className="text-center">
        <h1 className="text-xl font-bold text-[#2c2c2c] mb-4">Supplier not found</h1>
        <button onClick={handleBack} className="text-[#b8864a] hover:underline text-[15px]">Back to {originTab === 'products' ? 'Products' : 'Suppliers'}</button>
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
            <ArrowLeft className="w-4 h-4" /> Back to {originTab === 'products' ? 'Products' : 'Suppliers'}
          </button>
          <nav className="flex items-center gap-1.5 text-xs text-white/50 mb-8">
            <Link href="/" className="hover:text-white transition-colors">Home</Link>
            <span>/</span>
            <Link href={`/materials?tab=${originTab}`} className="hover:text-white transition-colors">Materials</Link>
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
                <CatalogReader catalogs={catalogs} />
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

      {/* Products use a dedicated full-width material-library layout. Keeping it
          outside the legacy content/inquiry columns prevents overlap on wide screens. */}
      {products.length > 0 && (
        <div ref={productsRef} id="section-products" className="scroll-mt-28">
          <div className="mx-auto max-w-[1920px] px-4 pt-8 sm:px-6 sm:pt-10 lg:px-8">
            <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-[#2c2c2c]">
              <Package className="h-5 w-5" style={{ color: 'var(--color-tarmeer-primary)' }} />
              Material library
              <span className="text-sm font-normal text-stone-400">({products.length})</span>
            </h2>
          </div>
          <SupplierProductLibrary
            products={products}
            categoryLabel={catLabel}
            onOpenProduct={openProductMedia}
          />
        </div>
      )}

      {/* Projects use the same generous full-width rhythm as the material library. */}
      {projects.length > 0 && (
        <section
          ref={projectsRef}
          id="section-projects"
          className="scroll-mt-28 border-t border-stone-200 bg-[#f7f5f1] py-12 sm:py-16"
        >
          <div className="mx-auto max-w-[1920px] px-4 sm:px-6 lg:px-8">
            <div className="mb-7 flex flex-col gap-3 border-b border-stone-300/70 pb-6 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#b8864a]">Project portfolio</p>
                <h2 className="mt-2 flex items-center gap-3 font-serif text-3xl text-[#1c1917] sm:text-4xl">
                  <Layers className="h-6 w-6 text-[#b8864a]" />
                  Projects
                </h2>
              </div>
              <p className="max-w-xl text-sm leading-6 text-stone-500 sm:text-right">
                {projects.length} completed {projects.length === 1 ? 'project' : 'projects'} showcasing production, materials and built applications.
              </p>
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
                  {projects.map(proj => {
                    const imgs = Array.isArray(proj.images) ? proj.images : [];
                    const gallery = buildSupplierProjectGallery(imgs);
                    const materials = Array.isArray(proj.materials) ? proj.materials : [];
                    const projectDescription = sanitizeDescription(proj.description);
                    const projectHref = `/materials/suppliers/${slug}/projects/${proj.id}`;
                    return (
                      <article key={proj.id} className="overflow-hidden rounded-3xl border border-stone-200 bg-white transition-colors hover:border-stone-300">
                        {imgs.length > 0 && (
                          <div className={`grid gap-1 bg-stone-100 ${gallery.visible.length > 1 ? 'grid-cols-2' : 'grid-cols-1'}`}>
                            {gallery.visible.map((img, i) => (
                              <button
                                type="button"
                                key={`${img}-${i}`}
                                className="group relative overflow-hidden text-left"
                                onClick={() => router.push(`${projectHref}?photo=${i}`)}
                                aria-label={i === 0 ? `View ${proj.title}` : `View ${proj.title} image ${i + 1}`}
                              >
                                <SmartImage src={img} alt={i === 0 ? proj.title : ''} className="aspect-video w-full object-cover transition duration-500 group-hover:scale-[1.015]" loading="lazy" />
                                {i === 1 && gallery.remaining > 0 && (
                                  <span className="absolute inset-0 flex items-center justify-center bg-black/55 text-sm font-semibold text-white">
                                    +{gallery.remaining}
                                  </span>
                                )}
                              </button>
                            ))}
                          </div>
                        )}
                        <div className="p-5 sm:p-6">
                          <div className="flex items-start justify-between gap-4">
                            <div className="min-w-0">
                              <h3 className="font-serif text-2xl leading-tight text-[#1c1917]">{proj.title}</h3>
                              {projectDescription && (
                                <p className="mt-2 line-clamp-3 text-sm leading-6 text-stone-500">
                                  {projectDescription}
                                </p>
                              )}
                            </div>
                            <Link href={projectHref} className="inline-flex shrink-0 items-center gap-1.5 text-sm font-semibold text-[#a87335] hover:text-[#855a29]">
                              View project <ArrowRight className="h-4 w-4" />
                            </Link>
                          </div>
                          <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2 border-t border-stone-100 pt-4">
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
                            <div className="mt-5 border-t border-stone-100 pt-4">
                              <p className="text-[11px] font-semibold uppercase tracking-wider text-stone-500 mb-3">Materials Used In This Project</p>
                              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                {materials.slice(0, 6).map((m) => {
                                  const materialDescription = sanitizeDescription(m.description);
                                  return <div key={m.id} className="rounded-2xl border border-stone-200 overflow-hidden bg-stone-50/40">
                                    <div className="aspect-[4/3] bg-stone-100">
                                      <SmartImage src={m.image_url} alt={m.title || ''} className="w-full h-full object-cover" loading="lazy" />
                                    </div>
                                    <div className="p-2.5">
                                      {m.category && <p className="text-[10px] font-medium text-[#b8864a] uppercase tracking-wider">{catLabel(m.category)}</p>}
                                      <p className="text-xs font-medium text-[#2c2c2c] line-clamp-1 mt-0.5">{m.title || 'Material'}</p>
                                      {materialDescription && <p className="text-[11px] text-stone-500 line-clamp-2 mt-1">{materialDescription}</p>}
                                    </div>
                                  </div>
                                })}
                              </div>
                            </div>
                          )}
                        </div>
                      </article>
                    );
                  })}
            </div>
          </div>
        </section>
      )}

      {/* 画册已移到 hero 区右侧展示（复用 flooring hero 同款电子书控件），此处不再重复渲染 */}

      {/* ========== Floating CTA ========== */}
      {!inquiryOpen && (
        <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-stone-200 bg-white px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] shadow-lg sm:bottom-6 sm:left-auto sm:right-6 sm:w-72 sm:rounded-2xl sm:border sm:py-3">
          <button
            ref={inquiryTriggerRef}
            type="button"
            className="btn-primary w-full py-3 text-[15px]"
            onClick={openInquiry}
            aria-haspopup="dialog"
            aria-controls="supplier-inquiry-panel"
            aria-expanded={inquiryOpen}
          >
            Send Inquiry
          </button>
        </div>
      )}

      {/* Keep the mounted form state when buyers close and reopen the drawer. */}
      <motion.div
        className={`fixed inset-0 z-[70] ${inquiryOpen ? 'pointer-events-auto' : 'pointer-events-none'}`}
        initial={false}
        animate={{ opacity: inquiryOpen ? 1 : 0 }}
        transition={reduceMotion ? { duration: 0 } : { duration: 0.16 }}
        aria-hidden={!inquiryOpen}
        inert={!inquiryOpen}
      >
            <button
              type="button"
              className="absolute inset-0 h-full w-full cursor-default bg-black/35 backdrop-blur-[1px]"
              onClick={closeInquiry}
              aria-label="Close inquiry form"
            />
            <motion.div
              ref={inquiryPanelRef}
              id="supplier-inquiry-panel"
              role="dialog"
              aria-modal="true"
              aria-labelledby="supplier-inquiry-title"
              initial={false}
              animate={{
                y: inquiryOpen || reduceMotion ? 0 : 48,
                opacity: inquiryOpen ? 1 : 0,
                scale: inquiryOpen || reduceMotion ? 1 : 0.98,
              }}
              transition={reduceMotion ? { duration: 0 } : { type: 'spring', stiffness: 360, damping: 34 }}
              className="absolute inset-x-0 bottom-0 max-h-[calc(100dvh-1.5rem)] overflow-y-auto overscroll-contain rounded-t-3xl border border-stone-200 bg-white px-5 pt-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] shadow-2xl sm:inset-x-auto sm:bottom-6 sm:right-6 sm:w-[420px] sm:max-h-[calc(100dvh-3rem)] sm:rounded-3xl sm:p-6"
            >
              <div className="mb-5 flex items-start justify-between gap-4 border-b border-stone-100 pb-4">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#b8864a]">Material sourcing</p>
                  <h2 id="supplier-inquiry-title" className="mt-1 text-xl font-semibold text-[#1c1917]">Send an inquiry</h2>
                  <p className="mt-1 text-sm text-stone-500">Keep browsing—we’ll send your request to this supplier.</p>
                </div>
                <button
                  type="button"
                  onClick={closeInquiry}
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-stone-200 text-stone-500 transition hover:border-stone-300 hover:bg-stone-50 hover:text-stone-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#b8864a]"
                  aria-label="Close inquiry form"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <ServiceInquiryCard
                key={requestIdentity}
                inline
                title="Project details"
                subtitle="Share a few details and our team will follow up shortly."
                submitLabel="Send inquiry"
                leadTag="Material Inquiry"
                companyName={publicTitle}
                supplierProfileId={supplier.id}
                isVn={country.code === 'vn'}
              />
            </motion.div>
      </motion.div>

      {/* ========== Lightbox ========== */}
      {lightbox !== null && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`${lightbox.label || 'Material'} media gallery`}
          className="fixed inset-0 z-50 bg-black/90 flex flex-col items-center justify-center p-4"
          onClick={closeLightbox}
        >
          <button
            type="button"
            aria-label="Close media"
            className="absolute top-4 right-4 text-white/70 hover:text-white text-3xl z-10"
            onClick={closeLightbox}
          >
            ×
          </button>
          <div className="flex flex-col items-center gap-3 max-w-full" onClick={(e: React.MouseEvent) => e.stopPropagation()}>
            {lightbox.videoUrl && lightbox.idx === lightbox.images.length ? (
              <video
                controls
                playsInline
                preload="metadata"
                poster={lightbox.images[0] ? resolveImageUrl(lightbox.images[0]) : undefined}
                className="aspect-video w-[min(90vw,960px)] max-h-[75vh] max-w-full rounded-lg bg-black object-contain"
              >
                <source src={resolveImageUrl(lightbox.videoUrl)} type="video/mp4" />
                Your browser does not support video playback.
              </video>
            ) : (
              <SmartImage
                src={lightbox.images[lightbox.idx]}
                alt={lightbox.label || ''}
                className="max-w-full max-h-[75vh] object-contain rounded-lg"
              />
            )}
            {lightbox.label && (
              <div className="bg-black/60 backdrop-blur-sm text-white px-5 py-2.5 rounded-xl text-sm font-medium">
                {lightbox.label}{lightbox.videoUrl && lightbox.idx === lightbox.images.length ? ' · Video' : ''}
              </div>
            )}
          </div>
          {lightbox.idx > 0 && (
            <button
              type="button"
              aria-label="Previous media"
              className="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white text-xl transition"
              onClick={e => { e.stopPropagation(); setLightbox(lb => lb && ({ ...lb, idx: lb.idx - 1 })); }}
            >
              ‹
            </button>
          )}
          {lightbox.idx < lightbox.images.length + (lightbox.videoUrl ? 1 : 0) - 1 && (
            <button
              type="button"
              aria-label="Next media"
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
