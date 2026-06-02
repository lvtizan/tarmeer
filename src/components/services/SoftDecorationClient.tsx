'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, CheckCircle } from 'lucide-react';
import { dedupeProjectCards } from '@/lib/imageCleanup';
import { sanitizePersonName, sanitizePhoneDigits } from '@/lib/formInputRules';
import ServiceInquiryCard from '@/components/services/ServiceInquiryCard';
import ServiceProjectModal from '@/components/services/ServiceProjectModal';

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

      {selectedProject && (
        <ServiceProjectModal
          project={selectedProject}
          onClose={() => setSelectedProject(null)}
          sanitizeName={sanitizePersonName}
          sanitizePhone={sanitizePhoneDigits}
        />
      )}
    </div>
  );
}
