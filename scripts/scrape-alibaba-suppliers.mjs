/**
 * Alibaba Supplier Scraper — anti-bot edition
 * Usage: node scripts/scrape-alibaba-suppliers.mjs [limit]
 *
 * Extracts per supplier:
 *   - logo, banner/cover images (large)
 *   - company name, location, years, staff count
 *   - main categories, business type
 *   - company profile / description
 *   - products (name, price, image, min order)
 *   - project cases
 *
 * Output: scripts/alibaba-suppliers.json
 */

import puppeteer from 'puppeteer';
import { writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const SEARCH_URL =
  'https://www.alibaba.com/search/page?categoryId=201257885' +
  '&SearchText=%E9%80%A0%E5%9E%8B%E7%81%AF' +
  '&indexArea=product_en&fsb=y&SearchScene=suppliers&verifiedManufactory=true';

const LIMIT = parseInt(process.argv[2] ?? '3', 10);

// Strip Alibaba CDN size suffix to get original-quality image
// e.g. "file_480x480.jpg" → "file.jpg"  |  "file.jpg_960x960.jpg" → "file.jpg"
function hdUrl(url) {
  if (!url) return url;
  return url
    .replace(/\.jpg_\d+x\d+\.jpg/gi, '.jpg')
    .replace(/\.png_\d+x\d+\.jpg/gi, '.png')
    .replace(/_\d+x\d+\.(jpg|jpeg|png|webp)/gi, '.$1');
}

// ── Anti-bot helpers ──────────────────────────────────────────────────────────

// Random delay: base ± 40%
const sleep = (ms) => {
  const jitter = ms * 0.4 * (Math.random() * 2 - 1);
  return new Promise((r) => setTimeout(r, Math.max(500, ms + jitter)));
};

const USER_AGENTS = [
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_4) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15',
];
const randomUA = () => USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];

async function humanScroll(page) {
  await page.evaluate(async () => {
    await new Promise((resolve) => {
      let y = 0;
      const step = () => {
        const dist = 200 + Math.random() * 300;
        window.scrollBy(0, dist);
        y += dist;
        if (y < document.body.scrollHeight) {
          setTimeout(step, 100 + Math.random() * 200);
        } else {
          resolve();
        }
      };
      step();
    });
  });
}

// Move mouse randomly to appear human
async function randomMouseMove(page) {
  for (let i = 0; i < 3; i++) {
    await page.mouse.move(
      200 + Math.random() * 800,
      200 + Math.random() * 400,
      { steps: 10 }
    );
    await sleep(300);
  }
}

async function setupPage(browser) {
  const page = await browser.newPage();
  const ua = randomUA();
  await page.setViewport({ width: 1440, height: 900 });
  await page.setUserAgent(ua);
  await page.setExtraHTTPHeaders({
    'Accept-Language': 'en-US,en;q=0.9',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
    'sec-ch-ua': '"Chromium";v="124", "Google Chrome";v="124", "Not-A.Brand";v="99"',
    'sec-ch-ua-mobile': '?0',
    'sec-ch-ua-platform': '"macOS"',
    'Sec-Fetch-Dest': 'document',
    'Sec-Fetch-Mode': 'navigate',
    'Sec-Fetch-Site': 'none',
  });
  // Hide automation fingerprint
  await page.evaluateOnNewDocument(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
    Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
    Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en'] });
    window.chrome = { runtime: {} };
    // Override permissions query
    const originalQuery = window.navigator.permissions?.query;
    if (originalQuery) {
      window.navigator.permissions.query = (params) =>
        params.name === 'notifications'
          ? Promise.resolve({ state: Notification.permission })
          : originalQuery(params);
    }
  });
  return page;
}

// ── Get supplier links from search results ────────────────────────────────────

async function getSupplierLinks(page, limit) {
  console.log('Loading search results…');
  await page.goto(SEARCH_URL, { waitUntil: 'networkidle2', timeout: 60_000 });
  await sleep(6000); // wait for React to render supplier cards
  await humanScroll(page);
  await sleep(2000);

  const links = await page.evaluate((lim) => {
    const seen = new Set();
    const result = [];
    // Supplier pages appear as subdomain links: {id}.en.alibaba.com
    for (const a of document.querySelectorAll('a[href*=".en.alibaba.com"]')) {
      const m = a.href.match(/^(https:\/\/[a-z0-9-]+\.en\.alibaba\.com)/i);
      if (!m) continue;
      const base = m[1];
      if (seen.has(base)) continue;
      seen.add(base);
      result.push(base + '/');
      if (result.length >= lim) break;
    }
    return result;
  }, limit);

  console.log(`Found ${links.length} supplier(s):`, links);
  return links;
}

// ── Extract supplier home page ────────────────────────────────────────────────

async function extractHome(page, url) {
  await page.goto(url, { waitUntil: 'networkidle2', timeout: 60_000 });
  await sleep(3000);
  await humanScroll(page);
  await sleep(1500);

  return page.evaluate(() => {
    const txt = (el) => el?.innerText?.trim() ?? null;

    // Name from h1 or title
    const name =
      txt(document.querySelector('h1')) ??
      document.title.replace('Company Overview - ', '').replace(' - Alibaba.com', '').trim();

    // Logo
    const logo =
      document.querySelector('img.logo-img, img[class*=logo], .logo img')?.src ?? null;

    // Banner/cover images — prefer wide-banner-img (3840px), fallback shop-sign
    const bannerImages = [
      ...document.querySelectorAll('img.wide-banner-img, img.shop-sign-back-img, [class*=banner] img, [class*=cover] img'),
    ]
      .filter((img) => img.src && !img.src.includes('icon') && !img.src.includes('logo'))
      .map((img) => img.src)
      .filter((src, i, arr) => arr.indexOf(src) === i) // unique
      .slice(0, 5);

    // Location & years: try .location-item first, then fall back to body text
    const locationItems = [...document.querySelectorAll('.location-item')].map(txt);
    let yearItem = locationItems.find((t) => t && /\d+\s*yrs?/i.test(t));
    let cityItem = locationItems.find((t) => t && !(/\d+\s*yrs?/i.test(t)) && t.includes(','));

    // Body-text fallback for suppliers with different templates (e.g. plain "Supplier" type)
    if (!yearItem || !cityItem) {
      const bt = document.body.innerText;
      if (!yearItem) {
        const ym = bt.match(/(\d+)\s*YRS?\b/i);
        if (ym) yearItem = ym[0];
      }
      if (!cityItem) {
        // Look for "City, Country" pattern near top of page
        const lm = bt.match(/\b([A-Z][a-z]+(?:\s[A-Z][a-z]+)*),\s*(China|UAE|India|Vietnam|Hong Kong|Taiwan)\b/);
        if (lm) cityItem = lm[0];
      }
    }

    const yearsRaw = yearItem?.match(/(\d+)/)?.[1] ?? null;
    const locationRaw = cityItem ?? null;
    let location = null;
    if (locationRaw) {
      const parts = locationRaw.split(',').map((s) => s.trim());
      location = { province: parts[0] ?? null, country: parts[1] ?? null, raw: locationRaw };
    }

    // Business type / certified label
    const businessType = txt(document.querySelector('[class*=custom-manuf], [class*=business-type], .comp-type')) ?? null;

    // Main categories (appears as "Main categories: X, Y, Z")
    let mainCategories = null;
    const bodyText = document.body.innerText;
    const catMatch = bodyText.match(/Main categories?:\s*([^\n]+)/i);
    if (catMatch) mainCategories = catMatch[1].trim().split(/,\s*/);

    // Staff, production lines from hover stats
    const statEls = [...document.querySelectorAll('.hover-span.value, .value')];
    const findStat = (keyword) => {
      for (const el of statEls) {
        const parentText = el.parentElement?.innerText?.trim() ?? '';
        if (parentText.toLowerCase().includes(keyword.toLowerCase())) {
          return el.innerText?.trim() ?? null;
        }
      }
      return null;
    };

    const staff = findStat('Total staff') ?? findStat('staff');
    const productionLines = findStat('Production line');

    // Certifications: extract individual cert names from body text
    const KNOWN_CERTS = ['CE', 'RoHS', 'FCC', 'EMC', 'UL', 'ETL', 'CB', 'ISO 9001', 'BSCI', 'UKCA', 'CCC', 'SAA'];
    const bodyForCerts = document.body.innerText;
    const certifications = KNOWN_CERTS.filter((c) => new RegExp(`\\b${c}\\b`).test(bodyForCerts));

    return {
      name,
      logo,
      bannerImages,
      location,
      years: yearsRaw ? parseInt(yearsRaw, 10) : null,
      businessType,
      mainCategories,
      staff: staff ? parseInt(staff, 10) : null,
      productionLines: productionLines ? parseInt(productionLines, 10) : null,
      certifications,
    };
  });
}

// ── Extract company profile / description ─────────────────────────────────────

async function extractProfile(page, baseUrl) {
  // company_profile.html often resolves to the same home page on Alibaba
  // All company profile info is embedded in the body text of the main page
  const profileUrl = baseUrl.replace(/\/$/, '') + '/company_profile.html';
  try {
    await page.goto(profileUrl, { waitUntil: 'networkidle2', timeout: 45_000 });
    await sleep(2000);
    await humanScroll(page);
    await sleep(1000);

    return page.evaluate(() => {
      const bodyText = document.body.innerText;

      // Parse structured facts from the body text
      const extract = (pattern) => {
        const m = bodyText.match(pattern);
        return m ? m[1].trim() : null;
      };

      const floorSpace = extract(/Floor\s*space\s*\(㎡\)\s*\n([^\n]+)/i);
      const registrationDate = extract(/Company registration date\s*\n([^\n]+)/i);
      const acceptedLanguages = extract(/Accepted languages\s*\n([^\n]+)/i);
      const yearsExporting = extract(/Years exporting\s*\n([^\n]+)/i);
      const productionLines = extract(/Production lines\s*\n([^\n]+)/i);
      const productionMachines = extract(/Production machines\s*\n([^\n]+)/i);
      const mainMarkets = extract(/Main markets\s*\n([^\n]+)/i);

      // Certifications: match cert blocks (e.g. "CE\nLCSB04285057E")
      const certMatches = [...bodyText.matchAll(/\b(CE|RoHS|FCC|EMC|ISO\s*\d+|UL|ETL|CB|BSCI|UKCA|CCC)\b/g)];
      const certifications = [...new Set(certMatches.map((m) => m[1].trim()))];

      // Factory / production images
      const factoryImages = [...document.querySelectorAll(
        '[class*=factory] img, [class*=Factory] img, [class*=production] img, [class*=Production] img'
      )]
        .map((img) => img.src)
        .filter((src) => src && !src.includes('icon') && !src.includes('avatar'))
        .filter((src, i, arr) => arr.indexOf(src) === i)
        .slice(0, 10);

      // All large images on the profile page
      const profileImages = [...document.querySelectorAll('img')]
        .filter((img) => img.src && (img.naturalWidth > 400 || img.width > 400))
        .filter((img) => !img.src.includes('icon') && !img.src.includes('logo') && !img.src.includes('avatar'))
        .map((img) => img.src)
        .filter((src, i, arr) => arr.indexOf(src) === i)
        .slice(0, 12);

      // Description: try CSS selector first, then fall back to body-text paragraph extraction
      const descEl = [...document.querySelectorAll('p, [class*=desc], [class*=intro], [class*=about]')]
        .filter((el) => {
          const t = el.innerText?.trim() ?? '';
          return t.length > 100 && !t.startsWith('What are you looking for') && !t.includes('Sign in');
        })
        .sort((a, b) => (b.innerText?.length ?? 0) - (a.innerText?.length ?? 0))[0];

      let description = descEl?.innerText?.trim() ?? null;

      // Fallback: parse body text for company-intro paragraphs
      // (some suppliers use plain text blocks with no special class)
      if (!description) {
        const UI_NOISE = /^(What are you looking for|Sign in|Create account|Deliver to|Search|Home|Products|Company profile|Contacts|Promotion|Chat now|Contact supplier|Top picks|View more|\.|[\s\d]+$)/i;
        const paragraphs = document.body.innerText
          .split(/\n{2,}/)
          .map((p) => p.replace(/\n/g, ' ').trim())
          .filter((p) => p.length > 80 && !UI_NOISE.test(p));

        // Find the longest consecutive run of "real" paragraphs
        // (company intros are usually 2-6 paragraphs in a row)
        const candidateBlocks = [];
        let block = [];
        for (const p of paragraphs) {
          // A "company intro" paragraph: starts with capital, contains full sentences
          if (/^[A-Z]/.test(p) && p.includes('.')) {
            block.push(p);
          } else {
            if (block.length >= 2) candidateBlocks.push([...block]);
            block = [];
          }
        }
        if (block.length >= 2) candidateBlocks.push(block);

        if (candidateBlocks.length > 0) {
          const best = candidateBlocks.sort((a, b) =>
            b.reduce((s, p) => s + p.length, 0) - a.reduce((s, p) => s + p.length, 0)
          )[0];
          description = best.join('\n\n');
        }
      }

      return {
        description,
        floorSpace,
        registrationDate,
        acceptedLanguages,
        yearsExporting,
        productionLines: productionLines ? parseInt(productionLines, 10) : null,
        productionMachines: productionMachines ? parseInt(productionMachines, 10) : null,
        mainMarkets,
        certifications,
        factoryImages,
        profileImages,
      };
    });
  } catch (e) {
    console.log(`  Profile page unavailable: ${e.message}`);
    return { description: null, factoryImages: [], profileImages: [], certifications: [] };
  }
}

// ── Extract products ──────────────────────────────────────────────────────────

async function extractProducts(page, baseUrl) {
  const productsUrl = baseUrl.replace(/\/$/, '') + '/productlist.html';
  try {
    await page.goto(productsUrl, { waitUntil: 'networkidle2', timeout: 45_000 });
    await sleep(2000);
    await humanScroll(page);
    await sleep(1000);

    return page.evaluate(() => {
      const txt = (el) => el?.innerText?.trim() ?? null;

      // Alibaba uses .icbu-product-card as the main product card class
      const cards = [...document.querySelectorAll('.icbu-product-card, .item-v2, .J-offerItem')];

      return cards.slice(0, 20).map((card) => {
        // Image: react-dove-image is the product photo
        const imgEl = card.querySelector('img.react-dove-image, img[src*="alicdn"], img[src]');
        const image = imgEl?.src ?? imgEl?.getAttribute('data-src') ?? null;

        // Title: .title-con is the actual product name span
        const name = txt(card.querySelector('.title-con, .title, [class*=title-con]')) ?? null;

        // Price: .num holds the price string
        const price = txt(card.querySelector('.num, [class*=price-num], [class*=Price]')) ?? null;

        // Min order: .moq
        const minOrder = txt(card.querySelector('.moq, [class*=moq], [class*=min-order]'))
          ?.replace(/\s*\d+\s*(recent viewed|sold)\s*$/i, '').trim() ?? null;

        // Product page link
        const link = card.querySelector('a.product-image, a[href*="product-detail"]')?.href ?? null;

        return { name, image, price, minOrder, link };
      }).filter((p) => p.name || p.image);
    });
  } catch (e) {
    console.log(`  Products page unavailable: ${e.message}`);
    return [];
  }
}

// ── Extract project cases ─────────────────────────────────────────────────────

async function extractProjects(page, baseUrl) {
  // Try common project page URLs
  const candidates = [
    '/project_list.html',
    '/projects.html',
    '/showroom/list.html',
  ];

  for (const suffix of candidates) {
    const url = baseUrl.replace(/\/$/, '') + suffix;
    try {
      const resp = await page.goto(url, { waitUntil: 'networkidle2', timeout: 30_000 });
      if (resp?.status() !== 200) continue;
      await sleep(2000);

      const projects = await page.evaluate(() => {
        const txt = (el) => el?.innerText?.trim() ?? null;
        const cards = [...document.querySelectorAll('[class*=project], [class*=Project], [class*=case], [class*=Case], [class*=showroom]')];
        return cards.slice(0, 10).map((card) => {
          const imgEl = card.querySelector('img');
          return {
            title: txt(card.querySelector('[class*=title], [class*=name], h3, h4')) ?? null,
            description: txt(card.querySelector('p, [class*=desc]')) ?? null,
            image: imgEl?.src ?? imgEl?.getAttribute('data-src') ?? null,
          };
        }).filter((p) => p.title || p.image);
      });

      if (projects.length > 0) return projects;
    } catch (_) {
      // try next
    }
  }

  return [];
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-blink-features=AutomationControlled',
      '--window-size=1440,900',
      '--disable-features=IsolateOrigins,site-per-process',
    ],
  });

  const results = [];

  try {
    const searchPage = await setupPage(browser);
    const supplierLinks = await getSupplierLinks(searchPage, LIMIT);
    await searchPage.close();

    if (supplierLinks.length === 0) {
      console.error('No suppliers found. Check scripts/alibaba-debug.png');
      const dbgPage = await setupPage(browser);
      await dbgPage.goto(SEARCH_URL, { waitUntil: 'networkidle2', timeout: 60_000 });
      await sleep(6000);
      await dbgPage.screenshot({ path: path.join(__dirname, 'alibaba-debug.png'), fullPage: true });
      await dbgPage.close();
      return;
    }

    for (const [i, baseUrl] of supplierLinks.entries()) {
      console.log(`\n━━━ Supplier ${i + 1}/${supplierLinks.length}: ${baseUrl} ━━━`);
      const page = await setupPage(browser);

      try {
        // 1. Home page
        console.log('  [1/4] Home page…');
        const home = await extractHome(page, baseUrl);
        console.log(`    name: ${home.name}`);
        console.log(`    location: ${home.location?.raw ?? 'n/a'}`);
        console.log(`    banner images: ${home.bannerImages.length}`);

        // 2. Company profile
        console.log('  [2/4] Company profile…');
        await sleep(1500 + Math.random() * 1000);
        const profile = await extractProfile(page, baseUrl);
        console.log(`    description: ${profile.description ? profile.description.substring(0, 80) + '…' : 'n/a'}`);

        // 3. Products
        console.log('  [3/4] Products…');
        await sleep(1500 + Math.random() * 1000);
        const products = await extractProducts(page, baseUrl);
        console.log(`    products: ${products.length}`);

        // 4. Project cases
        console.log('  [4/4] Project cases…');
        await sleep(1500 + Math.random() * 1000);
        const projects = await extractProjects(page, baseUrl);
        console.log(`    projects: ${projects.length}`);

        results.push({
          url: baseUrl,
          ...home,
          logo: hdUrl(home.logo),
          bannerImages: (home.bannerImages ?? []).map(hdUrl),
          certifications: [...new Set([...(home.certifications ?? []), ...(profile.certifications ?? [])])],
          profile: profile.description,
          floorSpace: profile.floorSpace,
          registrationDate: profile.registrationDate,
          productionLines: home.productionLines ?? profile.productionLines,
          productionMachines: profile.productionMachines,
          mainMarkets: profile.mainMarkets,
          factoryImages: (profile.factoryImages ?? []).map(hdUrl),
          profileImages: (profile.profileImages ?? []).map(hdUrl),
          products: products.map(p => ({ ...p, image: hdUrl(p.image) })),
          projects,
        });
      } catch (err) {
        console.error(`  ✗ Failed: ${err.message}`);
        results.push({ url: baseUrl, error: err.message });
      } finally {
        await page.close();
      }

      // Polite inter-supplier delay (4-7s)
      if (i < supplierLinks.length - 1) await sleep(4000 + Math.random() * 3000);
    }
  } finally {
    await browser.close();
  }

  const out = path.join(__dirname, 'alibaba-suppliers.json');
  writeFileSync(out, JSON.stringify(results, null, 2), 'utf8');
  console.log(`\n✓ Saved ${results.length} supplier(s) → ${out}`);
  console.log(JSON.stringify(results, null, 2));
}

main().catch((e) => { console.error(e); process.exit(1); });
