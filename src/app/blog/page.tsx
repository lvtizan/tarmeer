import type { Metadata } from 'next';
import { Suspense } from 'react';
import { headers } from 'next/headers';
import BlogClient from '@/components/blog/BlogClient';
import { getCountry } from '@/lib/country';

export const dynamic = 'force-dynamic';

const API_BASE = process.env.NEXT_PUBLIC_API_URL?.trim() || process.env.API_INTERNAL_URL?.trim() || 'http://localhost:3002/api';

interface Article {
  id: number;
  title: string;
  slug: string;
  excerpt: string;
  cover_image: string | null;
  tags: string | null;
  company_name: string | null;
  company_slug: string | null;
  created_at: string;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

interface ArticlesResponse {
  articles?: Article[];
  pagination?: Pagination;
}

const pageTitle = 'Blog - Interior Design Insights | Tarmeer';

export async function generateMetadata(): Promise<Metadata> {
  const c = getCountry((await headers()).get('x-country'));
  const pageDescription = `Explore interior design articles, tips, and insights from top ${c.name} design companies on the Tarmeer blog.`;
  return {
    title: pageTitle,
    description: pageDescription,
    openGraph: {
      title: pageTitle,
      description: pageDescription,
      images: [{ url: `${c.baseUrl}/og-image.png` }],
    },
    twitter: {
      card: 'summary_large_image',
    },
    keywords: `interior design blog, ${c.name} design tips, Tarmeer articles, home decor insights`,
    alternates: {
      canonical: `${c.baseUrl}/blog`,
    },
  };
}

async function fetchFirstPage(country: string): Promise<{ articles: Article[]; pagination: Pagination | null }> {
  try {
    const res = await fetch(`${API_BASE}/articles/public?page=1&limit=12&country=${country}`, {
      next: { revalidate: 3600 },
      headers: { 'x-country': country },
    });
    if (!res.ok) return { articles: [], pagination: null };
    const data = (await res.json()) as ArticlesResponse;
    return {
      articles: data.articles ?? [],
      pagination: data.pagination ?? null,
    };
  } catch {
    return { articles: [], pagination: null };
  }
}

export default async function BlogPage() {
  const c = getCountry((await headers()).get('x-country'));
  const { articles, pagination } = await fetchFirstPage(c.code);

  const collectionPageJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: pageTitle,
    description: `Explore interior design articles, tips, and insights from top ${c.name} design companies on the Tarmeer blog.`,
    url: `${c.baseUrl}/blog`,
    publisher: {
      '@type': 'Organization',
      name: 'Tarmeer',
      url: c.baseUrl,
    },
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(collectionPageJsonLd) }}
      />
      <Suspense
        fallback={
          <div className="min-h-screen bg-[var(--color-tarmeer-bg)] flex items-center justify-center">
            <div className="w-8 h-8 rounded-full border-2 border-[var(--color-tarmeer-primary)]/20 border-t-[var(--color-tarmeer-primary)] animate-spin" />
          </div>
        }
      >
        <BlogClient initialArticles={articles} initialPagination={pagination} />
      </Suspense>
    </>
  );
}
