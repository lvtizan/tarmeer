import { Outlet, Navigate } from 'react-router-dom';
import {
  Home, User, FolderOpen, Settings,
} from 'lucide-react';
import { api } from '../lib/api';
import Navbar from '../components/Navbar';
import SidebarNavLink from '../components/ui/SidebarNavLink';

export default function UserDashboardLayout() {
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

  return (
    <div className="min-h-screen flex flex-col bg-[#faf9f7]">
      {/* Top navbar — same as homepage */}
      <Navbar />

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <aside className="hidden md:flex w-64 flex-col flex-shrink-0 border-r border-stone-200 bg-white fixed top-[57px] bottom-0 left-0 z-10 overflow-y-auto">
          <div className="flex-1 p-6">
            <nav className="flex flex-col gap-1">
              <SidebarNavLink to="/dashboard" end>
                <Home className="w-5 h-5" />
                <span className="text-sm font-medium">Dashboard</span>
              </SidebarNavLink>
              <SidebarNavLink to="/dashboard/projects">
                <FolderOpen className="w-5 h-5" />
                <span className="text-sm font-medium">Projects</span>
              </SidebarNavLink>
              <SidebarNavLink to="/dashboard/profile">
                <User className="w-5 h-5" />
                <span className="text-sm font-medium">Profile</span>
              </SidebarNavLink>
              <SidebarNavLink to="/dashboard/settings">
                <Settings className="w-5 h-5" />
                <span className="text-sm font-medium">Settings</span>
              </SidebarNavLink>
            </nav>
          </div>
        </aside>

        <main className="flex-1 overflow-y-auto p-6 md:ml-64 md:p-10">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
