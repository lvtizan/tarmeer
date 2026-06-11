import type { Metadata } from 'next';
import { Suspense } from 'react';
import { headers } from 'next/headers';
import ExpertsClient from '@/components/experts/ExpertsClient';
import type { ExpertListItem, ExpertsPagination } from '@/components/experts/types';

export const dynamic = 'force-dynamic';

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL?.trim() ??
  process.env.API_INTERNAL_URL?.trim() ??
  '/api';

export async function generateMetadata(): Promise<Metadata> {
  const headersList = await headers();
  const country = headersList.get('x-country') ?? 'ae';
  const isVn = country === 'vn';

  const title = isVn
    ? 'Tìm Chuyên Gia Thiết Kế & Thi Công Nội Thất - Tarmeer'
    : 'Find Interior Design & Fit-Out Experts in UAE - Tarmeer';
  const description = isVn
    ? 'Kết nối với các chuyên gia thiết kế nội thất, thi công và hoàn thiện đã được xác minh tại Việt Nam. Xem hồ sơ, kinh nghiệm và chứng chỉ.'
    : 'Connect with verified interior design, carpentry, fit-out and finishing professionals in Dubai, Abu Dhabi and across the UAE. View profiles, experience and certificates.';
  const canonical = isVn ? 'https://vn.tarmeer.com/experts' : 'https://www.tarmeer.com/experts';

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

interface ExpertsResponse {
  experts?: ExpertListItem[];
  pagination?: ExpertsPagination;
}

async function fetchExperts(
  country: string,
  service: string,
  city: string,
  certified: boolean,
  page: number,
): Promise<ExpertsResponse> {
  const params = new URLSearchParams({ country });
  if (service) params.set('service', service);
  if (city) params.set('city', city);
  if (certified) params.set('certified', '1');
  if (page > 1) params.set('page', String(page));
  try {
    const res = await fetch(`${API_BASE}/experts?${params.toString()}`, { cache: 'no-store' });
    if (!res.ok) return {};
    return (await res.json()) as ExpertsResponse;
  } catch {
    return {};
  }
}

interface Props {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function ExpertsPage({ searchParams }: Props) {
  const headersList = await headers();
  const country = headersList.get('x-country') ?? 'ae';
  const isVn = country === 'vn';

  const sp = await searchParams;
  const service = typeof sp.service === 'string' ? sp.service : '';
  const city = typeof sp.city === 'string' ? sp.city : '';
  const certified = sp.certified === '1';
  const pageNum = Math.max(1, Number(typeof sp.page === 'string' ? sp.page : '1') || 1);

  const data = await fetchExperts(country, service, city, certified, pageNum);
  const experts = Array.isArray(data.experts)
    ? data.experts.map((e) => ({
        ...e,
        services: Array.isArray(e.services) ? e.services : [],
      }))
    : [];
  const pagination: ExpertsPagination = data.pagination ?? { page: pageNum, limit: 12, total: experts.length };

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: isVn
      ? 'Chuyên Gia Thiết Kế & Thi Công Nội Thất tại Việt Nam'
      : 'Interior Design & Fit-Out Experts in UAE',
    numberOfItems: pagination.total,
    itemListElement: experts.slice(0, 30).map((e, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      item: {
        '@type': 'Person',
        name: e.full_name,
        url: `https://www.tarmeer.com/experts/${e.slug}`,
        ...(e.services.length > 0 && { jobTitle: e.services[0] }),
        ...(e.city && {
          address: {
            '@type': 'PostalAddress',
            addressLocality: e.city,
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
        <ExpertsClient
          experts={experts}
          pagination={pagination}
          service={service}
          city={city}
          certified={certified}
          isVn={isVn}
          country={country}
        />
      </Suspense>
    </>
  );
}
