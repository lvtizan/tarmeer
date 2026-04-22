import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import PageContainer from '../components/PageContainer';
import {
  ArrowLeft, MapPin, Phone, Globe, Store, FileText,
  Download, ExternalLink, Package, Layers, FolderOpen,
  MessageCircle, Info,
} from 'lucide-react';
import InquiryForm from '../components/InquiryForm';

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
  contact_phone: string | null;
  whatsapp: string | null;
  website: string | null;
}

interface Product {
  id: number;
  title: string | null;
  description: string | null;
  image_url: string;
  sort_order: number;
}

interface Catalog {
  id: number;
  title: string;
  file_url: string;
  file_size: number | null;
  created_at: string;
}

type TabKey = 'products' | 'projects' | 'catalogs';

export default function SupplierDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const [supplier, setSupplier] = useState<SupplierProfile | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [catalogs, setCatalogs] = useState<Catalog[]>([]);
  const [loading, setLoading] = useState(true);
  const [lightboxIdx, setLightboxIdx] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<TabKey>('products');

  useEffect(() => {
    if (!slug) return;
    fetch(`${API_BASE}/suppliers/detail/${slug}`)
      .then(r => { if (!r.ok) throw new Error(); return r.json(); })
      .then(data => {
        setSupplier(data.supplier);
        const prods = data.products || [];
        const cats = data.catalogs || [];
        setProducts(prods);
        setCatalogs(cats);
        // Default tab: products if available, otherwise projects
        if (prods.length > 0) setActiveTab('products');
        else setActiveTab('projects');
      })
      .catch(() => setSupplier(null))
      .finally(() => setLoading(false));
  }, [slug]);

  const handleBack = () => {
    if (window.history.length > 1) navigate(-1);
    else navigate('/materials');
  };

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
  // Projects placeholder for future
  statItems.push({ label: 'Projects', count: 0 });
  if (catalogs.length > 0) statItems.push({ label: 'Catalogs', count: catalogs.length });

  const tabs: { key: TabKey; label: string; icon: React.ReactNode; count: number }[] = [
    { key: 'products', label: 'Products', icon: <Package className="w-4 h-4" />, count: products.length },
    { key: 'projects', label: 'Projects', icon: <Layers className="w-4 h-4" />, count: 0 },
    { key: 'catalogs', label: 'Catalogs', icon: <FolderOpen className="w-4 h-4" />, count: catalogs.length },
  ];

  return (
    <div className="min-h-screen bg-[#faf9f7]">
      <Helmet>
        <title>{supplier.company_name} - Supplier - Tarmeer UAE</title>
        <meta name="description" content={supplier.description?.slice(0, 300) || `${supplier.company_name} — building material supplier on Tarmeer UAE`} />
        <link rel="canonical" href={`https://www.tarmeer.com/materials/suppliers/${slug}`} />
        <meta property="og:title" content={`${supplier.company_name} - Supplier - Tarmeer UAE`} />
        <meta property="og:description" content={supplier.description?.slice(0, 300) || `${supplier.company_name} — building material supplier on Tarmeer UAE`} />
        {heroImage && <meta property="og:image" content={heroImage} />}
      </Helmet>

      {/* ========== Hero Section ========== */}
      <div className="relative overflow-hidden">
        {heroImage ? (
          <>
            <div className="absolute inset-0">
              <img src={heroImage} alt="" className="w-full h-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-r from-[#1c1917]/90 via-[#1c1917]/75 to-[#1c1917]/60" />
            </div>
          </>
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
            {supplier.logo_url ? (
              <img
                src={supplier.logo_url}
                alt={supplier.company_name}
                className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl object-contain border border-white/10 bg-white/10 backdrop-blur-sm p-2 shrink-0"
              />
            ) : (
              <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-white/10 backdrop-blur-sm border border-white/10 flex items-center justify-center text-2xl sm:text-3xl font-bold text-white/80 shrink-0">
                {initial}
              </div>
            )}

            <div className="flex-1 min-w-0">
              {/* Name + Origin */}
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

              {/* Category tags */}
              {categoryList.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-3">
                  {categoryList.map(c => (
                    <span key={c} className="text-[11px] px-2.5 py-0.5 rounded-full bg-white/10 text-white/70 border border-white/5">
                      {c}
                    </span>
                  ))}
                </div>
              )}

              {/* Contact row */}
              <div className="flex flex-wrap items-center gap-x-5 gap-y-2 mt-4">
                {supplier.contact_phone && (
                  <a href={`tel:${supplier.contact_phone}`} className="flex items-center gap-1.5 text-sm text-white/70 hover:text-white transition">
                    <Phone className="w-3.5 h-3.5" /> {supplier.contact_phone}
                  </a>
                )}
                {supplier.whatsapp && (
                  <a
                    href={`https://wa.me/${supplier.whatsapp.replace(/[^0-9]/g, '')}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 text-sm text-white/70 hover:text-white transition"
                  >
                    <MessageCircle className="w-3.5 h-3.5" /> WhatsApp
                  </a>
                )}
                {supplier.website && (
                  <a
                    href={supplier.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 text-sm text-white/70 hover:text-white transition"
                  >
                    <Globe className="w-3.5 h-3.5" /> Website <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </div>
            </div>
          </div>

          {/* Stats bar */}
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

      {/* ========== Tab Navigation ========== */}
      <div className="border-b border-stone-200 bg-white sticky top-0 z-20">
        <PageContainer>
          <div className="flex gap-1 -mb-px overflow-x-auto">
            {tabs.map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex items-center gap-2 px-5 py-3.5 text-sm font-medium border-b-2 transition whitespace-nowrap ${
                  activeTab === tab.key
                    ? 'border-[#b8864a] text-[#b8864a]'
                    : 'border-transparent text-stone-500 hover:text-[#2c2c2c] hover:border-stone-300'
                }`}
              >
                {tab.icon}
                {tab.label}
                {tab.count > 0 && (
                  <span className={`text-[11px] px-1.5 py-0.5 rounded-full ${
                    activeTab === tab.key ? 'bg-[#b8864a]/10 text-[#b8864a]' : 'bg-stone-100 text-stone-400'
                  }`}>
                    {tab.count}
                  </span>
                )}
              </button>
            ))}
          </div>
        </PageContainer>
      </div>

      {/* ========== Main Content + Sidebar ========== */}
      <PageContainer className="py-8 sm:py-10">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Content area */}
          <div className="lg:col-span-2">
            {/* Products Tab */}
            {activeTab === 'products' && (
              <div>
                {products.length > 0 ? (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                    {products.map((p, i) => (
                      <div key={p.id} className="group cursor-pointer" onClick={() => setLightboxIdx(i)}>
                        <div className="aspect-[4/3] rounded-2xl overflow-hidden bg-stone-100 border border-stone-200">
                          <img
                            src={p.image_url}
                            alt={p.title || ''}
                            className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                          />
                        </div>
                        {p.title && (
                          <p className="text-[15px] font-medium text-[#2c2c2c] mt-2 truncate">{p.title}</p>
                        )}
                        {p.description && (
                          <p className="text-xs text-[#6b6b6b] mt-0.5 line-clamp-2">{p.description}</p>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <EmptyState
                    icon={<Package className="w-8 h-8 text-stone-300" />}
                    title="No products yet"
                    description="This supplier hasn't uploaded any products. Check back later or send them an inquiry."
                  />
                )}
              </div>
            )}

            {/* Projects Tab */}
            {activeTab === 'projects' && (
              <EmptyState
                icon={<Layers className="w-8 h-8 text-stone-300" />}
                title="Projects coming soon"
                description="This supplier's project portfolio is being prepared. Check back soon for installation photos and case studies."
              />
            )}

            {/* Catalogs Tab */}
            {activeTab === 'catalogs' && (
              <div>
                {catalogs.length > 0 ? (
                  <div className="space-y-3">
                    {catalogs.map(c => (
                      <a
                        key={c.id}
                        href={c.file_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-4 p-4 rounded-2xl bg-white border border-stone-200 hover:border-[#b8864a]/40 hover:shadow-sm transition group"
                      >
                        <div className="w-12 h-12 rounded-xl bg-red-50 flex items-center justify-center shrink-0 group-hover:bg-red-100 transition">
                          <FileText className="w-6 h-6 text-red-500" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[15px] font-medium text-[#2c2c2c] truncate">{c.title}</p>
                          {c.file_size && (
                            <p className="text-xs text-[#6b6b6b] mt-0.5">
                              {c.file_size > 1048576
                                ? `${(c.file_size / 1048576).toFixed(1)} MB`
                                : `${(c.file_size / 1024).toFixed(0)} KB`}
                            </p>
                          )}
                        </div>
                        <div className="shrink-0 flex items-center gap-2 px-4 py-2 rounded-xl bg-stone-50 text-sm font-medium text-[#2c2c2c] group-hover:bg-[#b8864a] group-hover:text-white transition">
                          <Download className="w-4 h-4" /> Download
                        </div>
                      </a>
                    ))}
                  </div>
                ) : (
                  <EmptyState
                    icon={<FolderOpen className="w-8 h-8 text-stone-300" />}
                    title="No catalogs uploaded yet"
                    description="This supplier hasn't uploaded any catalogs or brochures. Send them an inquiry to request one."
                  />
                )}
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="lg:col-span-1">
            <div className="sticky top-[60px] space-y-5">
              {/* Inquiry Form */}
              <InquiryForm recipientName={supplier.company_name} companyId={supplier.id} />

              {/* Catalogs quick download (sidebar) */}
              {catalogs.length > 0 && activeTab !== 'catalogs' && (
                <div className="bg-white rounded-2xl border border-stone-200 p-5">
                  <h3 className="text-sm font-semibold text-[#2c2c2c] mb-3 flex items-center gap-2">
                    <FileText className="w-4 h-4 text-[#b8864a]" /> Catalogs
                  </h3>
                  <div className="space-y-2">
                    {catalogs.slice(0, 3).map(c => (
                      <a
                        key={c.id}
                        href={c.file_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-stone-50 transition group"
                      >
                        <div className="w-8 h-8 rounded-lg bg-red-50 flex items-center justify-center shrink-0">
                          <FileText className="w-4 h-4 text-red-500" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-[#2c2c2c] truncate">{c.title}</p>
                          {c.file_size && (
                            <p className="text-[11px] text-[#6b6b6b]">
                              {c.file_size > 1048576
                                ? `${(c.file_size / 1048576).toFixed(1)} MB`
                                : `${(c.file_size / 1024).toFixed(0)} KB`}
                            </p>
                          )}
                        </div>
                        <Download className="w-3.5 h-3.5 text-stone-400 group-hover:text-[#b8864a] transition" />
                      </a>
                    ))}
                  </div>
                  {catalogs.length > 3 && (
                    <button
                      onClick={() => setActiveTab('catalogs')}
                      className="w-full mt-3 text-sm text-[#b8864a] hover:underline text-center"
                    >
                      View all {catalogs.length} catalogs
                    </button>
                  )}
                </div>
              )}

              {/* About card (sidebar) */}
              {supplier.description && (
                <div className="bg-white rounded-2xl border border-stone-200 p-5">
                  <h3 className="text-sm font-semibold text-[#2c2c2c] mb-3 flex items-center gap-2">
                    <Info className="w-4 h-4 text-[#b8864a]" /> About
                  </h3>
                  <p className="text-sm text-[#6b6b6b] leading-relaxed line-clamp-6 whitespace-pre-line">
                    {supplier.description}
                  </p>
                </div>
              )}

              {/* Physical store card */}
              {!!supplier.has_physical_store && supplier.store_address && (
                <div className="bg-white rounded-2xl border border-stone-200 p-5">
                  <h3 className="text-sm font-semibold text-[#2c2c2c] mb-3 flex items-center gap-2">
                    <Store className="w-4 h-4 text-[#b8864a]" /> Physical Store
                  </h3>
                  <p className="text-sm text-[#6b6b6b] leading-relaxed">{supplier.store_address}</p>
                  {supplier.google_maps_url && (
                    <a
                      href={supplier.google_maps_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 mt-3 px-4 py-2 rounded-xl bg-[#b8864a] text-white text-sm font-medium hover:bg-[#a0743e] transition"
                    >
                      <MapPin className="w-3.5 h-3.5" /> Open in Maps
                    </a>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </PageContainer>

      {/* ========== About Section (full width, below grid) ========== */}
      {supplier.description && supplier.description.length > 200 && (
        <div className="border-t border-stone-200">
          <PageContainer className="py-10">
            <div className="bg-white rounded-2xl border border-stone-200 p-6 sm:p-8">
              <h2 className="text-lg font-bold text-[#2c2c2c] mb-4">About {supplier.company_name}</h2>
              <p className="text-[15px] text-[#2c2c2c] leading-relaxed whitespace-pre-line">{supplier.description}</p>
            </div>
          </PageContainer>
        </div>
      )}

      {/* ========== Lightbox ========== */}
      {lightboxIdx !== null && (
        <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4" onClick={() => setLightboxIdx(null)}>
          <button className="absolute top-4 right-4 text-white/70 hover:text-white text-3xl z-10" onClick={() => setLightboxIdx(null)}>
            ×
          </button>
          <img
            src={products[lightboxIdx].image_url}
            alt={products[lightboxIdx].title || ''}
            className="max-w-full max-h-[85vh] object-contain rounded-lg"
            onClick={e => e.stopPropagation()}
          />
          {products[lightboxIdx].title && (
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-black/60 backdrop-blur-sm text-white px-5 py-2.5 rounded-xl text-sm font-medium">
              {products[lightboxIdx].title}
            </div>
          )}
          {lightboxIdx > 0 && (
            <button
              className="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white text-xl transition"
              onClick={e => { e.stopPropagation(); setLightboxIdx(lightboxIdx - 1); }}
            >
              ‹
            </button>
          )}
          {lightboxIdx < products.length - 1 && (
            <button
              className="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white text-xl transition"
              onClick={e => { e.stopPropagation(); setLightboxIdx(lightboxIdx + 1); }}
            >
              ›
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/* ========== Empty State Component ========== */
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
