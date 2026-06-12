// 算法删除低质量专家：分析每个专家封面图（首个项目首图），
// 封面「最小边 < 400px」或「图像熵 < 6.0」或「无封面/读不到」= 低质量 → 删除该专家。
// 默认 dry-run 只列名单；加 --apply 才真正删除（删 projects + expert_profiles + users）。
//
// 本地：cd server && NODE_PATH="$(pwd)/node_modules" node ../scripts/prune-low-quality-experts.js
// 生产：cd /tarmeer/tarmeer_api && IMG_ROOT=/tarmeer/tarmeer_web_portal NODE_PATH=$(pwd)/node_modules node /tmp/prune-low-quality-experts.js --apply

require('dotenv').config();
const mysql = require('mysql2/promise');
const sharp = require('sharp');
const path = require('path');

const IMG_ROOT = process.env.IMG_ROOT || path.join(__dirname, '..', 'public');
const APPLY = process.argv.includes('--apply');
const MIN_DIM = 400;       // 最小边像素阈值
const MIN_ENTROPY = 6.0;   // 图像熵阈值（空白/广告横幅熵低）

async function coverQuality(url) {
  if (!url) return { low: true, reason: 'no-cover' };
  const file = path.join(IMG_ROOT, String(url).replace(/^\//, ''));
  try {
    const img = sharp(file);
    const [st, meta] = await Promise.all([img.stats(), img.metadata()]);
    const minDim = Math.min(meta.width || 0, meta.height || 0);
    const low = minDim < MIN_DIM || st.entropy < MIN_ENTROPY;
    return { low, minDim, entropy: +st.entropy.toFixed(2), reason: low ? (minDim < MIN_DIM ? `minDim ${minDim}<${MIN_DIM}` : `entropy ${st.entropy.toFixed(2)}<${MIN_ENTROPY}`) : 'ok' };
  } catch (e) {
    return { low: true, reason: 'unreadable: ' + e.message };
  }
}

async function main() {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST, user: process.env.DB_USER,
    password: process.env.DB_PASSWORD, database: process.env.DB_NAME,
  });
  console.log(`[prune-experts] DB=${process.env.DB_HOST}/${process.env.DB_NAME} IMG_ROOT=${IMG_ROOT} APPLY=${APPLY}`);

  const [experts] = await conn.execute(
    `SELECT id, slug, user_id, full_name FROM expert_profiles WHERE country = 'vn'`
  );
  const lowList = [];
  for (const ex of experts) {
    const [projs] = await conn.execute(
      `SELECT images FROM projects WHERE expert_profile_id = ? AND status = 'published' ORDER BY created_at ASC LIMIT 1`,
      [ex.id]
    );
    let cover = null;
    if (projs.length) {
      let imgs = projs[0].images;
      try { imgs = typeof imgs === 'string' ? JSON.parse(imgs) : (imgs || []); } catch { imgs = []; }
      cover = Array.isArray(imgs) && imgs.length ? imgs[0] : null;
    }
    const q = await coverQuality(cover);
    console.log(`  ${q.low ? '✗ LOW ' : '✓ keep'} ${ex.slug.padEnd(16)} ${q.reason}`);
    if (q.low) lowList.push(ex);
  }

  console.log(`\n[prune-experts] low-quality=${lowList.length}/${experts.length}: ${lowList.map(e => e.slug).join(', ') || '(none)'}`);

  if (!APPLY) {
    console.log('[prune-experts] dry-run（未删除）。确认后加 --apply 执行删除。');
    await conn.end();
    return;
  }

  for (const ex of lowList) {
    await conn.execute(`DELETE FROM projects WHERE expert_profile_id = ?`, [ex.id]);
    await conn.execute(`DELETE FROM expert_profiles WHERE id = ?`, [ex.id]);
    if (ex.user_id) await conn.execute(`DELETE FROM users WHERE id = ?`, [ex.user_id]);
    console.log(`  - deleted ${ex.slug} (user_id=${ex.user_id})`);
  }
  const [[cnt]] = await conn.query("SELECT COUNT(*) AS n FROM expert_profiles WHERE country='vn'");
  console.log(`[prune-experts] done. deleted=${lowList.length} | VN experts left=${cnt.n}`);
  await conn.end();
}

main().catch(e => { console.error('[prune-experts] error:', e.message); process.exit(1); });
