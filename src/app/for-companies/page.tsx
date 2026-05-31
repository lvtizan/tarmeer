import type { Metadata } from 'next';
import ForCompaniesClient from '@/components/for-companies/ForCompaniesClient';

export const metadata: Metadata = {
  title: 'Join Tarmeer — Get Homeowner Leads Free | UAE Renovation Platform',
  description:
    'Join 100+ renovation companies on Tarmeer. Get homeowner leads, showcase your projects, grow your business — 100% free.',
  openGraph: {
    title: 'Join Tarmeer — Get Homeowner Leads Free',
    description: 'Upload your projects. Homeowners find you and call you. Free to join.',
    images: [{ url: 'https://www.tarmeer.com/images/tarmeer_logo.svg' }],
    url: 'https://www.tarmeer.com/for-companies',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
  },
  alternates: {
    canonical: 'https://www.tarmeer.com/for-companies',
  },
  keywords: [
    'join Tarmeer',
    'renovation company UAE',
    'get homeowner leads',
    'renovation platform Dubai',
    'free contractor listing',
  ],
};

const serviceJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'Service',
  name: 'Tarmeer — Renovation Company Lead Generation',
  description: 'Join 100+ renovation and interior design companies on Tarmeer. Get verified homeowner leads, showcase your project portfolio, and grow your business for free across UAE.',
  provider: {
    '@type': 'Organization',
    name: 'Tarmeer',
    url: 'https://www.tarmeer.com',
    logo: 'https://www.tarmeer.com/images/tarmeer_logo.svg',
  },
  areaServed: { '@type': 'Country', name: 'United Arab Emirates' },
  serviceType: 'Lead Generation Platform',
  url: 'https://www.tarmeer.com/for-companies',
  offers: {
    '@type': 'Offer',
    price: '0',
    priceCurrency: 'AED',
    description: 'Free to join and list your company portfolio',
  },
};

export default function ForCompaniesPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(serviceJsonLd) }}
      />
      <ForCompaniesClient />
    </>
  );
}
