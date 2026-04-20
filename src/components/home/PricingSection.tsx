import { Link } from 'react-router-dom';
import { isWartime } from '../../config/site-config';

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
    <section id="pricing" className="relative overflow-hidden py-12 sm:py-16" style={{ contentVisibility: 'auto', containIntrinsicSize: 'auto 500px' }}>
      {/* Warm interior-style background */}
      <div
        className="absolute inset-0 bg-cover bg-center bg-no-repeat opacity-30"
        style={{
          backgroundImage: `url(/images/hero/pricing-bg.webp)`,
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

        <div className="mx-auto grid max-w-7xl grid-cols-1 gap-4 md:grid-cols-3 lg:gap-5">
          {PACKAGES.map((pkg) => (
            <div
              key={pkg.title}
              className="relative bg-white rounded-2xl shadow-lg overflow-hidden flex flex-col transition-all duration-200 hover:-translate-y-1 hover:shadow-xl"
            >
              <div className="flex flex-1 flex-col p-5 sm:p-6">
                <h3 className="mb-2 text-lg font-semibold text-[#2c2c2c] sm:text-xl">
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
          ))}
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
