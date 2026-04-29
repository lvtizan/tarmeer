import { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet-async';
import { Check } from 'lucide-react';
import TarmeerLogo from '../components/TarmeerLogo';

const API_BASE = import.meta.env.VITE_API_URL?.trim() || '/api';

// ── Fetch real project images from directory companies ───────────────────────
function useProjectImages(count: number): string[] {
  const [images, setImages] = useState<string[]>([]);
  useEffect(() => {
    fetch(`${API_BASE}/companies?limit=40`)
      .then(r => r.ok ? r.json() : Promise.reject())
      .then((data: any[]) => {
        const imgs: string[] = [];
        for (const c of data) {
          const raw = c.portfolio_images;
          if (!raw) continue;
          try {
            const arr = typeof raw === 'string' ? JSON.parse(raw) : raw;
            if (Array.isArray(arr)) {
              for (const img of arr) {
                if (img && typeof img === 'string' && !imgs.includes(img)) {
                  imgs.push(img);
                  if (imgs.length >= count) break;
                }
              }
            }
          } catch { /* skip */ }
          if (imgs.length >= count) break;
        }
        if (imgs.length >= 3) setImages(imgs.slice(0, count));
      })
      .catch(() => {});
  }, [count]);
  return images;
}

// ── Fallback gradient tiles when images not yet loaded ───────────────────────
const FALLBACK_GRADS = [
  'linear-gradient(135deg, #9a7d5a 0%, #c9a96e 100%)',
  'linear-gradient(135deg, #2d4a7a 0%, #4a6fa5 100%)',
  'linear-gradient(135deg, #1a3a2a 0%, #2d6a4f 100%)',
  'linear-gradient(135deg, #5c3317 0%, #9a5e2a 100%)',
  'linear-gradient(135deg, #2d1f4a 0%, #5c3d8a 100%)',
];

function ImgTile({ src, fallback, className }: { src?: string; fallback: string; className?: string }) {
  return (
    <div className={`overflow-hidden rounded-xl ${className ?? ''}`}
      style={!src ? { background: fallback } : undefined}>
      {src && <img src={src} alt="" className="w-full h-full object-cover" loading="lazy" />}
    </div>
  );
}

// ── Step 1: Registration form ────────────────────────────────────────────────
function Step1Image() {
  const fields = [
    { label: 'Company Name', placeholder: 'Al Mansoori Interiors LLC' },
    { label: 'Contact Person', placeholder: 'Your full name' },
    { label: 'Phone Number', placeholder: '+971 50 000 0000' },
    { label: 'City', placeholder: 'Dubai' },
    { label: 'Work Email', placeholder: 'you@company.com' },
  ];
  return (
    <div className="h-full overflow-hidden flex items-start justify-center"
      style={{ background: 'linear-gradient(160deg, #1a1410 0%, #2d1f0e 100%)' }}>
      <div style={{ transform: 'scale(0.62)', transformOrigin: 'top center', width: '100%' }}>
        <div className="bg-white rounded-2xl mx-4 px-5 pt-5 pb-4 shadow-2xl">
          <div className="text-[22px] font-bold text-[#1a1410] mb-1"
            style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>
            Register Your Company
          </div>
          <div className="text-[13px] text-stone-400 mb-4">Join 2,000+ companies on Tarmeer UAE</div>
          {fields.map(f => (
            <div key={f.label} className="mb-3">
              <div className="text-[11px] font-semibold text-stone-400 uppercase tracking-wider mb-1">{f.label}</div>
              <div className="h-11 rounded-xl bg-stone-50 border border-stone-200 flex items-center px-4">
                <span className="text-[13px] text-stone-300">{f.placeholder}</span>
              </div>
            </div>
          ))}
          <div className="mt-4 h-12 rounded-xl flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg, #b8864a 0%, #d4a96a 100%)' }}>
            <span className="text-white font-semibold text-[15px]">Get Started →</span>
          </div>
          <div className="text-center text-[11px] text-stone-400 mt-3">Already have an account? Sign in</div>
        </div>
      </div>
    </div>
  );
}

// ── Step 2: Sign-in screen ───────────────────────────────────────────────────
function Step2Image() {
  return (
    <div className="h-full overflow-hidden flex items-start justify-center bg-[#f5f0ea]">
      <div style={{ transform: 'scale(0.62)', transformOrigin: 'top center', width: '100%' }}>
        <div className="bg-white rounded-2xl mx-4 px-6 pt-6 pb-5 shadow-2xl">
          <div className="text-[22px] font-bold text-[#1a1410] mb-1"
            style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>
            Welcome Back
          </div>
          <div className="text-[13px] text-stone-400 mb-5">Sign in to your Tarmeer account</div>
          <div className="h-13 rounded-2xl border border-stone-200 flex items-center justify-center gap-3 mb-5 py-3">
            <svg width="20" height="20" viewBox="0 0 48 48">
              <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
              <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
              <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
              <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.18 1.48-4.97 2.31-8.16 2.31-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
            </svg>
            <span className="text-[15px] font-medium text-stone-700">Continue with Google</span>
          </div>
          <div className="flex items-center gap-3 mb-5">
            <div className="flex-1 h-px bg-stone-200" />
            <span className="text-[11px] text-stone-400 uppercase tracking-wider">or continue with email</span>
            <div className="flex-1 h-px bg-stone-200" />
          </div>
          {[{ label: 'Email', placeholder: 'you@company.com' }, { label: 'Password', placeholder: '••••••••' }].map(f => (
            <div key={f.label} className="mb-3">
              <div className="text-[11px] font-semibold text-stone-400 uppercase tracking-wider mb-1">{f.label}</div>
              <div className="h-11 rounded-xl bg-stone-50 border border-stone-200 flex items-center px-4">
                <span className="text-[13px] text-stone-300">{f.placeholder}</span>
              </div>
            </div>
          ))}
          <div className="text-right text-[12px] text-[#b8864a] mb-4">Forgot password?</div>
          <div className="h-12 rounded-xl flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg, #b8864a 0%, #d4a96a 100%)' }}>
            <span className="text-white font-semibold text-[15px]">Sign In</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Step 3: Project portfolio — 5-photo staggered grid, light bg ─────────────
function Step3Image({ images }: { images: string[] }) {
  const get = (i: number) => images[i];
  return (
    <div className="h-full bg-[#edeae5] p-3 flex flex-col gap-2">
      {/* Row 1: 3 equal landscape images */}
      <div className="grid grid-cols-3 gap-2 flex-1">
        {[0, 1, 2].map(i => (
          <ImgTile key={i} src={get(i)} fallback={FALLBACK_GRADS[i]} className="h-full" />
        ))}
      </div>
      {/* Row 2: 2 wider images */}
      <div className="grid grid-cols-2 gap-2 flex-1">
        {[3, 4].map(i => (
          <ImgTile key={i} src={get(i)} fallback={FALLBACK_GRADS[i]} className="h-full" />
        ))}
      </div>
    </div>
  );
}

// ── Step 4: Upload interface — 3 project thumbnails ──────────────────────────
function Step4Image({ images }: { images: string[] }) {
  return (
    <div className="h-full bg-[#faf9f7] overflow-hidden flex items-start justify-center pt-3">
      <div style={{ transform: 'scale(0.68)', transformOrigin: 'top center', width: '100%' }}>
        <div className="mx-4">
          {/* Upload drop zone */}
          <div className="border-2 border-dashed border-[#b8864a]/50 rounded-2xl bg-[#fdf8f2] p-4 mb-3 text-center">
            <div className="w-11 h-11 rounded-xl bg-[#f5ede0] flex items-center justify-center mx-auto mb-2">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#b8864a" strokeWidth="2" strokeLinecap="round">
                <rect x="3" y="3" width="18" height="18" rx="3" /><circle cx="8.5" cy="8.5" r="1.5" />
                <polyline points="21 15 16 10 5 21" />
              </svg>
            </div>
            <div className="text-[14px] font-semibold text-[#1a1410] mb-1">Drop photos here or tap to upload</div>
            <div className="text-[12px] text-stone-400">JPG or PNG · 3–8 photos per project</div>
          </div>

          {/* 3 project thumbnails: 1 landscape (2fr) + 2 squares (1fr each) */}
          <div className="grid gap-2 mb-3" style={{ gridTemplateColumns: '2fr 1fr 1fr', height: '80px' }}>
            {/* Project 1 — landscape cover */}
            <div className="rounded-xl overflow-hidden relative">
              {images[0]
                ? <img src={images[0]} alt="" className="w-full h-full object-cover" loading="lazy" />
                : <div className="w-full h-full" style={{ background: FALLBACK_GRADS[0] }} />}
              <div className="absolute top-1 right-1 w-4 h-4 rounded-full bg-[#b8864a] flex items-center justify-center">
                <span className="text-[7px] text-white font-bold">✓</span>
              </div>
            </div>
            {/* Project 2 — square */}
            <div className="rounded-xl overflow-hidden relative">
              {images[1]
                ? <img src={images[1]} alt="" className="w-full h-full object-cover" loading="lazy" />
                : <div className="w-full h-full" style={{ background: FALLBACK_GRADS[1] }} />}
              <div className="absolute top-1 right-1 w-4 h-4 rounded-full bg-[#b8864a] flex items-center justify-center">
                <span className="text-[7px] text-white font-bold">✓</span>
              </div>
            </div>
            {/* Project 3 — square */}
            <div className="rounded-xl overflow-hidden relative">
              {images[2]
                ? <img src={images[2]} alt="" className="w-full h-full object-cover" loading="lazy" />
                : <div className="w-full h-full" style={{ background: FALLBACK_GRADS[2] }} />}
              <div className="absolute top-1 right-1 w-4 h-4 rounded-full bg-[#b8864a] flex items-center justify-center">
                <span className="text-[7px] text-white font-bold">✓</span>
              </div>
            </div>
          </div>

          {/* Fields */}
          {[
            { label: 'Project Title', placeholder: 'Modern Villa Renovation, Dubai' },
            { label: 'Location', placeholder: 'Dubai Marina' },
          ].map(f => (
            <div key={f.label} className="mb-2.5">
              <div className="text-[11px] font-semibold text-stone-400 uppercase tracking-wider mb-1">{f.label}</div>
              <div className="h-10 rounded-xl bg-white border border-stone-200 flex items-center px-3">
                <span className="text-[12px] text-stone-300">{f.placeholder}</span>
              </div>
            </div>
          ))}

          <div className="mt-3 h-11 rounded-xl flex items-center justify-center gap-2"
            style={{ background: 'linear-gradient(135deg, #b8864a 0%, #d4a96a 100%)' }}>
            <span className="text-white font-semibold text-[14px]">Upload Project</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Step 5: WhatsApp lead notification — no clipping ────────────────────────
function Step5Image() {
  return (
    <div className="h-full overflow-hidden flex flex-col" style={{ background: '#dfe7d0' }}>
      {/* WhatsApp header */}
      <div className="flex-shrink-0 px-3 py-2.5 flex items-center gap-2.5"
        style={{ background: '#075E54' }}>
        <div className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-white text-[14px] flex-shrink-0"
          style={{ background: '#25D366' }}>T</div>
        <div className="flex-1 min-w-0">
          <div className="text-white text-[12px] font-semibold">Tarmeer Leads</div>
          <div className="text-white/60 text-[10px]">online</div>
        </div>
        <div className="flex gap-2.5">
          <div className="w-4 h-4 rounded-full bg-white/10" />
          <div className="w-4 h-4 rounded-full bg-white/10" />
        </div>
      </div>

      {/* Chat messages — compact to avoid clipping */}
      <div className="flex-1 px-2.5 py-2.5 flex flex-col gap-2 overflow-hidden">
        {/* Message 1 */}
        <div className="bg-white rounded-xl rounded-tl-sm px-3 py-2 shadow-sm">
          <div className="text-[11px] font-bold mb-1.5" style={{ color: '#075E54' }}>
            New Lead Assigned
          </div>
          <div className="space-y-0.5">
            {[
              ['Client', 'Ahmad Al Mansoori'],
              ['Project', 'Kitchen & Bathroom Renovation'],
              ['Location', 'Dubai Marina'],
              ['Budget', 'AED 80,000–120,000'],
            ].map(([k, v]) => (
              <div key={k} className="text-[11px] text-stone-700">
                <span className="text-stone-400">{k}: </span><strong>{v}</strong>
              </div>
            ))}
          </div>
          <div className="text-[9px] text-stone-400 text-right mt-1.5">9:42 AM ✓✓</div>
        </div>

        {/* Message 2 */}
        <div className="bg-white rounded-xl rounded-tl-sm px-3 py-2 shadow-sm">
          <div className="text-[11px] text-stone-700 flex items-center gap-1.5">
            <span style={{ color: '#25D366' }}>📞</span>
            <strong>+971 50 123 4567</strong>
          </div>
          <div className="text-[10px] text-stone-400 mt-0.5">Tap to call or message the client</div>
          <div className="text-[9px] text-stone-400 text-right mt-1">9:42 AM ✓✓</div>
        </div>
      </div>
    </div>
  );
}

// ── Step data ────────────────────────────────────────────────────────────────
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
  },
  {
    num: '03',
    time: '~5 min',
    title: 'Complete Your Profile',
    body: 'Add your company description, services, and logo. A complete profile gets 3× more inquiries.',
    highlights: [
      'Types of projects you handle',
      'Services and specialties',
      'Company logo and cover image',
    ],
    active: true,
  },
  {
    num: '04',
    time: '~5 min · Required',
    title: 'Upload Your Projects',
    body: 'Submit high-quality project photos — the more projects you upload, the higher your ranking on the platform.',
    highlights: [
      'Project title, location & style',
      'Upload 3–8 photos per project (JPG or PNG)',
      'More projects = higher search ranking',
    ],
  },
  {
    num: '05',
    time: 'Automated',
    title: 'Receive Client Leads',
    body: 'Tarmeer matches each homeowner request to the right companies. Once assigned, you get the client details instantly.',
    highlights: [
      "You'll be contacted via WhatsApp with the client's name, project scope, and contact number",
    ],
  },
];

// ── Page ─────────────────────────────────────────────────────────────────────
export default function StartGuidePage() {
  const images = useProjectImages(8);

  const renderImage = (index: number) => {
    if (index === 0) return <Step1Image />;
    if (index === 1) return <Step2Image />;
    if (index === 2) return <Step3Image images={images} />;
    if (index === 3) return <Step4Image images={images.slice(5, 8)} />;
    return <Step5Image />;
  };

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
          <div className="inline-flex items-center gap-2 border border-[#b8864a]/30 bg-[#b8864a]/15 text-[#d4a96a] text-[12px] font-semibold tracking-[0.12em] uppercase px-4 py-1.5 rounded-full mb-5">
            ✦ For Construction Companies
          </div>

          <h1 className="text-[clamp(32px,8vw,52px)] font-bold leading-[1.15] text-white mb-4"
            style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>
            Start Growing<br />
            Your Business on{' '}
            <em className="not-italic text-[#d4a96a]">Tarmeer</em>
          </h1>

          <p className="text-[17px] text-white/60 font-light max-w-sm mx-auto leading-relaxed">
            UAE's leading interior design &amp; renovation platform. Connect with homeowners actively looking for your services.
          </p>
        </div>
      </section>

      {/* ── Section heading ── */}
      <div className="text-center px-6 pt-10 pb-6">
        <span className="text-[12px] font-semibold tracking-[0.14em] uppercase text-[#b8864a] block mb-2">
          How it works
        </span>
        <h2 className="text-[clamp(24px,6vw,36px)] font-semibold text-[#1a1410] leading-snug"
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
              {/* Inline UI mockup */}
              <div className="relative overflow-hidden" style={{ height: 280 }}>
                {renderImage(i)}
              </div>

              {/* Text */}
              <div className="px-5 py-4">
                <div className="flex items-center gap-3 mb-2.5">
                  <span className={`text-[36px] font-bold leading-none tabular-nums ${
                    step.active ? 'text-[#b8864a]' : 'text-[#a89888]'
                  }`} style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>
                    {step.num}
                  </span>
                  <span className={`text-[11px] font-semibold tracking-[0.08em] uppercase px-2.5 py-1 rounded-full ${
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
        <span className="text-[14px] text-[#b8864a] font-medium">tarmeer.com/for-companies</span>
      </div>
    </div>
  );
}
