import { Fragment, useState, useRef, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Menu, X, User, Briefcase, ChevronDown, LayoutDashboard, LogOut } from 'lucide-react';
import { api } from '../lib/api';
import { safeGetJSON } from '../lib/storage';
import Avatar from './ui/Avatar';
import NotificationBell from './NotificationBell';
import { useNavigationHandler } from '../hooks/useNavigationHandler';
import TarmeerLogo from './TarmeerLogo';

const serviceCategories = {
  Design: [
    { label: 'Interior Design', to: '/companies?service=Interior+Design' },
    { label: 'Architecture', to: '/companies?service=Architecture' },
    { label: 'Design & Build', to: '/companies?service=Design+%26+Build' },
  ],
  Renovation: [
    { label: 'Fit-Out', to: '/companies?service=Fit-Out' },
    { label: 'Renovation', to: '/companies?service=Renovation' },
    { label: 'Construction', to: '/companies?service=Construction' },
    { label: 'MEP', to: '/companies?service=MEP' },
  ],
  Furnishing: [
    { label: 'Furniture', to: '/companies?service=Furniture' },
    { label: 'Joinery', to: '/companies?service=Joinery' },
    { label: 'Turnkey Solutions', to: '/companies?service=Turnkey+Solutions' },
  ],
  Services: [
    { label: 'Project Management', to: '/companies?service=Project+Management' },
    { label: 'Landscape', to: '/companies?service=Landscape' },
    { label: 'Maintenance', to: '/companies?service=Maintenance' },
  ],
};

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

const navLinks = [
  { to: '/', label: 'Home' },
];

type NavbarVariant = 'default' | 'admin-auth';

export default function Navbar({
  forceShowOnAuth = false,
  variant = 'default',
}: {
  forceShowOnAuth?: boolean;
  variant?: NavbarVariant;
}) {
  const [open, setOpen] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [portfolioDropdownOpen, setPortfolioDropdownOpen] = useState(false);
  const { handleNavClick } = useNavigationHandler();
  const location = useLocation();
  const isAuthPage = location.pathname === '/auth' || location.pathname === '/login' || location.pathname === '/register';

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
    <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-sm border-b border-stone-200">
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
            onMouseLeave={() => setDropdownOpen(false)}
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
                className={`absolute top-full right-0 pt-2 w-max z-50 transition-all duration-150 ${dropdownOpen ? 'opacity-100 translate-y-0 pointer-events-auto' : 'opacity-0 -translate-y-2 pointer-events-none'}`}
              >
              <div className="bg-white shadow-xl rounded-lg border border-stone-200">
                  <div className="p-6 grid grid-cols-4 gap-8 min-w-max">
                    {Object.entries(serviceCategories).map(([category, services]) => (
                      <div key={category}>
                        <h3 className="text-sm font-bold text-stone-900 uppercase tracking-wider mb-3">
                          {category}
                        </h3>
                        <ul className="space-y-2">
                          {services.map((service) => (
                            <li key={service.to}>
                              <Link
                                to={service.to}
                                onClick={() => handleClick(service.to)}
                                className="text-sm text-stone-600 hover:text-[#b8864a] transition"
                              >
                                {service.label}
                              </Link>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                  <div className="border-t border-stone-200 px-6 py-4 bg-stone-50 rounded-b-lg">
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

          {renderNavLink('/materials', 'Materials')}

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
        <div className="md:hidden border-t border-stone-200 bg-white">
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
                  <div className="mt-3 pl-4 space-y-4"
                  >
                    {Object.entries(portfolioCategories).map(([category, items]) => (
                      <div key={category}>
                        <h3 className="text-xs font-bold text-stone-900 uppercase tracking-wider mb-2">
                          {category}
                        </h3>
                        <ul className="space-y-1">
                          {items.map((item) => (
                            <li key={item.to}>
                              <Link
                                to={item.to}
                                onClick={() => handleClick(item.to)}
                                className="text-sm text-stone-600 hover:text-[#b8864a] transition block py-1"
                              >
                                {item.label}
                              </Link>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                    <div className="border-t border-stone-200 pt-2">
                      <Link
                        to="/portfolio"
                        onClick={() => handleClick('/portfolio')}
                        className="text-sm font-medium text-[#b8864a] hover:text-[#a07540] transition block py-1"
                      >
                        All Projects {'>'}
                      </Link>
                    </div>
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
                  <div className="mt-3 pl-4 space-y-4"
                  >
                    {Object.entries(serviceCategories).map(([category, services]) => (
                      <div key={category}>
                        <h3 className="text-xs font-bold text-stone-900 uppercase tracking-wider mb-2">
                          {category}
                        </h3>
                        <ul className="space-y-1">
                          {services.map((service) => (
                            <li key={service.to}>
                              <Link
                                to={service.to}
                                onClick={() => handleClick(service.to)}
                                className="text-sm text-stone-600 hover:text-[#b8864a] transition block py-1"
                              >
                                {service.label}
                              </Link>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                    <div className="border-t border-stone-200 pt-2">
                      <Link
                        to="/companies"
                        onClick={() => handleClick('/companies')}
                        className="text-sm font-medium text-[#b8864a] hover:text-[#a07540] transition block py-1"
                      >
                        All Companies {'>'}
                      </Link>
                    </div>
                  </div>
                )}
            </div>

            {renderNavLink('/materials', 'Materials', 'py-2')}

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
