"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getVisitorOverview = getVisitorOverview;
exports.listVisitors = listVisitors;
const database_1 = __importDefault(require("../config/database"));
const visitorLogStore_1 = require("../lib/visitorLogStore");
const ipLocation_1 = require("../lib/ipLocation");
function isTruthyIp(ip) {
    if (!ip)
        return false;
    const normalized = ip.trim().toLowerCase();
    return normalized !== 'unknown' && normalized !== '::1' && normalized !== '127.0.0.1' && normalized !== '::ffff:127.0.0.1';
}
async function getVisitorOverview(req, res) {
    try {
        await (0, visitorLogStore_1.ensureVisitorLogsTable)();
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
        // 单次扫表算累计 + 近 30 天 + unique IP，避免两个数据源（visitor_logs vs analytics_events）
        // 给同一个"访问数"指标产生不同结果（统一口径：服务端 visitor_logs，更全且不漏埋点）。
        const [rows] = await database_1.default.execute(`SELECT
        COUNT(*) AS total_visits,
        SUM(CASE WHEN created_at >= NOW() - INTERVAL 30 DAY THEN 1 ELSE 0 END) AS visits_last_30d,
        COUNT(DISTINCT CASE
          WHEN viewer_ip IS NOT NULL
           AND viewer_ip <> ''
           AND viewer_ip <> 'unknown'
           AND viewer_ip <> '127.0.0.1'
           AND viewer_ip <> '::1'
           AND viewer_ip <> '::ffff:127.0.0.1'
          THEN viewer_ip
        END) AS unique_ip_count
       FROM visitor_logs
       WHERE 1=1${countryWhere}`);
        const overview = rows[0] || {};
        res.json({
            totalVisits: Number(overview.total_visits || 0),
            visitsLast30d: Number(overview.visits_last_30d || 0),
            uniqueIpCount: Number(overview.unique_ip_count || 0),
        });
    }
    catch (error) {
        console.error('Error getting visitor overview:', error);
        res.status(500).json({ error: 'Failed to get visitor overview.' });
    }
}
async function listVisitors(req, res) {
    const page = Math.max(1, parseInt(String(req.query.page || '1'), 10) || 1);
    const limit = Math.min(200, Math.max(1, parseInt(String(req.query.limit || '50'), 10) || 50));
    const offset = (page - 1) * limit;
    try {
        await (0, visitorLogStore_1.ensureVisitorLogsTable)();
        const safeLimit = Math.min(200, Math.max(1, Number(limit) || 50));
        const safeOffset = Math.max(0, Number(offset) || 0);
        // 与 getVisitorOverview 保持同一国家推断口径：visitor_logs 无 country 字段，按 page_path 前缀划分
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
        const [rows] = await database_1.default.execute(`SELECT
        viewer_ip AS ip,
        MAX(NULLIF(location_label, '')) AS location,
        COUNT(*) AS visit_count,
        MAX(created_at) AS last_visited_at
       FROM visitor_logs
       WHERE viewer_ip IS NOT NULL
         AND viewer_ip <> ''${countryWhere}
       GROUP BY viewer_ip
       ORDER BY last_visited_at DESC
       LIMIT ${safeLimit} OFFSET ${safeOffset}`);
        const [countRows] = await database_1.default.execute(`SELECT COUNT(*) AS total
       FROM (
         SELECT viewer_ip
         FROM visitor_logs
         WHERE viewer_ip IS NOT NULL
           AND viewer_ip <> ''${countryWhere}
         GROUP BY viewer_ip
       ) ips`);
        const total = Number(countRows[0]?.total || 0);
        const visitors = rows.map((row) => {
            const ip = String(row.ip || '');
            return {
                ip,
                location: row.location || 'Unknown',
                visitCount: Number(row.visit_count || 0),
                lastVisitedAt: row.last_visited_at,
                isPublicIp: isTruthyIp(ip),
            };
        });
        await Promise.all(visitors.map(async (visitor) => {
            if (visitor.location !== 'Unknown' || !visitor.isPublicIp)
                return;
            const resolved = await (0, ipLocation_1.resolveLocationFromIp)(visitor.ip);
            if (!resolved)
                return;
            visitor.location = resolved;
            await database_1.default.execute(`UPDATE visitor_logs
           SET location_label = ?
           WHERE viewer_ip = ?
             AND (location_label IS NULL OR location_label = '' OR location_label = 'Unknown')`, [resolved, visitor.ip]);
        }));
        res.json({
            visitors,
            pagination: {
                page,
                limit,
                total,
                pages: Math.ceil(total / limit),
            },
        });
    }
    catch (error) {
        console.error('Error listing visitors:', error);
        res.status(500).json({ error: 'Failed to list visitors.' });
    }
}
