"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.scrapePortfolio = scrapePortfolio;
const axios_1 = __importDefault(require("axios"));
const cheerio = __importStar(require("cheerio"));
const HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.5',
};
const MIN_SIZE = 200;
function isProjectImage(src) {
    if (!src)
        return false;
    const skip = [
        /logo/i, /icon/i, /favicon/i, /avatar/i, /badge/i, /sprite/i,
        /arrow/i, /button/i, /social/i, /pixel/i, /tracking/i,
        /\.svg$/i, /\.gif$/i, /base64/i, /1x1/i, /spacer/i, /blank/i,
        /facebook|twitter|linkedin|youtube|pinterest|google/i,
    ];
    return !skip.some(p => p.test(src));
}
function resolve(src, base) {
    try {
        return new URL(src, base).href;
    }
    catch {
        return '';
    }
}
// ── Extract images from HTML ──
function extractImages(html, url) {
    const $ = cheerio.load(html);
    const imageSet = new Set();
    const title = ($('meta[property="og:title"]').attr('content') ||
        $('h1').first().text() ||
        $('title').text() || '').trim().slice(0, 200);
    const description = ($('meta[property="og:description"]').attr('content') ||
        $('meta[name="description"]').attr('content') || '').trim().slice(0, 500);
    // OG image
    const ogImg = $('meta[property="og:image"]').attr('content');
    if (ogImg) {
        const r = resolve(ogImg, url);
        if (r && isProjectImage(r))
            imageSet.add(r);
    }
    // <img> tags — multiple source attributes + srcset
    $('img').each((_, el) => {
        const candidates = [
            $(el).attr('src'), $(el).attr('data-src'), $(el).attr('data-lazy-src'),
            $(el).attr('data-original'), $(el).attr('data-defer-src'), $(el).attr('data-hi-res-src'),
        ];
        const srcset = $(el).attr('srcset') || '';
        if (srcset) {
            const parts = srcset.split(',').map(s => s.trim().split(/\s+/));
            parts.sort((a, b) => parseInt(b[1] || '0') - parseInt(a[1] || '0'));
            if (parts[0]?.[0])
                candidates.push(parts[0][0]);
        }
        for (const src of candidates) {
            if (!src)
                continue;
            const r = resolve(src, url);
            if (!r || !isProjectImage(r))
                continue;
            const w = parseInt($(el).attr('width') || '0');
            const h = parseInt($(el).attr('height') || '0');
            if ((w > 0 && w < MIN_SIZE) || (h > 0 && h < MIN_SIZE))
                continue;
            imageSet.add(r);
            break;
        }
    });
    // Background images
    $('[style*="background"]').each((_, el) => {
        const m = ($(el).attr('style') || '').match(/url\(['"]?([^'")\s]+)['"]?\)/);
        if (m) {
            const r = resolve(m[1], url);
            if (r && isProjectImage(r))
                imageSet.add(r);
        }
    });
    // <picture> source
    $('picture source').each((_, el) => {
        const srcset = $(el).attr('srcset') || '';
        const parts = srcset.split(',').map(s => s.trim().split(/\s+/)[0]).filter(Boolean);
        const last = parts[parts.length - 1];
        if (last) {
            const r = resolve(last, url);
            if (r && isProjectImage(r))
                imageSet.add(r);
        }
    });
    // <a> to images
    $('a[href$=".jpg"], a[href$=".jpeg"], a[href$=".png"], a[href$=".webp"]').each((_, el) => {
        const r = resolve($(el).attr('href') || '', url);
        if (r && isProjectImage(r))
            imageSet.add(r);
    });
    // JSON-LD
    $('script[type="application/ld+json"]').each((_, el) => {
        try {
            const json = JSON.parse($(el).html() || '');
            const imgs = json.image || json.thumbnailUrl || json.photo || [];
            for (const img of Array.isArray(imgs) ? imgs : [imgs]) {
                const src = typeof img === 'string' ? img : img?.url || img?.contentUrl;
                if (src) {
                    const r = resolve(src, url);
                    if (r && isProjectImage(r))
                        imageSet.add(r);
                }
            }
        }
        catch { }
    });
    // noscript
    $('noscript').each((_, el) => {
        const inner = $(el).html() || '';
        for (const m of inner.matchAll(/<img[^>]+src=["']([^"']+)["']/gi)) {
            const r = resolve(m[1], url);
            if (r && isProjectImage(r))
                imageSet.add(r);
        }
    });
    return { title, description, images: Array.from(imageSet).slice(0, 50) };
}
// ── Layer 1: Fast (axios) ──
async function scrapeFast(url) {
    try {
        const response = await axios_1.default.get(url, { headers: HEADERS, timeout: 15000, maxRedirects: 10 });
        if (!response.data || typeof response.data !== 'string')
            return null;
        const result = extractImages(response.data, url);
        if (result.images.length === 0)
            return null;
        return { ...result, sourceUrl: url, method: 'fast' };
    }
    catch {
        return null; // Fall through to browser
    }
}
// ── Layer 2: Headless browser (puppeteer-core) ──
function findChrome() {
    const paths = [
        '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
        '/usr/bin/google-chrome',
        '/usr/bin/chromium-browser',
        '/usr/bin/chromium',
        process.env.CHROME_PATH || '',
    ];
    const fs = require('fs');
    for (const p of paths) {
        if (p && fs.existsSync(p))
            return p;
    }
    return '';
}
async function scrapeBrowser(url) {
    const chromePath = findChrome();
    if (!chromePath) {
        throw new Error('Browser scraping not available. Chrome not found on this server.');
    }
    let browser;
    try {
        const puppeteer = require('puppeteer-core');
        browser = await puppeteer.launch({
            executablePath: chromePath,
            headless: 'new',
            args: [
                '--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage',
                '--disable-gpu', '--window-size=1440,900',
            ],
            timeout: 50000,
        });
        const page = await browser.newPage();
        await page.setUserAgent(HEADERS['User-Agent']);
        await page.setViewport({ width: 1440, height: 900 });
        // Block unnecessary resources for speed
        await page.setRequestInterception(true);
        page.on('request', (req) => {
            const type = req.resourceType();
            if (['font', 'media', 'websocket'].includes(type))
                req.abort();
            else
                req.continue();
        });
        await page.goto(url, { waitUntil: 'networkidle2', timeout: 45000 });
        // Scroll down to trigger lazy loading
        await page.evaluate(`(async () => {
      for (let i = 0; i < 3; i++) {
        window.scrollBy(0, window.innerHeight);
        await new Promise(r => setTimeout(r, 800));
      }
      window.scrollTo(0, 0);
    })()`);
        // Wait a bit for lazy images
        await new Promise(r => setTimeout(r, 1500));
        const html = await page.content();
        const result = extractImages(html, url);
        // Also grab images directly from the DOM (JS-rendered src)
        const domImages = await page.evaluate(`
      Array.from(document.querySelectorAll('img'))
        .map(img => img.currentSrc || img.src)
        .filter(src => src && src.startsWith('http') && !src.includes('data:'))
    `);
        const imageSet = new Set([...result.images, ...domImages.filter(isProjectImage)]);
        return {
            title: result.title,
            description: result.description,
            images: Array.from(imageSet).slice(0, 50),
            sourceUrl: url,
            method: 'browser',
        };
    }
    finally {
        if (browser)
            await browser.close().catch(() => { });
    }
}
// ── Public API: try fast, fallback to browser ──
async function scrapePortfolio(url) {
    // Layer 1: Fast HTTP
    const fast = await scrapeFast(url);
    if (fast && fast.images.length > 0)
        return fast;
    // Layer 2: Headless browser
    console.log(`[Scraper] Fast method got 0 images for ${url}, trying browser...`);
    const result = await scrapeBrowser(url);
    if (result.images.length === 0) {
        throw new Error('No images found on this page. The website may use a format we cannot parse.');
    }
    return result;
}
