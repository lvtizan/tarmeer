import { useState, useEffect } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { Building2, Package, Layers, FolderOpen, LogOut, ExternalLink } from 'lucide-react';
import TarmeerLogo from '../TarmeerLogo';

const API_BASE = import.meta.env.VITE_API_URL?.trim() || '/api';

function getToken() { return localStorage.getItem('supplier_token'); }
function authHeaders() { return { Authorization: `Bearer ${getToken()}` }; }

const navCls = ({ isActive }: { isActive: boolean }) =>
  `flex items-center gap-3 px-4 py-3 rounded-full transition cursor-pointer text-sm font-medium ${
    isActive ? 'bg-[#b8864a]/10 text-[#2c2c2c] font-semibold' : 'text-stone-600 hover:bg-stone-50'
  }`;

export default function SupplierLayout() {
  const navigate = useNavigate();
  const [companyName, setCompanyName] = useState('');
  const [slug, setSlug] = useState('');
  const [status, setStatus] = useState('');

  useEffect(() => {
    if (!getToken()) { navigate('/supplier/auth', { replace: true }); return; }
    fetch(`${API_BASE}/suppliers/me/profile`, { headers: authHeaders() as any })
      .then(r => {
        if (r.status === 401) { navigate('/supplier/auth', { replace: true }); return null; }
        return r.json();
      })
      .then(data => {
        if (!data) return;
        const p = data.profile;
        if (p) {
          setCompanyName(p.company_name || '');
          setSlug(p.slug || '');
          setStatus(p.status || '');
        }
      })
      .catch(() => {});
  }, [navigate]);

  const handleLogout = () => {
    localStorage.removeItem('supplier_token');
    localStorage.removeItem('supplier_user');
    navigate('/supplier/auth');
  };

  return (
    <div className="min-h-screen bg-stone-50 flex flex-col">
      {/* Top bar */}
      <header className="bg-white border-b border-stone-200 sticky top-0 z-30 h-14 flex items-center px-4 sm:px-6 justify-between shrink-0">
        <TarmeerLogo className="h-6" />
        <div className="flex items-center gap-3">
          {companyName && <span className="text-sm font-medium text-[#2c2c2c] hidden sm:block">{companyName}</span>}
          {status && (
            <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full ${
              status === 'approved' ? 'bg-emerald-50 text-emerald-600' :
              status === 'rejected' ? 'bg-red-50 text-red-600' : 'bg-amber-50 text-amber-600'
            }`}>{status}</span>
          )}
          {slug && status === 'approved' && (
            <a
              href={`/materials/suppliers/${slug}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-xs text-[#b8864a] hover:underline"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">View Page</span>
            </a>
          )}
          <button onClick={handleLogout} className="text-stone-400 hover:text-stone-600 transition p-1">
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <aside className="hidden md:flex w-64 flex-col flex-shrink-0 border-r border-stone-200 bg-white fixed top-14 bottom-0 left-0 z-10 overflow-y-auto">
          <div className="p-6">
            <nav className="flex flex-col gap-1">
              <NavLink to="/supplier/dashboard" end className={navCls}>
                <Building2 className="w-5 h-5" />
                <span>Profile</span>
              </NavLink>
              <NavLink to="/supplier/products" className={navCls}>
                <Package className="w-5 h-5" />
                <span>Products</span>
              </NavLink>
              <NavLink to="/supplier/projects" className={navCls}>
                <Layers className="w-5 h-5" />
                <span>Projects</span>
              </NavLink>
              <NavLink to="/supplier/catalogs" className={navCls}>
                <FolderOpen className="w-5 h-5" />
                <span>Catalogs</span>
              </NavLink>
            </nav>
          </div>
        </aside>

        <main className="flex-1 overflow-y-auto md:ml-64 pb-20 md:pb-0">
          <div className="p-4 sm:p-6 lg:p-10">
            <Outlet />
          </div>
        </main>
      </div>

      {/* Mobile bottom nav */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-30 bg-white border-t border-stone-200 flex items-center justify-around px-2 py-2">
        <NavLink to="/supplier/dashboard" end className={({ isActive }) => `flex flex-col items-center gap-0.5 px-3 py-1 rounded-lg text-[11px] ${isActive ? 'text-[#b8864a] font-semibold' : 'text-stone-500'}`}>
          <Building2 className="w-5 h-5" />
          Profile
        </NavLink>
        <NavLink to="/supplier/products" className={({ isActive }) => `flex flex-col items-center gap-0.5 px-3 py-1 rounded-lg text-[11px] ${isActive ? 'text-[#b8864a] font-semibold' : 'text-stone-500'}`}>
          <Package className="w-5 h-5" />
          Products
        </NavLink>
        <NavLink to="/supplier/projects" className={({ isActive }) => `flex flex-col items-center gap-0.5 px-3 py-1 rounded-lg text-[11px] ${isActive ? 'text-[#b8864a] font-semibold' : 'text-stone-500'}`}>
          <Layers className="w-5 h-5" />
          Projects
        </NavLink>
        <NavLink to="/supplier/catalogs" className={({ isActive }) => `flex flex-col items-center gap-0.5 px-3 py-1 rounded-lg text-[11px] ${isActive ? 'text-[#b8864a] font-semibold' : 'text-stone-500'}`}>
          <FolderOpen className="w-5 h-5" />
          Catalogs
        </NavLink>
      </nav>
    </div>
  );
}
