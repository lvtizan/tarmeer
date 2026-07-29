"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.listPublicProjects = listPublicProjects;
exports.getPublicProject = getPublicProject;
exports.listMyProjects = listMyProjects;
exports.addProject = addProject;
exports.updateProject = updateProject;
exports.deleteProject = deleteProject;
const database_1 = __importDefault(require("../config/database"));
const projectImageStorage_1 = require("../lib/projectImageStorage");
const supplierRedact_1 = require("../lib/supplierRedact");
async function getProfile(supplierUserId) {
    const [rows] = await database_1.default.execute('SELECT id, slug FROM supplier_profiles WHERE supplier_user_id = ? LIMIT 1', [supplierUserId]);
    return rows[0] || null;
}
async function listPublicProjects(req, res) {
    try {
        const { slug } = req.params;
        // 国家隔离铁律：按站点国家解析供应商，禁止 VN 站命中 AE 供应商项目（P0 串域）。
        const reqCountry = (typeof req.query.country === 'string' && ['ae', 'vn'].includes(req.query.country) ? req.query.country : null) || req.country || 'ae';
        const [profiles] = await database_1.default.execute("SELECT id, company_name FROM supplier_profiles WHERE slug = ? AND status = 'approved' AND country = ?", [slug, reqCountry]);
        const profile = profiles[0];
        if (!profile)
            return res.status(404).json({ error: 'Supplier not found.' });
        const [projects] = await database_1.default.execute('SELECT * FROM supplier_projects WHERE supplier_profile_id = ? AND is_published = 1 ORDER BY sort_order ASC, id DESC', [profile.id]);
        // 公开去标识：自填项目标题/简介里含品牌名一并遮蔽（与 getPublicProject 同口径）
        const realName = profile.company_name;
        const maskedProjects = (Array.isArray(projects) ? projects : []).map((p) => ({
            ...p,
            title: supplierRedact_1.maskSupplierMentions(p.title, realName),
            description: supplierRedact_1.maskSupplierMentions(p.description, realName),
        }));
        res.json({ projects: maskedProjects });
    }
    catch (error) {
        console.error('List public projects error:', error);
        res.status(500).json({ error: 'Failed to load projects.' });
    }
}
async function getPublicProject(req, res) {
    try {
        const { slug, id } = req.params;
        // 国家隔离铁律：按站点国家解析供应商，禁止 VN 站命中 AE 供应商项目详情（P0 串域）。
        const reqCountry = (typeof req.query.country === 'string' && ['ae', 'vn'].includes(req.query.country) ? req.query.country : null) || req.country || 'ae';
        const [profiles] = await database_1.default.execute("SELECT id, company_name, name_zh, slug, logo_url, categories FROM supplier_profiles WHERE slug = ? AND status = 'approved' AND country = ?", [slug, reqCountry]);
        const profile = profiles[0];
        if (!profile)
            return res.status(404).json({ error: 'Supplier not found.' });
        const [rows] = await database_1.default.execute('SELECT * FROM supplier_projects WHERE id = ? AND supplier_profile_id = ? AND is_published = 1', [id, profile.id]);
        const project = rows[0];
        if (!project)
            return res.status(404).json({ error: 'Project not found.' });
        const [allProjects] = await database_1.default.execute('SELECT id, title, images FROM supplier_projects WHERE supplier_profile_id = ? AND is_published = 1 ORDER BY sort_order ASC, id DESC', [profile.id]);
        // 公开去标识：厂家名遮蔽、logo 隐藏；自填的项目标题/简介里若含品牌名(中英)一并遮蔽
        const realName = profile.company_name;
        const maskMentions = (txt) => supplierRedact_1.maskSupplierMentions(supplierRedact_1.maskSupplierMentions(txt, realName), profile.name_zh);
        const maskedProject = { ...project, title: maskMentions(project.title), description: maskMentions(project.description) };
        const maskedAll = (Array.isArray(allProjects) ? allProjects : []).map((p) => ({ ...p, title: maskMentions(p.title) }));
        const redactedSupplier = { ...profile, company_name: supplierRedact_1.maskSupplierName(realName), name_zh: null, logo_url: null };
        res.json({ project: maskedProject, supplier: redactedSupplier, allProjects: maskedAll });
    }
    catch (error) {
        console.error('Get public project error:', error);
        res.status(500).json({ error: 'Failed to load project.' });
    }
}
async function listMyProjects(req, res) {
    try {
        const profile = await getProfile(req.supplierUser.id);
        if (!profile)
            return res.json({ projects: [] });
        const [projects] = await database_1.default.execute('SELECT * FROM supplier_projects WHERE supplier_profile_id = ? ORDER BY sort_order ASC, id DESC', [profile.id]);
        res.json({ projects });
    }
    catch (error) {
        console.error('List supplier projects error:', error);
        res.status(500).json({ error: 'Failed to load projects.' });
    }
}
async function addProject(req, res) {
    try {
        const profile = await getProfile(req.supplierUser.id);
        if (!profile)
            return res.status(400).json({ error: 'Create your profile first.' });
        const { title, description, location, area_sqm, budget, year, images } = req.body;
        if (!title?.trim())
            return res.status(400).json({ error: 'Title is required.' });
        const rawImages = Array.isArray(images) ? images : [];
        // Persist base64 data URLs → local files; pass-through already-local paths
        const persistedImages = rawImages.length > 0
            ? await (0, projectImageStorage_1.persistProjectImages)(rawImages, { designerId: profile.id, projectId: 'new' })
            : [];
        const [result] = await database_1.default.execute(`INSERT INTO supplier_projects
         (supplier_profile_id, title, description, location, area_sqm, budget, year, images, sort_order)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)`, [
            profile.id,
            title.trim(),
            description?.trim() || null,
            location?.trim() || null,
            area_sqm ? Number(area_sqm) : null,
            budget?.trim() || null,
            year?.trim() || null,
            JSON.stringify(persistedImages),
        ]);
        const id = result.insertId;
        const [created] = await database_1.default.execute('SELECT * FROM supplier_projects WHERE id = ?', [id]);
        res.status(201).json({ project: created[0] });
    }
    catch (error) {
        console.error('Add supplier project error:', error);
        res.status(500).json({ error: 'Failed to add project.' });
    }
}
async function updateProject(req, res) {
    try {
        const profile = await getProfile(req.supplierUser.id);
        if (!profile)
            return res.status(403).json({ error: 'Forbidden.' });
        const { id } = req.params;
        const [existing] = await database_1.default.execute('SELECT id FROM supplier_projects WHERE id = ? AND supplier_profile_id = ?', [id, profile.id]);
        if (existing.length === 0)
            return res.status(404).json({ error: 'Project not found.' });
        const { title, description, location, area_sqm, budget, year, images } = req.body;
        if (!title?.trim())
            return res.status(400).json({ error: 'Title is required.' });
        const rawImages = Array.isArray(images) ? images : [];
        const persistedImages = rawImages.length > 0
            ? await (0, projectImageStorage_1.persistProjectImages)(rawImages, { designerId: profile.id, projectId: String(id) })
            : [];
        await database_1.default.execute(`UPDATE supplier_projects
       SET title=?, description=?, location=?, area_sqm=?, budget=?, year=?, images=?
       WHERE id=?`, [
            title.trim(),
            description?.trim() || null,
            location?.trim() || null,
            area_sqm ? Number(area_sqm) : null,
            budget?.trim() || null,
            year?.trim() || null,
            JSON.stringify(persistedImages),
            id,
        ]);
        const [updated] = await database_1.default.execute('SELECT * FROM supplier_projects WHERE id = ?', [id]);
        res.json({ project: updated[0] });
    }
    catch (error) {
        console.error('Update supplier project error:', error);
        res.status(500).json({ error: 'Failed to update project.' });
    }
}
async function deleteProject(req, res) {
    try {
        const profile = await getProfile(req.supplierUser.id);
        if (!profile)
            return res.status(403).json({ error: 'Forbidden.' });
        const { id } = req.params;
        const [existing] = await database_1.default.execute('SELECT id FROM supplier_projects WHERE id = ? AND supplier_profile_id = ?', [id, profile.id]);
        if (existing.length === 0)
            return res.status(404).json({ error: 'Project not found.' });
        await database_1.default.execute('DELETE FROM supplier_projects WHERE id = ?', [id]);
        res.json({ message: 'Project deleted.' });
    }
    catch (error) {
        console.error('Delete supplier project error:', error);
        res.status(500).json({ error: 'Failed to delete project.' });
    }
}
