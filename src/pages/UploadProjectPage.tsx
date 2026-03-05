import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  LayoutDashboard,
  FolderOpen,
  User,
  MessageCircle,
  Users,
  Search,
  Bell,
  Settings,
  Upload,
  Eye,
  Trash2,
  Plus,
} from 'lucide-react';

const PRIMARY = '#b8864a';

/* Mock products for "Products Used" table */
const MOCK_PRODUCTS = [
  { id: '1', name: 'Nordic Minimalist Sofa Set', category: 'Furniture', supplier: 'Guangzhou Home Co.', thumb: 'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=200&q=80' },
  { id: '2', name: 'Calacatta Gold Marble Slab', category: 'Materials & Surfaces', supplier: 'Foshan Ceramics Ltd.', thumb: 'https://images.unsplash.com/photo-1615873968403-89e068629265?w=200&q=80' },
];

export default function UploadProjectPage() {
  const [products, setProducts] = useState(MOCK_PRODUCTS);
  const [coverIndex, setCoverIndex] = useState(0);
  const [images, setImages] = useState<{ url: string; id: string }[]>([
    { id: '1', url: 'https://images.unsplash.com/photo-1618221195710-dd6b41faaea6?w=600&q=80' },
    { id: '2', url: 'https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?w=600&q=80' },
  ]);

  const removeProduct = (id: string) => setProducts((p) => p.filter((x) => x.id !== id));
  const removeImage = (id: string) => setImages((p) => p.filter((x) => x.id !== id));

  return (
    <div className="min-h-screen flex flex-col bg-[#faf9f7]">
      {/* Dashboard header */}
      <header className="sticky top-0 z-50 border-b border-stone-200 bg-white px-4 md:px-10 py-3 flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-6">
          <Link to="/" className="flex items-center gap-3 text-[#2c2c2c]">
            <div className="size-8 rounded flex items-center justify-center" style={{ backgroundColor: `${PRIMARY}20` }}>
              <LayoutDashboard className="w-5 h-5" style={{ color: PRIMARY }} />
            </div>
            <span className="text-lg font-bold">Tarmeer Dashboard</span>
          </Link>
          <nav className="hidden md:flex items-center gap-6">
            <Link to="/designer/upload" className="text-stone-600 hover:text-[#2c2c2c] text-sm font-medium">
              Dashboard
            </Link>
            <span className="text-[#2c2c2c] text-sm font-bold border-b-2 py-1" style={{ borderColor: PRIMARY }}>
              My Projects
            </span>
            <Link to="/designer/upload" className="text-stone-600 hover:text-[#2c2c2c] text-sm font-medium">
              Messages
            </Link>
          </nav>
        </div>
        <div className="flex items-center gap-4">
          <label className="hidden sm:flex min-w-[160px] max-w-[240px] items-stretch rounded-lg h-10 border border-stone-200 focus-within:ring-2 focus-within:ring-[#b8864a]/40 overflow-hidden">
            <span className="flex items-center justify-center pl-3 text-stone-400">
              <Search className="w-5 h-5" />
            </span>
            <input
              type="search"
              placeholder="Search projects, tags..."
              className="flex-1 min-w-0 h-full px-3 border-0 focus:outline-none focus:ring-0 text-sm"
            />
          </label>
          <button type="button" className="size-10 rounded-full bg-stone-100 hover:bg-stone-200 flex items-center justify-center text-stone-600">
            <Bell className="w-5 h-5" />
          </button>
          <button type="button" className="size-10 rounded-full bg-stone-100 hover:bg-stone-200 flex items-center justify-center text-stone-600">
            <Settings className="w-5 h-5" />
          </button>
          <div
            className="size-10 rounded-full bg-cover bg-center border-2 flex-shrink-0"
            style={{ borderColor: PRIMARY, backgroundImage: 'url(https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100&q=80)' }}
          />
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <aside className="hidden md:flex w-64 flex-col flex-shrink-0 border-r border-stone-200 bg-white overflow-y-auto">
          <div className="p-6">
            <div className="flex gap-3 items-center mb-8">
              <div
                className="size-12 rounded-full bg-cover bg-center flex-shrink-0"
                style={{ backgroundImage: 'url(https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100&q=80)' }}
              />
              <div>
                <h2 className="text-[#2c2c2c] font-bold text-base">Ahmed Khalil</h2>
                <p className="text-stone-500 text-xs">Senior Interior Designer</p>
              </div>
            </div>
            <nav className="flex flex-col gap-1">
              <Link to="/designer/upload" className="flex items-center gap-3 px-4 py-3 rounded-lg text-stone-600 hover:bg-stone-50 transition">
                <LayoutDashboard className="w-5 h-5" />
                <span className="text-sm font-medium">Dashboard</span>
              </Link>
              <Link
                to="/designer/upload"
                className="flex items-center gap-3 px-4 py-3 rounded-lg border-l-4 transition"
                style={{ backgroundColor: `${PRIMARY}15`, borderColor: PRIMARY }}
              >
                <FolderOpen className="w-5 h-5" style={{ color: PRIMARY }} />
                <span className="text-sm font-bold text-[#2c2c2c]">My Projects</span>
              </Link>
              <Link to="/designer/upload" className="flex items-center gap-3 px-4 py-3 rounded-lg text-stone-600 hover:bg-stone-50 transition">
                <User className="w-5 h-5" />
                <span className="text-sm font-medium">Profile</span>
              </Link>
              <Link to="/designer/upload" className="flex items-center gap-3 px-4 py-3 rounded-lg text-stone-600 hover:bg-stone-50 transition">
                <MessageCircle className="w-5 h-5" />
                <span className="text-sm font-medium flex-1">Messages</span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full text-[#2c2c2c]" style={{ backgroundColor: PRIMARY }}>
                  3
                </span>
              </Link>
              <Link to="/designer/upload" className="flex items-center gap-3 px-4 py-3 rounded-lg text-stone-600 hover:bg-stone-50 transition">
                <Users className="w-5 h-5" />
                <span className="text-sm font-medium">Lead Management</span>
              </Link>
            </nav>
          </div>
          <div className="mt-auto p-6">
            <div className="bg-stone-50 rounded-xl p-4 border border-stone-200">
              <h4 className="text-sm font-bold text-[#2c2c2c] mb-2">Need Help?</h4>
              <p className="text-xs text-stone-500 mb-3">Contact your dedicated account manager for supply chain inquiries.</p>
              <button type="button" className="w-full py-2 rounded-lg border border-stone-200 bg-white text-stone-800 text-xs font-bold hover:bg-stone-50 transition">
                Contact Support
              </button>
            </div>
          </div>
        </aside>

        {/* Main content */}
        <main className="flex-1 overflow-y-auto p-6 md:p-10">
          <div className="max-w-4xl mx-auto">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
              <div>
                <h1 className="text-3xl font-bold text-[#2c2c2c] mb-2">Upload New Project</h1>
                <p className="text-stone-500 text-sm">Share your latest work and tag products used from the supply chain</p>
              </div>
              <div className="flex gap-3">
                <button type="button" className="h-10 px-4 rounded-lg border border-stone-200 bg-white text-stone-700 font-bold text-sm hover:bg-stone-50 transition">
                  Save Draft
                </button>
                <button type="button" className="h-10 px-6 rounded-lg text-white font-bold text-sm transition" style={{ backgroundColor: PRIMARY }}>
                  Publish Project
                </button>
              </div>
            </div>

            {/* Step 1: Project Details */}
            <div className="mb-8 bg-white rounded-xl shadow-sm border border-stone-100 p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-[#2c2c2c]">Project Details</h2>
                <span className="text-sm font-bold px-3 py-1 rounded-full" style={{ color: PRIMARY, backgroundColor: `${PRIMARY}20` }}>
                  Step 1 of 3
                </span>
              </div>
              <div className="w-full bg-stone-100 rounded-full h-2 mb-8">
                <div className="h-2 rounded-full transition-[width]" style={{ width: '33%', backgroundColor: PRIMARY }} />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="md:col-span-2 flex flex-col gap-2">
                  <label className="text-sm font-semibold text-stone-700">Project Title <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    placeholder="e.g. Modern Villa in Riyadh"
                    className="w-full rounded-lg border border-stone-200 bg-stone-50 px-4 py-3 text-[#2c2c2c] focus:border-[#b8864a] focus:ring-2 focus:ring-[#b8864a]/40 outline-none"
                  />
                </div>
                <div className="md:col-span-2 flex flex-col gap-2">
                  <label className="text-sm font-semibold text-stone-700">Description <span className="text-red-500">*</span></label>
                  <textarea
                    placeholder="Describe the design concept, challenges, and solutions..."
                    rows={5}
                    className="w-full rounded-lg border border-stone-200 bg-stone-50 px-4 py-3 text-[#2c2c2c] focus:border-[#b8864a] focus:ring-2 focus:ring-[#b8864a]/40 outline-none resize-none"
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-semibold text-stone-700">Style <span className="text-red-500">*</span></label>
                  <select className="w-full rounded-lg border border-stone-200 bg-stone-50 px-4 py-3 text-[#2c2c2c] focus:border-[#b8864a] focus:ring-2 focus:ring-[#b8864a]/40 outline-none">
                    <option value="">Select a style</option>
                    <option value="modern">Modern Contemporary</option>
                    <option value="islamic">Modern Islamic</option>
                    <option value="classic">Neo-Classic</option>
                    <option value="minimalist">Minimalist</option>
                    <option value="industrial">Industrial</option>
                  </select>
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-semibold text-stone-700">Location (City) <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    placeholder="e.g. Riyadh, Dubai, Jeddah"
                    className="w-full rounded-lg border border-stone-200 bg-stone-50 px-4 py-3 text-[#2c2c2c] focus:border-[#b8864a] focus:ring-2 focus:ring-[#b8864a]/40 outline-none"
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-semibold text-stone-700">Project Area (sqm)</label>
                  <input
                    type="number"
                    placeholder="e.g. 450"
                    className="w-full rounded-lg border border-stone-200 bg-stone-50 px-4 py-3 text-[#2c2c2c] focus:border-[#b8864a] focus:ring-2 focus:ring-[#b8864a]/40 outline-none"
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-semibold text-stone-700">Completion Year</label>
                  <select className="w-full rounded-lg border border-stone-200 bg-stone-50 px-4 py-3 text-[#2c2c2c] focus:border-[#b8864a] focus:ring-2 focus:ring-[#b8864a]/40 outline-none">
                    <option value="2024">2024</option>
                    <option value="2023">2023</option>
                    <option value="2022">2022</option>
                    <option value="2021">2021</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Gallery Images */}
            <div className="mb-8 bg-white rounded-xl shadow-sm border border-stone-100 p-6">
              <h2 className="text-lg font-bold text-[#2c2c2c] mb-6">Gallery Images</h2>
              <div className="border-2 border-dashed border-stone-300 rounded-xl p-10 flex flex-col items-center justify-center bg-stone-50 hover:bg-stone-100 transition cursor-pointer mb-6">
                <Upload className="w-12 h-12 text-stone-400 mb-3" />
                <p className="text-stone-700 font-bold text-base mb-1">Click to upload or drag and drop</p>
                <p className="text-stone-500 text-sm">High-res JPG, PNG (Max 10MB per image)</p>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                {images.map((img, i) => (
                  <div key={img.id} className="relative group rounded-lg overflow-hidden aspect-square bg-stone-200">
                    <img src={img.url} alt="" className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                      <button type="button" className="bg-white text-[#2c2c2c] p-2 rounded-full hover:opacity-90">
                        <Eye className="w-4 h-4" />
                      </button>
                      <button type="button" onClick={() => removeImage(img.id)} className="bg-white text-red-500 p-2 rounded-full hover:opacity-90">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                    {coverIndex === i && (
                      <div className="absolute top-2 left-2 text-xs font-bold px-2 py-1 rounded text-[#2c2c2c]" style={{ backgroundColor: PRIMARY }}>
                        Cover
                      </div>
                    )}
                  </div>
                ))}
                <button
                  type="button"
                  className="aspect-square rounded-lg border-2 border-dashed border-stone-300 flex items-center justify-center hover:bg-stone-50 transition"
                >
                  <Plus className="w-8 h-8 text-stone-400" />
                </button>
              </div>
            </div>

            {/* Products Used */}
            <div className="mb-8 bg-white rounded-xl shadow-sm border border-stone-100 p-6">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
                <div>
                  <h2 className="text-lg font-bold text-[#2c2c2c]">Products Used (Chinese Supply Chain)</h2>
                  <p className="text-stone-500 text-sm mt-1">Tag products from our catalog to showcase your material choices</p>
                </div>
                <button
                  type="button"
                  className="flex items-center gap-2 px-4 py-2 bg-stone-100 hover:bg-stone-200 rounded-lg text-sm font-bold text-[#2c2c2c] transition"
                >
                  <Plus className="w-4 h-4" />
                  Add Product
                </button>
              </div>
              <div className="border border-stone-200 rounded-lg overflow-hidden">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-stone-50 border-b border-stone-200">
                      <th className="py-3 px-4 text-xs font-bold text-stone-500 uppercase tracking-wider">Product</th>
                      <th className="py-3 px-4 text-xs font-bold text-stone-500 uppercase tracking-wider">Category</th>
                      <th className="py-3 px-4 text-xs font-bold text-stone-500 uppercase tracking-wider">Supplier</th>
                      <th className="py-3 px-4 text-xs font-bold text-stone-500 uppercase tracking-wider text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {products.map((row) => (
                      <tr key={row.id} className="border-b border-stone-200 hover:bg-stone-50/50 transition">
                        <td className="py-3 px-4 flex items-center gap-3">
                          <div className="w-10 h-10 rounded bg-stone-200 overflow-hidden flex-shrink-0">
                            <img src={row.thumb} alt="" className="w-full h-full object-cover" />
                          </div>
                          <span className="text-sm font-semibold text-[#2c2c2c]">{row.name}</span>
                        </td>
                        <td className="py-3 px-4 text-sm text-stone-600">{row.category}</td>
                        <td className="py-3 px-4 text-sm text-stone-600">{row.supplier}</td>
                        <td className="py-3 px-4 text-right">
                          <button type="button" onClick={() => removeProduct(row.id)} className="text-stone-400 hover:text-red-500 transition">
                            <Trash2 className="w-5 h-5 inline" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
