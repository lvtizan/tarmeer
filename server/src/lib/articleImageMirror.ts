import manifest from '../data/blogImageManifest.json';

type ArticleImageManifest = Record<string, {
  images?: Record<string, string>;
  missing?: string[];
}>;

const articleImageManifest = manifest as ArticleImageManifest;

export function normalizeArticleImageKey(url: string): string {
  const trimmed = url.trim();
  if (!trimmed) return '';

  try {
    const parsed = new URL(trimmed);
    return `${parsed.origin}${parsed.pathname}`;
  } catch {
    return trimmed;
  }
}

export function resolveMirroredArticleImage(
  slug: string,
  imageUrl: string | null | undefined
): string | null {
  if (!imageUrl) return null;
  if (!/^https?:\/\//i.test(imageUrl)) return imageUrl;

  const articleEntry = articleImageManifest[slug];
  if (!articleEntry?.images) return imageUrl;

  const normalizedKey = normalizeArticleImageKey(imageUrl);
  return articleEntry.images[normalizedKey] || imageUrl;
}

export function rewriteMirroredArticleContent(slug: string, html: string): string {
  const articleEntry = articleImageManifest[slug];
  if (!articleEntry || !html) return html;

  const missingKeys = new Set(articleEntry.missing || []);
  const withoutMissingFigures = missingKeys.size === 0
    ? html
    : html.replace(
      /<figure><img[^>]*\ssrc="([^"]+)"[^>]*\/?><figcaption>.*?<\/figcaption><\/figure>/gi,
      (match: string, src: string) => (missingKeys.has(normalizeArticleImageKey(src)) ? '' : match)
    );

  if (!articleEntry.images) return withoutMissingFigures;

  return withoutMissingFigures.replace(/(<img[^>]*\ssrc=")([^"]+)(")/gi, (_match, prefix: string, src: string, suffix: string) => {
    const rewritten = resolveMirroredArticleImage(slug, src);
    return `${prefix}${rewritten || src}${suffix}`;
  });
}
