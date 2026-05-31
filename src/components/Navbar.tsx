'use client';

import { Fragment, useState, useRef, useEffect, useLayoutEffect } from 'react';
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

const spaceTypeItems = [
  { label: 'Villa', to: '/companies?style=Villa' },
  { label: 'Apartment', to: '/companies?style=Apartment' },
  { label: 'Commercial', to: '/companies?style=Commercial' },
  { label: 'Public / Institutional', to: '/companies?style=Office' },
  { label: 'Outdoor / Landscape', to: '/companies?service=Landscape' },
];

const API_BASE = process.env.NEXT_PUBLIC_API_URL?.trim() || '/api';

const portfolioCategories = {
  'By Room': [
    { label: 'Living Room', to: '/portfolio?tag=Living+Room' },
    { label: 'Bedroom', to: '/portfolio?tag=Bedroom' },
    { label: 'Kitchen', to: '/portfolio?tag=Kitchen' },
    { label: 'Bathroom', to: '/portfolio?tag=Bathroom' },
    { label: 'Dining Room', to: '/portfolio?tag=Dining+Room' },
    { label: 'Office', to: '/portfolio?tag=Office' },
    { label: 'Hallway', to: '/portfolio?tag=Hallway' },
    { label: 'Outdoor', to: '/portfolio?tag=Outdoor' },
  ],
  'By Style': [
    { label: 'Modern', to: '/portfolio?tag=Modern' },
    { label: 'Luxury', to: '/portfolio?tag=Luxury' },
    { label: 'Minimalist', to: '/portfolio?tag=Minimalist' },
    { label: 'Classical', to: '/portfolio?tag=Classical' },
    { label: 'Arabic', to: '/portfolio?tag=Arabic' },
    { label: 'Industrial', to: '/portfolio?tag=Industrial' },
    { label: 'Scandinavian', to: '/portfolio?tag=Scandinavian' },
    { label: 'Art Deco', to: '/portfolio?tag=Art+Deco' },
  ],
};

const navLinks = [{ to: '/', label: 'Home' }];

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
  const [open, setOpen] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [portfolioDropdownOpen, setPortfolioDropdownOpen] = useState(false);
  const [materialsDropdownOpen, setMaterialsDropdownOpen] = useState(false);
  const [hoveredCategory, setHoveredCategory] = useState<string | null>(null);
  const [navCategories, setNavCategories] = useState<{ name: string; subs: string[] }[]>([]);
  const [supplierNavCategories, setSupplierNavCategories] = useState<{ label: string; value: string }[]>([]);
  const { handleNavClick } = useNavigationHandler();
  const pathname = usePathname();
  const isAuthPage = pathname === '/auth' || pathname === '/login' || pathname === '/register';
  const isPortalPage = pathname.startsWith('/company') || pathname.startsWith('/supplier') || pathname.startsWith('/auth/callback') || pathname.startsWith('/admin');

  const dropdownPanelRef = useRef<HTMLDivElement>(null);
  const [dropdownLeft, setDropdownLeft] = useState(0);

  useLayoutEffect(() => {
    if (!dropdownOpen) { setHoveredCategory(null); setDropdownLeft(0); return; }
    setHoveredCategory((prev) => prev ?? navCategories[0]?.name ?? null);
    const el = dropdownPanelRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const overflow = rect.right - (window.innerWidth - 60);
    setDropdownLeft(overflow > 0 ? -overflow : 0);
  }, [dropdownOpen, navCategories]);

  useEffect(() => {
    fetch(`${API_BASE}/public/service-categories`)
      .then((r) => r.json())
      .then((d: unknown) => {
        const data = d as { categories?: { name: string; subs: string[] }[] };
        if (Array.isArray(data?.categories)) setNavCategories(data.categories);
      })
      .catch(() => {});
    fetch(`${API_BASE}/public/supplier-categories`)
      .then((r) => r.json())
      .then((d: unknown) => {
        const data = d as { categories?: { label: string; value: string }[] };
        if (Array.isArray(data?.categories)) setSupplierNavCategories(data.categories);
      })
      .catch(() => {});
  }, []);

  if ((isAuthPage && !forceShowOnAuth) || isPortalPage) return null;

  const isLoggedIn = Boolean(api.getToken());
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
    setPortfolioDropdownOpen(false);
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

          {/* Portfolio Dropdown */}
          <div
            className="relative"
            onMouseEnter={() => setPortfolioDropdownOpen(true)}
            onMouseLeave={() => setPortfolioDropdownOpen(false)}
          >
            <Link
              href="/portfolio"
              onClick={() => { setPortfolioDropdownOpen(false); handleClick('/portfolio'); }}
              className="inline-flex items-center gap-1.5 text-base font-medium text-[#2c2c2c]/80 hover:text-[#2c2c2c] transition"
            >
              Portfolio
              <ChevronDown className={`w-4 h-4 transition-transform ${portfolioDropdownOpen ? 'rotate-180' : ''}`} />
            </Link>
            <div className={`absolute top-full left-0 pt-2 w-max z-50 transition-all duration-150 ${portfolioDropdownOpen ? 'opacity-100 translate-y-0 pointer-events-auto' : 'opacity-0 -translate-y-2 pointer-events-none'}`}>
              <div className="bg-white shadow-xl rounded-lg border border-stone-200">
                <div className="p-6 grid grid-cols-2 gap-8 min-w-max">
                  {Object.entries(portfolioCategories).map(([category, items]) => (
                    <div key={category}>
                      <h3 className="text-sm font-bold text-stone-900 uppercase tracking-wider mb-3">{category}</h3>
                      <ul className="space-y-2">
                        {items.map((item) => (
                          <li key={item.to}>
                            <Link href={item.to} onClick={() => handleClick(item.to)} className="text-sm text-stone-600 hover:text-[#b8864a] transition">
                              {item.label}
                            </Link>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
                <div className="border-t border-stone-200 px-6 py-4 bg-stone-50 rounded-b-lg">
                  <Link href="/portfolio" onClick={() => handleClick('/portfolio')} className="text-sm font-medium text-[#b8864a] hover:text-[#a07540] transition">
                    All Projects {'>'}
                  </Link>
                </div>
              </div>
            </div>
          </div>

          {/* Find Company Dropdown */}
          <div
            className="relative"
            onMouseEnter={() => setDropdownOpen(true)}
            onMouseLeave={() => { setDropdownOpen(false); setHoveredCategory(null); }}
          >
            <Link
              href="/companies"
              onClick={() => { setDropdownOpen(false); handleClick('/companies'); }}
              className="inline-flex items-center gap-1.5 text-base font-medium text-[#2c2c2c]/80 hover:text-[#2c2c2c] transition"
            >
              Find Company
              <ChevronDown className={`w-4 h-4 transition-transform ${dropdownOpen ? 'rotate-180' : ''}`} />
            </Link>
            <div
              className={`absolute top-full pt-2 z-50 transition-all duration-150 ${dropdownOpen ? 'opacity-100 translate-y-0 pointer-events-auto' : 'opacity-0 -translate-y-2 pointer-events-none'}`}
              style={{ left: dropdownLeft }}
            >
              <div ref={dropdownPanelRef} className="bg-white shadow-xl rounded-lg border border-stone-200 overflow-hidden">
                <div className="flex">
                  <div className="p-6 w-48 border-r border-stone-100 flex-shrink-0">
                    <h3 className="text-xs font-bold text-stone-900 uppercase tracking-wider mb-3">Space Type</h3>
                    <ul className="space-y-2">
                      {spaceTypeItems.map((item) => (
                        <li key={item.to}>
                          <Link href={item.to} onClick={() => handleClick(item.to)} className="text-sm text-stone-600 hover:text-[#b8864a] transition block">
                            {item.label}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className="p-6 w-52 border-r border-stone-100 flex-shrink-0">
                    <h3 className="text-xs font-bold text-stone-900 uppercase tracking-wider mb-3">Service Type</h3>
                    <ul className="space-y-1">
                      {navCategories.map((cat) => (
                        <li key={cat.name}>
                          <button
                            onMouseEnter={() => setHoveredCategory(cat.name)}
                            className={`w-full flex items-center justify-between px-2 py-1.5 rounded text-sm transition text-left ${
                              hoveredCategory === cat.name ? 'bg-stone-50 text-[#b8864a]' : 'text-stone-600 hover:bg-stone-50 hover:text-[#b8864a]'
                            }`}
                          >
                            {cat.name}
                            {cat.subs.length > 0 && <span className="text-stone-300 text-xs ml-2">›</span>}
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                  {(() => {
                    const tallest = navCategories.reduce((a, b) => b.subs.length > a.subs.length ? b : a, { name: '', subs: [] as string[] });
                    return (
                      <div className="w-[220px] flex-shrink-0 border-l border-stone-100 relative">
                        <div className="p-6 invisible pointer-events-none" aria-hidden="true">
                          <h3 className="text-xs font-bold uppercase tracking-wider mb-3">x</h3>
                          <ul className="space-y-2">
                            {tallest.subs.map((svc) => (
                              <li key={svc}><span className="text-sm block">{svc}</span></li>
                            ))}
                          </ul>
                        </div>
                        {navCategories.map((cat) => (
                          <div
                            key={cat.name}
                            className={`absolute inset-0 p-6 transition-opacity duration-150 ${hoveredCategory === cat.name ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
                          >
                            <h3 className="text-xs font-bold text-stone-900 uppercase tracking-wider mb-3">{cat.name}</h3>
                            <ul className="space-y-2">
                              {cat.subs.map((svc) => (
                                <li key={svc}>
                                  <Link
                                    href={`/companies?service=${encodeURIComponent(svc)}`}
                                    onClick={() => handleClick(`/companies?service=${encodeURIComponent(svc)}`)}
                                    className="text-sm text-stone-600 hover:text-[#b8864a] transition block"
                                  >
                                    {svc}
                                  </Link>
                                </li>
                              ))}
                            </ul>
                          </div>
                        ))}
                      </div>
                    );
                  })()}
                </div>
                <div className="border-t border-stone-200 px-6 py-3 bg-stone-50">
                  <Link href="/companies" onClick={() => handleClick('/companies')} className="text-sm font-medium text-[#b8864a] hover:text-[#a07540] transition">
                    All Companies {'>'}
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
              Materials
              <ChevronDown className={`w-4 h-4 transition-transform ${materialsDropdownOpen ? 'rotate-180' : ''}`} />
            </Link>
            <div className={`absolute top-full right-0 pt-2 w-max z-50 transition-all duration-150 ${materialsDropdownOpen ? 'opacity-100 translate-y-0 pointer-events-auto' : 'opacity-0 -translate-y-2 pointer-events-none'}`}>
              <div className="bg-white shadow-xl rounded-lg border border-stone-200">
                <div className="p-6 grid grid-cols-2 gap-8 min-w-max">
                  {(() => {
                    const mid = Math.ceil(supplierNavCategories.length / 2);
                    const cols = [supplierNavCategories.slice(0, mid), supplierNavCategories.slice(mid)];
                    const colLabels = ['Materials', 'More'];
                    return cols.map((items, ci) => items.length === 0 ? null : (
                      <div key={ci}>
                        <h3 className="text-sm font-bold text-stone-900 uppercase tracking-wider mb-3">{colLabels[ci]}</h3>
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
                <div className="border-t border-stone-200 px-6 py-4 bg-stone-50 rounded-b-lg">
                  <Link href="/materials" onClick={() => handleClick('/materials')} className="text-sm font-medium text-[#b8864a] hover:text-[#a07540] transition">
                    All Suppliers {'>'}
                  </Link>
                </div>
              </div>
            </div>
          </div>

          {showUserEntry ? (
            <div className="flex items-center gap-3">
              {activeRole === 'admin' && <NotificationBell />}
              <UserMenu userName={userName} userAvatar={userAvatar} dashboardTo={accountEntry.to} onNavigate={handleClick} />
            </div>
          ) : showLogInLink ? (
            <Link href="/auth" onClick={() => handleClick('/auth')} className="inline-flex items-center gap-1.5 text-base font-medium text-[#2c2c2c]/80 hover:text-[#2c2c2c] transition">
              <User className="w-4 h-4" />
              Log In
            </Link>
          ) : null}
          {showJoinAsCompany && (
            <Link href="/for-companies" onClick={() => handleClick('/for-companies')} className="ml-2 inline-flex items-center gap-1.5 rounded-lg border border-stone-300 px-4 py-2 text-base font-medium text-[#2c2c2c] hover:bg-stone-50 transition">
              <Briefcase className="w-4 h-4" />
              Join as Company
            </Link>
          )}
        </nav>

        <div className="flex items-center gap-2 md:hidden">
          {showJoinAsCompany && (
            <Link href="/for-companies" className="inline-flex items-center gap-1 rounded-lg border border-stone-300 px-3 py-2 text-sm font-medium text-[#2c2c2c] hover:bg-stone-50 transition">
              <Briefcase className="w-3.5 h-3.5" />
              Join as Company
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

            {/* Mobile Portfolio */}
            <div className="py-2">
              <button onClick={() => setPortfolioDropdownOpen(!portfolioDropdownOpen)} className="inline-flex items-center gap-1.5 text-base font-medium text-[#2c2c2c]/80 hover:text-[#2c2c2c] transition">
                Portfolio
                <ChevronDown className={`w-4 h-4 transition-transform ${portfolioDropdownOpen ? 'rotate-180' : ''}`} />
              </button>
              {portfolioDropdownOpen && (
                <div className="mt-3 pl-4 space-y-4">
                  {Object.entries(portfolioCategories).map(([category, items]) => (
                    <div key={category}>
                      <h3 className="text-xs font-bold text-stone-900 uppercase tracking-wider mb-2">{category}</h3>
                      <ul className="space-y-1">
                        {items.map((item) => (
                          <li key={item.to}>
                            <Link href={item.to} onClick={() => handleClick(item.to)} className="text-sm text-stone-600 hover:text-[#b8864a] transition block py-1">
                              {item.label}
                            </Link>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                  <div className="border-t border-stone-200 pt-2">
                    <Link href="/portfolio" onClick={() => handleClick('/portfolio')} className="text-sm font-medium text-[#b8864a] hover:text-[#a07540] transition block py-1">
                      All Projects {'>'}
                    </Link>
                  </div>
                </div>
              )}
            </div>

            {/* Mobile Find Company */}
            <div className="py-2">
              <div className="flex items-center justify-between">
                <Link href="/companies" onClick={() => handleClick('/companies')} className="text-base font-medium text-[#2c2c2c]/80 hover:text-[#2c2c2c] transition">
                  Find Company
                </Link>
                <button onClick={() => setDropdownOpen(!dropdownOpen)} className="p-1 text-[#2c2c2c]/60 hover:text-[#2c2c2c] transition">
                  <ChevronDown className={`w-4 h-4 transition-transform ${dropdownOpen ? 'rotate-180' : ''}`} />
                </button>
              </div>
              {dropdownOpen && (
                <div className="mt-3 pl-4 space-y-4">
                  <div>
                    <h4 className="text-xs font-bold text-stone-900 uppercase tracking-wider mb-2">Space Type</h4>
                    {spaceTypeItems.map((item) => (
                      <Link key={item.to} href={item.to} onClick={() => handleClick(item.to)} className="text-sm text-stone-600 hover:text-[#b8864a] transition block py-1">
                        {item.label}
                      </Link>
                    ))}
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-stone-900 uppercase tracking-wider mb-2">Service Type</h4>
                    {navCategories.map((cat) => (
                      <div key={cat.name} className="py-1">
                        <p className="text-xs font-semibold text-stone-500 mb-1">{cat.name}</p>
                        {cat.subs.map((svc: string) => (
                          <Link key={svc} href={`/companies?service=${encodeURIComponent(svc)}`} onClick={() => handleClick(`/companies?service=${encodeURIComponent(svc)}`)} className="text-sm text-stone-600 hover:text-[#b8864a] transition block py-0.5 pl-2">
                            {svc}
                          </Link>
                        ))}
                      </div>
                    ))}
                  </div>
                  <div className="border-t border-stone-200 pt-2">
                    <Link href="/companies" onClick={() => handleClick('/companies')} className="text-sm font-medium text-[#b8864a] hover:text-[#a07540] transition block py-1">
                      All Companies {'>'}
                    </Link>
                  </div>
                </div>
              )}
            </div>

            {/* Mobile Materials */}
            <div className="py-2">
              <div className="flex items-center justify-between">
                <Link href="/materials" onClick={() => handleClick('/materials')} className="text-base font-medium text-[#2c2c2c]/80 hover:text-[#2c2c2c] transition">
                  Materials
                </Link>
                <button onClick={() => setMaterialsDropdownOpen(!materialsDropdownOpen)} className="p-1 text-[#2c2c2c]/60 hover:text-[#2c2c2c] transition">
                  <ChevronDown className={`w-4 h-4 transition-transform ${materialsDropdownOpen ? 'rotate-180' : ''}`} />
                </button>
              </div>
              {materialsDropdownOpen && (
                <div className="mt-3 pl-4 space-y-4">
                  {(() => {
                    const mid = Math.ceil(supplierNavCategories.length / 2);
                    const cols = [supplierNavCategories.slice(0, mid), supplierNavCategories.slice(mid)];
                    const colLabels = ['Materials', 'More'];
                    return cols.map((items, ci) => items.length === 0 ? null : (
                      <div key={ci}>
                        <h3 className="text-xs font-bold text-stone-900 uppercase tracking-wider mb-2">{colLabels[ci]}</h3>
                        <ul className="space-y-1">
                          {items.map((item) => {
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
                    ));
                  })()}
                  <div className="border-t border-stone-200 pt-2">
                    <Link href="/materials" onClick={() => handleClick('/materials')} className="text-sm font-medium text-[#b8864a] hover:text-[#a07540] transition block py-1">
                      All Suppliers {'>'}
                    </Link>
                  </div>
                </div>
              )}
            </div>

            {isLoggedIn ? (
              <Link href={accountEntry.to} onClick={() => handleClick(accountEntry.to)} className="py-2 inline-flex items-center gap-2 text-base font-medium text-[#2c2c2c]/80 hover:text-[#2c2c2c] transition">
                <Avatar name={userName} avatarUrl={userAvatar} size="sm" />
                Dashboard
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
            <LayoutDashboard className="w-4 h-4 text-stone-400" />Dashboard
          </Link>
          <div className="border-t border-stone-100 my-1" />
          <button onClick={handleLogout} className="flex items-center gap-3 w-full px-4 py-2.5 text-sm text-stone-700 hover:bg-stone-50 transition text-left">
            <LogOut className="w-4 h-4 text-stone-400" />Log out
          </button>
        </div>
      )}
    </div>
  );
}
