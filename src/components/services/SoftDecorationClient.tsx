'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { ArrowLeft, CheckCircle, X, MapPin, CircleDollarSign, ChevronLeft, ChevronRight } from 'lucide-react';
import { dedupeProjectCards } from '@/lib/imageCleanup';
import { sanitizePersonName, sanitizePhoneDigits } from '@/lib/formInputRules';
import ServiceInquiryCard from '@/components/services/ServiceInquiryCard';

const serviceJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'Service',
  name: 'Soft Decoration & Furniture Design',
  description: 'Complete soft decoration service including furniture selection, color schemes, lighting plans, and styling for move-in ready spaces.',
  provider: { '@type': 'Organization', name: 'Tarmeer', url: 'https://www.tarmeer.com' },
  areaServed: { '@type': 'Country', name: 'United Arab Emirates' },
  serviceType: 'Soft Decoration',
  url: 'https://www.tarmeer.com/services/soft-decoration',
};

const SERVICES = [
  'Floor plan functional layout drawing',
  'Whole-house 720-degree panoramic dynamic rendering',
  'Layout of your room',
  'Static rendering of each space',
  'Lighting suggestions',
  'A colours plan',
  'Product overview',
  'Color scheme and materials',
  'Purchase list',
];

const PROJECTS_RAW = [
  { id: 's1', title: 'Marina Apartment Makeover', area: '180 m²', style: 'Modern', coverImage: 'https://images.unsplash.com/photo-1618221195710-dd6b41faaea6?w=800&q=80', images: ['https://images.unsplash.com/photo-1618221195710-dd6b41faaea6?w=1200&q=80', 'https://images.unsplash.com/photo-1616486338812-3dadae4b4ace?w=1200&q=80', 'https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?w=1200&q=80'], address: 'Dubai Marina, UAE', cost: 'AED 95,000', description: 'Complete soft furnishing transformation with custom curtains, designer furniture, and curated decor.', year: '2024' },
  { id: 's2', title: 'JVC Family Home Refresh', area: '240 m²', style: 'Contemporary', coverImage: 'https://images.unsplash.com/photo-1616486338812-3dadae4b4ace?w=800&q=80', images: ['https://images.unsplash.com/photo-1616486338812-3dadae4b4ace?w=1200&q=80', 'https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?w=1200&q=80', 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=1200&q=80'], address: 'Jumeirah Village Circle, Dubai', cost: 'AED 125,000', description: 'Family-friendly soft decoration with durable furniture and playful kids room designs.', year: '2024' },
  { id: 's3', title: 'Business Bay Studio', area: '75 m²', style: 'Minimalist', coverImage: 'https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?w=800&q=80', images: ['https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?w=1200&q=80', 'https://images.unsplash.com/photo-1618221195710-dd6b41faaea6?w=1200&q=80', 'https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?w=1200&q=80'], address: 'Business Bay, Dubai', cost: 'AED 45,000', description: 'Smart minimalist studio with multi-functional furniture and clever storage solutions.', year: '2024' },
];

const DISPLAY_PROJECTS = dedupeProjectCards(PROJECTS_RAW);
type DisplayProject = (typeof DISPLAY_PROJECTS)[number];

function SimpleGallery({ images, title }: { images: string[]; title: string }) {
  const [idx, setIdx] = useState(0);
  if (!images.length) return null;
  return (
    <div className="relative rounded-xl overflow-hidden aspect-video bg-stone-100">
      <img src={images[idx]} alt={title} className="w-full h-full object-cover" />
      {images.length > 1 && (
        <>
          <button onClick={() => setIdx((i) => (i - 1 + images.length) % images.length)} className="absolute left-2 top-1/2 -translate-y-1/2 p-1.5 rounded-full bg-black/40 text-white hover:bg-black/60" aria-label="Previous">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button onClick={() => setIdx((i) => (i + 1) % images.length)} className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-full bg-black/40 text-white hover:bg-black/60" aria-label="Next">
            <ChevronRight className="w-4 h-4" />
          </button>
        </>
      )}
    </div>
  );
}

function ProjectModal({ project, onClose }: { project: DisplayProject; onClose: () => void }) {
  const [showForm, setShowForm] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [form, setForm] = useState({ name: '', whatsapp: '', description: '' });
  const formRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const originalStyle = window.getComputedStyle(document.body).overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = originalStyle; };
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    const text = `Hi, I'm interested in a project like "${project.title}". Name: ${form.name}. WhatsApp: ${form.whatsapp}. Requirements: ${form.description}.`;
    window.open(`https://wa.me/971501234567?text=${encodeURIComponent(text)}`, '_blank');
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black/50 flex items-center justify-center p-4" onClick={onClose} role="dialog" aria-modal>
      <div className="bg-white rounded-lg shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden my-8 relative flex flex-col" onClick={(e) => e.stopPropagation()}>
        <button type="button" onClick={onClose} className="absolute top-4 right-4 z-20 p-2 rounded-full bg-stone-100 hover:bg-stone-200 text-[#2c2c2c]" aria-label="Close">
          <X className="w-5 h-5" />
        </button>
        <div className="overflow-y-auto flex-1 rounded-lg">
          <div className="p-6 sm:p-8 pt-14">
            <SimpleGallery images={project.images} title={project.title} />
            <div className="mt-6">
              <h2 className="font-serif text-2xl sm:text-3xl font-semibold text-[#2c2c2c]">{project.title}</h2>
              <p className="text-[#6b6b6b] mt-2">{project.style} · {project.year}</p>
            </div>
            <div className="space-y-4 border-t border-stone-200 pt-6 mt-6">
              <div className="flex gap-3 items-start">
                <MapPin className="w-5 h-5 text-[#b8864a] shrink-0 mt-0.5" />
                <div>
                  <h3 className="font-semibold text-[#2c2c2c] text-sm uppercase tracking-wider">Address</h3>
                  <p className="text-[#2c2c2c] mt-1">{project.address}</p>
                </div>
              </div>
              <div className="flex gap-3 items-start">
                <CircleDollarSign className="w-5 h-5 text-[#b8864a] shrink-0 mt-0.5" />
                <div>
                  <h3 className="font-semibold text-[#2c2c2c] text-sm uppercase tracking-wider">Project cost</h3>
                  <p className="text-[#2c2c2c] mt-1">{project.cost}</p>
                </div>
              </div>
              <div>
                <h3 className="font-semibold text-[#2c2c2c] text-sm uppercase tracking-wider mb-2">Project overview</h3>
                <p className="text-[#2c2c2c] leading-relaxed">{project.description}</p>
              </div>
            </div>
            <div ref={formRef} className="border-t border-stone-200 pt-6 mt-6">
              {!showForm ? (
                <button type="button" onClick={() => { setShowForm(true); setTimeout(() => formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50); }} className="btn-primary text-white">
                  Submit Your Details
                </button>
              ) : submitted ? (
                <p className="text-[#b8864a] font-medium">Thank you! We&apos;ve opened WhatsApp for you to complete the conversation.</p>
              ) : (
                <>
                  <h3 className="font-serif text-xl sm:text-2xl font-bold text-[#2c2c2c] mb-4">Submit your requirements</h3>
                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-[#2c2c2c] mb-1">Your name <span className="text-red-500">*</span></label>
                      <input type="text" required value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: sanitizePersonName(e.target.value) }))} className="w-full px-4 py-2 rounded-lg border border-stone-300 focus:outline-none focus:border-[#b8864a]" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-[#2c2c2c] mb-1">WhatsApp number <span className="text-red-500">*</span></label>
                      <input type="tel" required inputMode="numeric" value={form.whatsapp} onChange={(e) => setForm((p) => ({ ...p, whatsapp: sanitizePhoneDigits(e.target.value) }))} placeholder="+971 50 123 4567" className="w-full px-4 py-2 rounded-lg border border-stone-300 focus:outline-none focus:border-[#b8864a]" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-[#2c2c2c] mb-1">Requirement description <span className="text-red-500">*</span></label>
                      <textarea required rows={3} value={form.description} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} placeholder="e.g. Living room refresh, 50 sqm, modern style..." className="w-full px-4 py-2 rounded-lg border border-stone-300 focus:outline-none focus:border-[#b8864a] resize-y" />
                    </div>
                    <button type="submit" className="btn-primary text-white">Submit</button>
                  </form>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function SoftDecorationClient() {
  const [selectedProject, setSelectedProject] = useState<DisplayProject | null>(null);

  return (
    <div className="min-h-screen bg-[#faf9f7]">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(serviceJsonLd) }} />
      <section className="relative h-[200px] sm:h-[280px] overflow-hidden bg-gradient-to-r from-[#2c2c2c] to-[#3d3d3d]">
        <div className="absolute inset-0 opacity-30">
          <img src="https://images.unsplash.com/photo-1616486338812-3dadae4b4ace?w=1600&q=80" alt="" className="w-full h-full object-cover" />
        </div>
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 h-full flex items-center">
          <div>
            <p className="text-xs sm:text-sm uppercase tracking-widest text-white/60 mb-2">Design Package</p>
            <h1 className="font-serif text-3xl sm:text-4xl md:text-5xl text-white font-bold mb-2">Soft Decoration Design</h1>
            <p className="text-white/70 text-sm mt-3 max-w-lg hidden sm:block">Transform your space: layout optimization, 720° virtual tour, mood boards, and complete soft furnishing plans.</p>
          </div>
        </div>
      </section>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 lg:py-12">
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start">
          <div>
            <div className="flex items-center gap-3 mb-6">
              <Link href="/#pricing" className="inline-flex items-center gap-1.5 text-sm text-[#6b6b6b] hover:text-[#b8864a] transition shrink-0">
                <ArrowLeft className="w-4 h-4" />
                Back
              </Link>
              <h2 className="font-serif text-xl sm:text-2xl text-[#2c2c2c] font-semibold">What You&apos;ll Get</h2>
            </div>

            <div className="bg-white rounded-lg border border-stone-200 p-4 sm:p-5">
              <ul className="space-y-3">
                {SERVICES.map((item, idx) => (
                  <li key={idx} className="flex items-start gap-3 text-[#2c2c2c]">
                    <CheckCircle className="w-5 h-5 text-[#b8864a] shrink-0 mt-0.5" />
                    <span className="text-sm sm:text-base">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <aside className="lg:sticky lg:top-6">
            <ServiceInquiryCard
              title="Get in touch with Tarmeer"
              subtitle="Tell us about your project and we'll connect you."
            />
          </aside>
        </div>
      </div>

      {selectedProject && <ProjectModal project={selectedProject} onClose={() => setSelectedProject(null)} />}
    </div>
  );
}
