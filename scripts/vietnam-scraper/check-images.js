/**
 * VN Company Image Checker
 * 检查越南公司 portfolio_images 中的外链是否可访问，
 * 删除失效 URL，直接更新数据库。
 *
 * 用法: node scripts/vietnam-scraper/check-images.js
 * 可选: node scripts/vietnam-scraper/check-images.js --dry-run   (只检查不修改)
 */

const mysql = require('../../server/node_modules/mysql2/promise');
const path = require('path');
require('../../server/node_modules/dotenv').config({ path: path.join(__dirname, '../../server/.env') });

const DRY_RUN = process.argv.includes('--dry-run');
const CONCURRENCY = 10;        // 并发检查数
const TIMEOUT_MS = 8000;       // 每张图超时 8s
const BATCH_SIZE = 5;          // 每次更新几家公司

async function checkUrl(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: 'HEAD',
      signal: controller.signal,
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Tarmeer-ImageChecker/1.0)' },
      redirect: 'follow',
    });
    clearTimeout(timer);
    return res.ok; // 200-299
  } catch {
    clearTimeout(timer);
    return false;
  }
}

async function checkBatch(urls) {
  // 分批并发，每批 CONCURRENCY 个
  const results = new Map();
  for (let i = 0; i < urls.length; i += CONCURRENCY) {
    const batch = urls.slice(i, i + CONCURRENCY);
    const checks = await Promise.all(batch.map(async (url) => [url, await checkUrl(url)]));
    checks.forEach(([url, ok]) => results.set(url, ok));
  }
  return results;
}

async function main() {
  const pool = await mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: process.env.DB_PORT || 3306,
  });

  console.log(`[image-checker] DRY_RUN=${DRY_RUN}, CONCURRENCY=${CONCURRENCY}, TIMEOUT=${TIMEOUT_MS}ms`);

  const [companies] = await pool.execute(
    'SELECT id, slug, portfolio_images FROM uae_companies WHERE country = "vn" AND portfolio_images IS NOT NULL AND portfolio_images != "[]" AND portfolio_images != ""'
  );

  console.log(`[image-checker] Found ${companies.length} VN companies to check`);

  let totalChecked = 0, totalRemoved = 0, totalUpdated = 0;

  for (let i = 0; i < companies.length; i += BATCH_SIZE) {
    const batch = companies.slice(i, i + BATCH_SIZE);

    for (const company of batch) {
      let images;
      try {
        const raw = company.portfolio_images;
        // mysql2 returns JSON columns already parsed; handle both string and object
        images = Array.isArray(raw) ? raw : JSON.parse(typeof raw === 'string' ? raw : JSON.stringify(raw));
      } catch {
        console.warn(`  [${company.slug}] JSON parse error, skipping`);
        continue;
      }

      if (!Array.isArray(images) || images.length === 0) continue;

      // 提取所有 URL（兼容字符串和 {url, category} 两种格式）
      const urlMap = new Map(); // url → original item
      for (const item of images) {
        const url = typeof item === 'string' ? item : (item && item.url);
        if (url) urlMap.set(url, item);
      }

      const urls = [...urlMap.keys()];
      totalChecked += urls.length;

      process.stdout.write(`  [${company.slug}] checking ${urls.length} images... `);
      const results = await checkBatch(urls);

      const badUrls = [...results.entries()].filter(([, ok]) => !ok).map(([url]) => url);
      if (badUrls.length === 0) {
        console.log(`all ok`);
        continue;
      }

      console.log(`${badUrls.length} broken: ${badUrls.slice(0, 2).map(u => u.slice(0, 60)).join(', ')}...`);
      totalRemoved += badUrls.length;

      if (DRY_RUN) continue;

      // 过滤掉失效 URL，保留有效的
      const badSet = new Set(badUrls);
      const cleaned = images.filter((item) => {
        const url = typeof item === 'string' ? item : (item && item.url);
        return url && !badSet.has(url);
      });

      await pool.execute(
        'UPDATE uae_companies SET portfolio_images = ?, updated_at = NOW() WHERE id = ?',
        [JSON.stringify(cleaned), company.id]
      );
      totalUpdated++;
    }
  }

  console.log(`\n[image-checker] Done`);
  console.log(`  Checked: ${totalChecked} URLs across ${companies.length} companies`);
  console.log(`  Broken:  ${totalRemoved} URLs removed`);
  if (!DRY_RUN) console.log(`  Updated: ${totalUpdated} companies`);

  await pool.end();
}

main().catch((e) => { console.error(e); process.exit(1); });
