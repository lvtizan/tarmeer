const API_BASE = import.meta.env.VITE_API_URL?.trim() || '/api';

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

type ArticleResponse = { article: PublicArticle | null };

const articleCache = new Map<string, Promise<PublicArticle | null>>();

function requestArticle(slug: string, signal?: AbortSignal): Promise<PublicArticle | null> {
  return fetch(`${API_BASE}/articles/public/${slug}`, { signal })
    .then((res) => {
      if (!res.ok) {
        throw new Error('Not found');
      }
      return res.json() as Promise<ArticleResponse>;
    })
    .then((data) => data.article || null);
}

export function fetchPublicArticle(slug: string, signal?: AbortSignal): Promise<PublicArticle | null> {
  if (signal) {
    return requestArticle(slug, signal);
  }

  const cached = articleCache.get(slug);
  if (cached) {
    return cached;
  }

  const request = requestArticle(slug).catch((error) => {
    articleCache.delete(slug);
    throw error;
  });
  articleCache.set(slug, request);
  return request;
}

export function prefetchPublicArticle(slug: string) {
  void fetchPublicArticle(slug);
}

export function warmBlogDetailPage() {
  void import('../pages/BlogDetailPage');
}
