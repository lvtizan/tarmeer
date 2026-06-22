export const dynamic = 'force-dynamic';

import type { Metadata } from 'next';
import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import { headers } from 'next/headers';
import ProjectDetailClient from '@/components/companies/ProjectDetailClient';
import { fetchPublicProjectDetail } from '@/lib/publicApi';
import { getCountry } from '@/lib/country';

const API_BASE = process.env.NEXT_PUBLIC_API_URL?.trim() ?? process.env.API_INTERNAL_URL?.trim() ?? '/api';

interface PageProps {
  params: Promise<{ slug: string; projectSlug: string }>;
}

export async function generateStaticParams(): Promise<Array<{ slug: string; projectSlug: string }>> {
  try {
    const res = await fetch(`${API_BASE}/companies?limit=500`, { next: { revalidate: 3600 } });
    if (!res.ok) return [];
    const data = await res.json() as { companies?: Array<{ slug?: string; id?: number }> };
    const companies = data.companies ?? [];

    const results: Array<{ slug: string; projectSlug: string }> = [];

    await Promise.allSettled(
      companies.filter((c) => c.slug || c.id).slice(0, 100).map(async (c) => {
        try {
          const companySlug = c.slug ?? String(c.id);
          const pRes = await fetch(`${API_BASE}/companies/${companySlug}/projects?limit=50`, { next: { revalidate: 3600 } });
          if (!pRes.ok) return;
          const pData = await pRes.json() as { projects?: Array<{ slug?: string }> };
          for (const p of (pData.projects ?? [])) {
            if (p.slug) results.push({ slug: companySlug, projectSlug: p.slug });
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
  const { slug: companySlug, projectSlug } = await params;
  const c = getCountry((await headers()).get('x-country'));
  try {
    const data = await fetchPublicProjectDetail(companySlug, projectSlug, c.code);
    const { project, company } = data;

    const tagPool: string[] = [];
    if (project.style) tagPool.push(project.style);
    for (const t of (project.tags || [])) {
      if (!tagPool.some((x) => x.toLowerCase() === t.toLowerCase())) tagPool.push(t);
      if (tagPool.length >= 3) break;
    }
    const tagLabel = tagPool.join(' ') || 'Interior Design';
    const locationLabel = project.location || company.city || c.name;
    const canonicalUrl = `${c.baseUrl}/companies/${companySlug}/${projectSlug}`;

    const title = `${project.title} - ${tagLabel} Design in ${locationLabel} by ${company.name} | Tarmeer`;
    const desc = [
      `${project.title}${project.year ? ` (${project.year})` : ''} — a ${tagLabel.toLowerCase()} project by ${company.name} in ${locationLabel}, ${c.name}.`,
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
        'interior design', 'renovation', c.name, c.defaultCity, 'Tarmeer', ...(project.tags || []),
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
  const { slug: companySlug, projectSlug } = await params;
  const c = getCountry((await headers()).get('x-country'));

  let initialData: Awaited<ReturnType<typeof fetchPublicProjectDetail>> | null = null;
  try {
    initialData = await fetchPublicProjectDetail(companySlug, projectSlug, c.code);
  } catch {
    notFound();
  }

  if (!initialData) notFound();

  const { project, company } = initialData;
  // 国家数据隔离（铁律）：跨国访问项目页触发真 404
  if (company.country && company.country !== c.code) notFound();
  const canonicalUrl = `${c.baseUrl}/companies/${companySlug}/${projectSlug}`;

  const tagPool: string[] = [];
  if (project.style) tagPool.push(project.style);
  for (const t of (project.tags || [])) {
    if (!tagPool.some((x) => x.toLowerCase() === t.toLowerCase())) tagPool.push(t);
    if (tagPool.length >= 3) break;
  }
  const locationLabel = project.location || company.city || c.name;

  const galleryJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'ImageGallery',
    name: project.title,
    url: canonicalUrl,
    author: {
      '@type': 'Organization',
      name: company.name,
      url: `${c.baseUrl}/companies/${company.slug || company.id}`,
    },
    locationCreated: {
      '@type': 'Place',
      name: locationLabel,
      address: { '@type': 'PostalAddress', addressCountry: c.isoCode, addressLocality: locationLabel },
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
      { '@type': 'ListItem', position: 1, name: 'Home', item: `${c.baseUrl}/` },
      { '@type': 'ListItem', position: 2, name: 'Portfolio', item: `${c.baseUrl}/portfolio` },
      { '@type': 'ListItem', position: 3, name: company.name, item: `${c.baseUrl}/companies/${company.slug || company.id}` },
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
