import { Helmet } from 'react-helmet-async';
import { Check } from 'lucide-react';
import TarmeerLogo from '../components/TarmeerLogo';

const STEPS = [
  {
    num: '01',
    time: '~2 min',
    title: 'Register Your Company',
    body: 'Fill in your company name, contact person, phone number, and city. Takes under 2 minutes.',
    highlights: [
      'Company name, type & city',
      'Your direct contact number',
      'Work email for your account',
    ],
    image: '/images/guide/step1-register.png',
    imageAlt: 'Register Your Company form on Tarmeer',
  },
  {
    num: '02',
    time: '~1 min',
    title: 'Verify Your Email',
    body: "Check your inbox for a verification link and click it to activate your account — it's instant.",
    highlights: [
      'Email arrives within 30 seconds',
      'Or sign in with Google in one click',
    ],
    image: '/images/guide/step2-verify.png',
    imageAlt: 'Email and Google sign-in screen',
  },
  {
    num: '03',
    time: '~5 min',
    title: 'Complete Your Profile',
    body: 'Add your company description, services, and logo. A strong profile gets 3× more inquiries.',
    highlights: [
      'Types of projects you handle',
      'Services and specialties',
      'Company logo and cover image',
    ],
    image: '/images/guide/step3-profile.png',
    imageAlt: 'Company profile setup on Tarmeer',
    active: true,
  },
  {
    num: '04',
    time: '~5 min · Required',
    title: 'Upload Your Projects',
    body: 'Submit as many high-quality project case studies as possible — the more projects you upload, the higher your ranking score on the platform.',
    highlights: [
      'Project title, location & style',
      'Upload 3–8 photos per project (JPG or PNG)',
      'More projects = higher search ranking',
    ],
    image: '/images/guide/step4-upload.png',
    imageAlt: 'Upload project photos to build your portfolio',
  },
  {
    num: '05',
    time: 'Automated',
    title: 'Await Lead Assignment',
    body: 'Tarmeer reviews each homeowner request and assigns the most suitable companies based on their specific needs. Once assigned, you receive the client details and project scope.',
    highlights: [
      'Leads matched to your specialty & location',
      'Real-time notification via email + SMS',
      "Client's project scope & contact details",
    ],
    image: '/images/guide/step5-live.png',
    imageAlt: 'Lead assignment notification on Tarmeer',
  },
];

export default function StartGuidePage() {
  return (
    <div className="min-h-screen bg-[#faf8f5] font-sans">
      <Helmet>
        <title>How to Get Started on Tarmeer | Company Onboarding Guide</title>
        <meta name="description" content="Step-by-step guide for construction and renovation companies joining Tarmeer. Set up your profile in 15 minutes and start receiving homeowner inquiries across UAE." />
        <meta property="og:title" content="How to Get Started on Tarmeer | Company Guide" />
        <meta property="og:description" content="Register your company, upload your projects, and receive verified homeowner inquiries across UAE." />
        <meta property="og:image" content="https://www.tarmeer.com/images/tarmeer_logo.svg" />
        <meta property="og:url" content="https://www.tarmeer.com/start" />
        <meta property="og:type" content="website" />
        <meta name="robots" content="index, follow" />
        <link rel="canonical" href="https://www.tarmeer.com/start" />
        <script type="application/ld+json">{JSON.stringify({
          "@context": "https://schema.org",
          "@type": "HowTo",
          "name": "How to Join Tarmeer as a Company",
          "description": "Step-by-step guide for construction and renovation companies joining Tarmeer UAE.",
          "totalTime": "PT20M",
          "step": STEPS.map((s, i) => ({
            "@type": "HowToStep",
            "position": i + 1,
            "name": s.title,
            "text": s.body,
          })),
        })}</script>
      </Helmet>

      {/* ── Header ── */}
      <header className="h-14 bg-white border-b border-stone-100 flex items-center px-4">
        <div className="max-w-2xl mx-auto w-full">
          <TarmeerLogo />
        </div>
      </header>

      {/* ── Hero ── */}
      <section
        className="relative overflow-hidden text-center px-6 py-12"
        style={{ background: 'linear-gradient(160deg, #1a1410 0%, #2d1f0e 60%, #3d2910 100%)' }}
      >
        <div className="absolute -top-16 -right-16 w-72 h-72 rounded-full pointer-events-none"
          style={{ background: 'radial-gradient(circle, rgba(184,134,74,0.18) 0%, transparent 70%)' }} />
        <div className="absolute -bottom-20 -left-10 w-64 h-64 rounded-full pointer-events-none"
          style={{ background: 'radial-gradient(circle, rgba(184,134,74,0.12) 0%, transparent 70%)' }} />

        <div className="relative z-10 max-w-lg mx-auto">
          <div className="inline-flex items-center gap-2 border border-[#b8864a]/30 bg-[#b8864a]/15 text-[#d4a96a] text-[11px] font-semibold tracking-[0.12em] uppercase px-4 py-1.5 rounded-full mb-5">
            ✦ For Construction Companies
          </div>

          <h1 className="text-[clamp(28px,7vw,50px)] font-bold leading-[1.15] text-white mb-4"
            style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>
            Start Growing<br />
            Your Business on{' '}
            <em className="not-italic text-[#d4a96a]">Tarmeer</em>
          </h1>

          <p className="text-[15px] text-white/60 font-light max-w-sm mx-auto leading-relaxed">
            UAE's leading interior design &amp; renovation platform. Connect with homeowners actively looking for your services.
          </p>
        </div>
      </section>

      {/* ── Section heading ── */}
      <div className="text-center px-6 pt-10 pb-6">
        <span className="text-[11px] font-semibold tracking-[0.14em] uppercase text-[#b8864a] block mb-2">
          How it works
        </span>
        <h2 className="text-[clamp(22px,5vw,34px)] font-semibold text-[#1a1410] leading-snug"
          style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>
          Five steps to your<br />first client inquiry
        </h2>
        <p className="text-[15px] text-[#7a6a5a] mt-2 max-w-xs mx-auto">
          Most companies complete the full setup in under 20 minutes.
        </p>
      </div>

      {/* ── Steps ── */}
      <div className="px-5 pb-12 max-w-xl mx-auto">
        {STEPS.map((step, i) => (
          <div key={step.num}>
            {/* Connector between cards */}
            {i > 0 && (
              <div className="flex justify-center my-1">
                <div className="w-px h-5 bg-[#e8ddd0]" />
              </div>
            )}

            <div className={`rounded-[20px] overflow-hidden border bg-white shadow-sm ${
              step.active
                ? 'border-[#b8864a]/30 shadow-[0_4px_28px_rgba(184,134,74,0.10)]'
                : 'border-[#e8ddd0]'
            }`}>
              {/* Screenshot */}
              <div className="relative overflow-hidden bg-stone-100" style={{ height: 280 }}>
                <img
                  src={step.image}
                  alt={step.imageAlt}
                  className="w-full h-full object-cover object-top"
                  loading="lazy"
                />
                <div className="absolute bottom-0 left-0 right-0 h-8"
                  style={{ background: 'linear-gradient(transparent, rgba(255,255,255,0.92))' }} />
              </div>

              {/* Text */}
              <div className="px-5 py-4">
                <div className="flex items-center gap-3 mb-2">
                  {/* Step number */}
                  <span className={`text-[32px] font-bold leading-none tabular-nums ${
                    step.active ? 'text-[#b8864a]' : 'text-[#a89888]'
                  }`} style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>
                    {step.num}
                  </span>
                  <span className={`text-[10px] font-semibold tracking-[0.08em] uppercase px-2.5 py-1 rounded-full ${
                    step.active ? 'text-[#b8864a] bg-[#f5ede0]' : 'text-[#7a6a5a] bg-[#f0ebe3]'
                  }`}>
                    {step.time}
                  </span>
                </div>

                <h3 className="text-[20px] font-semibold text-[#1a1410] mb-2 leading-snug"
                  style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>
                  {step.title}
                </h3>

                <p className="text-[16px] text-[#7a6a5a] leading-relaxed mb-3">
                  {step.body}
                </p>

                <ul className="space-y-2">
                  {step.highlights.map((h) => (
                    <li key={h} className="flex items-start gap-2.5 text-[15px] text-[#2c2420]">
                      <span className="flex-shrink-0 mt-0.5 w-5 h-5 rounded-full bg-[#f5ede0] flex items-center justify-center">
                        <Check size={10} strokeWidth={2.5} className="text-[#b8864a]" />
                      </span>
                      {h}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* ── Footer ── */}
      <div className="flex flex-wrap justify-center gap-x-8 gap-y-2 px-6 py-6 border-t border-[#e8ddd0]">
        {['tarmeer.com/for-companies'].map((item) => (
          <span key={item} className="text-[13px] text-[#b8864a] font-medium">{item}</span>
        ))}
      </div>
    </div>
  );
}
