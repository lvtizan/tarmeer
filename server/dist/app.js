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
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const express_session_1 = __importDefault(require("express-session"));
const dotenv_1 = __importDefault(require("dotenv"));
const auth_1 = __importDefault(require("./routes/auth"));
const designers_1 = __importDefault(require("./routes/designers"));
const projects_1 = __importDefault(require("./routes/projects"));
const contact_1 = __importDefault(require("./routes/contact"));
const admin_1 = __importDefault(require("./routes/admin"));
const stats_1 = __importDefault(require("./routes/stats"));
const companies_1 = __importDefault(require("./routes/companies"));
const publicCompanies_1 = __importDefault(require("./routes/publicCompanies"));
const companyApplications_1 = __importDefault(require("./routes/companyApplications"));
const inquiries_1 = __importDefault(require("./routes/inquiries"));
const notifications_1 = __importDefault(require("./routes/notifications"));
const complaints_1 = __importDefault(require("./routes/complaints"));
const phoneReveals_1 = __importDefault(require("./routes/phoneReveals"));
const experts_1 = __importDefault(require("./routes/experts"));
const companyLeads_1 = __importDefault(require("./routes/companyLeads"));
const articles_1 = __importDefault(require("./routes/articles"));
const supplierAuth_1 = __importDefault(require("./routes/supplierAuth"));
const suppliers_1 = __importDefault(require("./routes/suppliers"));
const field_1 = __importDefault(require("./routes/field"));
const site_1 = __importDefault(require("./routes/site"));
const integration_1 = __importDefault(require("./routes/integration"));
const partnerSync_1 = __importDefault(require("./routes/partnerSync"));
const integrationController_1 = require("./controllers/integrationController");
const activityLogController_1 = require("./controllers/activityLogController");
const config_1 = __importDefault(require("./config"));
const requestLimits_1 = require("./lib/requestLimits");
const corsOrigins_1 = require("./lib/corsOrigins");
const rateLimitPolicy_1 = require("./lib/rateLimitPolicy");
const jwtManager_1 = require("./lib/jwtManager");
const autoMigrate_1 = require("./lib/autoMigrate");
const weightCalculator_1 = require("./lib/weightCalculator");
const passport_1 = __importDefault(require("./middleware/passport"));
dotenv_1.default.config();
// 验证JWT配置
(0, jwtManager_1.validateJWTConfig)();
const app = (0, express_1.default)();
const PORT = config_1.default.port;
app.set('trust proxy', 1);
app.use((0, helmet_1.default)({
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
const limiter = (0, express_rate_limit_1.default)({
    windowMs: 15 * 60 * 1000,
    max: 1000,
    message: 'Too many requests from this IP, please try again later.',
    skip: (req) => (0, rateLimitPolicy_1.shouldSkipApiRateLimit)({
        nodeEnv: config_1.default.nodeEnv,
        method: req.method,
        path: req.path,
        ip: req.ip,
    }),
});
app.use('/api/', limiter);
// 公共只读 API 独立限速：每 IP 每分钟最多 120 次（防爬虫/扫描）
const publicReadLimiter = (0, express_rate_limit_1.default)({
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
const corsConfig = (0, corsOrigins_1.getCorsConfig)(config_1.default.frontendUrl);
app.use((0, cors_1.default)(corsConfig));
// Session（Passport OAuth 需要）
app.use((0, express_session_1.default)({
    secret: config_1.default.jwt.secret,
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: config_1.default.nodeEnv === 'production',
        maxAge: 10 * 60 * 1000, // 10 分钟，仅用于 OAuth 流程
    },
}));
// Passport 初始化
app.use(passport_1.default.initialize());
app.use(passport_1.default.session());
// 添加CORS违规日志记录
app.use((req, res, next) => {
    const origin = req.headers.origin;
    if (origin && !corsConfig.origin.includes(origin)) {
        (0, corsOrigins_1.logCorsViolation)(origin, req.path);
    }
    next();
});
// Country context middleware — 统一解析国家（header X-Country 优先 → ?country= → 默认 ae）。
// 单一来源见 lib/country.js；App 无子域名走 header，admin 走 query，全部归一到 req.country。
const country_1 = require("./lib/country");
app.use((req, _res, next) => {
    req.country = (0, country_1.resolveCountry)(req);
    next();
});
app.use(express_1.default.json({
    limit: requestLimits_1.UPLOAD_REQUEST_BODY_LIMIT,
    verify: (req, _res, buf) => { req.rawBody = buf.toString('utf8'); },
}));
app.use(express_1.default.urlencoded({ extended: true, limit: requestLimits_1.UPLOAD_REQUEST_BODY_LIMIT }));
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
            health: 'GET /api/health',
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
        environment: config_1.default.nodeEnv
    });
});
// IndexNow key file verification — must be at /{key}.txt per protocol spec
app.get('/:key([a-fA-F0-9]{32,64}).txt', (req, res, next) => {
    const key = req.params.key;
    if (process.env.INDEXNOW_KEY && key === process.env.INDEXNOW_KEY) {
        return res.type('text/plain').send(process.env.INDEXNOW_KEY);
    }
    next();
});
// Dynamic sitemap endpoint
app.get('/api/sitemap.xml', async (req, res) => {
    try {
        const pool = (await Promise.resolve().then(() => __importStar(require('./config/database')))).default;
        // Get all directory companies
        const [uaeCompanies] = await pool.execute('SELECT slug, updated_at FROM uae_companies WHERE slug IS NOT NULL ORDER BY weight_score DESC');
        // Get all approved registered companies
        const [profiles] = await pool.execute('SELECT slug, updated_at FROM company_profiles WHERE status = ? AND slug IS NOT NULL AND deleted_at IS NULL ORDER BY weight_score DESC', ['approved']);
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
        // Company pages use their public detail canonical URLs.
        const allCompanies = [...uaeCompanies, ...profiles];
        for (const company of allCompanies) {
            if (company.slug) {
                const lastmod = company.updated_at ? new Date(company.updated_at).toISOString().slice(0, 10) : today;
                xml += `  <url><loc>${baseUrl}/companies/${company.slug}</loc><changefreq>weekly</changefreq><priority>0.8</priority><lastmod>${lastmod}</lastmod></url>\n`;
            }
        }
        // Supplier detail pages
        const [supplierRows] = await pool.execute("SELECT slug, updated_at FROM supplier_profiles WHERE status = 'approved' AND slug IS NOT NULL ORDER BY updated_at DESC");
        for (const sup of supplierRows) {
            if (sup.slug) {
                const lastmod = sup.updated_at ? new Date(sup.updated_at).toISOString().slice(0, 10) : today;
                xml += `  <url><loc>${baseUrl}/materials/suppliers/${sup.slug}</loc><changefreq>weekly</changefreq><priority>0.7</priority><lastmod>${lastmod}</lastmod></url>\n`;
            }
        }
        // Article pages
        const [articleRows] = await pool.execute("SELECT slug, updated_at FROM articles WHERE status = 'published' AND slug IS NOT NULL ORDER BY created_at DESC");
        for (const article of articleRows) {
            if (article.slug) {
                const lastmod = article.updated_at ? new Date(article.updated_at).toISOString().slice(0, 10) : today;
                xml += `  <url><loc>${baseUrl}/blog/${article.slug}</loc><changefreq>monthly</changefreq><priority>0.7</priority><lastmod>${lastmod}</lastmod></url>\n`;
            }
        }
        // Project pages — critical for search engine discovery
        const [projects] = await pool.execute(`SELECT p.slug AS project_slug, p.updated_at,
              cp.slug AS company_slug
       FROM projects p
       LEFT JOIN company_profiles cp ON p.company_profile_id = cp.id
       WHERE p.status = 'published' AND p.slug IS NOT NULL AND p.deleted_at IS NULL
       ORDER BY p.updated_at DESC`);
        for (const proj of projects) {
            if (proj.project_slug && proj.company_slug) {
                const lastmod = proj.updated_at ? new Date(proj.updated_at).toISOString().slice(0, 10) : today;
                xml += `  <url><loc>${baseUrl}/companies/${proj.company_slug}/${proj.project_slug}</loc><changefreq>monthly</changefreq><priority>0.7</priority><lastmod>${lastmod}</lastmod></url>\n`;
            }
        }
        xml += '</urlset>';
        res.set('Content-Type', 'application/xml');
        res.set('Cache-Control', 'public, max-age=3600');
        res.send(xml);
    }
    catch (error) {
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
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const PRIMARY_UPLOADS_DIR = path_1.default.join(__dirname, '..', 'public', 'uploads');
const SHARED_UPLOADS_DIR = '/tarmeer/tarmeer_web_crm/server/uploads';
// Uploaded images are UUID-named and never rewritten → safe to cache for a
// year with the `immutable` directive so browsers skip revalidation entirely.
const UPLOADS_STATIC_OPTS = { maxAge: '365d', immutable: true };
// Keep primary uploads first, then fallback to shared CRM uploads path.
app.use('/uploads', express_1.default.static(PRIMARY_UPLOADS_DIR, UPLOADS_STATIC_OPTS));
app.use('/api/uploads', express_1.default.static(PRIMARY_UPLOADS_DIR, UPLOADS_STATIC_OPTS));
if (fs_1.default.existsSync(SHARED_UPLOADS_DIR)) {
    app.use('/uploads', express_1.default.static(SHARED_UPLOADS_DIR, UPLOADS_STATIC_OPTS));
    app.use('/api/uploads', express_1.default.static(SHARED_UPLOADS_DIR, UPLOADS_STATIC_OPTS));
}
// Legacy URL cleanup: return 410 Gone for old Shopify/ecommerce paths
// so Google removes them from index faster than 404.
const LEGACY_PATH_PATTERNS = [
    /^\/blogs\//, // /blogs/xxx (old Shopify)
    /^\/products\//, // /products/xxx
    /^\/collections\b/, // /collections/
    /^\/pages\//, // /pages/xxx
    /^\/promotions\b/, // /promotions
    /^\/account\//, // /account/xxx
    /^\/beacon\//, // /beacon/sa
    /^\/thank_you\b/, // /thank_you
    /^\/api\/customers\b/, // /api/customers/sign_in, password_reset
    /^\/api\/product-customizer\b/, // /api/product-customizer/checkout/order/create
    /\$\{/, // any ${variable} template strings in URL
];
app.use((req, res, next) => {
    if (LEGACY_PATH_PATTERNS.some(p => p.test(req.path))) {
        res.status(410).set('X-Robots-Tag', 'noindex').send('Gone');
        return;
    }
    next();
});
const antiScraping_1 = require("./middleware/antiScraping");
const enumAdminController_1 = require("./controllers/enumAdminController");
const feedbackController_1 = require("./controllers/feedbackController");
// Anti-scraping protection on public data endpoints
app.use('/api/designers', antiScraping_1.antiScraping);
app.use('/api/projects', antiScraping_1.antiScraping);
app.use('/api/public/companies', antiScraping_1.antiScraping);
app.use('/api/auth', auth_1.default);
app.use('/api/designers', designers_1.default);
app.use('/api/projects', projects_1.default);
app.use('/api/contact', contact_1.default);
app.use('/api/admin', admin_1.default);
app.use('/api/stats', stats_1.default);
app.use('/api/companies', companies_1.default);
app.use('/api/public/companies', publicCompanies_1.default);
app.use('/api/company-applications', companyApplications_1.default);
app.use('/api/inquiries', inquiries_1.default);
app.use('/api/notifications', notifications_1.default);
app.use('/api/complaints', complaints_1.default);
app.use('/api/phone-reveals', phoneReveals_1.default);
app.use('/api/experts', experts_1.default);
app.use('/api/company-leads', companyLeads_1.default);
app.use('/api/articles', articles_1.default);
app.use('/api/supplier/auth', supplierAuth_1.default);
app.use('/api/suppliers', suppliers_1.default);
app.use('/api/field', field_1.default);
app.use('/api/site', site_1.default);
app.use('/api/integration', integration_1.default);
app.use('/api/partner-sync', partnerSync_1.default);
app.get('/api/sso/consume', integrationController_1.ssoConsume);
app.get('/api/public/service-categories', enumAdminController_1.getPublicServiceCategories);
app.get('/api/public/supplier-categories', enumAdminController_1.getPublicSupplierCategories);
app.post('/api/feedback', feedbackController_1.submitFeedback);
app.post('/api/track', activityLogController_1.trackEvent);
// SEO: serve index.html with injected meta for search engine bots
const seoMetaInjector_1 = require("./lib/seoMetaInjector");
const INDEX_HTML_PATH = '/tarmeer/tarmeer_web_portal/index.html';
let indexHtmlCache = null;
function getIndexHtml() {
    if (!indexHtmlCache) {
        try {
            indexHtmlCache = fs_1.default.readFileSync(INDEX_HTML_PATH, 'utf-8');
        }
        catch {
            // Fallback for dev
            const devPath = path_1.default.join(__dirname, '../../dist/index.html');
            try {
                indexHtmlCache = fs_1.default.readFileSync(devPath, 'utf-8');
            }
            catch {
                return '';
            }
        }
    }
    return indexHtmlCache;
}
// Clear cache on deploy (file change)
if (fs_1.default.existsSync(INDEX_HTML_PATH)) {
    fs_1.default.watchFile(INDEX_HTML_PATH, { interval: 5000 }, () => { indexHtmlCache = null; });
}
// Paths that REQUIRE a DB record to exist. If the slug isn't in the DB,
// return HTTP 404 instead of 200 + SPA shell — fixes Google Search Console
// "soft 404" reports (was 164 pages, all /companies/non-existent-slug).
function isSlugPage(pathname) {
    return /^\/companies\/[a-z0-9-]+\/?$/.test(pathname)
        || /^\/companies\/[a-z0-9-]+\/[a-z0-9-]+\/?$/.test(pathname)
        || /^\/materials\/suppliers\/[a-z0-9-]+\/?$/.test(pathname);
}
app.get('/api/seo-render', async (req, res) => {
    // Normalize: strip trailing slash, default to "/"
    const rawPath = typeof req.query.path === 'string' ? req.query.path : '/';
    const pathname = rawPath.replace(/\/+$/, '') || '/';
    const html = getIndexHtml();
    if (!html)
        return res.status(500).send('index.html not found');
    try {
        const meta = await (0, seoMetaInjector_1.getPageMeta)(pathname, req.country);
        if (meta) {
            res.set('Content-Type', 'text/html; charset=utf-8');
            res.set('X-Robots-Tag', meta.robots || 'index,follow');
            // Company/page has been taken down — tell Google it's permanently gone
            if (meta.gone) {
                res.set('Cache-Control', 'no-cache');
                return res.status(410).send((0, seoMetaInjector_1.injectMeta)(html, meta));
            }
            res.set('Cache-Control', 'public, max-age=3600');
            return res.send((0, seoMetaInjector_1.injectMeta)(html, meta));
        }
        // No meta found AND it's a slug page → DB had no match → real 404
        if (isSlugPage(pathname)) {
            res.set('Content-Type', 'text/html; charset=utf-8');
            res.set('X-Robots-Tag', 'noindex');
            res.set('Cache-Control', 'no-cache');
            // 按国家取站点根 URL（AE: www.tarmeer.com / VN: vn.tarmeer.com）
            const notFoundBaseUrl = req.country === 'vn' ? 'https://vn.tarmeer.com' : 'https://www.tarmeer.com';
            return res.status(404).send((0, seoMetaInjector_1.injectMeta)(html, {
                title: 'Not Found | Tarmeer',
                description: 'The page you are looking for does not exist or has been removed.',
                canonical: `${notFoundBaseUrl}/`,
                ogImage: `${notFoundBaseUrl}/images/og-default.jpg`,
            }));
        }
    }
    catch (err) {
        console.error('[SEO] Meta injection error:', err);
    }
    // Non-slug page (or error path) → return original HTML with 200
    res.set('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
});
app.use((err, req, res, next) => {
    console.error('Error:', err);
    if ((0, requestLimits_1.isPayloadTooLargeError)(err)) {
        res.status(413).json({ error: requestLimits_1.PAYLOAD_TOO_LARGE_MESSAGE });
        return;
    }
    if (config_1.default.nodeEnv === 'production') {
        res.status(500).json({ error: 'Internal server error' });
    }
    else {
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
    function getNextRun() {
        const now = new Date();
        const next = new Date(now);
        next.setUTCHours(1, 0, 0, 0);
        if (next <= now)
            next.setDate(next.getDate() + 1);
        return next.getTime() - now.getTime();
    }
    function run() {
        (0, weightCalculator_1.calculateAllWeights)().catch(err => console.error('[Weight] Calculation error:', err));
        setTimeout(run, 24 * 60 * 60 * 1000);
    }
    // Run once on startup
    (0, weightCalculator_1.calculateAllWeights)().catch(err => console.error('[Weight] Initial calculation error:', err));
    // Schedule next run
    setTimeout(run, getNextRun());
}
app.listen(PORT, async () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`📍 Environment: ${config_1.default.nodeEnv}`);
    console.log(`🔒 Security: Helmet enabled, Rate limiting active`);
    // Ensure nginx can traverse the app root directory.
    // tar extraction during deploy resets this dir to 700 (macOS mktemp default),
    // blocking nginx from serving /uploads/ files (403 Forbidden).
    // __dirname = /tarmeer/tarmeer_api/dist → resolve('..')  = /tarmeer/tarmeer_api
    try {
        fs_1.default.chmodSync(path_1.default.resolve(__dirname, '..'), 0o701);
    }
    catch { /* non-fatal */ }
    // 启动后自动检查并补齐数据库结构
    await (0, autoMigrate_1.runAutoMigrate)();
    // Weight calculation scheduler
    scheduleWeightCalculation();
});
exports.default = app;
