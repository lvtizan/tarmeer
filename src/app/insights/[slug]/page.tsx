export const dynamic = 'force-dynamic';

import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { headers } from 'next/headers';
import { getCountry } from '@/lib/country';
import { fetchGuide } from '@/lib/publicApi';
import { buildGuideJsonLd } from '@/lib/schema/guide';
import GuideDetailClient from '@/components/insights/GuideDetailClient';

// ─── Metadata ────────────────────────────────────────────────────────────────

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const c = getCountry((await headers()).get('x-country'));
  const data = await fetchGuide(slug, c.code);

  if (!data?.guide) {
    return {
      title: 'Guide Not Found | Tarmeer',
      description: 'The guide you are looking for could not be found.',
      alternates: { canonical: `${c.baseUrl}/insights` },
    };
  }

  const guide = data.guide;
  const pageTitle = guide.seo_title ?? `${guide.title} | Tarmeer`;
  const pageDescription = guide.seo_description ?? guide.summary;
  const canonicalUrl = `${c.baseUrl}/insights/${slug}`;
  const coverImage = guide.cover_image ?? `${c.baseUrl}/images/tarmeer_logo.svg`;

  return {
    title: pageTitle,
    description: pageDescription,
    openGraph: {
      title: pageTitle,
      description: pageDescription,
      images: [{ url: coverImage, width: 1200, height: 630 }],
      type: 'article',
      url: canonicalUrl,
      ...(guide.published_at
        ? { publishedTime: new Date(guide.published_at).toISOString() }
        : {}),
      ...(guide.updated_at
        ? { modifiedTime: new Date(guide.updated_at).toISOString() }
        : {}),
    },
    twitter: {
      card: 'summary_large_image',
      title: pageTitle,
      description: pageDescription,
      images: [coverImage],
    },
    alternates: { canonical: canonicalUrl },
    robots: 'index, follow, max-image-preview:large, max-snippet:-1',
  };
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function InsightDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const c = getCountry((await headers()).get('x-country'));
  const data = await fetchGuide(slug, c.code);

  if (!data?.guide) notFound();

  const guide = data.guide;

  // Country isolation: if guide has an explicit country and it doesn't match, 404
  if (guide.country && guide.country !== c.code) notFound();

  const canonicalUrl = `${c.baseUrl}/insights/${slug}`;
  const jsonLdSchemas = buildGuideJsonLd({ guide, url: canonicalUrl, c });

  return (
    <>
      {jsonLdSchemas.map((schema, i) => (
        <script
          key={i}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
        />
      ))}
      <GuideDetailClient guide={guide} />
    </>
  );
}
