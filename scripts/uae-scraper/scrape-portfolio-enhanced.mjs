import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';
import { https } from 'https';
import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

// 扩展的公司列表 - 更多 UAE 设计公司
const COMPANIES = [
  { name: 'Bishop Design', website: 'https://bishopdesign.ae' },
  { name: 'LW Design', website: 'https://lw-design.com' },
  { name: 'ROCK', website: 'https://rock.ae' },
  { name: 'Zachary O Design', website: 'https://www.zacharyodesign.com' },
  { name: 'Bureau B Architects', website: 'https://www.bureaubarchitects.com' },
  { name: 'DAR', website: 'https://dar.ae' },
  { name: 'Keo', website: 'https://keo.design' },
  { name: 'Misty', website: 'https://misty.com' },
  { name: 'ANARCHITECT', website: 'https://anarchitect.ae' },
  { name: 'Algedra', website: 'https://algedra.ae' },
  { name: 'Accouter', website: 'https://accouter.ae' },
  { name: 'ALEC Fitout', website: 'https://alecfitout.com' },
  { name: 'Appello Interiors', website: 'https://appellointeriors.ae' },
  { name: 'ATG Interiors', website: 'https://atginteriors.ae' },
  { name: 'Blak Interiors', website: 'https://blakinteriors.ae' },
  { name: 'Build Craft', website: 'https://buildcraft.ae' },
  { name: 'CK Architecture', website: 'https://ckarchitecture.ae' },
  { name: 'Decor Home', website: 'https://decorhome.ae' },
  { name: 'Eminent Interio', website: 'https://eminent.ae' },
  { name: 'Fitout Bureau', website: 'https://fitoutbureau.ae' },
  { name: 'Fitout Squad', website: 'https://fitoutsquad.ae' },
  { name: 'Horton Interiors', website: 'https://hortoninteriors.ae' },
  { name: 'Klick', website: 'https://klick.ae' },
  { name: 'La Firma', website: 'https://lafirma.ae' },
  { name: 'Luxe Design Villas', website: 'https://luxedesignvillas.ae' },
  { name: 'Luxury & More', website: 'https://luxuryandmore.ae' },
  { name: 'MGM Interiors', website: 'https://mgminteriors.ae' },
  { name: 'Patina Interiors', website: 'https://patinainteriors.ae' },
  { name: 'Ray Fitout', website: 'https://rayfitout.ae' },
  { name: 'Safeway Groups', website: 'https://safewaygroups.ae' },
  { name: 'SMD Decoration', website: 'https://smd.ae' },
  { name: 'USBC Interiors', website: 'https://usbcinteriors.ae' },
  { name: 'Winteriors Decor', website: 'https://winteriors.ae' },
];

const BASE_OUTPUT_DIR = path.join(process.cwd(), 'public/images/uae-companies/portfolio');
const DELAY_MS = 2000; // 礼貌延迟

// 延迟函数
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// 创建目录
function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

// 下载图片
async function downloadImage(url, destPath) {
  ensureDir(path.dirname(destPath));

  try {
    // 使用 curl 下载
    await execFileAsync('curl', [
      '--silent',
      '--show-error',
      '--fail',
      '--location',
      '--max-time', '30',
      '--create-dirs',
      '--output', destPath,
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      url,
    ], { maxBuffer: 5 * 1024 * 1024 });
    return { success: true, path: destPath };
  } catch (error) {
    console.log(`   ⚠️  Failed to download: ${url}`);
    return { success: false, error: error.message };
  }
}

// 清理文件名
function sanitizeFilename(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .substring(0, 50);
}

// 获取文件扩展名
function getExtension(url) {
  const urlLower = url.toLowerCase();
  if (urlLower.includes('.png')) return '.png';
  if (urlLower.includes('.webp')) return '.webp';
  if (urlLower.includes('.avif')) return '.avif';
  if (urlLower.includes('.svg')) return '.svg';
  return '.jpg';
}

// 提取页面中的所有图片 URL
async function extractAllImages(page, baseUrl) {
  return await page.evaluate((base) => {
    const images = [];
    const seen = new Set();

    // 直接 img 标签
    document.querySelectorAll('img').forEach(img => {
      const src = img.src || img.getAttribute('data-src') || img.getAttribute('data-lazy-src') || img.getAttribute('data-src');
      if (src && !src.includes('logo') && !src.includes('icon') && !src.includes('favicon')) {
        try {
          const url = new URL(src, base).href;
          if (!seen.has(url)) {
            seen.add(url);
            images.push({ url, alt: img.alt || '' });
          }
        } catch (e) {
          // Invalid URL, skip
        }
      }
    });

    // 背景图片
    document.querySelectorAll('[style*="background-image"]').forEach(el => {
      const style = el.getAttribute('style') || '';
      const match = style.match(/url\(["']?([^"')]+)["']?\)/g);
      if (match) {
        try {
          const url = new URL(match[1], base).href;
          if (!seen.has(url)) {
            seen.add(url);
            images.push({ url, alt: 'background' });
          }
        } catch (e) {
          // Invalid URL, skip
        }
      }
    });

    // data-url 图片转换为真实 URL
    document.querySelectorAll('img[src^="data:image"]').forEach(img => {
      if (img.getAttribute('src').length < 100000) { // 小图片才转换
        // data-url 太大，跳过
        return;
      }
    });

    // picture source
    document.querySelectorAll('picture source').forEach(source => {
      const srcset = source.srcset || source.getAttribute('data-srcset');
      if (srcset) {
        srcset.split(',').forEach(entry => {
          const url = entry.trim().split(' ')[0];
          if (url) {
            try {
              const imgUrl = new URL(url, base).href;
              if (!seen.has(imgUrl)) {
                seen.add(imgUrl);
                images.push({ url: imgUrl, alt: source.getAttribute('alt') || '' });
              }
            } catch (e) {
              // Invalid URL, skip
            }
          }
        });
      }
    });

    // a 标签包裹的图片
    document.querySelectorAll('a[href*=".png"], a[href*=".jpg"], a[href*=".jpeg"], a[href*=".webp"]').forEach(link => {
      try {
        const url = new URL(link.href, base).href;
        if (!seen.has(url)) {
          seen.add(url);
          images.push({ url, alt: link.textContent || '' });
        }
      } catch (e) {
        // Invalid URL, skip
      }
    });

    return images;
  }, baseUrl);
}

// 爬取公司的所有项目页面
async function scrapeCompanyPortfolio(companyInfo) {
  const results = {
    name: companyInfo.name,
    website: companyInfo.website,
    images: [],
    projects: [],
    error: null,
  };

  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  try {
    console.log(`\n🔍 Scraping ${companyInfo.name}...`);

    const page = await browser.newPage();
    await page.setUserAgent(
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    );

    // 访问主页
    console.log(`   📄 Loading homepage...`);
    const response = await page.goto(companyInfo.website, {
      waitUntil: 'networkidle2',
      timeout: 30000,
    });

    if (!response.ok()) {
      throw new Error(`HTTP ${response.status()}`);
    }

    // 爬取主页图片
    console.log(`   🖼️  Extracting homepage images...`);
    const homepageImages = await extractAllImages(page, companyInfo.website);
    console.log(`   Found ${homepageImages.length} images on homepage`);

    // 尝试找到项目页面链接
    const projectPageLinks = await page.evaluate(() => {
      const links = [];

      // 常见项目页面链接模式
      const patterns = [
        // 直接链接
        'a[href*="/project"]',
        'a[href*="/portfolio"]',
        'a[href*="/work"]',
        'a[href*="/projects"]',
        'a[href*="/case-study"]',
      ];

      for (const pattern of patterns) {
        const elements = document.querySelectorAll(pattern);
        elements.forEach(el => {
          const href = el.getAttribute('href');
          if (href && href.startsWith('/') && !href.includes('#')) {
            links.push({
              url: href,
              text: el.textContent.trim(),
              isProject: true,
            });
          }
        });
      }

      // 去重
      const uniqueLinks = [];
      const seen = new Set();
      links.forEach(link => {
        if (!seen.has(link.url)) {
          seen.add(link.url);
          uniqueLinks.push(link);
        }
      });

      return uniqueLinks.slice(0, 20); // 最多 20 个项目页面
    }, companyInfo.website);

    // 访问每个项目页面
    for (let i = 0; i < projectPageLinks.length; i++) {
      const link = projectPageLinks[i];

      try {
        const projectUrl = new URL(link.url, companyInfo.website).href;
        console.log(`   📂 Loading project page ${i + 1}/${projectPageLinks.length}: ${link.text || link.url}`);

        await page.goto(projectUrl, { waitUntil: 'domcontentloaded', timeout: 15000 });
        await delay(500); // 等待图片加载

        const projectImages = await extractAllImages(page, companyInfo.website);
        console.log(`      Found ${projectImages.length} images`);

        results.projects.push({
          title: link.text || `Project ${i + 1}`,
          url: projectUrl,
          imageCount: projectImages.length,
        });

        results.images.push(...projectImages);

        await delay(DELAY_MS);

      } catch (err) {
        console.log(`      ⚠️  Failed to load project page: ${err.message}`);
      }
    }

    // 如果没有找到项目页面，深度爬取主页
    if (results.projects.length === 0) {
      console.log(`   🔍 No project pages found, doing deep scan of homepage...`);

      // 滚动页面以加载更多图片
      await page.evaluate(() => {
        window.scrollTo(0, document.body.scrollHeight);
      });
      await delay(2000);

      // 再次提取图片
      const moreImages = await extractAllImages(page, companyInfo.website);
      console.log(`   Found ${moreImages.length} images after scrolling`);
      results.images = moreImages;
    }

    // 去重图片
    const uniqueImages = [];
    const seenUrls = new Set();

    for (const img of results.images) {
      if (!seenUrls.has(img.url)) {
        seenUrls.add(img.url);
        uniqueImages.push(img);
      }
    }

    console.log(`\n   ✅ Successfully scraped ${companyInfo.name}:`);
    console.log(`      - Project pages found: ${results.projects.length}`);
    console.log(`      - Total unique images: ${uniqueImages.length}`);

    // 保存数据
    const companyNameSlug = sanitizeFilename(companyInfo.name);
    const companyDir = path.join(BASE_OUTPUT_DIR, companyNameSlug);
    ensureDir(companyDir);

    // 保存 JSON 数据
    const dataPath = path.join(companyDir, 'data.json');
    fs.writeFileSync(dataPath, JSON.stringify({
      name: companyInfo.name,
      website: companyInfo.website,
      scrapedAt: new Date().toISOString(),
      projectCount: results.projects.length,
      imageCount: uniqueImages.length,
      projects: results.projects.map(p => ({
        title: p.title,
        url: p.url,
        imageCount: p.imageCount,
      })),
    }, null, 2));

    // 下载图片
    console.log(`   💾 Downloading images...`);
    let downloaded = 0;
    let failed = 0;

    for (let i = 0; i < Math.min(uniqueImages.length, 100); i++) { // 限制最多 100 张
      const imgUrl = uniqueImages[i].url;
      const ext = getExtension(imgUrl);
      const filename = `${companyNameSlug}-${i + 1}${ext}`;
      const destPath = path.join(companyDir, filename);

      const result = await downloadImage(imgUrl, destPath);
      if (result.success) {
        downloaded++;
      } else {
        failed++;
      }

      // 每下载 5 张报告一次
      if ((i + 1) % 5 === 0) {
        console.log(`      Progress: ${i + 1}/${Math.min(uniqueImages.length, 100)} downloaded, ${failed} failed`);
      }
    }

    console.log(`   💾 Download complete: ${downloaded} succeeded, ${failed} failed`);

  } catch (error) {
    results.error = error.message;
    console.log(`   ❌ Error scraping ${companyInfo.name}: ${error.message}`);
  } finally {
    await browser.close();
  }

  return results;
}

// 主函数
async function main() {
  console.log('🚀 Starting Enhanced Portfolio Scraper...\n');
  console.log(`📁 Output directory: ${BASE_OUTPUT_DIR}\n`);
  console.log(`📊 Companies to scrape: ${COMPANIES.length}\n`);

  const summary = [];

  for (let i = 0; i < COMPANIES.length; i++) {
    const company = COMPANIES[i];
    const result = await scrapeCompanyPortfolio(company);
    summary.push(result);

    // 延迟避免过载
    if (i < COMPANIES.length - 1) {
      console.log(`\n⏳ Waiting ${DELAY_MS/1000}s before next request...\n`);
      await delay(DELAY_MS);
    }
  }

  // 打印总结
  console.log('\n' + '='.repeat(60));
  console.log('📊 SCRAPING SUMMARY');
  console.log('='.repeat(60));

  summary.forEach((s, i) => {
    console.log(`\n${i + 1}. ${s.name}`);
    if (s.error) {
      console.log(`   ❌ Error: ${s.error}`);
    } else {
      console.log(`   ✅ Website: ${s.website}`);
      console.log(`   📁 Directory: ${sanitizeFilename(s.name)}/`);
      console.log(`   📂 Project pages: ${s.projects.length}`);
      console.log(`   🖼️  Total images: ${s.images.length}`);
    }
  });

  console.log('\n' + '='.repeat(60));
  console.log(`✅ Scraping complete! Data saved to: ${BASE_OUTPUT_DIR}`);
}

main().catch(console.error);
