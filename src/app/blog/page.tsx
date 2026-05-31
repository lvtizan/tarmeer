import type { Metadata } from 'next';
import { Suspense } from 'react';
import BlogClient from '@/components/blog/BlogClient';

const API_BASE = process.env.NEXT_PUBLIC_API_URL?.trim() || '/api';

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
const pageDescription =
  'Explore interior design articles, tips, and insights from top UAE design companies on the Tarmeer blog.';

export const metadata: Metadata = {
  title: pageTitle,
  description: pageDescription,
  openGraph: {
    title: pageTitle,
    description: pageDescription,
    images: [{ url: 'https://www.tarmeer.com/og-image.png' }],
  },
  twitter: {
    card: 'summary_large_image',
  },
  keywords: 'interior design blog, UAE design tips, Tarmeer articles, home decor insights',
  alternates: {
    canonical: 'https://www.tarmeer.com/blog',
  },
};

const collectionPageJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'CollectionPage',
  name: pageTitle,
  description: pageDescription,
  url: 'https://www.tarmeer.com/blog',
  publisher: {
    '@type': 'Organization',
    name: 'Tarmeer',
    url: 'https://www.tarmeer.com',
  },
};

async function fetchFirstPage(): Promise<{ articles: Article[]; pagination: Pagination | null }> {
  try {
    const res = await fetch(`${API_BASE}/articles/public?page=1&limit=12`, {
      next: { revalidate: 3600 },
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
  const { articles, pagination } = await fetchFirstPage();

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
