export const dynamic = 'force-dynamic';

import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { headers } from 'next/headers';
import BlogDetailClient from '@/components/blog/BlogDetailClient';
import { getCountry } from '@/lib/country';

const API_BASE = process.env.NEXT_PUBLIC_API_URL?.trim() ?? process.env.API_INTERNAL_URL?.trim() ?? '/api';

export async function generateStaticParams(): Promise<Array<{ slug: string }>> {
  try {
    const res = await fetch(`${API_BASE}/articles/public?page=1&limit=200`, { next: { revalidate: 3600 } });
    if (!res.ok) return [];
    const data = await res.json() as { articles?: Array<{ slug: string }> };
    return (data.articles ?? []).filter((a) => a.slug).map((a) => ({ slug: a.slug }));
  } catch {
    return [];
  }
}

export interface PublicArticle {
  id: number;
  title: string;
  slug: string;
  content: string;
  content_html?: string;
  excerpt: string;
  cover_image: string | null;
  tags: string | string[] | null;
  seo_title: string | null;
  seo_description: string | null;
  company_name: string | null;
  company_slug: string | null;
  created_at: string;
  word_count?: number;
  reading_time?: number;
}

async function fetchArticle(slug: string): Promise<PublicArticle | null> {
  const API_BASE = process.env.NEXT_PUBLIC_API_URL?.trim() || '/api';
  try {
    const res = await fetch(`${API_BASE}/articles/public/${slug}`, {
      next: { revalidate: 3600 },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { article?: PublicArticle };
    return data.article ?? null;
  } catch {
    return null;
  }
}

function parseTags(tags: string | string[] | null): string[] {
  if (!tags) return [];
  if (Array.isArray(tags)) return tags;
  try {
    const p = JSON.parse(tags);
    return Array.isArray(p) ? p : [];
  } catch {
    return [];
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const c = getCountry((await headers()).get('x-country'));
  const article = await fetchArticle(slug);

  if (!article) {
    return {
      title: 'Article Not Found | Tarmeer Blog',
      description: 'The article you are looking for could not be found on the Tarmeer blog.',
      alternates: { canonical: `${c.baseUrl}/blog` },
    };
  }

  const pageTitle =
    article.seo_title || `${article.title} - Interior Design Tips | Tarmeer`;
  const pageDescription =
    article.seo_description ||
    article.excerpt ||
    `Read ${article.title} on the Tarmeer blog. Expert interior design and renovation insights for ${c.name} homeowners.`;
  const canonicalUrl = `${c.baseUrl}/blog/${article.slug}`;
  const coverImage =
    article.cover_image || `${c.baseUrl}/images/tarmeer_logo.svg`;
  const isoDate = new Date(article.created_at).toISOString();
  const tags = parseTags(article.tags);

  return {
    title: pageTitle,
    description: pageDescription,
    openGraph: {
      title: pageTitle,
      description: pageDescription,
      images: [{ url: coverImage, width: 1200, height: 630 }],
      type: 'article',
      url: canonicalUrl,
      publishedTime: isoDate,
      modifiedTime: isoDate,
    },
    twitter: {
      card: 'summary_large_image',
      title: pageTitle,
      description: pageDescription,
      images: [coverImage],
    },
    keywords: `interior design ${c.name}, renovation tips, ${tags.join(', ')}, Tarmeer blog`,
    alternates: { canonical: canonicalUrl },
    robots: 'index, follow, max-image-preview:large, max-snippet:-1',
  };
}

export default async function BlogDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const c = getCountry((await headers()).get('x-country'));
  const article = await fetchArticle(slug);

  if (!article) {
    notFound();
  }

  const pageTitle =
    article.seo_title || `${article.title} - Interior Design Tips | Tarmeer`;
  const pageDescription =
    article.seo_description ||
    article.excerpt ||
    `Read ${article.title} on the Tarmeer blog. Expert interior design and renovation insights for ${c.name} homeowners.`;
  const canonicalUrl = `${c.baseUrl}/blog/${article.slug}`;
  const coverImage =
    article.cover_image || `${c.baseUrl}/images/tarmeer_logo.svg`;
  const isoDate = new Date(article.created_at).toISOString();
  const tags = parseTags(article.tags);
  const wordCount =
    article.word_count || article.content?.split(/\s+/).filter(Boolean).length || 0;

  const articleJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: article.title,
    description: pageDescription,
    url: canonicalUrl,
    datePublished: isoDate,
    dateModified: isoDate,
    image: coverImage,
    author: {
      '@type': 'Organization',
      name: article.company_name || 'Tarmeer',
      url: article.company_slug
        ? `${c.baseUrl}/companies/${article.company_slug}`
        : c.baseUrl,
    },
    publisher: {
      '@type': 'Organization',
      name: 'Tarmeer',
      url: c.baseUrl,
      logo: {
        '@type': 'ImageObject',
        url: `${c.baseUrl}/images/tarmeer_logo.svg`,
      },
    },
    mainEntityOfPage: { '@type': 'WebPage', '@id': canonicalUrl },
    ...(tags.length > 0 ? { keywords: tags.join(', ') } : {}),
    wordCount,
    inLanguage: 'en',
  };

  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: `${c.baseUrl}/` },
      { '@type': 'ListItem', position: 2, name: 'Blog', item: `${c.baseUrl}/blog` },
      { '@type': 'ListItem', position: 3, name: article.title, item: canonicalUrl },
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      <BlogDetailClient article={article} />
    </>
  );
}
