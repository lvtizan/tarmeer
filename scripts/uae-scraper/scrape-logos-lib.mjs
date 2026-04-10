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
    || lower.includes('/file/')
    || lower.includes('res.cloudinary.com')
    || lower.includes('images.unsplash.com')
    || lower.includes('cdn.sanity.io')
    || lower.includes('images.prismic.io')
    || lower.includes('images.contentful.com')
    || lower.includes('imagedelivery.net')
    || /\/f_auto[,/]/.test(lower)
    || /\/image\//.test(lower);
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

  // From srcset, pick the LARGEST version (highest width descriptor)
  const srcsetUrls = [];
  for (const raw of srcsetCandidates) {
    const entries = raw.split(',').map(entry => {
      const parts = entry.trim().split(/\s+/);
      const url = parts[0];
      const descriptor = parts[1] || '0w';
      const width = parseInt(descriptor) || 0;
      return { url, width };
    }).filter(e => e.url);

    // Sort by width descending, pick largest
    entries.sort((a, b) => b.width - a.width);
    if (entries.length > 0) {
      const normalized = normalizeUrl(entries[0].url, baseUrl);
      if (normalized) srcsetUrls.push(normalized);
    }
  }

  // Merge and deduplicate
  let allUrls = uniqueUrls([...simpleAttributeUrls, ...srcsetUrls])
    .filter(isLikelyContentImage);

  // Upgrade WordPress thumbnail URLs to full-size originals
  // e.g. image-300x200.jpg -> image.jpg
  allUrls = allUrls.map(url => {
    return url.replace(/-\d{2,4}x\d{2,4}(\.\w+)$/, '$1');
  });

  // Upgrade Next.js image optimizer URLs to higher quality
  // e.g. /_next/image?url=...&w=384&q=75 -> &w=1200&q=90
  allUrls = allUrls.map(url => {
    if (url.includes('/_next/image')) {
      return url
        .replace(/[&?]w=\d+/, '&w=1200')
        .replace(/[&?]q=\d+/, '&q=90');
    }
    return url;
  });

  // Upgrade Cloudinary to higher quality
  // e.g. /w_400,h_300,c_fill/ -> /w_1200,c_fill,q_auto/
  allUrls = allUrls.map(url => {
    if (url.includes('cloudinary.com') && /\/w_\d+/.test(url)) {
      return url
        .replace(/\/w_\d+/, '/w_1200')
        .replace(/\/h_\d+,?/, '')
        .replace(/\/q_\d+/, '/q_auto');
    }
    return url;
  });

  return uniqueUrls(allUrls);
}

/**
 * Extract portfolio images WITH associated text (project titles, alt text, captions).
 * Returns array of { url, title } objects.
 *
 * Strategy: find each <img> and look for associated text in:
 * 1. alt attribute
 * 2. Nearest heading (h1-h6) in parent container
 * 3. Nearest <a> text wrapping the image
 * 4. Nearest <figcaption>
 * 5. title attribute
 */
export function extractPortfolioImagesWithText(html, baseUrl) {
  const results = [];
  const seenUrls = new Set();

  // Pattern: find img tags with surrounding context (up to 500 chars before)
  // Match: optional wrapping <a> with text, then <img> with src and alt
  const imgPattern = /<img[^>]+(?:src|data-src|data-lazy-src)=["']([^"']+)["'][^>]*>/gi;
  let imgMatch;

  while ((imgMatch = imgPattern.exec(html)) !== null) {
    const imgTag = imgMatch[0];
    const rawSrc = imgMatch[1];
    let url = normalizeUrl(rawSrc, baseUrl);
    if (!url || !isLikelyContentImage(url)) continue;
    // Upgrade to full-size image
    url = url.replace(/-\d{2,4}x\d{2,4}(\.\w+)$/, '$1');
    if (url.includes('/_next/image')) {
      url = url.replace(/[&?]w=\d+/, '&w=1200').replace(/[&?]q=\d+/, '&q=90');
    }
    if (url.includes('cloudinary.com') && /\/w_\d+/.test(url)) {
      url = url.replace(/\/w_\d+/, '/w_1200').replace(/\/h_\d+,?/, '').replace(/\/q_\d+/, '/q_auto');
    }
    if (seenUrls.has(url)) continue;
    seenUrls.add(url);

    // Extract alt text
    const altMatch = imgTag.match(/alt=["']([^"']*?)["']/i);
    const alt = altMatch ? altMatch[1].trim() : '';

    // Extract title attribute
    const titleAttrMatch = imgTag.match(/title=["']([^"']*?)["']/i);
    const titleAttr = titleAttrMatch ? titleAttrMatch[1].trim() : '';

    // Look backwards in HTML for nearest heading or link text (within 800 chars)
    const pos = imgMatch.index;
    const contextBefore = html.substring(Math.max(0, pos - 800), pos);

    // Find last heading before this image
    let headingTitle = '';
    const headingMatches = [...contextBefore.matchAll(/<h[1-6][^>]*>([\s\S]*?)<\/h[1-6]>/gi)];
    if (headingMatches.length > 0) {
      headingTitle = headingMatches[headingMatches.length - 1][1]
        .replace(/<[^>]+>/g, '').trim();
    }

    // Find wrapping <a> title
    let linkTitle = '';
    const linkMatches = [...contextBefore.matchAll(/<a[^>]*?title=["']([^"']+)["']/gi)];
    if (linkMatches.length > 0) {
      linkTitle = linkMatches[linkMatches.length - 1][1].trim();
    }

    // Look forward for figcaption
    let captionTitle = '';
    const contextAfter = html.substring(pos, Math.min(html.length, pos + 500));
    const captionMatch = contextAfter.match(/<figcaption[^>]*>([\s\S]*?)<\/figcaption>/i);
    if (captionMatch) {
      captionTitle = captionMatch[1].replace(/<[^>]+>/g, '').trim();
    }

    // Pick best title: prefer heading > caption > link title > alt > title attr
    let title = headingTitle || captionTitle || linkTitle || alt || titleAttr || '';

    // Clean up: remove generic SEO spam, limit length
    if (title) {
      title = title
        .replace(/\s+/g, ' ')
        .replace(/^(interior design|design|project|image|photo|picture)\s*/i, '')
        .trim();
      if (title.length > 120) title = title.substring(0, 117) + '...';
      // Skip if it's just generic keywords
      if (/^(interior design|design company|best|top|luxury)\s*(in|of|for)?\s*(dubai|uae|abu dhabi)?$/i.test(title)) {
        title = '';
      }
    }

    results.push({ url, title });
  }

  return results;
}

const CATEGORY_URL_PREFIXES = [
  'projects', 'project', 'portfolio', 'works', 'work', 'gallery',
  'case-study', 'case-studies', 'our-work', 'our-projects',
  'fitout-projects', 'design-work', 'our-design-work',
  'services', 'sectors', 'expertise',
];

const CATEGORY_KEYWORDS = [
  'Residential', 'Commercial', 'Hospitality', 'Villa', 'Office',
  'Retail', 'Penthouse', 'Apartment', 'Restaurant', 'Hotel',
  'Spa', 'Salon', 'Clinic', 'Mosque', 'Palace',
  'Healthcare', 'Education', 'Industrial', 'Landscape',
  'Exterior', 'Interior', 'Fit-Out', 'Fitout', 'Renovation',
  'Luxury', 'Contemporary', 'Classic', 'Modern', 'Minimalist',
  'Corporate', 'Workplace', 'Mixed-Use', 'Cultural', 'Leisure',
  'Master-Plan', 'Masterplan', 'Urban', 'Tower', 'High-Rise',
  'F&B', 'Dining', 'Cafe', 'Lounge', 'Bar',
  'Boutique', 'Showroom', 'Exhibition', 'Museum', 'Theater',
  'Dubai', 'Abu-Dhabi', 'Sharjah', 'Ajman', 'Fujairah',
  'Al-Ain', 'Ras-Al-Khaimah',
];

const CATEGORY_KEYWORDS_LOWER = CATEGORY_KEYWORDS.map((k) => k.toLowerCase());

/**
 * Strip language prefix from pathname segments.
 * e.g. ['en', 'projects', 'residential'] -> ['projects', 'residential']
 */
function stripLangPrefix(segments) {
  if (segments.length > 0 && /^(en|ar|fr|de|es|ru|zh|ja|ko)$/.test(segments[0])) {
    return segments.slice(1);
  }
  return segments;
}

/**
 * Try to extract a category name from URL path segments.
 * Handles patterns like:
 *   /projects/residential
 *   /en/fitout-projects/dubai
 *   /en/services/interior-design/residential
 *   /portfolio/category-name
 *   projects.php (with link text as category)
 */
function categoryFromPath(pathname) {
  const clean = pathname.replace(/\.php$/, '').replace(/^\//, '').replace(/\/+$/, '');
  const segments = stripLangPrefix(clean.split('/').filter(Boolean));

  if (segments.length < 2) return null;

  // Check if any segment is a known portfolio prefix
  for (let i = 0; i < segments.length - 1; i++) {
    if (CATEGORY_URL_PREFIXES.includes(segments[i])) {
      // The category is the last segment (deepest level)
      const slug = segments[segments.length - 1];
      const idx = CATEGORY_KEYWORDS_LOWER.indexOf(slug);
      if (idx !== -1) return CATEGORY_KEYWORDS[idx];
      // Capitalize slug: 'mixed-use' -> 'Mixed-Use'
      return slug.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join('-');
    }
  }

  return null;
}

/**
 * Check if a URL looks like a portfolio/project listing page (not just a category).
 * Used as fallback when no category links are found.
 */
function isPortfolioListingUrl(pathname) {
  const clean = pathname.replace(/\.php$/, '').replace(/^\//, '').toLowerCase();
  const segments = stripLangPrefix(clean.split('/').filter(Boolean));
  if (segments.length === 0) return false;
  return CATEGORY_URL_PREFIXES.includes(segments[0]);
}

export function extractCategoryLinks(html, baseUrl) {
  const seen = new Set();
  const results = [];
  const baseHost = new URL(baseUrl).hostname;

  const anchorPattern = /<a\s[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let match;

  while ((match = anchorPattern.exec(html)) !== null) {
    const href = match[1].trim();
    const text = match[2].replace(/<[^>]+>/g, '').trim();

    const normalized = normalizeUrl(href, baseUrl);
    if (!normalized || seen.has(normalized)) continue;

    // Only same-host links
    try {
      if (new URL(normalized).hostname !== baseHost) continue;
    } catch { continue; }

    let category = null;
    try {
      const pathname = new URL(normalized).pathname.toLowerCase();
      category = categoryFromPath(pathname);
    } catch {
      // ignore
    }

    // If no URL-based category, check link text against keywords
    if (!category && text) {
      const textLower = text.toLowerCase().trim();
      const idx = CATEGORY_KEYWORDS_LOWER.indexOf(textLower);
      if (idx !== -1) {
        // Verify the URL at least looks portfolio-related
        try {
          const pathname = new URL(normalized).pathname.toLowerCase();
          if (isPortfolioListingUrl(pathname) || pathname.includes(textLower)) {
            category = CATEGORY_KEYWORDS[idx];
          }
        } catch { /* ignore */ }
      }
    }

    // Fallback: link text is a keyword and href contains it
    if (!category && text) {
      const textLower = text.toLowerCase().trim();
      for (let i = 0; i < CATEGORY_KEYWORDS_LOWER.length; i++) {
        if (textLower === CATEGORY_KEYWORDS_LOWER[i] || textLower.startsWith(CATEGORY_KEYWORDS_LOWER[i] + ' ')) {
          try {
            const hrefLower = new URL(normalized).pathname.toLowerCase();
            if (hrefLower.includes(CATEGORY_KEYWORDS_LOWER[i].replace(/[- ]/g, ''))) {
              category = CATEGORY_KEYWORDS[i];
              break;
            }
          } catch { /* ignore */ }
        }
      }
    }

    if (category) {
      seen.add(normalized);
      results.push({ url: normalized, category });
    }
  }

  return results;
}

/**
 * Extract portfolio listing page URLs (non-categorized).
 * These are top-level pages like /projects, /portfolio, /en/our-design-work.
 * Used when extractCategoryLinks finds nothing.
 */
export function extractPortfolioPageLinks(html, baseUrl) {
  const seen = new Set();
  const results = [];
  const baseHost = new URL(baseUrl).hostname;

  const anchorPattern = /<a\s[^>]*href=["']([^"']+)["'][^>]*>/gi;
  let match;

  while ((match = anchorPattern.exec(html)) !== null) {
    const href = match[1].trim();
    const normalized = normalizeUrl(href, baseUrl);
    if (!normalized || seen.has(normalized)) continue;

    try {
      const url = new URL(normalized);
      if (url.hostname !== baseHost) continue;
      if (isPortfolioListingUrl(url.pathname)) {
        seen.add(normalized);
        results.push(normalized);
      }
    } catch { continue; }
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

/* ------------------------------------------------------------------ */
/*  Lightweight page metadata extraction                               */
/*                                                                      */
/*  Extracts title / description / year / location via regex + DOM     */
/*  heuristics (no LLM, no paid APIs). Used by the portfolio scraper   */
/*  to attach context to each crawled category / project page.        */
/*                                                                      */
/*  Each field is best-effort — any of them may be empty strings/null. */
/*  Coverage is intentionally "good enough" rather than perfect.        */
/* ------------------------------------------------------------------ */

// UAE location keywords, ordered MOST-SPECIFIC first. Earlier = preferred.
// So "Palm Jumeirah" wins over "Jumeirah", "Downtown Dubai" over "Dubai", etc.
const UAE_LOCATIONS = [
  // Most specific neighborhoods first
  'Palm Jumeirah', 'Downtown Dubai', 'Dubai Marina', 'Dubai Hills',
  'Arabian Ranches', 'Emirates Hills', 'Business Bay', 'Al Barsha', 'Al Wasl',
  'Ras Al Khaimah', 'Ras al-Khaimah', 'Umm Al Quwain', 'Umm al-Quwain',
  'JBR', 'JLT', 'DIFC',
  // Neighborhood that's also a city name — keep after Palm Jumeirah
  'Jumeirah',
  // Emirates / cities
  'Abu Dhabi', 'Dubai', 'Sharjah', 'Ajman', 'Fujairah',
  // Country fallbacks (weakest match)
  'United Arab Emirates', 'UAE',
];

// Preferred location priorities — when multiple match, pick the most specific.
const LOCATION_RANK = new Map(UAE_LOCATIONS.map((loc, i) => [loc.toLowerCase(), i]));

function stripHtmlTags(s) {
  return s
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

function decodeHtmlEntities(s) {
  if (!s) return '';
  return s
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .trim();
}

/**
 * Extract the page title.
 * Priority: og:title → twitter:title → first h1 → <title>
 */
function extractTitle(html) {
  // og:title
  const og = html.match(/<meta[^>]+property=["']og:title["'][^>]*content=["']([^"']+)["']/i)
          || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]*property=["']og:title["']/i);
  if (og) {
    const t = decodeHtmlEntities(og[1]).trim();
    if (t && t.length >= 3) return t;
  }

  // twitter:title
  const tw = html.match(/<meta[^>]+name=["']twitter:title["'][^>]*content=["']([^"']+)["']/i);
  if (tw) {
    const t = decodeHtmlEntities(tw[1]).trim();
    if (t && t.length >= 3) return t;
  }

  // first h1
  const h1 = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  if (h1) {
    const t = stripHtmlTags(h1[1]);
    if (t && t.length >= 3) return t;
  }

  // <title>
  const tt = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (tt) {
    const t = stripHtmlTags(tt[1]);
    if (t && t.length >= 3) return t;
  }

  return '';
}

/**
 * Extract the page description.
 * Priority: meta description → og:description → first substantial <p> (≥ 60 chars, ≤ 800 chars).
 */
function extractDescription(html) {
  // <meta name="description" content="...">
  const md = html.match(/<meta[^>]+name=["']description["'][^>]*content=["']([^"']+)["']/i)
          || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]*name=["']description["']/i);
  if (md) {
    const t = decodeHtmlEntities(md[1]).trim();
    if (t && t.length >= 40) return t;
  }

  // og:description
  const og = html.match(/<meta[^>]+property=["']og:description["'][^>]*content=["']([^"']+)["']/i)
          || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]*property=["']og:description["']/i);
  if (og) {
    const t = decodeHtmlEntities(og[1]).trim();
    if (t && t.length >= 40) return t;
  }

  // First substantial <p> tag. Skip tiny / nav / cookie banners.
  const pPattern = /<p[^>]*>([\s\S]*?)<\/p>/gi;
  let m;
  while ((m = pPattern.exec(html)) !== null) {
    const text = stripHtmlTags(m[1]);
    if (!text || text.length < 60 || text.length > 800) continue;
    // Skip obvious boilerplate
    if (/cookie|subscribe|newsletter|copyright|all rights reserved/i.test(text)) continue;
    return text;
  }

  return '';
}

/**
 * Extract a year from the page text.
 * Looks for 2010-2099 in context like "Completed 2023", "in 2022", or a bare year.
 * Returns the most recent plausible year found, or null.
 */
function extractYear(textOrHtml) {
  const text = /<[a-z]/i.test(textOrHtml) ? stripHtmlTags(textOrHtml) : textOrHtml;
  // Restrict to plausible project years
  const pattern = /\b(20[0-3]\d)\b/g;
  const years = new Set();
  let m;
  while ((m = pattern.exec(text)) !== null) {
    const y = parseInt(m[1], 10);
    if (y >= 2010 && y <= new Date().getFullYear() + 1) {
      years.add(y);
    }
  }
  if (years.size === 0) return null;
  // Prefer the latest year present — usually the project's completion date
  return Math.max(...years);
}

/**
 * Extract a UAE location keyword from the text.
 * Matches against UAE_LOCATIONS, returns the most specific match.
 * Returns '' if nothing matches.
 */
function extractLocation(textOrHtml) {
  const text = /<[a-z]/i.test(textOrHtml) ? stripHtmlTags(textOrHtml) : textOrHtml;
  const lower = text.toLowerCase();

  let best = null;
  let bestRank = Infinity;
  for (const loc of UAE_LOCATIONS) {
    if (lower.includes(loc.toLowerCase())) {
      const rank = LOCATION_RANK.get(loc.toLowerCase()) ?? Infinity;
      if (rank < bestRank) {
        best = loc;
        bestRank = rank;
      }
    }
  }
  return best || '';
}

/**
 * Extract all four metadata fields from a rendered HTML page.
 * Returns { title, description, year, location, sourceUrl }.
 * Any field may be an empty string or null — caller decides how strict to be.
 */
export function extractPageMetadata(html, sourceUrl = '') {
  const title = extractTitle(html);
  const description = extractDescription(html);
  // Year and location: search the body text PLUS the title and description,
  // because useful hints live in og:title / meta description which
  // stripHtmlTags drops from the body when it removes meta tags.
  const searchText = [title, description, stripHtmlTags(html)].filter(Boolean).join(' ');
  const year = extractYear(searchText);
  const location = extractLocation(searchText);

  return { title, description, year, location, sourceUrl };
}
