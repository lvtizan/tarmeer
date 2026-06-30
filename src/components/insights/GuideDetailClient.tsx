'use client';

import Link from 'next/link';
import SmartImage from '@/components/ui/SmartImage';
import type { PublicGuide, BodyBlock, GuideExpert } from '@/lib/publicApi';

// ─── Category label helper ───────────────────────────────────────────────────

const CATEGORY_LABELS: Record<string, string> = {
  cost: 'Cost & Budgeting',
  sourcing: 'Sourcing & Materials',
  trend: 'Design Trends',
  story: 'Project Stories',
};

function categoryLabel(cat: string): string {
  return CATEGORY_LABELS[cat] ?? cat.charAt(0).toUpperCase() + cat.slice(1);
}

// ─── Expert quote card ────────────────────────────────────────────────────────

function ExpertQuoteCard({ expert }: { expert: GuideExpert }) {
  return (
    <div className="bg-white border border-stone-200 rounded-2xl p-5 flex gap-4 items-start my-6">
      <div className="shrink-0">
        {expert.avatar_url ? (
          <SmartImage
            src={expert.avatar_url}
            alt={expert.full_name}
            className="w-14 h-14 rounded-full object-cover border border-stone-200"
            loading="lazy"
            width={56}
            height={56}
          />
        ) : (
          <div className="w-14 h-14 rounded-full bg-stone-100 flex items-center justify-center text-stone-400 text-xl font-bold border border-stone-200">
            {expert.full_name.charAt(0).toUpperCase()}
          </div>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap mb-1">
          <span className="font-semibold text-[#2c2c2c] text-[15px]">{expert.full_name}</span>
          {expert.is_certified && (
            <span className="text-[11px] font-semibold uppercase tracking-wider text-[#b8864a] bg-[#b8864a]/10 rounded-full px-2 py-0.5">
              Certified
            </span>
          )}
        </div>
        <p className="text-[13px] text-[#6b6b6b] mb-2">
          {expert.role_label || 'Interior Design Expert'}
          {expert.experience_years ? ` · ${expert.experience_years} yrs` : ''}
          {expert.city ? ` · ${expert.city}` : ''}
        </p>
        {expert.quote && (
          <blockquote className="italic text-[15px] text-[#2c2c2c] leading-relaxed border-l-2 border-[#b8864a] pl-3 mb-3">
            &ldquo;{expert.quote}&rdquo;
          </blockquote>
        )}
        {expert.expert_slug && (
          <Link
            href={`/experts/${expert.expert_slug}`}
            className="text-[13px] text-[#b8864a] font-medium hover:underline"
          >
            View expert →
          </Link>
        )}
      </div>
    </div>
  );
}

// ─── Block renderers ─────────────────────────────────────────────────────────

function renderBlock(block: BodyBlock, experts: GuideExpert[], index: number): React.ReactNode {
  switch (block.type) {
    case 'heading': {
      const Tag = block.level === 3 ? 'h3' : 'h2';
      const cls =
        block.level === 3
          ? 'text-lg font-bold text-[#2c2c2c] mt-8 mb-3'
          : 'text-xl font-bold text-[#2c2c2c] mt-10 mb-4';
      return (
        <Tag key={index} className={cls}>
          {block.text}
        </Tag>
      );
    }

    case 'paragraph':
      return (
        <p key={index} className="text-[15px] text-[#6b6b6b] leading-relaxed mb-5">
          {block.text}
        </p>
      );

    case 'image': {
      if (!block.url) return null;
      return (
        <figure key={index} className="my-8">
          <div className="aspect-video w-full overflow-hidden rounded-2xl bg-stone-100">
            <SmartImage
              src={block.url}
              alt={block.alt ?? ''}
              className="w-full h-full object-cover"
              loading="lazy"
              width={800}
              height={450}
            />
          </div>
          {block.caption && (
            <figcaption className="text-[13px] text-[#6b6b6b] text-center mt-2">
              {block.caption}
            </figcaption>
          )}
        </figure>
      );
    }

    case 'stat_table': {
      if (!block.columns?.length || !block.rows?.length) return null;
      return (
        <div key={index} className="my-8">
          {block.caption && (
            <p className="text-[14px] text-[#6b6b6b] mb-3">{block.caption}</p>
          )}
          <div className="overflow-x-auto rounded-2xl border border-stone-200">
            <table className="w-full text-[14px] border-collapse">
              <thead>
                <tr className="bg-stone-100">
                  {block.columns.map((col, ci) => (
                    <th
                      key={ci}
                      className={`px-4 py-3 font-semibold text-[#2c2c2c] border-b border-stone-200 ${
                        ci === 0 ? 'text-left' : 'text-right'
                      }`}
                    >
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {block.rows.map((row, ri) => (
                  <tr key={ri} className={ri % 2 === 0 ? 'bg-white' : 'bg-stone-50'}>
                    {row.map((cell, ci) => (
                      <td
                        key={ci}
                        className={`px-4 py-3 text-[#6b6b6b] border-b border-stone-100 ${
                          ci === 0 ? 'text-left text-[#2c2c2c]' : 'text-right'
                        }`}
                      >
                        {cell}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      );
    }

    case 'faq': {
      if (!block.items?.length) return null;
      return (
        <div key={index} className="my-8">
          <div className="space-y-3">
            {block.items.map((faq, fi) => (
              <details
                key={fi}
                className="bg-white border border-stone-200 rounded-2xl overflow-hidden"
              >
                <summary className="cursor-pointer px-5 py-4 font-medium text-[#2c2c2c] text-[15px] select-none hover:bg-stone-50 list-none flex items-center justify-between">
                  {faq.q}
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="text-[#6b6b6b] shrink-0 transition-transform [details[open]_&]:rotate-90"
                    aria-hidden="true"
                  >
                    <polyline points="9 18 15 12 9 6" />
                  </svg>
                </summary>
                <p className="px-5 pb-4 text-[15px] text-[#6b6b6b] leading-relaxed">{faq.a}</p>
              </details>
            ))}
          </div>
        </div>
      );
    }

    case 'list': {
      if (!block.items?.length) return null;
      const Tag = block.ordered ? 'ol' : 'ul';
      return (
        <div key={index} className="my-6">
          {block.title && (
            <p className="font-semibold text-[#2c2c2c] mb-3 text-[15px]">{block.title}</p>
          )}
          <Tag
            className={`space-y-2 ${
              block.ordered
                ? 'list-decimal list-inside pl-1'
                : 'list-none pl-0'
            }`}
          >
            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
            {(block.items as any[]).map((item: unknown, li: number) => (
              <li key={li} className="flex items-start gap-2 text-[15px] text-[#6b6b6b]">
                {!block.ordered && (
                  <span className="mt-1.5 w-2 h-2 rounded-full bg-[#b8864a] shrink-0" />
                )}
                {String(item ?? '')}
              </li>
            ))}
          </Tag>
        </div>
      );
    }

    case 'expert_quote': {
      const expertIndex = block.expertIndex ?? 0;
      const expert = experts[expertIndex];
      if (!expert) return null;
      return <ExpertQuoteCard key={index} expert={expert} />;
    }

    case 'source':
      return (
        <p key={index} className="text-[12px] text-stone-400 mt-4 mb-6">
          <span className="font-medium">Source:</span> {block.text}
        </p>
      );

    default:
      return null;
  }
}

// ─── Main client component ────────────────────────────────────────────────────

export default function GuideDetailClient({ guide }: { guide: PublicGuide }) {
  const experts = guide.experts ?? [];

  return (
    <div className="max-w-3xl mx-auto px-4 py-10">
      {/* Breadcrumb */}
      <nav aria-label="Breadcrumb" className="flex items-center gap-1 text-sm text-[#6b6b6b] mb-6">
        <Link href="/" className="hover:text-[#b8864a]">
          Home
        </Link>
        <span className="mx-1">›</span>
        <Link href="/insights" className="hover:text-[#b8864a]">
          Insights
        </Link>
        <span className="mx-1">›</span>
        <span className="text-[#2c2c2c] line-clamp-1">{guide.title}</span>
      </nav>

      {/* Cover image */}
      {guide.cover_image && (
        <div className="aspect-video w-full overflow-hidden rounded-2xl bg-stone-100 mb-8">
          <SmartImage
            src={guide.cover_image}
            alt={guide.title}
            className="w-full h-full object-cover"
            loading="eager"
            fetchPriority="high"
            width={800}
            height={450}
          />
        </div>
      )}

      {/* Category badge */}
      <span className="inline-block text-xs font-semibold uppercase tracking-wider text-[#b8864a] bg-[#b8864a]/10 rounded-full px-3 py-0.5 mb-4">
        {categoryLabel(guide.category)}
      </span>

      {/* Title */}
      <h1 className="text-3xl font-bold text-[#2c2c2c] mb-5 leading-tight">{guide.title}</h1>

      {/* Answer-first summary lead */}
      <p className="text-[16px] text-[#6b6b6b] leading-relaxed mb-8 border-l-4 border-[#b8864a] pl-4">
        {guide.summary}
      </p>

      {/* Body blocks */}
      <div>
        {(guide.body_blocks ?? []).map((block, i) => renderBlock(block, experts, i))}
      </div>
    </div>
  );
}
