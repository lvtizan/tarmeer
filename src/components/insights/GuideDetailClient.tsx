'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import SmartImage from '@/components/ui/SmartImage';
import type { PublicGuide, BodyBlock, GuideExpert } from '@/lib/publicApi';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const CATEGORY_LABELS: Record<string, string> = {
  cost: 'Cost & Budgeting',
  sourcing: 'Sourcing & Materials',
  trend: 'Design Trends',
  story: 'Project Stories',
  find: 'Finding a Company',
};
function categoryLabel(cat: string): string {
  return CATEGORY_LABELS[cat] ?? cat.charAt(0).toUpperCase() + cat.slice(1);
}

function slugifyHeading(text: string): string {
  return (text || '')
    .toLowerCase()
    .replace(/[^a-z0-9一-龥\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .slice(0, 60);
}

function readingMinutes(blocks: BodyBlock[], summary: string): number {
  let words = (summary || '').split(/\s+/).length;
  for (const b of blocks) {
    if (b.text) words += b.text.split(/\s+/).length;
    if (b.title) words += b.title.split(/\s+/).length;
    if (Array.isArray(b.items)) {
      for (const it of b.items) {
        if (typeof it === 'string') words += it.split(/\s+/).length;
        else if (it && typeof it === 'object') words += JSON.stringify(it).split(/\s+/).length;
      }
    }
    if (Array.isArray(b.rows)) words += b.rows.flat().length;
  }
  return Math.max(1, Math.round(words / 200));
}

function fmtDate(d?: string): string {
  if (!d) return '';
  try {
    return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch {
    return '';
  }
}

// ─── Interactive cost estimator ───────────────────────────────────────────────

function EstimatorBlock({ block }: { block: BodyBlock }) {
  const medians = (block.styleMedians ?? []).filter((m) => m && m.median > 0);
  const currency = block.currency || 'AED';
  const [area, setArea] = useState<number>(block.defaultArea || 150);
  const [style, setStyle] = useState<string>(medians[0]?.style || '');
  const med = medians.find((m) => m.style === style)?.median || medians[0]?.median || 0;
  const valid = area > 0 && med > 0;
  const low = Math.round((area * med * 0.9) / 1000) * 1000;
  const high = Math.round((area * med * 1.1) / 1000) * 1000;

  return (
    <div className="my-8 bg-[#1c1917] text-white rounded-2xl p-6 sm:p-7">
      <p className="text-[11px] font-semibold uppercase tracking-widest text-[#d8b27a] mb-1">Cost estimator</p>
      <h3 className="text-lg font-bold mb-4">Estimate your renovation budget</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <label className="block">
          <span className="text-[13px] text-white/60">Area (m²)</span>
          <input
            type="number"
            min={10}
            value={area}
            onChange={(e) => setArea(Number(e.target.value))}
            className="mt-1 w-full h-11 px-4 rounded-xl bg-white/10 border border-white/15 text-white text-[15px] focus:outline-none focus:border-[#d8b27a]"
          />
        </label>
        <label className="block">
          <span className="text-[13px] text-white/60">Design style</span>
          <select
            value={style}
            onChange={(e) => setStyle(e.target.value)}
            className="mt-1 w-full h-11 px-4 rounded-xl bg-white/10 border border-white/15 text-white text-[15px] focus:outline-none focus:border-[#d8b27a]"
          >
            {medians.map((m) => (
              <option key={m.style} value={m.style} className="text-[#1c1917]">
                {m.style} · ~{currency} {m.median.toLocaleString()}/m²
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="mt-5 pt-5 border-t border-white/10">
        <span className="text-[13px] text-white/60">Estimated budget (fit-out & finishes)</span>
        <p className="text-2xl sm:text-3xl font-bold text-[#d8b27a] mt-1">
          {valid ? `${currency} ${low.toLocaleString()} – ${high.toLocaleString()}` : '—'}
        </p>
        <p className="text-[12px] text-white/40 mt-2">
          Based on the median {currency}/m² for {style || 'this style'} across real Tarmeer projects (±10% range). Excludes loose furniture. Request a quote for an exact figure.
        </p>
      </div>
    </div>
  );
}

// ─── Expert quote card ──────────────────────────────────────────────────────────

function ExpertQuoteCard({ expert }: { expert: GuideExpert }) {
  return (
    <div className="bg-white border border-stone-200 rounded-2xl p-5 flex gap-4 items-start my-6">
      <div className="shrink-0">
        {expert.avatar_url ? (
          <SmartImage src={expert.avatar_url} alt={expert.full_name} className="w-14 h-14 rounded-full object-cover border border-stone-200" loading="lazy" width={56} height={56} />
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
            <span className="text-[11px] font-semibold uppercase tracking-wider text-[#b8864a] bg-[#b8864a]/10 rounded-full px-2 py-0.5">Certified</span>
          )}
        </div>
        <p className="text-[13px] text-[#6b6b6b] mb-2">
          {expert.role_label || 'Interior Design Expert'}
          {expert.experience_years ? ` · ${expert.experience_years} yrs` : ''}
          {expert.city ? ` · ${expert.city}` : ''}
        </p>
        {expert.quote && (
          <blockquote className="italic text-[15px] text-[#2c2c2c] leading-relaxed border-l-2 border-[#b8864a] pl-3 mb-3">&ldquo;{expert.quote}&rdquo;</blockquote>
        )}
        {expert.expert_slug && (
          <Link href={`/experts/${expert.expert_slug}`} className="text-[13px] text-[#b8864a] font-medium hover:underline">View expert →</Link>
        )}
      </div>
    </div>
  );
}

// ─── Block renderer ─────────────────────────────────────────────────────────────

function renderBlock(block: BodyBlock, experts: GuideExpert[], index: number): React.ReactNode {
  switch (block.type) {
    case 'heading': {
      const Tag = block.level === 3 ? 'h3' : 'h2';
      const cls = block.level === 3 ? 'text-lg font-bold text-[#2c2c2c] mt-8 mb-3' : 'text-xl font-bold text-[#2c2c2c] mt-10 mb-4 scroll-mt-24';
      const id = block.level === 3 ? undefined : slugifyHeading(block.text || '');
      return <Tag key={index} id={id} className={cls}>{block.text}</Tag>;
    }
    case 'paragraph':
      return <p key={index} className="text-[15px] text-[#6b6b6b] leading-relaxed mb-5">{block.text}</p>;

    case 'callout': {
      const styles: Record<string, string> = {
        key: 'bg-[#b8864a]/8 border-[#b8864a]/30',
        method: 'bg-stone-50 border-stone-200',
        tip: 'bg-emerald-50/60 border-emerald-200',
        warn: 'bg-amber-50/70 border-amber-200',
      };
      const labels: Record<string, string> = { key: 'Key takeaways', method: 'How we calculated this', tip: 'Tip', warn: 'Watch out' };
      const v = block.variant || 'key';
      return (
        <div key={index} className={`my-7 rounded-2xl border p-5 ${styles[v]}`}>
          <p className="text-[11px] font-bold uppercase tracking-widest text-[#b8864a] mb-2">{block.title || labels[v]}</p>
          {block.text && <p className="text-[14px] text-[#3a3a3a] leading-relaxed">{block.text}</p>}
          {Array.isArray(block.items) && block.items.length > 0 && (
            <ul className="space-y-1.5 mt-1">
              {block.items.map((it, i) => (
                <li key={i} className="flex items-start gap-2 text-[14px] text-[#3a3a3a]">
                  <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-[#b8864a] shrink-0" />
                  {String(it ?? '')}
                </li>
              ))}
            </ul>
          )}
        </div>
      );
    }

    case 'stat_highlight': {
      const items = (block.items ?? []) as { value: string; label: string }[];
      if (!items.length) return null;
      return (
        <div key={index} className="my-8 grid grid-cols-2 sm:grid-cols-3 gap-3">
          {items.map((s, i) => (
            <div key={i} className="bg-white border border-stone-200 rounded-2xl p-4 text-center">
              <p className="text-2xl font-bold text-[#b8864a]">{s.value}</p>
              <p className="text-[12px] text-[#6b6b6b] mt-1 leading-snug">{s.label}</p>
            </div>
          ))}
        </div>
      );
    }

    case 'estimator':
      return <EstimatorBlock key={index} block={block} />;

    case 'timeline': {
      const steps = (block.items ?? []) as { phase: string; duration: string; desc?: string }[];
      if (!steps.length) return null;
      return (
        <div key={index} className="my-8">
          {block.title && <p className="font-semibold text-[#2c2c2c] mb-4 text-[15px]">{block.title}</p>}
          <ol className="relative border-l-2 border-stone-200 ml-2 space-y-5">
            {steps.map((st, i) => (
              <li key={i} className="ml-5">
                <span className="absolute -left-[7px] w-3 h-3 rounded-full bg-[#b8864a]" />
                <div className="flex items-baseline gap-2 flex-wrap">
                  <span className="font-semibold text-[#2c2c2c] text-[15px]">{st.phase}</span>
                  <span className="text-[12px] font-medium text-[#b8864a]">{st.duration}</span>
                </div>
                {st.desc && <p className="text-[14px] text-[#6b6b6b] mt-0.5">{st.desc}</p>}
              </li>
            ))}
          </ol>
        </div>
      );
    }

    case 'cta':
      return (
        <div key={index} className="my-8 bg-[#b8864a]/8 border border-[#b8864a]/25 rounded-2xl p-6 text-center">
          {block.title && <p className="text-lg font-bold text-[#2c2c2c] mb-1">{block.title}</p>}
          {block.text && <p className="text-[14px] text-[#6b6b6b] mb-4">{block.text}</p>}
          <Link href={block.href || '/companies'} className="inline-block bg-[#b8864a] hover:bg-[#a07640] text-white font-medium text-[15px] rounded-2xl px-6 py-3 transition">
            {block.ctaLabel || 'Find a company'}
          </Link>
        </div>
      );

    case 'image': {
      if (!block.url) return null;
      return (
        <figure key={index} className="my-8">
          <div className="aspect-video w-full overflow-hidden rounded-2xl bg-stone-100">
            <SmartImage src={block.url} alt={block.alt ?? ''} className="w-full h-full object-cover" loading="lazy" width={800} height={450} />
          </div>
          {block.caption && <figcaption className="text-[13px] text-[#6b6b6b] text-center mt-2">{block.caption}</figcaption>}
        </figure>
      );
    }

    case 'stat_table': {
      if (!block.columns?.length || !block.rows?.length) return null;
      return (
        <div key={index} className="my-8">
          {block.caption && <p className="text-[14px] text-[#6b6b6b] mb-3">{block.caption}</p>}
          <div className="overflow-x-auto rounded-2xl border border-stone-200">
            <table className="w-full text-[14px] border-collapse">
              <thead>
                <tr className="bg-stone-100">
                  {block.columns.map((col, ci) => (
                    <th key={ci} className={`px-4 py-3 font-semibold text-[#2c2c2c] border-b border-stone-200 ${ci === 0 ? 'text-left' : 'text-right'}`}>{col}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {block.rows.map((row, ri) => (
                  <tr key={ri} className={ri % 2 === 0 ? 'bg-white' : 'bg-stone-50'}>
                    {row.map((cell, ci) => (
                      <td key={ci} className={`px-4 py-3 text-[#6b6b6b] border-b border-stone-100 ${ci === 0 ? 'text-left text-[#2c2c2c]' : 'text-right'}`}>{cell}</td>
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
            {block.items.map((faq: { q: string; a: string }, fi: number) => (
              <details key={fi} className="bg-white border border-stone-200 rounded-2xl overflow-hidden">
                <summary className="cursor-pointer px-5 py-4 font-medium text-[#2c2c2c] text-[15px] select-none hover:bg-stone-50 list-none flex items-center justify-between">
                  {faq.q}
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-[#6b6b6b] shrink-0" aria-hidden="true"><polyline points="9 18 15 12 9 6" /></svg>
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
          {block.title && <p className="font-semibold text-[#2c2c2c] mb-3 text-[15px]">{block.title}</p>}
          <Tag className={`space-y-2 ${block.ordered ? 'list-decimal list-inside pl-1' : 'list-none pl-0'}`}>
            {(block.items as unknown[]).map((item: unknown, li: number) => (
              <li key={li} className="flex items-start gap-2 text-[15px] text-[#6b6b6b]">
                {!block.ordered && <span className="mt-1.5 w-2 h-2 rounded-full bg-[#b8864a] shrink-0" />}
                {String(item ?? '')}
              </li>
            ))}
          </Tag>
        </div>
      );
    }

    case 'expert_quote': {
      const expert = experts[block.expertIndex ?? 0];
      if (!expert) return null;
      return <ExpertQuoteCard key={index} expert={expert} />;
    }

    case 'source':
      return <p key={index} className="text-[12px] text-stone-400 mt-4 mb-6"><span className="font-medium">Source:</span> {block.text}</p>;

    default:
      return null;
  }
}

// ─── Floating quick-nav sidebar (scroll-spy) ─────────────────────────────────────

function FloatingToc({ items }: { items: { id: string; text: string }[] }) {
  const [active, setActive] = useState('');
  useEffect(() => {
    const els = items.map((t) => document.getElementById(t.id)).filter(Boolean) as HTMLElement[];
    if (!els.length) return;
    const obs = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActive(visible[0].target.id);
      },
      { rootMargin: '-80px 0px -68% 0px' }
    );
    els.forEach((el) => obs.observe(el));
    return () => obs.disconnect();
  }, [items]);

  return (
    <aside
      className="hidden xl:block fixed top-28 right-8 w-56 max-h-[72vh] overflow-y-auto z-30 bg-white/90 backdrop-blur-sm border border-stone-200 rounded-2xl p-4 shadow-sm"
      aria-label="On this page"
    >
      <p className="text-[11px] font-bold uppercase tracking-widest text-[#b8864a] mb-3">On this page</p>
      <ul className="space-y-1.5 border-l border-stone-200">
        {items.map((t) => (
          <li key={t.id}>
            <a
              href={`#${t.id}`}
              className={`block pl-3 -ml-px border-l-2 leading-snug text-[13px] transition ${
                active === t.id
                  ? 'border-[#b8864a] text-[#b8864a] font-medium'
                  : 'border-transparent text-[#6b6b6b] hover:text-[#2c2c2c]'
              }`}
            >
              {t.text}
            </a>
          </li>
        ))}
      </ul>
    </aside>
  );
}

// ─── Main ───────────────────────────────────────────────────────────────────────

export default function GuideDetailClient({ guide }: { guide: PublicGuide }) {
  const experts = guide.experts ?? [];
  const blocks = guide.body_blocks ?? [];
  const toc = blocks
    .filter((b) => b.type === 'heading' && b.level !== 3 && b.text)
    .map((b) => ({ id: slugifyHeading(b.text || ''), text: b.text as string }));
  const mins = readingMinutes(blocks, guide.summary);
  const updated = fmtDate(guide.updated_at || guide.published_at);

  // 按 H2 分段：lead(首个H2前) + 各段。标记 collapsed 的段折叠（内容仍在 HTML，AI 可抓）。
  const lead: { block: BodyBlock; i: number }[] = [];
  const sections: { heading: BodyBlock; hi: number; collapsed: boolean; body: { block: BodyBlock; i: number }[] }[] = [];
  blocks.forEach((block, i) => {
    if (block.type === 'heading' && block.level !== 3) {
      sections.push({ heading: block, hi: i, collapsed: !!block.collapsed, body: [] });
    } else if (sections.length === 0) {
      lead.push({ block, i });
    } else {
      sections[sections.length - 1].body.push({ block, i });
    }
  });

  return (
    <div className="max-w-3xl mx-auto px-4 py-10">
      {/* Breadcrumb */}
      <nav aria-label="Breadcrumb" className="flex items-center gap-1 text-sm text-[#6b6b6b] mb-6">
        <Link href="/" className="hover:text-[#b8864a]">Home</Link>
        <span className="mx-1">›</span>
        <Link href="/insights" className="hover:text-[#b8864a]">Insights</Link>
        <span className="mx-1">›</span>
        <span className="text-[#2c2c2c] line-clamp-1">{guide.title}</span>
      </nav>

      {guide.cover_image && (
        <div className="aspect-video w-full overflow-hidden rounded-2xl bg-stone-100 mb-8">
          <SmartImage src={guide.cover_image} alt={guide.title} className="w-full h-full object-cover" loading="eager" fetchPriority="high" width={800} height={450} />
        </div>
      )}

      <span className="inline-block text-xs font-semibold uppercase tracking-wider text-[#b8864a] bg-[#b8864a]/10 rounded-full px-3 py-0.5 mb-4">{categoryLabel(guide.category)}</span>
      <h1 className="text-3xl font-bold text-[#2c2c2c] mb-3 leading-tight">{guide.title}</h1>

      {/* meta */}
      <div className="flex items-center gap-3 text-[13px] text-stone-400 mb-6">
        {guide.author_name && <span>{guide.author_name}</span>}
        {guide.author_name && <span>·</span>}
        <span>{mins} min read</span>
        {updated && <span>·</span>}
        {updated && <span>Updated {updated}</span>}
      </div>

      {/* Answer-first summary lead */}
      <p className="text-[16px] text-[#2c2c2c] leading-relaxed mb-7 border-l-4 border-[#b8864a] pl-4">{guide.summary}</p>

      {/* Floating quick-nav (desktop) */}
      {toc.length >= 3 && <FloatingToc items={toc} />}

      {/* Inline TOC (mobile / narrow — floating sidebar takes over on xl) */}
      {toc.length >= 3 && (
        <nav className="xl:hidden mb-8 bg-stone-50 border border-stone-200 rounded-2xl p-5">
          <p className="text-[11px] font-bold uppercase tracking-widest text-[#b8864a] mb-3">In this guide</p>
          <ol className="space-y-1.5">
            {toc.map((t, i) => (
              <li key={i}>
                <a href={`#${t.id}`} className="text-[14px] text-[#3a3a3a] hover:text-[#b8864a] transition">
                  <span className="text-stone-400 mr-2">{String(i + 1).padStart(2, '0')}</span>{t.text}
                </a>
              </li>
            ))}
          </ol>
        </nav>
      )}

      {/* Body */}
      <div>
        {lead.map(({ block, i }) => renderBlock(block, experts, i))}
        {sections.map((s) =>
          s.collapsed ? (
            <details key={s.hi} open className="group border-t border-stone-200 mt-2">
              <summary
                id={slugifyHeading(s.heading.text || '')}
                className="cursor-pointer list-none flex items-center justify-between gap-3 text-xl font-bold text-[#2c2c2c] py-5 scroll-mt-24 hover:text-[#b8864a] transition"
              >
                <span>{s.heading.text}</span>
                <span className="shrink-0 flex items-center gap-1.5 text-[12px] font-medium text-[#b8864a]">
                  <span className="group-open:hidden">Show</span>
                  <span className="hidden group-open:inline">Hide</span>
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="transition-transform group-open:rotate-180" aria-hidden="true"><polyline points="6 9 12 15 18 9" /></svg>
                </span>
              </summary>
              <div className="pb-2">{s.body.map(({ block, i }) => renderBlock(block, experts, i))}</div>
            </details>
          ) : (
            <section key={s.hi}>
              {renderBlock(s.heading, experts, s.hi)}
              {s.body.map(({ block, i }) => renderBlock(block, experts, i))}
            </section>
          )
        )}
      </div>

      {/* Back to top */}
      <button
        type="button"
        onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
        className="fixed bottom-6 right-6 z-40 w-11 h-11 rounded-full bg-[#1c1917] text-white shadow-lg flex items-center justify-center hover:bg-[#b8864a] transition"
        aria-label="Back to top"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="18 15 12 9 6 15" /></svg>
      </button>
    </div>
  );
}
