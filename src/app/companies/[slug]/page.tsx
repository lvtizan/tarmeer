export const dynamic = 'force-dynamic';

import type { Metadata } from 'next';
import { permanentRedirect, notFound } from 'next/navigation';
import { headers } from 'next/headers';
import { fetchPublicCompanyDetail } from '@/lib/publicApi';
import { getCompanyTypeLabel } from '@/lib/companyData';
import { getCountry } from '@/lib/country';
import { jsonLdHtml } from '@/lib/schema/jsonLdScript';
import CompanyDetailClient from '@/components/companies/CompanyDetailClient';

const API_BASE = process.env.NEXT_PUBLIC_API_URL?.trim() ?? process.env.API_INTERNAL_URL?.trim() ?? 'http://localhost:3002/api';

export async function generateStaticParams(): Promise<Array<{ slug: string }>> {
  try {
    const res = await fetch(`${API_BASE}/companies?limit=500`, { next: { revalidate: 3600 } });
    if (!res.ok) return [];
    const data = await res.json() as { companies?: Array<{ id: number; slug?: string }> };
    return (data.companies ?? [])
      .filter((c) => c.id)
      .map((c) => ({ slug: String(c.slug ?? c.id) }));
  } catch {
    return [];
  }
}

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const headersList = await headers();
  const metaCountry = headersList.get('x-country') ?? 'ae';
  const metaIsVn = metaCountry === 'vn';
  const baseUrl = getCountry(metaCountry).baseUrl; // 按国家切 canonical 域名（vn.tarmeer.com / www.tarmeer.com）
  try {
    const company = await fetchPublicCompanyDetail(slug);
    const canonicalSlug = company.slug || slug;
    const typeLabel = getCompanyTypeLabel(company.companyType) || 'Interior Design';
    const heroImages = company.projectImages.filter(Boolean).slice(0, 1);
    const ogImage = heroImages[0]
      ? `https://www.tarmeer.com${heroImages[0]}`
      : 'https://www.tarmeer.com/images/tarmeer_logo.svg';
    const locationSuffix = metaIsVn ? '' : ', UAE';
    const description = `${company.name}${company.companyType ? ` (${typeLabel})` : ''} provides ${company.services.slice(0, 3).join(', ')} services in ${company.city}${locationSuffix}. ${company.shortDescription}`;

    return {
      title: `${company.name} - ${typeLabel} in ${company.city} - Tarmeer`,
      description,
      keywords: `${company.name}, interior design ${company.city}, renovation ${company.city}, ${company.services.slice(0, 5).join(', ')}, ${metaIsVn ? 'Vietnam' : 'UAE'}, Tarmeer`,
      robots: 'index, follow, max-image-preview:large',
      alternates: {
        canonical: `${baseUrl}/companies/${canonicalSlug}`,
      },
      openGraph: {
        title: `${company.name} - ${company.city} - Tarmeer`,
        description: company.shortDescription,
        url: `${baseUrl}/companies/${canonicalSlug}`,
        type: 'website',
        images: [{ url: ogImage }],
      },
      twitter: {
        card: 'summary_large_image',
        title: `${company.name} - ${company.city} - Tarmeer`,
        description: company.shortDescription,
        images: [ogImage],
      },
    };
  } catch {
    return {
      title: 'Company Profile - Tarmeer',
      description: `Find top interior design and renovation companies in ${metaIsVn ? 'Vietnam' : 'the UAE'} on Tarmeer.`,
      alternates: {
        canonical: `${baseUrl}/companies/${slug}`,
      },
    };
  }
}

export default async function CompanyDetailPage({ params }: Props) {
  const { slug } = await params;
  const headersList = await headers();
  const country = headersList.get('x-country') ?? 'ae';
  const isVn = country === 'vn';
  const baseUrl = getCountry(country).baseUrl;

  let company;
  let fetchError: string | null = null;

  try {
    company = await fetchPublicCompanyDetail(slug);
  } catch (err: unknown) {
    fetchError = err instanceof Error ? err.message : 'Failed to load company';
  }

  if (fetchError || !company) notFound();

  // 国家数据隔离（铁律）：本国站不得渲染他国公司，跨国访问触发真 404
  if (company.country && company.country !== country) notFound();

  // Server-side canonical redirect: if URL uses numeric ID or non-canonical slug,
  // 308 redirect to the real slug. This prevents Google from indexing non-canonical URLs.
  if (company.slug && company.slug !== slug) {
    permanentRedirect(`/companies/${company.slug}`);
  }

  const heroImages = company.projectImages.filter(Boolean).slice(0, 10);
  const description = company.description || '';
  const typeLabel = getCompanyTypeLabel(company.companyType) || 'Interior Design';

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'LocalBusiness',
    '@id': `${baseUrl}/companies/${company.slug || company.id}#business`,
    name: company.name,
    description: description || company.shortDescription,
    address: {
      '@type': 'PostalAddress',
      addressLocality: company.city,
      addressCountry: isVn ? 'VN' : 'AE',
    },
    ...(company.phone ? { telephone: company.phone } : {}),
    url: company.website || `${baseUrl}/companies/${company.slug || company.id}`,
    ...(heroImages[0] ? { image: `https://www.tarmeer.com${heroImages[0]}` } : {}),
    priceRange: '$$',
    areaServed: isVn
      ? [{ '@type': 'Country', name: 'Vietnam' }]
      : [
          { '@type': 'City', name: 'Dubai' },
          { '@type': 'City', name: 'Abu Dhabi' },
          { '@type': 'City', name: 'Sharjah' },
          { '@type': 'City', name: 'Ajman' },
          { '@type': 'City', name: 'Ras Al Khaimah' },
          { '@type': 'City', name: 'Fujairah' },
          { '@type': 'City', name: 'Umm Al Quwain' },
        ],
    knowsAbout:
      company.services.length > 0
        ? company.services
        : ['Interior Design', 'Renovation', 'Fit-out'],
    ...(company.companyType ? { additionalType: typeLabel } : {}),
  };

  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: `${baseUrl}/` },
      {
        '@type': 'ListItem',
        position: 2,
        name: 'Companies',
        item: `${baseUrl}/companies`,
      },
      {
        '@type': 'ListItem',
        position: 3,
        name: company.name,
        item: `${baseUrl}/companies/${company.slug || company.id}`,
      },
    ],
  };

  const faqJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: [
      {
        '@type': 'Question',
        name: `What services does ${company.name} offer in ${company.city}?`,
        acceptedAnswer: {
          '@type': 'Answer',
          text: `${company.name} offers professional interior design and renovation services in ${company.city}${isVn ? '' : ', UAE'}.${
            company.services.length > 0
              ? ` Their specialties include ${company.services.slice(0, 5).join(', ')}.`
              : ' They serve residential and commercial clients.'
          }`,
        },
      },
      {
        '@type': 'Question',
        name: `How can I view ${company.name}'s portfolio?`,
        acceptedAnswer: {
          '@type': 'Answer',
          text: `You can browse ${company.name}'s complete portfolio on their Tarmeer profile, featuring ${
            company.projectCount > 0
              ? company.projectCount + '+ completed projects with professional photos'
              : 'their work and services'
          }.`,
        },
      },
      {
        '@type': 'Question',
        name: `How do I contact ${company.name} for a consultation?`,
        acceptedAnswer: {
          '@type': 'Answer',
          text: `You can request a free consultation with ${company.name} directly through their Tarmeer profile. Fill out the inquiry form and their team will contact you.`,
        },
      },
    ],
  };

  return (
    <>
      {/* Structured data */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdHtml(jsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdHtml(breadcrumbJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdHtml(faqJsonLd) }}
      />

      {/* SEO-visible server HTML for crawlers */}
      <div className="sr-only">
        <h1>{company.name}</h1>
        {description && <p>{description}</p>}
        {company.services.length > 0 && (
          <ul>
            {company.services.map(s => (
              <li key={s}>{s}</li>
            ))}
          </ul>
        )}
        <address>
          {company.city}{isVn ? '' : ', UAE'}
        </address>
      </div>

      {/* Interactive client component */}
      <CompanyDetailClient company={company} slug={slug} isVn={isVn} />
    </>
  );
}
