import { Outlet, NavLink, Link, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, FolderOpen, User, LogOut, ChevronRight,
  MessageSquare, Building2, Palette,
} from 'lucide-react';
import { api } from '../lib/api';

const PRIMARY = '#b8864a';

function useUserInfo() {
  // Decode role from JWT token (avoids needing a context for now)
  const token = api.getToken();
  if (!token) return { role: 'user', name: '' };
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return { role: payload.role || 'user', name: payload.email || '' };
  } catch {
    return { role: 'user', name: '' };
  }
}

export default function UserDashboardLayout() {
  const navigate = useNavigate();
  const { role } = useUserInfo();

  const handleLogout = () => {
    api.clearToken();
    localStorage.removeItem('designer');
    navigate('/auth', { replace: true });
  };

  const navClass = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-3 px-4 py-3 rounded-lg transition cursor-pointer ${
      isActive ? 'bg-[#b8864a]/10 text-[#2c2c2c] border-l-4 border-[#b8864a]' : 'text-stone-600 hover:bg-stone-50'
    }`;

  return (
    <div className="min-h-screen flex flex-col bg-[#faf9f7]">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-stone-200 bg-white px-4 md:px-10 py-3 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <Link to="/dashboard" className="flex items-center gap-3 text-[#2c2c2c] cursor-pointer shrink-0">
            <div className="size-8 rounded flex items-center justify-center" style={{ backgroundColor: `${PRIMARY}20` }}>
              <LayoutDashboard className="w-5 h-5" style={{ color: PRIMARY }} />
            </div>
            <span className="text-lg font-bold">Tarmeer Dashboard</span>
          </Link>
          <div className="hidden md:flex items-center gap-2 text-sm text-stone-500">
            <Link to="/" className="hover:text-[#2c2c2c] transition">Home</Link>
            <ChevronRight className="w-4 h-4 text-stone-400" />
            <span className="text-[#2c2c2c] font-medium">Dashboard</span>
          </div>
        </div>
        <button
          type="button"
          onClick={handleLogout}
          className="inline-flex items-center gap-1.5 rounded-lg h-9 px-3 text-stone-600 hover:text-red-600 text-sm font-medium transition cursor-pointer"
        >
          <LogOut className="w-4 h-4" />
          <span className="hidden sm:inline">Log out</span>
        </button>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <aside className="hidden md:flex w-64 flex-col flex-shrink-0 border-r border-stone-200 bg-white overflow-y-auto">
          <div className="p-6">
            <nav className="flex flex-col gap-1">
              <NavLink to="/dashboard" end className={navClass}>
                <LayoutDashboard className="w-5 h-5" />
                <span className="text-sm font-medium">Dashboard</span>
              </NavLink>
              <NavLink to="/dashboard/profile" className={navClass}>
                <User className="w-5 h-5" />
                <span className="text-sm font-medium">Profile</span>
              </NavLink>

              {/* Designer-specific */}
              {(role === 'designer') && (
                <>
                  <NavLink to="/dashboard/projects" className={navClass}>
                    <FolderOpen className="w-5 h-5" />
                    <span className="text-sm font-medium">My Projects</span>
                  </NavLink>
                </>
              )}

              {/* Inquiries for designers and companies */}
              {(role === 'designer' || role === 'company') && (
                <NavLink to="/dashboard/inquiries" className={navClass}>
                  <MessageSquare className="w-5 h-5" />
                  <span className="text-sm font-medium">Inquiries</span>
                </NavLink>
              )}

              {/* Upgrade options for regular users */}
              {role === 'user' && (
                <>
                  <div className="mt-4 mb-2 px-4 text-[11px] font-medium text-stone-400 uppercase tracking-wider">
                    Upgrade
                  </div>
                  <NavLink to="/dashboard/apply/designer" className={navClass}>
                    <Palette className="w-5 h-5" />
                    <span className="text-sm font-medium">Become a Designer</span>
                  </NavLink>
                  <NavLink to="/dashboard/apply/company" className={navClass}>
                    <Building2 className="w-5 h-5" />
                    <span className="text-sm font-medium">Register Company</span>
                  </NavLink>
                </>
              )}
            </nav>
          </div>
        </aside>

        <main className="flex-1 overflow-y-auto p-6 md:p-10">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
