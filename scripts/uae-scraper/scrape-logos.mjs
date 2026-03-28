/**
 * UAE Companies Logo & Image Scraper
 *
 * 1. Reads companies-data.json
 * 2. Visits each company's website
 * 3. Extracts logo URL and portfolio images
 * 4. Downloads logos to public/images/uae-companies/logos/
 * 5. Downloads portfolio images to public/images/uae-companies/portfolio/{slug}/
 * 6. Updates JSON with local file paths
 * 7. Generates seed SQL for the database
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  downloadFile,
  extractLogoUrl,
  extractPortfolioImages,
  fetchUrl,
  getExtension,
} from './scrape-logos-lib.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../..');
const DATA_FILE = path.join(__dirname, 'companies-data.json');
const LOGOS_DIR = path.join(ROOT, 'public/images/uae-companies/logos');
const PORTFOLIO_DIR = path.join(ROOT, 'public/images/uae-companies/portfolio');
const OUTPUT_SQL = path.join(ROOT, 'server/schema/seed-uae-companies.sql');
const OUTPUT_JSON = path.join(__dirname, 'companies-data-final.json');

// Ensure directories
[LOGOS_DIR, PORTFOLIO_DIR].forEach(d => fs.mkdirSync(d, { recursive: true }));

const companies = JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));

// ─── Main ─────────────────────────────────────────────────
const CONCURRENCY = 3;

async function processCompany(company, idx) {
  const label = `[${idx + 1}/30] ${company.name_en}`;
  console.log(`${label}: fetching ${company.website}...`);

  try {
    const baseUrl = company.website.replace(/\/+$/, '');
    const res = await fetchUrl(baseUrl);
    const html = res.body.toString('utf-8');

    // Extract logo
    const logoCandidates = [...new Set([
      extractLogoUrl(html, baseUrl),
      company.logo_url,
    ].filter(Boolean))];

    if (logoCandidates.length > 0) {
      let savedLogo = '';

      for (const logoUrl of logoCandidates) {
        const ext = getExtension(logoUrl);
        const logoFile = `${company.slug}${ext}`;
        const logoPath = path.join(LOGOS_DIR, logoFile);

        try {
          await downloadFile(logoUrl, logoPath);
          savedLogo = `/images/uae-companies/logos/${logoFile}`;
          console.log(`  ✓ Logo saved: ${logoFile}`);
          break;
        } catch (e) {
          console.log(`  ✗ Logo download failed: ${e.message}`);
        }
      }

      company.logo_local = savedLogo;
    } else {
      console.log(`  ✗ No logo found`);
      company.logo_local = '';
    }

    // Extract & download portfolio images
    const portfolioUrls = extractPortfolioImages(html, baseUrl);
    const slugDir = path.join(PORTFOLIO_DIR, company.slug);
    fs.mkdirSync(slugDir, { recursive: true });

    const savedImages = [];
    for (let i = 0; i < Math.min(portfolioUrls.length, 4); i++) {
      try {
        const ext = getExtension(portfolioUrls[i]);
        const fname = `${i + 1}${ext}`;
        await downloadFile(portfolioUrls[i], path.join(slugDir, fname));
        savedImages.push(`/images/uae-companies/portfolio/${company.slug}/${fname}`);
      } catch (e) {
        // skip failed images
      }
    }
    company.portfolio_local = savedImages;
    console.log(`  ✓ ${savedImages.length} portfolio images saved`);

  } catch (e) {
    console.log(`  ✗ Failed to fetch website: ${e.message}`);
    company.logo_local = '';
    company.portfolio_local = [];
  }
}

async function runAll() {
  // Process in batches of CONCURRENCY
  for (let i = 0; i < companies.length; i += CONCURRENCY) {
    const batch = companies.slice(i, i + CONCURRENCY);
    await Promise.all(batch.map((c, j) => processCompany(c, i + j)));
  }

  // Save updated JSON
  fs.writeFileSync(OUTPUT_JSON, JSON.stringify(companies, null, 2));
  console.log(`\n✓ Updated JSON saved to ${OUTPUT_JSON}`);

  // Generate seed SQL
  generateSeedSQL();
}

function esc(val) {
  if (val === null || val === undefined || val === '') return 'NULL';
  return `'${String(val).replace(/'/g, "\\'")}'`;
}

function generateSeedSQL() {
  let sql = `-- Seed data: ${companies.length} UAE home renovation companies
-- Generated: ${new Date().toISOString().slice(0, 10)}
-- Run: mysql -u root -p tarmeer < server/schema/seed-uae-companies.sql

USE tarmeer;

`;

  for (const c of companies) {
    const services = JSON.stringify(c.services);
    const specialties = JSON.stringify(c.specialties);
    const portfolio = c.portfolio_categories
      ? JSON.stringify(c.portfolio_categories)
      : JSON.stringify(c.portfolio_local || []);

    sql += `INSERT INTO uae_companies (
  name_en, name_ar, slug, logo_url, description,
  phone, email, website, whatsapp,
  city, area, address,
  services, specialties, year_established,
  google_rating, google_reviews_count, source_platform,
  instagram, facebook, linkedin,
  portfolio_images, is_active
) VALUES (
  ${esc(c.name_en)}, ${esc(c.name_ar)}, ${esc(c.slug)}, ${esc(c.logo_local || c.logo_url)}, NULL,
  ${esc(c.phone)}, ${esc(c.email)}, ${esc(c.website)}, ${esc(c.whatsapp)},
  ${esc(c.city)}, ${esc(c.area)}, ${esc(c.address)},
  '${services.replace(/'/g, "\\'")}', '${specialties.replace(/'/g, "\\'")}', ${esc(c.year_established)},
  ${c.google_rating || 'NULL'}, ${c.google_reviews_count || 0}, ${esc(c.source_platform)},
  ${esc(c.instagram)}, ${esc(c.facebook)}, ${esc(c.linkedin)},
  '${portfolio.replace(/'/g, "\\'")}', 1
);\n\n`;
  }

  fs.writeFileSync(OUTPUT_SQL, sql);
  console.log(`✓ Seed SQL saved to ${OUTPUT_SQL}`);
}

console.log('=== UAE Companies Scraper ===\n');
console.log(`Processing ${companies.length} companies...\n`);
runAll().then(() => {
  console.log('\n=== Done! ===');
  console.log(`Logos:     ${LOGOS_DIR}`);
  console.log(`Portfolio: ${PORTFOLIO_DIR}`);
  console.log(`SQL:       ${OUTPUT_SQL}`);
}).catch(e => {
  console.error('Fatal error:', e);
  process.exit(1);
});
