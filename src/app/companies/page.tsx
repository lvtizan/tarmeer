import type { Metadata } from 'next';
import { Suspense } from 'react';
import { headers } from 'next/headers';
import { fetchPublicCompanies } from '@/lib/publicApi';
import CompaniesClient from '@/components/companies/CompaniesClient';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const headersList = await headers();
  const country = headersList.get('x-country') ?? 'ae';
  const isVn = country === 'vn';

  const title = isVn
    ? 'Công Ty Thiết Kế Nội Thất tại Việt Nam - Tarmeer'
    : 'Interior Design Companies in UAE - Tarmeer';
  const description = isVn
    ? 'Tìm và so sánh các công ty thiết kế nội thất, thi công, cải tạo hàng đầu tại Việt Nam. Xem hồ sơ năng lực và yêu cầu báo giá.'
    : 'Browse and compare interior design companies, renovation firms, and fit-out contractors in Dubai, Abu Dhabi, Sharjah. View portfolios and request quotes.';
  const canonical = isVn ? 'https://vn.tarmeer.com/companies' : 'https://www.tarmeer.com/companies';

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
  const isVn = country === 'vn';

  const result = await Promise.allSettled([fetchPublicCompanies(300, 'list', country)]);
  const companies = result[0].status === 'fulfilled' ? result[0].value : [];

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: isVn ? 'Công Ty Thiết Kế Nội Thất tại Việt Nam' : 'Interior Design Companies in UAE',
    description: isVn
      ? 'Các công ty thiết kế nội thất và thi công hàng đầu tại Việt Nam.'
      : 'Verified interior design and renovation companies across the United Arab Emirates.',
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
            addressCountry: isVn ? 'VN' : 'AE',
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
