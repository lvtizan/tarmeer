import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import PageContainer from '../components/PageContainer';
import { ArrowLeft, MapPin, Phone, Globe, Store, FileText, Download, ExternalLink } from 'lucide-react';
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

export default function SupplierDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const [supplier, setSupplier] = useState<SupplierProfile | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [catalogs, setCatalogs] = useState<Catalog[]>([]);
  const [loading, setLoading] = useState(true);
  const [lightboxIdx, setLightboxIdx] = useState<number | null>(null);

  useEffect(() => {
    if (!slug) return;
    fetch(`${API_BASE}/suppliers/detail/${slug}`)
      .then(r => { if (!r.ok) throw new Error(); return r.json(); })
      .then(data => {
        setSupplier(data.supplier);
        setProducts(data.products || []);
        setCatalogs(data.catalogs || []);
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

  if (loading) return <div className="min-h-screen flex items-center justify-center text-stone-400">Loading...</div>;
  if (!supplier) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-xl font-semibold text-[#2c2c2c] mb-4">Supplier not found</h1>
        <button onClick={handleBack} className="text-[#b8864a] hover:underline">Back</button>
      </div>
    </div>
  );

  const cats = parseCategories(supplier.categories);

  return (
    <div className="min-h-screen bg-[#faf9f7]">
      <Helmet>
        <title>{supplier.company_name} - Supplier - Tarmeer UAE</title>
        <meta name="description" content={supplier.description?.slice(0, 300) || `${supplier.company_name} — building material supplier on Tarmeer UAE`} />
        <link rel="canonical" href={`https://www.tarmeer.com/materials/suppliers/${slug}`} />
      </Helmet>

      <PageContainer className="py-6 sm:py-10">
        <button onClick={handleBack} className="flex items-center gap-1.5 text-sm text-stone-500 hover:text-[#b8864a] transition mb-6">
          <ArrowLeft className="w-4 h-4" /> Back to Suppliers
        </button>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Header */}
            <div className="bg-white rounded-2xl border border-stone-200 p-6">
              <div className="flex items-start gap-5">
                {supplier.logo_url ? (
                  <img src={supplier.logo_url} alt={supplier.company_name} className="w-20 h-20 rounded-xl object-contain border border-stone-100 bg-stone-50 p-2" />
                ) : (
                  <div className="w-20 h-20 rounded-xl bg-stone-100 flex items-center justify-center text-2xl font-bold text-stone-300">
                    {supplier.company_name[0]}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h1 className="text-xl font-bold text-[#2c2c2c]">{supplier.company_name}</h1>
                    <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full ${
                      supplier.origin === 'china' ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-600'
                    }`}>
                      {supplier.origin === 'china' ? '🇨🇳 China Supplier' : '🇦🇪 Dubai Supplier'}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {cats.map(c => (
                      <span key={c} className="text-[11px] px-2.5 py-0.5 rounded-full bg-stone-100 text-stone-500">{c}</span>
                    ))}
                  </div>
                  {supplier.contact_phone && (
                    <div className="flex items-center gap-2 mt-3 text-sm text-stone-600">
                      <Phone className="w-3.5 h-3.5" /> {supplier.contact_phone}
                    </div>
                  )}
                  {supplier.website && (
                    <a href={supplier.website} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-1.5 mt-1.5 text-sm text-[#b8864a] hover:underline">
                      <Globe className="w-3.5 h-3.5" /> Website <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>
              </div>
            </div>

            {/* Physical store */}
            {supplier.has_physical_store && supplier.store_address && (
              <div className="bg-blue-50 rounded-2xl border border-blue-100 p-5 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <Store className="w-5 h-5 text-blue-600 shrink-0" />
                  <div>
                    <p className="text-sm font-semibold text-blue-900">Physical Store</p>
                    <p className="text-xs text-blue-700 mt-0.5">{supplier.store_address}</p>
                  </div>
                </div>
                {supplier.google_maps_url && (
                  <a href={supplier.google_maps_url} target="_blank" rel="noopener noreferrer"
                    className="shrink-0 inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 transition">
                    <MapPin className="w-3.5 h-3.5" /> Google Maps
                  </a>
                )}
              </div>
            )}

            {/* About */}
            {supplier.description && (
              <div className="bg-white rounded-2xl border border-stone-200 p-6">
                <h2 className="text-sm font-semibold text-stone-500 uppercase tracking-wider mb-3">About</h2>
                <p className="text-[15px] text-[#2c2c2c] leading-relaxed whitespace-pre-line">{supplier.description}</p>
              </div>
            )}

            {/* Products */}
            {products.length > 0 && (
              <div>
                <h2 className="text-lg font-bold text-[#2c2c2c] mb-4">Products</h2>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {products.map((p, i) => (
                    <div key={p.id} className="group cursor-pointer" onClick={() => setLightboxIdx(i)}>
                      <div className="aspect-[4/3] rounded-xl overflow-hidden bg-stone-100 border border-stone-200">
                        <img src={p.image_url} alt={p.title || ''} className="w-full h-full object-cover group-hover:scale-105 transition duration-300" />
                      </div>
                      {p.title && <p className="text-xs font-medium text-[#2c2c2c] mt-1.5 truncate">{p.title}</p>}
                      {p.description && <p className="text-[11px] text-stone-500 truncate">{p.description}</p>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Catalogs */}
            {catalogs.length > 0 && (
              <div>
                <h2 className="text-lg font-bold text-[#2c2c2c] mb-4">Catalogs & Brochures</h2>
                <div className="space-y-2">
                  {catalogs.map(c => (
                    <a key={c.id} href={c.file_url} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-3 p-3 rounded-xl bg-white border border-stone-200 hover:border-[#b8864a]/40 transition">
                      <div className="w-10 h-10 rounded-lg bg-red-50 flex items-center justify-center shrink-0">
                        <FileText className="w-5 h-5 text-red-500" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-[#2c2c2c] truncate">{c.title}</p>
                        {c.file_size && <p className="text-[11px] text-stone-400">{(c.file_size / 1024 / 1024).toFixed(1)} MB</p>}
                      </div>
                      <Download className="w-4 h-4 text-stone-400" />
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="lg:col-span-1">
            <div className="sticky top-6">
              <InquiryForm recipientName={supplier.company_name} />
            </div>
          </div>
        </div>
      </PageContainer>

      {/* Simple Lightbox */}
      {lightboxIdx !== null && (
        <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4" onClick={() => setLightboxIdx(null)}>
          <button className="absolute top-4 right-4 text-white/70 hover:text-white text-3xl" onClick={() => setLightboxIdx(null)}>×</button>
          <img src={products[lightboxIdx].image_url} alt={products[lightboxIdx].title || ''}
            className="max-w-full max-h-[85vh] object-contain rounded-lg" onClick={e => e.stopPropagation()} />
          {products[lightboxIdx].title && (
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-black/60 text-white px-4 py-2 rounded-lg text-sm">
              {products[lightboxIdx].title}
            </div>
          )}
          {lightboxIdx > 0 && (
            <button className="absolute left-4 top-1/2 -translate-y-1/2 text-white/70 hover:text-white text-4xl"
              onClick={e => { e.stopPropagation(); setLightboxIdx(lightboxIdx - 1); }}>‹</button>
          )}
          {lightboxIdx < products.length - 1 && (
            <button className="absolute right-4 top-1/2 -translate-y-1/2 text-white/70 hover:text-white text-4xl"
              onClick={e => { e.stopPropagation(); setLightboxIdx(lightboxIdx + 1); }}>›</button>
          )}
        </div>
      )}
    </div>
  );
}
