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
    .replace(/[ứừửữự]/g, 'u').replace(/[íỉịì]/g, 'i').replace(/[ỳỷỹỵ]/g, 'y')
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80);
}

const GENERIC_TITLES = [
  'trang chủ', 'home', 'homepage', 'trang chu', 'index', 'main page',
  'thiết kế nội thất', 'thiet ke noi that',  // VN interior design generic
  'thi công nội thất', 'trang chu website',
  'kiến trúc', 'nội thất',
  'thiết kế', 'thiet ke', 'xây dựng', 'xay dung',
  'kiến tạo không gian',  // generic tagline
];

// Domains known to not be interior design companies
const DOMAIN_BLACKLIST = [
  'mia.vn', 'kienviet.net', 'kienviet.com', 'desino.vn', 'kientao.com', 'floorii.com',
  'vinadesign.vn',      // printing company
  'phanphoison.com.vn', // paint distributor
  'dongsuh.vn',         // Korean furniture (no images after filter)
  'byzan.vn',           // already deleted from DB
  's-housing.vn',       // already deleted from DB
  'nhadepsg.vn',        // SaiGon Grand Homes - all images were flags
  'nexhome.vn',         // generic "Trang chủ" title, too few images after filter
  'neohouse.vn',        // duplicate (both neohouse.vn and www.neohouse.vn exist in results)
  'tropical-space.com', // French clothing store
  'furmono.com',        // fursuit makers
  'sava.vn',            // empty placeholder site
  'nhaxanh.net',        // parked/Cloudflare
  'noithatthanhhoa.com', // domain for sale
  'kientrucminhphu.com', // notification page
  'thietkenha.com',     // domain for sale
  'noithatxanh.com',    // empty site
  // kientrucmoi.vn and noithat365.com now use WP API for images
  'nhadephanoi.net',    // real estate listings site
  'phuongdong.com.vn',  // hotel (Khách sạn Phương Đông)
  'homeplus.vn',        // cleaning/household services
  'indesign.vn',        // printing company (in ấn)
  'xuantrang.vn',       // cosmetics (Mỹ Phẩm)
  'noithatnhatrang.vn', // sauna room specialist (phòng xông hơi)
  'designgroup.vn',     // manufacturing technology company
  'edesign.vn',         // empty blog (0 images)
  'noithathaiphong.vn', // 0 images scraped
  'greenspace.vn',      // CDN hotlink protection (403 on all image downloads)
  'elitedesign.vn',    // all 20 images removed by quality filter (graphics/flags only)
  'noithatthanhhoa.vn', // template/demo website ("Mẫu web kiến trúc")
  'noithatbyt.vn',      // only 1 quality image survived filter
  'sango9x.com',        // flooring retailer, only 1 quality image
  'housedesign.vn',     // only 1 quality image survived filter
  'indochinedesign.vn', // only 1 quality image survived filter
  'vicostone.com',      // Sitecore CMS media protection, all images 302→homepage
  'vivudecor.vn',       // JS-lazy-load only, cheerio gets 0 real images (all SVG placeholders)
];

const MIN_IMAGES = 3; // skip if scraped fewer images than this

function extractCompanyName(rawIn, website, note) {
  let raw = rawIn;
  // Strip control characters that can sneak in from HTML parsing
  raw = raw.replace(/[\x00-\x1F\x7F]/g, '').trim();
  const normalize = s => s.normalize('NFC').toLowerCase().trim();
  const GENERIC_NORMALIZED = GENERIC_TITLES.map(normalize);
  // If title is generic, derive name from domain or note
  if (GENERIC_NORMALIZED.includes(normalize(raw))) {
    if (note) return note.split(' - ')[0].trim().slice(0, 200);
    try {
      const domain = new URL(website).hostname.replace(/^www\./, '');
      return domain.split('.')[0].replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase()).slice(0, 200);
    } catch { return website; }
  }
  // Strip common Vietnamese meta title suffixes
  const stripped = raw
    .replace(/\s*[-|–|•]\s*.{0,80}$/, '')
    .replace(/\s*\|\s*.{0,80}$/, '')
    .trim()
    .slice(0, 200) || raw.slice(0, 200);
  // If the stripped result is also generic, fall back to note/domain
  if (GENERIC_NORMALIZED.includes(normalize(stripped))) {
    if (note) return note.split(' - ')[0].trim().slice(0, 200);
    try {
      const domain = new URL(website).hostname.replace(/^www\./, '');
      return domain.split('.')[0].replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase()).slice(0, 200);
    } catch { return stripped; }
  }
  return stripped;
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

  require('/Users/kp/Code/tarmeer-4.0-local/server/node_modules/dotenv').config({ path: '/Users/kp/Code/tarmeer-4.0-local/server/.env' });
  const db = await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: process.env.DB_PORT || 3306,
  });

  let inserted = 0, skipped = 0;

  for (const r of successful) {
    // Skip domains known to be non-interior companies
    try {
      const domain = new URL(r.website).hostname.replace(/^www\./, '');
      if (DOMAIN_BLACKLIST.includes(domain)) { console.log(`  [skip-domain] ${r.website}`); skipped++; continue; }
    } catch {}

    // Skip entries with too few images (likely wrong-category or empty sites)
    if ((r.images?.length || 0) < MIN_IMAGES) { console.log(`  [skip-imgs] ${r.website} (${r.images?.length || 0} imgs)`); skipped++; continue; }

    const name = extractCompanyName(r.company_name, r.website, r.note);
    if (!name || name.length < 3) { skipped++; continue; }

    const baseSlug = 'vn-' + slugify(name);
    let slug = baseSlug;

    // Check if website already exists (don't skip just for slug collision - slug will be made unique below)
    const [existing] = await db.execute('SELECT id FROM uae_companies WHERE website = ? AND country = ?', [r.website, 'vn']);
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
