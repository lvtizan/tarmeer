import { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet-async';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Calendar, Building2 } from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_URL?.trim() || '/api';

interface Article {
  id: number;
  title: string;
  slug: string;
  content: string;
  excerpt: string;
  cover_image: string | null;
  tags: string | null;
  seo_title: string | null;
  seo_description: string | null;
  company_name: string | null;
  company_slug: string | null;
  created_at: string;
}

export default function BlogDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const [article, setArticle] = useState<Article | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!slug) return;
    setLoading(true);
    fetch(`${API_BASE}/articles/public/${slug}`)
      .then((res) => {
        if (!res.ok) throw new Error('Not found');
        return res.json();
      })
      .then((data) => {
        setArticle(data.article || null);
        if (!data.article) setNotFound(true);
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [slug]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--color-tarmeer-bg)] flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-[var(--color-tarmeer-primary)]/20 border-t-[var(--color-tarmeer-primary)] animate-spin" />
      </div>
    );
  }

  if (notFound || !article) {
    return (
      <>
        <Helmet>
          <title>Article Not Found | Tarmeer Blog</title>
          <meta name="description" content="The article you are looking for could not be found on the Tarmeer blog." />
          <meta property="og:title" content="Article Not Found | Tarmeer Blog" />
          <meta property="og:description" content="The article you are looking for could not be found." />
          <meta property="og:image" content="https://www.tarmeer.com/og-image.png" />
          <link rel="canonical" href="https://www.tarmeer.com/blog" />
        </Helmet>
        <div className="min-h-screen bg-[var(--color-tarmeer-bg)] flex flex-col items-center justify-center gap-4">
          <h1 className="text-xl font-bold font-serif text-[var(--color-tarmeer-text)]">
            Article Not Found
          </h1>
          <p className="text-[15px] text-[var(--color-tarmeer-muted)]">
            This article may have been removed or the link is incorrect.
          </p>
          <Link
            to="/blog"
            className="btn-primary mt-2"
          >
            Back to Blog
          </Link>
        </div>
      </>
    );
  }

  const pageTitle = article.seo_title || `${article.title} | Tarmeer Blog`;
  const pageDescription = article.seo_description || article.excerpt || '';
  const canonicalUrl = `https://www.tarmeer.com/blog/${article.slug}`;
  const formattedDate = new Date(article.created_at).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
  const isoDate = new Date(article.created_at).toISOString();

  const articleJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: article.title,
    description: pageDescription,
    url: canonicalUrl,
    datePublished: isoDate,
    dateModified: isoDate,
    ...(article.cover_image ? { image: article.cover_image } : {}),
    author: article.company_name
      ? { '@type': 'Organization', name: article.company_name }
      : { '@type': 'Organization', name: 'Tarmeer' },
    publisher: {
      '@type': 'Organization',
      name: 'Tarmeer',
      url: 'https://www.tarmeer.com',
    },
  };

  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://www.tarmeer.com/' },
      { '@type': 'ListItem', position: 2, name: 'Blog', item: 'https://www.tarmeer.com/blog' },
      { '@type': 'ListItem', position: 3, name: article.title, item: canonicalUrl },
    ],
  };

  return (
    <>
      <Helmet>
        <title>{pageTitle}</title>
        <meta name="description" content={pageDescription} />
        <meta property="og:title" content={pageTitle} />
        <meta property="og:description" content={pageDescription} />
        <meta property="og:image" content={article.cover_image || 'https://www.tarmeer.com/og-image.png'} />
        <meta property="og:type" content="article" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="keywords" content={`interior design, Tarmeer blog${article.tags ? ', ' + article.tags : ''}`} />
        <link rel="canonical" href={canonicalUrl} />
        <script type="application/ld+json">{JSON.stringify(articleJsonLd)}</script>
        <script type="application/ld+json">{JSON.stringify(breadcrumbJsonLd)}</script>
      </Helmet>

      <div className="min-h-screen bg-[var(--color-tarmeer-bg)]">
        <div className="max-w-3xl mx-auto px-4 py-12">
          <Link
            to="/blog"
            className="inline-flex items-center gap-1.5 text-sm text-[var(--color-tarmeer-muted)] hover:text-[var(--color-tarmeer-primary)] transition-colors mb-8"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Blog
          </Link>

          {article.cover_image && (
            <img
              src={article.cover_image}
              alt={article.title}
              className="w-full h-auto max-h-[400px] object-cover rounded-2xl mb-8"
            />
          )}

          <h1 className="text-3xl font-bold font-serif text-[var(--color-tarmeer-text)] mb-4">
            {article.title}
          </h1>

          <div className="flex items-center gap-4 text-sm text-[var(--color-tarmeer-muted)] mb-8">
            {article.company_name && (
              <span className="flex items-center gap-1.5">
                <Building2 className="w-4 h-4" />
                {article.company_slug ? (
                  <Link
                    to={`/companies/${article.company_slug}`}
                    className="hover:text-[var(--color-tarmeer-primary)] transition-colors"
                  >
                    {article.company_name}
                  </Link>
                ) : (
                  article.company_name
                )}
              </span>
            )}
            <span className="flex items-center gap-1.5">
              <Calendar className="w-4 h-4" />
              {formattedDate}
            </span>
          </div>

          {article.tags && (
            <div className="flex flex-wrap gap-2 mb-8">
              {article.tags.split(',').map((tag) => (
                <span
                  key={tag.trim()}
                  className="px-3 py-1 text-xs rounded-2xl border border-stone-200 text-stone-600"
                >
                  {tag.trim()}
                </span>
              ))}
            </div>
          )}

          <div
            className="prose-tarmeer text-[15px] text-[var(--color-tarmeer-text)] leading-relaxed whitespace-pre-wrap"
          >
            {article.content}
          </div>
        </div>
      </div>
    </>
  );
}
