"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAnalyticsOverview = getAnalyticsOverview;
exports.getCompanyVisitors = getCompanyVisitors;
exports.listAnalyticsEvents = listAnalyticsEvents;
exports.getDailyRegistrations = getDailyRegistrations;
exports.getDailyVisits = getDailyVisits;
exports.getTodayNew = getTodayNew;
const database_1 = __importDefault(require("../config/database"));
const detectCountry_1 = require("../lib/detectCountry");
const analyticsEventStore_1 = require("../lib/analyticsEventStore");
const visitorLogStore_1 = require("../lib/visitorLogStore");
function toDateString(input) {
    if (typeof input !== 'string')
        return '';
    const value = input.trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value))
        return '';
    return value;
}
async function getAnalyticsOverview(req, res) {
    const end = toDateString(req.query.endDate) || new Date().toISOString().slice(0, 10);
    const start = toDateString(req.query.startDate) || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    try {
        await (0, analyticsEventStore_1.ensureAnalyticsEventsTable)();
        const [overviewRows] = await database_1.default.execute(`SELECT
        COUNT(*) AS total_events,
        COUNT(DISTINCT CASE
          WHEN viewer_ip IS NOT NULL
           AND viewer_ip <> ''
           AND viewer_ip <> 'unknown'
           AND viewer_ip <> '127.0.0.1'
           AND viewer_ip <> '::1'
           AND viewer_ip <> '::ffff:127.0.0.1'
          THEN viewer_ip
        END) AS unique_visitors,
        SUM(CASE WHEN event_name = 'page_view' THEN 1 ELSE 0 END) AS page_views,
        SUM(CASE WHEN event_name = 'apply_click' THEN 1 ELSE 0 END) AS apply_clicks,
        SUM(CASE WHEN event_name = 'click_whatsapp' THEN 1 ELSE 0 END) AS whatsapp_clicks,
        SUM(CASE WHEN event_name = 'submit_contact_form' THEN 1 ELSE 0 END) AS contact_submits
       FROM analytics_events
       WHERE DATE(created_at) BETWEEN ? AND ?`, [start, end]);
        const [topPagesRows] = await database_1.default.execute(`SELECT
        page_path,
        COUNT(*) AS page_views,
        COUNT(DISTINCT CASE
          WHEN viewer_ip IS NOT NULL
           AND viewer_ip <> ''
           AND viewer_ip <> 'unknown'
           AND viewer_ip <> '127.0.0.1'
           AND viewer_ip <> '::1'
           AND viewer_ip <> '::ffff:127.0.0.1'
          THEN viewer_ip
        END) AS visitors
       FROM analytics_events
       WHERE DATE(created_at) BETWEEN ? AND ?
         AND event_name = 'page_view'
         AND page_path IS NOT NULL
         AND page_path <> ''
       GROUP BY page_path
       ORDER BY visitors DESC, page_views DESC
       LIMIT 10`, [start, end]);
        const raw = overviewRows[0] || {};
        res.json({
            overview: {
                total_events: Number(raw.total_events ?? 0),
                unique_visitors: Number(raw.unique_visitors ?? 0),
                page_views: Number(raw.page_views ?? 0),
                apply_clicks: Number(raw.apply_clicks ?? 0),
                whatsapp_clicks: Number(raw.whatsapp_clicks ?? 0),
                contact_submits: Number(raw.contact_submits ?? 0),
            },
            topPages: topPagesRows,
            dateRange: { start, end },
        });
    }
    catch (error) {
        console.error('Error getting analytics overview:', error);
        res.status(500).json({ error: 'Failed to get analytics overview.' });
    }
}
async function getCompanyVisitors(req, res) {
    const end = toDateString(req.query.endDate) || new Date().toISOString().slice(0, 10);
    const start = toDateString(req.query.startDate) || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const country = typeof req.query.country === 'string' ? req.query.country.trim() : '';
    const VALID_COUNTRIES = new Set(['ae', 'vn', 'sa']);
    let countryPathFilter = '';
    if (country && VALID_COUNTRIES.has(country)) {
        if (country === 'vn') {
            countryPathFilter = "\n         AND page_path LIKE '/companies/vn-%'";
        }
        else if (country === 'ae') {
            countryPathFilter = "\n         AND page_path NOT LIKE '/companies/vn-%'";
        }
    }
    try {
        await (0, analyticsEventStore_1.ensureAnalyticsEventsTable)();
        // Top 10 companies by unique visitors
        const [companyRows] = await database_1.default.execute(`SELECT
        page_path,
        COUNT(DISTINCT CASE
          WHEN viewer_ip IS NOT NULL
           AND viewer_ip <> ''
           AND viewer_ip <> 'unknown'
           AND viewer_ip <> '127.0.0.1'
           AND viewer_ip <> '::1'
           AND viewer_ip <> '::ffff:127.0.0.1'
          THEN viewer_ip
        END) AS unique_visitors,
        COUNT(*) AS total_views
       FROM analytics_events
       WHERE DATE(created_at) BETWEEN ? AND ?
         AND event_name = 'page_view'
         AND page_path LIKE '/companies/%'${countryPathFilter}
       GROUP BY page_path
       ORDER BY unique_visitors DESC, total_views DESC
       LIMIT 10`, [start, end]);
        const rawCompanies = companyRows;
        // Resolve company names from slugs/IDs
        const companies = [];
        for (const c of rawCompanies) {
            // Extract slug from path: /companies/antonovich-design or /companies/15
            const slug = c.page_path.replace('/companies/', '').split('?')[0].trim();
            if (!slug || slug === 'Preview' || slug.includes('admin_preview'))
                continue;
            let companyName = slug;
            // Try uae_companies first (slug-based)
            const [uaeRows] = await database_1.default.execute('SELECT name_en FROM uae_companies WHERE slug = ? OR id = ? LIMIT 1', [slug, isNaN(Number(slug)) ? 0 : Number(slug)]);
            if (uaeRows.length > 0) {
                companyName = uaeRows[0].name_en;
            }
            else {
                // Try company_profiles (ID-based)
                const [cpRows] = await database_1.default.execute('SELECT company_name FROM company_profiles WHERE id = ? LIMIT 1', [isNaN(Number(slug)) ? 0 : Number(slug)]);
                if (cpRows.length > 0) {
                    companyName = cpRows[0].company_name;
                }
            }
            companies.push({
                page_path: c.page_path,
                company_name: companyName,
                slug,
                unique_visitors: Number(c.unique_visitors),
                total_views: Number(c.total_views),
            });
        }
        const pagePaths = companies.map(c => c.page_path);
        let cityBreakdown = [];
        if (pagePaths.length > 0) {
            const placeholders = pagePaths.map(() => '?').join(',');
            const [cityRows] = await database_1.default.execute(`SELECT
          page_path,
          COALESCE(location_label, 'Unknown') AS city,
          COUNT(DISTINCT CASE
            WHEN viewer_ip IS NOT NULL
             AND viewer_ip <> ''
             AND viewer_ip <> 'unknown'
             AND viewer_ip <> '127.0.0.1'
             AND viewer_ip <> '::1'
             AND viewer_ip <> '::ffff:127.0.0.1'
            THEN viewer_ip
          END) AS visitors
         FROM analytics_events
         WHERE DATE(created_at) BETWEEN ? AND ?
           AND event_name = 'page_view'
           AND page_path IN (${placeholders})
         GROUP BY page_path, location_label
         ORDER BY visitors DESC`, [start, end, ...pagePaths]);
            cityBreakdown = cityRows;
        }
        // Group city breakdown by page_path
        const cityMap = {};
        for (const row of cityBreakdown) {
            if (!cityMap[row.page_path])
                cityMap[row.page_path] = [];
            cityMap[row.page_path].push({ city: row.city, visitors: Number(row.visitors) });
        }
        // Deduplicate by company_name — same company can appear under both slug URL
        // (/companies/rana-matloob-design-studio) and registered ID URL (/companies/15)
        // when a directory listing has been claimed. Merge their visitor counts.
        const mergedMap = {};
        for (const c of companies) {
            const key = c.company_name.toLowerCase().trim();
            const cities = cityMap[c.page_path] || [];
            if (!mergedMap[key]) {
                mergedMap[key] = {
                    page_path: c.page_path,
                    company_name: c.company_name,
                    slug: c.slug,
                    unique_visitors: c.unique_visitors,
                    total_views: c.total_views,
                    cities,
                };
            }
            else {
                // Merge: add visitors, merge city lists
                mergedMap[key].unique_visitors += c.unique_visitors;
                mergedMap[key].total_views += c.total_views;
                // Combine city lists, summing same-city visitors
                const cityMerge = {};
                for (const cv of [...mergedMap[key].cities, ...cities]) {
                    cityMerge[cv.city] = (cityMerge[cv.city] || 0) + cv.visitors;
                }
                mergedMap[key].cities = Object.entries(cityMerge)
                    .map(([city, visitors]) => ({ city, visitors }))
                    .sort((a, b) => b.visitors - a.visitors);
            }
        }
        const result = Object.values(mergedMap)
            .sort((a, b) => b.unique_visitors - a.unique_visitors)
            .slice(0, 10)
            .map(c => ({ ...c, cities: c.cities.slice(0, 5) }));
        res.json({ companies: result, dateRange: { start, end } });
    }
    catch (error) {
        console.error('Error getting company visitors:', error);
        res.status(500).json({ error: 'Failed to get company visitor stats.' });
    }
}
async function listAnalyticsEvents(req, res) {
    const page = Math.max(1, parseInt(String(req.query.page || '1'), 10) || 1);
    const limit = Math.min(200, Math.max(1, parseInt(String(req.query.limit || '50'), 10) || 50));
    const offset = (page - 1) * limit;
    const eventName = typeof req.query.eventName === 'string' ? req.query.eventName.trim() : '';
    const pagePath = typeof req.query.pagePath === 'string' ? req.query.pagePath.trim() : '';
    const conditions = [];
    const params = [];
    if (eventName) {
        conditions.push('event_name = ?');
        params.push(eventName);
    }
    if (pagePath) {
        conditions.push('page_path LIKE ?');
        params.push(`%${pagePath}%`);
    }
    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    try {
        await (0, analyticsEventStore_1.ensureAnalyticsEventsTable)();
        const [rows] = await database_1.default.execute(`SELECT
        id,
        event_name,
        page_path,
        viewer_ip,
        location_label,
        referrer,
        user_agent,
        payload,
        created_at
       FROM analytics_events
       ${whereClause}
       ORDER BY created_at DESC
       LIMIT ${limit} OFFSET ${offset}`, params);
        const [countRows] = await database_1.default.execute(`SELECT COUNT(*) AS total
       FROM analytics_events
       ${whereClause}`, params);
        const total = Number(countRows[0]?.total || 0);
        res.json({
            events: rows,
            pagination: {
                page,
                limit,
                total,
                pages: Math.ceil(total / limit),
            },
        });
    }
    catch (error) {
        console.error('Error listing analytics events:', error);
        res.status(500).json({ error: 'Failed to list analytics events.' });
    }
}
async function getDailyRegistrations(req, res) {
    const end = toDateString(req.query.endDate) || new Date().toISOString().slice(0, 10);
    const start = toDateString(req.query.startDate) || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    try {
        const [rows] = await database_1.default.execute(`SELECT DATE(created_at) AS stat_date,
              SUM(CASE WHEN role = 'homeowner' THEN 1 ELSE 0 END) AS homeowner_count,
              SUM(CASE WHEN role = 'company' THEN 1 ELSE 0 END) AS company_count
         FROM users
        WHERE DATE(created_at) BETWEEN ? AND ?
        GROUP BY DATE(created_at)
        ORDER BY stat_date ASC`, [start, end]);
        res.json({ dailyRegistrations: rows, dateRange: { start, end } });
    }
    catch (error) {
        console.error('Error getting daily registrations:', error);
        res.status(500).json({ error: 'Failed to load registration stats.' });
    }
}
async function getDailyVisits(req, res) {
    const end = toDateString(req.query.endDate) || new Date().toISOString().slice(0, 10);
    const start = toDateString(req.query.startDate) || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    // 与总访问量 KPI 同源：visitor_logs（服务端访问日志，更全不漏埋点），而非 analytics_events 客户端埋点（基本为空）
    const country = typeof req.query.country === 'string' ? req.query.country.trim() : '';
    const VALID_COUNTRIES = new Set(['ae', 'vn', 'sa']);
    let countryWhere = '';
    if (country && VALID_COUNTRIES.has(country)) {
        if (country === 'vn') {
            countryWhere = " AND page_path LIKE '/companies/vn-%'";
        }
        else if (country === 'ae') {
            countryWhere = " AND (page_path IS NULL OR page_path NOT LIKE '/companies/vn-%')";
        }
    }
    try {
        await (0, visitorLogStore_1.ensureVisitorLogsTable)();
        const [rows] = await database_1.default.execute(`SELECT DATE(created_at) AS stat_date,
              COUNT(*) AS page_views,
              COUNT(DISTINCT CASE
                WHEN viewer_ip IS NOT NULL
                 AND viewer_ip <> ''
                 AND viewer_ip <> 'unknown'
                 AND viewer_ip <> '127.0.0.1'
                 AND viewer_ip <> '::1'
                 AND viewer_ip <> '::ffff:127.0.0.1'
                THEN viewer_ip
              END) AS unique_visitors
         FROM visitor_logs
        WHERE DATE(created_at) BETWEEN ? AND ?${countryWhere}
        GROUP BY DATE(created_at)
        ORDER BY stat_date ASC`, [start, end]);
        res.json({ dailyVisits: rows, dateRange: { start, end } });
    }
    catch (error) {
        console.error('Error getting daily visits:', error);
        res.status(500).json({ error: 'Failed to get daily visits.' });
    }
}
async function getTodayNew(req, res) {
    try {
        const country = req.query.country;
        const VALID_COUNTRIES = new Set(['ae', 'vn', 'sa']);
        let homeownerSql = "SELECT COUNT(*) AS n FROM users WHERE DATE(created_at) = CURDATE() AND role = 'homeowner'";
        const homeownerParams = [];
        let companySql = 'SELECT COUNT(*) AS n FROM company_profiles WHERE DATE(created_at) = CURDATE()';
        const companyParams = [];
        if (country && VALID_COUNTRIES.has(country)) {
            const f = detectCountry_1.phoneCountryWhere(country, 'phone');
            homeownerSql += f.sql;
            homeownerParams.push(...f.params);
            companySql += " AND country = ?";
            companyParams.push(country);
        }
        const [[homeowners], [companies], [suppliers]] = await Promise.all([
            database_1.default.execute(homeownerSql, homeownerParams),
            database_1.default.execute(companySql, companyParams),
            database_1.default.execute('SELECT COUNT(*) AS n FROM supplier_profiles WHERE DATE(created_at) = CURDATE()'),
        ]);
        // 供应商当日计数也按 can_view_suppliers 门控(无权限子管理员不暴露供应商任何信息,与列表/搜索一致)
        const canSuppliers = req.admin?.role === 'super_admin' || req.admin?.permissions?.can_view_suppliers === true;
        res.json({
            homeowners: Number(homeowners[0]?.n ?? 0),
            companies: Number(companies[0]?.n ?? 0),
            suppliers: canSuppliers ? Number(suppliers[0]?.n ?? 0) : 0,
        });
    }
    catch (error) {
        console.error('Today new stats error:', error);
        res.status(500).json({ error: 'Failed to get stats.' });
    }
}
