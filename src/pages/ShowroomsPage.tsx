import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import PageContainer from '../components/PageContainer';
import { WHATSAPP_LINK, GOOGLE_MAPS_URL } from '../lib/constants';
import { MapPin, Clock, Store, Package } from 'lucide-react';
import SupplierLeadModal from '../components/suppliers/SupplierLeadModal';

const PRIMARY = '#b8864a';
const API_BASE = import.meta.env.VITE_API_URL?.trim() || '/api';

const CATEGORY_OPTIONS = [
  { value: '', label: 'All Categories' },
  { value: 'furniture', label: 'Furniture' },
  { value: 'stone', label: 'Stone & Marble' },
  { value: 'lighting', label: 'Lighting' },
  { value: 'plants', label: 'Plants & Landscaping' },
  { value: 'flooring', label: 'Flooring' },
  { value: 'kitchen', label: 'Kitchen & Bath' },
  { value: 'curtains', label: 'Curtains & Textiles' },
  { value: 'paint', label: 'Paint & Coatings' },
  { value: 'hardware', label: 'Hardware & Fittings' },
  { value: 'other', label: 'Other' },
];

interface Supplier {
  id: number;
  company_name: string;
  slug: string;
  description: string;
  logo_url: string | null;
  cover_image_url: string | null;
  origin: 'china' | 'dubai';
  categories: string[] | string | null;
  has_physical_store: number;
  store_address: string | null;
  google_maps_url: string | null;
  contact_phone: string | null;
}

export default function MaterialsPage() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [originFilter, setOriginFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [leadModalOpen, setLeadModalOpen] = useState(false);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (originFilter) params.set('origin', originFilter);
    if (categoryFilter) params.set('category', categoryFilter);
    params.set('limit', '50');

    fetch(`${API_BASE}/suppliers?${params}`)
      .then(r => r.json())
      .then(data => setSuppliers(data.suppliers || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [originFilter, categoryFilter]);

  const parseCategories = (cats: string[] | string | null): string[] => {
    if (!cats) return [];
    if (Array.isArray(cats)) return cats;
    try { return JSON.parse(cats); } catch { return []; }
  };

  const scrollToSuppliers = () => {
    document.getElementById('suppliers')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div className="min-h-screen bg-[#faf9f7]">
      <Helmet>
        <title>Showrooms & Suppliers - Tarmeer UAE</title>
        <meta name="description" content="Visit Tarmeer's showroom in Sharjah and discover trusted building material suppliers from China and Dubai for your renovation project." />
        <meta property="og:title" content="Showrooms & Suppliers - Tarmeer UAE" />
        <meta property="og:description" content="Explore Tarmeer's Sharjah showroom and trusted suppliers for premium building materials." />
        <meta property="og:image" content="https://www.tarmeer.com/images/tarmeer_logo.svg" />
        <meta property="og:url" content="https://www.tarmeer.com/materials" />
        <meta property="og:type" content="website" />
        <meta name="robots" content="index, follow" />
        <link rel="canonical" href="https://www.tarmeer.com/materials" />
      </Helmet>

      {/* Hero */}
      <section className="relative h-[420px] sm:h-[500px] flex items-center overflow-hidden">
        <div className="absolute inset-0 z-0">
          <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/40 to-transparent z-10" />
          <img src="https://images.unsplash.com/photo-1618221195710-dd6b41faaea6?w=1600&q=80" alt="" className="w-full h-full object-cover" />
        </div>
        <div className="relative z-20 max-w-6xl mx-auto px-4 sm:px-6 lg:px-10 w-full">
          <div className="max-w-2xl">
            <span className="inline-block px-3 py-1 rounded text-[10px] font-bold uppercase tracking-widest text-white mb-5" style={{ backgroundColor: PRIMARY }}>
              Showroom & Suppliers
            </span>
            <h1 className="font-serif text-3xl sm:text-4xl lg:text-5xl font-bold text-white leading-tight mb-5 tracking-tight">
              Premium Materials,<br />
              <span className="italic font-light" style={{ color: PRIMARY }}>Trusted Suppliers.</span>
            </h1>
            <p className="text-lg text-slate-200 mb-8 leading-relaxed font-light">
              Visit our Sharjah showroom and discover building material suppliers from China and Dubai.
            </p>
            <button type="button" onClick={scrollToSuppliers}
              className="inline-flex items-center gap-2 px-7 py-3.5 rounded-lg font-bold text-white shadow-xl transition-transform hover:scale-105"
              style={{ backgroundColor: PRIMARY }}>
              Browse Suppliers
            </button>
          </div>
        </div>
      </section>

      <PageContainer className="py-10 sm:py-14">
        {/* Showroom Location */}
        <section className="mb-12">
          <h2 className="font-serif text-2xl font-bold text-[#2c2c2c] mb-5">Our Showroom — Sharjah</h2>
          <div className="rounded-2xl overflow-hidden border border-stone-200 bg-white shadow-sm">
            <div className="w-full bg-stone-100">
              <img src="/images/showroom-sharjah-panorama.jpg" alt="Tarmeer showroom Sharjah" className="w-full h-auto object-contain"
                onError={(e) => { (e.target as HTMLImageElement).src = '/images/materials-banner.jpg'; }} />
            </div>
            <div className="p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="flex items-center gap-6 text-sm text-[#6b6b6b]">
                <span className="flex items-center gap-2"><MapPin className="w-4 h-4" style={{ color: PRIMARY }} /> Industrial Area 2, Sharjah</span>
                <span className="flex items-center gap-2"><Clock className="w-4 h-4" style={{ color: PRIMARY }} /> 9 AM – 8 PM (Sat–Thu)</span>
              </div>
              <a href={GOOGLE_MAPS_URL} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl border border-stone-200 bg-stone-50 text-[#2c2c2c] text-sm font-semibold hover:bg-[#b8864a]/10 transition">
                <MapPin className="w-4 h-4" /> View on Map
              </a>
            </div>
          </div>
        </section>

        {/* Suppliers Section */}
        <section id="suppliers">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
            <div>
              <h2 className="font-serif text-2xl font-bold text-[#2c2c2c]">Trusted Suppliers</h2>
              {!loading && suppliers.length > 0 && (
                <p className="text-sm text-stone-500 mt-1">{suppliers.length} verified suppliers across China and Dubai</p>
              )}
            </div>
            <div className="flex items-center gap-3">
              <div className="flex gap-1.5 bg-stone-100 rounded-full p-1">
                {[
                  { value: '', label: 'All' },
                  { value: 'china', label: '🇨🇳 China' },
                  { value: 'dubai', label: '🇦🇪 Dubai' },
                ].map(opt => (
                  <button key={opt.value} onClick={() => setOriginFilter(opt.value)}
                    className={`px-4 py-1.5 rounded-full text-xs font-medium transition ${
                      originFilter === opt.value
                        ? 'bg-white text-[#2c2c2c] shadow-sm'
                        : 'text-stone-500 hover:text-stone-700'
                    }`}>
                    {opt.label}
                  </button>
                ))}
              </div>
              <select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)}
                className="h-8 px-3 rounded-lg border border-stone-200 bg-white text-xs text-stone-600 focus:outline-none focus:ring-1 focus:ring-[#b8864a]/30">
                {CATEGORY_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
          </div>

          {loading ? (
            <div className="py-20 text-center text-stone-400">Loading suppliers...</div>
          ) : suppliers.length === 0 ? (
            <div className="py-16 text-center">
              <Package className="w-10 h-10 text-stone-300 mx-auto mb-3" />
              <p className="text-stone-500 text-[15px]">No suppliers found.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {suppliers.map(s => {
                const cats = parseCategories(s.categories);
                return (
                  <Link key={s.id} to={`/materials/suppliers/${s.slug}`}
                    className="group bg-white rounded-2xl border border-stone-200 overflow-hidden hover:border-[#b8864a]/30 hover:shadow-lg transition-all duration-300">
                    {/* Cover image */}
                    <div className="relative h-44 overflow-hidden">
                      <img
                        src={s.cover_image_url || 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=800&q=80'}
                        alt={s.company_name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />
                      {/* Origin badge */}
                      <span className={`absolute top-3 right-3 text-[10px] font-bold px-2.5 py-1 rounded-full backdrop-blur-sm ${
                        s.origin === 'china'
                          ? 'bg-red-500/90 text-white'
                          : 'bg-emerald-500/90 text-white'
                      }`}>
                        {s.origin === 'china' ? '🇨🇳 China' : '🇦🇪 Dubai'}
                      </span>
                      {/* Store badge */}
                      {s.has_physical_store ? (
                        <span className="absolute top-3 left-3 text-[10px] font-semibold px-2.5 py-1 rounded-full bg-white/90 text-blue-600 backdrop-blur-sm flex items-center gap-1">
                          <Store className="w-3 h-3" /> Showroom
                        </span>
                      ) : null}
                      {/* Logo overlay */}
                      {s.logo_url && (
                        <div className="absolute bottom-3 left-3 w-10 h-10 rounded-lg bg-white shadow-md flex items-center justify-center p-1 overflow-hidden">
                          <img src={s.logo_url} alt="" className="w-full h-full object-contain"
                            onError={(e) => { (e.target as HTMLImageElement).parentElement!.style.display = 'none'; }} />
                        </div>
                      )}
                    </div>
                    <div className="p-4">
                      <h3 className="text-[15px] font-bold text-[#2c2c2c] group-hover:text-[#b8864a] transition mb-1">{s.company_name}</h3>
                      {s.description && (
                        <p className="text-[12px] text-stone-500 line-clamp-2 mb-3 leading-relaxed">{s.description}</p>
                      )}
                      <div className="flex flex-wrap gap-1.5">
                        {cats.slice(0, 3).map(c => (
                          <span key={c} className="text-[10px] px-2.5 py-0.5 rounded-full border border-stone-200 text-stone-500 capitalize">{c}</span>
                        ))}
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </section>

        {/* Supplier CTA */}
        <section className="mt-14">
          <div className="rounded-2xl p-8 sm:p-10 text-white text-center" style={{ backgroundColor: PRIMARY }}>
            <h2 className="text-2xl sm:text-3xl font-bold mb-3">Are you a supplier?</h2>
            <p className="text-white/80 text-[15px] mb-6 max-w-lg mx-auto">
              Join Tarmeer's supplier network to showcase your products to thousands of homeowners and renovation companies in the UAE.
            </p>
            <button type="button" onClick={() => setLeadModalOpen(true)}
              className="inline-flex items-center gap-2 bg-white text-[#b8864a] font-bold px-8 py-3.5 rounded-xl hover:bg-stone-50 transition shadow-lg">
              Apply to Join
            </button>
          </div>
        </section>

        {/* WhatsApp CTA */}
        <section className="mt-10">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-6 rounded-2xl border border-stone-200 bg-white p-6 sm:p-8">
            <div>
              <h3 className="text-lg font-bold text-[#2c2c2c]">Ready to start your project?</h3>
              <p className="text-sm text-stone-500 mt-1">Visit our showroom or contact us for a consultation.</p>
            </div>
            <a href={WHATSAPP_LINK} target="_blank" rel="noopener noreferrer"
              className="shrink-0 inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-[#1c1917] text-white font-bold hover:bg-stone-800 transition">
              Contact Us
            </a>
          </div>
        </section>
      </PageContainer>

      <SupplierLeadModal open={leadModalOpen} onClose={() => setLeadModalOpen(false)} />
    </div>
  );
}
