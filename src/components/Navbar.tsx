import { Fragment, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Menu, X } from 'lucide-react';
import { api } from '../lib/api';
import { safeGetJSON } from '../lib/storage';
import Avatar from './ui/Avatar';
import { useNavigationHandler } from '../hooks/useNavigationHandler';

const navLinks = [
  { to: '/', label: 'Home' },
  { to: '/designers', label: 'Find Designers' },
  { to: '/materials', label: 'Showrooms' },
  { to: '/designers/apply', label: 'Join as Designer' },
];

export default function Navbar() {
  const [open, setOpen] = useState(false);
  const { handleNavClick } = useNavigationHandler();
  const location = useLocation();
  const isAuthPage = location.pathname === '/auth' || location.pathname === '/login' || location.pathname === '/register';

  // Hide navbar completely on auth page
  if (isAuthPage) return null;

  const isDesignerLoggedIn = Boolean(api.getToken());
  const designer = safeGetJSON<Record<string, unknown>>('designer');
  const designerName = ((designer?.full_name as string) || (designer?.fullName as string) || '').trim() || 'Designer';
  const designerAvatar = ((designer?.avatar_url as string) || (designer?.avatarUrl as string) || '').trim();
  const accountEntry = isDesignerLoggedIn
    ? { to: '/designer/dashboard', label: 'Dashboard' }
    : { to: '/auth?tab=login', label: 'Log In' };

  const handleClick = (to: string) => {
    handleNavClick(to);
    setOpen(false);
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
          {isDesignerLoggedIn ? (
            <Link
              to={accountEntry.to}
              onClick={() => handleClick(accountEntry.to)}
              className="inline-flex items-center"
              aria-label="Open dashboard"
              title="Dashboard"
            >
              <Avatar name={designerName} avatarUrl={designerAvatar} size="sm" />
            </Link>
          ) : (
            renderNavLink(accountEntry.to, accountEntry.label)
          )}
          <Link to="/contact" onClick={() => handleClick('/contact')} className="btn-primary ml-2 text-base text-white">
            Contact Us
          </Link>
        </nav>

        <div className="flex items-center gap-2 md:hidden">
          <Link to="/contact" className="btn-primary px-3 py-2 text-sm text-white">
            Contact
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
            {isDesignerLoggedIn ? (
              <Link
                to={accountEntry.to}
                onClick={() => handleClick(accountEntry.to)}
                className="py-2 inline-flex items-center gap-2 text-base font-medium text-[#2c2c2c]/80 hover:text-[#2c2c2c] transition"
              >
                <Avatar name={designerName} avatarUrl={designerAvatar} size="sm" />
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
