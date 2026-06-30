"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.listGuides = listGuides;
exports.getGuide = getGuide;
const database_1 = __importDefault(require("../config/database"));
const TAG = '[guide]';
// ──────────────────────────────────────────────
// GET /api/guides/public
// ──────────────────────────────────────────────
async function listGuides(req, res) {
    try {
        const country = (req.query.country || req.headers['x-country'] || 'ae');
        const { category, series } = req.query;
        let sql = "SELECT id, slug, title, summary, category, series_id, cover_image, published_at FROM guides WHERE country=? AND status='published'";
        const params = [country];
        if (category) {
            sql += ' AND category=?';
            params.push(category);
        }
        if (series) {
            sql += ' AND series_id=?';
            params.push(series);
        }
        sql += ' ORDER BY published_at DESC, id DESC';
        const [rows] = await database_1.default.execute(sql, params);
        res.json({ guides: rows });
    }
    catch (err) {
        console.error(TAG, 'listGuides error:', err);
        res.status(500).json({ error: 'Internal server error.' });
    }
}
// ──────────────────────────────────────────────
// GET /api/guides/public/:slug
// ──────────────────────────────────────────────
async function getGuide(req, res) {
    try {
        const { slug } = req.params;
        const country = (req.query.country || req.headers['x-country'] || 'ae');
        const [rows] = await database_1.default.execute(
            "SELECT * FROM guides WHERE slug=? AND country=? AND status='published' LIMIT 1",
            [slug, country]
        );
        if (rows.length === 0) {
            return res.status(404).json({ error: 'Guide not found.' });
        }
        const guide = rows[0];
        if (typeof guide.body_blocks === 'string') {
            try {
                guide.body_blocks = JSON.parse(guide.body_blocks);
            }
            catch {
                // leave as-is if parse fails
            }
        }
        // Fetch expert quotes with country consistency (P0 isolation: JOIN constrains e.country = guide's country)
        const [experts] = await database_1.default.execute(
            `SELECT geq.quote, geq.role_label, geq.sort_order,
                    e.full_name, e.slug AS expert_slug, e.experience_years, e.city, e.is_certified, e.avatar_url
             FROM guide_expert_quotes geq
             JOIN expert_profiles e
               ON e.id = geq.expert_ref_id AND geq.expert_ref_source = 'experts' AND e.country = ?
             WHERE geq.guide_id = ? AND e.status = 'approved'
             ORDER BY geq.sort_order, geq.id`,
            [country, guide.id]
        );
        res.json({ guide: { ...guide, experts } });
    }
    catch (err) {
        console.error(TAG, 'getGuide error:', err);
        res.status(500).json({ error: 'Internal server error.' });
    }
}
