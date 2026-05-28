#!/usr/bin/env node
/**
 * SEO Linter
 * Mechanically checks all public-facing pages against docs/SEO.md rules.
 *
 * Checks:
 *   1. <Helmet> present
 *   2. <title> with "Tarmeer"
 *   3. meta description
 *   4. og:title
 *   5. og:description
 *   6. og:image
 *   7. canonical link (https://www.tarmeer.com)
 *   8. JSON-LD (detail pages only)
 *
 * Exit code 0 = all checks pass, 1 = one or more checks failed.
 */

import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(__filename), '..', '..');

// ─── Public pages to check ──────────────────────────────────────────
// detail=true means JSON-LD structured data is required.

const PUBLIC_PAGES = [
  // Core discovery pages
  { file: 'src/pages/HomePage.tsx', label: 'Home', detail: false },
  { file: 'src/pages/CompaniesPage.tsx', label: 'Companies', detail: false },
  { file: 'src/pages/CompanyDetailPage.tsx', label: 'Company Detail', detail: true },
  { file: 'src/pages/ProjectDetailPage.tsx', label: 'Project Detail', detail: true },
  { file: 'src/pages/PortfolioPage.tsx', label: 'Portfolio', detail: false },
  { file: 'src/pages/ContactPage.tsx', label: 'Contact', detail: false },
  { file: 'src/pages/FaqPage.tsx', label: 'FAQ', detail: false },
  // Materials / Suppliers
  { file: 'src/pages/ShowroomsPage.tsx', label: 'Materials (Showrooms)', detail: false },
  { file: 'src/pages/SupplierDetailPage.tsx', label: 'Supplier Detail', detail: true },
  { file: 'src/pages/SupplierProjectDetailPage.tsx', label: 'Supplier Project Detail', detail: true },
  // Blog
  { file: 'src/pages/BlogPage.tsx', label: 'Blog', detail: false },
  { file: 'src/pages/BlogDetailPage.tsx', label: 'Blog Article', detail: true },
  // Marketing / Landing
  { file: 'src/pages/ForCompaniesPage.tsx', label: 'For Companies', detail: false },
  { file: 'src/pages/ForHomeownersPage.tsx', label: 'For Homeowners', detail: false },
  { file: 'src/pages/StartGuidePage.tsx', label: 'Start Guide', detail: false },
  // Interior design category pages
  { file: 'src/pages/HouseExteriorDesignPage.tsx', label: 'House Exterior Design', detail: false },
  { file: 'src/pages/SoftDecorationPage.tsx', label: 'Soft Decoration', detail: false },
  { file: 'src/pages/NewHomeDesignPage.tsx', label: 'New Home Design', detail: false },
  // Programmatic SEO landing pages — /services/:service/:city
  { file: 'src/pages/ServiceCityPage.tsx', label: 'Service+City (interior-design/dubai)', detail: true },
  { file: 'src/pages/ServiceCityPage.tsx', label: 'Service+City (renovation/abu-dhabi)', detail: true },
  // Guide pages — SEO/GEO Phase 1
  { file: 'src/pages/guides/RenovationCostDubaiPage.tsx', label: 'Guide: Renovation Cost Dubai', detail: true },
  { file: 'src/pages/guides/BestInteriorDesignersDubaiPage.tsx', label: 'Guide: Best Interior Designers Dubai', detail: true },
  { file: 'src/pages/guides/ApartmentRenovationUaePage.tsx', label: 'Guide: Apartment Renovation UAE', detail: true },
  { file: 'src/pages/guides/VillaRenovationDubaiPage.tsx', label: 'Guide: Villa Renovation Dubai', detail: true },
  { file: 'src/pages/guides/HowToChooseInteriorDesignerPage.tsx', label: 'Guide: How to Choose Interior Designer UAE', detail: true },
  // ── ADD NEW PUBLIC PAGES HERE ──
  // When you add a new public-facing page, add an entry above this line.
  // detail: true  → also checks for JSON-LD structured data
  // detail: false → only checks basic meta tags
];

// ─── Helpers ────────────────────────────────────────────────────────

let failures = 0;
let warnings = 0;

function pass(page, check) {
  // silent on pass to keep output clean
}

function fail(page, check, hint) {
  console.log(`  ❌ ${check}`);
  if (hint) console.log(`     → ${hint}`);
  failures++;
}

function warn(page, check, hint) {
  console.log(`  ⚠️  ${check}`);
  if (hint) console.log(`     → ${hint}`);
  warnings++;
}

async function readSource(relativePath) {
  try {
    return await readFile(path.join(ROOT, relativePath), 'utf-8');
  } catch {
    return null;
  }
}

// ─── Checks ─────────────────────────────────────────────────────────

function checkPage(src, { label, detail }) {
  console.log(`\n📄 ${label}`);

  // 1. Helmet present
  if (!src.includes('Helmet') && !src.includes('helmet')) {
    fail(label, 'No <Helmet> usage found');
    return; // no point checking further
  }
  pass(label, 'Helmet present');

  // 2. <title> with Tarmeer
  // Matches JSX <title> or template literal containing Tarmeer
  const hasTitle = src.includes('<title>') || src.includes('<title>{');
  if (!hasTitle) {
    fail(label, 'No <title> tag found inside Helmet');
  } else if (!src.includes('Tarmeer') && !src.includes('tarmeer')) {
    fail(label, '<title> does not contain "Tarmeer"');
  } else {
    pass(label, 'Title OK');
  }

  // 3. meta description
  if (!src.includes('name="description"') && !src.includes("name='description'")) {
    fail(label, 'Missing <meta name="description">');
  } else {
    pass(label, 'Description OK');
  }

  // 4. og:title
  if (!src.includes('og:title')) {
    fail(label, 'Missing <meta property="og:title">');
  } else {
    pass(label, 'og:title OK');
  }

  // 5. og:description
  if (!src.includes('og:description')) {
    fail(label, 'Missing <meta property="og:description">');
  } else {
    pass(label, 'og:description OK');
  }

  // 6. og:image
  if (!src.includes('og:image')) {
    fail(label, 'Missing <meta property="og:image">');
  } else {
    pass(label, 'og:image OK');
  }

  // 7. canonical
  if (!src.includes('rel="canonical"') && !src.includes("rel='canonical'")) {
    fail(label, 'Missing <link rel="canonical">');
  } else if (!src.includes('tarmeer.com')) {
    fail(label, 'Canonical URL does not contain tarmeer.com', 'Must use https://www.tarmeer.com/...');
  } else {
    pass(label, 'Canonical OK');
  }

  // 8. JSON-LD (detail pages only)
  if (detail) {
    if (!src.includes('application/ld+json')) {
      fail(label, 'Detail page missing JSON-LD structured data', 'Add <script type="application/ld+json"> with appropriate schema');
    } else {
      pass(label, 'JSON-LD OK');
    }
  }

  // ── Soft warnings (won't fail the gate) ──

  if (!src.includes('og:type')) {
    warn(label, 'No og:type (recommended)');
  }
  if (!src.includes('twitter:card')) {
    warn(label, 'No twitter:card (recommended for social previews)');
  }
  if (!src.includes('keywords')) {
    warn(label, 'No meta keywords (recommended)');
  }
}

// ─── Main ───────────────────────────────────────────────────────────

async function main() {
  console.log('═══════════════════════════════════════');
  console.log('  SEO Linter (docs/SEO.md)');
  console.log('═══════════════════════════════════════');

  for (const page of PUBLIC_PAGES) {
    const src = await readSource(page.file);
    if (src === null) {
      fail(page.label, `File not found: ${page.file}`);
      continue;
    }
    checkPage(src, page);
  }

  console.log('\n═══════════════════════════════════════');
  if (failures > 0) {
    console.log(`  ❌ ${failures} failure(s), ${warnings} warning(s)`);
    process.exit(1);
  } else if (warnings > 0) {
    console.log(`  ✅ All required checks passed (${warnings} warning(s))`);
  } else {
    console.log('  ✅ All checks passed');
  }
  console.log('═══════════════════════════════════════');
}

main();
