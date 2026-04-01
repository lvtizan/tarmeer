import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';
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
const DELAY_MS = 2000;
const MIN_IMAGE_WIDTH = 400;  // 最小宽度，低于此值的视为缩略图
const MIN_IMAGE_SIZE = 20000; // 最小文件大小 20KB，过滤小图
const MAX_IMAGES_PER_COMPANY = 100;

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

// WordPress 缩略图 URL → 原图 URL
// 例: image-268x130.jpg → image.jpg
// 例: image-1024x768.png → image.png
function upgradeToFullSize(url) {
  // WordPress 缩略图模式: filename-WIDTHxHEIGHT.ext
  const wpThumb = url.replace(/-\d{2,4}x\d{2,4}(\.\w{3,4})(\?|$)/, '$1$2');
  // 有些用 ?w=268&h=130 或 ?resize=268,130 参数
  const noResize = wpThumb
    .replace(/[?&](w|h|width|height|resize|size|fit)=[^&]*/gi, '')
    .replace(/\?$/, '');
  return noResize;
}

// 下载图片，返回文件信息
async function downloadImage(url, destPath) {
  ensureDir(path.dirname(destPath));
  try {
    await execFileAsync('curl', [
      '--silent', '--show-error', '--fail', '--location',
      '--max-time', '30',
      '--create-dirs',
      '-H', 'User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      '--output', destPath,
      url,
    ], { maxBuffer: 10 * 1024 * 1024 });

    // 检查文件大小
    const stats = fs.statSync(destPath);
    if (stats.size < MIN_IMAGE_SIZE) {
      fs.unlinkSync(destPath);
      return { success: false, reason: `too small (${stats.size} bytes)` };
    }

    // 检查图片尺寸（用 sips 在 macOS 上）
    try {
      const { stdout } = await execFileAsync('sips', ['-g', 'pixelWidth', destPath]);
      const widthMatch = stdout.match(/pixelWidth:\s*(\d+)/);
      if (widthMatch) {
        const width = parseInt(widthMatch[1]);
        if (width < MIN_IMAGE_WIDTH) {
          fs.unlinkSync(destPath);
          return { success: false, reason: `too narrow (${width}px)` };
        }
      }
    } catch {
      // sips 不可用时跳过尺寸检查
    }

    return { success: true, path: destPath };
  } catch (error) {
    // 下载失败，清理残留文件
    try { fs.unlinkSync(destPath); } catch {}
    return { success: false, reason: error.message };
  }
}

function sanitizeFilename(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-+/g, '-').substring(0, 50);
}

function getExtension(url) {
  const clean = url.split('?')[0].split('#')[0].toLowerCase();
  if (clean.endsWith('.png')) return '.png';
  if (clean.endsWith('.webp')) return '.webp';
  if (clean.endsWith('.avif')) return '.avif';
  if (clean.endsWith('.svg')) return '.svg';
  return '.jpg';
}

// 判断 URL 是否应该排除（广告、图标、占位图等）
function shouldExclude(url, alt = '') {
  const lower = (url + ' ' + alt).toLowerCase();
  const excludePatterns = [
    'logo', 'icon', 'favicon', 'avatar', 'placeholder',
    'spinner', 'loading', 'arrow', 'button', 'badge',
    'banner-ad', 'advert', 'pixel', 'tracking', 'analytics',
    'gravatar', 'wp-emoji', 'smilies', 'emoji',
    'data:image/svg', // inline SVG placeholders
    'data:image/gif;base64,R0lGOD', // 1px transparent GIF
  ];
  return excludePatterns.some(p => lower.includes(p));
}

// 渐进滚动页面，触发所有懒加载
async function progressiveScroll(page) {
  await page.evaluate(async () => {
    const scrollStep = 300;
    const scrollDelay = 200;
    const maxScrolls = 50;
    let scrollCount = 0;

    while (scrollCount < maxScrolls) {
      const before = window.scrollY;
      window.scrollBy(0, scrollStep);
      await new Promise(r => setTimeout(r, scrollDelay));

      // 如果滚不动了就停
      if (window.scrollY === before) break;
      scrollCount++;
    }

    // 滚回顶部再滚一次到底（触发某些只在特定位置加载的图）
    window.scrollTo(0, 0);
    await new Promise(r => setTimeout(r, 300));
    window.scrollTo(0, document.body.scrollHeight);
    await new Promise(r => setTimeout(r, 1000));
  });
}

// 提取页面中的所有高清图片 URL
async function extractAllImages(page, baseUrl) {
  // 先滚动触发懒加载
  await progressiveScroll(page);
  // 等图片加载
  await delay(2000);

  return await page.evaluate((base) => {
    const images = [];
    const seen = new Set();

    // WordPress 缩略图 → 原图
    function upgradeUrl(url) {
      return url
        .replace(/-\d{2,4}x\d{2,4}(\.\w{3,4})(\?|$)/, '$1$2')
        .replace(/[?&](w|h|width|height|resize|size|fit)=[^&]*/gi, '')
        .replace(/\?$/, '');
    }

    function addImage(rawUrl, alt = '') {
      if (!rawUrl || rawUrl.startsWith('data:')) return;
      try {
        let url = new URL(rawUrl, base).href;
        url = upgradeUrl(url);
        if (!seen.has(url)) {
          seen.add(url);
          images.push({ url, alt });
        }
      } catch {}
    }

    // === img 标签 ===
    document.querySelectorAll('img').forEach(img => {
      // 跳过太小的图（内联尺寸判断）
      const w = img.naturalWidth || img.width || parseInt(img.getAttribute('width')) || 0;
      if (w > 0 && w < 100) return;

      // 优先级：data-src > data-lazy-src > src (避免懒加载占位图)
      const candidates = [
        img.getAttribute('data-src'),
        img.getAttribute('data-lazy-src'),
        img.getAttribute('data-original'),
        img.getAttribute('data-full-url'),
        img.src,
      ];

      // srcset 中取最大的
      const srcset = img.srcset || img.getAttribute('data-srcset') || '';
      if (srcset) {
        const entries = srcset.split(',').map(s => {
          const parts = s.trim().split(/\s+/);
          const sizeStr = parts[1] || '0w';
          const size = parseInt(sizeStr) || 0;
          return { url: parts[0], size };
        });
        entries.sort((a, b) => b.size - a.size);
        if (entries.length > 0 && entries[0].url) {
          candidates.unshift(entries[0].url); // 最高优先
        }
      }

      const alt = img.alt || '';
      for (const src of candidates) {
        if (src && !src.startsWith('data:')) {
          addImage(src, alt);
          break; // 只取最高优先级的一个
        }
      }
    });

    // === picture > source ===
    document.querySelectorAll('picture source').forEach(source => {
      const srcset = source.srcset || source.getAttribute('data-srcset') || '';
      if (!srcset) return;
      const entries = srcset.split(',').map(s => {
        const parts = s.trim().split(/\s+/);
        const size = parseInt(parts[1] || '0') || 0;
        return { url: parts[0], size };
      });
      entries.sort((a, b) => b.size - a.size);
      if (entries[0]?.url) {
        addImage(entries[0].url, '');
      }
    });

    // === 背景图片 ===
    document.querySelectorAll('[style*="background-image"]').forEach(el => {
      const style = el.getAttribute('style') || '';
      const matches = style.match(/url\(["']?([^"')]+)["']?\)/);
      if (matches?.[1]) {
        addImage(matches[1], 'background');
      }
    });

    // === a 标签直接链接图片 ===
    document.querySelectorAll('a[href$=".jpg"], a[href$=".jpeg"], a[href$=".png"], a[href$=".webp"]').forEach(link => {
      addImage(link.href, link.textContent || '');
    });

    // === data-bg 懒加载背景（某些主题） ===
    document.querySelectorAll('[data-bg]').forEach(el => {
      addImage(el.getAttribute('data-bg'), 'bg');
    });

    return images;
  }, baseUrl);
}

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
    // 设置较大视口，某些网站按视口决定图片尺寸
    await page.setViewport({ width: 1920, height: 1080 });

    // 访问主页
    console.log(`   📄 Loading homepage...`);
    const response = await page.goto(companyInfo.website, {
      waitUntil: 'networkidle0',
      timeout: 45000,
    });

    if (!response.ok()) {
      throw new Error(`HTTP ${response.status()}`);
    }

    // 爬取主页图片
    console.log(`   🖼️  Extracting homepage images...`);
    const homepageImages = await extractAllImages(page, companyInfo.website);
    // 过滤排除项
    const filteredHomepage = homepageImages.filter(img => !shouldExclude(img.url, img.alt));
    console.log(`   Found ${filteredHomepage.length} images on homepage (${homepageImages.length} total, ${homepageImages.length - filteredHomepage.length} excluded)`);
    results.images.push(...filteredHomepage);

    // 尝试找到项目/作品集页面链接
    const projectPageLinks = await page.evaluate((baseUrl) => {
      const links = [];
      const seen = new Set();

      // 更广泛的链接模式
      const patterns = [
        'a[href*="/project"]',
        'a[href*="/portfolio"]',
        'a[href*="/work"]',
        'a[href*="/projects"]',
        'a[href*="/case-study"]',
        'a[href*="/gallery"]',
        'a[href*="/interior"]',
        'a[href*="/residential"]',
        'a[href*="/commercial"]',
        'a[href*="/villa"]',
        'a[href*="/apartment"]',
        'a[href*="/design"]',
        'a[href*="/our-work"]',
      ];

      for (const pattern of patterns) {
        document.querySelectorAll(pattern).forEach(el => {
          const href = el.getAttribute('href');
          if (!href || href === '#' || href.includes('javascript:')) return;

          try {
            const fullUrl = new URL(href, baseUrl).href;
            // 只跟踪同域名的链接
            const baseDomain = new URL(baseUrl).hostname.replace('www.', '');
            const linkDomain = new URL(fullUrl).hostname.replace('www.', '');
            if (linkDomain !== baseDomain) return;

            if (!seen.has(fullUrl)) {
              seen.add(fullUrl);
              links.push({
                url: fullUrl,
                text: el.textContent.trim().substring(0, 80),
              });
            }
          } catch {}
        });
      }

      return links.slice(0, 30);
    }, companyInfo.website);

    console.log(`   📂 Found ${projectPageLinks.length} project/portfolio page links`);

    // 访问每个项目页面
    for (let i = 0; i < projectPageLinks.length; i++) {
      const link = projectPageLinks[i];
      try {
        console.log(`   📂 [${i + 1}/${projectPageLinks.length}] ${link.text || link.url}`);
        await page.goto(link.url, { waitUntil: 'networkidle2', timeout: 20000 });
        await delay(1000);

        const projectImages = await extractAllImages(page, companyInfo.website);
        const filtered = projectImages.filter(img => !shouldExclude(img.url, img.alt));
        console.log(`      Found ${filtered.length} images`);

        results.projects.push({
          title: link.text || `Project ${i + 1}`,
          url: link.url,
          imageCount: filtered.length,
        });
        results.images.push(...filtered);
        await delay(DELAY_MS);
      } catch (err) {
        console.log(`      ⚠️  Failed: ${err.message}`);
      }
    }

    // 如果没有找到项目页面，深度爬取主页
    if (results.projects.length === 0 && results.images.length < 10) {
      console.log(`   🔍 Few images found, doing deep scroll of homepage...`);
      await page.goto(companyInfo.website, { waitUntil: 'networkidle0', timeout: 45000 });
      await progressiveScroll(page);
      await delay(3000);
      const moreImages = await extractAllImages(page, companyInfo.website);
      const filtered = moreImages.filter(img => !shouldExclude(img.url, img.alt));
      console.log(`   Found ${filtered.length} images after deep scroll`);
      results.images = filtered;
    }

    // 全局去重（用升级后的 URL）
    const uniqueImages = [];
    const seenUrls = new Set();
    for (const img of results.images) {
      const key = upgradeToFullSize(img.url);
      if (!seenUrls.has(key)) {
        seenUrls.add(key);
        uniqueImages.push({ ...img, url: key });
      }
    }

    console.log(`\n   ✅ ${companyInfo.name}: ${results.projects.length} pages, ${uniqueImages.length} unique images`);

    // 保存并下载
    const slug = sanitizeFilename(companyInfo.name);
    const companyDir = path.join(BASE_OUTPUT_DIR, slug);
    ensureDir(companyDir);

    fs.writeFileSync(path.join(companyDir, 'data.json'), JSON.stringify({
      name: companyInfo.name,
      website: companyInfo.website,
      scrapedAt: new Date().toISOString(),
      projectCount: results.projects.length,
      imageCount: uniqueImages.length,
      projects: results.projects,
    }, null, 2));

    // 下载图片（带质量检查）
    console.log(`   💾 Downloading up to ${MAX_IMAGES_PER_COMPANY} images with quality check...`);
    let downloaded = 0;
    let skipped = 0;
    let failed = 0;

    for (let i = 0; i < Math.min(uniqueImages.length, MAX_IMAGES_PER_COMPANY + 30); i++) {
      if (downloaded >= MAX_IMAGES_PER_COMPANY) break;

      const imgUrl = uniqueImages[i].url;
      const ext = getExtension(imgUrl);
      const destPath = path.join(companyDir, `${slug}-${downloaded + 1}${ext}`);

      const result = await downloadImage(imgUrl, destPath);
      if (result.success) {
        downloaded++;
      } else {
        skipped++;
        if (result.reason?.includes('too small') || result.reason?.includes('too narrow')) {
          // 小图/窄图 → 正常跳过
        } else {
          failed++;
        }
      }

      if ((downloaded + skipped + failed) % 10 === 0) {
        console.log(`      Progress: ${downloaded} good, ${skipped} skipped, ${failed} failed`);
      }
    }

    console.log(`   💾 Done: ${downloaded} downloaded, ${skipped} skipped (small/narrow), ${failed} failed`);

  } catch (error) {
    results.error = error.message;
    console.log(`   ❌ Error: ${error.message}`);
  } finally {
    await browser.close();
  }

  return results;
}

// === 主函数 ===
async function main() {
  // 支持命令行指定公司: node scrape-portfolio-enhanced.mjs "Fix It Design"
  const targetName = process.argv[2];
  let companies = COMPANIES;

  if (targetName) {
    // 也支持从 companies-data-final.json 查找
    try {
      const dataPath = path.join(path.dirname(new URL(import.meta.url).pathname), 'companies-data-final.json');
      const allData = JSON.parse(fs.readFileSync(dataPath, 'utf-8'));
      const found = allData.find(c =>
        c.name_en?.toLowerCase().includes(targetName.toLowerCase()) ||
        c.slug?.toLowerCase().includes(targetName.toLowerCase())
      );
      if (found) {
        companies = [{ name: found.name_en, website: found.website }];
        console.log(`🎯 Found in data: ${found.name_en} → ${found.website}`);
      } else {
        // 从 COMPANIES 数组找
        const match = COMPANIES.find(c => c.name.toLowerCase().includes(targetName.toLowerCase()));
        if (match) {
          companies = [match];
        } else {
          console.log(`❌ Company "${targetName}" not found`);
          process.exit(1);
        }
      }
    } catch {
      const match = COMPANIES.find(c => c.name.toLowerCase().includes(targetName.toLowerCase()));
      if (match) companies = [match];
    }
  }

  console.log('🚀 Enhanced Portfolio Scraper v2\n');
  console.log(`📁 Output: ${BASE_OUTPUT_DIR}`);
  console.log(`📊 Companies: ${companies.length}`);
  console.log(`🔍 Min image width: ${MIN_IMAGE_WIDTH}px`);
  console.log(`📦 Min file size: ${(MIN_IMAGE_SIZE / 1024).toFixed(0)}KB\n`);

  const summary = [];

  for (let i = 0; i < companies.length; i++) {
    const result = await scrapeCompanyPortfolio(companies[i]);
    summary.push(result);
    if (i < companies.length - 1) {
      console.log(`\n⏳ Waiting ${DELAY_MS / 1000}s...\n`);
      await delay(DELAY_MS);
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('📊 SCRAPING SUMMARY');
  console.log('='.repeat(60));

  summary.forEach((s, i) => {
    console.log(`\n${i + 1}. ${s.name}`);
    if (s.error) {
      console.log(`   ❌ Error: ${s.error}`);
    } else {
      console.log(`   ✅ ${s.website}`);
      console.log(`   📂 ${s.projects.length} pages, 🖼️  ${s.images.length} images`);
    }
  });

  console.log('\n✅ Done!');
}

main().catch(console.error);
