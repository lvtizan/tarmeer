import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { GOOGLE_MAPS_URL } from '../lib/constants'; // used in showroom infobox (Task 2)
import { MapPin, Clock, Store, Package } from 'lucide-react';
import SupplierLeadModal from '../components/suppliers/SupplierLeadModal';

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

function parseCategories(c: Supplier['categories']): string[] {
  if (!c) return [];
  if (Array.isArray(c)) return c;
  try { const p = JSON.parse(c); return Array.isArray(p) ? p : [c]; } catch { return [c]; }
}

function SupplierCard({ s }: { s: Supplier }) {
  const cats = parseCategories(s.categories);
  return (
    <Link
      to={`/materials/suppliers/${s.slug}`}
      className="group flex border-b border-stone-200/60 hover:bg-[#faf8f5] transition-colors duration-150 py-5 gap-5"
    >
      {/* Cover image */}
      <div className="w-[220px] sm:w-[280px] h-[160px] sm:h-[180px] flex-shrink-0 overflow-hidden rounded-2xl bg-stone-100">
        <img
          src={s.cover_image_url || 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=800&q=80'}
          alt={s.company_name}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
        />
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0 flex flex-col justify-between py-1">
        <div>
          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
            <h3 className="text-[17px] font-semibold text-[#1c1917] group-hover:text-[#b8864a] transition-colors">
              {s.company_name}
            </h3>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
              s.origin === 'china'
                ? 'bg-red-50 text-red-600'
                : 'bg-emerald-50 text-emerald-700'
            }`}>
              {s.origin === 'china' ? '🇨🇳 China' : '🇦🇪 Dubai'}
            </span>
            {s.has_physical_store ? (
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 flex items-center gap-1">
                <Store className="w-3 h-3" /> Showroom
              </span>
            ) : null}
          </div>
          {s.description && (
            <p className="text-stone-500 text-[13px] leading-relaxed line-clamp-2 mb-2.5">
              {s.description}
            </p>
          )}
          <div className="flex flex-wrap gap-1.5">
            {cats.slice(0, 4).map(c => (
              <span key={c} className="px-2.5 py-0.5 text-[11px] text-stone-500 border border-stone-200 rounded-2xl capitalize">
                {c}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* CTA */}
      <div className="hidden sm:flex flex-col items-center justify-center flex-shrink-0 w-[140px] pl-4 border-l border-stone-100">
        <span className="w-full flex items-center justify-center px-4 py-2.5 rounded-2xl border border-[#b8864a] text-[#b8864a] font-semibold text-sm group-hover:bg-[#b8864a] group-hover:text-white transition-colors duration-200">
          View Profile
        </span>
      </div>
    </Link>
  );
}

function FilterOption({
  selected, onClick, children,
}: { selected: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`w-full text-left px-3 py-2 rounded-xl text-sm transition-all ${
        selected
          ? 'bg-[#f5f0e8] border border-[#d4c4a8] text-[#1c1917]'
          : 'text-stone-500 hover:bg-stone-50'
      }`}
    >
      <div className="flex items-center gap-3">
        <div className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 ${
          selected ? 'border-[#b8864a] bg-white' : 'border-stone-300'
        }`}>
          {selected && <span className="w-2 h-2 rounded-sm bg-[#b8864a] block" />}
        </div>
        {children}
      </div>
    </button>
  );
}

export default function ShowroomsPage() {
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

      {/* Header */}
      <section className="relative bg-[#2c2620] overflow-hidden">
        <div className="absolute inset-0 opacity-[0.04] [background-image:radial-gradient(circle_at_1px_1px,rgba(255,255,255,0.8)_1px,transparent_0)] [background-size:32px_32px]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_0%,rgba(184,134,74,0.12),transparent_70%)]" />
        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 py-12 sm:py-16 flex items-center justify-between">
          <div>
            <h1 className="font-serif text-[28px] sm:text-[36px] text-white font-medium leading-tight mb-2">
              Find Premium Material Suppliers in UAE
            </h1>
            <p className="text-white/60 text-[15px]">
              Verified suppliers from China and Dubai — furniture, stone, lighting, and more.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setLeadModalOpen(true)}
            className="shrink-0 hidden sm:inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-[#b8864a] hover:bg-[#a67c47] text-white font-semibold text-sm transition"
          >
            Apply to Join
          </button>
        </div>
      </section>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 flex gap-8 items-start">
        {/* Left Sidebar */}
        <aside className="w-60 flex-shrink-0 hidden lg:block">
          <div className="lg:sticky lg:top-24">
            <div className="bg-white rounded-2xl border border-stone-200 shadow-sm p-5 space-y-6">
              {/* Origin */}
              <div>
                <h4 className="text-xs font-medium text-[#1c1917] uppercase tracking-wider mb-3">Origin</h4>
                <div className="space-y-1">
                  <FilterOption selected={originFilter === ''} onClick={() => setOriginFilter('')}>All Origins</FilterOption>
                  <FilterOption selected={originFilter === 'china'} onClick={() => setOriginFilter('china')}>🇨🇳 China</FilterOption>
                  <FilterOption selected={originFilter === 'dubai'} onClick={() => setOriginFilter('dubai')}>🇦🇪 Dubai</FilterOption>
                </div>
              </div>

              <hr className="border-stone-100" />

              {/* Category */}
              <div>
                <h4 className="text-xs font-medium text-[#1c1917] uppercase tracking-wider mb-3">Category</h4>
                <div className="space-y-1">
                  {CATEGORY_OPTIONS.map(opt => (
                    <FilterOption
                      key={opt.value}
                      selected={categoryFilter === opt.value}
                      onClick={() => setCategoryFilter(opt.value)}
                    >
                      {opt.label}
                    </FilterOption>
                  ))}
                </div>
              </div>
            </div>

            {/* Showroom Infobox */}
            <div className="mt-4 bg-white rounded-2xl border border-stone-200 shadow-sm p-4 space-y-3">
              <h4 className="text-xs font-medium text-[#1c1917] uppercase tracking-wider">Our Showroom</h4>
              <div className="space-y-2 text-xs text-stone-500">
                <span className="flex items-center gap-2">
                  <MapPin className="w-3.5 h-3.5" style={{ color: 'var(--color-tarmeer-primary)' }} />
                  Industrial Area 2, Sharjah
                </span>
                <span className="flex items-center gap-2">
                  <Clock className="w-3.5 h-3.5" style={{ color: 'var(--color-tarmeer-primary)' }} />
                  9 AM – 8 PM (Sat–Thu)
                </span>
              </div>
              <a
                href={GOOGLE_MAPS_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-xs font-medium hover:underline"
                style={{ color: 'var(--color-tarmeer-primary)' }}
              >
                <MapPin className="w-3 h-3" /> View on Map
              </a>
            </div>
          </div>
        </aside>

        {/* Right Content */}
        <div className="flex-1 min-w-0">
          {/* Mobile origin filter */}
          <div className="lg:hidden flex gap-1.5 bg-stone-100 rounded-full p-1 mb-5 w-fit">
            {[
              { value: '', label: 'All' },
              { value: 'china', label: '🇨🇳 China' },
              { value: 'dubai', label: '🇦🇪 Dubai' },
            ].map(opt => (
              <button
                key={opt.value}
                onClick={() => setOriginFilter(opt.value)}
                className={`px-4 py-1.5 rounded-full text-xs font-medium transition ${
                  originFilter === opt.value
                    ? 'bg-white text-[#2c2c2c] shadow-sm'
                    : 'text-stone-500 hover:text-stone-700'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {/* Result count */}
          {!loading && suppliers.length > 0 && (
            <p className="text-sm text-stone-500 mb-4">
              {suppliers.length} verified supplier{suppliers.length !== 1 ? 's' : ''}
              {originFilter && ` · ${originFilter === 'china' ? '🇨🇳 China' : '🇦🇪 Dubai'}`}
              {categoryFilter && ` · ${CATEGORY_OPTIONS.find(o => o.value === categoryFilter)?.label}`}
            </p>
          )}

          {/* List */}
          {loading ? (
            <div className="py-20 text-center text-stone-400">Loading suppliers...</div>
          ) : suppliers.length === 0 ? (
            <div className="py-16 text-center">
              <Package className="w-10 h-10 text-stone-300 mx-auto mb-3" />
              <p className="text-stone-500 text-[15px]">No suppliers found.</p>
            </div>
          ) : (
            <div>
              {suppliers.map(s => (
                <SupplierCard key={s.id} s={s} />
              ))}
            </div>
          )}

          {/* Mobile Apply CTA */}
          <div className="mt-10 sm:hidden">
            <button type="button" onClick={() => setLeadModalOpen(true)} className="btn-primary w-full py-3.5 text-[15px]">
              Apply to Join as Supplier
            </button>
          </div>
        </div>
      </div>

      <SupplierLeadModal open={leadModalOpen} onClose={() => setLeadModalOpen(false)} />
    </div>
  );
}
