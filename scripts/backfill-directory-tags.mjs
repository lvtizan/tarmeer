// scripts/backfill-directory-tags.mjs
// 给【目录库】公司(uae_companies.portfolio_images)图片用系统自建 tag-engine(本地 CLIP，免费)打标，
// 写回每张图 ai_category/ai_tags，使 portfolio 房间/风格筛选对目录图(VN 全是目录图)生效。
// tagProjectImages 只覆盖注册库 projects，目录图需要本脚本。
//
// 本地(monorepo 根，server/ 子目录): node scripts/backfill-directory-tags.mjs --country=vn [--apply]
// 服务器(/tarmeer/tarmeer_api 下):    node backfill-directory-tags.mjs --country=vn [--apply]
//   --limit=N  --force(已打标也重打)
// 路径映射同 nginx: /images/ → /tarmeer/tarmeer_web_portal/images/ ; /uploads/ → /tarmeer/tarmeer_api/public/uploads/
import { createRequire } from 'module';
import { pathToFileURL } from 'url';
import fs from 'fs';
import path from 'path';
const require = createRequire(import.meta.url);

// 布局自适应：本地 monorepo 根有 server/dist；服务器在 /tarmeer/tarmeer_api 下，dist 即 ./dist
const API_ROOT = fs.existsSync(path.resolve('server/dist')) ? path.resolve('server') : process.cwd();
const imp = (rel) => import(pathToFileURL(path.join(API_ROOT, rel)).href);

require(path.join(API_ROOT, 'node_modules/dotenv/lib/main.js')).config({ path: path.join(API_ROOT, '.env') });
const { extractTagsFromMetadata } = await imp('dist/services/tagEngine/metadataTagger.js');
const { tagImageWithClip, warmupClip } = await imp('dist/services/tagEngine/onnxTagger.js');
const { mergeTags, toTagStrings } = await imp('dist/services/tagEngine/tagMerger.js');
const mysql = require(path.join(API_ROOT, 'node_modules/mysql2/promise'));
const pool = await mysql.createConnection({
  host: process.env.DB_HOST, user: process.env.DB_USER,
  password: process.env.DB_PASSWORD, database: process.env.DB_NAME,
});

const apply = process.argv.includes('--apply');
const force = process.argv.includes('--force');
const country = (process.argv.find(a => a.startsWith('--country=')) || '--country=vn').split('=')[1];
const LIMIT = parseInt((process.argv.find(a => a.startsWith('--limit=')) || '--limit=1000').split('=')[1], 10);

const DISK = [
  { p: '/images/', d: '/tarmeer/tarmeer_web_portal/images/' },
  { p: '/uploads/', d: '/tarmeer/tarmeer_api/public/uploads/' },
];
const toDisk = (u) => { for (const { p, d } of DISK) if (u.startsWith(p)) return d + u.slice(p.length); return null; };

const stat = { imgs: 0, onDisk: 0, alreadyTagged: 0, tagged: 0 };

async function tagItem(item) {
  if (!item || typeof item !== 'object' || typeof item.url !== 'string') return { item, changed: false };
  stat.imgs++;
  if (Array.isArray(item.ai_category) && item.ai_category.length > 0 && !force) { stat.alreadyTagged++; return { item, changed: false }; }
  const disk = toDisk(item.url);
  const exists = !!(disk && fs.existsSync(disk));
  if (exists) stat.onDisk++;
  if (!apply) return { item, changed: exists }; // dry-run: 不跑 CLIP，只统计磁盘命中
  let clipTags = [];
  if (exists) { try { clipTags = await tagImageWithClip(disk); } catch (e) { console.error('  CLIP error', item.url, e.message); } }
  const metaTags = extractTagsFromMetadata({ style: '', description: '', categoryNames: item.category ? [String(item.category)] : [] });
  const ai_category = toTagStrings(mergeTags(metaTags, clipTags));
  stat.tagged++;
  return { item: { ...item, ai_tags: clipTags.map(r => r.tag), ai_category, ai_tagged_at: new Date().toISOString() }, changed: true };
}

// 兼容 VN 扁平数组 [{url,category}] 与 AE 对象 {cat:[{url}]|{items:[...]}}
async function tagPortfolio(parsed) {
  let changed = false;
  if (Array.isArray(parsed)) {
    const out = [];
    for (const it of parsed) { const r = await tagItem(it); out.push(r.item); changed = changed || r.changed; }
    return { value: out, changed };
  }
  if (parsed && typeof parsed === 'object') {
    const out = {};
    for (const [cat, entry] of Object.entries(parsed)) {
      const items = Array.isArray(entry) ? entry : (entry && Array.isArray(entry.items) ? entry.items : null);
      if (!items) { out[cat] = entry; continue; }
      const tagged = [];
      for (const it of items) { const r = await tagItem({ category: cat, ...it }); tagged.push(r.item); changed = changed || r.changed; }
      out[cat] = Array.isArray(entry) ? tagged : { ...entry, items: tagged };
    }
    return { value: out, changed };
  }
  return { value: parsed, changed: false };
}

(async () => {
  console.log(`[dir-tag] API_ROOT=${API_ROOT} country=${country} apply=${apply} force=${force} limit=${LIMIT}`);
  if (apply) { process.stdout.write('[dir-tag] warming CLIP... '); await warmupClip(); console.log('ready'); }
  const [rows] = await pool.execute(
    `SELECT id, name_en, portfolio_images FROM uae_companies
     WHERE is_active = 1 AND country = ? AND portfolio_images IS NOT NULL
       AND portfolio_images != '[]' AND portfolio_images != '' LIMIT ${Number(LIMIT)}`, [country]);
  console.log(`[dir-tag] 目录公司: ${rows.length}`);
  let companiesChanged = 0;
  for (const row of rows) {
    let parsed; try { parsed = typeof row.portfolio_images === 'string' ? JSON.parse(row.portfolio_images) : row.portfolio_images; } catch { continue; }
    const { value, changed } = await tagPortfolio(parsed);
    if (!changed) continue;
    companiesChanged++;
    if (apply) { await pool.execute('UPDATE uae_companies SET portfolio_images = ? WHERE id = ?', [JSON.stringify(value), row.id]); console.log(`  tagged #${row.id} ${row.name_en}`); }
  }
  console.log(`[dir-tag] ${apply ? 'DONE' : 'DRY-RUN'} — 公司涉及=${companiesChanged} | 图片=${stat.imgs} 磁盘命中=${stat.onDisk} 已打标=${stat.alreadyTagged} 本次打标=${stat.tagged}`);
  if (!apply) console.log('[dir-tag] 加 --apply 实际跑 CLIP 写库');
  await pool.end();
})().catch(e => { console.error('[dir-tag] FATAL', e); process.exit(1); });
