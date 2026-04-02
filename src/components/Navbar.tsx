import { Fragment, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Menu, X, User, Briefcase, ChevronDown } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { api } from '../lib/api';
import { safeGetJSON } from '../lib/storage';
import Avatar from './ui/Avatar';
import { useNavigationHandler } from '../hooks/useNavigationHandler';

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

const navLinks = [
  { to: '/', label: 'Home' },
  { to: '/materials', label: 'Showrooms' },
];

export default function Navbar() {
  const [open, setOpen] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const { handleNavClick } = useNavigationHandler();
  const location = useLocation();
  const isAuthPage = location.pathname === '/auth' || location.pathname === '/login' || location.pathname === '/register';

  // Hide navbar completely on auth page
  if (isAuthPage) return null;

  const isLoggedIn = Boolean(api.getToken());
  const user = safeGetJSON<Record<string, unknown>>('user');
  const activeRole = localStorage.getItem('active_role');

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
      <div className="max-w-6xl mx-auto px-4 sm:px-6 flex items-center justify-between h-14 sm:h-16">
        <Link to="/" className="flex items-center gap-2 font-serif text-xl sm:text-2xl font-bold text-[#2c2c2c]">
          <img
            src="/images/tarmeer_logo.svg"
            alt=""
            className="h-8 sm:h-9 w-auto"
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
          />
          TARMEER
        </Link>

        <nav className="hidden md:flex items-center gap-6">
          {navLinks.map(({ to, label }) => (
            <Fragment key={to}>{renderNavLink(to, label)}</Fragment>
          ))}

          {/* Find Company Dropdown */}
          <div
            className="relative"
            onMouseEnter={() => setDropdownOpen(true)}
            onMouseLeave={() => setDropdownOpen(false)}
          >
            <Link
              to="/companies"
              onClick={(e) => { if (!dropdownOpen) { handleClick('/companies'); } else { e.preventDefault(); setDropdownOpen(false); } }}
              className="inline-flex items-center gap-1.5 text-base font-medium text-[#2c2c2c]/80 hover:text-[#2c2c2c] transition"
            >
              Find Company
              <ChevronDown className={`w-4 h-4 transition-transform ${dropdownOpen ? 'rotate-180' : ''}`} />
            </Link>

            <AnimatePresence>
              {dropdownOpen && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.15 }}
                  className="absolute top-full right-0 mt-2 w-max bg-white shadow-xl rounded-lg border border-stone-200 z-50"
                >
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
                                className="text-sm text-stone-600 hover:text-amber-700 transition"
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
                      className="text-sm font-medium text-amber-700 hover:text-amber-800 transition"
                    >
                      All Companies {'>'}
                    </Link>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {isLoggedIn ? (
            <Link
              to={accountEntry.to}
              onClick={() => handleClick(accountEntry.to)}
              className="inline-flex items-center"
              aria-label="Open dashboard"
              title="Dashboard"
            >
              <Avatar name={userName} avatarUrl={userAvatar} size="sm" />
            </Link>
          ) : (
            <Link
              to="/auth"
              onClick={() => handleClick('/auth')}
              className="inline-flex items-center gap-1.5 text-base font-medium text-[#2c2c2c]/80 hover:text-[#2c2c2c] transition"
            >
              <User className="w-4 h-4" />
              Log In
            </Link>
          )}
          <Link
            to="/onboarding"
            onClick={() => handleClick('/onboarding')}
            className="ml-2 inline-flex items-center gap-1.5 rounded-lg border border-stone-300 px-4 py-2 text-base font-medium text-[#2c2c2c] hover:bg-stone-50 transition"
          >
            <Briefcase className="w-4 h-4" />
            Join as Pro
          </Link>
        </nav>

        <div className="flex items-center gap-2 md:hidden">
          <Link to="/onboarding" className="inline-flex items-center gap-1 rounded-lg border border-stone-300 px-3 py-2 text-sm font-medium text-[#2c2c2c] hover:bg-stone-50 transition">
            <Briefcase className="w-3.5 h-3.5" />
            Join as Pro
          </Link>
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

            {/* Mobile Find Company Section */}
            <div className="py-2">
              <button
                onClick={() => setDropdownOpen(!dropdownOpen)}
                className="inline-flex items-center gap-1.5 text-base font-medium text-[#2c2c2c]/80 hover:text-[#2c2c2c] transition"
              >
                Find Company
                <ChevronDown className={`w-4 h-4 transition-transform ${dropdownOpen ? 'rotate-180' : ''}`} />
              </button>
              <AnimatePresence>
                {dropdownOpen && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.15 }}
                    className="mt-3 pl-4 space-y-4"
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
                                className="text-sm text-stone-600 hover:text-amber-700 transition block py-1"
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
                        className="text-sm font-medium text-amber-700 hover:text-amber-800 transition block py-1"
                      >
                        All Companies {'>'}
                      </Link>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
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
