"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateArticleDraft = generateArticleDraft;
exports.createArticle = createArticle;
exports.updateArticle = updateArticle;
exports.deleteArticle = deleteArticle;
exports.getMyArticles = getMyArticles;
exports.getPublicArticles = getPublicArticles;
exports.getPublicArticleBySlug = getPublicArticleBySlug;
exports.getRelatedContent = getRelatedContent;
exports.adminGetArticles = adminGetArticles;
exports.adminDeleteArticle = adminDeleteArticle;
const database_1 = __importDefault(require("../config/database"));
const articleContent_1 = require("../lib/articleContent");
const articleImageMirror_1 = require("../lib/articleImageMirror");
const slugify_1 = require("../lib/slugify");
const llmService_1 = require("../services/llmService");
const express_validator_1 = require("express-validator");
const TAG = '[article]';
// ──────────────────────────────────────────────
// Helper: get company_profile_id from auth user
// ──────────────────────────────────────────────
async function getCompanyProfileId(userId) {
    const [rows] = await database_1.default.execute('SELECT id FROM company_profiles WHERE user_id = ? LIMIT 1', [userId]);
    const row = rows[0];
    return row ? row.id : null;
}
// ──────────────────────────────────────────────
// POST /api/articles/generate
// ──────────────────────────────────────────────
async function generateArticleDraft(req, res) {
    try {
        const configured = await (0, llmService_1.isLlmConfigured)();
        if (!configured) {
            return res.status(503).json({ error: 'AI article generation is not yet available.' });
        }
        const userId = req.user.userId ?? req.user.id;
        const companyProfileId = await getCompanyProfileId(userId);
        if (!companyProfileId) {
            return res.status(403).json({ error: 'Company profile required.' });
        }
        // Load company info
        const [cpRows] = await database_1.default.execute('SELECT company_name, city, services FROM company_profiles WHERE id = ?', [companyProfileId]);
        const company = cpRows[0];
        if (!company) {
            return res.status(404).json({ error: 'Company not found.' });
        }
        // Optionally load project data
        let projectContext = '';
        const { projectId } = req.body;
        if (projectId) {
            const [pRows] = await database_1.default.execute('SELECT title, description, tags FROM projects WHERE id = ? AND company_profile_id = ?', [projectId, companyProfileId]);
            const project = pRows[0];
            if (project) {
                projectContext = `\nBase this article on the following project:\n- Project title: ${project.title}\n- Description: ${project.description || 'N/A'}\n- Tags: ${project.tags || 'N/A'}`;
            }
        }
        const prompt = `Write a professional SEO article for an interior design company in UAE.
Company: ${company.company_name}
City: ${company.city || 'UAE'}
Services: ${company.services || 'Interior design and renovation'}${projectContext}

Write a compelling 600-800 word article that would rank well on Google for interior design keywords in UAE.`;
        const result = await (0, llmService_1.generateArticle)(prompt);
        if (!result) {
            return res.status(500).json({ error: 'Article generation failed. Please try again.' });
        }
        res.json(result);
    }
    catch (err) {
        console.error(TAG, 'generateArticleDraft error:', err);
        res.status(500).json({ error: 'Internal server error.' });
    }
}
// ──────────────────────────────────────────────
// POST /api/articles
// ──────────────────────────────────────────────
async function createArticle(req, res) {
    try {
        const errors = (0, express_validator_1.validationResult)(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }
        const userId = req.user.userId ?? req.user.id;
        const companyProfileId = await getCompanyProfileId(userId);
        if (!companyProfileId) {
            return res.status(403).json({ error: 'Company profile required.' });
        }
        const { title, content, excerpt, cover_image, tags, seo_title, seo_description, status } = req.body;
        const slug = (0, slugify_1.slugify)(title);
        const articleStatus = status === 'published' ? 'published' : 'draft';
        const [result] = await database_1.default.execute(`INSERT INTO articles (company_profile_id, title, slug, content, excerpt, cover_image, tags, seo_title, seo_description, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`, [companyProfileId, title, slug, content || '', excerpt || '', cover_image || null, tags || null, seo_title || title, seo_description || excerpt || '', articleStatus]);
        const insertId = result.insertId;
        res.status(201).json({ id: insertId, slug, message: 'Article created.' });
    }
    catch (err) {
        console.error(TAG, 'createArticle error:', err);
        res.status(500).json({ error: 'Internal server error.' });
    }
}
// ──────────────────────────────────────────────
// PUT /api/articles/:id
// ──────────────────────────────────────────────
async function updateArticle(req, res) {
    try {
        const userId = req.user.userId ?? req.user.id;
        const companyProfileId = await getCompanyProfileId(userId);
        if (!companyProfileId) {
            return res.status(403).json({ error: 'Company profile required.' });
        }
        const articleId = req.params.id;
        const { title, content, excerpt, cover_image, tags, seo_title, seo_description, status } = req.body;
        const slug = title ? (0, slugify_1.slugify)(title) : undefined;
        const articleStatus = status === 'published' ? 'published' : 'draft';
        const [result] = await database_1.default.execute(`UPDATE articles SET title = COALESCE(?, title), slug = COALESCE(?, slug), content = COALESCE(?, content),
       excerpt = COALESCE(?, excerpt), cover_image = COALESCE(?, cover_image), tags = COALESCE(?, tags),
       seo_title = COALESCE(?, seo_title), seo_description = COALESCE(?, seo_description),
       status = ?, updated_at = NOW()
       WHERE id = ? AND company_profile_id = ?`, [title, slug, content, excerpt, cover_image, tags, seo_title, seo_description, articleStatus, articleId, companyProfileId]);
        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Article not found or access denied.' });
        }
        res.json({ message: 'Article updated.' });
    }
    catch (err) {
        console.error(TAG, 'updateArticle error:', err);
        res.status(500).json({ error: 'Internal server error.' });
    }
}
// ──────────────────────────────────────────────
// DELETE /api/articles/:id
// ──────────────────────────────────────────────
async function deleteArticle(req, res) {
    try {
        const userId = req.user.userId ?? req.user.id;
        const companyProfileId = await getCompanyProfileId(userId);
        if (!companyProfileId) {
            return res.status(403).json({ error: 'Company profile required.' });
        }
        const articleId = req.params.id;
        const [result] = await database_1.default.execute('DELETE FROM articles WHERE id = ? AND company_profile_id = ?', [articleId, companyProfileId]);
        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Article not found or access denied.' });
        }
        res.json({ message: 'Article deleted.' });
    }
    catch (err) {
        console.error(TAG, 'deleteArticle error:', err);
        res.status(500).json({ error: 'Internal server error.' });
    }
}
// ──────────────────────────────────────────────
// GET /api/articles/mine
// ──────────────────────────────────────────────
async function getMyArticles(req, res) {
    try {
        const userId = req.user.userId ?? req.user.id;
        const companyProfileId = await getCompanyProfileId(userId);
        if (!companyProfileId) {
            return res.status(403).json({ error: 'Company profile required.' });
        }
        const [rows] = await database_1.default.execute('SELECT * FROM articles WHERE company_profile_id = ? ORDER BY created_at DESC', [companyProfileId]);
        res.json({ articles: rows });
    }
    catch (err) {
        console.error(TAG, 'getMyArticles error:', err);
        res.status(500).json({ error: 'Internal server error.' });
    }
}
// ──────────────────────────────────────────────
// GET /api/articles/public
// ──────────────────────────────────────────────
async function getPublicArticles(req, res) {
    try {
        const page = Math.max(1, parseInt(req.query.page) || 1);
        const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 20));
        const offset = (page - 1) * limit;
        const country = req.country || 'ae';
        const [countRows] = await database_1.default.execute("SELECT COUNT(*) as total FROM articles WHERE status = 'published' AND country = ?", [country]);
        const total = countRows[0].total;
        const [rows] = await database_1.default.query(`SELECT a.id, a.title, a.slug, a.excerpt, a.cover_image, a.tags, a.created_at, a.updated_at,
              cp.company_name, cp.slug AS company_slug
       FROM articles a
       LEFT JOIN company_profiles cp ON a.company_profile_id = cp.id
       WHERE a.status = 'published' AND a.country = ?
       ORDER BY a.created_at DESC
       LIMIT ${limit} OFFSET ${offset}`, [country]);
        const articles = rows.map((article) => ({
            ...article,
            cover_image: (0, articleImageMirror_1.resolveMirroredArticleImage)(article.slug, article.cover_image),
        }));
        res.json({
            articles,
            pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
        });
    }
    catch (err) {
        console.error(TAG, 'getPublicArticles error:', err);
        res.status(500).json({ error: 'Internal server error.' });
    }
}
// ──────────────────────────────────────────────
// GET /api/articles/public/:slug
// ──────────────────────────────────────────────
async function getPublicArticleBySlug(req, res) {
    try {
        const { slug } = req.params;
        const [rows] = await database_1.default.execute(`SELECT a.*, cp.company_name, cp.slug AS company_slug, cp.logo_url
       FROM articles a
       LEFT JOIN company_profiles cp ON a.company_profile_id = cp.id
       WHERE a.slug = ? AND a.status = 'published'
       LIMIT 1`, [slug]);
        const article = rows[0];
        if (!article) {
            return res.status(404).json({ error: 'Article not found.' });
        }
        const wordCount = (0, articleContent_1.countWords)(article.content || '');
        const readingTime = (0, articleContent_1.estimateReadingTime)(wordCount);
        res.json({
            article: {
                ...article,
                cover_image: (0, articleImageMirror_1.resolveMirroredArticleImage)(article.slug, article.cover_image),
                content_html: (0, articleImageMirror_1.rewriteMirroredArticleContent)(article.slug, (0, articleContent_1.markdownToHtml)(article.content || '', article.cover_image)),
                word_count: wordCount,
                reading_time: readingTime,
            },
        });
    }
    catch (err) {
        console.error(TAG, 'getPublicArticleBySlug error:', err);
        res.status(500).json({ error: 'Internal server error.' });
    }
}
// ──────────────────────────────────────────────
// GET /api/articles/public/:slug/related
// Returns related cases (projects) + related articles by tag overlap
// ──────────────────────────────────────────────
async function getRelatedContent(req, res) {
    try {
        const { slug } = req.params;
        // Fetch current article tags
        const [articleRows] = await database_1.default.execute(`SELECT id, tags FROM articles WHERE slug = ? AND status = 'published' LIMIT 1`, [slug]);
        const article = articleRows[0];
        if (!article)
            return res.json({ relatedCases: [], relatedArticles: [] });
        let articleTags = [];
        try {
            const parsed = typeof article.tags === 'string' ? JSON.parse(article.tags) : article.tags;
            if (Array.isArray(parsed))
                articleTags = parsed.map((t) => String(t).toLowerCase().trim());
        }
        catch { }
        // ── Related cases (projects) ──
        const [projectRows] = await database_1.default.query(`SELECT p.id, p.title, p.slug AS project_slug, p.images, p.service_tags, p.space_type, p.style,
              cp.company_name, cp.slug AS company_slug
       FROM projects p
       JOIN company_profiles cp ON p.company_profile_id = cp.id
       WHERE p.status = 'published' AND p.deleted_at IS NULL AND cp.status = 'approved'
       ORDER BY p.created_at DESC
       LIMIT 80`);
        function parseTagField(f) {
            if (!f)
                return [];
            try {
                const parsed = typeof f === 'string' ? JSON.parse(f) : f;
                if (Array.isArray(parsed))
                    return parsed.map((t) => String(t).toLowerCase().trim());
                if (typeof parsed === 'string')
                    return [parsed.toLowerCase().trim()];
            }
            catch { }
            return [String(f).toLowerCase().trim()];
        }
        function tagScore(articleTgs, ...fields) {
            if (articleTgs.length === 0)
                return 0;
            const projectTags = fields.flatMap((f) => parseTagField(f));
            return articleTgs.filter((t) => projectTags.some((pt) => pt.includes(t) || t.includes(pt))).length;
        }
        const scoredProjects = projectRows.map((p) => {
            const score = tagScore(articleTags, p.service_tags, p.space_type, p.style);
            let coverImage = null;
            try {
                const imgs = typeof p.images === 'string' ? JSON.parse(p.images) : p.images;
                if (Array.isArray(imgs) && imgs.length > 0) {
                    const first = imgs[0];
                    coverImage = typeof first === 'string' ? first : (first?.url ?? first?.src ?? null);
                }
            }
            catch { }
            return { ...p, score, coverImage };
        });
        scoredProjects.sort((a, b) => b.score - a.score);
        const relatedCases = scoredProjects.slice(0, 4).map((p) => ({
            id: p.id,
            title: p.title,
            slug: p.project_slug,
            coverImage: p.coverImage,
            companyName: p.company_name,
            companySlug: p.company_slug,
        }));
        // ── Related articles ──
        const [otherArticles] = await database_1.default.query(`SELECT a.id, a.title, a.slug, a.excerpt, a.cover_image, a.tags, a.created_at,
              cp.company_name
       FROM articles a
       LEFT JOIN company_profiles cp ON a.company_profile_id = cp.id
       WHERE a.status = 'published' AND a.id != ?
       ORDER BY a.created_at DESC
       LIMIT 50`, [article.id]);
        const scoredArticles = otherArticles.map((a) => ({
            ...a,
            score: tagScore(articleTags, a.tags),
        }));
        scoredArticles.sort((a, b) => b.score - a.score);
        const relatedArticles = scoredArticles.slice(0, 3).map((a) => ({
            id: a.id,
            title: a.title,
            slug: a.slug,
            excerpt: a.excerpt,
            coverImage: (0, articleImageMirror_1.resolveMirroredArticleImage)(a.slug, a.cover_image),
            companyName: a.company_name,
            createdAt: a.created_at,
        }));
        res.json({ relatedCases, relatedArticles });
    }
    catch (err) {
        console.error(TAG, 'getRelatedContent error:', err);
        res.status(500).json({ error: 'Internal server error.' });
    }
}
// ──────────────────────────────────────────────
// Admin: GET /api/articles/admin
// ──────────────────────────────────────────────
async function adminGetArticles(req, res) {
    try {
        const [rows] = await database_1.default.execute(`SELECT a.*, cp.company_name
       FROM articles a
       LEFT JOIN company_profiles cp ON a.company_profile_id = cp.id
       ORDER BY a.created_at DESC`);
        res.json({ articles: rows });
    }
    catch (err) {
        console.error(TAG, 'adminGetArticles error:', err);
        res.status(500).json({ error: 'Internal server error.' });
    }
}
// ──────────────────────────────────────────────
// Admin: DELETE /api/articles/admin/:id
// ──────────────────────────────────────────────
async function adminDeleteArticle(req, res) {
    try {
        const articleId = req.params.id;
        const [result] = await database_1.default.execute('DELETE FROM articles WHERE id = ?', [articleId]);
        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Article not found.' });
        }
        res.json({ message: 'Article deleted.' });
    }
    catch (err) {
        console.error(TAG, 'adminDeleteArticle error:', err);
        res.status(500).json({ error: 'Internal server error.' });
    }
}
