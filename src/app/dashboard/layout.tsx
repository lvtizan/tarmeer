'use client';

import { useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import {
  Home, User, FolderOpen, Settings, MessageSquare,
} from 'lucide-react';
import { api } from '@/lib/api';
import PhoneRequiredModal from '@/components/PhoneRequiredModal';
import SidebarNavLink from '@/components/ui/SidebarNavLink';
import FeedbackModal from '@/components/FeedbackModal';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const activeRole = localStorage.getItem('active_role');
    if (activeRole === 'company') {
      router.replace('/company');
      return;
    }
    if (!activeRole) {
      const token = api.getToken();
      if (token) {
        try {
          const payload = JSON.parse(atob(token.split('.')[1]));
          if (payload.role === 'company' || payload.role === 'designer') {
            router.replace('/company');
            return;
          }
          // Supplier token accidentally stored as main-site token — redirect to supplier portal
          if (payload.type === 'supplier' || payload.supplierUserId) {
            router.replace('/supplier/dashboard');
            return;
          }
        } catch { /* ignore */ }
      }
      router.replace('/auth');
      return;
    }
    setReady(true);
  }, [router]);

  if (!ready) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#faf9f7]">
        <div className="text-stone-400">Loading...</div>
      </div>
    );
  }

  const mobileNavItems = [
    { href: '/dashboard', label: 'Home', icon: Home, exact: true },
    { href: '/dashboard/projects', label: 'Projects', icon: FolderOpen, exact: false },
    { href: '/dashboard/profile', label: 'Profile', icon: User, exact: false },
    { href: '/dashboard/settings', label: 'Settings', icon: Settings, exact: false },
  ];

  return (
    <div className="flex flex-1 overflow-hidden bg-[#faf9f7]">
      <PhoneRequiredModal blocking />

      {/* Sidebar — desktop only */}
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
        {children}
      </main>

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
        {mobileNavItems.map(({ href, label, icon: Icon, exact }) => {
          const isActive = exact ? pathname === href : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={`flex flex-col items-center gap-1 py-2 px-3 ${isActive ? 'text-[#b8864a]' : 'text-stone-400'}`}
            >
              <Icon className="w-5 h-5" />
              <span className="text-[10px] font-medium">{label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
