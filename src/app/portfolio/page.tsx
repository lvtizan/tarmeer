import type { Metadata } from 'next';
import { Suspense } from 'react';
import { headers } from 'next/headers';
import PortfolioClient from '@/components/portfolio/PortfolioClient';
import { fetchPortfolioFeed, type PortfolioProject } from '@/lib/publicApi';
import { getCountry } from '@/lib/country';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const c = getCountry((await headers()).get('x-country'));
  return {
    title: `Interior Design Portfolio — Browse ${c.name} Projects | Tarmeer`,
    description:
      `Explore thousands of interior design, renovation, and fit-out project photos from top ${c.name} companies. Filter by style, space type, and service.`,
    openGraph: {
      title: 'Interior Design Portfolio | Tarmeer',
      description: `Browse the best interior design projects across ${c.name}.`,
      url: `${c.baseUrl}/portfolio`,
      images: [{ url: `${c.baseUrl}/images/hero/hero-living-1.jpg`, width: 1200, height: 630 }],
    },
    twitter: {
      card: 'summary_large_image',
      title: 'Interior Design Portfolio | Tarmeer',
      description: `Browse ${c.name} interior design projects.`,
    },
    alternates: { canonical: `${c.baseUrl}/portfolio` },
  };
}

async function fetchInitialProjects(country: string): Promise<PortfolioProject[]> {
  try {
    const result = await fetchPortfolioFeed(1, 24, undefined, undefined, country);
    return result.projects;
  } catch {
    return [];
  }
}

export default async function PortfolioPage() {
  const c = getCountry((await headers()).get('x-country'));
  const projects = await fetchInitialProjects(c.code);

  const itemListJsonLd = projects.length > 0
    ? {
        '@context': 'https://schema.org',
        '@type': 'ItemList',
        name: `${c.name} Interior Design Portfolio`,
        description: `Featured interior design and renovation projects from top ${c.name} companies.`,
        numberOfItems: projects.length,
        itemListElement: projects.slice(0, 20).map((p, i) => ({
          '@type': 'ListItem',
          position: i + 1,
          item: {
            '@type': 'CreativeWork',
            name: p.title,
            url: `${c.baseUrl}/companies/${p.companySlug || p.companyId}/${p.slug}`,
            ...(p.images?.[0] ? { image: `${c.baseUrl}${p.images[0]}` } : {}),
            ...(p.companyName ? { author: { '@type': 'Organization', name: p.companyName } } : {}),
            ...(p.companyCity ? { locationCreated: p.companyCity } : {}),
          },
        })),
      }
    : null;

  return (
    <>
      {itemListJsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListJsonLd) }}
        />
      )}
      {projects.length > 0 && (
        <div className="sr-only">
          <h1>Interior Design Portfolio — {c.name} Projects</h1>
          <ul>
            {projects.slice(0, 24).map((p) => (
              <li key={p.id}>
                <a href={`/companies/${p.companySlug || p.companyId}/${p.slug}`}>
                  {p.title}
                  {p.companyName && ` by ${p.companyName}`}
                  {p.companyCity && `, ${p.companyCity}`}
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}
      <Suspense>
        <PortfolioClient />
      </Suspense>
    </>
  );
}
