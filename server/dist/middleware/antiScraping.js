"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.antiScraping = antiScraping;
exports.adminLoginRateLimit = adminLoginRateLimit;
// Known good bot User-Agents (SEO crawlers we want to allow)
const ALLOWED_BOTS = [
    'googlebot', 'bingbot', 'slurp', 'duckduckbot', 'baiduspider',
    'yandexbot', 'facebot', 'twitterbot', 'linkedinbot', 'whatsapp',
    'telegrambot', 'applebot', 'discordbot',
];
// Suspicious User-Agents commonly used by scrapers
const BLOCKED_UA_PATTERNS = [
    /python-requests/i, /scrapy/i, /httpclient/i, /java\//i,
    /wget/i, /curl/i, /libwww/i, /lwp-trivial/i, /php\//i,
    /go-http-client/i, /node-fetch/i, /axios/i, /undici/i,
];
// Per-IP request tracking for API endpoints
const ipRequestLog = new Map();
const WINDOW_MS = 60000; // 1 minute
const MAX_API_REQUESTS_PER_MINUTE = 60; // public API limit per IP
const BLOCK_DURATION_MS = 5 * 60000; // block for 5 minutes after exceeding
// Cleanup stale entries every 10 minutes
setInterval(() => {
    const now = Date.now();
    for (const [ip, entry] of ipRequestLog) {
        if (now - entry.windowStart > BLOCK_DURATION_MS + WINDOW_MS) {
            ipRequestLog.delete(ip);
        }
    }
}, 10 * 60000);
function getClientIp(req) {
    const forwarded = req.headers['x-forwarded-for'];
    if (typeof forwarded === 'string')
        return forwarded.split(',')[0].trim();
    return req.ip || req.socket.remoteAddress || 'unknown';
}
function isAllowedBot(ua) {
    const lower = ua.toLowerCase();
    return ALLOWED_BOTS.some((bot) => lower.includes(bot));
}
function isBlockedUA(ua) {
    return BLOCKED_UA_PATTERNS.some((pattern) => pattern.test(ua));
}
/**
 * Anti-scraping middleware for public API endpoints.
 * - Blocks known scraping User-Agents (but allows SEO bots)
 * - Rate-limits per IP (60 req/min for public API)
 * - Temporarily blocks IPs that exceed the limit
 */
function antiScraping(req, res, next) {
    const ua = req.headers['user-agent'] || '';
    const ip = getClientIp(req);
    // Allow known good bots (Google, Bing, etc.)
    if (ua && isAllowedBot(ua)) {
        return next();
    }
    // Block known scraping libraries
    if (ua && isBlockedUA(ua)) {
        return res.status(403).json({ error: 'Access denied.' });
    }
    // Block requests with no User-Agent
    if (!ua) {
        return res.status(403).json({ error: 'Access denied.' });
    }
    // Per-IP rate tracking
    const now = Date.now();
    let entry = ipRequestLog.get(ip);
    if (!entry) {
        entry = { count: 0, windowStart: now, blocked: false };
        ipRequestLog.set(ip, entry);
    }
    // Check if currently blocked
    if (entry.blocked) {
        if (now - entry.windowStart < BLOCK_DURATION_MS) {
            return res.status(429).json({ error: 'Too many requests. Please try again later.' });
        }
        // Unblock after duration
        entry.blocked = false;
        entry.count = 0;
        entry.windowStart = now;
    }
    // Reset window if expired
    if (now - entry.windowStart > WINDOW_MS) {
        entry.count = 0;
        entry.windowStart = now;
    }
    entry.count++;
    // Block if exceeded
    if (entry.count > MAX_API_REQUESTS_PER_MINUTE) {
        entry.blocked = true;
        entry.windowStart = now;
        return res.status(429).json({ error: 'Too many requests. Please try again later.' });
    }
    next();
}
/**
 * Stricter rate limiter for admin login (5 attempts per 15 min per IP)
 */
const adminLoginLog = new Map();
const ADMIN_LOGIN_WINDOW_MS = 15 * 60000;
const ADMIN_LOGIN_MAX = 5;
function adminLoginRateLimit(req, res, next) {
    const ip = getClientIp(req);
    const now = Date.now();
    let entry = adminLoginLog.get(ip);
    if (!entry || now - entry.windowStart > ADMIN_LOGIN_WINDOW_MS) {
        entry = { count: 0, windowStart: now };
        adminLoginLog.set(ip, entry);
    }
    entry.count++;
    if (entry.count > ADMIN_LOGIN_MAX) {
        return res.status(429).json({ error: 'Too many login attempts. Please try again in 15 minutes.' });
    }
    next();
}
