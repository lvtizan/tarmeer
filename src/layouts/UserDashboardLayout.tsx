import { Outlet, NavLink, Navigate, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, User, FolderOpen, LogOut, Settings,
} from 'lucide-react';
import { api } from '../lib/api';
import Navbar from '../components/Navbar';

export default function UserDashboardLayout() {
  const navigate = useNavigate();

  // Redirect company users to /company, unset users to /onboarding
  const activeRole = localStorage.getItem('active_role');
  if (activeRole === 'company') {
    return <Navigate to="/company" replace />;
  }
  if (!activeRole) {
    const token = api.getToken();
    if (token) {
      try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        if (payload.role === 'company' || payload.role === 'designer') {
          return <Navigate to="/company" replace />;
        }
      } catch { /* ignore */ }
    }
    return <Navigate to="/onboarding" replace />;
  }

  const handleLogout = () => {
    api.clearToken();
    localStorage.removeItem('user');
    localStorage.removeItem('active_role');
    localStorage.removeItem('designer');
    navigate('/auth', { replace: true });
  };

  const navClass = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-3 px-4 py-3 rounded-lg transition cursor-pointer ${
      isActive ? 'bg-[#b8864a]/10 text-[#2c2c2c] border-l-4 border-[#b8864a]' : 'text-stone-600 hover:bg-stone-50'
    }`;

  return (
    <div className="min-h-screen flex flex-col bg-[#faf9f7]">
      {/* Top navbar — same as homepage */}
      <Navbar />

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <aside className="hidden md:flex w-64 flex-col flex-shrink-0 border-r border-stone-200 bg-white overflow-y-auto">
          <div className="flex-1 p-6">
            <nav className="flex flex-col gap-1">
              <NavLink to="/dashboard" end className={navClass}>
                <LayoutDashboard className="w-5 h-5" />
                <span className="text-sm font-medium">Dashboard</span>
              </NavLink>
              <NavLink to="/dashboard/projects" className={navClass}>
                <FolderOpen className="w-5 h-5" />
                <span className="text-sm font-medium">Projects</span>
              </NavLink>
              <NavLink to="/dashboard/profile" className={navClass}>
                <User className="w-5 h-5" />
                <span className="text-sm font-medium">Profile</span>
              </NavLink>
              <NavLink to="/dashboard/settings" className={navClass}>
                <Settings className="w-5 h-5" />
                <span className="text-sm font-medium">Settings</span>
              </NavLink>
            </nav>
          </div>

          {/* Logout */}
          <div className="p-4 border-t border-stone-200">
            <button
              type="button"
              onClick={handleLogout}
              className="flex items-center gap-3 w-full px-4 py-3 rounded-lg text-sm font-medium text-stone-600 hover:bg-stone-50 transition cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
              Log out
            </button>
          </div>
        </aside>

        <main className="flex-1 overflow-y-auto p-6 md:p-10">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
