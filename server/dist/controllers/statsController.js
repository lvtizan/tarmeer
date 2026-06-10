"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.recordPageView = recordPageView;
exports.recordClick = recordClick;
exports.batchRecord = batchRecord;
exports.getDesignerPublicStats = getDesignerPublicStats;
exports.recordSiteVisit = recordSiteVisit;
exports.recordAnalyticsEvent = recordAnalyticsEvent;
const database_1 = __importDefault(require("../config/database"));
const visitorTracking_1 = require("../lib/visitorTracking");
const visitorLogStore_1 = require("../lib/visitorLogStore");
const ipLocation_1 = require("../lib/ipLocation");
const analyticsEventStore_1 = require("../lib/analyticsEventStore");
// Record page view
async function recordPageView(req, res) {
    const { entityType, entityId, referrer } = req.body;
    if (!entityType || !entityId) {
        return res.status(400).json({ error: 'entityType and entityId are required.' });
    }
    if (!['designer', 'project'].includes(entityType)) {
        return res.status(400).json({ error: 'entityType must be "designer" or "project".' });
    }
    try {
        const ip = (0, visitorTracking_1.extractClientIp)(req);
        const userAgent = req.headers['user-agent'] || '';
        const fingerprint = req.body.fingerprint || null;
        // Insert raw page view (for detailed analytics)
        await database_1.default.execute(`INSERT INTO page_views (entity_type, entity_id, viewer_ip, viewer_fingerprint, referrer, user_agent)
       VALUES (?, ?, ?, ?, ?, ?)`, [entityType, entityId, ip, fingerprint, referrer || null, userAgent.substring(0, 512)]);
        // Update daily stats
        const today = new Date().toISOString().split('T')[0];
        const column = entityType === 'designer' ? 'profile_views' : 'project_views';
        // For designer views, also update designer_stats
        if (entityType === 'designer') {
            await database_1.default.execute(`INSERT INTO designer_stats (designer_id, stat_date, profile_views)
         VALUES (?, ?, 1)
         ON DUPLICATE KEY UPDATE profile_views = profile_views + 1`, [entityId, today]);
        }
        else {
            // For project views, need to find the designer and update their project_views
            const [projectRows] = await database_1.default.execute('SELECT designer_id FROM projects WHERE id = ?', [entityId]);
            const projects = projectRows;
            if (projects.length > 0) {
                const designerId = projects[0].designer_id;
                await database_1.default.execute(`INSERT INTO designer_stats (designer_id, stat_date, project_views)
           VALUES (?, ?, 1)
           ON DUPLICATE KEY UPDATE project_views = project_views + 1`, [designerId, today]);
            }
        }
        res.json({ success: true });
    }
    catch (error) {
        console.error('Error recording page view:', error);
        res.status(500).json({ error: 'Failed to record page view.' });
    }
}
// Valid column names for stats (whitelist)
const STATS_COLUMNS = ['phone_clicks', 'whatsapp_clicks', 'contact_clicks', 'project_views', 'profile_views'];
// Record click event
async function recordClick(req, res) {
    const { designerId, clickType } = req.body;
    if (!designerId || !clickType) {
        return res.status(400).json({ error: 'designerId and clickType are required.' });
    }
    // Whitelist for clickType
    const columnMap = {
        phone: 'phone_clicks',
        whatsapp: 'whatsapp_clicks',
        email: 'contact_clicks',
        contact_form: 'contact_clicks'
    };
    const column = columnMap[clickType];
    if (!column) {
        return res.status(400).json({ error: 'Invalid clickType.' });
    }
    try {
        const ip = (0, visitorTracking_1.extractClientIp)(req);
        const today = new Date().toISOString().split('T')[0];
        // Insert click event
        await database_1.default.execute(`INSERT INTO click_events (designer_id, click_type, viewer_ip)
       VALUES (?, ?, ?)`, [designerId, clickType, ip]);
        // Update daily stats with safe column name (using whitelist)
        await database_1.default.execute(`INSERT INTO designer_stats (designer_id, stat_date, ${column})
       VALUES (?, ?, 1)
       ON DUPLICATE KEY UPDATE ${column} = ${column} + 1`, [designerId, today]);
        res.json({ success: true });
    }
    catch (error) {
        console.error('Error recording click:', error);
        res.status(500).json({ error: 'Failed to record click.' });
    }
}
// Batch record events (for client-side batching)
async function batchRecord(req, res) {
    const { events } = req.body;
    if (!events || !Array.isArray(events) || events.length === 0) {
        return res.status(400).json({ error: 'events array is required.' });
    }
    // Limit batch size
    const MAX_BATCH_SIZE = 100;
    if (events.length > MAX_BATCH_SIZE) {
        return res.status(400).json({ error: `Maximum ${MAX_BATCH_SIZE} events per batch.` });
    }
    try {
        const today = new Date().toISOString().split('T')[0];
        const ip = (0, visitorTracking_1.extractClientIp)(req);
        const userAgent = req.headers['user-agent']?.substring(0, 512) || '';
        for (const event of events) {
            if (event.type === 'page_view') {
                const { entityType, entityId, referrer, fingerprint } = event;
                if (entityType && entityId && ['designer', 'project'].includes(entityType)) {
                    await database_1.default.execute(`INSERT INTO page_views (entity_type, entity_id, viewer_ip, viewer_fingerprint, referrer, user_agent)
             VALUES (?, ?, ?, ?, ?, ?)`, [entityType, entityId, ip, fingerprint || null, referrer || null, userAgent]);
                    if (entityType === 'designer') {
                        await database_1.default.execute(`INSERT INTO designer_stats (designer_id, stat_date, profile_views)
               VALUES (?, ?, 1)
               ON DUPLICATE KEY UPDATE profile_views = profile_views + 1`, [entityId, today]);
                    }
                }
            }
            else if (event.type === 'click') {
                const { designerId, clickType } = event;
                // Whitelist for clickType
                const columnMap = {
                    phone: 'phone_clicks',
                    whatsapp: 'whatsapp_clicks',
                    email: 'contact_clicks',
                    contact_form: 'contact_clicks'
                };
                const column = columnMap[clickType];
                if (designerId && column) {
                    await database_1.default.execute(`INSERT INTO click_events (designer_id, click_type, viewer_ip)
             VALUES (?, ?, ?)`, [designerId, clickType, ip]);
                    await database_1.default.execute(`INSERT INTO designer_stats (designer_id, stat_date, ${column})
             VALUES (?, ?, 1)
             ON DUPLICATE KEY UPDATE ${column} = ${column} + 1`, [designerId, today]);
                }
            }
        }
        res.json({ success: true, processedCount: events.length });
    }
    catch (error) {
        console.error('Error batch recording:', error);
        res.status(500).json({ error: 'Failed to record events.' });
    }
}
// Get public stats for a designer (limited)
async function getDesignerPublicStats(req, res) {
    const { id } = req.params;
    try {
        const [rows] = await database_1.default.execute(`SELECT 
        COALESCE(SUM(profile_views), 0) as total_views
       FROM designer_stats WHERE designer_id = ?`, [id]);
        res.json({
            totalViews: rows[0].total_views
        });
    }
    catch (error) {
        console.error('Error getting designer stats:', error);
        res.status(500).json({ error: 'Failed to get stats.' });
    }
}
// Record a public website visit (for admin visitor analytics)
async function recordSiteVisit(req, res) {
    try {
        await (0, visitorLogStore_1.ensureVisitorLogsTable)();
        const ip = (0, visitorTracking_1.extractClientIp)(req);
        let locationLabel = (0, visitorTracking_1.formatVisitorLocation)(req);
        if (locationLabel === 'Unknown') {
            const resolved = await (0, ipLocation_1.resolveLocationFromIp)(ip);
            if (resolved) {
                locationLabel = resolved;
            }
        }
        const pagePath = (0, visitorTracking_1.sanitizePagePath)(req.body?.pagePath);
        const referrer = typeof req.body?.referrer === 'string' ? req.body.referrer.slice(0, 512) : null;
        const userAgent = (req.headers['user-agent'] || '').toString().slice(0, 512);
        await database_1.default.execute(`INSERT INTO visitor_logs (viewer_ip, location_label, page_path, referrer, user_agent)
       VALUES (?, ?, ?, ?, ?)`, [ip || 'unknown', locationLabel, pagePath, referrer, userAgent]);
        res.json({ success: true });
    }
    catch (error) {
        console.error('Error recording site visit:', error);
        res.status(500).json({ error: 'Failed to record site visit.' });
    }
}
async function recordAnalyticsEvent(req, res) {
    const rawEventName = req.body?.eventName;
    if (typeof rawEventName !== 'string' || rawEventName.trim().length === 0) {
        return res.status(400).json({ error: 'eventName is required.' });
    }
    const eventName = rawEventName.trim().slice(0, 64);
    const pagePath = (0, visitorTracking_1.sanitizePagePath)(req.body?.pagePath);
    const referrer = typeof req.body?.referrer === 'string'
        ? req.body.referrer.slice(0, 512)
        : (typeof req.headers.referer === 'string' ? req.headers.referer.slice(0, 512) : null);
    const userAgent = (req.headers['user-agent'] || '').toString().slice(0, 512);
    const payload = req.body?.payload && typeof req.body.payload === 'object' ? req.body.payload : null;
    try {
        await (0, analyticsEventStore_1.ensureAnalyticsEventsTable)();
        const ip = (0, visitorTracking_1.extractClientIp)(req);
        let locationLabel = (0, visitorTracking_1.formatVisitorLocation)(req);
        if (locationLabel === 'Unknown') {
            const resolved = await (0, ipLocation_1.resolveLocationFromIp)(ip);
            if (resolved)
                locationLabel = resolved;
        }
        await database_1.default.execute(`INSERT INTO analytics_events (event_name, page_path, viewer_ip, location_label, referrer, user_agent, payload)
       VALUES (?, ?, ?, ?, ?, ?, ?)`, [eventName, pagePath, ip || 'unknown', locationLabel, referrer, userAgent, payload ? JSON.stringify(payload) : null]);
        res.json({ success: true });
    }
    catch (error) {
        console.error('Error recording analytics event:', error);
        res.status(500).json({ error: 'Failed to record analytics event.' });
    }
}
