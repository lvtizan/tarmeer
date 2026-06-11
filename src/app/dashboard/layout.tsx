'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Home, User, FolderOpen, Settings, MessageSquare,
} from 'lucide-react';
import { api } from '@/lib/api';
import PhoneRequiredModal from '@/components/PhoneRequiredModal';
import FeedbackModal from '@/components/FeedbackModal';
import { PortalDesktopNav, PortalMobileNav, type PortalNavItem } from '@/components/portal/PortalNav';

const HOMEOWNER_NAV: PortalNavItem[] = [
  { href: '/dashboard', label: 'Dashboard', icon: Home, end: true },
  { href: '/dashboard/projects', label: 'Projects', icon: FolderOpen },
  { href: '/dashboard/profile', label: 'Profile', icon: User },
  { href: '/dashboard/settings', label: 'Settings', icon: Settings },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
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

  return (
    <div className="flex flex-1 overflow-hidden bg-[#faf9f7]">
      <PhoneRequiredModal blocking />

      {/* Sidebar — desktop only */}
      <aside className="hidden md:flex w-64 flex-col flex-shrink-0 border-r border-stone-200 bg-white fixed top-14 sm:top-16 bottom-0 left-0 z-10 overflow-y-auto">
        <div className="flex-1 p-6">
          <PortalDesktopNav items={HOMEOWNER_NAV} />
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
      <PortalMobileNav items={HOMEOWNER_NAV} />
    </div>
  );
}
