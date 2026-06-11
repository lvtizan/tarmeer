import type { Metadata } from 'next';
import { headers } from 'next/headers';
import ForCompaniesClient from '@/components/for-companies/ForCompaniesClient';
import { getCountry } from '@/lib/country';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const c = getCountry((await headers()).get('x-country'));
  return {
    title: `Join Tarmeer — Get Homeowner Leads Free | ${c.name} Renovation Platform`,
    description:
      'Join 100+ renovation companies on Tarmeer. Get homeowner leads, showcase your projects, grow your business — 100% free.',
    openGraph: {
      title: 'Join Tarmeer — Get Homeowner Leads Free',
      description: 'Upload your projects. Homeowners find you and call you. Free to join.',
      images: [{ url: `${c.baseUrl}/images/tarmeer_logo.svg` }],
      url: `${c.baseUrl}/for-companies`,
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
    },
    alternates: {
      canonical: `${c.baseUrl}/for-companies`,
    },
    keywords: [
      'join Tarmeer',
      `renovation company ${c.name}`,
      'get homeowner leads',
      `renovation platform ${c.defaultCity}`,
      'free contractor listing',
    ],
  };
}

export default async function ForCompaniesPage() {
  const c = getCountry((await headers()).get('x-country'));

  const serviceJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Service',
    name: 'Tarmeer — Renovation Company Lead Generation',
    description: `Join 100+ renovation and interior design companies on Tarmeer. Get verified homeowner leads, showcase your project portfolio, and grow your business for free across ${c.name}.`,
    provider: {
      '@type': 'Organization',
      name: 'Tarmeer',
      url: c.baseUrl,
      logo: `${c.baseUrl}/images/tarmeer_logo.svg`,
    },
    areaServed: { '@type': 'Country', name: c.fullName },
    serviceType: 'Lead Generation Platform',
    url: `${c.baseUrl}/for-companies`,
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: c.currency,
      description: 'Free to join and list your company portfolio',
    },
  };

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
