// Seed insights/guides — 用平台真实数据写的指南入库（幂等：按 slug+country 先删后插）。
// 用法：先 source server/.env（DB 连接），再 node scripts/seed-guides.mjs
import { createRequire } from 'node:module';
const require = createRequire(process.cwd() + '/x.js');
const db = require(process.cwd() + '/server/dist/config/database').default;

// ── 指南 A：装修成本（数据来自 191 个真实 published 项目聚合）──
const costGuide = {
  slug: 'dubai-renovation-cost-guide-2026',
  country: 'ae',
  category: 'cost',
  title: 'Dubai Renovation Cost Guide 2026 — Real Cost per m² by Style',
  summary:
    'Interior renovation in Dubai costs roughly AED 1,475–2,006 per square meter — a median of about AED 1,800/m² — based on 191 real completed projects on Tarmeer. Modern Arabic and Luxury Modern styles trend higher; soft-minimal styles sit lower. Below are real cost ranges by design style, what drives the price up or down, and a verified expert reference.',
  cover_image: '/images/insights/cost-cover.webp',
  author_name: 'Tarmeer Editorial',
  seo_title: 'Dubai Renovation Cost 2026: Real AED/m² by Style | Tarmeer',
  seo_description:
    'How much does interior renovation cost in Dubai? Real cost per m² by design style, from 191 completed Tarmeer projects, plus the main cost drivers and FAQs.',
  status: 'published',
  body_blocks: [
    { type: 'heading', level: 2, text: 'How much does renovation cost per m² in Dubai?' },
    { type: 'paragraph', text: 'Across 191 real completed interior projects on Tarmeer, renovation in Dubai typically runs about AED 1,475–2,006 per square meter, clustering around a median of AED 1,800/m². The spread is driven mainly by design style, finish level, and how much structural or MEP (electrical and plumbing) work is involved.' },
    { type: 'stat_table', caption: 'Average cost by design style — AED per m² (real Tarmeer projects)', columns: ['Design style', 'Projects', 'Cost range (AED/m²)'], rows: [
      ['Modern Arabic', '12', '1,643 – 1,929'],
      ['Modern Renovation', '8', '1,749 – 1,925'],
      ['Luxury Modern', '8', '1,693 – 1,877'],
      ['Minimalist', '8', '1,619 – 1,807'],
      ['Boutique Luxury', '8', '1,589 – 1,776'],
      ['Soft Minimal', '8', '1,518 – 1,695'],
    ] },
    { type: 'image', url: '/images/insights/cost-scene.webp', alt: 'Interior renovation material samples, swatches and a floor plan', caption: 'Finish selection and project scope are the biggest cost drivers.' },
    { type: 'heading', level: 2, text: 'What drives the cost up or down?' },
    { type: 'list', ordered: false, title: 'Main cost drivers', items: [
      'Scope — structural changes and MEP rework (moving walls, electrical, plumbing) add the most.',
      'Finishes — marble, custom joinery and imported fixtures push cost toward the top of the range.',
      'Style — Modern Arabic and Luxury Modern trend higher; soft-minimal schemes sit lower.',
      'Area & layout — larger or open-plan layouts change the per-m² economics.',
      'Timeline — compressed schedules and phased works raise labour cost.',
    ] },
    { type: 'expert_quote', expertIndex: 0 },
    { type: 'faq', items: [
      { q: 'How much to renovate a 150 m² apartment in Dubai?', a: 'At the median of ~AED 1,800/m², a 150 m² apartment is roughly AED 270,000 for fit-out and finishes. Higher-end Modern Arabic or Luxury Modern schemes can reach ~AED 290,000+; soft-minimal schemes can come in lower.' },
      { q: 'Which design style is most expensive?', a: 'Among real Tarmeer projects, Modern Arabic and Luxury Modern carry the highest per-m² ranges, largely due to bespoke detailing and premium finishes.' },
      { q: 'Does the price include furniture?', a: 'These figures cover fit-out and finishes. Loose furniture, appliances and décor are usually quoted separately.' },
    ] },
    { type: 'source', text: 'Figures derived from 191 real completed projects published on Tarmeer (UAE), aggregated by cost per square meter and design style. Individual quotes vary — request a tailored quote from a verified company on Tarmeer.' },
  ],
  experts: [
    // 诚信：只放可核实事实(认证/经验/城市/链接)，非捏造个人引文。真引文以后收集到再替换 quote。
    { expert_ref_id: 5, expert_ref_source: 'experts', role_label: 'Certified Interior Designer · Dubai · 12 yrs', quote: 'Verified Tarmeer expert — 12 years of high-end residential interior design experience in Dubai.', sort_order: 0 },
  ],
};

async function seedGuide(g) {
  // 幂等：删旧（含其专家引用）
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
  console.log(`✓ seeded guide #${guideId} ${g.slug} (${(g.experts || []).length} expert refs)`);
}

(async () => {
  await seedGuide(costGuide);
  console.log('done');
  process.exit(0);
})().catch(e => { console.error(e.message); process.exit(1); });
