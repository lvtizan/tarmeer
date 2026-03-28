# Portfolio Enhancement & Company Page Redesign — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Expand UAE companies to 100, scrape portfolio images by category, and redesign the company detail page to a high-end experience.

**Architecture:** Three-phase approach: (1) enhance scraper to discover categories and crawl more images, (2) update backend data model and API to serve categorized portfolios, (3) redesign frontend company detail page with masonry gallery, category tabs, parallax hero, and light-theme lightbox.

**Tech Stack:** Puppeteer, Node.js, React 19, TypeScript, Tailwind CSS 4, Framer Motion, MySQL JSON fields, CSS columns for masonry.

---

## Task 1: Add category extraction to scraper lib

**Files:**
- Modify: `scripts/uae-scraper/scrape-logos-lib.mjs`
- Test: `scripts/uae-scraper/scrape-logos-lib.test.mjs`

**Step 1: Write the failing test**

Add to `scrape-logos-lib.test.mjs`:

```javascript
test('extractCategoryLinks finds portfolio category navigation links', () => {
  const html = `
    <nav>
      <a href="/projects/residential">Residential</a>
      <a href="/projects/commercial">Commercial</a>
      <a href="/portfolio/hospitality">Hospitality</a>
      <a href="/about">About Us</a>
    </nav>
  `;

  const result = extractCategoryLinks(html, 'https://example.com');

  assert.deepEqual(result, [
    { url: 'https://example.com/projects/residential', category: 'Residential' },
    { url: 'https://example.com/projects/commercial', category: 'Commercial' },
    { url: 'https://example.com/portfolio/hospitality', category: 'Hospitality' },
  ]);
});

test('extractCategoryLinks returns empty array when no categories found', () => {
  const html = `<nav><a href="/about">About</a><a href="/contact">Contact</a></nav>`;
  const result = extractCategoryLinks(html, 'https://example.com');
  assert.deepEqual(result, []);
});
```

**Step 2: Run test to verify it fails**

Run: `node --test scripts/uae-scraper/scrape-logos-lib.test.mjs`
Expected: FAIL — `extractCategoryLinks is not a function`

**Step 3: Implement extractCategoryLinks**

Add to `scrape-logos-lib.mjs` before the existing `extractLogoUrl`:

```javascript
const CATEGORY_LINK_PATTERNS = [
  /<a[^>]+href=["']([^"']*\/(?:projects?|portfolio|works?|gallery|case-stud(?:y|ies))\/([^"'/?#]+))["'][^>]*>([^<]*)</gi,
];

const CATEGORY_NAV_PATTERNS = [
  /<a[^>]+href=["']([^"']+)["'][^>]*>\s*(residential|commercial|hospitality|villa|office|retail|penthouse|apartment|restaurant|hotel|spa|salon|clinic|mosque|palace)\s*<\/a>/gi,
];

export function extractCategoryLinks(html, baseUrl) {
  const categories = [];
  const seen = new Set();

  // Pattern 1: URL structure /projects/category or /portfolio/category
  for (const pattern of CATEGORY_LINK_PATTERNS) {
    let match;
    while ((match = pattern.exec(html)) !== null) {
      const url = normalizeUrl(match[1], baseUrl);
      const categoryFromUrl = match[2].replace(/-/g, ' ');
      const linkText = match[3].trim();
      const category = linkText || categoryFromUrl;
      if (url && !seen.has(url)) {
        seen.add(url);
        categories.push({
          url,
          category: category.charAt(0).toUpperCase() + category.slice(1),
        });
      }
    }
  }

  // Pattern 2: Link text matches known category keywords
  for (const pattern of CATEGORY_NAV_PATTERNS) {
    let match;
    while ((match = pattern.exec(html)) !== null) {
      const url = normalizeUrl(match[1], baseUrl);
      const category = match[2].charAt(0).toUpperCase() + match[2].slice(1);
      if (url && !seen.has(url)) {
        seen.add(url);
        categories.push({ url, category });
      }
    }
  }

  return categories;
}
```

**Step 4: Run test to verify it passes**

Run: `node --test scripts/uae-scraper/scrape-logos-lib.test.mjs`
Expected: All tests PASS

**Step 5: Remove the 12-image limit in extractPortfolioImages**

In `scrape-logos-lib.mjs` line 321, change `.slice(0, 12)` to remove the slice entirely (or increase to 50):

```javascript
  return uniqueUrls([...simpleAttributeUrls, ...srcsetUrls])
    .filter(isLikelyContentImage);
```

**Step 6: Commit**

```bash
git add scripts/uae-scraper/scrape-logos-lib.mjs scripts/uae-scraper/scrape-logos-lib.test.mjs
git commit -m "feat(scraper): add category link extraction and remove image limit"
```

---

## Task 2: Build category-aware portfolio scraper

**Files:**
- Create: `scripts/uae-scraper/scrape-portfolio-categories.mjs`

**Step 1: Create the new scraper script**

```javascript
import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  downloadFile,
  extractCategoryLinks,
  extractPortfolioImages,
  fetchUrl,
  getExtension,
} from './scrape-logos-lib.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../..');
const DATA_FILE = path.join(__dirname, 'companies-data.json');
const PORTFOLIO_DIR = path.join(ROOT, 'public/images/uae-companies/portfolio');
const OUTPUT_JSON = path.join(__dirname, 'companies-data-final.json');
const DELAY_MS = 2000;
const MAX_IMAGES_PER_CATEGORY = 20;
const MAX_IMAGES_PER_COMPANY = 100;

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function sanitizeFilename(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .substring(0, 50);
}

async function scrapeCompanyCategories(company) {
  const portfolio = {}; // { categoryName: [{ url, title }] }
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  try {
    const baseUrl = company.website.replace(/\/+$/, '');
    console.log(`\n🔍 ${company.name_en}: ${baseUrl}`);

    const page = await browser.newPage();
    await page.setUserAgent(
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    );
    await page.setViewport({ width: 1440, height: 900 });

    // Load homepage
    await page.goto(baseUrl, { waitUntil: 'networkidle2', timeout: 30000 });
    const html = await page.content();

    // Discover categories
    const categories = extractCategoryLinks(html, baseUrl);
    console.log(`   📂 Found ${categories.length} categories`);

    let totalImages = 0;

    if (categories.length > 0) {
      // Scrape each category page
      for (const cat of categories) {
        if (totalImages >= MAX_IMAGES_PER_COMPANY) break;

        console.log(`   📁 Category: ${cat.category} → ${cat.url}`);
        try {
          await page.goto(cat.url, { waitUntil: 'networkidle2', timeout: 20000 });

          // Scroll to trigger lazy loading
          await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
          await delay(1000);

          const catHtml = await page.content();
          const images = extractPortfolioImages(catHtml, baseUrl);
          const limited = images.slice(0, MAX_IMAGES_PER_CATEGORY);

          if (limited.length > 0) {
            portfolio[cat.category] = limited.map((url, i) => ({
              url,
              title: `${cat.category} ${i + 1}`,
            }));
            totalImages += limited.length;
            console.log(`      ✓ ${limited.length} images`);
          }

          await delay(DELAY_MS);
        } catch (err) {
          console.log(`      ✗ Failed: ${err.message}`);
        }
      }
    }

    // Fallback: if no categories found or very few images, scrape homepage
    if (totalImages < 5) {
      console.log(`   🔍 Deep scanning homepage...`);

      await page.goto(baseUrl, { waitUntil: 'networkidle2', timeout: 30000 });
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await delay(2000);

      const deepHtml = await page.content();

      // Also try Puppeteer DOM extraction for dynamic content
      const domImages = await page.evaluate((base) => {
        const images = [];
        const seen = new Set();
        document.querySelectorAll('img').forEach((img) => {
          const src = img.src || img.getAttribute('data-src') || img.getAttribute('data-lazy-src');
          if (src && !src.includes('logo') && !src.includes('icon') && !src.includes('favicon')) {
            try {
              const url = new URL(src, base).href;
              if (!seen.has(url) && (url.includes('.jpg') || url.includes('.png') || url.includes('.webp') || url.includes('.jpeg') || url.includes('.avif'))) {
                seen.add(url);
                images.push(url);
              }
            } catch (e) { /* skip */ }
          }
        });
        return images;
      }, baseUrl);

      const htmlImages = extractPortfolioImages(deepHtml, baseUrl);
      const allFallback = [...new Set([...htmlImages, ...domImages])];
      const limited = allFallback.slice(0, MAX_IMAGES_PER_COMPANY);

      if (limited.length > 0) {
        portfolio['Projects'] = limited.map((url, i) => ({
          url,
          title: `Project ${i + 1}`,
        }));
        totalImages = limited.length;
      }
    }

    // Also try to find project page links and scrape them
    if (totalImages < 10) {
      const projectLinks = await page.evaluate(() => {
        const links = [];
        const seen = new Set();
        const patterns = ['a[href*="/project"]', 'a[href*="/portfolio"]', 'a[href*="/work"]', 'a[href*="/case-study"]'];
        for (const pattern of patterns) {
          document.querySelectorAll(pattern).forEach((el) => {
            const href = el.getAttribute('href');
            if (href && href.startsWith('/') && !href.includes('#') && !seen.has(href)) {
              seen.add(href);
              links.push({ url: href, text: el.textContent.trim() });
            }
          });
        }
        return links.slice(0, 15);
      });

      for (const link of projectLinks) {
        if (totalImages >= MAX_IMAGES_PER_COMPANY) break;
        try {
          const projectUrl = new URL(link.url, baseUrl).href;
          await page.goto(projectUrl, { waitUntil: 'domcontentloaded', timeout: 15000 });
          await delay(500);
          const projHtml = await page.content();
          const projImages = extractPortfolioImages(projHtml, baseUrl);

          // Determine category from link text or URL
          const categoryName = link.text || 'Projects';
          if (!portfolio[categoryName]) {
            portfolio[categoryName] = [];
          }
          for (const url of projImages) {
            if (portfolio[categoryName].length < MAX_IMAGES_PER_CATEGORY && totalImages < MAX_IMAGES_PER_COMPANY) {
              portfolio[categoryName].push({ url, title: `${categoryName} ${portfolio[categoryName].length + 1}` });
              totalImages++;
            }
          }

          await delay(DELAY_MS);
        } catch (err) {
          /* skip failed pages */
        }
      }
    }

    console.log(`   ✅ Total: ${totalImages} images in ${Object.keys(portfolio).length} categories`);
    return portfolio;

  } catch (error) {
    console.log(`   ❌ Error: ${error.message}`);
    return {};
  } finally {
    await browser.close();
  }
}

async function downloadPortfolio(slug, portfolio) {
  const localPortfolio = {};
  let downloadCount = 0;

  for (const [category, images] of Object.entries(portfolio)) {
    const catSlug = sanitizeFilename(category);
    const catDir = path.join(PORTFOLIO_DIR, slug, catSlug);
    fs.mkdirSync(catDir, { recursive: true });

    const localImages = [];
    for (let i = 0; i < images.length; i++) {
      const ext = getExtension(images[i].url);
      const fname = `${i + 1}${ext}`;
      const destPath = path.join(catDir, fname);
      const publicPath = `/images/uae-companies/portfolio/${slug}/${catSlug}/${fname}`;

      try {
        await downloadFile(images[i].url, destPath);
        localImages.push({ url: publicPath, title: images[i].title });
        downloadCount++;
      } catch (e) {
        /* skip failed downloads */
      }
    }

    if (localImages.length > 0) {
      localPortfolio[category] = localImages;
    }
  }

  console.log(`   💾 Downloaded ${downloadCount} images for ${slug}`);
  return localPortfolio;
}

// Main
async function main() {
  const companies = JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
  console.log(`🚀 Category Portfolio Scraper — ${companies.length} companies\n`);

  for (let i = 0; i < companies.length; i++) {
    const company = companies[i];

    // Scrape categories + images
    const portfolio = await scrapeCompanyCategories(company);

    // Download images locally
    if (Object.keys(portfolio).length > 0) {
      company.portfolio_categories = await downloadPortfolio(company.slug, portfolio);
    } else {
      company.portfolio_categories = {};
    }

    // Polite delay between companies
    if (i < companies.length - 1) {
      await delay(DELAY_MS);
    }
  }

  // Save updated JSON
  fs.writeFileSync(OUTPUT_JSON, JSON.stringify(companies, null, 2));
  console.log(`\n✓ Saved to ${OUTPUT_JSON}`);
}

main().catch(console.error);
```

**Step 2: Run the scraper on a few companies to test**

Run: `cd /Users/kp/Code/tarmeer-4.0-local && node scripts/uae-scraper/scrape-portfolio-categories.mjs 2>&1 | head -50`
Expected: Scraping output showing category discovery and image downloading

**Step 3: Commit**

```bash
git add scripts/uae-scraper/scrape-portfolio-categories.mjs
git commit -m "feat(scraper): add category-aware portfolio scraper"
```

---

## Task 3: Expand companies dataset to 100

**Files:**
- Modify: `scripts/uae-scraper/companies-data.json`

**Step 1: Research and add 70 new companies**

Use web search to find top UAE interior design companies. Add them to `companies-data.json` following the existing format. Priority order:

1. International firms with UAE offices (HBA, Gensler, Perkins&Will, DWP, Wilson Associates, Benoy, Woods Bagot, HOK, Stantec, NBBJ, Callison RTKL)
2. Regional award-winning firms (ANARCHITECT, Roar by Pallavi Dean, Bishop Design, LW Design, Elicyon, Kristina Zanic, 4SPACE, H2R Design, Lulie Fisher, Sneha Divias Atelier)
3. UAE local firms with high Google ratings (4.5+) and high review counts

Each entry needs: name_en, name_ar, slug, website, phone, email, whatsapp, city, area, address, services, specialties, year_established, google_rating, google_reviews_count, instagram, facebook, linkedin, source_platform.

**Step 2: Validate the JSON is well-formed**

Run: `node -e "JSON.parse(require('fs').readFileSync('scripts/uae-scraper/companies-data.json', 'utf-8')).length" `
Expected: `100`

**Step 3: Commit**

```bash
git add scripts/uae-scraper/companies-data.json
git commit -m "feat(data): expand companies dataset to 100 companies"
```

---

## Task 4: Run the category scraper on all 100 companies

**Step 1: Execute the full scrape**

Run: `cd /Users/kp/Code/tarmeer-4.0-local && node scripts/uae-scraper/scrape-portfolio-categories.mjs`

This will take a while (~30-60 minutes for 100 companies).

**Step 2: Verify results**

Run: `node -e "const d=JSON.parse(require('fs').readFileSync('scripts/uae-scraper/companies-data-final.json','utf-8')); d.forEach(c => console.log(c.name_en, Object.keys(c.portfolio_categories||{}).length, 'categories', Object.values(c.portfolio_categories||{}).flat().length, 'images'))"`

Expected: Each company showing category count and image count.

**Step 3: Commit the downloaded images and data**

```bash
git add scripts/uae-scraper/companies-data-final.json
git commit -m "feat(data): scraped portfolio images with categories for 100 companies"
```

Note: Portfolio images in `public/images/` should be committed separately or added to `.gitignore` and served from disk.

---

## Task 5: Update backend — portfolio_images schema and serialization

**Files:**
- Create: `server/schema/migration-2026-03-28-portfolio-categories.sql`
- Modify: `server/src/lib/publicCompaniesSerialization.ts`
- Test: `server/src/lib/publicCompaniesSerialization.test.ts`

**Step 1: Write the failing test for categorized portfolio serialization**

Add to `publicCompaniesSerialization.test.ts`:

```typescript
test('sanitizePublicCompany handles categorized portfolio_images object', () => {
  const company = sanitizePublicCompany({
    id: 1,
    slug: 'test-co',
    name_en: 'Test Co',
    description: 'A test company.',
    city: 'Dubai',
    address: 'Dubai, UAE',
    year_established: '2020',
    website: 'https://test.com',
    instagram: '',
    phone: '',
    email: '',
    services: '["Interior Design"]',
    specialties: '["Residential"]',
    logo_url: '/images/logo.png',
    portfolio_images: JSON.stringify({
      "Residential": [
        { "url": "/images/portfolio/test-co/residential/1.jpg", "title": "Villa A" },
        { "url": "/images/portfolio/test-co/residential/2.jpg", "title": "Villa B" }
      ],
      "Commercial": [
        { "url": "/images/portfolio/test-co/commercial/1.jpg", "title": "Office" }
      ]
    }),
    google_reviews_count: 50,
  });

  assert.deepEqual(company.portfolio_categories, {
    Residential: [
      { url: '/images/portfolio/test-co/residential/1.jpg', title: 'Villa A' },
      { url: '/images/portfolio/test-co/residential/2.jpg', title: 'Villa B' },
    ],
    Commercial: [
      { url: '/images/portfolio/test-co/commercial/1.jpg', title: 'Office' },
    ],
  });
  assert.equal(company.project_count, 3);
  // Backward compat: flat list still available
  assert.deepEqual(company.portfolio_images, [
    '/images/portfolio/test-co/residential/1.jpg',
    '/images/portfolio/test-co/residential/2.jpg',
    '/images/portfolio/test-co/commercial/1.jpg',
  ]);
});

test('sanitizePublicCompany still handles legacy flat portfolio_images array', () => {
  const company = sanitizePublicCompany({
    id: 2,
    slug: 'legacy-co',
    name_en: 'Legacy Co',
    description: '',
    city: 'Dubai',
    address: '',
    year_established: '2010',
    website: '',
    instagram: '',
    phone: '',
    email: '',
    services: '[]',
    specialties: '[]',
    logo_url: '/images/logo.png',
    portfolio_images: '["/images/1.jpg", "/images/2.jpg"]',
    google_reviews_count: 10,
  });

  assert.deepEqual(company.portfolio_images, ['/images/1.jpg', '/images/2.jpg']);
  assert.deepEqual(company.portfolio_categories, {
    Projects: [
      { url: '/images/1.jpg', title: '' },
      { url: '/images/2.jpg', title: '' },
    ],
  });
  assert.equal(company.project_count, 2);
});
```

**Step 2: Run test to verify it fails**

Run: `cd /Users/kp/Code/tarmeer-4.0-local/server && npx tsx --test src/lib/publicCompaniesSerialization.test.ts`
Expected: FAIL — `portfolio_categories` is not in the return value

**Step 3: Update serialization**

Modify `server/src/lib/publicCompaniesSerialization.ts`:

```typescript
import { parseJsonField } from './parseJsonField';
import { sanitizeImageUrls } from './publicImageCleanup';

function toPublicString(value: unknown) {
  return typeof value === 'string' ? value : '';
}

function sanitizeCompanyImage(value: unknown) {
  const url = toPublicString(value).trim();
  if (!url) return '';
  return url.startsWith('http://') || url.startsWith('https://') || url.startsWith('/') ? url : '';
}

interface PortfolioItem {
  url: string;
  title: string;
}

type PortfolioCategories = Record<string, PortfolioItem[]>;

function parsePortfolio(raw: unknown): { categories: PortfolioCategories; flat: string[] } {
  const parsed = typeof raw === 'string' ? parseJsonField(raw) : raw;

  // New format: { "Residential": [{ url, title }], "Commercial": [...] }
  if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
    const categories: PortfolioCategories = {};
    const flat: string[] = [];

    for (const [category, items] of Object.entries(parsed)) {
      if (!Array.isArray(items)) continue;
      const validItems: PortfolioItem[] = [];
      for (const item of items) {
        const url = sanitizeCompanyImage(typeof item === 'string' ? item : item?.url);
        if (url) {
          validItems.push({ url, title: typeof item === 'object' ? (item?.title || '') : '' });
          flat.push(url);
        }
      }
      if (validItems.length > 0) {
        categories[category] = validItems;
      }
    }

    return { categories, flat: sanitizeImageUrls(flat) };
  }

  // Legacy format: ["url1", "url2"]
  if (Array.isArray(parsed)) {
    const flat = sanitizeImageUrls(parsed);
    const categories: PortfolioCategories = {};
    if (flat.length > 0) {
      categories['Projects'] = flat.map((url) => ({ url, title: '' }));
    }
    return { categories, flat };
  }

  return { categories: {}, flat: [] };
}

export function sanitizePublicCompany(company: any) {
  const { categories, flat } = parsePortfolio(company.portfolio_images);

  return {
    id: company.id,
    slug: toPublicString(company.slug),
    name_en: toPublicString(company.name_en),
    description: toPublicString(company.description),
    city: toPublicString(company.city),
    address: toPublicString(company.address),
    year_established: toPublicString(company.year_established),
    website: toPublicString(company.website),
    instagram: toPublicString(company.instagram),
    phone: toPublicString(company.phone),
    email: toPublicString(company.email),
    services: parseJsonField(company.services) || [],
    specialties: parseJsonField(company.specialties) || [],
    logo_url: sanitizeCompanyImage(company.logo_url),
    portfolio_images: flat,
    portfolio_categories: categories,
    project_count: flat.length,
  };
}
```

**Step 4: Run test to verify it passes**

Run: `cd /Users/kp/Code/tarmeer-4.0-local/server && npx tsx --test src/lib/publicCompaniesSerialization.test.ts`
Expected: All tests PASS

**Step 5: Commit**

```bash
git add server/src/lib/publicCompaniesSerialization.ts server/src/lib/publicCompaniesSerialization.test.ts
git commit -m "feat(api): support categorized portfolio_images in serialization"
```

---

## Task 6: Update seed SQL generator

**Files:**
- Modify: `scripts/uae-scraper/scrape-logos.mjs` (the `generateSeedSQL` function)

**Step 1: Update generateSeedSQL to write categorized data**

In `scrape-logos.mjs`, change the `generateSeedSQL` function to serialize `portfolio_categories` into the `portfolio_images` field as a JSON object:

```javascript
function generateSeedSQL() {
  let sql = `-- Seed data: ${companies.length} UAE home renovation companies
-- Generated: ${new Date().toISOString().slice(0, 10)}
-- Run: mysql -u root -p tarmeer < server/schema/seed-uae-companies.sql

USE tarmeer;

`;

  for (const c of companies) {
    const services = JSON.stringify(c.services);
    const specialties = JSON.stringify(c.specialties);
    // Use categorized portfolio if available, fall back to flat array
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
```

**Step 2: Commit**

```bash
git add scripts/uae-scraper/scrape-logos.mjs
git commit -m "feat(scraper): update seed SQL generator for categorized portfolios"
```

---

## Task 7: Update frontend data types

**Files:**
- Modify: `src/lib/companyData.ts`
- Modify: `src/lib/publicApi.ts`

**Step 1: Update Company interface**

In `src/lib/companyData.ts`, add the `portfolioCategories` field:

```typescript
export interface PortfolioItem {
  url: string;
  title: string;
}

export type PortfolioCategories = Record<string, PortfolioItem[]>;

export interface Company {
  id: string;
  name: string;
  description: string;
  shortDescription: string;
  city: string;
  address: string;
  foundedYear: number;
  website?: string;
  instagram?: string;
  phone?: string;
  email?: string;
  styles: string[];
  projectCount: number;
  services: string[];
  featured: boolean;
  coverImage: string;
  projectImages: string[];
  portfolioCategories: PortfolioCategories;
}
```

**Step 2: Update publicApi.ts toCompany mapper**

In `src/lib/publicApi.ts`, update the `PublicCompanyRecord` interface and `toCompany` function:

Add to `PublicCompanyRecord`:
```typescript
  portfolio_categories: Record<string, { url: string; title: string }[]>;
```

Update the `toCompany` function:
```typescript
function toCompany(company: PublicCompanyRecord): Company {
  const projectImages = sanitizeImageUrls(Array.isArray(company.portfolio_images) ? company.portfolio_images : []);
  const description = company.description || '';

  // Build portfolioCategories from API data or fall back to flat images
  let portfolioCategories: PortfolioCategories = {};
  if (company.portfolio_categories && typeof company.portfolio_categories === 'object' && !Array.isArray(company.portfolio_categories)) {
    portfolioCategories = company.portfolio_categories;
  } else if (projectImages.length > 0) {
    portfolioCategories = { Projects: projectImages.map((url) => ({ url, title: '' })) };
  }

  return {
    id: String(company.slug || company.id),
    name: company.name_en || 'Tarmeer Company',
    description,
    shortDescription: summarizeCompanyDescription(description),
    city: company.city || 'UAE',
    address: company.address || 'UAE',
    foundedYear: normalizeFoundedYear(company.year_established),
    website: company.website || '',
    instagram: company.instagram || '',
    phone: company.phone || '',
    email: company.email || '',
    styles: Array.isArray(company.specialties) ? company.specialties : [],
    projectCount: company.project_count || projectImages.length,
    services: Array.isArray(company.services) ? company.services : [],
    featured: false,
    coverImage: company.logo_url || '',
    projectImages,
    portfolioCategories,
  };
}
```

**Step 3: Commit**

```bash
git add src/lib/companyData.ts src/lib/publicApi.ts
git commit -m "feat(frontend): add portfolioCategories to Company type and API mapper"
```

---

## Task 8: Build MasonryGallery component

**Files:**
- Create: `src/components/MasonryGallery.tsx`

**Step 1: Create the masonry gallery with category tabs**

```tsx
import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { PortfolioCategories } from '../lib/companyData';

interface MasonryGalleryProps {
  categories: PortfolioCategories;
  onImageClick: (url: string, categoryName: string, indexInCategory: number) => void;
}

const ITEMS_PER_PAGE = 12;

export default function MasonryGallery({ categories, onImageClick }: MasonryGalleryProps) {
  const categoryNames = useMemo(() => {
    const names = Object.keys(categories).filter((k) => categories[k].length > 0);
    return names.length > 1 ? ['All', ...names] : names;
  }, [categories]);

  const [activeTab, setActiveTab] = useState(categoryNames[0] || 'All');
  const [visibleCount, setVisibleCount] = useState(ITEMS_PER_PAGE);

  const activeImages = useMemo(() => {
    if (activeTab === 'All') {
      return Object.entries(categories).flatMap(([cat, items]) =>
        items.map((item) => ({ ...item, category: cat }))
      );
    }
    return (categories[activeTab] || []).map((item) => ({ ...item, category: activeTab }));
  }, [activeTab, categories]);

  const visibleImages = activeImages.slice(0, visibleCount);
  const hasMore = visibleCount < activeImages.length;

  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    setVisibleCount(ITEMS_PER_PAGE);
  };

  if (categoryNames.length === 0) return null;

  return (
    <section className="py-16 lg:py-24">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between mb-8">
          <h2 className="font-serif text-3xl lg:text-4xl text-[#1c1917] font-semibold">Portfolio</h2>
          <span className="text-sm text-[#6b6b6b]">{activeImages.length} projects</span>
        </div>

        {/* Category Tabs */}
        {categoryNames.length > 1 && (
          <div className="flex gap-1 mb-10 overflow-x-auto pb-2 -mx-4 px-4 sm:mx-0 sm:px-0">
            {categoryNames.map((tab) => (
              <button
                key={tab}
                onClick={() => handleTabChange(tab)}
                className={`relative px-5 py-2.5 rounded-full text-sm font-medium whitespace-nowrap transition-all ${
                  activeTab === tab
                    ? 'bg-[#1c1917] text-white'
                    : 'text-[#6b6b6b] hover:text-[#1c1917] hover:bg-stone-100'
                }`}
              >
                {tab}
                {activeTab === tab && categories[tab] && (
                  <span className="ml-1.5 text-xs text-white/60">
                    {tab === 'All' ? activeImages.length : categories[tab].length}
                  </span>
                )}
              </button>
            ))}
          </div>
        )}

        {/* Masonry Grid */}
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.3 }}
            className="columns-1 sm:columns-2 lg:columns-3 xl:columns-4 gap-4"
          >
            {visibleImages.map((image, index) => (
              <motion.button
                key={`${image.url}-${index}`}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: Math.min(index * 0.05, 0.5) }}
                onClick={() => {
                  const catImages = categories[image.category] || [];
                  const idxInCat = catImages.findIndex((i) => i.url === image.url);
                  onImageClick(image.url, image.category, idxInCat >= 0 ? idxInCat : 0);
                }}
                className="group relative w-full mb-4 break-inside-avoid rounded-xl overflow-hidden bg-stone-100 block"
              >
                <img
                  src={image.url}
                  alt={image.title || `Project ${index + 1}`}
                  className="w-full h-auto object-cover group-hover:scale-105 transition duration-500"
                  loading="lazy"
                />
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition duration-300" />
                {image.title && (
                  <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/50 to-transparent opacity-0 group-hover:opacity-100 transition duration-300">
                    <p className="text-white text-sm font-medium">{image.title}</p>
                    <p className="text-white/70 text-xs">{image.category}</p>
                  </div>
                )}
              </motion.button>
            ))}
          </motion.div>
        </AnimatePresence>

        {/* Load More */}
        {hasMore && (
          <div className="text-center mt-10">
            <button
              onClick={() => setVisibleCount((prev) => prev + ITEMS_PER_PAGE)}
              className="px-8 py-3 rounded-full border border-stone-200 text-sm font-medium text-[#1c1917] hover:bg-stone-50 transition"
            >
              Load more ({activeImages.length - visibleCount} remaining)
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
```

**Step 2: Commit**

```bash
git add src/components/MasonryGallery.tsx
git commit -m "feat(ui): add MasonryGallery component with category tabs"
```

---

## Task 9: Build light-theme Lightbox component

**Files:**
- Create: `src/components/Lightbox.tsx`

**Step 1: Create the lightbox**

```tsx
import { useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';
import type { PortfolioItem } from '../lib/companyData';

interface LightboxProps {
  open: boolean;
  images: PortfolioItem[];
  currentIndex: number;
  categoryName: string;
  onClose: () => void;
  onNavigate: (index: number) => void;
}

export default function Lightbox({ open, images, currentIndex, categoryName, onClose, onNavigate }: LightboxProps) {
  const current = images[currentIndex];
  const hasPrev = currentIndex > 0;
  const hasNext = currentIndex < images.length - 1;

  const goNext = useCallback(() => {
    if (hasNext) onNavigate(currentIndex + 1);
  }, [currentIndex, hasNext, onNavigate]);

  const goPrev = useCallback(() => {
    if (hasPrev) onNavigate(currentIndex - 1);
  }, [currentIndex, hasPrev, onNavigate]);

  useEffect(() => {
    if (!open) return;

    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight') goNext();
      if (e.key === 'ArrowLeft') goPrev();
    };

    document.addEventListener('keydown', handleKey);
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', handleKey);
      document.body.style.overflow = '';
    };
  }, [open, goNext, goPrev, onClose]);

  if (!open || !current) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex flex-col"
        onClick={onClose}
      >
        {/* Semi-transparent warm overlay */}
        <div className="absolute inset-0 bg-[#faf9f7]/95 backdrop-blur-sm" />

        {/* Top bar */}
        <div className="relative z-10 flex items-center justify-between px-6 py-4">
          <div className="text-sm text-[#6b6b6b]">
            <span className="font-medium text-[#1c1917]">{categoryName}</span>
            <span className="mx-2">/</span>
            <span>{currentIndex + 1} of {images.length}</span>
          </div>
          <button
            onClick={onClose}
            className="w-10 h-10 rounded-full bg-white shadow-sm hover:bg-stone-50 flex items-center justify-center transition border border-stone-100"
          >
            <X className="w-5 h-5 text-[#2c2c2c]" />
          </button>
        </div>

        {/* Main image area */}
        <div className="relative z-10 flex-1 flex items-center justify-center px-16" onClick={onClose}>
          {hasPrev && (
            <button
              onClick={(e) => { e.stopPropagation(); goPrev(); }}
              className="absolute left-4 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-white shadow-md hover:bg-stone-50 flex items-center justify-center transition border border-stone-100"
            >
              <ChevronLeft className="w-6 h-6 text-[#2c2c2c]" />
            </button>
          )}

          <motion.img
            key={current.url}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.3 }}
            src={current.url}
            alt={current.title || `Image ${currentIndex + 1}`}
            className="max-w-[85vw] max-h-[70vh] object-contain rounded-lg shadow-lg"
            onClick={(e) => e.stopPropagation()}
          />

          {hasNext && (
            <button
              onClick={(e) => { e.stopPropagation(); goNext(); }}
              className="absolute right-4 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-white shadow-md hover:bg-stone-50 flex items-center justify-center transition border border-stone-100"
            >
              <ChevronRight className="w-6 h-6 text-[#2c2c2c]" />
            </button>
          )}
        </div>

        {/* Image title */}
        {current.title && (
          <div className="relative z-10 text-center py-3">
            <p className="text-sm font-medium text-[#1c1917]">{current.title}</p>
          </div>
        )}

        {/* Thumbnail strip */}
        <div className="relative z-10 px-6 py-4 bg-white border-t border-stone-100 shadow-sm">
          <div className="flex gap-2 overflow-x-auto max-w-4xl mx-auto justify-center">
            {images.map((img, idx) => (
              <button
                key={idx}
                onClick={(e) => { e.stopPropagation(); onNavigate(idx); }}
                className={`flex-shrink-0 w-16 h-12 rounded-lg overflow-hidden transition-all ${
                  idx === currentIndex
                    ? 'ring-2 ring-[#c6a065] opacity-100'
                    : 'opacity-50 hover:opacity-80'
                }`}
              >
                <img
                  src={img.url}
                  alt={img.title || `Thumb ${idx + 1}`}
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
              </button>
            ))}
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
```

**Step 2: Commit**

```bash
git add src/components/Lightbox.tsx
git commit -m "feat(ui): add light-theme Lightbox component with thumbnails and keyboard nav"
```

---

## Task 10: Redesign CompanyDetailPage

**Files:**
- Modify: `src/pages/CompanyDetailPage.tsx`

**Step 1: Rewrite the full company detail page**

Replace the entire file with the new design. Key changes:

- Full-screen hero (100vh) with parallax effect
- Stats bar with Google rating added
- About + Contact 2-column layout (mostly unchanged structure)
- Replace old "Featured Projects" grid with `<MasonryGallery>` component
- Replace old Lightbox with new `<Lightbox>` component
- Add scroll-down indicator to hero
- Add Framer Motion entrance animations throughout

The page structure becomes:

```tsx
import { useEffect, useState, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion, useScroll, useTransform } from 'framer-motion';
import { ArrowLeft, Globe, Instagram, Phone, Mail, MapPin, Briefcase, ExternalLink, Star, ChevronDown } from 'lucide-react';
import type { Company, PortfolioItem } from '../lib/companyData';
import { fetchPublicCompanyDetail } from '../lib/publicApi';
import MasonryGallery from '../components/MasonryGallery';
import Lightbox from '../components/Lightbox';

export default function CompanyDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [company, setCompany] = useState<Company | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  // Lightbox state
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxCategory, setLightboxCategory] = useState('');
  const [lightboxIndex, setLightboxIndex] = useState(0);

  // Parallax
  const { scrollY } = useScroll();
  const heroY = useTransform(scrollY, [0, 600], [0, 150]);
  const heroOpacity = useTransform(scrollY, [0, 400], [1, 0.3]);

  useEffect(() => {
    if (!id) { setLoadError('Company not found'); setLoading(false); return; }
    let active = true;
    setLoading(true);
    setLoadError('');
    fetchPublicCompanyDetail(id)
      .then((item) => { if (active) setCompany(item); })
      .catch((err) => { if (active) setLoadError(err instanceof Error ? err.message : 'Failed'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [id]);

  const handleImageClick = useCallback((url: string, categoryName: string, indexInCategory: number) => {
    setLightboxCategory(categoryName);
    setLightboxIndex(indexInCategory);
    setLightboxOpen(true);
  }, []);

  // ... loading / error states same as current ...

  const heroImage = company.projectImages[0] || '';
  const lightboxImages: PortfolioItem[] = company.portfolioCategories[lightboxCategory] || [];

  return (
    <div className="min-h-screen bg-white">
      {/* Fixed Nav — same as current but with company.name */}
      {/* Full-Screen Hero with Parallax */}
      {/* Stats Bar — add Google rating star */}
      {/* About + Contact 2-column */}
      {/* MasonryGallery component */}
      <MasonryGallery
        categories={company.portfolioCategories}
        onImageClick={handleImageClick}
      />
      {/* Lightbox */}
      <Lightbox
        open={lightboxOpen}
        images={lightboxImages}
        currentIndex={lightboxIndex}
        categoryName={lightboxCategory}
        onClose={() => setLightboxOpen(false)}
        onNavigate={setLightboxIndex}
      />
      {/* Footer CTA */}
    </div>
  );
}
```

The full implementation should preserve the loading/error states, nav, stats bar, and contact sidebar from the current version, but replace the hero and gallery sections with the new design.

**Step 2: Verify the page renders**

Run: `cd /Users/kp/Code/tarmeer-4.0-local && npm run dev`
Open: `http://localhost:5173/companies/algedra` in browser
Expected: New layout with full-screen hero, category tabs, masonry gallery

**Step 3: Commit**

```bash
git add src/pages/CompanyDetailPage.tsx
git commit -m "feat(ui): redesign CompanyDetailPage with hero parallax, masonry gallery, and category tabs"
```

---

## Task 11: Update local fallback data for new Company shape

**Files:**
- Modify: `src/data/companies.ts`

**Step 1: Add portfolioCategories to local fallback companies**

Update each company object in `src/data/companies.ts` to include the new `portfolioCategories` field. For the existing local data, wrap the existing `projectImages` into a default category:

```typescript
portfolioCategories: {
  Projects: [
    { url: '/images/designers/projects/covers/cover-001.jpg', title: '' },
    // ... existing images mapped
  ],
},
```

**Step 2: Verify TypeScript compiles**

Run: `cd /Users/kp/Code/tarmeer-4.0-local && npx tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add src/data/companies.ts
git commit -m "feat(data): add portfolioCategories to local fallback company data"
```

---

## Task 12: Final integration test

**Step 1: Run all server tests**

Run: `cd /Users/kp/Code/tarmeer-4.0-local/server && npx tsx --test src/lib/*.test.ts`
Expected: All tests PASS

**Step 2: Run scraper tests**

Run: `node --test scripts/uae-scraper/scrape-logos-lib.test.mjs`
Expected: All tests PASS

**Step 3: Build frontend**

Run: `cd /Users/kp/Code/tarmeer-4.0-local && npm run build`
Expected: Build succeeds with no errors

**Step 4: Visual check**

Run: `npm run dev`
Check:
- `/companies` — list page shows companies with images
- `/companies/algedra` — detail page shows new hero, stats, masonry gallery
- Category tabs work (if company has categories)
- Lightbox opens in light theme with thumbnails
- Mobile responsive layout
- Parallax hero scroll effect

**Step 5: Commit**

```bash
git add -A
git commit -m "feat: complete portfolio enhancement with categorized gallery and page redesign"
```
