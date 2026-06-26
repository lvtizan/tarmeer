// scripts/detect-nonportfolio-images.mjs
// 用本地 CLIP(Xenova/clip-vit-base-patch32, 免费)判别目录库(uae_companies.portfolio_images)里的
// 非作品集图(人物/团队合照/模特/客服 stock 图等),dry-run 列出,--apply 从 portfolio_images 移除。
//
// 服务器跑: cd /tarmeer/tarmeer_api && node detect-nonportfolio-images.mjs --country=vn [--apply] [--threshold=0.55] [--limit=N]
// 判别: 一次 zero-shot 把图分到 室内类 vs 人物类 prompt,人物类 softmax 总分 >= threshold 且 > 室内类 → 标记移除。
import { createRequire } from 'module';
import { pathToFileURL } from 'url';
import fs from 'fs';
import path from 'path';
const require = createRequire(import.meta.url);
const API_ROOT = fs.existsSync(path.resolve('server/dist')) ? path.resolve('server') : process.cwd();
require(path.join(API_ROOT, 'node_modules/dotenv/lib/main.js')).config({ path: path.join(API_ROOT, '.env') });
const { pipeline, env } = require(path.join(API_ROOT, 'node_modules/@xenova/transformers'));
env.cacheDir = path.join(API_ROOT, '.model-cache'); // 同 onnxTagger，复用已下载模型(/tarmeer/tarmeer_api/.model-cache)
const mysql = require(path.join(API_ROOT, 'node_modules/mysql2/promise'));

const apply = process.argv.includes('--apply');
const country = (process.argv.find(a => a.startsWith('--country=')) || '--country=vn').split('=')[1];
const THRESHOLD = parseFloat((process.argv.find(a => a.startsWith('--threshold=')) || '--threshold=0.55').split('=')[1]);
const LIMIT = parseInt((process.argv.find(a => a.startsWith('--limit=')) || '--limit=2000').split('=')[1], 10);

// 候选标签：前 5 个=作品集(保留)，后 6 个=非作品集(删除)
const KEEP_PROMPTS = [
  'a photo of an interior room',
  'a photo of furniture in a room',
  'a photo of a house exterior or building',
  'a photo of a kitchen, living room or bedroom',
  'an architectural interior design photo',
];
const DROP_PROMPTS = [
  'a portrait photo of a person',
  'a group photo of many people posing',
  'a studio photo of a fashion model',
  'a photo of a person wearing a headset',
  'a selfie or photo of people smiling',
  'a team photo of a company staff',
];
const ALL = [...KEEP_PROMPTS, ...DROP_PROMPTS];
const DROP_SET = new Set(DROP_PROMPTS);

const DISK = [
  { p: '/images/', d: '/tarmeer/tarmeer_web_portal/images/' },
  { p: '/uploads/', d: '/tarmeer/tarmeer_api/public/uploads/' },
];
const toDisk = (u) => { for (const { p, d } of DISK) if (u.startsWith(p)) return d + u.slice(p.length); return null; };

let cls;
async function dropScore(absPath) {
  const scores = await cls(absPath, ALL); // softmax over ALL
  let drop = 0, keep = 0;
  for (const s of scores) { if (DROP_SET.has(s.label)) drop += s.score; else keep += s.score; }
  return { drop, keep };
}

const flagged = []; // {company, url, drop, keep}
let scanned = 0;

async function processItems(items, companyName) {
  const kept = [];
  for (const it of items) {
    if (!it || typeof it !== 'object' || typeof it.url !== 'string') { kept.push(it); continue; }
    const disk = toDisk(it.url);
    if (!disk || !fs.existsSync(disk)) { kept.push(it); continue; }
    scanned++;
    let r; try { r = await dropScore(disk); } catch (e) { console.error('  err', it.url, e.message); kept.push(it); continue; }
    if (r.drop >= THRESHOLD && r.drop > r.keep) {
      flagged.push({ company: companyName, url: it.url, drop: +r.drop.toFixed(2), keep: +r.keep.toFixed(2) });
      // apply 时不 push 进 kept = 删除
      if (!apply) kept.push(it);
    } else kept.push(it);
  }
  return kept;
}

async function processPortfolio(parsed, companyName) {
  if (Array.isArray(parsed)) return await processItems(parsed, companyName);
  if (parsed && typeof parsed === 'object') {
    const out = {};
    for (const [cat, entry] of Object.entries(parsed)) {
      const items = Array.isArray(entry) ? entry : (entry && Array.isArray(entry.items) ? entry.items : null);
      if (!items) { out[cat] = entry; continue; }
      const kept = await processItems(items.map(it => ({ category: cat, ...it })), companyName);
      out[cat] = Array.isArray(entry) ? kept : { ...entry, items: kept };
    }
    return out;
  }
  return parsed;
}

(async () => {
  console.log(`[detect] country=${country} apply=${apply} threshold=${THRESHOLD}`);
  process.stdout.write('[detect] loading CLIP... '); cls = await pipeline('zero-shot-image-classification', 'Xenova/clip-vit-base-patch32'); console.log('ready');
  const pool = await mysql.createConnection({ host: process.env.DB_HOST, user: process.env.DB_USER, password: process.env.DB_PASSWORD, database: process.env.DB_NAME });
  const [rows] = await pool.execute(
    `SELECT id, name_en, portfolio_images FROM uae_companies WHERE is_active=1 AND country=? AND portfolio_images IS NOT NULL AND portfolio_images!='[]' AND portfolio_images!='' LIMIT ${Number(LIMIT)}`, [country]);
  for (const row of rows) {
    let parsed; try { parsed = typeof row.portfolio_images === 'string' ? JSON.parse(row.portfolio_images) : row.portfolio_images; } catch { continue; }
    const before = JSON.stringify(parsed);
    const out = await processPortfolio(parsed, row.name_en);
    if (apply && JSON.stringify(out) !== before) {
      await pool.execute('UPDATE uae_companies SET portfolio_images=? WHERE id=?', [JSON.stringify(out), row.id]);
    }
  }
  console.log(`\n[detect] 扫描 ${scanned} 张 | 标记非作品集 ${flagged.length} 张 (threshold=${THRESHOLD})`);
  flagged.sort((a, b) => b.drop - a.drop).slice(0, 60).forEach(f => console.log(`  drop=${f.drop} keep=${f.keep}  ${f.url}  [${f.company}]`));
  if (apply) console.log(`[detect] APPLIED — 已从 portfolio_images 移除 ${flagged.length} 张`);
  else console.log('[detect] DRY-RUN — 加 --apply 实际移除');
  await pool.end();
})().catch(e => { console.error('[detect] FATAL', e); process.exit(1); });
