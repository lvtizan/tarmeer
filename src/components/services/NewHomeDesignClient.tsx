'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, CheckCircle } from 'lucide-react';
import { dedupeProjectCards } from '@/lib/imageCleanup';
import ServiceInquiryCard from '@/components/services/ServiceInquiryCard';
import ServiceProjectModal from '@/components/services/ServiceProjectModal';

const serviceJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'Service',
  name: 'New Home Interior Design',
  description: 'Complete interior design package for new homes including floor plans, 3D renderings, construction drawings, and material specifications.',
  provider: { '@type': 'Organization', name: 'Tarmeer', url: 'https://www.tarmeer.com' },
  areaServed: { '@type': 'Country', name: 'United Arab Emirates' },
  serviceType: 'Interior Design',
  url: 'https://www.tarmeer.com/services/new-home-design',
};

const SERVICES = [
  {
    title: 'Floor Plan/Renderings',
    items: [
      'Floor Layout Plan',
      'Whole-House Panoramic Rendering (soft furnishings, hard finishes, lighting)',
    ],
  },
  {
    title: 'Full-House Construction Drawings (1 set)',
    note: 'Cabinetry drawings excluded. Includes:',
    items: [
      'Construction Drawing Cover',
      'Drawing Index',
      'Electrical Distribution Specifications',
      'Design & Construction Specifications',
      'Original Structural Drawing',
      'Wall Demolition Drawing',
      'New Wall Construction Drawing',
      'Floor Plan Layout',
      'Furniture Dimension Drawing',
      'Floor Paving Drawing',
      'Ceiling Layout Drawing',
      'Lighting Positioning Drawing',
      'Switch Layout Drawing',
      'Socket Positioning Drawing',
      'Water Supply & Drainage Positioning',
      'Living & Dining Room Feature Elevation',
      'Master Bedroom Feature Elevation',
    ],
  },
];

const PROJECTS_RAW = [
  { id: 'p1', title: 'Modern Villa - Dubai Marina', area: '450 m²', style: 'Contemporary', coverImage: 'https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?w=800&q=80', images: ['https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?w=1200&q=80', 'https://images.unsplash.com/photo-1618221195710-dd6b41faaea6?w=1200&q=80', 'https://images.unsplash.com/photo-1616486338812-3dadae4b4ace?w=1200&q=80'], address: 'Dubai Marina, UAE', cost: 'AED 850,000', description: 'A stunning contemporary villa featuring open-plan living spaces, floor-to-ceiling windows, and premium finishes throughout.', year: '2024' },
  { id: 'p2', title: 'Palm Jumeirah Apartment', area: '280 m²', style: 'Minimalist', coverImage: 'https://images.unsplash.com/photo-1618221195710-dd6b41faaea6?w=800&q=80', images: ['https://images.unsplash.com/photo-1618221195710-dd6b41faaea6?w=1200&q=80', 'https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?w=1200&q=80', 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=1200&q=80'], address: 'Palm Jumeirah, Dubai', cost: 'AED 520,000', description: 'Elegant minimalist apartment with breathtaking ocean views. Clean lines and neutral palette.', year: '2024' },
  { id: 'p3', title: 'Downtown Penthouse', area: '520 m²', style: 'Luxury', coverImage: 'https://images.unsplash.com/photo-1616486338812-3dadae4b4ace?w=800&q=80', images: ['https://images.unsplash.com/photo-1616486338812-3dadae4b4ace?w=1200&q=80', 'https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?w=1200&q=80', 'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=1200&q=80'], address: 'Downtown Dubai, UAE', cost: 'AED 1,200,000', description: 'Exclusive penthouse with panoramic Burj Khalifa views. Marble floors and designer fixtures.', year: '2023' },
];

const DISPLAY_PROJECTS = dedupeProjectCards(PROJECTS_RAW);
type DisplayProject = (typeof DISPLAY_PROJECTS)[number];



export default function NewHomeDesignClient() {
  const [selectedProject, setSelectedProject] = useState<DisplayProject | null>(null);

  return (
    <div className="min-h-screen bg-[#faf9f7]">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(serviceJsonLd) }} />
      <section className="relative h-[200px] sm:h-[280px] overflow-hidden bg-gradient-to-r from-[#2c2c2c] to-[#3d3d3d]">
        <div className="absolute inset-0 opacity-30">
          <img src="https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=1600&q=80" alt="" className="w-full h-full object-cover" />
        </div>
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 h-full flex items-center">
          <div>
            <p className="text-xs sm:text-sm uppercase tracking-widest text-white/60 mb-2">Design Package</p>
            <h1 className="font-serif text-3xl sm:text-4xl md:text-5xl text-white font-bold mb-2">New Home Full Case Design</h1>
            <p className="text-white/70 text-sm mt-3 max-w-lg hidden sm:block">Complete package: floor plans, 3D visuals, construction drawings, and material specifications.</p>
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

            <div className="space-y-4">
              {SERVICES.map((service, idx) => (
                <div key={idx} className="bg-white rounded-lg border border-stone-200 p-4 sm:p-5">
                  <h3 className="text-base font-semibold text-[#2c2c2c] mb-2">{service.title}</h3>
                  {service.note && <p className="text-xs text-[#6b6b6b] italic mb-2">{service.note}</p>}
                  {service.items && (
                    <ul className="grid grid-cols-1 gap-1.5 mt-3">
                      {service.items.map((item, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm text-[#2c2c2c]/90">
                          <CheckCircle className="w-4 h-4 text-[#b8864a] shrink-0 mt-0.5" />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </div>

            <div className="mt-4 p-4 bg-[#b8864a]/10 border border-[#b8864a]/30 rounded-lg">
              <p className="text-sm text-[#2c2c2c] text-center"><span className="font-semibold">Included:</span> PDF + CAD source files</p>
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

      {selectedProject && <ServiceProjectModal project={selectedProject} onClose={() => setSelectedProject(null)} />}
    </div>
  );
}
