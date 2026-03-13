import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Menu, X } from 'lucide-react';

const navLinks = [
  { to: '/', label: 'Home' },
  { to: '/designers', label: 'Find Designers' },
  { to: '/materials', label: 'Showrooms' },
  { to: '/designers/apply', label: 'Join as Designer' },
];

export default function Navbar({ whatsAppLink }: { whatsAppLink: string }) {
  const [open, setOpen] = useState(false);
  const location = useLocation();

  const handleNavClick = (e: React.MouseEvent, to: string) => {
    if (to === '/' && location.pathname === '/') {
      e.preventDefault();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
    setOpen(false);
  };

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
            to === '/' ? (
              <Link
                key={to}
                to={to}
                onClick={(e) => { if (location.pathname === '/') { e.preventDefault(); window.scrollTo({ top: 0, behavior: 'smooth' }); } }}
                className="text-base font-medium text-[#2c2c2c]/80 hover:text-[#2c2c2c] transition"
              >
                {label}
              </Link>
            ) : (
              <Link
                key={to}
                to={to}
                className="text-base font-medium text-[#2c2c2c]/80 hover:text-[#2c2c2c] transition"
              >
                {label}
              </Link>
            )
          ))}
          <Link
            to="/auth"
            className="text-base font-medium text-[#2c2c2c]/80 hover:text-[#2c2c2c] transition"
          >
            Log In
          </Link>
          <a href={whatsAppLink} target="_blank" rel="noopener noreferrer" className="btn-primary ml-2 text-base text-white">
            Contact Us
          </a>
        </nav>

        <div className="flex items-center gap-2 md:hidden">
          <a href={whatsAppLink} target="_blank" rel="noopener noreferrer" className="btn-primary px-3 py-2 text-sm text-white">
            Contact
          </a>
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
              <Link
                key={to}
                to={to}
                onClick={(e) => handleNavClick(e, to)}
                className="py-2 text-base font-medium text-[#2c2c2c]"
              >
                {label}
              </Link>
            ))}
            <Link to="/auth" onClick={() => setOpen(false)} className="py-2 text-base font-medium text-[#2c2c2c]">
              Log In
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
