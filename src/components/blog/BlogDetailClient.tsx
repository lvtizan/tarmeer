'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { ArrowLeft, Calendar, Building2 } from 'lucide-react';
import type { PublicArticle } from '@/app/blog/[slug]/page';

const API_BASE = process.env.NEXT_PUBLIC_API_URL?.trim() || '/api';

interface RelatedCase {
  id: number;
  title: string;
  slug: string | null;
  coverImage: string | null;
  companyName: string | null;
  companySlug: string | null;
}

interface RelatedArticle {
  id: number;
  title: string;
  slug: string;
  excerpt: string | null;
  coverImage: string | null;
  companyName: string | null;
  createdAt: string;
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

function stripLeadingDuplicateCoverImage(
  content: string,
  coverImage: string | null | undefined
): string {
  if (!coverImage) return content;
  const coverId = coverImage.match(/photo-[a-zA-Z0-9-]+/)?.[0];
  if (!coverId) return content;
  return content.replace(
    new RegExp(`!\\[[^\\]]*\\]\\([^)]*${coverId}[^)]*\\)\\n*`),
    ''
  );
}

function stripUnsafeTags(html: string): string {
  return html
    .replace(/<script[\s>][\s\S]*?<\/script>/gi, '')
    .replace(/<iframe[\s>][\s\S]*?<\/iframe>/gi, '')
    .replace(/<object[\s>][\s\S]*?<\/object>/gi, '')
    .replace(/<embed[\s>][\s\S]*?>/gi, '')
    .replace(/<link[\s>][\s\S]*?>/gi, '')
    .replace(/\bon\w+\s*=\s*["'][^"']*["']/gi, '')
    .replace(/\bon\w+\s*=\s*[^\s>]+/gi, '')
    .replace(/javascript\s*:/gi, 'blocked:');
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
      if (
        trimmed.startsWith('<h') ||
        trimmed.startsWith('<hr') ||
        trimmed.startsWith('<figure')
      ) {
        return trimmed;
      }
      return `<p>${trimmed.replace(/\n/g, '<br />')}</p>`;
    })
    .filter(Boolean)
    .join('\n');
}

interface BlogDetailClientProps {
  article: PublicArticle;
}

export default function BlogDetailClient({ article }: BlogDetailClientProps) {
  const [relatedCases, setRelatedCases] = useState<RelatedCase[]>([]);
  const [relatedArticles, setRelatedArticles] = useState<RelatedArticle[]>([]);

  useEffect(() => {
    const slug = article.slug;
    if (!slug) return;

    const fetchRelated = () => {
      fetch(`${API_BASE}/articles/public/${slug}/related`)
        .then((res) => (res.ok ? res.json() : null))
        .then((data: { relatedCases?: RelatedCase[]; relatedArticles?: RelatedArticle[] } | null) => {
          if (!data) return;
          setRelatedCases(data.relatedCases ?? []);
          setRelatedArticles(data.relatedArticles ?? []);
        })
        .catch(() => {});
    };

    const browserWindow = globalThis.window;
    if (browserWindow && 'requestIdleCallback' in browserWindow) {
      const idleId = (
        browserWindow as Window & { requestIdleCallback: (cb: () => void, opts?: { timeout: number }) => number; cancelIdleCallback: (id: number) => void }
      ).requestIdleCallback(fetchRelated, { timeout: 1800 });
      return () => (
        browserWindow as Window & { cancelIdleCallback: (id: number) => void }
      ).cancelIdleCallback(idleId);
    }

    const timeoutId = globalThis.setTimeout(fetchRelated, 600);
    return () => globalThis.clearTimeout(timeoutId);
  }, [article.slug]);

  const tags = parseTags(article.tags);
  const formattedDate = new Date(article.created_at).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
  const wordCount =
    article.word_count || article.content?.split(/\s+/).filter(Boolean).length || 0;
  const readingTime = article.reading_time || Math.max(1, Math.ceil(wordCount / 200));
  const rawHtml =
    article.content_html || markdownToHtml(article.content || '', article.cover_image);
  const articleContentHtml = stripUnsafeTags(rawHtml);

  return (
    <article className="min-h-screen bg-white">
      <div className="max-w-[720px] mx-auto px-5 sm:px-6 pt-8 pb-16">
        {/* Back */}
        <Link
          href="/blog"
          className="inline-flex items-center gap-1.5 text-sm text-[#6b6b6b] hover:text-[#b8864a] transition-colors mb-10"
        >
          <ArrowLeft className="w-4 h-4" />
          All Articles
        </Link>

        {/* Tags */}
        {tags.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-4">
            {tags.map((tag) => (
              <span
                key={tag}
                className="px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-[#b8864a] bg-[#b8864a]/8 rounded-full"
              >
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
                <Link
                  href={`/companies/${article.company_slug}`}
                  className="hover:text-[#b8864a] transition-colors"
                >
                  {article.company_name}
                </Link>
              ) : (
                article.company_name
              )}
            </span>
          )}
          <span className="flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5" />
            {formattedDate}
          </span>
          <span>{readingTime} min read</span>
        </div>

        {/* Cover image */}
        {article.cover_image && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={article.cover_image}
            alt={article.title}
            className="w-full h-auto rounded-2xl mb-10 aspect-[16/9] object-cover"
            decoding="async"
            loading="eager"
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
          <Link href="/companies" className="btn-primary inline-block">
            Find Companies
          </Link>
        </div>

        {/* Related Cases */}
        {relatedCases.length > 0 && (
          <section className="mt-16">
            <h2 className="font-serif text-2xl font-bold text-[#1c1917] mb-6">Related Projects</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              {relatedCases.map((c) => (
                <Link
                  key={c.id}
                  href={
                    c.companySlug && c.slug
                      ? `/companies/${c.companySlug}/${c.slug}`
                      : '/companies'
                  }
                  className="group block rounded-2xl overflow-hidden border border-stone-200 hover:border-[#b8864a]/40 transition-colors"
                >
                  <div className="aspect-video bg-stone-100 overflow-hidden">
                    {c.coverImage ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={c.coverImage}
                        alt={c.title}
                        loading="lazy"
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    ) : (
                      <div className="w-full h-full bg-stone-200 flex items-center justify-center">
                        <Building2 className="w-8 h-8 text-stone-400" />
                      </div>
                    )}
                  </div>
                  <div className="p-4">
                    <p className="text-[15px] font-semibold text-[#1c1917] line-clamp-2 group-hover:text-[#b8864a] transition-colors">
                      {c.title}
                    </p>
                    {c.companyName && (
                      <p className="mt-1 text-[13px] text-[#6b6b6b]">{c.companyName}</p>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* Related Articles */}
        {relatedArticles.length > 0 && (
          <section className="mt-12 pb-4">
            <h2 className="font-serif text-2xl font-bold text-[#1c1917] mb-6">
              Related Articles
            </h2>
            <div className="flex flex-col gap-4">
              {relatedArticles.map((a) => (
                <Link
                  key={a.id}
                  href={`/blog/${a.slug}`}
                  className="group flex gap-4 items-start rounded-2xl border border-stone-200 hover:border-[#b8864a]/40 transition-colors p-4"
                >
                  {a.coverImage && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={a.coverImage}
                      alt={a.title}
                      loading="lazy"
                      className="w-24 h-16 object-cover rounded-xl flex-shrink-0"
                    />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-[15px] font-semibold text-[#1c1917] line-clamp-2 group-hover:text-[#b8864a] transition-colors">
                      {a.title}
                    </p>
                    {a.excerpt && (
                      <p className="mt-1 text-[13px] text-[#6b6b6b] line-clamp-2">{a.excerpt}</p>
                    )}
                    {a.companyName && (
                      <p className="mt-1 text-[12px] text-stone-400">{a.companyName}</p>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}
      </div>
    </article>
  );
}
