import https from 'https';
import http from 'http';
import fs from 'fs';
import { promisify } from 'util';
import { execFile as execFileCallback } from 'child_process';

const execFile = promisify(execFileCallback);

const REQUEST_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/*,*/*;q=0.8',
};

const DOWNLOAD_HEADERS = {
  'User-Agent': REQUEST_HEADERS['User-Agent'],
};

const SKIP_IMAGE_PATTERNS = [
  'data:',
  'pixel',
  'track',
  'tracking',
  'blank',
  'placeholder',
  'gravatar',
];

const SKIP_LOGO_PATTERNS = [
  'facebook.com',
  'twitter.com',
  'x.com',
  'linkedin.com',
  'youtube.com',
  'ytimg.com',
  'google.com',
  'datconsultancy.com',
];

function normalizeUrl(url, baseUrl) {
  if (!url) return null;
  const cleaned = url
    .replace(/&amp;/g, '&')
    .replace(/^['"]|['"]$/g, '')
    .trim();

  if (!cleaned || cleaned.startsWith('data:')) return null;

  try {
    return new URL(cleaned, `${baseUrl}/`).toString();
  } catch {
    return null;
  }
}

function isSkippableImage(url) {
  if (!url) return true;
  const lower = url.toLowerCase();
  return SKIP_IMAGE_PATTERNS.some((pattern) => lower.includes(pattern));
}

function isLikelyContentImage(url) {
  if (!url) return false;
  const lower = url.toLowerCase();

  if (isSkippableImage(lower)) return false;
  if (lower.includes('favicon')) return false;
  if (lower.includes('/uploads/settings/')) return false;
  if (lower.includes('fullstar')) return false;
  if (lower.includes('icon') && !lower.includes('interior') && !lower.includes('project')) return false;
  if (lower.includes('logo') && !lower.includes('project') && !lower.includes('portfolio')) return false;

  return /\.(png|jpe?g|webp|avif|gif)(?:$|[?#])/i.test(lower)
    || lower.includes('/_next/image?url=')
    || lower.includes('/uploads/')
    || lower.includes('/wp-content/uploads/')
    || lower.includes('s3.')
    || lower.includes('/file/');
}

function isLikelyLogo(url) {
  if (!url) return false;
  const lower = url.toLowerCase();

  if (SKIP_LOGO_PATTERNS.some((pattern) => lower.includes(pattern))) return false;
  if (lower.includes('project') || lower.includes('portfolio') || lower.includes('banner')) return false;

  return lower.includes('logo')
    || lower.includes('brand')
    || lower.includes('navbar')
    || lower.includes('header')
    || lower.includes('favicon')
    || lower.includes('apple-touch-icon');
}

function uniqueUrls(urls) {
  return [...new Set(urls.filter(Boolean))];
}

function scoreLogoCandidate(url) {
  const lower = url.toLowerCase();
  let score = 0;

  if (lower.includes('flattened')) score += 6;
  if (lower.includes('logo')) score += 4;
  if (lower.includes('brand')) score += 3;
  if (lower.includes('favicon')) score -= 5;
  if (lower.includes('apple-touch')) score -= 4;
  if (lower.includes('cropped-')) score -= 3;
  if (/(32x32|72x72|114x114|144x144|180x180|192x192|270x270)/.test(lower)) score -= 4;

  return score;
}

async function fetchWithNode(url, maxRedirects = 5) {
  if (maxRedirects <= 0) throw new Error('Too many redirects');

  return new Promise((resolve, reject) => {
    const mod = url.startsWith('https') ? https : http;
    const req = mod.get(url, {
      headers: REQUEST_HEADERS,
      timeout: 15000,
    }, (res) => {
      if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location) {
        const redirectUrl = normalizeUrl(res.headers.location, url);
        if (!redirectUrl) {
          reject(new Error('Invalid redirect URL'));
          return;
        }
        fetchWithNode(redirectUrl, maxRedirects - 1).then(resolve).catch(reject);
        return;
      }

      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => resolve({
        status: res.statusCode,
        headers: res.headers,
        body: Buffer.concat(chunks),
      }));
      res.on('error', reject);
    });

    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Timeout'));
    });
  });
}

async function fetchWithCurl(url) {
  const { stdout } = await execFile('curl', [
    '--silent',
    '--show-error',
    '--location',
    '--http1.1',
    '--max-time', '25',
    '--user-agent', REQUEST_HEADERS['User-Agent'],
    '--header', `Accept: ${REQUEST_HEADERS.Accept}`,
    url,
  ], {
    maxBuffer: 20 * 1024 * 1024,
  });

  return {
    status: 200,
    headers: {},
    body: Buffer.from(stdout),
  };
}

export async function fetchUrl(url, options = {}) {
  const { allowCurlFallback = true } = options;

  try {
    return await fetchWithNode(url);
  } catch (error) {
    if (!allowCurlFallback) throw error;
    return fetchWithCurl(url);
  }
}

async function downloadWithNode(url, dest, redirectsLeft = 5) {
  if (redirectsLeft <= 0) throw new Error('Too many redirects');

  return new Promise((resolve, reject) => {
    const mod = url.startsWith('https') ? https : http;

    mod.get(url, {
      headers: DOWNLOAD_HEADERS,
      timeout: 20000,
    }, (res) => {
      if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location) {
        const redirectUrl = normalizeUrl(res.headers.location, url);
        if (!redirectUrl) {
          reject(new Error('Invalid redirect URL'));
          return;
        }
        downloadWithNode(redirectUrl, dest, redirectsLeft - 1).then(resolve).catch(reject);
        return;
      }

      if (res.statusCode !== 200) {
        reject(new Error(`HTTP ${res.statusCode}`));
        return;
      }

      const ws = fs.createWriteStream(dest);
      res.pipe(ws);
      ws.on('finish', () => {
        ws.close();
        resolve(dest);
      });
      ws.on('error', reject);
    }).on('error', reject);
  });
}

async function downloadWithCurl(url, dest) {
  await execFile('curl', [
    '--silent',
    '--show-error',
    '--fail',
    '--location',
    '--http1.1',
    '--max-time', '30',
    '--user-agent', DOWNLOAD_HEADERS['User-Agent'],
    '--output', dest,
    url,
  ], {
    maxBuffer: 5 * 1024 * 1024,
  });

  return dest;
}

export async function downloadFile(url, dest, options = {}) {
  const { allowCurlFallback = true } = options;

  if (!url) throw new Error('No URL');

  try {
    return await downloadWithNode(url, dest);
  } catch (error) {
    if (!allowCurlFallback) throw error;
    return downloadWithCurl(url, dest);
  }
}

function collectMatches(html, patterns, baseUrl) {
  const urls = [];

  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(html)) !== null) {
      const normalized = normalizeUrl(match[1], baseUrl);
      if (normalized) {
        urls.push(normalized);
      }
    }
  }

  return uniqueUrls(urls);
}

export function extractLogoUrl(html, baseUrl) {
  const primaryCandidates = collectMatches(html, [
    /<img[^>]+(?:class|id)=["'][^"']*(?:logo|brand|navbar-brand|site-logo)[^"']*["'][^>]+(?:src|data-src|data-lazy-src|bv-data-src)=["']([^"']+)["']/gi,
    /<(?:a|div|span)[^>]+(?:class|id)=["'][^"']*(?:logo|brand|navbar-brand|site-logo)[^"']*["'][^>]*>[\s\S]{0,400}?<img[^>]+(?:src|data-src|data-lazy-src|bv-data-src)=["']([^"']+)["']/gi,
    /<(?:img|source)[^>]+(?:src|data-src|data-lazy-src|bv-data-src)=["']([^"']*(?:logo|brand)[^"']*)["']/gi,
    /<(?:img|source)[^>]+(?:src|data-src|data-lazy-src|bv-data-src)=["']([^"']+)["'][^>]+(?:class|id)=["'][^"']*(?:logo|brand|top-logo|site-logo)[^"']*["']/gi,
  ], baseUrl).filter(isLikelyLogo);

  const secondaryCandidates = collectMatches(html, [
    /"logo"\s*:\s*"(https?:\/\/[^"]+)"/gi,
    /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/gi,
    /<link[^>]+rel=["'][^"']*(?:shortcut icon|icon|apple-touch-icon)[^"']*["'][^>]+href=["']([^"']+)["']/gi,
  ], baseUrl)
    .filter((url) => !SKIP_LOGO_PATTERNS.some((pattern) => url.toLowerCase().includes(pattern)));

  const allCandidates = uniqueUrls([...primaryCandidates, ...secondaryCandidates])
    .sort((a, b) => scoreLogoCandidate(b) - scoreLogoCandidate(a));

  return allCandidates[0] || null;
}

export function extractPortfolioImages(html, baseUrl) {
  const simpleAttributeUrls = collectMatches(html, [
    /<(?:img|source)[^>]+(?:src|data-src|data-lazy-src|data-lazy-original|data-original|data-image|bv-data-src)=["']([^"']+)["']/gi,
    /"(https?:\/\/[^"]+\.(?:png|jpe?g|webp|avif))(?:\?[^"]*)?"/gi,
    /url\((https?:\/\/[^)]+|\/[^)]+)\)/gi,
    /"url":"(https?:\/\/[^"]+)"/gi,
    /\\"url\\":\\"(https?:\/\/[^"]+)\\"/gi,
  ], baseUrl);

  const srcsetCandidates = [];
  const srcsetPatterns = [
    /<(?:img|source|link)[^>]+(?:srcset|imagesrcset)=["']([^"']+)["']/gi,
  ];

  for (const pattern of srcsetPatterns) {
    let match;
    while ((match = pattern.exec(html)) !== null) {
      srcsetCandidates.push(match[1]);
    }
  }

  const srcsetUrls = [];
  for (const raw of srcsetCandidates) {
    for (const entry of raw.split(',')) {
      const firstToken = entry.trim().split(/\s+/)[0];
      const normalized = normalizeUrl(firstToken, baseUrl);
      if (normalized) {
        srcsetUrls.push(normalized);
      }
    }
  }

  return uniqueUrls([...simpleAttributeUrls, ...srcsetUrls])
    .filter(isLikelyContentImage);
}

const CATEGORY_URL_PREFIXES = [
  'projects', 'portfolio', 'works', 'gallery', 'case-study',
];

const CATEGORY_KEYWORDS = [
  'Residential', 'Commercial', 'Hospitality', 'Villa', 'Office',
  'Retail', 'Penthouse', 'Apartment', 'Restaurant', 'Hotel',
  'Spa', 'Salon', 'Clinic', 'Mosque', 'Palace',
];

const CATEGORY_KEYWORDS_LOWER = CATEGORY_KEYWORDS.map((k) => k.toLowerCase());

export function extractCategoryLinks(html, baseUrl) {
  const seen = new Set();
  const results = [];

  const anchorPattern = /<a\s[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let match;

  while ((match = anchorPattern.exec(html)) !== null) {
    const href = match[1].trim();
    const text = match[2].replace(/<[^>]+>/g, '').trim();

    const normalized = normalizeUrl(href, baseUrl);
    if (!normalized || seen.has(normalized)) continue;

    // Check if the URL path matches a portfolio/category prefix
    let category = null;
    try {
      const pathname = new URL(normalized).pathname.toLowerCase();
      const segments = pathname.replace(/^\//, '').split('/');
      if (segments.length >= 2 && CATEGORY_URL_PREFIXES.includes(segments[0])) {
        const slug = segments[1];
        // Find matching keyword (case-insensitive)
        const idx = CATEGORY_KEYWORDS_LOWER.indexOf(slug);
        if (idx !== -1) {
          category = CATEGORY_KEYWORDS[idx];
        } else {
          // Capitalize the slug as the category name
          category = slug.charAt(0).toUpperCase() + slug.slice(1);
        }
      }
    } catch {
      // ignore invalid URLs
    }

    // If no URL-based category found, check link text
    if (!category) {
      const textLower = text.toLowerCase();
      const idx = CATEGORY_KEYWORDS_LOWER.indexOf(textLower);
      if (idx !== -1) {
        category = CATEGORY_KEYWORDS[idx];
      }
    }

    if (category) {
      seen.add(normalized);
      results.push({ url: normalized, category });
    }
  }

  return results;
}

export function getExtension(url, contentType) {
  if (url.includes('.svg')) return '.svg';
  if (url.includes('.png')) return '.png';
  if (url.includes('.webp')) return '.webp';
  if (url.includes('.avif')) return '.avif';
  if (contentType?.includes('svg')) return '.svg';
  if (contentType?.includes('png')) return '.png';
  if (contentType?.includes('webp')) return '.webp';
  if (contentType?.includes('avif')) return '.avif';
  return '.jpg';
}
