import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { LogOut, Save, Plus, Trash2, FileText, Upload, ExternalLink } from 'lucide-react';
import TarmeerLogo from '../../components/TarmeerLogo';

const API_BASE = import.meta.env.VITE_API_URL?.trim() || '/api';

function getToken() { return localStorage.getItem('supplier_token'); }
function authHeaders() { return { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` }; }

const CATEGORY_OPTIONS = ['furniture', 'stone', 'lighting', 'plants', 'flooring', 'kitchen', 'curtains', 'paint', 'hardware', 'other'];

export default function SupplierDashboardPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  // Profile fields
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
  const [slug, setSlug] = useState('');
  const [status, setStatus] = useState('');

  // Products
  const [products, setProducts] = useState<any[]>([]);
  const [newProductUrl, setNewProductUrl] = useState('');
  const [newProductTitle, setNewProductTitle] = useState('');

  // Catalogs
  const [catalogs, setCatalogs] = useState<any[]>([]);
  const [newCatalogUrl, setNewCatalogUrl] = useState('');
  const [newCatalogTitle, setNewCatalogTitle] = useState('');

  useEffect(() => {
    if (!getToken()) { navigate('/supplier/auth', { replace: true }); return; }
    // Load profile
    fetch(`${API_BASE}/suppliers/me/profile`, { headers: authHeaders() })
      .then(r => { if (r.status === 401) { navigate('/supplier/auth'); return null; } return r.json(); })
      .then(data => {
        if (!data) return;
        const p = data.profile;
        if (p) {
          setCompanyName(p.company_name || '');
          setDescription(p.description || '');
          setOrigin(p.origin || 'china');
          const cats = typeof p.categories === 'string' ? JSON.parse(p.categories || '[]') : (p.categories || []);
          setCategories(cats);
          setHasStore(!!p.has_physical_store);
          setStoreAddress(p.store_address || '');
          setGoogleMapsUrl(p.google_maps_url || '');
          setContactPhone(p.contact_phone || '');
          setWhatsapp(p.whatsapp || '');
          setWebsite(p.website || '');
          setSlug(p.slug || '');
          setStatus(p.status || '');

          // Load products & catalogs
          if (p.slug) {
            fetch(`${API_BASE}/suppliers/detail/${p.slug}`).then(r => r.json()).then(d => {
              setProducts(d.products || []);
              setCatalogs(d.catalogs || []);
            }).catch(() => {});
          }
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [navigate]);

  const handleSaveProfile = async () => {
    setSaving(true);
    setMsg('');
    try {
      const res = await fetch(`${API_BASE}/suppliers/me/profile`, {
        method: 'POST',
        headers: authHeaders(),
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
      if (data.profile?.slug) setSlug(data.profile.slug);
      if (data.profile?.status) setStatus(data.profile.status);
      setMsg('Profile saved!');
    } catch (err: any) {
      setMsg(err.message || 'Failed to save.');
    } finally {
      setSaving(false);
    }
  };

  const handleAddProduct = async () => {
    if (!newProductUrl) return;
    try {
      const res = await fetch(`${API_BASE}/suppliers/me/products`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ image_url: newProductUrl, title: newProductTitle || null }),
      });
      const data = await res.json();
      if (res.ok) {
        setProducts(prev => [...prev, data.product]);
        setNewProductUrl('');
        setNewProductTitle('');
      }
    } catch {}
  };

  const handleDeleteProduct = async (id: number) => {
    await fetch(`${API_BASE}/suppliers/me/products/${id}`, { method: 'DELETE', headers: authHeaders() });
    setProducts(prev => prev.filter(p => p.id !== id));
  };

  const handleAddCatalog = async () => {
    if (!newCatalogUrl || !newCatalogTitle) return;
    try {
      const res = await fetch(`${API_BASE}/suppliers/me/catalogs`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ file_url: newCatalogUrl, title: newCatalogTitle }),
      });
      const data = await res.json();
      if (res.ok) {
        setCatalogs(prev => [...prev, data.catalog]);
        setNewCatalogUrl('');
        setNewCatalogTitle('');
      }
    } catch {}
  };

  const handleDeleteCatalog = async (id: number) => {
    await fetch(`${API_BASE}/suppliers/me/catalogs/${id}`, { method: 'DELETE', headers: authHeaders() });
    setCatalogs(prev => prev.filter(c => c.id !== id));
  };

  const handleLogout = () => {
    localStorage.removeItem('supplier_token');
    localStorage.removeItem('supplier_user');
    navigate('/supplier/auth');
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center text-stone-400">Loading...</div>;

  const inputClass = 'w-full h-11 px-4 rounded-xl border border-stone-200 bg-stone-50/80 text-[15px] text-[#1c1917] placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-[#b8864a]/15 focus:border-[#b8864a] transition';
  const labelClass = 'block text-xs font-medium text-stone-500 uppercase tracking-wider mb-1.5';

  return (
    <div className="min-h-screen bg-[#faf9f7]">
      <Helmet><title>Supplier Dashboard - Tarmeer</title></Helmet>

      {/* Top bar */}
      <header className="bg-white border-b border-stone-200 sticky top-0 z-30">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <TarmeerLogo className="h-6" />
          <div className="flex items-center gap-4">
            {slug && status === 'approved' && (
              <a href={`/materials/suppliers/${slug}`} target="_blank" rel="noopener noreferrer"
                className="text-xs text-[#b8864a] hover:underline flex items-center gap-1">
                View Public Page <ExternalLink className="w-3 h-3" />
              </a>
            )}
            {status && (
              <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full ${
                status === 'approved' ? 'bg-emerald-50 text-emerald-600' :
                status === 'rejected' ? 'bg-red-50 text-red-600' : 'bg-amber-50 text-amber-600'
              }`}>{status}</span>
            )}
            <button onClick={handleLogout} className="text-stone-400 hover:text-stone-600 transition">
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 space-y-8">
        {/* Profile */}
        <section className="bg-white rounded-2xl border border-stone-200 p-6 space-y-4">
          <h2 className="text-lg font-bold text-[#2c2c2c]">Company Profile</h2>

          <div>
            <label className={labelClass}>Company Name *</label>
            <input type="text" value={companyName} onChange={e => setCompanyName(e.target.value)} placeholder="Your company name" className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Description</label>
            <textarea value={description} onChange={e => setDescription(e.target.value)} rows={4} placeholder="About your company..."
              className="w-full px-4 py-3 rounded-xl border border-stone-200 bg-stone-50/80 text-[15px] text-[#1c1917] placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-[#b8864a]/15 focus:border-[#b8864a] transition resize-none" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Origin</label>
              <div className="flex gap-2">
                {(['china', 'dubai'] as const).map(o => (
                  <button key={o} type="button" onClick={() => setOrigin(o)}
                    className={`flex-1 h-10 rounded-xl text-sm font-medium transition ${
                      origin === o ? 'bg-[#b8864a] text-white' : 'border border-stone-200 text-stone-600 hover:bg-stone-50'
                    }`}>
                    {o === 'china' ? '🇨🇳 China' : '🇦🇪 Dubai'}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className={labelClass}>Contact Phone</label>
              <input type="tel" value={contactPhone} onChange={e => setContactPhone(e.target.value)} placeholder="+971..." className={inputClass} />
            </div>
          </div>
          <div>
            <label className={labelClass}>Categories</label>
            <div className="flex flex-wrap gap-2">
              {CATEGORY_OPTIONS.map(c => (
                <button key={c} type="button"
                  onClick={() => setCategories(prev => prev.includes(c) ? prev.filter(x => x !== c) : [...prev, c])}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition ${
                    categories.includes(c) ? 'bg-[#b8864a] text-white' : 'border border-stone-200 text-stone-600 hover:bg-stone-50'
                  }`}>
                  {c}
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <input type="checkbox" checked={hasStore} onChange={e => setHasStore(e.target.checked)} id="hasStore" className="rounded" />
            <label htmlFor="hasStore" className="text-sm text-stone-600">We have a physical store</label>
          </div>
          {hasStore && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>Store Address</label>
                <input type="text" value={storeAddress} onChange={e => setStoreAddress(e.target.value)} placeholder="Address" className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Google Maps URL</label>
                <input type="url" value={googleMapsUrl} onChange={e => setGoogleMapsUrl(e.target.value)} placeholder="https://maps.google.com/..." className={inputClass} />
              </div>
            </div>
          )}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>WhatsApp</label>
              <input type="text" value={whatsapp} onChange={e => setWhatsapp(e.target.value)} placeholder="+971..." className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Website</label>
              <input type="url" value={website} onChange={e => setWebsite(e.target.value)} placeholder="https://..." className={inputClass} />
            </div>
          </div>

          {msg && <p className={`text-sm px-3 py-2 rounded-lg ${msg.includes('saved') ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'}`}>{msg}</p>}

          <button onClick={handleSaveProfile} disabled={saving || !companyName}
            className="flex items-center gap-2 h-11 px-6 rounded-xl bg-[#b8864a] text-white font-semibold text-sm hover:bg-[#a67c47] disabled:opacity-50 transition">
            <Save className="w-4 h-4" /> {saving ? 'Saving...' : 'Save Profile'}
          </button>
        </section>

        {/* Products */}
        <section className="bg-white rounded-2xl border border-stone-200 p-6 space-y-4">
          <h2 className="text-lg font-bold text-[#2c2c2c]">Products</h2>
          {products.length > 0 && (
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
              {products.map(p => (
                <div key={p.id} className="relative group">
                  <div className="aspect-[4/3] rounded-lg overflow-hidden bg-stone-100 border border-stone-200">
                    <img src={p.image_url} alt={p.title || ''} className="w-full h-full object-cover" />
                  </div>
                  {p.title && <p className="text-[11px] text-stone-600 mt-1 truncate">{p.title}</p>}
                  <button onClick={() => handleDeleteProduct(p.id)}
                    className="absolute top-1 right-1 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition">
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
          <div className="flex gap-2">
            <input type="text" value={newProductTitle} onChange={e => setNewProductTitle(e.target.value)} placeholder="Title (optional)"
              className="flex-1 h-10 px-3 rounded-lg border border-stone-200 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-[#b8864a]/30" />
            <input type="url" value={newProductUrl} onChange={e => setNewProductUrl(e.target.value)} placeholder="Image URL"
              className="flex-[2] h-10 px-3 rounded-lg border border-stone-200 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-[#b8864a]/30" />
            <button onClick={handleAddProduct} disabled={!newProductUrl}
              className="h-10 px-4 rounded-lg bg-[#b8864a] text-white text-sm font-medium hover:bg-[#a67c47] disabled:opacity-50 transition flex items-center gap-1">
              <Plus className="w-4 h-4" /> Add
            </button>
          </div>
        </section>

        {/* Catalogs */}
        <section className="bg-white rounded-2xl border border-stone-200 p-6 space-y-4">
          <h2 className="text-lg font-bold text-[#2c2c2c]">Catalogs & Brochures (PDF)</h2>
          {catalogs.length > 0 && (
            <div className="space-y-2">
              {catalogs.map(c => (
                <div key={c.id} className="flex items-center gap-3 p-3 rounded-lg bg-stone-50 border border-stone-100">
                  <FileText className="w-5 h-5 text-red-500 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-[#2c2c2c] truncate">{c.title}</p>
                    <a href={c.file_url} target="_blank" rel="noopener noreferrer" className="text-[11px] text-[#b8864a] hover:underline truncate block">{c.file_url}</a>
                  </div>
                  <button onClick={() => handleDeleteCatalog(c.id)} className="text-red-400 hover:text-red-600 transition">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
          <div className="flex gap-2">
            <input type="text" value={newCatalogTitle} onChange={e => setNewCatalogTitle(e.target.value)} placeholder="Catalog title"
              className="flex-1 h-10 px-3 rounded-lg border border-stone-200 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-[#b8864a]/30" />
            <input type="url" value={newCatalogUrl} onChange={e => setNewCatalogUrl(e.target.value)} placeholder="PDF URL"
              className="flex-[2] h-10 px-3 rounded-lg border border-stone-200 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-[#b8864a]/30" />
            <button onClick={handleAddCatalog} disabled={!newCatalogUrl || !newCatalogTitle}
              className="h-10 px-4 rounded-lg bg-[#b8864a] text-white text-sm font-medium hover:bg-[#a67c47] disabled:opacity-50 transition flex items-center gap-1">
              <Upload className="w-4 h-4" /> Add
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}
