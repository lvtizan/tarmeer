// 把 10 个越南专家的 services 对齐到权威服务分类（/api/public/service-categories 的 subs）
// 让导航下拉/筛选侧栏点进去能匹配到专家（之前用自编值导致 0 结果）
// 运行：cd server && NODE_PATH="$(pwd)/node_modules" node ../scripts/update-vn-expert-services.js

require('dotenv').config();
const mysql = require('mysql2/promise');

// slug → services（取自真实 service-categories subs）
const SERVICES = {
  'nguyen-van-an':  ['Interior Design', 'Architecture & Interior Design', 'Interior Design & Build'],
  'tran-thi-bich':  ['Full Renovation', 'Interior Fit-out Execution', 'General Contracting'],
  'le-hoang-nam':   ['Interior Fit-out Execution', 'Internal Doors & Windows', 'Flooring & Wall'],
  'pham-minh-tuan': ['Smart Home & Automation', 'Security & Networking'],
  'vu-quoc-khanh':  ['Waterproofing & Insulation', 'MEP & Technical Drawings'],
  'dang-thi-huong': ['Flooring & Wall', 'Partial Renovation'],
  'bui-thanh-son':  ['Flooring & Wall', 'Bathroom Remodeling'],
  'hoang-van-dung': ['Internal Doors & Windows', 'Fence & Driveway'],
  'ngo-thi-lan':    ['Ceiling & Lighting', 'Interior Design'],
  'do-huu-phuoc':   ['Landscaping & Irrigation', 'Landscape & Outdoor Design', 'Pool & Water Features'],
};

async function main() {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST, user: process.env.DB_USER,
    password: process.env.DB_PASSWORD, database: process.env.DB_NAME,
  });
  console.log(`[update-expert-services] DB=${process.env.DB_HOST}/${process.env.DB_NAME}`);
  let updated = 0;
  for (const [slug, services] of Object.entries(SERVICES)) {
    const [res] = await conn.execute(
      `UPDATE expert_profiles SET services = ? WHERE slug = ? AND country = 'vn'`,
      [JSON.stringify(services), slug]
    );
    if (res.affectedRows > 0) { console.log(`  ✓ ${slug}: ${services.join(', ')}`); updated++; }
    else console.log(`  ! not found: ${slug}`);
  }
  console.log(`[update-expert-services] done. updated=${updated}`);
  await conn.end();
}

main().catch(e => { console.error('[update-expert-services] error:', e.message); process.exit(1); });
