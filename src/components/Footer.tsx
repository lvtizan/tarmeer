import { Link } from 'react-router-dom';
import { GOOGLE_MAPS_URL, ADDRESS, INSTAGRAM_URL } from '../lib/constants';
import { MapPin } from 'lucide-react';

const footerNavLinks = [
  { to: '/', label: 'Home' },
  { to: '/#designers', label: 'Designers' },
  { to: '/#pricing', label: 'Pricing' },
  { to: '/materials', label: 'Showrooms' },
  { to: '/designers/apply', label: 'Become a Partner' },
];

export default function Footer({ whatsAppLink }: { whatsAppLink: string }) {
  return (
    <footer className="bg-[#2c2c2c] text-white">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10 sm:py-12">
        {/* Havenly-style multi-column: Company | About | Address | Contact & Follow */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 lg:gap-10">
          <div>
            <h3 className="font-semibold text-sm uppercase tracking-wider text-white/90 mb-4">
              Company
            </h3>
            <nav className="flex flex-col gap-3" aria-label="Footer navigation">
              {footerNavLinks.map(({ to, label }) => (
                <Link
                  key={to}
                  to={to}
                  className="text-sm text-white/80 hover:text-white transition"
                >
                  {label}
                </Link>
              ))}
              <a
                href={whatsAppLink}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-white/80 hover:text-white transition"
              >
                Contact Us
              </a>
            </nav>
          </div>
          <div>
            <h3 className="font-semibold text-sm uppercase tracking-wider text-white/90 mb-4">
              About
            </h3>
            <p className="text-sm text-white/80">
              Interior design & build services in the UAE. Your space, your style, our expertise.
            </p>
          </div>
          <div>
            <h3 className="font-semibold text-sm uppercase tracking-wider text-white/90 mb-4">
              Address
            </h3>
            <p className="text-sm text-white/80 flex items-start gap-2">
              <span className="text-lg leading-none" aria-hidden>🏢</span>
              <span>{ADDRESS}</span>
            </p>
            <a
              href={GOOGLE_MAPS_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 mt-3 px-4 py-2 rounded-lg bg-white/10 hover:bg-[#b8864a] text-white text-sm font-medium transition"
            >
              <MapPin className="w-4 h-4" />
              Google Map
            </a>
          </div>
          <div>
            <h3 className="font-semibold text-sm uppercase tracking-wider text-white/90 mb-4">
              Contact & Follow
            </h3>
            <a
              href={whatsAppLink}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-white/80 hover:text-[#c6a065] transition block mb-3"
            >
              WhatsApp: +971 58 838 8922
            </a>
            <a
              href={INSTAGRAM_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-sm text-white/80 hover:text-[#c6a065] transition"
              aria-label="Instagram"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden>
                <path fillRule="evenodd" d="M12.315 2c2.43 0 2.784.013 3.808.06 1.064.049 1.791.218 2.427.465a4.903 4.903 0 011.772 1.153 4.902 4.902 0 011.153 1.772c.247.636.416 1.363.465 2.427.048 1.067.06 1.407.06 4.123v.08c0 2.643-.012 2.987-.06 4.043-.049 1.064-.218 1.791-.465 2.427a4.902 4.902 0 01-1.153 1.772 4.902 4.902 0 01-1.772 1.153c-.636.247-1.363.416-2.427.465-1.067.048-1.407.06-4.123.06h-.08c-2.643 0-2.987-.012-4.043-.06-1.064-.049-1.791-.218-2.427-.465a4.902 4.902 0 01-1.772-1.153 4.902 4.902 0 01-1.153-1.772c-.247-.636-.416-1.363-.465-2.427-.048-1.067-.06-1.407-.06-4.123v-.08c0-2.643.012-2.987.06-4.043.049-1.064.218-1.791.465-2.427a4.902 4.902 0 011.153-1.772A4.902 4.902 0 015.45 2.525c.636-.247 1.363-.416 2.427-.465C8.901 2.013 9.256 2 11.685 2h.63zm-.081 1.802h-.468c-2.456 0-2.784.011-3.807.058-.975.045-1.504.207-1.857.344-.467.182-.8.398-1.15.748-.35.35-.566.683-.748 1.15-.137.353-.3.882-.344 1.857-.047 1.023-.058 1.351-.058 3.807v.468c0 2.456.011 2.784.058 3.807.045.975.207 1.504.344 1.857.182.466.399.8.748 1.15.35.35.683.566 1.15.748.353.137.882.3 1.857.344 1.054.048 1.37.058 4.041.058h.08c2.597 0 2.917-.01 3.96-.058.976-.045 1.505-.207 1.858-.344.466-.182.8-.398 1.15-.748.35-.35.566-.683.748-1.15.137-.353.3-.882.344-1.857.048-1.055.058-1.37.058-4.041v-.08c0-2.597-.01-2.917-.058-3.96-.045-.976-.207-1.505-.344-1.858a3.097 3.097 0 00-.748-1.15 3.098 3.098 0 00-1.15-.748c-.353-.137-.882-.3-1.857-.344-1.023-.047-1.351-.058-3.807-.058zM12 6.865a5.135 5.135 0 110 10.27 5.135 5.135 0 010-10.27zm0 8.468a3.333 3.333 0 100-6.666 3.333 3.333 0 000 6.666zm5.338-3.205a1.2 1.2 0 110-2.4 1.2 1.2 0 010 2.4z" clipRule="evenodd" />
              </svg>
              Instagram
            </a>
          </div>
        </div>
        <div className="mt-10 pt-6 border-t border-white/20 flex flex-col sm:flex-row justify-between items-center gap-4">
          <p className="text-xs text-white/60">
            © {new Date().getFullYear()} Tarmeer. All rights reserved.
          </p>
          <div className="flex gap-6 text-xs text-white/60">
            <a href="/privacy" className="hover:text-white/80">Privacy</a>
          </div>
        </div>
      </div>
    </footer>
  );
}
