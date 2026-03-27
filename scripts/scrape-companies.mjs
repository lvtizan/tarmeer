import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';

// Real UAE design companies to scrape
const COMPANIES_TO_SCRAPE = [
  {
    name: 'Bishop Design',
    website: 'https://bishopdesign.ae',
    type: 'interior-design',
  },
  {
    name: 'LW Design',
    website: 'https://lw-design.com',
    type: 'interior-design',
  },
  {
    name: 'ROCK',
    website: 'https://rock.ae',
    type: 'interior-design',
  },
  {
    name: 'Zachary O Design',
    website: 'https://www.zacharyodesign.com',
    type: 'interior-design',
  },
  {
    name: 'Bureau B architects',
    website: 'https://www.bureaubarchitects.com',
    type: 'architecture',
  },
  {
    name: 'DAR',
    website: 'https://dar.ae',
    type: 'architecture',
  },
  {
    name: 'Keo',
    website: 'https://keo.design',
    type: 'architecture',
  },
  {
    name: 'Sun Engineering',
    website: 'https://www.suneng.net',
    type: 'architecture',
  },
  {
    name: 'Misty',
    website: 'https://misty.com',
    type: 'interior-design',
  },
  {
    name: 'ANARCHITECT',
    website: 'https://anarchitect.ae',
    type: 'architecture',
  },
];

// Delay to avoid overwhelming servers
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function scrapeCompany(browser, companyInfo) {
  const page = await browser.newPage();
  const results = {
    name: companyInfo.name,
    website: companyInfo.website,
    type: companyInfo.type,
    logo: null,
    description: '',
    address: '',
    phone: '',
    email: '',
    instagram: '',
    foundedYear: null,
    projectImages: [],
    services: [],
    styles: [],
    city: 'Dubai', // Default
    error: null,
  };

  try {
    console.log(`\n🔍 Scraping ${companyInfo.name}...`);

    // Set user agent to avoid blocking
    await page.setUserAgent(
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    );

    // Navigate to website
    const response = await page.goto(companyInfo.website, {
      waitUntil: 'networkidle2',
      timeout: 30000,
    });

    if (!response.ok()) {
      throw new Error(`HTTP ${response.status()}`);
    }

    // Extract basic info from meta tags
    const metaInfo = await page.evaluate(() => {
      const getMeta = (selector) => {
        const el = document.querySelector(selector);
        return el?.getAttribute('content') || '';
      };

      const getOg = (property) => {
        const el = document.querySelector(`meta[property="og:${property}"]`);
        return el?.getAttribute('content') || '';
      };

      return {
        description: getMeta('meta[name="description"]') || getOg('description'),
        ogImage: getOg('image'),
        twitterImage: getMeta('meta[name="twitter:image"]'),
        siteName: getOg('site_name'),
      };
    });
    results.description = metaInfo.description;

    // Try to find logo
    const logoInfo = await page.evaluate(() => {
      // Try common logo selectors
      const logoSelectors = [
        '.logo img',
        '.site-logo img',
        'header img[alt*="logo" i]',
        'img[alt*="Logo" i]',
        '.brand img',
        '.navbar-brand img',
        '#logo img',
      ];

      for (const selector of logoSelectors) {
        const el = document.querySelector(selector);
        if (el) {
          return {
            src: el.src || el.getAttribute('data-src'),
            alt: el.alt,
          };
        }
      }

      // Look for first SVG logo
      const svg = document.querySelector('.logo svg, .site-logo svg');
      if (svg) {
        const serializer = new XMLSerializer();
        return {
          src: `data:image/svg+xml,${encodeURIComponent(serializer.serializeToString(svg))}`,
          alt: 'logo',
        };
      }

      return null;
    });
    if (logoInfo?.src) {
      results.logo = logoInfo.src;
    }

    // Try to find contact information
    const contactInfo = await page.evaluate(() => {
      const info = {
        phone: '',
        email: '',
        address: '',
        instagram: '',
        foundedYear: null,
      };

      // Phone
      const phonePatterns = [
        'a[href*="tel:"]',
        'a[href*="callto:"]',
        'a[href*="phone"]',
      ];
      for (const pattern of phonePatterns) {
        const el = document.querySelector(pattern);
        if (el) {
          info.phone = el.textContent || el.href.replace(/^(tel:|callto:)/i, '');
          break;
        }
      }

      // Email
      const emailEl = document.querySelector('a[href*="mailto:"]');
      if (emailEl) {
        info.email = emailEl.href.replace(/^mailto:/i, '');
      }

      // Address
      const addressSelectors = [
        '.address',
        '.contact-address',
        'p[class*="address" i]',
        'span[class*="address" i]',
        '[itemprop="address"]',
      ];
      for (const selector of addressSelectors) {
        const el = document.querySelector(selector);
        if (el && el.textContent) {
          info.address = el.textContent.trim();
          break;
        }
      }

      // Instagram
      const instaEl = document.querySelector('a[href*="instagram.com"]');
      if (instaEl) {
        const match = instaEl.href.match(/instagram\.com\/([^\/]+)/);
        if (match) {
          info.instagram = match[1];
        }
      }

      // Try to find founded year in about text
      const aboutSelectors = [
        '.about',
        '.company-info',
        'p',
      ];
      for (const selector of aboutSelectors) {
        const elements = document.querySelectorAll(selector);
        for (const el of elements) {
          const text = el.textContent;
          const yearMatch = text.match(/\b(19|20)\d{2}\b/);
          if (yearMatch) {
            const year = parseInt(yearMatch[0]);
            if (year >= 1980 && year <= new Date().getFullYear()) {
              info.foundedYear = year;
              break;
            }
          }
        }
        if (info.foundedYear) break;
      }

      return info;
    });
    results.phone = contactInfo.phone;
    results.email = contactInfo.email;
    results.address = contactInfo.address;
    results.instagram = contactInfo.instagram;
    results.foundedYear = contactInfo.foundedYear;

    // Try to find project images
    const projectImages = await page.evaluate(() => {
      const images = [];
      const imgSelectors = [
        '.project img',
        '.projects img',
        '.portfolio img',
        '.case-study img',
        '.work img',
        'article img',
        '.project-image img',
      ];

      for (const selector of imgSelectors) {
        const elements = document.querySelectorAll(selector);
        elements.forEach((el, index) => {
          if (index < 5) { // Limit to 5 images per selector
            const src = el.src || el.getAttribute('data-src');
            if (src && !src.includes('logo') && !src.includes('icon')) {
              if (!images.includes(src)) {
                images.push(src);
              }
            }
          }
        });
      }

      return images.slice(0, 8); // Max 8 images
    });
    results.projectImages = projectImages;

    console.log(`✅ Successfully scraped ${companyInfo.name}`);
    console.log(`   - Description: ${results.description ? 'Found' : 'Not found'}`);
    console.log(`   - Logo: ${results.logo ? 'Found' : 'Not found'}`);
    console.log(`   - Phone: ${results.phone || 'Not found'}`);
    console.log(`   - Email: ${results.email || 'Not found'}`);
    console.log(`   - Instagram: ${results.instagram || 'Not found'}`);
    console.log(`   - Project images: ${results.projectImages.length}`);

  } catch (error) {
    results.error = error.message;
    console.log(`❌ Error scraping ${companyInfo.name}: ${error.message}`);
  } finally {
    await page.close();
  }

  return results;
}

async function main() {
  console.log('🚀 Starting UAE Design Companies Scraper...\n');

  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const results = [];

  for (let i = 0; i < COMPANIES_TO_SCRAPE.length; i++) {
    const company = COMPANIES_TO_SCRAPE[i];
    const result = await scrapeCompany(browser, company);
    results.push(result);

    // Be polite - delay between requests
    if (i < COMPANIES_TO_SCRAPE.length - 1) {
      console.log('⏳ Waiting 3 seconds before next request...');
      await delay(3000);
    }
  }

  await browser.close();

  // Save results
  const outputPath = path.join(process.cwd(), 'src/data/scraped-companies.json');
  fs.writeFileSync(outputPath, JSON.stringify(results, null, 2), 'utf-8');

  console.log('\n📊 Scraping Summary:');
  console.log(`   Total companies: ${results.length}`);
  console.log(`   Successful: ${results.filter(r => !r.error).length}`);
  console.log(`   Failed: ${results.filter(r => r.error).length}`);
  console.log(`\n💾 Results saved to: ${outputPath}`);

  // Print summary for each company
  console.log('\n📋 Detailed Results:');
  results.forEach((r, i) => {
    console.log(`\n${i + 1}. ${r.name}`);
    if (r.error) {
      console.log(`   ❌ Error: ${r.error}`);
    } else {
      console.log(`   ✅ Website: ${r.website}`);
      console.log(`   📝 Description: ${r.description ? r.description.slice(0, 80) + '...' : 'N/A'}`);
      console.log(`   📞 Phone: ${r.phone || 'N/A'}`);
      console.log(`   📧 Email: ${r.email || 'N/A'}`);
      console.log(`   📍 Address: ${r.address || 'N/A'}`);
      console.log(`   📸 Images: ${r.projectImages.length}`);
    }
  });
}

main().catch(console.error);
