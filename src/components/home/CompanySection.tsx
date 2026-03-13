import { MapPin } from 'lucide-react';
import { GOOGLE_MAPS_URL, ADDRESS, WHATSAPP_LINK } from '../../lib/constants';

export default function CompanySection() {
  return (
    <section className="py-16 sm:py-20 bg-[#faf9f7] border-t border-stone-200">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <h2 className="font-serif text-2xl sm:text-3xl text-[#2c2c2c] font-semibold text-center mb-10">
          Tarmeer — Design & Build in the UAE
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-3xl mx-auto text-center md:text-left">
          <div>
            <h3 className="font-semibold text-sm uppercase tracking-wider text-[#6b6b6b] mb-2">
              Address
            </h3>
            <p className="text-[#2c2c2c] flex items-start justify-center md:justify-start gap-2">
              <span className="text-lg leading-none" aria-hidden>🏢</span>
              <span>{ADDRESS}</span>
            </p>
            <a
              href={GOOGLE_MAPS_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-primary inline-flex items-center gap-2 mt-3 text-white"
            >
              <MapPin className="w-4 h-4" />
              Google Map
            </a>
          </div>
          <div>
            <h3 className="font-semibold text-sm uppercase tracking-wider text-[#6b6b6b] mb-2">
              Contact
            </h3>
            <a
              href={WHATSAPP_LINK}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#2c2c2c] hover:text-[#c6a065] transition"
            >
              WhatsApp: +971 58 838 8922
            </a>
          </div>
        </div>
        <p className="text-sm text-[#6b6b6b] text-center mt-8 max-w-xl mx-auto">
          Local design services across the UAE. We offer full-case and soft decoration packages — meet us in person or get in touch to start your project.
        </p>
      </div>
    </section>
  );
}
