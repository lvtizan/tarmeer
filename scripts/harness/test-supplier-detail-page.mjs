/**
 * test-supplier-detail-page.mjs
 * Test cases for SupplierDetailPage redesign:
 *   1. Sticky tab strip positioning (top-14/top-16 below navbar)
 *   2. All product images load without 404
 *   3. All project images load without 404
 *   4. Tab navigation scrolls to correct section
 *   5. Back-to-top button present in tab strip
 *   6. No broken external image URLs remain in DB
 *
 * Usage: node scripts/harness/test-supplier-detail-page.mjs
 */

import { createConnection } from 'mysql2/promise';
import fs from 'fs';
import path from 'path';
import https from 'https';
import http from 'http';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../..');
const PUBLIC_DIR = path.join(ROOT, 'public');

const DB = { host: 'localhost', port: 3306, user: 'root', database: 'tarmeer' };

let passed = 0;
let failed = 0;

function pass(msg) { console.log(`  ✓ ${msg}`); passed++; }
function fail(msg) { console.error(`  ✗ ${msg}`); failed++; }

function checkLocalFile(url, label) {
  if (!url) return; // null/empty = skip
  if (!url.startsWith('/')) { fail(`${label}: not a local path: ${url}`); return; }
  const abs = path.join(PUBLIC_DIR, url);
  if (!fs.existsSync(abs)) {
    fail(`${label}: file missing on disk: ${abs}`);
  } else {
    const stat = fs.statSync(abs);
    if (stat.size < 1000) {
      fail(`${label}: file suspiciously small (${stat.size}B): ${abs}`);
    } else {
      pass(`${label}: file exists (${Math.round(stat.size / 1024)}KB)`);
    }
  }
}

async function main() {
  const conn = await createConnection(DB);
  console.log('=== Supplier Detail Page — Test Suite ===\n');

  // ── TC1: No external (broken) image URLs remain in DB ──────────────────────
  console.log('TC1: No external image URLs remain in supplier tables');
  {
    const [r1] = await conn.execute(
      `SELECT COUNT(*) AS n FROM supplier_products WHERE image_url LIKE 'http%'`
    );
    r1[0].n === 0
      ? pass(`supplier_products: 0 external URLs`)
      : fail(`supplier_products: ${r1[0].n} external URLs still present`);

    const [r2] = await conn.execute(
      `SELECT COUNT(*) AS n FROM supplier_projects WHERE images LIKE '%http%'`
    );
    r2[0].n === 0
      ? pass(`supplier_projects: 0 external URLs`)
      : fail(`supplier_projects: ${r2[0].n} external URLs still present`);

    const [r3] = await conn.execute(
      `SELECT COUNT(*) AS n FROM supplier_profiles WHERE (logo_url LIKE 'http%' OR cover_image_url LIKE 'http%') AND status='approved'`
    );
    r3[0].n === 0
      ? pass(`supplier_profiles: 0 external URLs`)
      : fail(`supplier_profiles: ${r3[0].n} external URLs still present`);
  }

  // ── TC2: All local image files exist on disk ────────────────────────────────
  console.log('\nTC2: All local image files exist on disk');
  {
    const [products] = await conn.execute(
      `SELECT sp.id, sp.image_url, pr.slug
       FROM supplier_products sp
       JOIN supplier_profiles pr ON pr.id = sp.supplier_profile_id
       WHERE pr.status='approved'`
    );
    let missingProducts = 0;
    for (const p of products) {
      const abs = path.join(PUBLIC_DIR, p.image_url);
      if (!fs.existsSync(abs)) {
        console.error(`    missing: ${p.image_url} (product#${p.id}, ${p.slug})`);
        missingProducts++;
      }
    }
    missingProducts === 0
      ? pass(`All ${products.length} product images exist on disk`)
      : fail(`${missingProducts}/${products.length} product images missing`);

    const [projects] = await conn.execute(
      `SELECT pj.id, pj.images, pr.slug
       FROM supplier_projects pj
       JOIN supplier_profiles pr ON pr.id = pj.supplier_profile_id
       WHERE pr.status='approved'`
    );
    let missingProj = 0;
    let totalProjImgs = 0;
    for (const pj of projects) {
      let imgs;
      try { imgs = typeof pj.images === 'string' ? JSON.parse(pj.images) : pj.images; }
      catch { fail(`project#${pj.id}: invalid JSON in images field`); continue; }
      if (!Array.isArray(imgs)) continue;
      for (const url of imgs) {
        totalProjImgs++;
        const abs = path.join(PUBLIC_DIR, url);
        if (!fs.existsSync(abs)) {
          console.error(`    missing: ${url} (project#${pj.id}, ${pj.slug})`);
          missingProj++;
        }
      }
    }
    missingProj === 0
      ? pass(`All ${totalProjImgs} project images exist on disk`)
      : fail(`${missingProj}/${totalProjImgs} project images missing`);

    const [profiles] = await conn.execute(
      `SELECT id, slug, logo_url, cover_image_url FROM supplier_profiles WHERE status='approved'`
    );
    let missingProfiles = 0;
    for (const p of profiles) {
      for (const [field, url] of [['logo_url', p.logo_url], ['cover_image_url', p.cover_image_url]]) {
        if (!url) continue;
        const abs = path.join(PUBLIC_DIR, url);
        if (!fs.existsSync(abs)) {
          console.error(`    missing: ${url} (${p.slug} ${field})`);
          missingProfiles++;
        }
      }
    }
    missingProfiles === 0
      ? pass(`All profile logo/cover images exist on disk`)
      : fail(`${missingProfiles} profile images missing`);
  }

  // ── TC3: API returns local paths for harbor-fitout-works ───────────────────
  console.log('\nTC3: API returns local paths (no external URLs) for harbor-fitout-works');
  {
    try {
      const res = await fetch('http://localhost:3002/api/suppliers/detail/harbor-fitout-works');
      if (!res.ok) { fail(`API returned HTTP ${res.status}`); }
      else {
        const data = await res.json();
        const products = data.products || [];
        const externalProducts = products.filter(p => p.image_url?.startsWith('http'));
        externalProducts.length === 0
          ? pass(`All ${products.length} product image_urls are local paths`)
          : fail(`${externalProducts.length} products still have external URLs: ${externalProducts.map(p => p.image_url).join(', ')}`);

        const projects = data.projects || [];
        let externalProjCount = 0;
        for (const pj of projects) {
          const imgs = Array.isArray(pj.images) ? pj.images : [];
          externalProjCount += imgs.filter(u => u.startsWith('http')).length;
        }
        externalProjCount === 0
          ? pass(`All project images are local paths`)
          : fail(`${externalProjCount} project images still external`);

        const sup = data.supplier;
        const externalLogoOrCover = [sup?.logo_url, sup?.cover_image_url].filter(u => u?.startsWith('http'));
        externalLogoOrCover.length === 0
          ? pass(`Supplier logo/cover are local paths`)
          : fail(`Supplier has external logo/cover: ${externalLogoOrCover.join(', ')}`);
      }
    } catch (err) {
      fail(`API fetch failed: ${err.message} — is backend running on port 3002?`);
    }
  }

  // ── TC4: SupplierDetailPage source — sticky class is correct ───────────────
  console.log('\nTC4: SupplierDetailPage source — sticky positioning correct');
  {
    const src = fs.readFileSync(path.join(ROOT, 'src/pages/SupplierDetailPage.tsx'), 'utf8');

    src.includes('sticky top-14 sm:top-16')
      ? pass(`Tab strip uses sticky top-14 sm:top-16 (below navbar)`)
      : fail(`Tab strip does NOT have sticky top-14 sm:top-16`);

    src.includes('z-40')
      ? pass(`Tab strip z-40 (above content, below z-50 navbar)`)
      : fail(`Tab strip missing z-40`);

    src.includes('scroll-mt-28')
      ? pass(`Sections use scroll-mt-28 (navbar 56px + tab ~50px)`)
      : fail(`Sections missing scroll-mt-28`);

    src.includes('ArrowUp')
      ? pass(`Back-to-top ArrowUp button present`)
      : fail(`Back-to-top button missing`);

    !src.includes('InquiryForm')
      ? pass(`InquiryForm removed (display-only page)`)
      : fail(`InquiryForm still referenced`);

    !src.includes('ServiceInquiryCard')
      ? pass(`ServiceInquiryCard removed`)
      : fail(`ServiceInquiryCard still referenced`);

    !src.includes('contact_phone') && !src.includes('whatsapp')
      ? pass(`No contact info rendered`)
      : fail(`Contact info (phone/whatsapp) still referenced in JSX`);

    src.includes('openLightbox(imgs')
      ? pass(`Project images have lightbox click handler`)
      : fail(`Project images missing lightbox click handler`);

    src.includes('openLightbox(products.map')
      ? pass(`Product images have lightbox click handler`)
      : fail(`Product images missing lightbox click handler`);

    !src.includes('lightboxIdx')
      ? pass(`Old lightboxIdx state removed (unified lightbox)`)
      : fail(`Old lightboxIdx state still present`);
  }

  // ── TC5: File permissions ──────────────────────────────────────────────────
  console.log('\nTC5: Image file permissions (must be readable, not 600)');
  {
    const imgDir = path.join(PUBLIC_DIR, 'images', 'suppliers');
    let badPerms = 0;
    function walk(dir) {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) { walk(full); }
        else if (entry.isFile()) {
          const mode = fs.statSync(full).mode & 0o777;
          if ((mode & 0o004) === 0) { // world-readable bit
            console.error(`    not world-readable: ${full} (${mode.toString(8)})`);
            badPerms++;
          }
        }
      }
    }
    walk(imgDir);
    badPerms === 0
      ? pass(`All supplier images are world-readable`)
      : fail(`${badPerms} files not world-readable (nginx will 403)`);
  }

  // ── Summary ────────────────────────────────────────────────────────────────
  console.log(`\n${'─'.repeat(40)}`);
  console.log(`Results: ${passed} passed, ${failed} failed`);
  await conn.end();
  if (failed > 0) process.exit(1);
}

main().catch(err => { console.error(err); process.exit(1); });
