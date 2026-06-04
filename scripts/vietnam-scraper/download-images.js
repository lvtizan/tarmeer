/**
 * VN Company Image Downloader
 * 下载越南公司外链图片到本地 public/images/vn-companies/portfolio/[slug]/
 * 并将数据库中的外链替换为本地路径。
 *
 * 用法:
 *   node scripts/vietnam-scraper/download-images.js             # 全量下载
 *   node scripts/vietnam-scraper/download-images.js --dry-run   # 只检查不下载
 *   node scripts/vietnam-scraper/download-images.js --slug vn-aa-corporation  # 单个公司
 */

const mysql = require('../../server/node_modules/mysql2/promise');
const path = require('path');
const fs = require('fs');
const https = require('https');
const http = require('http');
require('../../server/node_modules/dotenv').config({ path: path.join(__dirname, '../../server/.env') });

const DRY_RUN = process.argv.includes('--dry-run');
const SLUG_FILTER = (() => { const i = process.argv.indexOf('--slug'); return i !== -1 ? process.argv[i + 1] : null; })();
const CONCURRENCY = 5;
const TIMEOUT_MS = 15000;
const MAX_IMAGES = 20;   // 每个公司最多保留多少张
const IMG_DIR = path.join(__dirname, '../../public/images/vn-companies/portfolio');

function slugifyFilename(url, idx, ext) {
  return `${String(idx + 1).padStart(2, '0')}${ext}`;
}

function getExtFromUrl(url, contentType) {
  // 优先用 Content-Type
  if (contentType) {
    if (contentType.includes('jpeg') || contentType.includes('jpg')) return '.jpg';
    if (contentType.includes('png')) return '.png';
    if (contentType.includes('webp')) return '.webp';
    if (contentType.includes('gif')) return '.gif';
  }
  const m = url.match(/\.(jpe?g|png|webp|gif|avif)(\?|$)/i);
  return m ? `.${m[1].toLowerCase().replace('jpeg', 'jpg')}` : '.jpg';
}

function downloadFile(url, destPath) {
  return new Promise((resolve, reject) => {
    const proto = url.startsWith('https') ? https : http;
    const req = proto.get(url, {
      timeout: TIMEOUT_MS,
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Tarmeer-Bot/1.0)' },
    }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        // Follow redirect once
        return downloadFile(res.headers.location, destPath).then(resolve).catch(reject);
      }
      if (res.statusCode !== 200) {
        res.resume();
        return reject(new Error(`HTTP ${res.statusCode}`));
      }
      const contentType = res.headers['content-type'] || '';
      if (!contentType.startsWith('image/')) {
        res.resume();
        return reject(new Error(`Not an image: ${contentType}`));
      }
      // Rewrite ext based on actual content-type
      const ext = getExtFromUrl(url, contentType);
      const finalPath = destPath.replace(/\.[^.]+$/, ext);
      const file = fs.createWriteStream(finalPath);
      res.pipe(file);
      file.on('finish', () => file.close(() => resolve({ path: finalPath, ext })));
      file.on('error', (err) => { fs.unlink(finalPath, () => {}); reject(err); });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
  });
}

async function processCompany(pool, company) {
  const raw = company.portfolio_images;
  let images = Array.isArray(raw) ? raw : (() => { try { return JSON.parse(raw); } catch { return []; } })();
  if (!Array.isArray(images) || images.length === 0) return { skipped: true };

  // Deduplicate, skip already-local paths and data: URIs, cap at MAX_IMAGES
  const seen = new Set();
  const deduped = [];
  for (const item of images) {
    const url = typeof item === 'string' ? item : item?.url;
    if (!url || seen.has(url)) continue;
    if (url.startsWith('/images/vn-companies/')) continue; // already local
    if (url.startsWith('data:')) continue;                 // inline SVG noise
    seen.add(url);
    deduped.push({ url, category: item?.category || 'Portfolio' });
  }
  if (deduped.length === 0) return { skipped: true };
  const toDownload = deduped.slice(0, MAX_IMAGES);

  const companyDir = path.join(IMG_DIR, company.slug);
  if (!DRY_RUN) fs.mkdirSync(companyDir, { recursive: true });

  const downloaded = [];
  const failed = [];

  // Download in batches of CONCURRENCY
  for (let i = 0; i < toDownload.length; i += CONCURRENCY) {
    const batch = toDownload.slice(i, i + CONCURRENCY);
    await Promise.all(batch.map(async (item, batchIdx) => {
      const idx = i + batchIdx;
      const tmpPath = path.join(companyDir, `${String(idx + 1).padStart(2, '0')}.jpg`);
      if (DRY_RUN) {
        downloaded.push({ localUrl: `/images/vn-companies/portfolio/${company.slug}/${String(idx + 1).padStart(2, '0')}.jpg`, category: item.category });
        return;
      }
      try {
        const { path: finalPath } = await downloadFile(item.url, tmpPath);
        const filename = path.basename(finalPath);
        downloaded.push({ localUrl: `/images/vn-companies/portfolio/${company.slug}/${filename}`, category: item.category });
      } catch (err) {
        failed.push({ url: item.url, error: err.message });
      }
    }));
  }

  if (!DRY_RUN && downloaded.length > 0) {
    // Build new portfolio_images as flat array of {url, category} with local paths
    const newImages = downloaded.map(d => ({ url: d.localUrl, category: d.category }));
    await pool.execute(
      'UPDATE uae_companies SET portfolio_images = ?, updated_at = NOW() WHERE id = ?',
      [JSON.stringify(newImages), company.id]
    );
  }

  return { downloaded: downloaded.length, failed: failed.length, failedUrls: failed };
}

async function main() {
  const pool = await mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: process.env.DB_PORT || 3306,
  });

  console.log(`[download-images] DRY_RUN=${DRY_RUN}, CONCURRENCY=${CONCURRENCY}, MAX_IMAGES=${MAX_IMAGES}`);
  if (SLUG_FILTER) console.log(`[download-images] Filtering to slug: ${SLUG_FILTER}`);

  let query = 'SELECT id, slug, portfolio_images FROM uae_companies WHERE country = "vn" AND portfolio_images IS NOT NULL';
  const params = [];
  if (SLUG_FILTER) { query += ' AND slug = ?'; params.push(SLUG_FILTER); }

  const [companies] = await pool.execute(query, params);
  console.log(`[download-images] Processing ${companies.length} companies\n`);

  let totalDownloaded = 0, totalFailed = 0, totalUpdated = 0;

  for (const company of companies) {
    process.stdout.write(`  [${company.slug}] `);
    const result = await processCompany(pool, company);
    if (result.skipped) { console.log('skipped (no images)'); continue; }
    console.log(`✓ ${result.downloaded} downloaded, ${result.failed} failed`);
    if (result.failedUrls?.length) {
      result.failedUrls.slice(0, 2).forEach(f => console.log(`    ✗ ${f.url.slice(0, 70)} → ${f.error}`));
    }
    totalDownloaded += result.downloaded;
    totalFailed += result.failed;
    if (result.downloaded > 0) totalUpdated++;
  }

  console.log(`\n[download-images] Done`);
  console.log(`  Downloaded: ${totalDownloaded} images`);
  console.log(`  Failed:     ${totalFailed} images`);
  if (!DRY_RUN) console.log(`  Updated:    ${totalUpdated} companies in DB`);

  await pool.end();
}

main().catch((e) => { console.error(e); process.exit(1); });
