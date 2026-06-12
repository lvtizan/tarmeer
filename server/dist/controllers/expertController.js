"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.listPublicExperts = listPublicExperts;
exports.getPublicExpert = getPublicExpert;
exports.getMyExpertProfile = getMyExpertProfile;
exports.upsertExpertProfile = upsertExpertProfile;
exports.getMyExpertInquiries = getMyExpertInquiries;
exports.getMyExpertStats = getMyExpertStats;
exports.adminListExperts = adminListExperts;
exports.adminUpdateExpertStatus = adminUpdateExpertStatus;
exports.adminToggleExpertCertified = adminToggleExpertCertified;
exports.adminToggleExpertSigned = adminToggleExpertSigned;
const database_1 = __importDefault(require("../config/database"));
const slugify_1 = require("../lib/slugify");

const VALID_COUNTRIES = new Set(['ae', 'vn', 'sa']);

// ── 自动迁移（幂等）─────────────────────────────────────────────────────────
async function ensureExpertTables() {
    try {
        await database_1.default.execute(`
      CREATE TABLE IF NOT EXISTS expert_profiles (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL UNIQUE,
        full_name VARCHAR(200) NOT NULL,
        avatar_url VARCHAR(500) NULL,
        services JSON NULL,
        birth_year SMALLINT NULL,
        experience_years SMALLINT NULL,
        city VARCHAR(100) NULL,
        bio TEXT NULL,
        skills JSON NULL,
        work_history JSON NULL,
        certificates JSON NULL,
        license_url VARCHAR(500) NULL,
        phone VARCHAR(40) NULL,
        slug VARCHAR(200) NOT NULL UNIQUE,
        status ENUM('pending','approved','rejected') NOT NULL DEFAULT 'pending',
        country VARCHAR(5) NOT NULL DEFAULT 'ae' COLLATE utf8mb4_0900_ai_ci,
        is_certified TINYINT(1) NOT NULL DEFAULT 0,
        is_signed TINYINT(1) NOT NULL DEFAULT 0,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_status_country (status, country),
        INDEX idx_country (country)
      ) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci
    `);
    }
    catch (e) {
        console.error('[experts] ensureTable:', e.message);
    }
    // users.role / active_role 枚举加 'expert'
    try {
        const [cols] = await database_1.default.execute(`SELECT COLUMN_TYPE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'role'`);
        if (cols.length && !String(cols[0].COLUMN_TYPE).includes('expert')) {
            await database_1.default.execute(`ALTER TABLE users MODIFY role ENUM('user','homeowner','designer','company','expert') DEFAULT 'user'`);
            await database_1.default.execute(`ALTER TABLE users MODIFY active_role ENUM('homeowner','company','expert') NULL`);
            console.log('[experts] users.role enum extended with expert');
        }
    }
    catch (e) {
        console.error('[experts] ensureRoleEnum:', e.message);
    }
    // design_inquiries.expert_id（专家主页留言进同一张询盘表）
    try {
        const [cols] = await database_1.default.execute(`SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'design_inquiries' AND COLUMN_NAME = 'expert_id'`);
        if (cols.length === 0) {
            await database_1.default.execute(`ALTER TABLE design_inquiries ADD COLUMN expert_id INT NULL, ADD INDEX idx_expert (expert_id)`);
            console.log('[experts] added column: design_inquiries.expert_id');
        }
    }
    catch (e) {
        console.error('[experts] ensureInquiryExpertId:', e.message);
    }
}
ensureExpertTables();

const { detectCountry } = require("../lib/detectCountry");

function parseJson(v) {
    if (v == null) return null;
    if (typeof v === 'string') { try { return JSON.parse(v); } catch { return null; } }
    return v;
}

function publicExpertShape(r, full) {
    const base = {
        id: r.id,
        slug: r.slug,
        full_name: r.full_name,
        avatar_url: r.avatar_url,
        services: parseJson(r.services) || [],
        birth_year: r.birth_year,
        experience_years: r.experience_years,
        city: r.city,
        country: r.country,
        is_certified: !!r.is_certified,
        is_signed: !!r.is_signed,
        has_phone: !!r.phone,
    };
    if (!full) return base;
    return {
        ...base,
        bio: r.bio || '',
        skills: parseJson(r.skills) || [],
        work_history: parseJson(r.work_history) || [],
        certificates: parseJson(r.certificates) || [],
        // 营业执照不公开原件，只给"已核验"状态
        license_verified: !!r.license_url,
    };
}

// ── 公开接口 ─────────────────────────────────────────────────────────────────
// GET /api/experts/cities?country=
async function listExpertCities(req, res) {
    try {
        const country = VALID_COUNTRIES.has(req.query.country) ? req.query.country : 'ae';
        const [rows] = await database_1.default.execute(
            `SELECT DISTINCT city FROM expert_profiles WHERE status = 'approved' AND country = ? AND city IS NOT NULL ORDER BY city`,
            [country]
        );
        res.json({ cities: rows.map(r => r.city).filter(Boolean) });
    } catch (e) {
        res.status(500).json({ error: 'Failed.' });
    }
}
exports.listExpertCities = listExpertCities;

// GET /api/experts?country=&service=&city=&certified=&page=&limit=
async function listPublicExperts(req, res) {
    try {
        const page = Math.max(1, parseInt(req.query.page, 10) || 1);
        const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 20));
        const offset = (page - 1) * limit;
        const country = VALID_COUNTRIES.has(req.query.country) ? req.query.country : 'ae';
        let where = "WHERE status = 'approved' AND country = ?";
        const params = [country];
        if (req.query.service) {
            where += ' AND JSON_SEARCH(LOWER(services), \'one\', LOWER(?)) IS NOT NULL';
            params.push(String(req.query.service).slice(0, 100));
        }
        if (req.query.city) {
            where += ' AND LOWER(city) = LOWER(?)';
            params.push(String(req.query.city).slice(0, 100));
        }
        if (req.query.certified === '1') {
            where += ' AND is_certified = 1';
        }
        const [countRows] = await database_1.default.execute(`SELECT COUNT(*) AS total FROM expert_profiles ${where}`, params);
        const [rows] = await database_1.default.query(`SELECT * FROM expert_profiles ${where} ORDER BY is_signed DESC, is_certified DESC, updated_at DESC LIMIT ${limit} OFFSET ${offset}`, params);
        // 列表封面 = 专家首个 published 项目首图；批量查避免 N+1
        const ids = rows.map(r => r.id);
        const coverById = {};
        if (ids.length > 0) {
            const placeholders = ids.map(() => '?').join(',');
            const [projRows] = await database_1.default.query(
                `SELECT expert_profile_id, images FROM projects
                 WHERE expert_profile_id IN (${placeholders}) AND status = 'published'
                 ORDER BY created_at ASC`,
                ids
            );
            for (const pr of projRows) {
                if (coverById[pr.expert_profile_id]) continue; // 取最早一个项目
                let imgs = pr.images;
                try { imgs = typeof imgs === 'string' ? JSON.parse(imgs) : (imgs || []); } catch { imgs = []; }
                if (Array.isArray(imgs) && imgs.length > 0) coverById[pr.expert_profile_id] = imgs[0];
            }
        }
        res.json({
            experts: rows.map(r => ({ ...publicExpertShape(r, false), cover_image: coverById[r.id] || null })),
            pagination: { page, limit, total: Number(countRows[0]?.total || 0) },
        });
    }
    catch (e) {
        console.error('listPublicExperts error:', e);
        res.status(500).json({ error: 'Failed to list experts.' });
    }
}

// GET /api/experts/:slug
async function getPublicExpert(req, res) {
    try {
        const [rows] = await database_1.default.execute(`SELECT * FROM expert_profiles WHERE slug = ? AND status = 'approved' LIMIT 1`, [req.params.slug]);
        if (rows.length === 0) return res.status(404).json({ error: 'Expert not found.' });
        const expert = rows[0];
        // Include published projects for this expert
        const [projectRows] = await database_1.default.execute(
            `SELECT id, title, description, style, location, area, year, cost, images, tags, slug, created_at
             FROM projects WHERE expert_profile_id = ? AND status = 'published'
             ORDER BY created_at DESC LIMIT 20`,
            [expert.id]
        );
        const projects = projectRows.map(p => ({
            ...p,
            images: (() => { try { return typeof p.images === 'string' ? JSON.parse(p.images) : (p.images || []); } catch { return []; } })(),
            tags: (() => { try { return typeof p.tags === 'string' ? JSON.parse(p.tags) : (p.tags || []); } catch { return []; } })(),
        }));
        res.json({ expert: { ...publicExpertShape(expert, true), projects } });
    }
    catch (e) {
        console.error('getPublicExpert error:', e);
        res.status(500).json({ error: 'Failed to load expert.' });
    }
}

// ── 专家个人中心 ─────────────────────────────────────────────────────────────
// GET /api/experts/me（auth）
async function getMyExpertProfile(req, res) {
    try {
        const [rows] = await database_1.default.execute(`SELECT * FROM expert_profiles WHERE user_id = ? LIMIT 1`, [req.user.userId]);
        if (rows.length === 0) return res.json({ profile: null });
        const r = rows[0];
        res.json({ profile: { ...publicExpertShape(r, true), status: r.status, phone: r.phone, license_url: r.license_url } });
    }
    catch (e) {
        console.error('getMyExpertProfile error:', e);
        res.status(500).json({ error: 'Failed to load profile.' });
    }
}

// POST /api/experts/me（auth）：创建/更新个人资料（简历各区块）
async function upsertExpertProfile(req, res) {
    try {
        const userId = req.user.userId;
        const b = req.body || {};
        const fullName = String(b.full_name || '').trim().slice(0, 200);
        if (!fullName) return res.status(400).json({ error: 'Full name is required.' });
        const jsonOrNull = (v) => (v == null ? null : JSON.stringify(v));
        const fields = {
            full_name: fullName,
            avatar_url: b.avatar_url ? String(b.avatar_url).slice(0, 500) : null,
            services: jsonOrNull(Array.isArray(b.services) ? b.services.slice(0, 20) : null),
            birth_year: Number.isInteger(b.birth_year) ? b.birth_year : null,
            experience_years: Number.isInteger(b.experience_years) ? b.experience_years : null,
            city: b.city ? String(b.city).slice(0, 100) : null,
            bio: b.bio ? String(b.bio).slice(0, 5000) : null,
            skills: jsonOrNull(Array.isArray(b.skills) ? b.skills.slice(0, 30) : null),
            work_history: jsonOrNull(Array.isArray(b.work_history) ? b.work_history.slice(0, 30) : null),
            certificates: jsonOrNull(Array.isArray(b.certificates) ? b.certificates.slice(0, 20) : null),
            license_url: b.license_url ? String(b.license_url).slice(0, 500) : null,
            phone: b.phone ? String(b.phone).slice(0, 40) : null,
        };
        const [existing] = await database_1.default.execute(`SELECT id FROM expert_profiles WHERE user_id = ? LIMIT 1`, [userId]);
        if (existing.length > 0) {
            const setClauses = Object.keys(fields).map(k => `${k} = ?`).join(', ');
            await database_1.default.execute(`UPDATE expert_profiles SET ${setClauses} WHERE user_id = ?`, [...Object.values(fields), userId]);
            return res.json({ ok: true, id: existing[0].id });
        }
        // 新建：国家按手机号前缀（专家填的 phone 优先，回落 users.phone）
        const [userRows] = await database_1.default.execute('SELECT phone FROM users WHERE id = ?', [userId]);
        const country = detectCountry(fields.phone || userRows[0]?.phone);
        let base = (0, slugify_1.slugify)(fullName) || `expert-${userId}`;
        let slug = base;
        let i = 2;
        while (true) {
            const [conflict] = await database_1.default.execute('SELECT id FROM expert_profiles WHERE slug = ?', [slug]);
            if (conflict.length === 0) break;
            slug = `${base}-${i++}`;
        }
        const [result] = await database_1.default.execute(`INSERT INTO expert_profiles (user_id, full_name, avatar_url, services, birth_year, experience_years, city, bio, skills, work_history, certificates, license_url, phone, slug, status, country)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?)`, [
            userId, fields.full_name, fields.avatar_url, fields.services, fields.birth_year, fields.experience_years,
            fields.city, fields.bio, fields.skills, fields.work_history, fields.certificates, fields.license_url,
            fields.phone, slug, country,
        ]);
        // 把用户角色标记为 expert（注册时可能没选）
        await database_1.default.execute(`UPDATE users SET role = 'expert', active_role = 'expert' WHERE id = ? AND role NOT IN ('company')`, [userId]).catch(() => { });
        res.status(201).json({ ok: true, id: result.insertId, slug });
    }
    catch (e) {
        console.error('upsertExpertProfile error:', e);
        res.status(500).json({ error: 'Failed to save profile.' });
    }
}

// GET /api/experts/me/inquiries（auth）：留言收件箱
async function getMyExpertInquiries(req, res) {
    try {
        const [prof] = await database_1.default.execute(`SELECT id FROM expert_profiles WHERE user_id = ? LIMIT 1`, [req.user.userId]);
        if (prof.length === 0) return res.json({ inquiries: [] });
        const [rows] = await database_1.default.execute(`SELECT id, name, phone, city, area_range, message, created_at
       FROM design_inquiries WHERE expert_id = ? AND deleted_at IS NULL
       ORDER BY created_at DESC LIMIT 100`, [prof[0].id]);
        res.json({ inquiries: rows });
    }
    catch (e) {
        console.error('getMyExpertInquiries error:', e);
        res.status(500).json({ error: 'Failed to load inquiries.' });
    }
}

// GET /api/experts/me/stats（auth）：我的数据（电话被点次数等，续费认证卖点）
async function getMyExpertStats(req, res) {
    try {
        const [prof] = await database_1.default.execute(`SELECT id FROM expert_profiles WHERE user_id = ? LIMIT 1`, [req.user.userId]);
        if (prof.length === 0) return res.json({ phoneReveals: 0, inquiries: 0 });
        const expertId = prof[0].id;
        const [pr] = await database_1.default.execute(`SELECT COUNT(*) AS n FROM phone_reveals WHERE target_type = 'expert' AND target_id = ?`, [expertId]);
        const [inq] = await database_1.default.execute(`SELECT COUNT(*) AS n FROM design_inquiries WHERE expert_id = ? AND deleted_at IS NULL`, [expertId]);
        res.json({ phoneReveals: Number(pr[0]?.n || 0), inquiries: Number(inq[0]?.n || 0) });
    }
    catch (e) {
        console.error('getMyExpertStats error:', e);
        res.status(500).json({ error: 'Failed to load stats.' });
    }
}

// ── 管理后台 ─────────────────────────────────────────────────────────────────
// GET /api/admin/experts?country=&status=&search=
async function adminListExperts(req, res) {
    try {
        const country = VALID_COUNTRIES.has(req.query.country) ? req.query.country : 'ae';
        let where = 'WHERE ep.country = ?';
        const params = [country];
        if (req.query.status) {
            where += ' AND ep.status = ?';
            params.push(req.query.status);
        }
        if (req.query.search) {
            where += ' AND (ep.full_name LIKE ? OR u.email LIKE ?)';
            params.push(`%${req.query.search}%`, `%${req.query.search}%`);
        }
        const [rows] = await database_1.default.execute(`SELECT ep.*, u.email AS user_email
       FROM expert_profiles ep JOIN users u ON u.id = ep.user_id
       ${where} ORDER BY ep.created_at DESC LIMIT 200`, params);
        res.json({
            experts: rows.map(r => ({
                id: r.id, slug: r.slug, full_name: r.full_name, avatar_url: r.avatar_url,
                services: parseJson(r.services) || [], city: r.city, phone: r.phone,
                user_email: r.user_email, status: r.status, country: r.country,
                is_certified: !!r.is_certified, is_signed: !!r.is_signed,
                certificates: parseJson(r.certificates) || [], license_url: r.license_url,
                experience_years: r.experience_years, created_at: r.created_at,
            })),
        });
    }
    catch (e) {
        console.error('adminListExperts error:', e);
        res.status(500).json({ error: 'Failed to list experts.' });
    }
}

// PUT /api/admin/experts/:id/status { status: approved|rejected|pending }
async function adminUpdateExpertStatus(req, res) {
    try {
        const status = String(req.body.status || '');
        if (!['approved', 'rejected', 'pending'].includes(status)) {
            return res.status(400).json({ error: 'Invalid status.' });
        }
        await database_1.default.execute(`UPDATE expert_profiles SET status = ? WHERE id = ?`, [status, req.params.id]);
        res.json({ ok: true });
    }
    catch (e) {
        res.status(500).json({ error: 'Failed to update status.' });
    }
}

// PUT /api/admin/experts/:id/toggle-certified（¥1000 普通认证）
async function adminToggleExpertCertified(req, res) {
    try {
        await database_1.default.execute(`UPDATE expert_profiles SET is_certified = ? WHERE id = ?`, [req.body.is_certified ? 1 : 0, req.params.id]);
        res.json({ ok: true });
    }
    catch (e) {
        res.status(500).json({ error: 'Failed to update certified status.' });
    }
}

// PUT /api/admin/experts/:id/toggle-signed（VIP）
async function adminToggleExpertSigned(req, res) {
    try {
        await database_1.default.execute(`UPDATE expert_profiles SET is_signed = ? WHERE id = ?`, [req.body.is_signed ? 1 : 0, req.params.id]);
        res.json({ ok: true });
    }
    catch (e) {
        res.status(500).json({ error: 'Failed to update signed status.' });
    }
}
