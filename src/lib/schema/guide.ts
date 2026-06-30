import type { CountryConfig } from '../country';
import type { PublicGuide, BodyBlock } from '../publicApi';

// ─── helpers ─────────────────────────────────────────────────────────────────

function isoDate(value: string | null | undefined): string | undefined {
  if (!value) return undefined;
  try {
    return new Date(value).toISOString();
  } catch {
    return undefined;
  }
}

function absoluteUrl(url: string | null | undefined, baseUrl: string): string | undefined {
  if (!url) return undefined;
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  return `${baseUrl}${url.startsWith('/') ? '' : '/'}${url}`;
}

function findFirstBlock<T extends BodyBlock>(
  blocks: BodyBlock[],
  type: BodyBlock['type']
): T | undefined {
  return blocks.find((b) => b.type === type) as T | undefined;
}

// ─── main builder ────────────────────────────────────────────────────────────

export function buildGuideJsonLd({
  guide,
  url,
  c,
}: {
  guide: PublicGuide;
  url: string;
  c: CountryConfig;
}): object[] {
  const schemas: object[] = [];

  const published = isoDate(guide.published_at);
  const modified = isoDate(guide.updated_at) ?? published;
  const coverImage = absoluteUrl(guide.cover_image, c.baseUrl);
  const logoUrl = `${c.baseUrl}/images/tarmeer_logo.svg`;
  const lang = c.lang === 'vi' ? 'vi' : 'en';

  // 1. Article
  const articleSchema: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: guide.title,
    description: guide.seo_description ?? guide.summary,
    url,
    mainEntityOfPage: { '@type': 'WebPage', '@id': url },
    author: {
      '@type': 'Organization',
      name: 'Tarmeer',
      url: c.baseUrl,
    },
    publisher: {
      '@type': 'Organization',
      name: 'Tarmeer',
      url: c.baseUrl,
      logo: {
        '@type': 'ImageObject',
        url: logoUrl,
      },
    },
    inLanguage: lang,
  };
  if (published) articleSchema.datePublished = published;
  if (modified) articleSchema.dateModified = modified;
  if (coverImage) articleSchema.image = coverImage;
  schemas.push(articleSchema);

  // 2. BreadcrumbList
  schemas.push({
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: `${c.baseUrl}/` },
      { '@type': 'ListItem', position: 2, name: 'Insights', item: `${c.baseUrl}/insights` },
      { '@type': 'ListItem', position: 3, name: guide.title, item: url },
    ],
  });

  // 3. FAQPage — only if a faq block exists
  const faqBlock = findFirstBlock<BodyBlock & { items: Array<{ q: string; a: string }> }>(
    guide.body_blocks,
    'faq'
  );
  if (faqBlock?.items?.length) {
    schemas.push({
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: faqBlock.items.map((item) => ({
        '@type': 'Question',
        name: item.q,
        acceptedAnswer: { '@type': 'Answer', text: item.a },
      })),
    });
  }

  // 4. ItemList — only if a list block exists
  const listBlock = findFirstBlock(guide.body_blocks, 'list');
  if (listBlock?.items?.length) {
    schemas.push({
      '@context': 'https://schema.org',
      '@type': 'ItemList',
      name: listBlock.title ?? guide.title,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      itemListElement: (listBlock.items as any[]).map((item: unknown, i: number) => ({
        '@type': 'ListItem',
        position: i + 1,
        name: String(item ?? ''),
      })),
    });
  }

  // 5. Person — one per expert
  if (Array.isArray(guide.experts)) {
    for (const expert of guide.experts) {
      if (!expert.full_name) continue;
      schemas.push({
        '@context': 'https://schema.org',
        '@type': 'Person',
        name: expert.full_name,
        jobTitle: expert.role_label || 'Interior Design Expert',
        sameAs: [`${c.baseUrl}/experts/${expert.expert_slug}`],
      });
    }
  }

  return schemas;
}
