import { Fragment, useState, useRef, useEffect, useLayoutEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Menu, X, User, Briefcase, ChevronDown, LayoutDashboard, LogOut } from 'lucide-react';
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

const API_BASE = (import.meta as any).env?.VITE_API_URL?.trim() || '/api';

const portfolioCategories = {
  'By Room': [
    { label: 'Living Room', to: '/portfolio?tag=Living+Room' },
    { label: 'Bedroom',     to: '/portfolio?tag=Bedroom' },
    { label: 'Kitchen',     to: '/portfolio?tag=Kitchen' },
    { label: 'Bathroom',    to: '/portfolio?tag=Bathroom' },
    { label: 'Dining Room', to: '/portfolio?tag=Dining+Room' },
    { label: 'Home Office', to: '/portfolio?tag=Home+Office' },
    { label: 'Majlis',      to: '/portfolio?tag=Majlis' },
    { label: 'Hallway',     to: '/portfolio?tag=Hallway' },
    { label: 'Outdoor',     to: '/portfolio?tag=Outdoor' },
  ],
  'By Style': [
    { label: 'Modern',       to: '/portfolio?tag=Modern' },
    { label: 'Luxury',       to: '/portfolio?tag=Luxury' },
    { label: 'Minimalist',   to: '/portfolio?tag=Minimalist' },
    { label: 'Classical',    to: '/portfolio?tag=Classical' },
    { label: 'Arabic',       to: '/portfolio?tag=Arabic' },
    { label: 'Industrial',   to: '/portfolio?tag=Industrial' },
    { label: 'Scandinavian', to: '/portfolio?tag=Scandinavian' },
    { label: 'Coastal',      to: '/portfolio?tag=Coastal' },
    { label: 'Art Deco',     to: '/portfolio?tag=Art+Deco' },
    { label: 'Bohemian',     to: '/portfolio?tag=Bohemian' },
  ],
};


const navLinks = [
  { to: '/', label: 'Home' },
];

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
  const [findCompanySearch, setFindCompanySearch] = useState('');
  const [portfolioSearch, setPortfolioSearch] = useState('');
  const [materialsSearch, setMaterialsSearch] = useState('');
  const [hoveredCategory, setHoveredCategory] = useState<string | null>(null);
  const [navCategories, setNavCategories] = useState<{ name: string; subs: string[] }[]>([]);
  const [supplierNavGroups, setSupplierNavGroups] = useState<{ value: string; label: string; categories: { label: string; value: string }[] }[]>([]);
  const [supplierNavUngrouped, setSupplierNavUngrouped] = useState<{ label: string; value: string }[]>([]);
  const { handleNavClick } = useNavigationHandler();
  const location = useLocation();
  const isAuthPage = location.pathname === '/auth' || location.pathname === '/login' || location.pathname === '/register';

  // Dropdown overflow fix: measure panel width and clamp so right edge stays 40px from viewport
  const dropdownPanelRef = useRef<HTMLDivElement>(null);
  const [dropdownLeft, setDropdownLeft] = useState(0);

  // useLayoutEffect runs synchronously before browser paint — no visible jump
  useLayoutEffect(() => {
    if (!dropdownOpen) { setHoveredCategory(null); setDropdownLeft(0); return; }
    // Auto-select first category so the third column is never blank (industry standard)
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
      .then((d) => { if (Array.isArray(d?.categories)) setNavCategories(d.categories); })
      .catch(() => {});
    fetch(`${API_BASE}/public/supplier-categories`)
      .then(r => r.json())
      .then(data => {
        setSupplierNavGroups(data.groups || []);
        setSupplierNavUngrouped(data.ungrouped || []);
      })
      .catch(() => {});
  }, []);

  // Hide navbar completely on auth page
  if (isAuthPage && !forceShowOnAuth) return null;

  const isLoggedIn = Boolean(api.getToken());
  const user = safeGetJSON<Record<string, unknown>>('user') || safeGetJSON<Record<string, unknown>>('designer');
  const activeRole = localStorage.getItem('active_role');
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

    // Route to correct dashboard based on active_role
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
    setFindCompanySearch('');
    setPortfolioSearch('');
    setMaterialsSearch('');
  };

  const renderNavLink = (to: string, label: string, extraClasses = '') => (
    <Link
      to={to}
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
              to="/portfolio"
              onClick={() => { setPortfolioDropdownOpen(false); handleClick('/portfolio'); }}
              className="inline-flex items-center gap-1.5 text-base font-medium text-[#2c2c2c]/80 hover:text-[#2c2c2c] transition"
            >
              Portfolio
              <ChevronDown className={`w-4 h-4 transition-transform ${portfolioDropdownOpen ? 'rotate-180' : ''}`} />
            </Link>

            <div
                className={`absolute top-full left-0 pt-2 w-max z-50 transition-all duration-150 ${portfolioDropdownOpen ? 'opacity-100 translate-y-0 pointer-events-auto' : 'opacity-0 -translate-y-2 pointer-events-none'}`}
              >
              <div className="bg-white shadow-xl rounded-lg border border-stone-200">
                  <div className="p-6 grid grid-cols-2 gap-8 min-w-max">
                    {Object.entries(portfolioCategories).map(([category, items]) => (
                      <div key={category}>
                        <h3 className="text-sm font-bold text-stone-900 uppercase tracking-wider mb-3">
                          {category}
                        </h3>
                        <ul className="space-y-2">
                          {items.map((item) => (
                            <li key={item.to}>
                              <Link
                                to={item.to}
                                onClick={() => handleClick(item.to)}
                                className="text-sm text-stone-600 hover:text-[#b8864a] transition"
                              >
                                {item.label}
                              </Link>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                  <div className="border-t border-stone-200 px-6 py-4 bg-stone-50 rounded-b-lg">
                    <Link
                      to="/portfolio"
                      onClick={() => handleClick('/portfolio')}
                      className="text-sm font-medium text-[#b8864a] hover:text-[#a07540] transition"
                    >
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
              to="/companies"
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
                  {/* SPACE TYPE */}
                  <div className="p-6 w-48 border-r border-stone-100 flex-shrink-0">
                    <h3 className="text-xs font-bold text-stone-900 uppercase tracking-wider mb-3">Space Type</h3>
                    <ul className="space-y-2">
                      {spaceTypeItems.map((item) => (
                        <li key={item.to}>
                          <Link
                            to={item.to}
                            onClick={() => handleClick(item.to)}
                            className="text-sm text-stone-600 hover:text-[#b8864a] transition block"
                          >
                            {item.label}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* SERVICE TYPE */}
                  <div className="p-6 w-52 border-r border-stone-100 flex-shrink-0">
                    <h3 className="text-xs font-bold text-stone-900 uppercase tracking-wider mb-3">Service Type</h3>
                    <ul className="space-y-1">
                      {navCategories.map((cat) => (
                        <li key={cat.name}>
                          <button
                            onMouseEnter={() => setHoveredCategory(cat.name)}
                            className={`w-full flex items-center justify-between px-2 py-1.5 rounded text-sm transition text-left ${
                              hoveredCategory === cat.name
                                ? 'bg-stone-50 text-[#b8864a]'
                                : 'text-stone-600 hover:bg-stone-50 hover:text-[#b8864a]'
                            }`}
                          >
                            {cat.name}
                            {cat.subs.length > 0 && <span className="text-stone-300 text-xs ml-2">›</span>}
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* SUB-SERVICES — invisible spacer (normal flow) sets height = tallest category; actual content absolute + crossfades */}
                  {(() => {
                    const tallest = navCategories.reduce((a, b) => b.subs.length > a.subs.length ? b : a, { name: '', subs: [] as string[] });
                    return (
                      <div className="w-[220px] flex-shrink-0 border-l border-stone-100 relative">
                        {/* Spacer: invisible, in normal flow — makes container as tall as the tallest category */}
                        <div className="p-6 invisible pointer-events-none" aria-hidden="true">
                          <h3 className="text-xs font-bold uppercase tracking-wider mb-3">x</h3>
                          <ul className="space-y-2">
                            {tallest.subs.map((svc) => (
                              <li key={svc}><span className="text-sm block">{svc}</span></li>
                            ))}
                          </ul>
                        </div>
                        {/* Actual content: absolute, crossfades between categories */}
                        {navCategories.map((cat) => (
                          <div
                            key={cat.name}
                            className={`absolute inset-0 p-6 transition-opacity duration-150 ${
                              hoveredCategory === cat.name ? 'opacity-100' : 'opacity-0 pointer-events-none'
                            }`}
                          >
                            <h3 className="text-xs font-bold text-stone-900 uppercase tracking-wider mb-3">
                              {cat.name}
                            </h3>
                            <ul className="space-y-2">
                              {cat.subs.map((svc) => (
                                <li key={svc}>
                                  <Link
                                    to={`/companies?service=${encodeURIComponent(svc)}`}
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
                  <Link
                    to="/companies"
                    onClick={() => handleClick('/companies')}
                    className="text-sm font-medium text-[#b8864a] hover:text-[#a07540] transition"
                  >
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
              to="/materials"
              onClick={() => { setMaterialsDropdownOpen(false); handleClick('/materials'); }}
              className="inline-flex items-center gap-1.5 text-base font-medium text-[#2c2c2c]/80 hover:text-[#2c2c2c] transition"
            >
              Materials
              <ChevronDown className={`w-4 h-4 transition-transform ${materialsDropdownOpen ? 'rotate-180' : ''}`} />
            </Link>

            <div
              className={`absolute top-full right-0 pt-2 w-max z-50 transition-all duration-150 ${materialsDropdownOpen ? 'opacity-100 translate-y-0 pointer-events-auto' : 'opacity-0 -translate-y-2 pointer-events-none'}`}
            >
              <div className="bg-white shadow-xl rounded-lg border border-stone-200">
                <div className="p-6 flex gap-8 min-w-max">
                  {supplierNavGroups.filter(g => g.categories.length > 0).map(g => (
                    <div key={g.value}>
                      <h3 className="text-sm font-bold text-stone-900 uppercase tracking-wider mb-3">{g.label}</h3>
                      <ul className="space-y-2">
                        {g.categories.map(item => {
                          const to = `/materials?category=${encodeURIComponent(item.value)}`;
                          return (
                            <li key={item.value}>
                              <Link
                                to={to}
                                onClick={() => { setMaterialsDropdownOpen(false); handleClick(to); }}
                                className="text-sm text-stone-600 hover:text-[#b8864a] transition"
                              >
                                {item.label}
                              </Link>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  ))}
                </div>
                <div className="border-t border-stone-200 px-6 py-4 bg-stone-50 rounded-b-lg">
                  <Link
                    to="/materials"
                    onClick={() => handleClick('/materials')}
                    className="text-sm font-medium text-[#b8864a] hover:text-[#a07540] transition"
                  >
                    All Suppliers {'>'}
                  </Link>
                </div>
              </div>
            </div>
          </div>

          {showUserEntry ? (
            <div className="flex items-center gap-3">
              {activeRole === 'admin' && <NotificationBell />}
              <UserMenu
                userName={userName}
                userAvatar={userAvatar}
                dashboardTo={accountEntry.to}
                onNavigate={handleClick}
              />
            </div>
          ) : showLogInLink ? (
            <Link
              to="/auth"
              onClick={() => handleClick('/auth')}
              className="inline-flex items-center gap-1.5 text-base font-medium text-[#2c2c2c]/80 hover:text-[#2c2c2c] transition"
            >
              <User className="w-4 h-4" />
              Log In
            </Link>
          ) : null}
          {showJoinAsCompany && (
            <Link
              to="/for-companies"
              onClick={() => handleClick('/for-companies')}
              className="ml-2 inline-flex items-center gap-1.5 rounded-lg border border-stone-300 px-4 py-2 text-base font-medium text-[#2c2c2c] hover:bg-stone-50 transition"
            >
              <Briefcase className="w-4 h-4" />
              Join as Company
            </Link>
          )}
        </nav>

        <div className="flex items-center gap-2 md:hidden">
          {showJoinAsCompany && (
            <Link to="/for-companies" className="inline-flex items-center gap-1 rounded-lg border border-stone-300 px-3 py-2 text-sm font-medium text-[#2c2c2c] hover:bg-stone-50 transition">
              <Briefcase className="w-3.5 h-3.5" />
              Join as Company
            </Link>
          )}
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            className="p-2 rounded-lg hover:bg-stone-100"
            aria-label="Toggle menu"
          >
            {open ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </div>

      {open && (
        <div className="md:hidden border-t border-stone-200 bg-white max-h-[calc(100vh-56px)] overflow-y-auto">
          <div className="max-w-6xl mx-auto px-4 py-4 flex flex-col gap-2">
            {navLinks.map(({ to, label }) => (
              <Fragment key={to}>{renderNavLink(to, label, 'py-2')}</Fragment>
            ))}

            {/* Mobile Portfolio Dropdown */}
            <div className="py-2">
              <button
                onClick={() => setPortfolioDropdownOpen(!portfolioDropdownOpen)}
                className="inline-flex items-center gap-1.5 text-base font-medium text-[#2c2c2c]/80 hover:text-[#2c2c2c] transition"
              >
                Portfolio
                <ChevronDown className={`w-4 h-4 transition-transform ${portfolioDropdownOpen ? 'rotate-180' : ''}`} />
              </button>
              {portfolioDropdownOpen && (
                <div className="mt-3 pl-2">
                  {/* Search */}
                  <div className="mb-3 relative">
                    <input
                      type="text"
                      value={portfolioSearch}
                      onChange={e => setPortfolioSearch(e.target.value)}
                      placeholder="Search room or style…"
                      className="w-full h-9 pl-3 pr-8 rounded-lg border border-stone-200 bg-stone-50 text-sm placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-[#B8864A]/15 focus:border-[#B8864A] focus:bg-white"
                    />
                    {portfolioSearch && (
                      <button onClick={() => setPortfolioSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  {portfolioSearch.trim() ? (
                    (() => {
                      const q = portfolioSearch.toLowerCase();
                      const allItems = Object.values(portfolioCategories).flat().filter(item => item.label.toLowerCase().includes(q));
                      return allItems.length > 0 ? (
                        <div className="grid grid-cols-2 gap-x-4">
                          {allItems.map(item => (
                            <Link key={item.to} to={item.to}
                              onClick={() => { handleClick(item.to); setPortfolioSearch(''); }}
                              className="text-sm text-stone-600 hover:text-[#b8864a] transition py-1">
                              {item.label}
                            </Link>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-stone-400 py-2">No results</p>
                      );
                    })()
                  ) : (
                    <div className="space-y-4">
                      {Object.entries(portfolioCategories).map(([category, items]) => (
                        <div key={category}>
                          <h3 className="text-xs font-bold text-stone-900 uppercase tracking-wider mb-2">{category}</h3>
                          <div className="grid grid-cols-2 gap-x-4">
                            {items.map(item => (
                              <Link key={item.to} to={item.to} onClick={() => handleClick(item.to)}
                                className="text-sm text-stone-600 hover:text-[#b8864a] transition py-0.5">
                                {item.label}
                              </Link>
                            ))}
                          </div>
                        </div>
                      ))}
                      <div className="border-t border-stone-200 pt-2">
                        <Link to="/portfolio" onClick={() => handleClick('/portfolio')}
                          className="text-sm font-medium text-[#b8864a] hover:text-[#a07540] transition block py-1">
                          All Projects →
                        </Link>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Mobile Find Company Section */}
            <div className="py-2">
              <div className="flex items-center justify-between">
                <Link
                  to="/companies"
                  onClick={() => handleClick('/companies')}
                  className="text-base font-medium text-[#2c2c2c]/80 hover:text-[#2c2c2c] transition"
                >
                  Find Company
                </Link>
                <button
                  onClick={() => setDropdownOpen(!dropdownOpen)}
                  className="p-1 text-[#2c2c2c]/60 hover:text-[#2c2c2c] transition"
                >
                  <ChevronDown className={`w-4 h-4 transition-transform ${dropdownOpen ? 'rotate-180' : ''}`} />
                </button>
              </div>
              {dropdownOpen && (
                <div className="mt-3 pl-2">
                  {/* Search */}
                  <div className="mb-3 relative">
                    <input
                      type="text"
                      value={findCompanySearch}
                      onChange={e => setFindCompanySearch(e.target.value)}
                      placeholder="Search space or service…"
                      className="w-full h-9 pl-3 pr-8 rounded-lg border border-stone-200 bg-stone-50 text-sm placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-[#B8864A]/15 focus:border-[#B8864A] focus:bg-white"
                    />
                    {findCompanySearch && (
                      <button onClick={() => setFindCompanySearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  {findCompanySearch.trim() ? (
                    /* Search results: flat 2-column grid */
                    (() => {
                      const q = findCompanySearch.toLowerCase();
                      const allItems = [
                        ...spaceTypeItems,
                        ...navCategories.flatMap(cat =>
                          cat.subs.map(svc => ({ label: svc, to: `/companies?service=${encodeURIComponent(svc)}` }))
                        ),
                      ].filter(item => item.label.toLowerCase().includes(q));
                      return allItems.length > 0 ? (
                        <div className="grid grid-cols-2 gap-x-4">
                          {allItems.map(item => (
                            <Link key={item.to} to={item.to}
                              onClick={() => { handleClick(item.to); setFindCompanySearch(''); }}
                              className="text-sm text-stone-600 hover:text-[#b8864a] transition py-1">
                              {item.label}
                            </Link>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-stone-400 py-2">No results</p>
                      );
                    })()
                  ) : (
                    /* Default grouped view: 2-column grid per section */
                    <div className="space-y-4">
                      <div>
                        <h4 className="text-xs font-bold text-stone-900 uppercase tracking-wider mb-2">Space Type</h4>
                        <div className="grid grid-cols-2 gap-x-4">
                          {spaceTypeItems.map(item => (
                            <Link key={item.to} to={item.to} onClick={() => handleClick(item.to)}
                              className="text-sm text-stone-600 hover:text-[#b8864a] transition py-0.5">
                              {item.label}
                            </Link>
                          ))}
                        </div>
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-stone-900 uppercase tracking-wider mb-2">Service Type</h4>
                        {navCategories.map(cat => (
                          <div key={cat.name} className="mb-3">
                            <p className="text-xs font-semibold text-stone-400 mb-1">{cat.name}</p>
                            <div className="grid grid-cols-2 gap-x-4">
                              {cat.subs.map((svc: string) => (
                                <Link key={svc} to={`/companies?service=${encodeURIComponent(svc)}`}
                                  onClick={() => handleClick(`/companies?service=${encodeURIComponent(svc)}`)}
                                  className="text-sm text-stone-600 hover:text-[#b8864a] transition py-0.5">
                                  {svc}
                                </Link>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                      <div className="border-t border-stone-200 pt-2">
                        <Link to="/companies" onClick={() => handleClick('/companies')}
                          className="text-sm font-medium text-[#b8864a] hover:text-[#a07540] transition block py-1">
                          All Companies →
                        </Link>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Mobile Materials Dropdown */}
            <div className="py-2">
              <div className="flex items-center justify-between">
                <Link
                  to="/materials"
                  onClick={() => handleClick('/materials')}
                  className="text-base font-medium text-[#2c2c2c]/80 hover:text-[#2c2c2c] transition"
                >
                  Materials
                </Link>
                <button
                  onClick={() => setMaterialsDropdownOpen(!materialsDropdownOpen)}
                  className="p-1 text-[#2c2c2c]/60 hover:text-[#2c2c2c] transition"
                >
                  <ChevronDown className={`w-4 h-4 transition-transform ${materialsDropdownOpen ? 'rotate-180' : ''}`} />
                </button>
              </div>
              {materialsDropdownOpen && (
                <div className="mt-3 pl-2">
                  {/* Search */}
                  <div className="mb-3 relative">
                    <input
                      type="text"
                      value={materialsSearch}
                      onChange={e => setMaterialsSearch(e.target.value)}
                      placeholder="Search category…"
                      className="w-full h-9 pl-3 pr-8 rounded-lg border border-stone-200 bg-stone-50 text-sm placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-[#B8864A]/15 focus:border-[#B8864A] focus:bg-white"
                    />
                    {materialsSearch && (
                      <button onClick={() => setMaterialsSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  {(() => {
                    const allNavCats = [
                      ...supplierNavGroups.flatMap(g => g.categories),
                      ...supplierNavUngrouped,
                    ];
                    const q = materialsSearch.toLowerCase();

                    if (materialsSearch.trim()) {
                      const filtered = allNavCats.filter(item => item.label.toLowerCase().includes(q));
                      return filtered.length > 0 ? (
                        <div className="grid grid-cols-2 gap-x-4">
                          {filtered.map(item => {
                            const to = `/materials?category=${encodeURIComponent(item.value)}`;
                            return (
                              <Link key={item.value} to={to}
                                onClick={() => { handleClick(to); setMaterialsSearch(''); }}
                                className="text-sm text-stone-600 hover:text-[#b8864a] transition py-1.5">
                                {item.label}
                              </Link>
                            );
                          })}
                        </div>
                      ) : <p className="text-sm text-stone-400 py-2">No results</p>;
                    }

                    return (
                      <div className="space-y-4">
                        {supplierNavGroups.filter(g => g.categories.length > 0).map(g => (
                          <div key={g.value}>
                            <p className="text-[11px] font-semibold text-stone-400 uppercase tracking-wider mb-2">{g.label}</p>
                            <div className="grid grid-cols-2 gap-x-4">
                              {g.categories.map(item => {
                                const to = `/materials?category=${encodeURIComponent(item.value)}`;
                                return (
                                  <Link key={item.value} to={to}
                                    onClick={() => { handleClick(to); setMaterialsSearch(''); }}
                                    className="text-sm text-stone-600 hover:text-[#b8864a] transition py-1.5">
                                    {item.label}
                                  </Link>
                                );
                              })}
                            </div>
                          </div>
                        ))}
                      </div>
                    );
                  })()}

                  <div className="border-t border-stone-200 mt-3 pt-2">
                    <Link to="/materials" onClick={() => handleClick('/materials')}
                      className="text-sm font-medium text-[#b8864a] hover:text-[#a07540] transition block py-1">
                      All Suppliers →
                    </Link>
                  </div>
                </div>
              )}
            </div>

            {isLoggedIn ? (
              <Link
                to={accountEntry.to}
                onClick={() => handleClick(accountEntry.to)}
                className="py-2 inline-flex items-center gap-2 text-base font-medium text-[#2c2c2c]/80 hover:text-[#2c2c2c] transition"
              >
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

/* ── User avatar dropdown menu ── */
function UserMenu({ userName, userAvatar, dashboardTo, onNavigate }: {
  userName: string; userAvatar: string; dashboardTo: string; onNavigate: (to: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const nav = useNavigate();

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
    nav('/auth', { replace: true });
  };

  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen(!open)} className="inline-flex items-center" aria-label="User menu">
        <Avatar name={userName} avatarUrl={userAvatar} size="sm" />
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-2 w-48 bg-white rounded-xl shadow-xl border border-stone-200 z-50 py-1">
          <Link to={dashboardTo} onClick={() => { onNavigate(dashboardTo); setOpen(false); }}
            className="flex items-center gap-3 px-4 py-2.5 text-sm text-stone-700 hover:bg-stone-50 transition">
            <LayoutDashboard className="w-4 h-4 text-stone-400" />Dashboard
          </Link>
          <div className="border-t border-stone-100 my-1" />
          <button onClick={handleLogout}
            className="flex items-center gap-3 w-full px-4 py-2.5 text-sm text-stone-700 hover:bg-stone-50 transition text-left">
            <LogOut className="w-4 h-4 text-stone-400" />Log out
          </button>
        </div>
      )}
    </div>
  );
}
