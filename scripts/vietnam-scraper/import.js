#!/usr/bin/env node
/**
 * Import scraped Vietnam companies into uae_companies table (country='vn')
 * Usage: node import.js [--dry-run]
 */

const mysql = require('/Users/kp/Code/tarmeer-4.0-local/server/node_modules/mysql2/promise');
const fs = require('fs');
const path = require('path');

const RESULTS_FILE = path.join(__dirname, 'vietnam-results.json');
const DRY_RUN = process.argv.includes('--dry-run');

function slugify(str) {
  return str
    .toLowerCase()
    .replace(/[àáâãäå]/g, 'a').replace(/[èéêë]/g, 'e').replace(/[ìíîï]/g, 'i')
    .replace(/[òóôõö]/g, 'o').replace(/[ùúûü]/g, 'u').replace(/[ýÿ]/g, 'y')
    .replace(/[đ]/g, 'd').replace(/[ơ]/g, 'o').replace(/[ư]/g, 'u')
    .replace(/[ắặẳẵằ]/g, 'a').replace(/[ấầẩẫậ]/g, 'a').replace(/[ắặẳẵằ]/g, 'a')
    .replace(/[ếềểễệ]/g, 'e').replace(/[ốồổỗộ]/g, 'o').replace(/[ớờởỡợ]/g, 'o')
    .replace(/[ứừửữự]/g, 'u').replace(/[ídíỉịí]/g, 'i').replace(/[ỳỷỹỵ]/g, 'y')
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80);
}

const GENERIC_TITLES = ['trang chủ', 'home', 'homepage', 'trang chu', 'index'];

function extractCompanyName(raw, website, note) {
  // If title is generic, derive name from domain or note
  if (GENERIC_TITLES.includes(raw.trim().toLowerCase())) {
    if (note) return note.split(' - ')[0].trim().slice(0, 200);
    try {
      const domain = new URL(website).hostname.replace(/^www\./, '');
      return domain.split('.')[0].replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase()).slice(0, 200);
    } catch { return website; }
  }
  // Strip common Vietnamese meta title suffixes
  return raw
    .replace(/\s*[-|–|•]\s*.{0,80}$/, '')
    .replace(/\s*\|\s*.{0,80}$/, '')
    .trim()
    .slice(0, 200) || raw.slice(0, 200);
}

function categoryToServices(category) {
  const map = {
    'interior-design': ['Interior Design', 'Fit-Out', 'Renovation'],
    'building-materials': ['Building Materials', 'Construction Supplies'],
    'furniture': ['Furniture', 'Interior Design'],
    'construction': ['Construction', 'Architecture', 'Design & Build'],
  };
  return JSON.stringify(map[category] || ['Interior Design']);
}

async function main() {
  const results = JSON.parse(fs.readFileSync(RESULTS_FILE, 'utf8'));
  const successful = results.filter(r => r.ok && r.company_name);

  console.log(`\nFound ${successful.length} successful scrapes to import\n`);
  if (DRY_RUN) console.log('[DRY RUN MODE]\n');

  const db = await mysql.createConnection({
    host: 'localhost', user: 'root', password: '', database: 'tarmeer', port: 3306
  });

  let inserted = 0, skipped = 0;

  for (const r of successful) {
    const name = extractCompanyName(r.company_name, r.website, r.note);
    if (!name || name.length < 3) { skipped++; continue; }

    const baseSlug = 'vn-' + slugify(name);
    let slug = baseSlug;

    // Check for existing slug
    const [existing] = await db.execute('SELECT id FROM uae_companies WHERE slug = ? OR (website = ? AND country = ?)', [slug, r.website, 'vn']);
    if (existing.length > 0) {
      console.log(`  [skip] ${name} (already exists)`);
      skipped++;
      continue;
    }

    // Ensure slug uniqueness
    let attempt = 0;
    while (true) {
      const [slugCheck] = await db.execute('SELECT id FROM uae_companies WHERE slug = ?', [slug]);
      if (slugCheck.length === 0) break;
      attempt++;
      slug = baseSlug + '-' + attempt;
    }

    const portfolioImages = r.images && r.images.length > 0
      ? JSON.stringify(r.images.slice(0, 20).map(url => ({ url, category: 'Portfolio' })))
      : null;

    const services = categoryToServices(r.category);

    if (DRY_RUN) {
      console.log(`  [dry] ${name} → slug: ${slug} | imgs: ${r.images?.length || 0} | phone: ${r.phone || '—'}`);
      inserted++;
      continue;
    }

    try {
      await db.execute(
        `INSERT INTO uae_companies
          (name_en, slug, description, phone, website, services, portfolio_images,
           is_active, is_published, is_verified, is_signed, country,
           home_display_order, list_display_order, weight_score)
         VALUES (?, ?, ?, ?, ?, ?, ?, 1, 1, 0, 0, 'vn', 0, 0, 10)`,
        [
          name,
          slug,
          r.description || null,
          r.phone || null,
          r.website || null,
          services,
          portfolioImages,
        ]
      );
      console.log(`  ✓ ${name}`);
      inserted++;
    } catch (e) {
      console.log(`  ✗ ${name}: ${e.message}`);
      skipped++;
    }
  }

  await db.end();
  console.log(`\n✅ Inserted: ${inserted}, Skipped: ${skipped}`);
}

main().catch(console.error);
