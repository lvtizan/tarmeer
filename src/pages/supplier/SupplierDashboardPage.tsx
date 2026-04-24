import { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet-async';
import { Save } from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_URL?.trim() || '/api';
function getToken() { return localStorage.getItem('supplier_token'); }
function authHeaders(extra?: Record<string, string>) {
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}`, ...extra };
}

const CATEGORY_OPTIONS = [
  'furniture', 'stone', 'lighting', 'plants', 'flooring',
  'kitchen', 'curtains', 'paint', 'hardware', 'other',
];

const inputCls = 'w-full h-[50px] px-5 rounded-2xl border border-stone-200 bg-stone-50/80 text-[15px] text-[#1c1917] placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-[#B8864A]/15 focus:border-[#B8864A] focus:bg-white transition';
const labelCls = 'block text-sm font-medium text-stone-500 mb-1.5';

export default function SupplierDashboardPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  const [companyName, setCompanyName] = useState('');
  const [description, setDescription] = useState('');
  const [origin, setOrigin] = useState<'china' | 'dubai'>('china');
  const [categories, setCategories] = useState<string[]>([]);
  const [hasStore, setHasStore] = useState(false);
  const [storeAddress, setStoreAddress] = useState('');
  const [googleMapsUrl, setGoogleMapsUrl] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [website, setWebsite] = useState('');

  useEffect(() => {
    fetch(`${API_BASE}/suppliers/me/profile`, { headers: authHeaders() as any })
      .then(r => r.json())
      .then(data => {
        const p = data.profile;
        if (!p) return;
        setCompanyName(p.company_name || '');
        setDescription(p.description || '');
        setOrigin(p.origin || 'china');
        const cats = typeof p.categories === 'string'
          ? JSON.parse(p.categories || '[]') : (p.categories || []);
        setCategories(cats);
        setHasStore(!!p.has_physical_store);
        setStoreAddress(p.store_address || '');
        setGoogleMapsUrl(p.google_maps_url || '');
        setContactPhone(p.contact_phone || '');
        setWhatsapp(p.whatsapp || '');
        setWebsite(p.website || '');
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setMsg('');
    try {
      const res = await fetch(`${API_BASE}/suppliers/me/profile`, {
        method: 'POST',
        headers: authHeaders() as any,
        body: JSON.stringify({
          company_name: companyName,
          description,
          origin,
          categories,
          has_physical_store: hasStore,
          store_address: storeAddress || null,
          google_maps_url: googleMapsUrl || null,
          contact_phone: contactPhone || null,
          whatsapp: whatsapp || null,
          website: website || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setMsg('Profile saved!');
    } catch (err: any) {
      setMsg(err.message || 'Failed to save.');
    } finally {
      setSaving(false);
    }
  };

  const toggleCategory = (c: string) =>
    setCategories(prev => prev.includes(c) ? prev.filter(x => x !== c) : [...prev, c]);

  if (loading) return (
    <div className="flex items-center justify-center py-20">
      <div className="w-8 h-8 border-2 border-[#b8864a]/30 border-t-[#b8864a] rounded-full animate-spin" />
    </div>
  );

  return (
    <>
      <Helmet><title>Profile — Supplier Dashboard | Tarmeer</title></Helmet>

      <div className="max-w-2xl space-y-6">
        <div>
          <h1 className="text-xl font-bold text-[#2c2c2c]">Company Profile</h1>
          <p className="text-sm text-stone-500 mt-1">Fill in your company details. Submitted for admin review after save.</p>
        </div>

        {/* Basic info */}
        <div className="bg-white rounded-2xl border border-stone-200 p-5 sm:p-6 space-y-4">
          <h2 className="text-[15px] font-semibold text-[#2c2c2c]">Basic Information</h2>

          <div>
            <label className={labelCls}>Company Name *</label>
            <input
              type="text"
              value={companyName}
              onChange={e => setCompanyName(e.target.value)}
              placeholder="Your company name"
              className={inputCls}
            />
          </div>

          <div>
            <label className={labelCls}>Description</label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              rows={4}
              placeholder="What does your company specialise in?"
              className="w-full px-5 py-3 rounded-2xl border border-stone-200 bg-stone-50/80 text-[15px] text-[#1c1917] placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-[#B8864A]/15 focus:border-[#B8864A] focus:bg-white transition resize-none"
            />
          </div>

          <div>
            <label className={labelCls}>Origin</label>
            <div className="flex gap-2">
              {(['china', 'dubai'] as const).map(o => (
                <button
                  key={o}
                  type="button"
                  onClick={() => setOrigin(o)}
                  className={`flex-1 h-[50px] rounded-2xl text-[15px] font-medium transition ${
                    origin === o
                      ? 'bg-[#b8864a] text-white'
                      : 'border border-stone-200 text-stone-600 hover:bg-stone-50'
                  }`}
                >
                  {o === 'china' ? '🇨🇳 China' : '🇦🇪 Dubai'}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className={labelCls}>Categories</label>
            <div className="flex flex-wrap gap-2">
              {CATEGORY_OPTIONS.map(c => (
                <button
                  key={c}
                  type="button"
                  onClick={() => toggleCategory(c)}
                  className={`px-3 py-1.5 rounded-2xl text-sm font-medium transition ${
                    categories.includes(c)
                      ? 'bg-[#b8864a] text-white'
                      : 'border border-stone-200 text-stone-600 hover:bg-stone-50'
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Contact */}
        <div className="bg-white rounded-2xl border border-stone-200 p-5 sm:p-6 space-y-4">
          <h2 className="text-[15px] font-semibold text-[#2c2c2c]">Contact</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Contact Phone</label>
              <input
                type="tel"
                value={contactPhone}
                onChange={e => setContactPhone(e.target.value)}
                placeholder="+971..."
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>WhatsApp</label>
              <input
                type="tel"
                value={whatsapp}
                onChange={e => setWhatsapp(e.target.value)}
                placeholder="+971..."
                className={inputCls}
              />
            </div>
            <div className="sm:col-span-2">
              <label className={labelCls}>Website</label>
              <input
                type="url"
                value={website}
                onChange={e => setWebsite(e.target.value)}
                placeholder="https://..."
                className={inputCls}
              />
            </div>
          </div>
        </div>

        {/* Physical store */}
        <div className="bg-white rounded-2xl border border-stone-200 p-5 sm:p-6 space-y-4">
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="hasStore"
              checked={hasStore}
              onChange={e => setHasStore(e.target.checked)}
              className="w-4 h-4 rounded accent-[#b8864a]"
            />
            <label htmlFor="hasStore" className="text-[15px] text-[#2c2c2c] cursor-pointer">
              We have a physical showroom / store
            </label>
          </div>
          {hasStore && (
            <div className="space-y-4">
              <div>
                <label className={labelCls}>Store Address</label>
                <input
                  type="text"
                  value={storeAddress}
                  onChange={e => setStoreAddress(e.target.value)}
                  placeholder="Full address"
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls}>Google Maps URL</label>
                <input
                  type="url"
                  value={googleMapsUrl}
                  onChange={e => setGoogleMapsUrl(e.target.value)}
                  placeholder="https://maps.google.com/..."
                  className={inputCls}
                />
              </div>
            </div>
          )}
        </div>

        {msg && (
          <p className={`text-sm px-4 py-3 rounded-2xl ${
            msg.includes('saved') || msg.includes('!') && !msg.includes('Failed')
              ? 'bg-emerald-50 text-emerald-700'
              : 'bg-red-50 text-red-600'
          }`}>{msg}</p>
        )}

        <button
          onClick={handleSave}
          disabled={saving || !companyName.trim()}
          className="btn-primary flex items-center gap-2 disabled:opacity-50"
        >
          <Save className="w-4 h-4" />
          {saving ? 'Saving...' : 'Save Profile'}
        </button>
      </div>
    </>
  );
}
