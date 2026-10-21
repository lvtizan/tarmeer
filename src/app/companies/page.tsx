import type { Metadata } from 'next';
import { Suspense } from 'react';
import { headers } from 'next/headers';
import { fetchPublicCompanies } from '@/lib/publicApi';
import { getCountry } from '@/lib/country';
import { jsonLdHtml } from '@/lib/schema/jsonLdScript';
import CompaniesClient from '@/components/companies/CompaniesClient';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const title = 'Interior Design Companies in UAE - Tarmeer';
  const description = 'Browse and compare interior design companies, renovation firms, and fit-out contractors in Dubai, Abu Dhabi, Sharjah. View portfolios and request quotes.';
  const canonical = 'https://www.tarmeer.com/companies';

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url: canonical,
      type: 'website',
      images: [{ url: 'https://www.tarmeer.com/images/tarmeer_logo.svg' }],
    },
    twitter: { card: 'summary_large_image' },
    alternates: { canonical },
  };
}

export default async function CompaniesPage() {
  const headersList = await headers();
  const country = headersList.get('x-country') ?? 'ae';
  const c = getCountry(country);

  const result = await Promise.allSettled([fetchPublicCompanies(300, 'list', country)]);
  if (result[0].status === 'rejected') console.error('[companies] SSR fetch failed:', result[0].reason);
  const companies = result[0].status === 'fulfilled' ? result[0].value : [];

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    '@id': `${c.baseUrl}/companies#itemlist`,
    name: 'Interior Design Companies in UAE',
    description: 'Verified interior design and renovation companies across the United Arab Emirates.',
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
        dangerouslySetInnerHTML={{ __html: jsonLdHtml(jsonLd) }}
      />
      <Suspense>
        <CompaniesClient initialCompanies={companies} />
      </Suspense>
    </>
  );
}
