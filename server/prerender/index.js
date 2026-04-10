const express = require('express');
const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3003;
const CACHE_DIR = process.env.CACHE_DIR || '/tarmeer/prerender-cache';
const CACHE_TTL_MS = parseInt(process.env.CACHE_TTL_MS) || 24 * 60 * 60 * 1000;
const RENDER_TIMEOUT_MS = parseInt(process.env.RENDER_TIMEOUT_MS) || 15000;
const TARGET_HOST = process.env.TARGET_HOST || 'http://127.0.0.1:80';

if (!fs.existsSync(CACHE_DIR)) {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
}

let browser = null;

async function getBrowser() {
  if (!browser || !browser.connected) {
    browser = await puppeteer.launch({
      headless: 'new',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--single-process',
      ],
    });
  }
  return browser;
}

function getCacheKey(url) {
  return crypto.createHash('md5').update(url).digest('hex') + '.html';
}

function getCachedHTML(cacheFile) {
  if (!fs.existsSync(cacheFile)) return null;
  const stat = fs.statSync(cacheFile);
  if (Date.now() - stat.mtimeMs > CACHE_TTL_MS) {
    fs.unlinkSync(cacheFile);
    return null;
  }
  return fs.readFileSync(cacheFile, 'utf-8');
}

async function renderPage(url) {
  const b = await getBrowser();
  const page = await b.newPage();
  try {
    await page.setUserAgent('TarmeerPrerender/1.0');
    await page.goto(url, { waitUntil: 'networkidle0', timeout: RENDER_TIMEOUT_MS });
    await page.waitForSelector('title', { timeout: 5000 }).catch(() => {});
    return await page.content();
  } finally {
    await page.close();
  }
}

app.get('/health', (req, res) => {
  res.json({ status: 'ok', cached: fs.readdirSync(CACHE_DIR).length });
});

app.post('/clear-cache', (req, res) => {
  const files = fs.readdirSync(CACHE_DIR);
  files.forEach(f => fs.unlinkSync(path.join(CACHE_DIR, f)));
  res.json({ cleared: files.length });
});

app.get('*', async (req, res) => {
  const urlPath = req.originalUrl.replace('/prerenderproxy', '') || '/';
  const targetUrl = `${TARGET_HOST}${urlPath}`;
  const cacheFile = path.join(CACHE_DIR, getCacheKey(urlPath));

  const cached = getCachedHTML(cacheFile);
  if (cached) {
    res.set('Content-Type', 'text/html');
    res.set('X-Prerender-Cache', 'HIT');
    return res.send(cached);
  }

  try {
    const html = await renderPage(targetUrl);
    fs.writeFileSync(cacheFile, html);
    res.set('Content-Type', 'text/html');
    res.set('X-Prerender-Cache', 'MISS');
    res.send(html);
  } catch (err) {
    console.error(`[Prerender] Error rendering ${urlPath}:`, err.message);
    res.status(503).send('Prerender failed');
  }
});

process.on('SIGTERM', async () => {
  if (browser) await browser.close();
  process.exit(0);
});

app.listen(PORT, () => {
  console.log(`[Prerender] Service running on port ${PORT}`);
  console.log(`[Prerender] Cache dir: ${CACHE_DIR}, TTL: ${CACHE_TTL_MS / 1000}s`);
});
