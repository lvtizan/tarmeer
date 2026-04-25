import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { AnimatePresence, motion } from 'framer-motion';
import PageContainer from '../components/PageContainer';
import {
  ArrowLeft, ArrowUp, FileText, X,
  Download, Package, Layers, FolderOpen, MapPin, ExternalLink,
  Maximize2, Banknote,
} from 'lucide-react';
import SmartImage from '../components/ui/SmartImage';
import ServiceInquiryCard from '../components/services/ServiceInquiryCard';

const API_BASE = import.meta.env.VITE_API_URL?.trim() || '/api';

interface SupplierProfile {
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
}

interface Product {
  id: number;
  title: string | null;
  description: string | null;
  image_url: string;
  category: string | null;
  sort_order: number;
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

export default function SupplierDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const [supplier, setSupplier] = useState<SupplierProfile | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [catalogs, setCatalogs] = useState<Catalog[]>([]);
  const [loading, setLoading] = useState(true);
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
  const catalogsRef = useRef<HTMLDivElement>(null);
  const [activeSection, setActiveSection] = useState<'products' | 'projects' | 'catalogs'>('products');

  const scrollTo = (ref: React.RefObject<HTMLDivElement | null>) => {
    ref.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  useEffect(() => {
    if (!slug) return;
    Promise.all([
      fetch(`${API_BASE}/suppliers/detail/${slug}`).then(r => { if (!r.ok) throw new Error(); return r.json(); }),
      fetch(`${API_BASE}/suppliers/detail/${slug}/projects`).then(r => r.ok ? r.json() : { projects: [] }),
    ])
      .then(([detail, projData]) => {
        setSupplier(detail.supplier);
        setProducts(detail.products || []);
        setCatalogs(detail.catalogs || []);
        setProjects((projData.projects || []).map((p: any) => ({
          ...p,
          images: typeof p.images === 'string' ? JSON.parse(p.images) : (p.images || []),
        })));
      })
      .catch(() => setSupplier(null))
      .finally(() => setLoading(false));
  }, [slug]);

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
      { ref: catalogsRef, key: 'catalogs' as const },
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

  const handleBack = () => navigate('/materials');

  const parseCategories = (cats: string[] | string | null): string[] => {
    if (!cats) return [];
    if (Array.isArray(cats)) return cats;
    try { return JSON.parse(cats); } catch { return []; }
  };

  if (loading) return (
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
  const initial = supplier.company_name?.[0]?.toUpperCase() || 'S';

  const statItems: { label: string; count: number }[] = [];
  if (products.length > 0) statItems.push({ label: 'Products', count: products.length });
  if (projects.length > 0) statItems.push({ label: 'Projects', count: projects.length });
  if (catalogs.length > 0) statItems.push({ label: 'Catalogs', count: catalogs.length });

  const productCategories = [...new Set(products.map(p => p.category).filter(Boolean))] as string[];

  const tabItems = [
    { key: 'products' as const, label: 'Products', icon: Package, count: products.length, ref: productsRef },
    { key: 'projects' as const, label: 'Projects', icon: Layers, count: projects.length, ref: projectsRef },
    { key: 'catalogs' as const, label: 'Catalogs', icon: FolderOpen, count: catalogs.length, ref: catalogsRef },
  ];

  return (
    <div className="min-h-screen bg-[#faf9f7]">
      <Helmet>
        <title>{supplier.company_name} — Material Supplier UAE | Tarmeer</title>
        <meta name="description" content={
          (supplier.description?.slice(0, 155) || `${supplier.company_name} — building material supplier in UAE`) + ' | Tarmeer'
        } />
        <link rel="canonical" href={`https://www.tarmeer.com/materials/suppliers/${slug}`} />
        <meta property="og:title" content={`${supplier.company_name} — Material Supplier UAE | Tarmeer`} />
        <meta property="og:description" content={supplier.description?.slice(0, 200) || `${supplier.company_name} — building material supplier on Tarmeer UAE`} />
        <meta property="og:url" content={`https://www.tarmeer.com/materials/suppliers/${slug}`} />
        <meta property="og:type" content="website" />
        {heroImage && <meta property="og:image" content={heroImage} />}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={`${supplier.company_name} | Tarmeer`} />
        <meta name="twitter:description" content={supplier.description?.slice(0, 160) || ''} />
        <meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1" />
        <script type="application/ld+json">{JSON.stringify({
          '@context': 'https://schema.org',
          '@type': 'BreadcrumbList',
          itemListElement: [
            { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://www.tarmeer.com' },
            { '@type': 'ListItem', position: 2, name: 'Materials', item: 'https://www.tarmeer.com/materials' },
            { '@type': 'ListItem', position: 3, name: supplier.company_name, item: `https://www.tarmeer.com/materials/suppliers/${slug}` },
          ],
        })}</script>
        <script type="application/ld+json">{JSON.stringify({
          '@context': 'https://schema.org',
          '@type': supplier.has_physical_store ? 'LocalBusiness' : 'Organization',
          name: supplier.company_name,
          ...(supplier.description && { description: supplier.description.slice(0, 300) }),
          url: `https://www.tarmeer.com/materials/suppliers/${slug}`,
          ...(heroImage && { image: heroImage }),
          ...(supplier.logo_url && { logo: supplier.logo_url }),
          ...(supplier.has_physical_store && supplier.store_address && {
            address: {
              '@type': 'PostalAddress',
              streetAddress: supplier.store_address,
              addressCountry: 'AE',
            },
          }),
        })}</script>
      </Helmet>

      {/* ========== Hero ========== */}
      <div className="relative overflow-hidden">
        {heroImage ? (
          <div className="absolute inset-0">
            <SmartImage src={heroImage} alt="" className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-r from-[#1c1917]/90 via-[#1c1917]/75 to-[#1c1917]/60" />
          </div>
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-[#1c1917] via-[#2c2520] to-[#3d3028]" />
        )}

        <PageContainer className="relative z-10 pt-6 pb-10 sm:pt-8 sm:pb-14">
          <button
            onClick={handleBack}
            className="flex items-center gap-1.5 text-sm text-white/60 hover:text-white transition mb-8"
          >
            <ArrowLeft className="w-4 h-4" /> Back to Suppliers
          </button>

          <div className="flex items-start gap-5 sm:gap-6">
            {/* Logo */}
            {supplier.logo_url && !logoError ? (
              <SmartImage
                src={supplier.logo_url}
                alt={supplier.company_name}
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
                <h1 className="text-xl sm:text-2xl font-bold text-white">{supplier.company_name}</h1>
                <span className={`text-[11px] font-semibold px-3 py-1 rounded-full backdrop-blur-sm ${
                  supplier.origin === 'china'
                    ? 'bg-red-500/20 text-red-200 border border-red-400/20'
                    : 'bg-emerald-500/20 text-emerald-200 border border-emerald-400/20'
                }`}>
                  {supplier.origin === 'china' ? 'China' : 'Dubai'}
                </span>
              </div>

              {categoryList.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-3">
                  {categoryList.map(c => (
                    <span key={c} className="text-[11px] px-2.5 py-0.5 rounded-full bg-white/10 text-white/70 border border-white/5">
                      {c}
                    </span>
                  ))}
                </div>
              )}
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
        </PageContainer>
      </div>

      {/* ========== About (below hero, full width) ========== */}
      {supplier.description && (
        <div className="bg-white border-b border-stone-200">
          <PageContainer className="py-6">
            <p className="text-[15px] text-[#2c2c2c] leading-relaxed">{supplier.description}</p>
            {!!supplier.has_physical_store && supplier.store_address && (
              <div className="flex items-start gap-2 mt-4 pt-4 border-t border-stone-100 text-sm text-[#6b6b6b]">
                <MapPin className="w-4 h-4 text-[#b8864a] mt-0.5 shrink-0" />
                <span>{supplier.store_address}</span>
                {supplier.google_maps_url && (
                  <a
                    href={supplier.google_maps_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="ml-1 inline-flex items-center gap-1 text-[#b8864a] hover:underline shrink-0"
                  >
                    View on Map <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </div>
            )}
          </PageContainer>
        </div>
      )}

      {/* ========== Sticky Tab Strip ========== */}
      {/* top-14/top-16 = navbar height (h-14 mobile / h-16 desktop). z-40 keeps us above content
          but below the z-50 navbar. overflow-x-auto on the sticky element itself avoids creating
          a nested scroll context that breaks sticky on iOS Safari. */}
      <div className="sticky top-14 sm:top-16 z-40 bg-[#faf9f7]/95 backdrop-blur-sm border-b border-stone-200 overflow-x-auto scrollbar-none">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex items-center gap-1">
          {tabItems.map(({ key, label, icon: Icon, count, ref }) => (
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

          {/* Back to top */}
          <button
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            className="ml-auto p-2 rounded-full text-stone-400 hover:text-[#b8864a] hover:bg-stone-100 transition shrink-0"
            aria-label="Back to top"
          >
            <ArrowUp className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* ========== Main Content ========== */}
      {/* paddingLeft mirrors PageContainer (max-w-6xl mx-auto px-6) so left edge aligns with tab strip.
          The sidebar extends into the right margin — it does NOT shift the content left. */}
      <div
        className="py-8 sm:py-10"
        style={{
          paddingLeft: 'max(16px, calc((100vw - 1152px) / 2 + 24px))',
          paddingRight: '24px',
        }}
      >
        {/* items-stretch (default) is critical: makes the sidebar column as tall as the left
            content column, giving sticky enough scroll distance to work correctly */}
        <div className="flex gap-8">
          <div className="min-w-0 flex-1 space-y-10">
          {/* Products section */}
          <div ref={productsRef} id="section-products" className="scroll-mt-28">
            <h2 className="text-lg font-semibold text-[#2c2c2c] mb-4 flex items-center gap-2">
              <Package className="w-5 h-5" style={{ color: 'var(--color-tarmeer-primary)' }} />
              Products
              {products.length > 0 && <span className="text-sm font-normal text-stone-400">({products.length})</span>}
            </h2>
            {products.length > 0 ? (
              <>
                {productCategories.length > 1 && (
                  <div className="flex flex-wrap gap-2 mb-4">
                    <button onClick={() => setProductCatFilter(null)}
                      className={`px-3 py-1.5 rounded-2xl text-xs font-medium transition ${!productCatFilter ? 'bg-[#b8864a] text-white' : 'bg-stone-100 text-stone-600 hover:bg-stone-200'}`}>All</button>
                    {productCategories.map(cat => (
                      <button key={cat} onClick={() => setProductCatFilter(cat)}
                        className={`px-3 py-1.5 rounded-2xl text-xs font-medium transition ${productCatFilter === cat ? 'bg-[#b8864a] text-white' : 'bg-stone-100 text-stone-600 hover:bg-stone-200'}`}>{cat}</button>
                    ))}
                  </div>
                )}
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                  {products.filter(p => !productCatFilter || p.category === productCatFilter).map((p) => (
                    <div key={p.id} className="group cursor-pointer" onClick={() => openLightbox(products.map(x => x.image_url), products.indexOf(p), products.map(x => x.title))}>
                      <div className="aspect-[4/3] rounded-2xl overflow-hidden bg-stone-100 border border-stone-200">
                        <SmartImage src={p.image_url} alt={p.title || ''} className="w-full h-full object-cover group-hover:scale-105 transition duration-300" loading="lazy" />
                      </div>
                      {p.category && <p className="text-[10px] font-medium text-[#b8864a] uppercase tracking-wider mt-2">{p.category}</p>}
                      {p.title && <p className="text-[15px] font-medium text-[#2c2c2c] mt-0.5 truncate">{p.title}</p>}
                      {p.description && <p className="text-xs text-[#6b6b6b] mt-0.5 line-clamp-2">{p.description}</p>}
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <EmptyState icon={<Package className="w-8 h-8 text-stone-300" />} title="No products yet" description="This supplier hasn't uploaded any products." />
            )}
          </div>

          {/* Projects section */}
          <div ref={projectsRef} id="section-projects" className="scroll-mt-28">
            <h2 className="text-lg font-semibold text-[#2c2c2c] mb-4 flex items-center gap-2">
              <Layers className="w-5 h-5" style={{ color: 'var(--color-tarmeer-primary)' }} />
              Projects
              {projects.length > 0 && <span className="text-sm font-normal text-stone-400">({projects.length})</span>}
            </h2>
            {projects.length > 0 ? (
              <div className="space-y-6">
                {projects.map(proj => {
                  const imgs = Array.isArray(proj.images) ? proj.images : [];
                  const materials = Array.isArray(proj.materials) ? proj.materials : [];
                  return (
                    <div key={proj.id} className="bg-white rounded-2xl border border-stone-200 overflow-hidden">
                      {imgs.length > 0 && (
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-1">
                          {imgs.map((img, i) => (
                            <div key={i} className="cursor-pointer group relative" onClick={() => navigate(`/materials/suppliers/${slug}/projects/${proj.id}?photo=${i}`)}>
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
                                    {m.category && <p className="text-[10px] font-medium text-[#b8864a] uppercase tracking-wider">{m.category}</p>}
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
            ) : (
              <EmptyState icon={<Layers className="w-8 h-8 text-stone-300" />} title="No projects yet" description="This supplier hasn't uploaded any project photos yet." />
            )}
          </div>

          {/* Catalogs section */}
          <div ref={catalogsRef} id="section-catalogs" className="scroll-mt-28">
            <h2 className="text-lg font-semibold text-[#2c2c2c] mb-4 flex items-center gap-2">
              <FolderOpen className="w-5 h-5" style={{ color: 'var(--color-tarmeer-primary)' }} />
              Catalogs
              {catalogs.length > 0 && <span className="text-sm font-normal text-stone-400">({catalogs.length})</span>}
            </h2>
            {catalogs.length > 0 ? (
              <div className="space-y-3">
                {catalogs.map(c => (
                  <a key={c.id} href={c.file_url} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-4 p-4 rounded-2xl bg-white border border-stone-200 hover:border-[#b8864a]/40 hover:shadow-sm transition group">
                    <div className="w-12 h-12 rounded-2xl bg-red-50 flex items-center justify-center shrink-0 group-hover:bg-red-100 transition">
                      <FileText className="w-6 h-6 text-red-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[15px] font-medium text-[#2c2c2c] truncate">{c.title}</p>
                      {c.file_size && (
                        <p className="text-xs text-[#6b6b6b] mt-0.5">
                          {c.file_size > 1048576 ? `${(c.file_size / 1048576).toFixed(1)} MB` : `${(c.file_size / 1024).toFixed(0)} KB`}
                        </p>
                      )}
                    </div>
                    <div className="shrink-0 flex items-center gap-2 px-4 py-2 rounded-2xl bg-stone-50 text-sm font-medium text-[#2c2c2c] group-hover:bg-[#b8864a] group-hover:text-white transition">
                      <Download className="w-4 h-4" /> Download
                    </div>
                  </a>
                ))}
              </div>
            ) : (
              <EmptyState icon={<FolderOpen className="w-8 h-8 text-stone-300" />} title="No catalogs uploaded yet" description="This supplier hasn't uploaded any catalogs." />
            )}
          </div>

          {/* Inline inquiry form — shown on screens < 1280px where no sidebar */}
          <div ref={mobileFormRef} className="min-[1280px]:hidden">
            <ServiceInquiryCard
              title={`Contact ${supplier.company_name}`}
              companyName={supplier.company_name}
              companySlug={supplier.slug}
              companyId={supplier.id}
            />
          </div>
        </div>

        {/* Sticky sidebar — 1280px+, sticks just below the tab strip as user scrolls */}
        <div className="hidden min-[1280px]:block w-72 shrink-0">
          <div className="sticky top-[80px]">
            <ServiceInquiryCard
              title={`Contact ${supplier.company_name}`}
              companyName={supplier.company_name}
              companySlug={supplier.slug}
              companyId={supplier.id}
            />
          </div>
        </div>
      </div>
      </div>

      {/* ========== Floating CTA (< 1280px, shown after scrolling past hero) ========== */}
      <AnimatePresence>
        {showFloatingForm && !floatingFormDismissed && (
          <motion.div
            initial={{ y: 80, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 80, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            className="min-[1280px]:hidden fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-stone-200 px-4 py-3 flex items-center gap-3 shadow-lg"
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

function EmptyState({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
      <div className="w-16 h-16 rounded-2xl bg-stone-100 flex items-center justify-center mb-4">
        {icon}
      </div>
      <h3 className="text-[15px] font-semibold text-[#2c2c2c] mb-2">{title}</h3>
      <p className="text-sm text-[#6b6b6b] max-w-sm">{description}</p>
    </div>
  );
}
