import { useEffect, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Calendar, Building2 } from 'lucide-react';
import { fetchPublicArticle, type PublicArticle } from '../lib/blogArticleClient';

function parseTags(tags: string | string[] | null): string[] {
  if (!tags) return [];
  if (Array.isArray(tags)) return tags;
  try { const p = JSON.parse(tags); return Array.isArray(p) ? p : []; } catch { return []; }
}

function stripLeadingDuplicateCoverImage(content: string, coverImage: string | null | undefined): string {
  if (!coverImage) return content;

  const coverId = coverImage.match(/photo-[a-zA-Z0-9-]+/)?.[0];
  if (!coverId) return content;

  return content.replace(new RegExp(`!\\[[^\\]]*\\]\\([^)]*${coverId}[^)]*\\)\\n*`), '');
}

function markdownToHtml(content: string, coverImage?: string | null): string {
  const normalized = stripLeadingDuplicateCoverImage(content, coverImage);

  return normalized
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(
      /!\[([^\]]*)\]\(([^)]+)\)/g,
      '<figure><img src="$2" alt="$1" loading="lazy" decoding="async" fetchpriority="low" /><figcaption>$1</figcaption></figure>'
    )
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, '<em>$1</em>')
    .replace(/^---$/gm, '<hr />')
    .split(/\n\n+/)
    .map((block) => {
      const trimmed = block.trim();
      if (!trimmed) return '';
      if (trimmed.startsWith('<h') || trimmed.startsWith('<hr') || trimmed.startsWith('<figure')) {
        return trimmed;
      }
      return `<p>${trimmed.replace(/\n/g, '<br />')}</p>`;
    })
    .filter(Boolean)
    .join('\n');
}

export default function BlogDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const [article, setArticle] = useState<PublicArticle | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!slug) {
      setLoading(false);
      setNotFound(true);
      return;
    }

    const abortController = new AbortController();
    setLoading(true);
    setNotFound(false);

    fetchPublicArticle(slug, abortController.signal)
      .then((nextArticle) => {
        setArticle(nextArticle);
        setNotFound(!nextArticle);
      })
      .catch((error) => {
        if (error.name === 'AbortError') return;
        setArticle(null);
        setNotFound(true);
      })
      .finally(() => setLoading(false));

    return () => abortController.abort();
  }, [slug]);

  if (loading) {
    return (
      <>
        <Helmet>
          <link rel="canonical" href={`https://www.tarmeer.com/blog/${slug}`} />
        </Helmet>
        <div className="min-h-screen bg-[var(--color-tarmeer-bg)] flex items-center justify-center">
          <div className="w-8 h-8 rounded-full border-2 border-[var(--color-tarmeer-primary)]/20 border-t-[var(--color-tarmeer-primary)] animate-spin" />
        </div>
      </>
    );
  }

  if (notFound || !article) {
    return (
      <>
        <Helmet>
          <title>Article Not Found | Tarmeer Blog</title>
          <meta name="description" content="The article you are looking for could not be found on the Tarmeer blog." />
          <link rel="canonical" href="https://www.tarmeer.com/blog" />
          <meta name="robots" content="noindex" />
        </Helmet>
        <div className="min-h-screen bg-[var(--color-tarmeer-bg)] flex flex-col items-center justify-center gap-4">
          <h1 className="text-xl font-bold font-serif text-[var(--color-tarmeer-text)]">Article Not Found</h1>
          <p className="text-[15px] text-[var(--color-tarmeer-muted)]">This article may have been removed or the link is incorrect.</p>
          <Link to="/blog" className="btn-primary mt-2">Back to Blog</Link>
        </div>
      </>
    );
  }

  const tags = parseTags(article.tags);
  const pageTitle = article.seo_title || `${article.title} - Interior Design Tips | Tarmeer`;
  const pageDescription = article.seo_description || article.excerpt || `Read ${article.title} on the Tarmeer blog. Expert interior design and renovation insights for UAE homeowners.`;
  const canonicalUrl = `https://www.tarmeer.com/blog/${article.slug}`;
  const coverImage = article.cover_image || 'https://www.tarmeer.com/images/tarmeer_logo.svg';
  const formattedDate = new Date(article.created_at).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
  const isoDate = new Date(article.created_at).toISOString();
  const wordCount = article.word_count || article.content?.split(/\s+/).filter(Boolean).length || 0;
  const readingTime = article.reading_time || Math.max(1, Math.ceil(wordCount / 200));
  const articleContentHtml = article.content_html || markdownToHtml(article.content || '', article.cover_image);

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
      url: article.company_slug ? `https://www.tarmeer.com/companies/${article.company_slug}` : 'https://www.tarmeer.com',
    },
    publisher: {
      '@type': 'Organization',
      name: 'Tarmeer',
      url: 'https://www.tarmeer.com',
      logo: { '@type': 'ImageObject', url: 'https://www.tarmeer.com/images/tarmeer_logo.svg' },
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
        <meta property="og:image" content={coverImage} />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />
        <meta property="og:type" content="article" />
        <meta property="og:url" content={canonicalUrl} />
        <meta property="og:site_name" content="Tarmeer" />
        <meta property="article:published_time" content={isoDate} />
        <meta property="article:modified_time" content={isoDate} />
        {tags.map((tag) => (
          <meta key={tag} property="article:tag" content={tag} />
        ))}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={pageTitle} />
        <meta name="twitter:description" content={pageDescription} />
        <meta name="twitter:image" content={coverImage} />
        <meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1" />
        <meta name="keywords" content={`interior design UAE, renovation tips, ${tags.join(', ')}, Tarmeer blog`} />
        <link rel="canonical" href={canonicalUrl} />
        <script type="application/ld+json">{JSON.stringify(articleJsonLd)}</script>
        <script type="application/ld+json">{JSON.stringify(breadcrumbJsonLd)}</script>
      </Helmet>

      <article className="min-h-screen bg-white">
        <div className="max-w-[720px] mx-auto px-5 sm:px-6 pt-8 pb-16">
          {/* Back */}
          <Link
            to="/blog"
            className="inline-flex items-center gap-1.5 text-sm text-[#6b6b6b] hover:text-[#b8864a] transition-colors mb-10"
          >
            <ArrowLeft className="w-4 h-4" />
            All Articles
          </Link>

          {/* Tags */}
          {tags.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-4">
              {tags.map((tag) => (
                <span key={tag} className="px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-[#b8864a] bg-[#b8864a]/8 rounded-full">
                  {tag}
                </span>
              ))}
            </div>
          )}

          {/* Title */}
          <h1 className="font-serif text-[32px] sm:text-[40px] lg:text-[46px] font-bold leading-[1.15] tracking-tight text-[#1c1917] mb-5">
            {article.title}
          </h1>

          {/* Meta */}
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-[13px] text-[#6b6b6b] mb-8">
            {article.company_name && (
              <span className="flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5" />
                {article.company_slug ? (
                  <Link to={`/companies/${article.company_slug}`} className="hover:text-[#b8864a] transition-colors">
                    {article.company_name}
                  </Link>
                ) : article.company_name}
              </span>
            )}
            <span className="flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5" />
              {formattedDate}
            </span>
            <span>{readingTime} min read</span>
          </div>

          {/* Cover image — contained, rounded */}
          {article.cover_image && (
            <img
              src={article.cover_image}
              alt={article.title}
              className="w-full h-auto rounded-2xl mb-10 aspect-[16/9] object-cover"
              decoding="async"
            />
          )}

          {/* Divider */}
          <hr className="border-stone-200 mb-10" />

          {/* Article content */}
          <div
            className="article-content"
            dangerouslySetInnerHTML={{ __html: articleContentHtml }}
          />

          {/* Bottom CTA */}
          <div className="mt-16 py-10 px-8 bg-[#faf9f7] rounded-2xl text-center">
            <p className="font-serif text-xl font-bold text-[#1c1917] mb-2">
              Looking for renovation professionals?
            </p>
            <p className="text-[15px] text-[#6b6b6b] mb-5">
              Browse verified interior design companies across the UAE.
            </p>
            <Link to="/companies" className="btn-primary inline-block">
              Find Companies
            </Link>
          </div>
        </div>
      </article>
    </>
  );
}
