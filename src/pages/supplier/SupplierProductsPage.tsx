import { useState, useEffect, useRef } from 'react';
import { Helmet } from 'react-helmet-async';
import { Plus, Trash2, ImagePlus, X } from 'lucide-react';
import AdminSelect from '../../components/ui/AdminSelect';

const API_BASE = import.meta.env.VITE_API_URL?.trim() || '/api';
function getToken() { return localStorage.getItem('supplier_token'); }
function authHeaders() { return { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` }; }

const CATEGORY_OPTIONS = [
  { value: '', label: 'No category' },
  { value: 'furniture', label: 'Furniture' },
  { value: 'stone', label: 'Stone' },
  { value: 'lighting', label: 'Lighting' },
  { value: 'plants', label: 'Plants' },
  { value: 'flooring', label: 'Flooring' },
  { value: 'kitchen', label: 'Kitchen' },
  { value: 'curtains', label: 'Curtains' },
  { value: 'paint', label: 'Paint' },
  { value: 'hardware', label: 'Hardware' },
  { value: 'other', label: 'Other' },
];

const inputCls = 'w-full h-[50px] px-5 rounded-2xl border border-stone-200 bg-stone-50/80 text-[15px] text-[#1c1917] placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-[#B8864A]/15 focus:border-[#B8864A] focus:bg-white transition';
const labelCls = 'block text-sm font-medium text-stone-500 mb-1.5';

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function SupplierProductsPage() {
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);

  // new product form
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newCat, setNewCat] = useState('');
  const [newImagePreview, setNewImagePreview] = useState<string>('');
  const [newImageData, setNewImageData] = useState<string>(''); // base64 data url
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch(`${API_BASE}/suppliers/me/profile`, { headers: authHeaders() as any })
      .then(r => r.json())
      .then(data => {
        const slug = data.profile?.slug;
        if (!slug) { setLoading(false); return; }
        return fetch(`${API_BASE}/suppliers/detail/${slug}/products`).then(r => r.json());
      })
      .then(data => { if (data?.products) setProducts(data.products); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const dataUrl = await fileToDataUrl(file);
    setNewImageData(dataUrl);
    setNewImagePreview(dataUrl);
    e.target.value = '';
  };

  const handleAdd = async () => {
    if (!newImageData && !newImagePreview) { setMsg('Please select an image.'); return; }
    setSaving(true);
    setMsg('');
    try {
      const res = await fetch(`${API_BASE}/suppliers/me/products`, {
        method: 'POST',
        headers: authHeaders() as any,
        body: JSON.stringify({
          title: newTitle || null,
          description: newDesc || null,
          category: newCat || null,
          image_url: newImageData,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setProducts(prev => [...prev, data.product]);
      setNewTitle(''); setNewDesc(''); setNewCat(''); setNewImageData(''); setNewImagePreview('');
      setAdding(false);
    } catch (err: any) {
      setMsg(err.message || 'Failed.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    await fetch(`${API_BASE}/suppliers/me/products/${id}`, { method: 'DELETE', headers: authHeaders() as any });
    setProducts(prev => prev.filter(p => p.id !== id));
  };

  if (loading) return (
    <div className="flex items-center justify-center py-20">
      <div className="w-8 h-8 border-2 border-[#b8864a]/30 border-t-[#b8864a] rounded-full animate-spin" />
    </div>
  );

  return (
    <>
      <Helmet><title>Products — Supplier Dashboard | Tarmeer</title></Helmet>

      <div className="max-w-4xl space-y-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-[#2c2c2c]">Products</h1>
            <p className="text-sm text-stone-500 mt-1">{products.length} product{products.length !== 1 ? 's' : ''} uploaded</p>
          </div>
          {!adding && (
            <button
              onClick={() => setAdding(true)}
              className="btn-primary flex items-center gap-2"
            >
              <Plus className="w-4 h-4" /> Add Product
            </button>
          )}
        </div>

        {/* Add product form */}
        {adding && (
          <div className="bg-white rounded-2xl border border-stone-200 p-5 sm:p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-[15px] font-semibold text-[#2c2c2c]">New Product</h2>
              <button onClick={() => { setAdding(false); setMsg(''); }} className="text-stone-400 hover:text-stone-600 transition p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Image picker */}
            <div>
              <label className={labelCls}>Product Image *</label>
              {newImagePreview ? (
                <div className="relative w-40">
                  <img src={newImagePreview} alt="" className="w-40 h-32 object-cover rounded-2xl border border-stone-200" />
                  <button
                    onClick={() => { setNewImageData(''); setNewImagePreview(''); }}
                    className="absolute top-1.5 right-1.5 w-6 h-6 bg-red-500 rounded-full flex items-center justify-center text-white"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="flex flex-col items-center justify-center gap-2 w-full h-32 rounded-2xl border-2 border-dashed border-stone-200 bg-stone-50 text-stone-400 hover:border-[#b8864a]/40 hover:text-[#b8864a] transition text-sm"
                >
                  <ImagePlus className="w-6 h-6" />
                  Click to upload image
                </button>
              )}
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFileSelect} />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>Title</label>
                <input
                  type="text"
                  value={newTitle}
                  onChange={e => setNewTitle(e.target.value)}
                  placeholder="Product name"
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls}>Category</label>
                <AdminSelect
                  options={CATEGORY_OPTIONS}
                  value={newCat}
                  onChange={setNewCat}
                />
              </div>
              <div className="sm:col-span-2">
                <label className={labelCls}>Description</label>
                <textarea
                  value={newDesc}
                  onChange={e => setNewDesc(e.target.value)}
                  rows={3}
                  placeholder="Brief description"
                  className="w-full px-5 py-3 rounded-2xl border border-stone-200 bg-stone-50/80 text-[15px] text-[#1c1917] placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-[#B8864A]/15 focus:border-[#B8864A] focus:bg-white transition resize-none"
                />
              </div>
            </div>

            {msg && <p className="text-sm text-red-600 bg-red-50 px-4 py-2 rounded-2xl">{msg}</p>}

            <div className="flex gap-3">
              <button
                onClick={handleAdd}
                disabled={saving}
                className="btn-primary flex items-center gap-2 disabled:opacity-50"
              >
                <Plus className="w-4 h-4" />
                {saving ? 'Saving...' : 'Add Product'}
              </button>
              <button
                onClick={() => { setAdding(false); setMsg(''); }}
                className="h-11 px-5 rounded-2xl border border-stone-200 text-[15px] text-stone-600 hover:bg-stone-50 transition"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Products grid */}
        {products.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {products.map(p => (
              <div key={p.id} className="group relative bg-white rounded-2xl border border-stone-200 overflow-hidden">
                <div className="aspect-[4/3] bg-stone-100">
                  <img src={p.image_url} alt={p.title || ''} className="w-full h-full object-cover" />
                </div>
                <div className="p-3">
                  {p.category && (
                    <p className="text-[10px] font-semibold text-[#b8864a] uppercase tracking-wider mb-0.5">{p.category}</p>
                  )}
                  <p className="text-sm font-medium text-[#2c2c2c] line-clamp-1">{p.title || 'Untitled'}</p>
                  {p.description && (
                    <p className="text-xs text-stone-500 line-clamp-2 mt-0.5">{p.description}</p>
                  )}
                </div>
                <button
                  onClick={() => handleDelete(p.id)}
                  className="absolute top-2 right-2 w-7 h-7 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition"
                  aria-label="Delete"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        ) : !adding ? (
          <div className="bg-white rounded-2xl border border-stone-200 flex flex-col items-center justify-center py-20 text-center">
            <div className="w-16 h-16 rounded-2xl bg-stone-100 flex items-center justify-center mb-4">
              <ImagePlus className="w-8 h-8 text-stone-300" />
            </div>
            <h3 className="text-[15px] font-semibold text-[#2c2c2c] mb-2">No products yet</h3>
            <p className="text-sm text-stone-500 mb-5">Add your first product to showcase your materials.</p>
            <button onClick={() => setAdding(true)} className="btn-primary flex items-center gap-2">
              <Plus className="w-4 h-4" /> Add Product
            </button>
          </div>
        ) : null}
      </div>
    </>
  );
}
