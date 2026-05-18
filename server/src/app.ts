import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import session from 'express-session';
import dotenv from 'dotenv';
import authRoutes from './routes/auth';
import designerRoutes from './routes/designers';
import projectRoutes from './routes/projects';
import contactRoutes from './routes/contact';
import adminRoutes from './routes/admin';
import statsRoutes from './routes/stats';
import companyRoutes from './routes/companies';
import publicCompaniesRouter from './routes/publicCompanies';
import companyApplicationRoutes from './routes/companyApplications';
import inquiryRoutes from './routes/inquiries';
import notificationRoutes from './routes/notifications';
import complaintRoutes from './routes/complaints';
import companyLeadRoutes from './routes/companyLeads';
import articleRoutes from './routes/articles';
import supplierAuthRoutes from './routes/supplierAuth';
import supplierRoutes from './routes/suppliers';
import fieldRoutes from './routes/field';
import siteRoutes from './routes/site';
import integrationRoutes from './routes/integration';
import { ssoConsume } from './controllers/integrationController';
import { trackEvent } from './controllers/activityLogController';
import config from './config';
import {
  isPayloadTooLargeError,
  PAYLOAD_TOO_LARGE_MESSAGE,
  UPLOAD_REQUEST_BODY_LIMIT,
} from './lib/requestLimits';
import { getCorsConfig, logCorsViolation } from './lib/corsOrigins';
import { shouldSkipApiRateLimit } from './lib/rateLimitPolicy';
import { validateJWTConfig } from './lib/jwtManager';
import { runAutoMigrate } from './lib/autoMigrate';
import { calculateAllWeights } from './lib/weightCalculator';
import passport from './middleware/passport';

dotenv.config();

// 验证JWT配置
validateJWTConfig();

const app = express();
const PORT = config.port;

app.set('trust proxy', 1);

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:', 'https:'],
      fontSrc: ["'self'", 'https://fonts.gstatic.com'],
      connectSrc: ["'self'", 'https://accounts.google.com', 'https://www.facebook.com'],
      formAction: ["'self'", 'https://accounts.google.com', 'https://www.facebook.com'],
    },
  },
  crossOriginEmbedderPolicy: false, // OAuth 重定向需要
  crossOriginOpenerPolicy: { policy: 'same-origin-allow-popups' },
  crossOriginResourcePolicy: { policy: "cross-origin" },
  dnsPrefetchControl: true,
  frameguard: { action: 'deny' },
  hidePoweredBy: true,
  hsts: true,
  ieNoOpen: true,
  noSniff: true,
  originAgentCluster: true,
  permittedCrossDomainPolicies: true,
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  xssFilter: true,
}));

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1000,
  message: 'Too many requests from this IP, please try again later.',
  skip: (req) => shouldSkipApiRateLimit({
    nodeEnv: config.nodeEnv,
    method: req.method,
    path: req.path,
    ip: req.ip,
  }),
});
app.use('/api/', limiter);

// 公共只读 API 独立限速：每 IP 每分钟最多 120 次（防爬虫/扫描）
const publicReadLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  message: 'Too many requests, please slow down.',
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/companies', publicReadLimiter);
app.use('/api/public/companies', publicReadLimiter);
app.use('/api/designers', publicReadLimiter);

// 使用新的CORS配置
const corsConfig = getCorsConfig(config.frontendUrl);
app.use(cors(corsConfig));

// Session（Passport OAuth 需要）
app.use(session({
  secret: config.jwt.secret,
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: config.nodeEnv === 'production',
    maxAge: 10 * 60 * 1000, // 10 分钟，仅用于 OAuth 流程
  },
}));

// Passport 初始化
app.use(passport.initialize());
app.use(passport.session());

// 添加CORS违规日志记录
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin && !corsConfig.origin.includes(origin)) {
    logCorsViolation(origin, req.path);
  }
  next();
});

app.use(express.json({
  limit: UPLOAD_REQUEST_BODY_LIMIT,
  verify: (req: any, _res, buf) => { req.rawBody = buf.toString('utf8'); },
}));
app.use(express.urlencoded({ extended: true, limit: UPLOAD_REQUEST_BODY_LIMIT }));

app.get('/', (req, res) => {
  res.json({
    name: 'Tarmeer API',
    version: '1.0.0',
    description: 'Tarmeer 4.0 Backend API',
    endpoints: {
      auth: {
        register: 'POST /api/auth/register',
        login: 'POST /api/auth/login',
        verifyEmail: 'POST /api/auth/verify-email',
        resendVerification: 'POST /api/auth/resend-verification'
      },
      designers: {
        list: 'GET /api/designers',
        detail: 'GET /api/designers/:id',
        update: 'PUT /api/designers/:id'
      },
      projects: {
        list: 'GET /api/projects',
        detail: 'GET /api/projects/:id',
        create: 'POST /api/projects',
        update: 'PUT /api/projects/:id',
        delete: 'DELETE /api/projects/:id'
      },
      contact: {
        submit: 'POST /api/contact',
        list: 'GET /api/contact'
      },
      health: 'GET /api/health'
      ,
      companies: {
        list: 'GET /api/companies',
        detail: 'GET /api/companies/:slug'
      }
    }
  });
});

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    environment: config.nodeEnv
  });
});

// Dynamic sitemap endpoint
app.get('/api/sitemap.xml', async (req, res) => {
  try {
    const pool = (await import('./config/database')).default;

    // Get all directory companies
    const [uaeCompanies] = await pool.execute(
      'SELECT slug, updated_at FROM uae_companies WHERE slug IS NOT NULL ORDER BY weight_score DESC'
    );
    // Get all approved registered companies
    const [profiles] = await pool.execute(
      'SELECT slug, updated_at FROM company_profiles WHERE status = ? AND slug IS NOT NULL AND deleted_at IS NULL ORDER BY weight_score DESC',
      ['approved']
    );
    const baseUrl = 'https://www.tarmeer.com';
    const today = new Date().toISOString().slice(0, 10);

    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
    xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';

    // Static pages
    const staticPages = [
      { path: '', changefreq: 'daily', priority: '1.0' },
      { path: '/companies', changefreq: 'daily', priority: '0.9' },
      { path: '/portfolio', changefreq: 'daily', priority: '0.9' },
      { path: '/faq', changefreq: 'weekly', priority: '0.7' },
      { path: '/contact', changefreq: 'weekly', priority: '0.7' },
      { path: '/materials', changefreq: 'weekly', priority: '0.8' },
      { path: '/services/new-home-design', changefreq: 'weekly', priority: '0.8' },
      { path: '/services/soft-decoration', changefreq: 'weekly', priority: '0.8' },
      { path: '/services/house-exterior', changefreq: 'weekly', priority: '0.8' },
      { path: '/for-companies', changefreq: 'weekly', priority: '0.8' },
      { path: '/for-homeowners', changefreq: 'weekly', priority: '0.8' },
      { path: '/blog', changefreq: 'daily', priority: '0.8' },
      { path: '/privacy', changefreq: 'monthly', priority: '0.4' },
    ];
    for (const page of staticPages) {
      xml += `  <url><loc>${baseUrl}${page.path}</loc><changefreq>${page.changefreq}</changefreq><priority>${page.priority}</priority><lastmod>${today}</lastmod></url>\n`;
    }

    // Company pages — use /@slug (canonical) so sitemap matches canonical URL
    const allCompanies = [...(uaeCompanies as any[]), ...(profiles as any[])];
    for (const company of allCompanies) {
      if (company.slug) {
        const lastmod = company.updated_at ? new Date(company.updated_at).toISOString().slice(0, 10) : today;
        xml += `  <url><loc>${baseUrl}/@${company.slug}</loc><changefreq>weekly</changefreq><priority>0.8</priority><lastmod>${lastmod}</lastmod></url>\n`;
      }
    }

    // Supplier detail pages
    const [supplierRows] = await pool.execute(
      "SELECT slug, updated_at FROM supplier_profiles WHERE status = 'approved' AND slug IS NOT NULL ORDER BY updated_at DESC"
    );
    for (const sup of supplierRows as any[]) {
      if (sup.slug) {
        const lastmod = sup.updated_at ? new Date(sup.updated_at).toISOString().slice(0, 10) : today;
        xml += `  <url><loc>${baseUrl}/materials/suppliers/${sup.slug}</loc><changefreq>weekly</changefreq><priority>0.7</priority><lastmod>${lastmod}</lastmod></url>\n`;
      }
    }

    // Article pages
    const [articleRows] = await pool.execute(
      "SELECT slug, updated_at FROM articles WHERE status = 'published' AND slug IS NOT NULL ORDER BY created_at DESC"
    );
    for (const article of articleRows as any[]) {
      if (article.slug) {
        const lastmod = article.updated_at ? new Date(article.updated_at).toISOString().slice(0, 10) : today;
        xml += `  <url><loc>${baseUrl}/blog/${article.slug}</loc><changefreq>monthly</changefreq><priority>0.7</priority><lastmod>${lastmod}</lastmod></url>\n`;
      }
    }

    // Project pages — critical for search engine discovery
    const [projects] = await pool.execute(
      `SELECT p.slug AS project_slug, p.updated_at,
              cp.slug AS company_slug
       FROM projects p
       LEFT JOIN company_profiles cp ON p.company_profile_id = cp.id
       WHERE p.status = 'published' AND p.slug IS NOT NULL AND p.deleted_at IS NULL
       ORDER BY p.updated_at DESC`
    );
    for (const proj of projects as any[]) {
      if (proj.project_slug && proj.company_slug) {
        const lastmod = proj.updated_at ? new Date(proj.updated_at).toISOString().slice(0, 10) : today;
        xml += `  <url><loc>${baseUrl}/companies/${proj.company_slug}/${proj.project_slug}</loc><changefreq>monthly</changefreq><priority>0.7</priority><lastmod>${lastmod}</lastmod></url>\n`;
      }
    }

    xml += '</urlset>';

    res.set('Content-Type', 'application/xml');
    res.set('Cache-Control', 'public, max-age=3600');
    res.send(xml);
  } catch (error) {
    console.error('Sitemap error:', error);
    res.status(500).send('Error generating sitemap');
  }
});

// Robots.txt endpoint
app.get('/api/robots.txt', (req, res) => {
  res.set('Content-Type', 'text/plain');
  res.send([
    'User-agent: Googlebot',
    'Allow: /',
    'Disallow: /api/',
    'Disallow: /admin/',
    'Disallow: /dashboard/',
    'Disallow: /supplier/',
    'Disallow: /auth',
    'Disallow: /auth/',
    'Disallow: /verify-email',
    'Disallow: /reset-password',
    'Disallow: /forgot-password',
    'Disallow: /products/',
    'Disallow: /blogs/',
    'Disallow: /account/',
    'Disallow: /pages/',
    'Disallow: /collections/',
    'Crawl-delay: 2',
    '',
    'User-agent: Bingbot',
    'Allow: /',
    'Crawl-delay: 5',
    '',
    '# AI search engine crawlers',
    'User-agent: GPTBot',
    'Allow: /companies/',
    'Allow: /portfolio',
    'Allow: /services/',
    'Allow: /faq',
    'Disallow: /api/',
    'Disallow: /admin/',
    '',
    'User-agent: ChatGPT-User',
    'Allow: /',
    'Disallow: /api/',
    'Disallow: /admin/',
    '',
    'User-agent: PerplexityBot',
    'Allow: /',
    'Disallow: /api/',
    'Disallow: /admin/',
    '',
    'User-agent: ClaudeBot',
    'Allow: /',
    'Disallow: /api/',
    'Disallow: /admin/',
    '',
    'User-agent: Applebot',
    'Allow: /',
    'Disallow: /api/',
    'Disallow: /admin/',
    '',
    'User-agent: *',
    'Allow: /',
    'Disallow: /api/',
    'Disallow: /admin/',
    'Crawl-delay: 10',
    '',
    '# Ignore query parameters (prevent duplicate content)',
    'Disallow: /*?from=',
    'Disallow: /*?img=',
    'Disallow: /*?preview=',
    'Disallow: /*?tab=',
    '',
    'Sitemap: https://www.tarmeer.com/api/sitemap.xml',
    '',
  ].join('\n'));
});

import path from 'path';
import fs from 'fs';

const PRIMARY_UPLOADS_DIR = path.join(__dirname, '..', 'public', 'uploads');
const SHARED_UPLOADS_DIR = '/tarmeer/tarmeer_web_crm/server/uploads';

// Uploaded images are UUID-named and never rewritten → safe to cache for a
// year with the `immutable` directive so browsers skip revalidation entirely.
const UPLOADS_STATIC_OPTS = { maxAge: '365d', immutable: true } as const;

// Keep primary uploads first, then fallback to shared CRM uploads path.
app.use('/uploads', express.static(PRIMARY_UPLOADS_DIR, UPLOADS_STATIC_OPTS));
app.use('/api/uploads', express.static(PRIMARY_UPLOADS_DIR, UPLOADS_STATIC_OPTS));
if (fs.existsSync(SHARED_UPLOADS_DIR)) {
  app.use('/uploads', express.static(SHARED_UPLOADS_DIR, UPLOADS_STATIC_OPTS));
  app.use('/api/uploads', express.static(SHARED_UPLOADS_DIR, UPLOADS_STATIC_OPTS));
}

// Legacy URL cleanup: return 410 Gone for old Shopify/ecommerce paths
// so Google removes them from index faster than 404.
const LEGACY_PATH_PATTERNS = [
  /^\/blogs\//,           // /blogs/xxx (old Shopify)
  /^\/products\//,        // /products/xxx
  /^\/collections\b/,    // /collections/
  /^\/pages\//,           // /pages/xxx
  /^\/promotions\b/,     // /promotions
  /^\/account\//,         // /account/xxx
  /^\/beacon\//,          // /beacon/sa
  /^\/thank_you\b/,      // /thank_you
  /^\/api\/customers\b/,  // /api/customers/sign_in, password_reset
  /^\/api\/product-customizer\b/, // /api/product-customizer/checkout/order/create
  /\$\{/,                 // any ${variable} template strings in URL
];

app.use((req, res, next) => {
  if (LEGACY_PATH_PATTERNS.some(p => p.test(req.path))) {
    res.status(410).set('X-Robots-Tag', 'noindex').send('Gone');
    return;
  }
  next();
});

import { antiScraping } from './middleware/antiScraping';
import { getPublicServiceCategories, getPublicSupplierCategories } from './controllers/enumAdminController';
import { submitFeedback } from './controllers/feedbackController';

// Anti-scraping protection on public data endpoints
app.use('/api/designers', antiScraping);
app.use('/api/projects', antiScraping);
app.use('/api/public/companies', antiScraping);

app.use('/api/auth', authRoutes);
app.use('/api/designers', designerRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/contact', contactRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/stats', statsRoutes);
app.use('/api/companies', companyRoutes);
app.use('/api/public/companies', publicCompaniesRouter);
app.use('/api/company-applications', companyApplicationRoutes);
app.use('/api/inquiries', inquiryRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/complaints', complaintRoutes);
app.use('/api/company-leads', companyLeadRoutes);
app.use('/api/articles', articleRoutes);
app.use('/api/supplier/auth', supplierAuthRoutes);
app.use('/api/suppliers', supplierRoutes);
app.use('/api/field', fieldRoutes);
app.use('/api/site', siteRoutes);
app.use('/api/integration', integrationRoutes);
app.get('/api/sso/consume', ssoConsume);
app.get('/api/public/service-categories', getPublicServiceCategories);
app.get('/api/public/supplier-categories', getPublicSupplierCategories);
app.post('/api/feedback', submitFeedback);
app.post('/api/track', trackEvent);
// SEO: serve index.html with injected meta for search engine bots
import { getPageMeta, injectMeta } from './lib/seoMetaInjector';

const INDEX_HTML_PATH = '/tarmeer/tarmeer_web_portal/index.html';
let indexHtmlCache: string | null = null;

function getIndexHtml(): string {
  if (!indexHtmlCache) {
    try {
      indexHtmlCache = fs.readFileSync(INDEX_HTML_PATH, 'utf-8');
    } catch {
      // Fallback for dev
      const devPath = path.join(__dirname, '../../dist/index.html');
      try { indexHtmlCache = fs.readFileSync(devPath, 'utf-8'); } catch { return ''; }
    }
  }
  return indexHtmlCache;
}

// Clear cache on deploy (file change)
if (fs.existsSync(INDEX_HTML_PATH)) {
  fs.watchFile(INDEX_HTML_PATH, { interval: 5000 }, () => { indexHtmlCache = null; });
}

// Paths that REQUIRE a DB record to exist. If the slug isn't in the DB,
// return HTTP 404 instead of 200 + SPA shell — fixes Google Search Console
// "soft 404" reports (was 164 pages, all /companies/non-existent-slug).
function isSlugPage(pathname: string): boolean {
  return /^\/companies\/[a-z0-9-]+\/?$/.test(pathname)
      || /^\/companies\/[a-z0-9-]+\/[a-z0-9-]+\/?$/.test(pathname)
      || /^\/materials\/suppliers\/[a-z0-9-]+\/?$/.test(pathname);
}

app.get('/api/seo-render', async (req, res) => {
  // Normalize: strip trailing slash, default to "/"
  const rawPath = typeof req.query.path === 'string' ? req.query.path : '/';
  const pathname = rawPath.replace(/\/+$/, '') || '/';
  const html = getIndexHtml();
  if (!html) return res.status(500).send('index.html not found');

  try {
    const meta = await getPageMeta(pathname);
    if (meta) {
      res.set('Content-Type', 'text/html; charset=utf-8');
      res.set('Cache-Control', 'public, max-age=3600');
      return res.send(injectMeta(html, meta));
    }

    // No meta found AND it's a slug page → DB had no match → real 404
    if (isSlugPage(pathname)) {
      res.set('Content-Type', 'text/html; charset=utf-8');
      res.set('X-Robots-Tag', 'noindex');
      res.set('Cache-Control', 'no-cache');
      return res.status(404).send(injectMeta(html, {
        title: 'Not Found | Tarmeer',
        description: 'The page you are looking for does not exist or has been removed.',
        canonical: 'https://www.tarmeer.com/',
        ogImage: 'https://www.tarmeer.com/images/og-default.jpg',
      }));
    }
  } catch (err) {
    console.error('[SEO] Meta injection error:', err);
  }

  // Non-slug page (or error path) → return original HTML with 200
  res.set('Content-Type', 'text/html; charset=utf-8');
  res.send(html);
});

app.use((err: any, req: any, res: any, next: any) => {
  console.error('Error:', err);

  if (isPayloadTooLargeError(err)) {
    res.status(413).json({ error: PAYLOAD_TOO_LARGE_MESSAGE });
    return;
  }
  
  if (config.nodeEnv === 'production') {
    res.status(500).json({ error: 'Internal server error' });
  } else {
    res.status(500).json({
      error: err.message || 'Internal server error',
    });
  }
});

app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Schedule weight calculation at 01:00 UTC (09:00 China time) daily
function scheduleWeightCalculation() {
  function getNextRun(): number {
    const now = new Date();
    const next = new Date(now);
    next.setUTCHours(1, 0, 0, 0);
    if (next <= now) next.setDate(next.getDate() + 1);
    return next.getTime() - now.getTime();
  }

  function run() {
    calculateAllWeights().catch(err => console.error('[Weight] Calculation error:', err));
    setTimeout(run, 24 * 60 * 60 * 1000);
  }

  // Run once on startup
  calculateAllWeights().catch(err => console.error('[Weight] Initial calculation error:', err));
  // Schedule next run
  setTimeout(run, getNextRun());
}

app.listen(PORT, async () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📍 Environment: ${config.nodeEnv}`);
  console.log(`🔒 Security: Helmet enabled, Rate limiting active`);

  // Ensure nginx can traverse the app root directory.
  // tar extraction during deploy resets this dir to 700 (macOS mktemp default),
  // blocking nginx from serving /uploads/ files (403 Forbidden).
  // __dirname = /tarmeer/tarmeer_api/dist → resolve('..')  = /tarmeer/tarmeer_api
  try {
    fs.chmodSync(path.resolve(__dirname, '..'), 0o701);
  } catch { /* non-fatal */ }

  // 启动后自动检查并补齐数据库结构
  await runAutoMigrate();

  // Weight calculation scheduler
  scheduleWeightCalculation();
});

export default app;
