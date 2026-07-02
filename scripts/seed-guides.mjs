// Seed insights/guides — 平台真实数据写的深度指南（幂等：按 slug+country 先删后插）。
// 用法：source server/.env 后 node scripts/seed-guides.mjs
import { createRequire } from 'node:module';
const require = createRequire(process.cwd() + '/x.js');
// 本地: server/dist/config/database；生产: 传 GUIDE_DB_PATH=/tarmeer/tarmeer_api/dist/config/database
const DB_PATH = process.env.GUIDE_DB_PATH || process.cwd() + '/server/dist/config/database';
const db = require(DB_PATH).default;

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

    { type: 'heading', level: 2, text: 'Typical renovation timeline', collapsed: true },
    { type: 'timeline', title: 'From first call to handover', items: [
      { phase: 'Design & concept', duration: '2–4 weeks', desc: 'Brief, site survey, mood boards, layout and material selection.' },
      { phase: 'Quotation & contract', duration: '1–2 weeks', desc: 'Detailed BOQ, fixed quote, approvals and permits where needed.' },
      { phase: 'Construction & fit-out', duration: '6–12 weeks', desc: 'Demolition, MEP, joinery, finishes — the bulk of the timeline.' },
      { phase: 'Snagging & handover', duration: '1–2 weeks', desc: 'Defect list, final finishes, cleaning and handover.' },
    ] },

    { type: 'heading', level: 2, text: 'What’s included — and what’s not', collapsed: true },
    { type: 'list', ordered: false, title: 'Usually included in the per-m² figure', items: [
      'Design and project management', 'Demolition and MEP works', 'Built-in joinery and wardrobes', 'Flooring, wall finishes and paint', 'Kitchen and bathroom fit-out', 'Ceilings and lighting',
    ] },
    { type: 'list', ordered: false, title: 'Usually quoted separately', items: [
      'Loose furniture and décor', 'Appliances and smart-home systems', 'Landscaping and outdoor works', 'Authority / community NOC fees',
    ] },

    { type: 'heading', level: 2, text: 'Where to save — and where not to', collapsed: true },
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
  expertCount: 3,
};

// ── 指南 B：建材采购（真实品类/产地/供应商 + 采购单位/流程）──
const sourcingGuide = {
  slug: 'dubai-building-materials-sourcing-guide',
  country: 'ae',
  category: 'sourcing',
  title: 'Sourcing Building Materials in Dubai — Categories, Suppliers & Buying Process',
  summary:
    'Sourcing building materials in Dubai means choosing between imported and locally-stocked suppliers, comparing itemised quotes by unit (per m², per piece, per set), and managing lead times. Tarmeer lists 32 verified material suppliers across 9 categories — most (about 27) import from China, with a handful holding local Dubai stock. This guide covers the material categories, how materials are priced, the step-by-step buying process, what to check before ordering, and how to shortlist reliable suppliers.',
  cover_image: '/images/insights/sourcing-cover.webp',
  author_name: 'Tarmeer Editorial',
  seo_title: 'Sourcing Building Materials in Dubai: Suppliers & Process | Tarmeer',
  seo_description:
    'How to source building materials in Dubai: material categories, imported vs local suppliers, pricing by unit, the buying process, and a pre-order checklist — from Tarmeer’s verified supplier network.',
  status: 'published',
  body_blocks: [
    { type: 'callout', variant: 'key', title: 'Key takeaways', items: [
      'Tarmeer lists 32 verified material suppliers across 9 categories (furniture, stone, lighting, flooring, kitchen, hardware, paint, plants and more).',
      'Most suppliers (~27) import from China; ~5 hold local Dubai stock for faster delivery.',
      'Materials are priced by unit — per m² (tiles, stone, flooring), per piece (furniture, lighting), per set (kitchen) — always compare unit price + MOQ + lead time.',
      'Imported orders typically add 4–8 weeks for production and shipping; local stock ships in days.',
    ] },
    { type: 'stat_highlight', items: [
      { value: '32', label: 'Verified material suppliers' },
      { value: '9', label: 'Material categories' },
      { value: '27 + 5', label: 'Import (China) + local (Dubai)' },
    ] },

    { type: 'heading', level: 2, text: 'How to source building materials in Dubai' },
    { type: 'paragraph', text: 'Sourcing well comes down to three decisions: which category and specification you need, whether to buy imported (wider range, lower unit cost, longer lead time) or local stock (faster, easier returns), and how to compare quotes fairly — always by unit, with minimum order quantity (MOQ) and lead time on the table. Start from a verified supplier list so quality and delivery are accountable.' },
    { type: 'stat_table', caption: 'Material categories & how they’re typically priced', columns: ['Category', 'Covers', 'Typical unit'], rows: [
      ['Furniture', 'Sofas, tables, wardrobes, beds', 'per piece / set'],
      ['Stone & tiles', 'Marble, porcelain, cladding', 'per m²'],
      ['Flooring', 'Wood, vinyl, tiles', 'per m²'],
      ['Lighting', 'Fixtures, LED, decorative', 'per piece'],
      ['Kitchen', 'Cabinets, worktops', 'per set / linear m'],
      ['Hardware', 'Handles, hinges, fittings', 'per piece / set'],
      ['Paint & finishes', 'Paint, coatings, plaster', 'per bucket / m²'],
      ['Plants & landscaping', 'Indoor & outdoor greenery', 'per piece'],
    ] },

    { type: 'heading', level: 2, text: 'Imported vs local: where materials come from' },
    { type: 'paragraph', text: 'Across Tarmeer’s verified suppliers, most manufacture or import from China, while a smaller group carries ready stock in Dubai. Your choice trades cost and range against speed and convenience.' },
    { type: 'stat_table', caption: 'Verified suppliers by source', columns: ['Source', 'Suppliers', 'Best for'], rows: [
      ['China (import / made-to-order)', '27', 'Range, lower unit cost, custom sizes'],
      ['UAE / Dubai (local stock)', '5', 'Speed, showroom visits, easy returns'],
    ] },
    { type: 'callout', variant: 'tip', title: 'Tip', text: 'For time-critical projects, split the order: local stock for anything on the critical path, imported for bulk or bespoke items where the 4–8 week lead time is acceptable.' },

    { type: 'heading', level: 2, text: 'How materials are priced' },
    { type: 'paragraph', text: 'Unlike a finished renovation, materials are quoted per unit. Compare like for like — a low price per piece can hide a high MOQ or excluded shipping. Ask every supplier for: unit price, minimum order quantity, lead time, and whether the price is ex-works, FOB or delivered (Incoterms).' },
    { type: 'list', ordered: false, title: 'Common pricing units', items: [
      'Per square meter (m²) — tiles, stone, flooring, cladding.',
      'Per piece (pcs) — furniture, lighting, sanitaryware, doors.',
      'Per set — kitchens, wardrobes, bathroom suites.',
      'Per linear meter (lm) — worktops, skirting, profiles.',
      'Per m³ / ton / roll / carton — bulk materials and finishes.',
    ] },
    { type: 'source', text: 'Tarmeer does not publish supplier transaction prices; request itemised quotes directly from verified suppliers. Units above reflect standard building-materials trade practice.' },

    { type: 'heading', level: 2, text: 'The buying process, step by step' },
    { type: 'timeline', title: 'From shortlist to delivery', collapsed: false, items: [
      { phase: 'Shortlist & request catalogs', duration: '~1 week', desc: 'Pick verified suppliers by category, origin and portfolio.' },
      { phase: 'Request samples', duration: '1–2 weeks', desc: 'Approve material, colour and finish in hand before committing.' },
      { phase: 'Get itemised quotes', duration: 'A few days', desc: 'Unit price + MOQ + lead time + Incoterms from each supplier.' },
      { phase: 'Order & deposit', duration: '—', desc: 'Confirm spec, sign a clear PO, pay the agreed deposit.' },
      { phase: 'Production & shipping / customs', duration: '4–8 weeks (imports)', desc: 'Track production; local stock ships in days.' },
      { phase: 'Delivery, inspection & QC', duration: 'On arrival', desc: 'Check quantity, spec and damage against the PO before final payment.' },
    ] },

    { type: 'expert_quote', expertIndex: 0 },

    { type: 'heading', level: 2, text: 'What to check before you order', collapsed: true },
    { type: 'list', ordered: false, title: 'Pre-order checklist', items: [
      'Verified supplier with a real portfolio and references.',
      'Physical sample approved (only ~5 of 32 suppliers have a Dubai showroom — request samples otherwise).',
      'Itemised quote: unit price, MOQ, lead time, Incoterms (ex-works / FOB / delivered).',
      'Who handles shipping, customs clearance and UAE delivery.',
      'Warranty, replacement policy and who covers transit damage.',
    ] },

    { type: 'heading', level: 2, text: 'Imported vs local — pros and cons', collapsed: true },
    { type: 'list', ordered: false, title: 'Buying imported (China)', items: [
      'Pros: widest range, custom sizes, lower unit cost at volume.',
      'Cons: 4–8 week lead time, shipping + customs, harder returns.',
    ] },
    { type: 'list', ordered: false, title: 'Buying local (Dubai stock)', items: [
      'Pros: days not weeks, showroom visits, easy replacement.',
      'Cons: narrower range, higher unit price, limited custom sizes.',
    ] },
    { type: 'expert_quote', expertIndex: 1 },

    { type: 'cta', title: 'Browse verified material suppliers in Dubai', text: 'Compare categories, origins and portfolios — and request itemised quotes from verified suppliers.', href: '/materials', ctaLabel: 'Browse suppliers' },

    { type: 'callout', variant: 'method', title: 'About this data', text: 'Category counts, supplier totals and origin split are drawn from Tarmeer’s verified supplier network (32 approved suppliers, 78 catalogued products) at time of writing. Pricing units reflect standard trade practice; Tarmeer does not publish transaction prices.' },

    { type: 'faq', items: [
      { q: 'Where do most Dubai building materials come from?', a: 'Across Tarmeer’s verified suppliers, most (about 27 of 32) manufacture or import from China; a smaller group (~5) holds local Dubai stock for faster delivery.' },
      { q: 'How are building materials priced?', a: 'By unit — per m² for tiles/stone/flooring, per piece for furniture/lighting, per set for kitchens. Always compare unit price alongside minimum order quantity (MOQ) and lead time.' },
      { q: 'How long does it take to receive imported materials?', a: 'Typically 4–8 weeks for production and shipping from China, plus customs clearance. Locally-stocked items can arrive within days.' },
      { q: 'Should I buy imported or local?', a: 'Imported gives range and lower unit cost but longer lead times; local stock is faster and easier to return. For tight timelines, split the order.' },
      { q: 'Can I see materials before buying?', a: 'Only about 5 of 32 verified suppliers have a Dubai showroom, so request physical samples before committing for the rest.' },
      { q: 'What is MOQ?', a: 'Minimum order quantity — the smallest amount a supplier will produce or sell. Imported/made-to-order suppliers often have higher MOQs than local stockists.' },
      { q: 'Who handles shipping and customs?', a: 'Confirm this in the quote via Incoterms — ex-works, FOB or delivered. Delivered pricing includes shipping, customs and UAE delivery; ex-works does not.' },
      { q: 'How do I compare supplier quotes fairly?', a: 'Normalise everything to the same unit and quantity, then add MOQ, lead time and Incoterms. The lowest headline price is often not the lowest delivered cost.' },
    ] },

    { type: 'source', text: 'Based on Tarmeer’s verified UAE supplier network (32 approved suppliers across 9 categories). Request itemised quotes from suppliers for current pricing.' },
  ],
  expertCount: 2,
};

// ── 指南 C：风格趋势(trend) ──
const trendGuide = {
  slug: 'dubai-interior-design-trends-2026',
  country: 'ae', category: 'trend',
  title: '2026 Dubai Interior Design Trends — What’s Popular, by Style',
  summary: 'Modern and Modern Arabic dominate real Dubai interiors, while premium styles like Resort Coastal and Elegant Contemporary cost the most per m² and soft-minimal is the budget-friendly trend. Based on 292 real completed projects across 48 design styles on Tarmeer, here are the styles that are actually being built — and what each costs.',
  cover_image: '/images/insights/trend-cover.webp',
  author_name: 'Tarmeer Editorial',
  seo_title: '2026 Dubai Interior Design Trends by Style | Tarmeer',
  seo_description: 'Which interior design styles are trending in Dubai in 2026? Real popularity and cost per m² by style, from 292 completed Tarmeer projects.',
  status: 'published',
  body_blocks: [
    { type: 'callout', variant: 'key', title: 'Key takeaways', items: [
      'Modern and Modern Arabic are the most-built looks across real Dubai projects.',
      'Premium styles cost more per m²: Resort Coastal (~1,948) and Elegant Contemporary (~1,882) top the list.',
      'Soft Minimal is the most budget-friendly trend (~1,601 AED/m²).',
      'Based on 292 real completed projects across 48 tracked styles.',
    ] },
    { type: 'stat_highlight', items: [
      { value: '292', label: 'Real completed projects' },
      { value: '48', label: 'Design styles tracked' },
      { value: 'Modern Arabic', label: 'Top premium named style' },
    ] },
    { type: 'heading', level: 2, text: 'Which interior styles are trending in Dubai?' },
    { type: 'paragraph', text: 'Beyond broad “modern”, these named styles appear most across real Tarmeer projects — with their real median cost per square meter, so you can match taste to budget.' },
    { type: 'stat_table', caption: 'Popular design styles — projects & median cost (real Tarmeer data)', columns: ['Style', 'Projects', 'Median AED/m²'], rows: [
      ['Modern Arabic', '12', '1,833'],
      ['Minimalist', '10', '1,712'],
      ['Soft Minimal', '8', '1,601'],
      ['Boutique Luxury', '8', '1,680'],
      ['Luxury Modern', '8', '1,787'],
      ['Modern Renovation', '8', '1,842'],
      ['Elegant Contemporary', '8', '1,882'],
      ['Resort Coastal', '8', '1,948'],
    ] },
    { type: 'heading', level: 2, text: 'Modern Arabic: the signature premium look' },
    { type: 'paragraph', text: 'Modern Arabic is the most-built named premium style on Tarmeer — blending contemporary layouts with regional detailing (mashrabiya-inspired screens, warm stone, brass). It sits around AED 1,833/m², mid-to-upper in the range.' },
    { type: 'heading', level: 2, text: 'Budget-friendly vs premium styles' },
    { type: 'list', ordered: false, title: 'By cost per m²', items: [
      'Most economical: Soft Minimal (~1,601) and Boutique Luxury (~1,680).',
      'Mid-range: Minimalist (~1,712), Luxury Modern (~1,787), Modern Arabic (~1,833).',
      'Premium: Modern Renovation (~1,842), Elegant Contemporary (~1,882), Resort Coastal (~1,948).',
    ] },
    { type: 'expert_quote', expertIndex: 0 },
    { type: 'heading', level: 2, text: 'How to choose a style for your home', collapsed: true },
    { type: 'list', ordered: false, items: [
      'Match the style to your space and light — resort/coastal suits open, bright homes.',
      'Balance taste with budget using the per-m² ranges above.',
      'Look for a company with a real portfolio in your chosen style.',
    ] },
    { type: 'cta', title: 'Find designers who work in your style', text: 'Browse verified Dubai companies and portfolios by style.', href: '/companies', ctaLabel: 'Browse companies' },
    { type: 'callout', variant: 'method', title: 'About this data', text: 'Style popularity and cost per m² are aggregated from 292 real completed projects published on Tarmeer (UAE) across 48 styles. “Modern” is excluded from the named table as a broad catch-all.' },
    { type: 'faq', items: [
      { q: 'What is the most popular interior style in Dubai?', a: 'Broad “modern” leads overall; among named premium styles, Modern Arabic is the most-built on Tarmeer (12 projects), followed by Minimalist.' },
      { q: 'Which style is most expensive?', a: 'Resort Coastal (~AED 1,948/m²) and Elegant Contemporary (~1,882) carry the highest medians.' },
      { q: 'What is the cheapest style to build?', a: 'Soft Minimal (~AED 1,601/m²) is the most budget-friendly trending style.' },
      { q: 'What is Modern Arabic style?', a: 'A contemporary base with regional detailing — geometric screens, warm natural stone, brass accents — popular for its balance of luxury and identity.' },
      { q: 'Does style really change the cost much?', a: 'Yes — roughly AED 350/m² between the cheapest and priciest styles, driven by finishes and detailing.' },
      { q: 'How many styles does Tarmeer track?', a: '48 distinct styles across 292 completed projects.' },
    ] },
    { type: 'source', text: 'Aggregated from 292 real completed projects on Tarmeer (UAE), 48 styles. Individual results vary.' },
  ],
  expertCount: 2,
};

// ── 指南 D：成交故事(story) ──
const storyGuide = {
  slug: 'dubai-modern-luxury-renovation-story',
  country: 'ae', category: 'story',
  title: 'Real Project: A AED 296,000 Modern Luxury Renovation in Arabian Ranches',
  summary: 'A real completed 202 m² Modern Luxury home in Arabian Ranches, delivered by Amira Al Mansoori Design Studio for AED 296,000 — about AED 1,465/m², below the Dubai median thanks to its size. Here are the real numbers and how a renovation like this typically comes together on Tarmeer.',
  cover_image: '/images/insights/story-cover.webp',
  author_name: 'Tarmeer Editorial',
  seo_title: 'Real Dubai Renovation Story: AED 296,000 Modern Luxury Home | Tarmeer',
  seo_description: 'A real 202 m² Modern Luxury renovation in Arabian Ranches, AED 296,000 (~1,465/m²) by a verified Tarmeer company — the numbers and the typical journey.',
  status: 'published',
  body_blocks: [
    { type: 'callout', variant: 'key', title: 'At a glance', items: [
      'Real completed project: 202 m² Modern Luxury home, Arabian Ranches, delivered 2022.',
      'Total cost AED 296,000 — about AED 1,465/m².',
      'Delivered by Amira Al Mansoori Design Studio, a verified Tarmeer company.',
      'Came in below the ~AED 1,800/m² Dubai median — economies of scale on a larger home.',
    ] },
    { type: 'stat_highlight', items: [
      { value: '202 m²', label: 'Home size' },
      { value: 'AED 296,000', label: 'Total delivered cost' },
      { value: '~1,465', label: 'AED per m²' },
    ] },
    { type: 'heading', level: 2, text: 'The project at a glance' },
    { type: 'stat_table', caption: 'Real completed project on Tarmeer', columns: ['Detail', 'Value'], rows: [
      ['Home size', '202 m²'],
      ['Total cost', 'AED 296,000'],
      ['Cost per m²', '~AED 1,465'],
      ['Style', 'Modern Luxury'],
      ['Location', 'Arabian Ranches, Dubai'],
      ['Completed', '2022'],
      ['Company', 'Amira Al Mansoori Design Studio (verified)'],
    ] },
    { type: 'heading', level: 2, text: 'Why it came in below the Dubai median' },
    { type: 'paragraph', text: 'At AED 1,465/m², this home sits well under the ~AED 1,800/m² Dubai median. The reason is size: fixed costs (design, management, kitchens, bathrooms) spread across 202 m², so the per-m² figure drops — the economies-of-scale effect seen across Tarmeer projects.' },
    { type: 'heading', level: 2, text: 'How a renovation like this comes together' },
    { type: 'timeline', title: 'The typical journey on Tarmeer', items: [
      { phase: 'Match & shortlist', duration: '~1 week', desc: 'Homeowner browses verified companies and portfolios by style and budget.' },
      { phase: 'Design & material selection', duration: '2–4 weeks', desc: 'Concept, layout and finishes agreed with the studio.' },
      { phase: 'Itemised quote & contract', duration: '1–2 weeks', desc: 'Fixed-scope BOQ and schedule signed.' },
      { phase: 'Construction & fit-out', duration: '6–12 weeks', desc: 'Demolition, MEP, joinery and finishes.' },
      { phase: 'Handover', duration: '1–2 weeks', desc: 'Snagging, final finishes and handover.' },
    ] },
    { type: 'expert_quote', expertIndex: 0 },
    { type: 'cta', title: 'Start your own project', text: 'Browse verified Dubai design-and-build companies and request quotes.', href: '/companies', ctaLabel: 'Browse companies' },
    { type: 'source', text: 'Based on a real completed project published on Tarmeer (UAE): area, cost, style, location and company are the project’s actual details. The step-by-step timeline is a typical illustration of the process, not a client testimonial.' },
    { type: 'faq', items: [
      { q: 'How much did this renovation cost?', a: 'AED 296,000 for a 202 m² Modern Luxury home — about AED 1,465/m².' },
      { q: 'Why is the per-m² lower than average?', a: 'Larger homes cost less per m² because fixed costs spread across more area (economies of scale). The Dubai median is ~AED 1,800/m².' },
      { q: 'How long does a project like this take?', a: 'Typically 10–20 weeks end to end: design, quotation, construction and handover.' },
      { q: 'Who delivered this project?', a: 'Amira Al Mansoori Design Studio, a verified company on Tarmeer.' },
    ] },
  ],
  expertCount: 1,
};

// ── 指南 E：找谁(find) ──
const findGuide = {
  slug: 'how-to-choose-renovation-company-dubai',
  country: 'ae', category: 'find',
  title: 'How to Choose a Renovation & Design Company in Dubai (2026)',
  summary: 'Shortlist from verified companies, check portfolio, itemised BOQ, trade licence, insurance and references — then get at least three comparable, itemised quotes. Tarmeer lists 25 verified design-and-build companies plus a wider UAE directory of 185. Here’s exactly what to check before you sign.',
  cover_image: '/images/insights/find-cover.webp',
  author_name: 'Tarmeer Editorial',
  seo_title: 'How to Choose a Renovation Company in Dubai (2026) | Tarmeer',
  seo_description: 'A practical checklist for choosing a verified Dubai renovation & design company: portfolio, itemised BOQ, licence, references, red flags and the right questions to ask.',
  status: 'published',
  body_blocks: [
    { type: 'callout', variant: 'key', title: 'Key takeaways', items: [
      'Shortlist only verified companies with a real, recent portfolio in your style.',
      'Insist on an itemised BOQ (bill of quantities), not a single lump-sum price.',
      'Check trade licence, insurance and a written warranty period.',
      'Get at least three comparable quotes and compare scope line by line.',
    ] },
    { type: 'stat_highlight', items: [
      { value: '25', label: 'Verified companies on Tarmeer' },
      { value: '185', label: 'In the wider UAE directory' },
      { value: '3+', label: 'Quotes to compare' },
    ] },
    { type: 'heading', level: 2, text: 'How to choose the right company' },
    { type: 'paragraph', text: 'The best outcome comes from shortlisting verified companies whose real portfolio matches your style and budget, then comparing itemised quotes on the same scope. Start from a verified list so quality and delivery are accountable.' },
    { type: 'heading', level: 2, text: 'What to check before you sign' },
    { type: 'list', ordered: false, title: 'Vetting checklist', items: [
      'Verified profile with a real, recent portfolio in your style.',
      'Itemised BOQ with a fixed scope — not a lump sum.',
      'Valid trade licence, insurance and a written warranty period.',
      'References from projects of similar size and budget.',
      'A clear payment schedule tied to milestones.',
    ] },
    { type: 'heading', level: 2, text: 'Red flags to avoid', collapsed: true },
    { type: 'list', ordered: false, items: [
      'A single lump-sum price with no itemised breakdown.',
      'Large upfront payment before any work or design.',
      'No verifiable portfolio, licence or references.',
      'Quotes that are far below the market — corners get cut later.',
    ] },
    { type: 'heading', level: 2, text: 'Questions to ask each company', collapsed: true },
    { type: 'list', ordered: false, items: [
      'Can I see completed projects of similar size and style?',
      'What exactly is included — and excluded — in the quote?',
      'Who manages the project day to day, and what is the schedule?',
      'What is the warranty, and how are variations priced?',
    ] },
    { type: 'expert_quote', expertIndex: 0 },
    { type: 'expert_quote', expertIndex: 1 },
    { type: 'cta', title: 'Browse verified Dubai companies', text: 'Compare portfolios and request itemised quotes from verified design-and-build companies.', href: '/companies', ctaLabel: 'Browse companies' },
    { type: 'callout', variant: 'method', text: 'Company counts reflect Tarmeer’s verified network (25 approved company profiles) and wider UAE directory (185) at time of writing.' },
    { type: 'faq', items: [
      { q: 'How many quotes should I get?', a: 'At least three comparable, itemised quotes so you can compare scope line by line — not just headline totals.' },
      { q: 'What is a BOQ?', a: 'A bill of quantities — an itemised breakdown of materials, labour and scope. Insist on one instead of a single lump sum.' },
      { q: 'How do I verify a company?', a: 'Check for a verified profile, real recent portfolio, trade licence, insurance and references from similar projects.' },
      { q: 'What are the biggest red flags?', a: 'Lump-sum-only pricing, large upfront payments, no verifiable portfolio/licence, and suspiciously low quotes.' },
      { q: 'How many verified companies are on Tarmeer?', a: '25 verified design-and-build companies, plus a wider UAE directory of 185.' },
    ] },
    { type: 'source', text: 'Based on Tarmeer’s verified UAE company network. Always verify licence and references directly before signing.' },
  ],
  expertCount: 2,
};

// ── 指南 F：建材买家指南(sourcing,按品类) ──
const buyerGuide = {
  slug: 'dubai-materials-buyer-guide-by-category',
  country: 'ae', category: 'sourcing',
  title: 'Buying Furniture, Marble & Lighting in Dubai — A Category Buyer’s Guide',
  summary: 'A category-by-category buyer’s guide to Dubai building materials: what to check and how each is priced — furniture (per piece/set), stone & tiles (per m²), lighting (per piece), kitchen (per set), flooring (per m²) and more. Tarmeer lists verified suppliers across 9 categories.',
  cover_image: '/images/insights/buyer-cover.webp',
  author_name: 'Tarmeer Editorial',
  seo_title: 'Dubai Materials Buyer’s Guide: Furniture, Marble, Lighting | Tarmeer',
  seo_description: 'What to buy and check per material category in Dubai — furniture, stone, lighting, kitchen, flooring — with pricing units and sourcing tips from verified suppliers.',
  status: 'published',
  body_blocks: [
    { type: 'callout', variant: 'key', title: 'Key takeaways', items: [
      'Every category is priced by unit — per m² (tiles, stone, flooring), per piece (furniture, lighting), per set (kitchen).',
      'Always approve a physical sample before ordering — most suppliers ship samples.',
      'Confirm MOQ, lead time and Incoterms (ex-works / FOB / delivered) in every quote.',
      'Tarmeer lists verified suppliers across 9 categories.',
    ] },
    { type: 'stat_highlight', items: [
      { value: '9', label: 'Material categories' },
      { value: '32', label: 'Verified suppliers' },
      { value: 'By unit', label: 'How materials are priced' },
    ] },
    { type: 'heading', level: 2, text: 'Category-by-category: what to check' },
    { type: 'stat_table', caption: 'Material categories — pricing unit & what to check', columns: ['Category', 'Typical unit', 'What to check'], rows: [
      ['Furniture', 'per piece / set', 'Dimensions, material, upholstery, lead time'],
      ['Stone & tiles', 'per m²', 'Batch/dye lot, thickness, finish, wastage %'],
      ['Lighting', 'per piece', 'Voltage/UAE spec, color temperature, dimmable'],
      ['Kitchen', 'per set / linear m', 'Carcass material, worktop, hardware brand'],
      ['Flooring', 'per m²', 'Wear rating, moisture suitability, underlay'],
      ['Hardware', 'per piece / set', 'Finish durability, load rating, warranty'],
      ['Paint & finishes', 'per bucket / m²', 'Coverage, VOC, sheen, coats needed'],
      ['Plants & landscaping', 'per piece', 'Indoor/outdoor suitability, maintenance'],
    ] },
    { type: 'heading', level: 2, text: 'How materials are priced' },
    { type: 'paragraph', text: 'Compare like for like: a low price per piece can hide a high minimum order quantity (MOQ) or excluded shipping. Ask every supplier for unit price, MOQ, lead time and Incoterms.' },
    { type: 'expert_quote', expertIndex: 0 },
    { type: 'heading', level: 2, text: 'Before you order — per material', collapsed: true },
    { type: 'list', ordered: false, items: [
      'Stone/tiles: order 10% extra for cuts and breakage; confirm the same dye lot.',
      'Furniture/kitchen: confirm exact dimensions against your floor plan.',
      'Lighting/electrical: check UAE voltage and certification.',
      'Everything: approve a physical sample and get the warranty in writing.',
    ] },
    { type: 'cta', title: 'Browse verified material suppliers', text: 'Compare suppliers by category and request itemised quotes.', href: '/materials', ctaLabel: 'Browse suppliers' },
    { type: 'faq', items: [
      { q: 'How is furniture priced in Dubai?', a: 'Per piece or per set. Always confirm dimensions, material and lead time — imported/made-to-order items have longer lead times.' },
      { q: 'How much extra tile should I order?', a: 'Add about 10% for cuts and breakage, and confirm all boxes are the same batch/dye lot for consistent colour.' },
      { q: 'What should I check when buying lighting?', a: 'UAE voltage/spec, color temperature, and whether fixtures are dimmable and certified.' },
      { q: 'Can I see materials before buying?', a: 'Request physical samples — only a few suppliers have a Dubai showroom, so samples are the norm for the rest.' },
      { q: 'What is MOQ?', a: 'Minimum order quantity — the smallest amount a supplier will sell or produce; imported suppliers often have higher MOQs.' },
    ] },
    { type: 'source', text: 'Based on Tarmeer’s verified UAE supplier network (9 categories). Request itemised quotes for current pricing.' },
  ],
  expertCount: 1,
};

// 从库动态取真实审核专家(按认证/经验排序)，引用文字用其真实字段生成 → 本地/生产都准，不写死ID
async function resolveExperts(count) {
  const lim = Math.max(1, Math.min(10, parseInt(count, 10) || 1)); // 内联整数(LIMIT 不能用占位符)
  const [rows] = await db.execute(
    `SELECT id, full_name, experience_years, city, is_certified FROM expert_profiles WHERE status='approved' AND country='ae' ORDER BY is_certified DESC, experience_years DESC, id ASC LIMIT ${lim}`
  );
  return rows.map((e, i) => ({
    expert_ref_id: e.id,
    expert_ref_source: 'experts',
    role_label: `${e.is_certified ? 'Certified ' : ''}Interior Designer${e.city ? ' · ' + e.city : ''}`,
    quote: `Verified Tarmeer expert with ${e.experience_years ? e.experience_years + ' years of ' : ''}interior design experience${e.city ? ' in ' + e.city : ' in the UAE'}.`,
    sort_order: i,
  }));
}

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
  const experts = g.expertCount ? await resolveExperts(g.expertCount) : (g.experts || []);
  for (const e of experts) {
    await db.execute(
      'INSERT INTO guide_expert_quotes (guide_id, expert_ref_id, expert_ref_source, quote, role_label, sort_order) VALUES (?, ?, ?, ?, ?, ?)',
      [guideId, e.expert_ref_id, e.expert_ref_source, e.quote, e.role_label, e.sort_order]
    );
  }
  console.log(`✓ seeded guide #${guideId} ${g.slug} — ${g.body_blocks.length} blocks, ${experts.length} experts`);
}

(async () => {
  for (const g of [costGuide, sourcingGuide, trendGuide, storyGuide, findGuide, buyerGuide]) {
    await seedGuide(g);
  }
  console.log('done');
  process.exit(0);
})().catch((e) => { console.error(e.message); process.exit(1); });
