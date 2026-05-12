import { useState } from 'react';
import { Outlet, Navigate, NavLink } from 'react-router-dom';
import {
  Home, User, FolderOpen, Settings, MessageSquare,
} from 'lucide-react';
import { api } from '../lib/api';
import Navbar from '../components/Navbar';
import PhoneRequiredModal from '../components/PhoneRequiredModal';
import SidebarNavLink from '../components/ui/SidebarNavLink';
import FeedbackModal from '../components/FeedbackModal';

export default function UserDashboardLayout() {
  const [feedbackOpen, setFeedbackOpen] = useState(false);
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
        // Supplier token accidentally stored as main-site token — redirect to supplier portal
        if (payload.type === 'supplier' || payload.supplierUserId) {
          return <Navigate to="/supplier/dashboard" replace />;
        }
      } catch { /* ignore */ }
    }
    return <Navigate to="/onboarding" replace />;
  }

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-[#faf9f7]">
      <PhoneRequiredModal blocking />
      {/* Top navbar — same as homepage */}
      <Navbar />

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <aside className="hidden md:flex w-64 flex-col flex-shrink-0 border-r border-stone-200 bg-white fixed top-14 sm:top-16 bottom-0 left-0 z-10 overflow-y-auto">
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

        <main className="flex-1 overflow-y-auto p-6 pb-20 md:pb-6 md:ml-64 md:p-10">
          <Outlet />
        </main>
      </div>

      {/* Feedback bubble — fixed bottom-right, above mobile nav */}
      <button
        onClick={() => setFeedbackOpen(true)}
        className="fixed bottom-20 right-4 md:bottom-6 md:right-6 z-20 w-14 rounded-2xl bg-[#1c1917] text-white shadow-lg hover:bg-[#2c2c2c] transition flex flex-col items-center justify-center gap-1 py-2.5"
        aria-label="Send feedback"
      >
        <MessageSquare className="w-5 h-5" />
        <span className="text-[10px] font-medium leading-none">Feedback</span>
      </button>
      <FeedbackModal open={feedbackOpen} onClose={() => setFeedbackOpen(false)} source="homeowner_portal" />

      {/* Mobile bottom navigation */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-stone-200 z-20 flex justify-around items-center h-16 pb-[env(safe-area-inset-bottom)]">
        <NavLink to="/dashboard" end className={({ isActive }) =>
          `flex flex-col items-center gap-1 py-2 px-3 ${isActive ? 'text-[#b8864a]' : 'text-stone-400'}`}>
          <Home className="w-5 h-5" />
          <span className="text-[10px] font-medium">Home</span>
        </NavLink>
        <NavLink to="/dashboard/projects" className={({ isActive }) =>
          `flex flex-col items-center gap-1 py-2 px-3 ${isActive ? 'text-[#b8864a]' : 'text-stone-400'}`}>
          <FolderOpen className="w-5 h-5" />
          <span className="text-[10px] font-medium">Projects</span>
        </NavLink>
        <NavLink to="/dashboard/profile" className={({ isActive }) =>
          `flex flex-col items-center gap-1 py-2 px-3 ${isActive ? 'text-[#b8864a]' : 'text-stone-400'}`}>
          <User className="w-5 h-5" />
          <span className="text-[10px] font-medium">Profile</span>
        </NavLink>
        <NavLink to="/dashboard/settings" className={({ isActive }) =>
          `flex flex-col items-center gap-1 py-2 px-3 ${isActive ? 'text-[#b8864a]' : 'text-stone-400'}`}>
          <Settings className="w-5 h-5" />
          <span className="text-[10px] font-medium">Settings</span>
        </NavLink>
      </nav>
    </div>
  );
}
