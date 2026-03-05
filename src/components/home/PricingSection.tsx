import { WHATSAPP_LINK } from '../../lib/constants';
import { isWartime } from '../../config/site-config';

const PACKAGES = [
  {
    title: 'New Home Full Case Design',
    description:
      'Complete design package for your new home: floor plans, 3D visuals, full construction drawings, and material specs — all in one place.',
    price: '29',
    unit: 'AED/m²',
    cta: 'Get Started',
    features: ['Floor plans & 3D visuals', 'Full construction drawings', 'Material specifications'],
  },
  {
    title: 'Soft Decoration Design',
    description:
      'Transform your space with interior styling: layout, 720° virtual tour, mood boards, lighting and color plans, and product lists.',
    price: '22',
    unit: 'AED/m²',
    cta: 'Get Started',
    features: ['Layout & 720° virtual tour', 'Mood boards & visuals', 'Lighting, color & product list'],
  },
];

export default function PricingSection() {
  return (
    <section id="pricing" className="relative py-16 sm:py-24 overflow-hidden">
      {/* Warm interior-style background */}
      <div
        className="absolute inset-0 bg-cover bg-center bg-no-repeat opacity-30"
        style={{
          backgroundImage: `url(https://images.unsplash.com/photo-1616486338812-3dadae4b4ace?w=1920&q=80)`,
        }}
      />
      <div className="absolute inset-0 bg-[#f5f0e8]/95" />

      <div className="relative max-w-6xl mx-auto px-4 sm:px-6">
        <div className="text-center mb-12 sm:mb-16">
          <p className="text-xs sm:text-sm uppercase tracking-widest text-[#6b6b6b] mb-2">
            Our design packages
          </p>
          <h2 className="font-serif text-2xl sm:text-3xl md:text-4xl text-[#2c2c2c] font-semibold max-w-2xl mx-auto mb-3">
            Our interior design services are tailored to your space, style, and budget.
          </h2>
          <p className="text-[#6b6b6b] max-w-xl mx-auto text-sm sm:text-base">
            Choose a package below and get started with a designer who fits your vision.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8 max-w-4xl mx-auto">
          {PACKAGES.map((pkg) => (
            <div
              key={pkg.title}
              className="relative bg-white rounded-xl sm:rounded-2xl shadow-lg overflow-hidden flex flex-col transition-all duration-200 hover:-translate-y-1 hover:shadow-xl"
            >
              <div className="p-6 sm:p-8 flex flex-col flex-1">
                <h3 className="font-semibold text-lg sm:text-xl text-[#2c2c2c] mb-3">
                  {pkg.title}
                </h3>
                <p className="text-sm sm:text-base text-[#6b6b6b] mb-6 flex-1">
                  {pkg.description}
                </p>
                <ul className="space-y-2 mb-6">
                  {pkg.features.map((f) => (
                    <li key={f} className="text-sm text-[#2c2c2c]/90 flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#c6a065]" />
                      {f}
                    </li>
                  ))}
                </ul>
                <div className="flex flex-wrap items-baseline gap-1 mb-6">
                  <span className="font-semibold text-2xl sm:text-3xl text-[#2c2c2c]">
                    {pkg.price}
                  </span>
                  <span className="text-sm text-[#6b6b6b]">{pkg.unit}</span>
                </div>
                <a
                  href={WHATSAPP_LINK}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-primary block w-full text-center"
                >
                  {pkg.cta}
                </a>
              </div>
            </div>
          ))}
        </div>

        {/* 战时模式提示 */}
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
