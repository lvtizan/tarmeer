import { Link } from 'react-router-dom';
import { isWartime } from '../../config/site-config';

/* Elegant inline SVG illustrations for each service */
function FloorPlanIllustration() {
  return (
    <svg viewBox="0 0 80 80" fill="none" className="w-full h-full">
      <rect x="8" y="8" width="64" height="64" rx="8" stroke="#b8864a" strokeWidth="1.5" opacity="0.2" />
      <rect x="14" y="14" width="24" height="20" rx="3" stroke="#b8864a" strokeWidth="1.5" />
      <rect x="42" y="14" width="24" height="20" rx="3" stroke="#b8864a" strokeWidth="1.5" />
      <rect x="14" y="38" width="52" height="28" rx="3" stroke="#b8864a" strokeWidth="1.5" />
      <line x1="14" y1="52" x2="66" y2="52" stroke="#b8864a" strokeWidth="1" opacity="0.4" strokeDasharray="3 2" />
      <circle cx="26" cy="24" r="3" fill="#b8864a" opacity="0.15" />
      <circle cx="54" cy="24" r="3" fill="#b8864a" opacity="0.15" />
      <path d="M22 46 L30 42 L38 48 L46 40 L54 46" stroke="#b8864a" strokeWidth="1.2" fill="none" opacity="0.5" />
      <rect x="26" y="56" width="8" height="6" rx="1" fill="#b8864a" opacity="0.12" />
      <rect x="46" y="56" width="8" height="6" rx="1" fill="#b8864a" opacity="0.12" />
      <circle cx="40" cy="72" r="1.5" fill="#b8864a" opacity="0.3" />
    </svg>
  );
}

function SoftDecorationIllustration() {
  return (
    <svg viewBox="0 0 80 80" fill="none" className="w-full h-full">
      {/* Sofa */}
      <path d="M16 52 Q16 44, 24 44 L56 44 Q64 44, 64 52 L64 56 L16 56 Z" stroke="#b8864a" strokeWidth="1.5" fill="#b8864a" fillOpacity="0.06" />
      <path d="M12 48 Q12 44, 16 44 L16 56 L12 56 Z" stroke="#b8864a" strokeWidth="1.5" fill="#b8864a" fillOpacity="0.04" />
      <path d="M68 48 Q68 44, 64 44 L64 56 L68 56 Z" stroke="#b8864a" strokeWidth="1.5" fill="#b8864a" fillOpacity="0.04" />
      <rect x="14" y="56" width="52" height="3" rx="1.5" fill="#b8864a" opacity="0.15" />
      {/* Cushions */}
      <ellipse cx="30" cy="48" rx="8" ry="4" stroke="#b8864a" strokeWidth="1" opacity="0.3" />
      <ellipse cx="50" cy="48" rx="8" ry="4" stroke="#b8864a" strokeWidth="1" opacity="0.3" />
      {/* Lamp */}
      <line x1="40" y1="12" x2="40" y2="32" stroke="#b8864a" strokeWidth="1.2" opacity="0.4" />
      <path d="M30 12 Q40 8, 50 12 Q48 20, 40 22 Q32 20, 30 12 Z" stroke="#b8864a" strokeWidth="1.5" fill="#b8864a" fillOpacity="0.08" />
      <circle cx="40" cy="16" r="2" fill="#b8864a" opacity="0.2" />
      {/* Plant */}
      <rect x="62" y="60" width="8" height="10" rx="2" stroke="#b8864a" strokeWidth="1" opacity="0.3" />
      <path d="M64 60 Q66 52, 70 54 Q68 56, 66 60" stroke="#b8864a" strokeWidth="1" fill="#b8864a" fillOpacity="0.1" />
      <path d="M66 60 Q64 50, 62 54 Q64 56, 66 60" stroke="#b8864a" strokeWidth="1" fill="#b8864a" fillOpacity="0.1" />
      {/* Frame on wall */}
      <rect x="18" y="16" width="14" height="18" rx="2" stroke="#b8864a" strokeWidth="1" opacity="0.25" />
      <line x1="20" y1="28" x2="30" y2="28" stroke="#b8864a" strokeWidth="0.8" opacity="0.2" />
    </svg>
  );
}

function ExteriorIllustration() {
  return (
    <svg viewBox="0 0 80 80" fill="none" className="w-full h-full">
      {/* House body */}
      <path d="M14 42 L40 18 L66 42" stroke="#b8864a" strokeWidth="1.5" fill="none" />
      <rect x="18" y="42" width="44" height="26" stroke="#b8864a" strokeWidth="1.5" fill="#b8864a" fillOpacity="0.04" />
      {/* Roof detail */}
      <line x1="10" y1="42" x2="70" y2="42" stroke="#b8864a" strokeWidth="1.5" />
      <path d="M40 18 L40 12" stroke="#b8864a" strokeWidth="1.2" opacity="0.4" />
      <polygon points="38,12 42,12 40,8" fill="#b8864a" opacity="0.3" />
      {/* Door */}
      <rect x="34" y="52" width="12" height="16" rx="6" stroke="#b8864a" strokeWidth="1.2" fill="#b8864a" fillOpacity="0.08" />
      <circle cx="43" cy="60" r="1" fill="#b8864a" opacity="0.4" />
      {/* Windows */}
      <rect x="22" y="48" width="8" height="8" rx="1" stroke="#b8864a" strokeWidth="1" opacity="0.4" />
      <line x1="26" y1="48" x2="26" y2="56" stroke="#b8864a" strokeWidth="0.8" opacity="0.3" />
      <line x1="22" y1="52" x2="30" y2="52" stroke="#b8864a" strokeWidth="0.8" opacity="0.3" />
      <rect x="50" y="48" width="8" height="8" rx="1" stroke="#b8864a" strokeWidth="1" opacity="0.4" />
      <line x1="54" y1="48" x2="54" y2="56" stroke="#b8864a" strokeWidth="0.8" opacity="0.3" />
      <line x1="50" y1="52" x2="58" y2="52" stroke="#b8864a" strokeWidth="0.8" opacity="0.3" />
      {/* Landscaping */}
      <ellipse cx="12" cy="66" rx="6" ry="4" fill="#b8864a" fillOpacity="0.08" stroke="#b8864a" strokeWidth="0.8" opacity="0.3" />
      <ellipse cx="68" cy="66" rx="6" ry="4" fill="#b8864a" fillOpacity="0.08" stroke="#b8864a" strokeWidth="0.8" opacity="0.3" />
      <line x1="8" y1="68" x2="72" y2="68" stroke="#b8864a" strokeWidth="1" opacity="0.2" />
    </svg>
  );
}

const ILLUSTRATIONS = [FloorPlanIllustration, SoftDecorationIllustration, ExteriorIllustration];

const PACKAGES = [
  {
    title: 'New Home Full Case Design',
    description:
      'Complete design package for your new home: floor plans, 3D visuals, full construction drawings, and material specs — all in one place.',
    cta: 'Get Started',
    link: '/services/new-home-design',
    features: ['Floor plans & 3D visuals', 'Full construction drawings', 'Material specifications'],
  },
  {
    title: 'Soft Decoration Design',
    description:
      'Transform your space with interior styling: layout, 720° virtual tour, mood boards, lighting and color plans, and product lists.',
    cta: 'Get Started',
    link: '/services/soft-decoration',
    features: ['Layout & 720° virtual tour', 'Mood boards & visuals', 'Lighting, color & product list'],
  },
  {
    title: 'House Exterior Design',
    description:
      'Exterior design service for villas and standalone homes, including facade direction, material language, layout drawings, visualizations and construction-ready documentation.',
    cta: 'Get Started',
    link: '/services/house-exterior',
    features: ['Facade concept & layout drawing', '720° visuals & static renders', 'Construction drawing set'],
  },
];

export default function PricingSection() {
  return (
    <section id="pricing" className="relative overflow-hidden py-12 sm:py-16">
      {/* Warm interior-style background */}
      <div
        className="absolute inset-0 bg-cover bg-center bg-no-repeat opacity-30"
        style={{
          backgroundImage: `url(https://images.unsplash.com/photo-1616486338812-3dadae4b4ace?w=1920&q=80)`,
        }}
      />
      <div className="absolute inset-0 bg-[#f5f0e8]/95" />

      <div className="relative mx-auto max-w-7xl px-4 sm:px-6">
        <div className="mb-7 text-center sm:mb-9">
          <h2 className="mx-auto max-w-[15ch] font-serif text-[2.35rem] font-semibold leading-[1.08] tracking-tight text-[#2c2c2c] sm:max-w-[14ch] sm:text-[3.15rem] xl:max-w-none xl:text-[3.6rem]">
            <span className="mb-3 block font-sans text-[11px] font-medium uppercase tracking-[0.28em] text-[#6b6b6b] sm:text-[13px]">
              Our Design Packages
            </span>
            Our interior design services are tailored to your space, style, and budget.
          </h2>
          <p className="mx-auto mt-3 max-w-4xl text-sm text-[#6b6b6b] sm:text-base md:whitespace-nowrap">
            Choose a package below and get started with a designer who fits your vision.
          </p>
        </div>

        <div className="mx-auto grid max-w-7xl grid-cols-1 gap-6 md:grid-cols-3 lg:gap-7">
          {PACKAGES.map((pkg, index) => {
            const Illustration = ILLUSTRATIONS[index];
            return (
            <div
              key={pkg.title}
              className="relative bg-white rounded-lg shadow-lg overflow-hidden flex flex-col transition-all duration-200 hover:-translate-y-1 hover:shadow-xl"
            >
              <div className="flex flex-1 flex-col p-5 sm:p-6">
                <div className="mb-5 flex justify-center">
                  <div className="w-[100px] h-[100px] rounded-2xl border border-[#b8864a]/15 bg-gradient-to-br from-[#faf6f0] to-[#f5ede0] p-3 shadow-[0_4px_16px_rgba(184,134,74,0.08)]">
                    <Illustration />
                  </div>
                </div>
                <h3 className="mb-2 text-center text-lg font-semibold text-[#2c2c2c] sm:text-xl">
                  {pkg.title}
                </h3>
                <p className="mb-5 flex-1 text-sm text-[#6b6b6b] sm:text-base">
                  {pkg.description}
                </p>
                <ul className="mb-5 space-y-2">
                  {pkg.features.map((f) => (
                    <li key={f} className="text-sm text-[#2c2c2c]/90 flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#c6a065]" />
                      {f}
                    </li>
                  ))}
                </ul>
                <Link
                  to={pkg.link}
                  className="btn-primary block w-full text-center text-white"
                >
                  {pkg.cta}
                </Link>
              </div>
            </div>
          );
          })}
        </div>

        {/* Wartime mode prompt */}
        {isWartime() && (
          <div className="mt-10 max-w-2xl mx-auto">
            <div className="bg-[#c6a065]/10 border border-[#c6a065]/30 rounded-lg p-4 text-center">
              <p className="text-sm text-[#2c2c2c]">
                <span className="font-semibold">⚡ Wartime Special:</span> Remote design services available.
                Construction postponed until logistics resume. Contact us for details.
              </p>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
