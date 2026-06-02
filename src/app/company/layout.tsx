'use client';

import { useState, useEffect, type ReactNode } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api';
import {
  Building2, FolderOpen, FileText, User, ImagePlus, Settings,
  MessageSquare, ExternalLink, ArrowRightLeft, LogOut,
} from 'lucide-react';
import TarmeerLogo from '@/components/TarmeerLogo';
import PhoneRequiredModal from '@/components/PhoneRequiredModal';
import { safeRemoveItem } from '@/lib/storage';
import FeedbackModal from '@/components/FeedbackModal';

interface LinkedPortal { type: string; label: string; url: string; }

function navCls(href: string, pathname: string, end = false): string {
  const isActive = end ? pathname === href : pathname.startsWith(href);
  return `flex items-center gap-3 px-4 py-3 rounded-full transition cursor-pointer ${
    isActive ? 'bg-[#b8864a]/10 text-[#2c2c2c] font-semibold' : 'text-stone-600 hover:bg-stone-50'
  }`;
}

function mobileNavCls(href: string, pathname: string, end = false): string {
  const isActive = end ? pathname === href : pathname.startsWith(href);
  return `flex flex-col items-center gap-0.5 px-3 py-2 min-h-[44px] justify-center rounded-lg text-[11px] ${
    isActive ? 'text-[#b8864a] font-semibold' : 'text-stone-500'
  }`;
}

interface CompanyLayoutProps {
  children: ReactNode;
}

export default function CompanyLayout({ children }: CompanyLayoutProps) {
  const router = useRouter();
  const pathname = usePathname();
  const token = typeof window !== 'undefined' ? api.getToken() : null;
  const [authValid, setAuthValid] = useState<boolean | null>(token ? null : false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [companyName, setCompanyName] = useState('');
  const [companyType, setCompanyType] = useState('');
  const [crmEnabled, setCrmEnabled] = useState(false);
  const [linkedPortals, setLinkedPortals] = useState<LinkedPortal[]>([]);
  const [switchingPortal, setSwitchingPortal] = useState('');

  useEffect(() => {
    if (!token) {
      setAuthValid(false);
      router.replace('/auth');
      return;
    }

    let mounted = true;
    api.get('/auth/me')
      .then(() => {
        if (!mounted) return;
        setAuthValid(true);
        api.get('/auth/company/profile').then((res: unknown) => {
          if (!mounted) return;
          const r = res as Record<string, unknown> | null;
          const p = (r?.profile ?? r) as Record<string, unknown> | null;
          if (!p) return;
          setCompanyName((p.company_name as string) || '');
          setCompanyType((p.company_type as string) || '');
          setCrmEnabled(!!(p.crm_tenant_id));
        }).catch((err) => {
          console.error('[CompanyLayout] Failed to load company profile:', err);
        });
        api.get('/auth/linked-portals').then((res: unknown) => {
          if (!mounted) return;
          const r = res as { portals?: LinkedPortal[] } | null;
          setLinkedPortals(r?.portals || []);
        }).catch((err) => {
          console.error('[CompanyLayout] Failed to load linked portals:', err);
        });
      })
      .catch(() => {
        if (!mounted) return;
        api.clearToken();
        safeRemoveItem('user');
        safeRemoveItem('active_role');
        setAuthValid(false);
        router.replace('/auth');
      });

    return () => { mounted = false; };
  }, [token, router]);

  const handleLogout = () => {
    api.clearToken();
    safeRemoveItem('user');
    safeRemoveItem('active_role');
    router.push('/auth');
  };

  const handleSwitchPortal = async (portal: LinkedPortal) => {
    if (switchingPortal) return;
    setSwitchingPortal(portal.type);
    try {
      const res = await api.post('/auth/cross-portal-token', { target: portal.type }) as { token?: string; redirectUrl?: string } | null;
      if (res?.token) {
        const keyMap: Record<string, string> = { company: 'token', supplier: 'supplier_token', admin: 'admin_token' };
        if (typeof window !== 'undefined') {
          localStorage.setItem(keyMap[portal.type] || portal.type, res.token);
          window.location.href = res.redirectUrl || portal.url;
        }
      }
    } catch { /* ignore */ } finally { setSwitchingPortal(''); }
  };

  const handleOpenCrm = () => {
    window.open('https://crm.tarmeer.com', '_blank');
  };

  // Onboarding page: standalone layout (no sidebar)
  if (pathname === '/company/onboarding') {
    return <>{children}</>;
  }

  if (!token || authValid === false) {
    return <div className="min-h-screen flex items-center justify-center text-stone-400">Redirecting...</div>;
  }

  if (authValid !== true) {
    return <div className="min-h-screen flex items-center justify-center text-stone-400">Checking session...</div>;
  }

  return (
    <div className="h-screen bg-stone-50 flex flex-col overflow-hidden">
      <PhoneRequiredModal blocking />
      {/* Portal header */}
      <header className="bg-white border-b border-stone-200 sticky top-0 z-30 h-14 flex items-center px-4 sm:px-6 justify-between shrink-0">
        <TarmeerLogo className="h-6" />
        <div className="flex items-center gap-3">
          {companyName && <span className="text-sm font-medium text-[#2c2c2c] hidden sm:block">{companyName}</span>}
          <button onClick={handleLogout} className="text-stone-400 hover:text-stone-600 transition p-1" title="Log out">
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <aside className="hidden md:flex w-64 flex-col flex-shrink-0 border-r border-stone-200 bg-white fixed top-14 bottom-0 left-0 z-10 overflow-y-auto">
          <div className="p-6">
            <nav className="flex flex-col gap-1">
              <Link href="/company/dashboard" className={navCls('/company/dashboard', pathname, true)}>
                <Building2 className="w-5 h-5" />
                <span className="text-sm font-medium">Dashboard</span>
              </Link>
              <Link href="/company/projects" className={navCls('/company/projects', pathname)}>
                <FolderOpen className="w-5 h-5" />
                <span className="text-sm font-medium">Projects</span>
              </Link>
              <Link href="/company/articles" className={navCls('/company/articles', pathname)}>
                <FileText className="w-5 h-5" />
                <span className="text-sm font-medium">Articles</span>
              </Link>
              <Link href="/company/profile" className={navCls('/company/profile', pathname)}>
                <User className="w-5 h-5" />
                <span className="text-sm font-medium">Profile</span>
              </Link>
              <Link href="/company/settings" className={navCls('/company/settings', pathname)}>
                <Settings className="w-5 h-5" />
                <span className="text-sm font-medium">Settings</span>
              </Link>
              {crmEnabled && (
                <button onClick={handleOpenCrm} className="flex items-center gap-3 px-4 py-3 rounded-full transition w-full text-left bg-violet-50 text-violet-700 border border-violet-200 hover:bg-violet-100">
                  <ExternalLink className="w-5 h-5 shrink-0" />
                  <span className="text-sm font-medium">Open CRM</span>
                </button>
              )}
              {linkedPortals.length > 0 && (
                <div className="mt-3 pt-3 border-t border-stone-100">
                  <p className="text-[11px] text-stone-400 px-4 mb-1">Switch Account</p>
                  {linkedPortals.map(p => (
                    <button
                      key={p.type}
                      onClick={() => handleSwitchPortal(p)}
                      disabled={!!switchingPortal}
                      className="flex items-center gap-2 px-4 py-2 rounded-full w-full text-left text-[13px] text-stone-400 hover:text-stone-600 hover:bg-stone-50 transition disabled:opacity-50"
                    >
                      <ArrowRightLeft className="w-3.5 h-3.5 shrink-0" />
                      <span>{switchingPortal === p.type ? 'Switching...' : p.label}</span>
                    </button>
                  ))}
                </div>
              )}
            </nav>
          </div>
        </aside>

        <main className="flex-1 overflow-y-auto md:ml-64 pb-20 md:pb-0 [scrollbar-gutter:stable]">
          <div className="p-4 sm:p-6 lg:p-6">
            {children}
          </div>
        </main>
      </div>

      {/* Feedback bubble */}
      <button
        onClick={() => setFeedbackOpen(true)}
        className="fixed bottom-20 right-4 md:bottom-6 md:right-6 z-20 w-14 rounded-2xl bg-[#1c1917] text-white shadow-lg hover:bg-[#2c2c2c] transition flex flex-col items-center justify-center gap-1 py-2.5"
        aria-label="Send feedback"
      >
        <MessageSquare className="w-5 h-5" />
        <span className="text-[10px] font-medium leading-none">Feedback</span>
      </button>
      <FeedbackModal
        open={feedbackOpen}
        onClose={() => setFeedbackOpen(false)}
        source="company_portal"
        companyName={companyName}
        companyType={companyType}
      />

      {/* Mobile bottom navigation */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-30 bg-white border-t border-stone-200 flex items-center justify-around px-2 py-2 safe-area-pb">
        <Link href="/company/dashboard" className={mobileNavCls('/company/dashboard', pathname, true)}>
          <Building2 className="w-5 h-5" />
          Dashboard
        </Link>
        <Link href="/company/projects" className={mobileNavCls('/company/projects', pathname)}>
          <FolderOpen className="w-5 h-5" />
          Projects
        </Link>
        <Link href="/company/upload" className={mobileNavCls('/company/upload', pathname)}>
          <ImagePlus className="w-5 h-5" />
          Upload
        </Link>
        <Link href="/company/profile" className={mobileNavCls('/company/profile', pathname)}>
          <User className="w-5 h-5" />
          Profile
        </Link>
        {crmEnabled && (
          <button onClick={handleOpenCrm} className="flex flex-col items-center gap-0.5 px-3 py-2 min-h-[44px] justify-center rounded-lg text-[11px] text-violet-600 font-medium">
            <ExternalLink className="w-5 h-5" />
            CRM
          </button>
        )}
      </nav>
    </div>
  );
}
