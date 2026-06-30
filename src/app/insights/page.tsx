export const dynamic = 'force-dynamic';

import type { Metadata } from 'next';
import { headers } from 'next/headers';
import Link from 'next/link';
import SmartImage from '@/components/ui/SmartImage';
import { getCountry } from '@/lib/country';
import { fetchGuides } from '@/lib/publicApi';
import type { PublicGuide } from '@/lib/publicApi';

// ─── Category labels ──────────────────────────────────────────────────────────

const CATEGORY_LABELS: Record<string, string> = {
  cost: 'Cost & Budgeting',
  sourcing: 'Sourcing & Materials',
  trend: 'Design Trends',
  story: 'Project Stories',
};

function categoryLabel(cat: string): string {
  return CATEGORY_LABELS[cat] ?? cat.charAt(0).toUpperCase() + cat.slice(1);
}

const CATEGORY_ORDER = ['cost', 'sourcing', 'trend', 'story'];

function sortCategories(cats: string[]): string[] {
  return [...cats].sort((a, b) => {
    const ai = CATEGORY_ORDER.indexOf(a);
    const bi = CATEGORY_ORDER.indexOf(b);
    if (ai === -1 && bi === -1) return a.localeCompare(b);
    if (ai === -1) return 1;
    if (bi === -1) return -1;
    return ai - bi;
  });
}

// ─── Metadata ────────────────────────────────────────────────────────────────

export async function generateMetadata(): Promise<Metadata> {
  const c = getCountry((await headers()).get('x-country'));
  const title = `Insights & Guides | Tarmeer`;
  const description = `Expert guides and data-driven insights on interior design, renovation costs, and sourcing in ${c.name} — from the Tarmeer team and verified professionals.`;
  return {
    title,
    description,
    openGraph: {
      title,
      description,
      images: [{ url: `${c.baseUrl}/og-default.jpg` }],
    },
    twitter: { card: 'summary_large_image', title, description },
    keywords: `interior design guides ${c.name}, renovation insights, design trends ${c.name}, Tarmeer guides`,
    alternates: { canonical: `${c.baseUrl}/insights` },
    robots: 'index, follow',
  };
}

// ─── Guide card ───────────────────────────────────────────────────────────────

function GuideCard({ guide }: { guide: PublicGuide }) {
  return (
    <Link
      href={`/insights/${guide.slug}`}
      className="group bg-white rounded-2xl border border-stone-200 overflow-hidden hover:shadow-md transition-shadow flex flex-col"
    >
      <div className="aspect-video w-full overflow-hidden bg-stone-100">
        {guide.cover_image ? (
          <SmartImage
            src={guide.cover_image}
            alt={guide.title}
            className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-300"
            loading="lazy"
            width={600}
            height={338}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <span className="text-stone-300 text-4xl">📖</span>
          </div>
        )}
      </div>
      <div className="p-5 flex flex-col gap-2 flex-1">
        <span className="inline-block text-xs font-semibold uppercase tracking-wider text-[#b8864a] bg-[#b8864a]/10 rounded-full px-3 py-0.5 self-start">
          {categoryLabel(guide.category)}
        </span>
        <h3 className="text-[15px] font-bold text-[#2c2c2c] leading-snug group-hover:text-[#b8864a] transition-colors line-clamp-2">
          {guide.title}
        </h3>
        <p className="text-[14px] text-[#6b6b6b] leading-relaxed line-clamp-3 flex-1">
          {guide.summary}
        </p>
        <span className="text-xs text-[#b8864a] font-medium mt-1">Read guide →</span>
      </div>
    </Link>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function InsightsPage() {
  const c = getCountry((await headers()).get('x-country'));
  const guides = await fetchGuides(c.code);

  // Group by category
  const byCategory = new Map<string, PublicGuide[]>();
  for (const guide of guides) {
    const cat = guide.category || 'other';
    if (!byCategory.has(cat)) byCategory.set(cat, []);
    byCategory.get(cat)!.push(guide);
  }
  const categories = sortCategories([...byCategory.keys()]);

  // ItemList JSON-LD
  const itemListJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: `Insights & Guides | Tarmeer`,
    url: `${c.baseUrl}/insights`,
    itemListElement: guides.map((g, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: g.title,
      url: `${c.baseUrl}/insights/${g.slug}`,
    })),
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListJsonLd) }}
      />

      <div className="max-w-6xl mx-auto px-4 py-12">
        {/* Header */}
        <div className="mb-10">
          <h1 className="text-3xl md:text-4xl font-bold text-[#2c2c2c] mb-3 leading-tight">
            Insights &amp; Guides
          </h1>
          <p className="text-[16px] text-[#6b6b6b] max-w-2xl leading-relaxed">
            Data-driven guides, cost breakdowns, and expert perspectives on interior design and
            renovation in {c.name} — curated by the Tarmeer team.
          </p>
        </div>

        {/* Empty state */}
        {guides.length === 0 && (
          <div className="text-center py-24 text-[#6b6b6b]">
            <p className="text-lg font-medium mb-2">No guides published yet</p>
            <p className="text-sm">Check back soon — new guides are being added regularly.</p>
          </div>
        )}

        {/* Sections by category */}
        {categories.map((cat) => {
          const catGuides = byCategory.get(cat) ?? [];
          if (!catGuides.length) return null;
          return (
            <section key={cat} className="mb-14">
              <h2 className="text-xl font-bold text-[#2c2c2c] mb-6 flex items-center gap-3">
                <span className="w-1 h-6 bg-[#b8864a] rounded-full inline-block" />
                {categoryLabel(cat)}
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {catGuides.map((guide) => (
                  <GuideCard key={guide.id} guide={guide} />
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </>
  );
}
