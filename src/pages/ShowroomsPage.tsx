import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { GOOGLE_MAPS_URL } from '../lib/constants';
import AdminSelect from '../components/ui/AdminSelect';
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
            {/* Filters — filled in Task 2 */}
            {/* Showroom infobox — filled in Task 2 */}
          </div>
        </aside>

        {/* Right Content */}
        <div className="flex-1 min-w-0">
          {/* Mobile origin filter — filled in Task 3 */}
          {/* Supplier list — filled in Task 3 */}
        </div>
      </div>

      <SupplierLeadModal open={leadModalOpen} onClose={() => setLeadModalOpen(false)} />
    </div>
  );
}
