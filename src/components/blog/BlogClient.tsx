'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Calendar, Building2 } from 'lucide-react';
import { useSiteLocale } from '@/contexts/SiteLocaleContext';
import { countryFromLang } from '@/lib/country';

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

interface BlogClientProps {
  initialArticles: Article[];
  initialPagination: Pagination | null;
}

export default function BlogClient({ initialArticles, initialPagination }: BlogClientProps) {
  const c = countryFromLang(useSiteLocale().lang);
  const [articles, setArticles] = useState<Article[]>(initialArticles);
  const [pagination, setPagination] = useState<Pagination | null>(initialPagination);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (page === 1) return;
    setLoading(true);
    fetch(`${API_BASE}/articles/public?page=${page}&limit=12&country=${c.code}`, {
      headers: { 'x-country': c.code },
    })
      .then((res) => res.json())
      .then((data: { articles?: Article[]; pagination?: Pagination }) => {
        setArticles(data.articles ?? []);
        setPagination(data.pagination ?? null);
      })
      .catch(() => setArticles([]))
      .finally(() => setLoading(false));
  }, [page, c.code]);

  return (
    <div className="min-h-screen bg-[var(--color-tarmeer-bg)]">
      <div className="max-w-6xl mx-auto px-4 py-12">
        <h1 className="text-xl font-bold font-serif text-[var(--color-tarmeer-text)] mb-2">
          Blog
        </h1>
        <p className="text-[15px] text-[var(--color-tarmeer-muted)] mb-10">
          Interior design insights and inspiration from top {c.name} companies
        </p>

        {loading ? (
          <div className="flex justify-center py-20">
            <div className="w-8 h-8 rounded-full border-2 border-[var(--color-tarmeer-primary)]/20 border-t-[var(--color-tarmeer-primary)] animate-spin" />
          </div>
        ) : articles.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-[15px] text-[var(--color-tarmeer-muted)]">
              No articles published yet. Check back soon!
            </p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {articles.map((article) => (
                <Link
                  key={article.id}
                  href={`/blog/${article.slug}`}
                  className="bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden hover:shadow-md transition-shadow group"
                >
                  {article.cover_image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={article.cover_image}
                      alt={article.title}
                      className="w-full h-48 object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <div className="w-full h-48 bg-gradient-to-br from-[#b8864a]/20 to-[#b8864a]/5 flex items-center justify-center">
                      <span className="text-[var(--color-tarmeer-primary)] text-3xl font-serif">
                        T
                      </span>
                    </div>
                  )}
                  <div className="p-5">
                    <h2 className="text-[15px] font-semibold font-serif text-[var(--color-tarmeer-text)] group-hover:text-[var(--color-tarmeer-primary)] transition-colors line-clamp-2 mb-2">
                      {article.title}
                    </h2>
                    {article.excerpt && (
                      <p className="text-sm text-[var(--color-tarmeer-muted)] line-clamp-3 mb-3">
                        {article.excerpt}
                      </p>
                    )}
                    <div className="flex items-center gap-4 text-xs text-[var(--color-tarmeer-muted)]">
                      {article.company_name && (
                        <span className="flex items-center gap-1">
                          <Building2 className="w-3 h-3" />
                          {article.company_name}
                        </span>
                      )}
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {new Date(article.created_at).toLocaleDateString('en-US', {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                        })}
                      </span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>

            {pagination && pagination.totalPages > 1 && (
              <div className="flex justify-center items-center gap-2 mt-10">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="px-4 py-2 rounded-2xl border border-stone-200 text-sm text-[var(--color-tarmeer-text)] disabled:opacity-40 disabled:cursor-not-allowed hover:border-[var(--color-tarmeer-primary)] transition-colors"
                >
                  Previous
                </button>
                <span className="text-sm text-[var(--color-tarmeer-muted)] px-3">
                  Page {page} of {pagination.totalPages}
                </span>
                <button
                  onClick={() => setPage((p) => Math.min(pagination!.totalPages, p + 1))}
                  disabled={page >= pagination.totalPages}
                  className="px-4 py-2 rounded-2xl border border-stone-200 text-sm text-[var(--color-tarmeer-text)] disabled:opacity-40 disabled:cursor-not-allowed hover:border-[var(--color-tarmeer-primary)] transition-colors"
                >
                  Next
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
