// Seed insights/guides — 平台真实数据写的深度指南（幂等：按 slug+country 先删后插）。
// 用法：source server/.env 后 node scripts/seed-guides.mjs
import { createRequire } from 'node:module';
const require = createRequire(process.cwd() + '/x.js');
const db = require(process.cwd() + '/server/dist/config/database').default;

// 各风格中位 AED/㎡（来自真实项目聚合，估算器用）
const STYLE_MEDIANS = [
  { style: 'Soft Minimal', median: 1601 },
  { style: 'Boutique Luxury', median: 1680 },
  { style: 'Minimalist', median: 1712 },
  { style: 'Luxury Modern', median: 1787 },
  { style: 'Modern Arabic', median: 1833 },
  { style: 'Modern Renovation', median: 1842 },
  { style: 'Elegant Contemporary', median: 1882 },
  { style: 'Resort Coastal', median: 1948 },
];

const costGuide = {
  slug: 'dubai-renovation-cost-guide-2026',
  country: 'ae',
  category: 'cost',
  title: 'Dubai Renovation Cost Guide 2026 — Real Cost per m² by Style, Size & Stage',
  summary:
    'Interior renovation in Dubai costs about AED 1,475–2,006 per square meter — a median near AED 1,800/m² — based on 191 real completed projects on Tarmeer. Larger homes cost meaningfully less per m² (economies of scale), prices held steady from 2022 to 2025, and design style shifts the figure by roughly AED 350/m². This guide breaks down cost by style, by home size, by stage of work, where the money actually goes, real project snapshots, a budget estimator, and how to choose the right company.',
  cover_image: '/images/insights/cost-cover.webp',
  author_name: 'Tarmeer Editorial',
  seo_title: 'Dubai Renovation Cost 2026: Real AED/m² by Style & Size | Tarmeer',
  seo_description:
    'How much does renovation cost in Dubai? Real cost per m² by style, home size and stage, from 191 completed Tarmeer projects — plus a budget estimator, cost breakdown, timeline and FAQs.',
  status: 'published',
  body_blocks: [
    { type: 'callout', variant: 'key', title: 'Key takeaways', items: [
      'Median renovation cost: ~AED 1,800/m² (typical range AED 1,475–2,006/m²), from 191 real Tarmeer projects.',
      'Bigger homes cost less per m²: ~AED 2,089/m² for 100–200 m² vs ~AED 1,633/m² above 400 m².',
      'Prices were flat 2022–2025 — budget with confidence, not for double-digit inflation.',
      'Design style moves the number by ~AED 350/m² (Soft Minimal lowest, Resort Coastal highest).',
    ] },
    { type: 'stat_highlight', items: [
      { value: 'AED 1,800', label: 'Median cost per m² (fit-out & finishes)' },
      { value: '191', label: 'Real completed projects analysed' },
      { value: '−22%', label: 'Per-m² saving on large vs small homes' },
    ] },

    { type: 'heading', level: 2, text: 'How much does renovation cost per m² in Dubai?' },
    { type: 'paragraph', text: 'Across 191 real completed interior projects on Tarmeer, renovation in Dubai runs about AED 1,475–2,006 per square meter, clustering around a median of AED 1,800/m². The single biggest driver is scope — how much structural and MEP (electrical, plumbing, AC) work is involved — followed by finish level and design style.' },
    { type: 'stat_table', caption: 'Average cost by design style — AED per m² (real Tarmeer projects)', columns: ['Design style', 'Projects', 'Median', 'Typical range'], rows: [
      ['Soft Minimal', '8', '1,601', '1,518 – 1,695'],
      ['Boutique Luxury', '8', '1,680', '1,589 – 1,776'],
      ['Minimalist', '8', '1,712', '1,619 – 1,807'],
      ['Luxury Modern', '8', '1,787', '1,693 – 1,877'],
      ['Modern Arabic', '12', '1,833', '1,643 – 1,929'],
      ['Modern Renovation', '8', '1,842', '1,749 – 1,925'],
      ['Resort Coastal', '8', '1,948', '1,820 – 2,060'],
    ] },

    { type: 'heading', level: 2, text: 'Bigger homes cost less per m² (economies of scale)' },
    { type: 'paragraph', text: 'Per-square-meter cost falls as the home gets larger — fixed costs (design, management, mobilisation, kitchens and bathrooms) spread across more area. The effect is significant: a mid-size apartment can cost ~28% more per m² than a large villa.' },
    { type: 'stat_table', caption: 'Cost per m² by home size — real Tarmeer projects', columns: ['Home size', 'Projects', 'Avg AED/m²'], rows: [
      ['100 – 200 m² (apartment)', '44', '2,089'],
      ['200 – 400 m² (large apt / townhouse)', '88', '1,714'],
      ['Over 400 m² (villa)', '56', '1,633'],
    ] },
    { type: 'callout', variant: 'tip', title: 'Tip', text: 'If you are comparing quotes across different home sizes, always normalise to cost per m² — a higher total can still be cheaper per m².' },

    { type: 'estimator', styleMedians: STYLE_MEDIANS, defaultArea: 150, currency: 'AED' },

    { type: 'heading', level: 2, text: 'Where the money actually goes' },
    { type: 'paragraph', text: 'A renovation budget is rarely one number — it is a stack of trades. The split below is a typical industry breakdown for a mid-to-high-end Dubai fit-out; your mix shifts with how much joinery and structural change you take on.' },
    { type: 'stat_table', caption: 'Typical cost breakdown by trade (market reference, % of fit-out budget)', columns: ['Trade / line item', 'Typical share'], rows: [
      ['Joinery & built-in furniture', '25 – 30%'],
      ['Kitchen & bathrooms', '15 – 20%'],
      ['Flooring & wall finishes', '15 – 20%'],
      ['MEP (electrical / plumbing / AC)', '12 – 15%'],
      ['Ceilings, gypsum & lighting', '8 – 12%'],
      ['Paint & final finishes', '5 – 8%'],
      ['Design & project management', '8 – 12%'],
    ] },
    { type: 'image', url: '/images/insights/cost-scene.webp', alt: 'Renovation material samples, swatches and a floor plan', caption: 'Joinery and finishes are usually the largest single slice of the budget.' },
    { type: 'source', text: 'Trade-split percentages are a typical industry reference for Dubai fit-out, not Tarmeer transaction data; per-project mix varies.' },

    { type: 'heading', level: 2, text: 'Have prices gone up? The 2022–2025 trend' },
    { type: 'paragraph', text: 'Despite UAE construction activity, median per-m² renovation cost on Tarmeer stayed remarkably flat over four years — useful if you are planning a project in 2026.' },
    { type: 'stat_table', caption: 'Median AED/m² by completion year', columns: ['Year', 'Projects', 'Median AED/m²'], rows: [
      ['2022', '45', '1,807'],
      ['2023', '51', '1,807'],
      ['2024', '50', '1,819'],
      ['2025', '45', '1,807'],
    ] },

    { type: 'heading', level: 2, text: 'Real project snapshots' },
    { type: 'paragraph', text: 'A series of real completed apartments from Amira Al Mansoori Design Studio (Modern Luxury) shows the economies-of-scale effect inside one studio’s actual work — the per-m² figure drops as the home grows.' },
    { type: 'stat_table', caption: 'Real completed projects on Tarmeer', columns: ['Area', 'Total cost', 'AED/m²'], rows: [
      ['110 m²', 'AED 180,000', '1,636'],
      ['156 m²', 'AED 238,000', '1,526'],
      ['202 m²', 'AED 296,000', '1,465'],
    ] },
    { type: 'expert_quote', expertIndex: 0 },

    { type: 'heading', level: 2, text: 'What drives the cost up or down' },
    { type: 'list', ordered: false, title: 'Main cost drivers', items: [
      'Scope — structural changes and MEP rework (moving walls, electrical, plumbing) add the most.',
      'Finishes — marble, custom joinery and imported fixtures push cost toward the top of the range.',
      'Home size — larger homes cost less per m² (see above).',
      'Style — Resort Coastal and Modern Arabic trend higher; soft-minimal schemes sit lower.',
      'Timeline — compressed schedules and phased works raise labour cost.',
    ] },

    { type: 'heading', level: 2, text: 'Typical renovation timeline' },
    { type: 'timeline', title: 'From first call to handover', items: [
      { phase: 'Design & concept', duration: '2–4 weeks', desc: 'Brief, site survey, mood boards, layout and material selection.' },
      { phase: 'Quotation & contract', duration: '1–2 weeks', desc: 'Detailed BOQ, fixed quote, approvals and permits where needed.' },
      { phase: 'Construction & fit-out', duration: '6–12 weeks', desc: 'Demolition, MEP, joinery, finishes — the bulk of the timeline.' },
      { phase: 'Snagging & handover', duration: '1–2 weeks', desc: 'Defect list, final finishes, cleaning and handover.' },
    ] },

    { type: 'heading', level: 2, text: 'What’s included — and what’s not' },
    { type: 'list', ordered: false, title: 'Usually included in the per-m² figure', items: [
      'Design and project management', 'Demolition and MEP works', 'Built-in joinery and wardrobes', 'Flooring, wall finishes and paint', 'Kitchen and bathroom fit-out', 'Ceilings and lighting',
    ] },
    { type: 'list', ordered: false, title: 'Usually quoted separately', items: [
      'Loose furniture and décor', 'Appliances and smart-home systems', 'Landscaping and outdoor works', 'Authority / community NOC fees',
    ] },

    { type: 'heading', level: 2, text: 'Where to save — and where not to' },
    { type: 'list', ordered: false, title: 'Safe places to save', items: [
      'Keep the existing layout — avoid moving wet areas (kitchen / bathrooms).',
      'Choose porcelain that mimics marble instead of natural stone.',
      'Standard joinery sizes over fully bespoke where it isn’t seen.',
    ] },
    { type: 'list', ordered: false, title: 'Don’t cut corners on', items: [
      'MEP and waterproofing — the most expensive things to redo.',
      'A clear fixed-scope contract and BOQ.',
      'A verified, insured contractor with real references.',
    ] },
    { type: 'expert_quote', expertIndex: 1 },

    { type: 'heading', level: 2, text: 'How to choose a renovation company in Dubai' },
    { type: 'paragraph', text: 'Tarmeer lists verified design-and-build companies across the UAE with real project portfolios. When you shortlist, check the basics below — and always get at least three comparable, itemised quotes.' },
    { type: 'list', ordered: false, title: 'Checklist before you sign', items: [
      'Verified profile and a real, recent portfolio in your style.',
      'Itemised BOQ with a fixed scope — not a single lump sum.',
      'Trade licence, insurance and a written warranty period.',
      'References from projects of a similar size and budget.',
    ] },
    { type: 'expert_quote', expertIndex: 2 },
    { type: 'cta', title: 'Get matched with verified Dubai renovation companies', text: 'Compare portfolios and request itemised quotes from companies that fit your style and budget.', href: '/companies', ctaLabel: 'Browse companies' },

    { type: 'callout', variant: 'method', title: 'How we calculated this', text: 'Figures are aggregated from 191 real completed interior projects published on Tarmeer (UAE) with both cost and area recorded, spanning 2022–2025. We compute cost per square meter per project, then report medians and ranges by design style, home size and year. Trade-split percentages are an industry reference, not platform transaction data.' },

    { type: 'faq', items: [
      { q: 'How much to renovate a 150 m² apartment in Dubai?', a: 'At the median of ~AED 1,800/m², a 150 m² apartment is roughly AED 270,000 for fit-out and finishes. Smaller apartments trend higher per m² (~AED 2,089/m²), so budget AED 290,000+ for a high-end scheme. Use the estimator above for your exact size and style.' },
      { q: 'Which design style is most expensive?', a: 'Among real Tarmeer projects, Resort Coastal (~AED 1,948/m²) and Modern Arabic (~AED 1,833/m²) carry the highest medians; Soft Minimal (~AED 1,601/m²) is the most economical.' },
      { q: 'Why is renovating a small apartment more expensive per m²?', a: 'Fixed costs — design, management, kitchens, bathrooms — spread across less area, so the per-m² figure rises. Large villas benefit from economies of scale (~AED 1,633/m²).' },
      { q: 'Have renovation prices gone up in Dubai?', a: 'On Tarmeer, median per-m² cost was essentially flat from 2022 to 2025 (~AED 1,807/m²), so 2026 planning can use today’s figures with confidence.' },
      { q: 'Does the price include furniture?', a: 'No. The per-m² figures cover fit-out and finishes. Loose furniture, appliances, smart-home systems and landscaping are usually quoted separately.' },
      { q: 'How long does a Dubai apartment renovation take?', a: 'Typically 10–20 weeks end to end: 2–4 weeks design, 1–2 weeks quotation, 6–12 weeks construction, 1–2 weeks snagging and handover.' },
      { q: 'What is the biggest cost driver?', a: 'Scope — structural changes and MEP rework — followed by finish level (marble, bespoke joinery, imported fixtures) and design style.' },
      { q: 'How many quotes should I get?', a: 'At least three comparable, itemised quotes (BOQ) from verified companies, so you can compare scope line by line — not just bottom-line totals.' },
    ] },

    { type: 'source', text: 'Cost figures aggregated from 191 real completed projects published on Tarmeer (UAE), 2022–2025. Individual quotes vary — request a tailored quote from a verified company on Tarmeer.' },
  ],
  experts: [
    { expert_ref_id: 5, expert_ref_source: 'experts', role_label: 'Certified Interior Designer · Dubai', quote: 'Verified Tarmeer expert with 12 years of high-end residential interior design experience in Dubai.', sort_order: 0 },
    { expert_ref_id: 6, expert_ref_source: 'experts', role_label: 'Certified Interior Designer · Abu Dhabi', quote: 'Verified Tarmeer expert with 7 years specialising in residential fit-out across Abu Dhabi.', sort_order: 1 },
    { expert_ref_id: 7, expert_ref_source: 'experts', role_label: 'Interior Designer · Sharjah', quote: 'Verified Tarmeer expert with 18 years across Sharjah and the Northern Emirates.', sort_order: 2 },
  ],
};

async function seedGuide(g) {
  const [old] = await db.execute('SELECT id FROM guides WHERE slug=? AND country=?', [g.slug, g.country]);
  if (old.length) {
    await db.execute('DELETE FROM guide_expert_quotes WHERE guide_id=?', [old[0].id]);
    await db.execute('DELETE FROM guides WHERE id=?', [old[0].id]);
  }
  const [res] = await db.execute(
    `INSERT INTO guides (slug, country, category, title, summary, body_blocks, cover_image, status, author_name, seo_title, seo_description, published_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
    [g.slug, g.country, g.category, g.title, g.summary, JSON.stringify(g.body_blocks), g.cover_image, g.status, g.author_name, g.seo_title, g.seo_description]
  );
  const guideId = res.insertId;
  for (const e of g.experts || []) {
    await db.execute(
      'INSERT INTO guide_expert_quotes (guide_id, expert_ref_id, expert_ref_source, quote, role_label, sort_order) VALUES (?, ?, ?, ?, ?, ?)',
      [guideId, e.expert_ref_id, e.expert_ref_source, e.quote, e.role_label, e.sort_order]
    );
  }
  console.log(`✓ seeded guide #${guideId} ${g.slug} — ${g.body_blocks.length} blocks, ${(g.experts || []).length} experts`);
}

(async () => {
  await seedGuide(costGuide);
  console.log('done');
  process.exit(0);
})().catch((e) => { console.error(e.message); process.exit(1); });
