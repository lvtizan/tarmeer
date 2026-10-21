'use client';

import { Fragment, useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Menu, X, User, Briefcase, ChevronDown, LayoutDashboard, LogOut } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { api } from '../lib/api';
import { safeGetJSON } from '../lib/storage';
import Avatar from './ui/Avatar';
import NotificationBell from './NotificationBell';
import { useNavigationHandler } from '../hooks/useNavigationHandler';
import TarmeerLogo from './TarmeerLogo';
import { useSiteLocale } from '@/contexts/SiteLocaleContext';

const API_BASE = process.env.NEXT_PUBLIC_API_URL?.trim() || '/api';

type NavbarVariant = 'default' | 'admin-auth';

export default function Navbar({
  forceShowOnAuth = false,
  noBorder = false,
  variant = 'default',
}: {
  forceShowOnAuth?: boolean;
  noBorder?: boolean;
  variant?: NavbarVariant;
}) {
  const { tr } = useSiteLocale();

  const navLinks = [{ to: '/', label: tr.footer.navLinks.Home }];

  // 空间类型 label：已有翻译则用翻译，后台新配置项直接显示 key
  const spaceLabel = (key: string) => (tr.spaces as Record<string, string>)[key] ?? key;

  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [materialsDropdownOpen, setMaterialsDropdownOpen] = useState(false);
  const [spaceTypes, setSpaceTypes] = useState<{ key: string; to: string }[]>([]);
  const [supplierNavGroups, setSupplierNavGroups] = useState<{ value: string; label: string; categories: { value: string; label: string }[] }[]>([]);
  const [supplierNavUngrouped, setSupplierNavUngrouped] = useState<{ value: string; label: string }[]>([]);
  const { handleNavClick } = useNavigationHandler();
  const pathname = usePathname();
  const isAuthPage = pathname === '/auth' || pathname === '/login' || pathname === '/register';
  const isPortalPage = pathname.startsWith('/company') || pathname.startsWith('/supplier') || pathname.startsWith('/auth/callback') || pathname.startsWith('/admin') || pathname.startsWith('/field');

  useEffect(() => {
    fetch(`${API_BASE}/public/product-categories`)
      .then((r) => r.json())
      .then((d: unknown) => {
        const data = d as { groups?: { value: string; label: string; categories: { value: string; label: string }[] }[]; ungrouped?: { value: string; label: string }[] };
        if (Array.isArray(data?.groups)) setSupplierNavGroups(data.groups);
        if (Array.isArray(data?.ungrouped)) setSupplierNavUngrouped(data.ungrouped);
      })
      .catch(() => {});
  }, []);

  // 找公司下拉的空间类型 — 后台可配置
  useEffect(() => {
    fetch(`${API_BASE}/site/space-types?country=ae`)
      .then((r) => r.json())
      .then((d: unknown) => {
        const data = d as { items?: { key: string; to: string }[] };
        if (Array.isArray(data?.items)) setSpaceTypes(data.items);
      })
      .catch(() => {});
  }, []);

  // 仅客户端读取登录态，保证 SSR 与 CSR 首屏一致（避免 hydration mismatch）
  useEffect(() => { setMounted(true); }, []);

  if ((isAuthPage && !forceShowOnAuth) || isPortalPage) return null;

  const isLoggedIn = mounted && Boolean(api.getToken());
  const user = safeGetJSON<Record<string, unknown>>('user') || safeGetJSON<Record<string, unknown>>('designer');
  const activeRole = typeof window !== 'undefined' ? localStorage.getItem('active_role') : null;
  const isAdminAuthVariant = variant === 'admin-auth';
  const showUserEntry = !isAdminAuthVariant && isLoggedIn;
  const showJoinAsCompany = !isAdminAuthVariant && !isLoggedIn;
  const showLogInLink = !isAdminAuthVariant && !isLoggedIn;

  let accountEntry = { to: '/auth?tab=login', label: 'Log In' };
  let userName = 'User';
  let userAvatar = '';

  if (isLoggedIn) {
    if (user) {
      userName = ((user?.full_name as string) || (user?.fullName as string) || '').trim() || 'User';
      userAvatar = ((user?.avatar_url as string) || (user?.avatarUrl as string) || '').trim();
    }
    if (activeRole === 'company') {
      accountEntry = { to: '/company', label: 'Dashboard' };
    } else if (activeRole === 'admin') {
      accountEntry = { to: '/admin', label: 'Dashboard' };
    } else {
      accountEntry = { to: '/dashboard', label: 'Dashboard' };
    }
  }

  const handleClick = (to: string) => {
    handleNavClick(to);
    setOpen(false);
    setDropdownOpen(false);
    setMaterialsDropdownOpen(false);
  };

  const renderNavLink = (to: string, label: string, extraClasses = '') => (
    <Link
      href={to}
      onClick={() => handleClick(to)}
      className={`text-base font-medium text-[#2c2c2c]/80 hover:text-[#2c2c2c] transition ${extraClasses}`}
    >
      {label}
    </Link>
  );

  return (
    <header className={`sticky top-0 z-50 bg-white/95 backdrop-blur-sm ${noBorder ? '' : 'border-b border-stone-200'}`}>
      <div className="w-full px-4 sm:px-6 lg:px-10 flex items-center justify-between h-14 sm:h-16">
        <TarmeerLogo />

        <nav className="hidden md:flex items-center gap-6">
          {navLinks.map(({ to, label }) => (
            <Fragment key={to}>{renderNavLink(to, label)}</Fragment>
          ))}

          {/* Find Company Dropdown — 空间类型（后台可配置） */}
          <div
            className="relative"
            onMouseEnter={() => setDropdownOpen(true)}
            onMouseLeave={() => setDropdownOpen(false)}
          >
            <Link
              href="/companies"
              onClick={() => { setDropdownOpen(false); handleClick('/companies'); }}
              className="inline-flex items-center gap-1.5 text-base font-medium text-[#2c2c2c]/80 hover:text-[#2c2c2c] transition"
            >
              {tr.nav.findCompany}
              <ChevronDown className={`w-4 h-4 transition-transform ${dropdownOpen ? 'rotate-180' : ''}`} />
            </Link>
            <div className={`absolute top-full left-0 pt-2 w-max z-50 transition-all duration-150 ${dropdownOpen ? 'opacity-100 translate-y-0 pointer-events-auto' : 'opacity-0 -translate-y-2 pointer-events-none'}`}>
              <div className="bg-white shadow-xl rounded-lg border border-stone-200 overflow-hidden">
                <div className="p-6 min-w-[192px]">
                  <h3 className="text-xs font-bold text-stone-900 uppercase tracking-wider mb-3">{tr.nav.spaceType}</h3>
                  <ul className="space-y-2">
                    {spaceTypes.map((item) => (
                      <li key={item.to}>
                        <Link href={item.to} onClick={() => handleClick(item.to)} className="text-sm text-stone-600 hover:text-[#b8864a] transition block">
                          {spaceLabel(item.key)}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="border-t border-stone-200 px-6 py-3 bg-stone-50">
                  <Link href="/companies" onClick={() => handleClick('/companies')} className="text-sm font-medium text-[#b8864a] hover:text-[#a07540] transition">
                    {tr.nav.allCompanies} {'>'}
                  </Link>
                </div>
              </div>
            </div>
          </div>

          {/* Materials Dropdown */}
          <div
            className="relative"
            onMouseEnter={() => setMaterialsDropdownOpen(true)}
            onMouseLeave={() => setMaterialsDropdownOpen(false)}
          >
            <Link
              href="/materials"
              onClick={() => { setMaterialsDropdownOpen(false); handleClick('/materials'); }}
              className="inline-flex items-center gap-1.5 text-base font-medium text-[#2c2c2c]/80 hover:text-[#2c2c2c] transition"
            >
              {tr.nav.materials}
              <ChevronDown className={`w-4 h-4 transition-transform ${materialsDropdownOpen ? 'rotate-180' : ''}`} />
            </Link>
            <div className={`absolute top-full right-0 pt-2 w-max z-50 transition-all duration-150 ${materialsDropdownOpen ? 'opacity-100 translate-y-0 pointer-events-auto' : 'opacity-0 -translate-y-2 pointer-events-none'}`}>
              <div className="bg-white shadow-xl rounded-lg border border-stone-200">
                <div className={`p-6 gap-8 min-w-max grid ${supplierNavGroups.length >= 3 ? 'grid-cols-3' : supplierNavGroups.length === 1 ? 'grid-cols-1' : 'grid-cols-2'}`}>
                  {supplierNavGroups.length > 0 ? supplierNavGroups.map((group) => (
                    <div key={group.value}>
                      <h3 className="text-sm font-bold text-stone-900 uppercase tracking-wider mb-3">{group.label}</h3>
                      <ul className="space-y-2">
                        {group.categories.map((item) => {
                          const to = `/materials?category=${encodeURIComponent(item.value)}`;
                          return (
                            <li key={item.value}>
                              <Link href={to} onClick={() => { setMaterialsDropdownOpen(false); handleClick(to); }} className="text-sm text-stone-600 hover:text-[#b8864a] transition">
                                {item.label}
                              </Link>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  )) : (() => {
                    const mid = Math.ceil(supplierNavUngrouped.length / 2);
                    return [supplierNavUngrouped.slice(0, mid), supplierNavUngrouped.slice(mid)].map((items, ci) => items.length === 0 ? null : (
                      <div key={ci}>
                        <ul className="space-y-2">
                          {items.map((item) => {
                            const to = `/materials?category=${encodeURIComponent(item.value)}`;
                            return (
                              <li key={item.value}>
                                <Link href={to} onClick={() => { setMaterialsDropdownOpen(false); handleClick(to); }} className="text-sm text-stone-600 hover:text-[#b8864a] transition">
                                  {item.label}
                                </Link>
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                    ));
                  })()}
                </div>
                <div className="border-t border-stone-200 px-6 py-4 bg-stone-50 rounded-b-lg flex flex-wrap items-center gap-x-6 gap-y-2">
                  <Link href="/materials?tab=suppliers" onClick={() => handleClick('/materials?tab=suppliers')} className="text-sm font-medium text-[#b8864a] hover:text-[#a07540] transition">
                    {tr.nav.allSuppliers} {'>'}
                  </Link>
                  {/* 中国新材料采购入口（AE 专属，业务转型新增） */}
                  <Link href="/materials/showroom" onClick={() => handleClick('/materials/showroom')} className="text-sm font-medium text-stone-600 hover:text-[#b8864a] transition">
                    Selection Center
                  </Link>
                  <Link href="/services/china-sourcing" onClick={() => handleClick('/services/china-sourcing')} className="text-sm font-medium text-stone-600 hover:text-[#b8864a] transition">
                    China Sourcing
                  </Link>
                  <Link href="/guarantee" onClick={() => handleClick('/guarantee')} className="text-sm font-medium text-stone-600 hover:text-[#b8864a] transition">
                    Local Guarantee
                  </Link>
                  <Link href="/for-designers" onClick={() => handleClick('/for-designers')} className="text-sm font-medium text-stone-600 hover:text-[#b8864a] transition">
                    For Designers
                  </Link>
                </div>
              </div>
            </div>
          </div>

          {/* Mall 入口 */}
          <Link
            href="/mall"
            onClick={() => handleClick('/mall')}
            className="text-base font-medium text-[#2c2c2c]/80 hover:text-[#2c2c2c] transition"
          >
            Mall
          </Link>

          {showUserEntry ? (
            <div className="flex items-center gap-3">
              {activeRole === 'admin' && <NotificationBell />}
              <UserMenu userName={userName} userAvatar={userAvatar} dashboardTo={accountEntry.to} onNavigate={handleClick} />
            </div>
          ) : showLogInLink ? (
            <Link href="/auth" onClick={() => handleClick('/auth')} className="inline-flex items-center gap-1.5 text-base font-medium text-[#2c2c2c]/80 hover:text-[#2c2c2c] transition">
              <User className="w-4 h-4" />
              {tr.nav.logIn}
            </Link>
          ) : null}
          {showJoinAsCompany && (
            <Link href="/for-companies" onClick={() => handleClick('/for-companies')} className="ml-2 inline-flex items-center gap-1.5 rounded-lg border border-stone-300 px-4 py-2 text-base font-medium text-[#2c2c2c] hover:bg-stone-50 transition">
              <Briefcase className="w-4 h-4" />
              {tr.nav.joinAsCompany}
            </Link>
          )}
        </nav>

        <div className="flex items-center gap-2 md:hidden">
          {showJoinAsCompany && (
            <Link href="/for-companies" className="inline-flex items-center gap-1 rounded-lg border border-stone-300 px-3 py-2 text-sm font-medium text-[#2c2c2c] hover:bg-stone-50 transition">
              <Briefcase className="w-3.5 h-3.5" />
              {tr.nav.joinAsCompany}
            </Link>
          )}
          <button type="button" onClick={() => setOpen((o) => !o)} className="p-2 rounded-lg hover:bg-stone-100" aria-label="Toggle menu">
            {open ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </div>

      {open && (
        <div className="md:hidden border-t border-stone-200 bg-white">
          <div className="max-w-6xl mx-auto px-4 py-4 flex flex-col gap-2">
            {navLinks.map(({ to, label }) => (
              <Fragment key={to}>{renderNavLink(to, label, 'py-2')}</Fragment>
            ))}

            {/* Mobile Mall 入口 */}
            {renderNavLink('/mall', 'Mall', 'py-2')}

            {/* Mobile Find Company */}
            <div className="py-2">
              <div className="flex items-center justify-between">
                <Link href="/companies" onClick={() => handleClick('/companies')} className="text-base font-medium text-[#2c2c2c]/80 hover:text-[#2c2c2c] transition">
                  {tr.nav.findCompany}
                </Link>
                <button onClick={() => setDropdownOpen(!dropdownOpen)} className="p-1 text-[#2c2c2c]/60 hover:text-[#2c2c2c] transition">
                  <ChevronDown className={`w-4 h-4 transition-transform ${dropdownOpen ? 'rotate-180' : ''}`} />
                </button>
              </div>
              {dropdownOpen && (
                <div className="mt-3 pl-4 space-y-4">
                  <div>
                    <h4 className="text-xs font-bold text-stone-900 uppercase tracking-wider mb-2">{tr.nav.spaceType}</h4>
                    {spaceTypes.map((item) => (
                      <Link key={item.to} href={item.to} onClick={() => handleClick(item.to)} className="text-sm text-stone-600 hover:text-[#b8864a] transition block py-1">
                        {spaceLabel(item.key)}
                      </Link>
                    ))}
                  </div>
                  <div className="border-t border-stone-200 pt-2">
                    <Link href="/companies" onClick={() => handleClick('/companies')} className="text-sm font-medium text-[#b8864a] hover:text-[#a07540] transition block py-1">
                      {tr.nav.allCompanies} {'>'}
                    </Link>
                  </div>
                </div>
              )}
            </div>

            {/* Mobile Materials */}
            <div className="py-2">
              <div className="flex items-center justify-between">
                <Link href="/materials" onClick={() => handleClick('/materials')} className="text-base font-medium text-[#2c2c2c]/80 hover:text-[#2c2c2c] transition">
                  {tr.nav.materials}
                </Link>
                <button onClick={() => setMaterialsDropdownOpen(!materialsDropdownOpen)} className="p-1 text-[#2c2c2c]/60 hover:text-[#2c2c2c] transition">
                  <ChevronDown className={`w-4 h-4 transition-transform ${materialsDropdownOpen ? 'rotate-180' : ''}`} />
                </button>
              </div>
              {materialsDropdownOpen && (
                <div className="mt-3 pl-4 space-y-4">
                  {supplierNavGroups.length > 0 ? supplierNavGroups.map((group) => (
                    <div key={group.value}>
                      <h3 className="text-xs font-bold text-stone-900 uppercase tracking-wider mb-2">{group.label}</h3>
                      <ul className="space-y-1">
                        {group.categories.map((item) => {
                          const to = `/materials?category=${encodeURIComponent(item.value)}`;
                          return (
                            <li key={item.value}>
                              <Link href={to} onClick={() => handleClick(to)} className="text-sm text-stone-600 hover:text-[#b8864a] transition block py-1">
                                {item.label}
                              </Link>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  )) : supplierNavUngrouped.map((item) => {
                    const to = `/materials?category=${encodeURIComponent(item.value)}`;
                    return (
                      <Link key={item.value} href={to} onClick={() => handleClick(to)} className="text-sm text-stone-600 hover:text-[#b8864a] transition block py-1">
                        {item.label}
                      </Link>
                    );
                  })}
                  <div className="border-t border-stone-200 pt-2">
                    <Link href="/materials?tab=suppliers" onClick={() => handleClick('/materials?tab=suppliers')} className="text-sm font-medium text-[#b8864a] hover:text-[#a07540] transition block py-1">
                      {tr.nav.allSuppliers} {'>'}
                    </Link>
                    {/* 中国新材料采购入口（AE 专属，业务转型新增） */}
                    <Link href="/materials/showroom" onClick={() => handleClick('/materials/showroom')} className="text-sm text-stone-600 hover:text-[#b8864a] transition block py-1">
                      Selection Center
                    </Link>
                    <Link href="/services/china-sourcing" onClick={() => handleClick('/services/china-sourcing')} className="text-sm text-stone-600 hover:text-[#b8864a] transition block py-1">
                      China Sourcing
                    </Link>
                    <Link href="/guarantee" onClick={() => handleClick('/guarantee')} className="text-sm text-stone-600 hover:text-[#b8864a] transition block py-1">
                      Local Guarantee
                    </Link>
                    <Link href="/for-designers" onClick={() => handleClick('/for-designers')} className="text-sm text-stone-600 hover:text-[#b8864a] transition block py-1">
                      For Designers
                    </Link>
                  </div>
                </div>
              )}
            </div>

            {isLoggedIn ? (
              <Link href={accountEntry.to} onClick={() => handleClick(accountEntry.to)} className="py-2 inline-flex items-center gap-2 text-base font-medium text-[#2c2c2c]/80 hover:text-[#2c2c2c] transition">
                <Avatar name={userName} avatarUrl={userAvatar} size="sm" />
                {tr.nav.dashboard}
              </Link>
            ) : (
              renderNavLink(accountEntry.to, accountEntry.label, 'py-2')
            )}
          </div>
        </div>
      )}
    </header>
  );
}

function UserMenu({ userName, userAvatar, dashboardTo, onNavigate }: {
  userName: string; userAvatar: string; dashboardTo: string; onNavigate: (to: string) => void;
}) {
  const { tr } = useSiteLocale();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    const handler = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleLogout = () => {
    api.clearToken();
    localStorage.removeItem('user');
    localStorage.removeItem('active_role');
    localStorage.removeItem('designer');
    setOpen(false);
    router.replace('/auth');
  };

  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen(!open)} className="inline-flex items-center" aria-label="User menu">
        <Avatar name={userName} avatarUrl={userAvatar} size="sm" />
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-2 w-48 bg-white rounded-xl shadow-xl border border-stone-200 z-50 py-1">
          <Link href={dashboardTo} onClick={() => { onNavigate(dashboardTo); setOpen(false); }} className="flex items-center gap-3 px-4 py-2.5 text-sm text-stone-700 hover:bg-stone-50 transition">
            <LayoutDashboard className="w-4 h-4 text-stone-400" />{tr.nav.dashboard}
          </Link>
          <div className="border-t border-stone-100 my-1" />
          <button onClick={handleLogout} className="flex items-center gap-3 w-full px-4 py-2.5 text-sm text-stone-700 hover:bg-stone-50 transition text-left">
            <LogOut className="w-4 h-4 text-stone-400" />{tr.nav.logOut}
          </button>
        </div>
      )}
    </div>
  );
}
