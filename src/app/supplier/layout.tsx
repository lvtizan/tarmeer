'use client';

import { useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { LayoutDashboard, Package, Layers, FolderOpen, LogOut, ExternalLink, User, MessageSquare, ArrowRightLeft } from 'lucide-react';
import TarmeerLogo from '@/components/TarmeerLogo';
import { AdminLangContext, type AdminLang } from '@/hooks/useAdminLang';
import { usePathname as useNextPathname } from 'next/navigation';

const API_BASE = process.env.NEXT_PUBLIC_API_URL?.trim() || '/api';
const SUPPLIER_LANG_KEY = 'supplier_lang';

function getToken() {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('supplier_token');
}
function authHeaders() { return { Authorization: `Bearer ${getToken()}` }; }

interface LinkedPortal {
  type: string;
  label: string;
  url: string;
}

function NavItem({ href, end, icon: Icon, label, mobile }: {
  href: string;
  end?: boolean;
  icon: React.ElementType;
  label: string;
  mobile?: boolean;
}) {
  const pathname = useNextPathname();
  const isActive = end ? pathname === href : pathname.startsWith(href);

  if (mobile) {
    return (
      <Link
        href={href}
        className={`flex flex-col items-center gap-0.5 px-3 py-1 rounded-lg text-[11px] ${isActive ? 'text-[#b8864a] font-semibold' : 'text-stone-500'}`}
      >
        <Icon className="w-5 h-5" />
        {label}
      </Link>
    );
  }

  return (
    <Link
      href={href}
      className={`flex items-center gap-3 px-4 py-3 rounded-full transition cursor-pointer text-sm font-medium ${
        isActive ? 'bg-[#b8864a]/10 text-[#2c2c2c] font-semibold' : 'text-stone-600 hover:bg-stone-50'
      }`}
    >
      <Icon className="w-5 h-5" />
      <span>{label}</span>
    </Link>
  );
}

export default function SupplierLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [companyName, setCompanyName] = useState('');
  const [slug, setSlug] = useState('');
  const [status, setStatus] = useState('');
  const [linkedPortals, setLinkedPortals] = useState<LinkedPortal[]>([]);
  const [switchingPortal, setSwitchingPortal] = useState('');
  // 首渲必须与 SSR 一致(服务端无 localStorage → 'en')，否则 hydration 文本不匹配(React #418)。
  // 挂载后再用 useEffect 应用持久化语言(无保存值默认 'zh')。
  const [lang, setLang] = useState<AdminLang>('en');
  useEffect(() => {
    const saved = window.localStorage.getItem(SUPPLIER_LANG_KEY);
    setLang(saved === 'en' ? 'en' : 'zh');
  }, []);

  const t = (en: string, zh: string) => (lang === 'zh' ? zh : en);
  const toggleLang = () => {
    setLang(prev => {
      const next = prev === 'zh' ? 'en' : 'zh';
      if (typeof window !== 'undefined') window.localStorage.setItem(SUPPLIER_LANG_KEY, next);
      return next;
    });
  };

  const token = typeof window !== 'undefined' ? localStorage.getItem('supplier_token') : null;

  useEffect(() => {
    if (!getToken()) {
      router.replace('/supplier/auth');
      return;
    }
    fetch(`${API_BASE}/suppliers/me/profile`, { headers: authHeaders() as HeadersInit })
      .then(r => {
        if (r.status === 401) {
          if (typeof window !== 'undefined') {
            localStorage.removeItem('supplier_token');
            localStorage.removeItem('supplier_user');
          }
          router.replace('/supplier/auth');
          return null;
        }
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
        fetch(`${API_BASE}/suppliers/me/linked-portals`, { headers: authHeaders() as HeadersInit })
          .then(r => r.ok ? r.json() : { portals: [] })
          .then(d => setLinkedPortals(d?.portals || []))
          .catch(() => {});
      })
      .catch(() => {});
  }, [router]);

  const handleSwitchPortal = async (portal: LinkedPortal) => {
    if (switchingPortal) return;
    setSwitchingPortal(portal.type);
    try {
      const r = await fetch(`${API_BASE}/suppliers/me/cross-portal-token`, {
        method: 'POST',
        headers: { ...(authHeaders() as Record<string, string>), 'Content-Type': 'application/json' },
        body: JSON.stringify({ target: portal.type }),
      });
      const data = await r.json();
      if (data?.token) {
        const keyMap: Record<string, string> = { company: 'token', supplier: 'supplier_token', admin: 'admin_token' };
        localStorage.setItem(keyMap[portal.type] || portal.type, data.token);
        window.location.href = data.redirectUrl || portal.url;
      }
    } catch {
      // ignore
    } finally {
      setSwitchingPortal('');
    }
  };

  const handleLogout = () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('supplier_token');
      localStorage.removeItem('supplier_user');
    }
    router.push('/supplier/auth');
  };

  // Auth page: no sidebar
  if (pathname === '/supplier/auth') {
    return <>{children}</>;
  }

  return (
    <AdminLangContext.Provider value={{ lang, t }}>
      <div className="h-screen overflow-hidden bg-stone-50 flex flex-col">
        {/* Top bar */}
        <header className="bg-white border-b border-stone-200 sticky top-0 z-30 h-14 flex items-center px-4 sm:px-6 justify-between shrink-0">
          <TarmeerLogo className="h-6" />
          <div className="flex items-center gap-3">
            {companyName && <span className="text-sm font-medium text-[#2c2c2c] hidden sm:block">{companyName}</span>}
            {status && (
              <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full ${
                status === 'approved' ? 'bg-emerald-50 text-emerald-600' :
                status === 'rejected' ? 'bg-red-50 text-red-600' : 'bg-amber-50 text-amber-600'
              }`}>
                {status === 'approved' ? t('Approved', '已通过') : status === 'rejected' ? t('Rejected', '未通过') : t('Pending', '审核中')}
              </span>
            )}
            {slug && status === 'approved' && (
              <a
                href={`/materials/suppliers/${slug}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-xs text-[#b8864a] hover:underline"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">{t('View Page', '查看页面')}</span>
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
                <NavItem href="/supplier/dashboard" end icon={LayoutDashboard} label={t('Overview', '总览')} />
                <NavItem href="/supplier/profile" icon={User} label={t('Profile', '资料')} />
                <NavItem href="/supplier/products" icon={Package} label={t('Products', '产品')} />
                <NavItem href="/supplier/projects" icon={Layers} label={t('Projects', '项目')} />
                <NavItem href="/supplier/catalogs" icon={FolderOpen} label={t('Catalogs', '目录')} />

                {/* CRM link */}
                <a
                  href="https://crm.tarmeer.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 px-4 py-3 rounded-full transition cursor-pointer text-sm font-medium text-stone-600 hover:bg-stone-50"
                >
                  <MessageSquare className="w-5 h-5" />
                  <span>{t('Inquiries (CRM)', '询盘 CRM')}</span>
                  <ExternalLink className="w-3.5 h-3.5 ml-auto text-stone-400" />
                </a>

                {linkedPortals.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-stone-100">
                    <p className="text-[11px] font-semibold text-stone-400 uppercase tracking-wider px-4 mb-1">切换身份</p>
                    {linkedPortals.map(p => (
                      <button
                        key={p.type}
                        onClick={() => handleSwitchPortal(p)}
                        disabled={!!switchingPortal}
                        className="flex items-center gap-3 px-4 py-3 rounded-full transition cursor-pointer text-sm font-medium text-stone-600 hover:bg-stone-50 w-full text-left disabled:opacity-50"
                      >
                        <ArrowRightLeft className="w-4 h-4 shrink-0" />
                        <span>{switchingPortal === p.type ? '跳转中…' : p.label}</span>
                      </button>
                    ))}
                  </div>
                )}
              </nav>
            </div>

            {/* Language toggle */}
            <div className="p-4 border-t border-stone-100 mt-auto">
              <button
                type="button"
                onClick={toggleLang}
                className="flex items-center justify-between w-full px-3 py-2 rounded-lg border border-stone-200 text-xs font-medium text-stone-600 hover:bg-stone-50 transition-colors"
              >
                <span>{t('Language', '语言')}</span>
                <span>{lang === 'zh' ? '中文 / EN' : 'EN / 中文'}</span>
              </button>
            </div>
          </aside>

          <main className="flex-1 overflow-y-auto md:ml-64 pb-20 md:pb-0 [scrollbar-gutter:stable]">
            <div className="p-4 sm:p-6 lg:p-10 max-w-4xl mx-auto">
              {children}
            </div>
          </main>
        </div>

        {/* Mobile bottom nav */}
        <nav className="md:hidden fixed bottom-0 left-0 right-0 z-30 bg-white border-t border-stone-200 flex items-center justify-around px-2 py-2">
          <NavItem href="/supplier/dashboard" end icon={LayoutDashboard} label={t('Overview', '总览')} mobile />
          <NavItem href="/supplier/profile" icon={User} label={t('Profile', '资料')} mobile />
          <NavItem href="/supplier/products" icon={Package} label={t('Products', '产品')} mobile />
          <NavItem href="/supplier/projects" icon={Layers} label={t('Projects', '项目')} mobile />
          <NavItem href="/supplier/catalogs" icon={FolderOpen} label={t('Catalogs', '目录')} mobile />
          <a
            href="https://crm.tarmeer.com"
            target="_blank"
            rel="noopener noreferrer"
            className="flex flex-col items-center gap-0.5 px-3 py-1 rounded-lg text-[11px] text-stone-500"
          >
            <MessageSquare className="w-5 h-5" />
            CRM
          </a>
        </nav>
      </div>
    </AdminLangContext.Provider>
  );
}
