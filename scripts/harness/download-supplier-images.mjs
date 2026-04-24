/**
 * download-supplier-images.mjs
 * Downloads all external image URLs from supplier tables to /public/images/suppliers/
 * and updates DB records to use local paths.
 *
 * Usage: node scripts/harness/download-supplier-images.mjs [--apply]
 *   --apply  Actually download and update DB (default: dry-run)
 */

import fs from 'fs';
import path from 'path';
import https from 'https';
import http from 'http';
import crypto from 'crypto';
import { createConnection } from 'mysql2/promise';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../..');
const PUBLIC_DIR = path.join(ROOT, 'public', 'images', 'suppliers');
const APPLY = process.argv.includes('--apply');

const DB_CONFIG = {
  host: 'localhost',
  port: 3306,
  user: 'root',
  database: 'tarmeer',
  multipleStatements: false,
};

function isExternal(url) {
  return url && (url.startsWith('http://') || url.startsWith('https://'));
}

function urlToLocalPath(url, dir) {
  // Use a hash of the URL for the filename to avoid collisions
  const hash = crypto.createHash('md5').update(url).digest('hex').slice(0, 8);
  // Try to detect extension from URL
  const extMatch = url.match(/\.(jpg|jpeg|png|webp|gif)(\?|$)/i);
  const ext = extMatch ? `.${extMatch[1].toLowerCase()}` : '.jpg';
  return path.join(dir, `${hash}${ext}`);
}

function download(url, dest) {
  return new Promise((resolve, reject) => {
    const proto = url.startsWith('https') ? https : http;
    const file = fs.createWriteStream(dest);
    const request = proto.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        file.close();
        fs.unlinkSync(dest);
        return download(res.headers.location, dest).then(resolve).catch(reject);
      }
      if (res.statusCode !== 200) {
        file.close();
        fs.unlinkSync(dest);
        return reject(new Error(`HTTP ${res.statusCode} for ${url}`));
      }
      res.pipe(file);
      file.on('finish', () => file.close(resolve));
    });
    request.on('error', (err) => {
      file.close();
      if (fs.existsSync(dest)) fs.unlinkSync(dest);
      reject(err);
    });
    request.setTimeout(15000, () => {
      request.destroy();
      file.close();
      if (fs.existsSync(dest)) fs.unlinkSync(dest);
      reject(new Error(`Timeout: ${url}`));
    });
  });
}

async function processImageUrl(url, slugDir, label) {
  if (!isExternal(url)) return url; // already local
  const destPath = urlToLocalPath(url, slugDir);
  const localUrl = '/images/suppliers/' + path.relative(PUBLIC_DIR, destPath).replace(/\\/g, '/');

  if (fs.existsSync(destPath)) {
    console.log(`  [skip] ${label}: already exists`);
    return localUrl;
  }

  if (!APPLY) {
    console.log(`  [dry-run] ${label}: ${url} → ${localUrl}`);
    return localUrl;
  }

  try {
    await download(url, destPath);
    console.log(`  [ok] ${label}: ${url} → ${localUrl}`);
    return localUrl;
  } catch (err) {
    console.warn(`  [fail] ${label}: ${err.message}`);
    return url; // keep original on failure
  }
}

async function main() {
  console.log(`Mode: ${APPLY ? 'APPLY' : 'DRY-RUN'}\n`);

  const conn = await createConnection(DB_CONFIG);

  // Ensure base dir exists
  if (APPLY) fs.mkdirSync(PUBLIC_DIR, { recursive: true });

  // ── 1. supplier_profiles ──────────────────────────────────────────────────
  const [profiles] = await conn.execute(
    `SELECT id, slug, logo_url, cover_image_url FROM supplier_profiles WHERE status='approved'`
  );

  console.log(`Found ${profiles.length} approved supplier profiles\n`);

  for (const p of profiles) {
    console.log(`[supplier] ${p.slug}`);
    const slugDir = path.join(PUBLIC_DIR, p.slug);
    if (APPLY) fs.mkdirSync(slugDir, { recursive: true });

    const newLogo = await processImageUrl(p.logo_url, slugDir, 'logo');
    const newCover = await processImageUrl(p.cover_image_url, slugDir, 'cover');

    if (APPLY && (newLogo !== p.logo_url || newCover !== p.cover_image_url)) {
      await conn.execute(
        `UPDATE supplier_profiles SET logo_url=?, cover_image_url=? WHERE id=?`,
        [newLogo || p.logo_url, newCover || p.cover_image_url, p.id]
      );
    }
  }

  // ── 2. supplier_products ──────────────────────────────────────────────────
  console.log('\n--- supplier_products ---');
  const [products] = await conn.execute(
    `SELECT sp.id, sp.image_url, pr.slug
     FROM supplier_products sp
     JOIN supplier_profiles pr ON pr.id = sp.supplier_profile_id
     WHERE pr.status='approved' AND sp.image_url IS NOT NULL`
  );

  console.log(`Found ${products.length} product images`);

  for (const prod of products) {
    const slugDir = path.join(PUBLIC_DIR, prod.slug);
    if (APPLY) fs.mkdirSync(slugDir, { recursive: true });
    const newUrl = await processImageUrl(prod.image_url, slugDir, `product#${prod.id}`);
    if (APPLY && newUrl !== prod.image_url) {
      await conn.execute(`UPDATE supplier_products SET image_url=? WHERE id=?`, [newUrl, prod.id]);
    }
  }

  // ── 3. supplier_projects (images JSON array) ──────────────────────────────
  console.log('\n--- supplier_projects ---');
  const [projects] = await conn.execute(
    `SELECT pj.id, pj.images, pr.slug
     FROM supplier_projects pj
     JOIN supplier_profiles pr ON pr.id = pj.supplier_profile_id
     WHERE pr.status='approved' AND pj.images IS NOT NULL`
  );

  console.log(`Found ${projects.length} projects`);

  for (const proj of projects) {
    let imgs;
    try {
      imgs = typeof proj.images === 'string' ? JSON.parse(proj.images) : proj.images;
    } catch {
      continue;
    }
    if (!Array.isArray(imgs) || imgs.length === 0) continue;

    const slugDir = path.join(PUBLIC_DIR, proj.slug);
    if (APPLY) fs.mkdirSync(slugDir, { recursive: true });

    const newImgs = [];
    for (let i = 0; i < imgs.length; i++) {
      const newUrl = await processImageUrl(imgs[i], slugDir, `project#${proj.id}[${i}]`);
      newImgs.push(newUrl);
    }

    if (APPLY && JSON.stringify(newImgs) !== JSON.stringify(imgs)) {
      await conn.execute(
        `UPDATE supplier_projects SET images=? WHERE id=?`,
        [JSON.stringify(newImgs), proj.id]
      );
    }
  }

  await conn.end();
  console.log('\nDone.');
  if (!APPLY) console.log('\nRun with --apply to actually download and update DB.');
}

main().catch(err => { console.error(err); process.exit(1); });
