import type { Metadata } from 'next';
import { Suspense } from 'react';
import PortfolioClient from '@/components/portfolio/PortfolioClient';
import { fetchPortfolioFeed, type PortfolioProject } from '@/lib/publicApi';

export const metadata: Metadata = {
  title: 'Interior Design Portfolio — Browse UAE Projects | Tarmeer',
  description:
    'Explore thousands of interior design, renovation, and fit-out project photos from top UAE companies. Filter by style, space type, and service.',
  openGraph: {
    title: 'Interior Design Portfolio | Tarmeer',
    description: 'Browse the best interior design projects across the UAE.',
    url: 'https://www.tarmeer.com/portfolio',
    images: [{ url: 'https://www.tarmeer.com/images/hero/hero-living-1.jpg', width: 1200, height: 630 }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Interior Design Portfolio | Tarmeer',
    description: 'Browse UAE interior design projects.',
  },
  alternates: { canonical: 'https://www.tarmeer.com/portfolio' },
};

async function fetchInitialProjects(): Promise<PortfolioProject[]> {
  try {
    const result = await fetchPortfolioFeed(1, 24, undefined, undefined);
    return result.projects;
  } catch {
    return [];
  }
}

export default async function PortfolioPage() {
  const projects = await fetchInitialProjects();

  const itemListJsonLd = projects.length > 0
    ? {
        '@context': 'https://schema.org',
        '@type': 'ItemList',
        name: 'UAE Interior Design Portfolio',
        description: 'Featured interior design and renovation projects from top UAE companies.',
        numberOfItems: projects.length,
        itemListElement: projects.slice(0, 20).map((p, i) => ({
          '@type': 'ListItem',
          position: i + 1,
          item: {
            '@type': 'CreativeWork',
            name: p.title,
            url: `https://www.tarmeer.com/companies/${p.companySlug || p.companyId}/${p.slug}`,
            ...(p.images?.[0] ? { image: `https://www.tarmeer.com${p.images[0]}` } : {}),
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
          <h1>Interior Design Portfolio — UAE Projects</h1>
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
