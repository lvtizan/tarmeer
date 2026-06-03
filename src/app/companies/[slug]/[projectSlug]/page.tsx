export const dynamic = 'force-dynamic';

import type { Metadata } from 'next';
import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import ProjectDetailClient from '@/components/companies/ProjectDetailClient';
import { fetchPublicProjectDetail } from '@/lib/publicApi';

const API_BASE = process.env.NEXT_PUBLIC_API_URL?.trim() ?? process.env.API_INTERNAL_URL?.trim() ?? '/api';

interface PageProps {
  params: Promise<{ companySlug: string; projectSlug: string }>;
}

export async function generateStaticParams(): Promise<Array<{ companySlug: string; projectSlug: string }>> {
  try {
    const res = await fetch(`${API_BASE}/companies?limit=500`, { next: { revalidate: 3600 } });
    if (!res.ok) return [];
    const data = await res.json() as { companies?: Array<{ slug?: string; id?: number }> };
    const companies = data.companies ?? [];

    const results: Array<{ companySlug: string; projectSlug: string }> = [];

    await Promise.allSettled(
      companies.filter((c) => c.slug || c.id).slice(0, 100).map(async (c) => {
        try {
          const slug = c.slug ?? String(c.id);
          const pRes = await fetch(`${API_BASE}/companies/${slug}/projects?limit=50`, { next: { revalidate: 3600 } });
          if (!pRes.ok) return;
          const pData = await pRes.json() as { projects?: Array<{ slug?: string }> };
          for (const p of (pData.projects ?? [])) {
            if (p.slug) results.push({ companySlug: slug, projectSlug: p.slug });
          }
        } catch { /* skip */ }
      })
    );

    return results;
  } catch {
    return [];
  }
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { companySlug, projectSlug } = await params;
  try {
    const data = await fetchPublicProjectDetail(companySlug, projectSlug);
    const { project, company } = data;

    const tagPool: string[] = [];
    if (project.style) tagPool.push(project.style);
    for (const t of (project.tags || [])) {
      if (!tagPool.some((x) => x.toLowerCase() === t.toLowerCase())) tagPool.push(t);
      if (tagPool.length >= 3) break;
    }
    const tagLabel = tagPool.join(' ') || 'Interior Design';
    const locationLabel = project.location || company.city || 'UAE';
    const canonicalUrl = `https://www.tarmeer.com/companies/${companySlug}/${projectSlug}`;

    const title = `${project.title} - ${tagLabel} Design in ${locationLabel} by ${company.name} | Tarmeer`;
    const desc = [
      `${project.title}${project.year ? ` (${project.year})` : ''} — a ${tagLabel.toLowerCase()} project by ${company.name} in ${locationLabel}, UAE.`,
      project.description ? project.description.slice(0, 160) : `Browse ${project.images.length} high-quality photos.`,
    ].join(' ').slice(0, 320);

    const ogImage = project.images[0]
      ? `https://www.tarmeer.com${project.images[0]}`
      : 'https://www.tarmeer.com/images/tarmeer_logo.svg';

    return {
      title,
      description: desc,
      keywords: [...new Set([
        project.title, ...tagPool, project.location, company.city, company.name,
        'interior design', 'renovation', 'UAE', 'Dubai', 'Tarmeer', ...(project.tags || []),
      ].filter(Boolean).map((k) => k!.toLowerCase()))].join(', '),
      openGraph: {
        title,
        description: desc,
        images: [{ url: ogImage, width: 1200, height: 630 }],
        type: 'article',
        url: canonicalUrl,
      },
      twitter: {
        card: 'summary_large_image',
        title,
        description: desc,
        images: [ogImage],
      },
      alternates: { canonical: canonicalUrl },
      robots: 'index, follow, max-image-preview:large',
    };
  } catch {
    return {
      title: 'Project | Tarmeer',
    };
  }
}

export default async function ProjectDetailPage({ params }: PageProps) {
  const { companySlug, projectSlug } = await params;

  let initialData: Awaited<ReturnType<typeof fetchPublicProjectDetail>> | null = null;
  try {
    initialData = await fetchPublicProjectDetail(companySlug, projectSlug);
  } catch {
    notFound();
  }

  if (!initialData) notFound();

  const { project, company } = initialData;
  const canonicalUrl = `https://www.tarmeer.com/companies/${companySlug}/${projectSlug}`;

  const tagPool: string[] = [];
  if (project.style) tagPool.push(project.style);
  for (const t of (project.tags || [])) {
    if (!tagPool.some((x) => x.toLowerCase() === t.toLowerCase())) tagPool.push(t);
    if (tagPool.length >= 3) break;
  }
  const locationLabel = project.location || company.city || 'UAE';

  const galleryJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'ImageGallery',
    name: project.title,
    url: canonicalUrl,
    author: {
      '@type': 'Organization',
      name: company.name,
      url: `https://www.tarmeer.com/companies/${company.slug || company.id}`,
    },
    locationCreated: {
      '@type': 'Place',
      name: locationLabel,
      address: { '@type': 'PostalAddress', addressCountry: 'AE', addressLocality: locationLabel },
    },
    genre: project.style,
    keywords: (project.tags || []).join(', '),
    dateCreated: project.year ? `${project.year}` : undefined,
    numberOfItems: project.images.length,
    image: project.images.slice(0, 20).map((img, i) => ({
      '@type': 'ImageObject',
      contentUrl: `https://www.tarmeer.com${img}`,
      name: `${project.title} — photo ${i + 1}`,
      representativeOfPage: i === 0,
    })),
  };

  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://www.tarmeer.com/' },
      { '@type': 'ListItem', position: 2, name: 'Portfolio', item: 'https://www.tarmeer.com/portfolio' },
      { '@type': 'ListItem', position: 3, name: company.name, item: `https://www.tarmeer.com/companies/${company.slug || company.id}` },
      { '@type': 'ListItem', position: 4, name: project.title, item: canonicalUrl },
    ],
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(galleryJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />
      <Suspense fallback={
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#faf9f7]">
          <div className="w-8 h-8 rounded-full border-2 border-[#b8864a]/20 border-t-[#b8864a] animate-spin" />
        </div>
      }>
        <ProjectDetailClient companySlug={companySlug} projectSlug={projectSlug} initialData={initialData} />
      </Suspense>
    </>
  );
}
