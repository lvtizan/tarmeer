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
async function getProfile(supplierUserId) {
    const [rows] = await database_1.default.execute('SELECT id, slug FROM supplier_profiles WHERE supplier_user_id = ? LIMIT 1', [supplierUserId]);
    return rows[0] || null;
}
async function listPublicProjects(req, res) {
    try {
        const { slug } = req.params;
        const [profiles] = await database_1.default.execute("SELECT id FROM supplier_profiles WHERE slug = ? AND status = 'approved'", [slug]);
        const profile = profiles[0];
        if (!profile)
            return res.status(404).json({ error: 'Supplier not found.' });
        const [projects] = await database_1.default.execute('SELECT * FROM supplier_projects WHERE supplier_profile_id = ? AND is_published = 1 ORDER BY sort_order ASC, id DESC', [profile.id]);
        res.json({ projects });
    }
    catch (error) {
        console.error('List public projects error:', error);
        res.status(500).json({ error: 'Failed to load projects.' });
    }
}
async function getPublicProject(req, res) {
    try {
        const { slug, id } = req.params;
        const [profiles] = await database_1.default.execute("SELECT id, company_name, slug, logo_url FROM supplier_profiles WHERE slug = ? AND status = 'approved'", [slug]);
        const profile = profiles[0];
        if (!profile)
            return res.status(404).json({ error: 'Supplier not found.' });
        const [rows] = await database_1.default.execute('SELECT * FROM supplier_projects WHERE id = ? AND supplier_profile_id = ? AND is_published = 1', [id, profile.id]);
        const project = rows[0];
        if (!project)
            return res.status(404).json({ error: 'Project not found.' });
        const [allProjects] = await database_1.default.execute('SELECT id, title, images FROM supplier_projects WHERE supplier_profile_id = ? AND is_published = 1 ORDER BY sort_order ASC, id DESC', [profile.id]);
        res.json({ project, supplier: profile, allProjects });
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
