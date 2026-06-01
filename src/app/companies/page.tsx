import type { Metadata } from 'next';
import { Suspense } from 'react';
import { fetchPublicCompanies } from '@/lib/publicApi';
import CompaniesClient from '@/components/companies/CompaniesClient';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Interior Design Companies in UAE - Tarmeer',
  description:
    'Browse and compare interior design companies, renovation firms, and fit-out contractors in Dubai, Abu Dhabi, Sharjah. View portfolios and request quotes.',
  openGraph: {
    title: 'Interior Design Companies in UAE - Tarmeer',
    description:
      'Browse and compare interior design companies, renovation firms, and fit-out contractors in UAE.',
    url: 'https://www.tarmeer.com/companies',
    type: 'website',
    images: [{ url: 'https://www.tarmeer.com/images/tarmeer_logo.svg' }],
  },
  twitter: {
    card: 'summary_large_image',
  },
  alternates: {
    canonical: 'https://www.tarmeer.com/companies',
  },
};

export default async function CompaniesPage() {
  const result = await Promise.allSettled([fetchPublicCompanies(300)]);
  const companies = result[0].status === 'fulfilled' ? result[0].value : [];

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: 'Interior Design Companies in UAE',
    description:
      'Verified interior design and renovation companies across the United Arab Emirates.',
    numberOfItems: companies.length,
    itemListElement: companies.slice(0, 30).map((c, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      item: {
        '@type': 'LocalBusiness',
        name: c.name,
        url: `https://www.tarmeer.com/companies/${c.slug || c.id}`,
        ...(c.city && {
          address: {
            '@type': 'PostalAddress',
            addressLocality: c.city,
            addressCountry: 'AE',
          },
        }),
      },
    })),
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <Suspense>
        <CompaniesClient initialCompanies={companies} />
      </Suspense>
    </>
  );
}
