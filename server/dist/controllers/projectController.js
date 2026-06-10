"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createProject = createProject;
exports.getProjects = getProjects;
exports.getMyProjects = getMyProjects;
exports.getProjectById = getProjectById;
exports.updateProject = updateProject;
exports.deleteProject = deleteProject;
const database_1 = __importDefault(require("../config/database"));
const projectReview_1 = require("../lib/projectReview");
const publicProjectsQuery_1 = require("../lib/publicProjectsQuery");
const parseJsonField_1 = require("../lib/parseJsonField");
const publicDesignerSerialization_1 = require("../lib/publicDesignerSerialization");
const projectPersistence_1 = require("../lib/projectPersistence");
const projectImageStorage_1 = require("../lib/projectImageStorage");
const slugify_1 = require("../lib/slugify");
const tagEngine_1 = require("../services/tagEngine");
const activityLogger_1 = require("../lib/activityLogger");
function normalizeProject(project) {
    return {
        ...project,
        images: (0, parseJsonField_1.parseJsonField)(project.images) || [],
        tags: (0, parseJsonField_1.parseJsonField)(project.tags) || [],
        service_tags: (0, parseJsonField_1.parseJsonField)(project.service_tags) || [],
    };
}
function toSortableTimestamp(value) {
    if (!value) {
        return 0;
    }
    const timestamp = new Date(value).getTime();
    return Number.isNaN(timestamp) ? 0 : timestamp;
}
function compareProjectsNewestFirst(left, right) {
    const updatedDiff = toSortableTimestamp(right.updated_at) - toSortableTimestamp(left.updated_at);
    if (updatedDiff !== 0) {
        return updatedDiff;
    }
    const createdDiff = toSortableTimestamp(right.created_at) - toSortableTimestamp(left.created_at);
    if (createdDiff !== 0) {
        return createdDiff;
    }
    return Number(right.id || 0) - Number(left.id || 0);
}
async function createProject(req, res) {
    try {
        const userId = req.user.userId;
        const { title, description, style, space_type, location, area, year, cost, images, tags, service_tags, status, video_url } = req.body;
        const normalizedImages = (0, projectPersistence_1.assertProjectHasImages)(images);
        const persistedImages = await (0, projectImageStorage_1.persistProjectImages)(normalizedImages, {
            designerId: userId,
        });
        const finalImages = (0, projectPersistence_1.assertProjectHasImages)(persistedImages);
        const projectStatus = status === 'draft'
            ? (0, projectReview_1.getProjectStatusForDesignerSubmit)(false)
            : (0, projectReview_1.getProjectStatusForDesignerSubmit)(true);
        const values = (0, projectPersistence_1.buildProjectPersistenceValues)({
            title,
            description,
            style,
            location,
            area,
            year,
            cost,
            images: finalImages,
            tags,
            service_tags,
            status: projectStatus,
        });
        // Look up company profile for this user
        const [cpRows] = await database_1.default.execute('SELECT id, status FROM company_profiles WHERE user_id = ? LIMIT 1', [userId]);
        const companyProfile = cpRows[0] || null;
        const companyProfileId = companyProfile?.id || null;
        // If the company is already approved, auto-publish the project
        const finalStatus = companyProfile?.status === 'approved' ? 'published' : values.status;
        const [result] = await database_1.default.execute(`INSERT INTO projects (designer_id, company_profile_id, title, description, style, space_type, location, area, year, cost, images, tags, service_tags, status, rejection_reason, video_url)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?)`, [
            null,
            companyProfileId,
            values.title,
            values.description,
            values.style,
            space_type || null,
            values.location,
            values.area,
            values.year,
            values.cost,
            values.images,
            values.tags,
            values.service_tags,
            finalStatus,
            video_url || null,
        ]);
        const projectId = result.insertId;
        // Generate and save slug
        if (title) {
            const slug = (0, slugify_1.slugify)(title);
            await database_1.default.execute('UPDATE projects SET slug = ? WHERE id = ?', [slug, projectId]);
        }
        const [project] = await database_1.default.execute('SELECT * FROM projects WHERE id = ?', [projectId]);
        // Use company profile or user info for notification
        const [cpInfo] = await database_1.default.execute('SELECT cp.company_name as full_name, u.email, cp.phone FROM company_profiles cp JOIN users u ON u.id = cp.user_id WHERE cp.user_id = ? LIMIT 1', [userId]);
        const notificationDesigner = cpInfo[0] || { full_name: 'Unknown', email: req.user.email };
        setImmediate(() => {
            (0, activityLogger_1.logActivity)({
                userId: req.user.userId, userName: notificationDesigner.full_name || '', userRole: 'company',
                action: 'create', targetType: 'project', targetId: projectId, targetName: title || 'Untitled',
                description: `上传了项目「${title || 'Untitled'}」`,
                ip: (0, activityLogger_1.getClientIp)(req),
            }).catch(() => { });
        });
        res.status(201).json({
            message: 'Project submitted successfully.',
            project: normalizeProject(project[0])
        });
        // Fire-and-forget: AI tag images via Google Vision
        (0, tagEngine_1.tagProjectImages)(projectId).catch((err) => console.error('[vision-tagging] Background tagging failed:', err));
    }
    catch (error) {
        if (error instanceof Error && error.message === projectPersistence_1.PROJECT_IMAGES_REQUIRED_ERROR) {
            return res.status(400).json({ error: 'At least one project image is required.' });
        }
        if (error instanceof Error && error.message === projectPersistence_1.BASE64_IMAGES_NOT_ALLOWED_ERROR) {
            return res.status(400).json({ error: 'Image upload must be processed before submission. Please try uploading again.' });
        }
        console.error('Create project error:', error);
        res.status(500).json({ error: 'Failed to submit project. Please try again.' });
    }
}
async function getProjects(req, res) {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const offset = (page - 1) * limit;
        const designer_id = req.query.designer_id;
        const status = 'published';
        let whereClause = `WHERE p.status = ? AND cp.status = 'approved' AND cp.deleted_at IS NULL`;
        const params = [status];
        if (designer_id) {
            whereClause += ' AND p.company_profile_id = ?';
            params.push(designer_id);
        }
        const [countResult] = await database_1.default.execute(`SELECT COUNT(*) as total
       FROM projects p
       INNER JOIN company_profiles cp ON p.company_profile_id = cp.id
       ${whereClause}`, params);
        const total = countResult[0].total;
        const listQuery = (0, publicProjectsQuery_1.buildPublicProjectsListQuery)({
            status,
            companyProfileId: designer_id,
            limit,
            offset,
        });
        const [projects] = await database_1.default.execute(listQuery.sql, listQuery.params);
        res.json({
            projects: projects.map((project) => (0, publicDesignerSerialization_1.sanitizePublicProject)(normalizeProject(project))),
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit)
            }
        });
    }
    catch (error) {
        console.error('Get projects error:', error);
        res.status(500).json({ error: 'Failed to load projects.' });
    }
}
async function getMyProjects(req, res) {
    try {
        const userId = req.user.userId;
        const [projects] = await database_1.default.execute(`SELECT id, title, description, style, location, area, year, cost, images, tags, service_tags, status, rejection_reason, created_at, updated_at
       FROM projects
       WHERE company_profile_id IN (SELECT id FROM company_profiles WHERE user_id = ?)`, [userId]);
        // Avoid sorting large JSON image payloads inside MySQL, which can exhaust sort memory.
        const normalizedProjects = projects
            .sort(compareProjectsNewestFirst)
            .map(normalizeProject);
        res.json({ projects: normalizedProjects });
    }
    catch (error) {
        console.error('Get my projects error:', error);
        res.status(500).json({ error: 'Failed to load your projects.' });
    }
}
async function getProjectById(req, res) {
    try {
        const { id } = req.params;
        const [project] = await database_1.default.execute(`SELECT
         p.id,
         p.title,
         p.description,
         p.style,
         p.location,
         p.area,
         p.year,
         p.cost,
         p.images,
         p.tags,
         p.created_at,
         cp.company_name as designer_name,
         cp.city as designer_city, cp.logo_url as designer_avatar, cp.description as designer_bio
       FROM projects p
       INNER JOIN company_profiles cp ON p.company_profile_id = cp.id
       WHERE p.id = ? AND p.status = 'published' AND cp.status = 'approved'`, [id]);
        if (project.length === 0) {
            return res.status(404).json({ error: 'Project not found.' });
        }
        res.json({
            project: (0, publicDesignerSerialization_1.sanitizePublicProject)(normalizeProject(project[0]))
        });
    }
    catch (error) {
        console.error('Get project error:', error);
        res.status(500).json({ error: 'Failed to load project.' });
    }
}
async function updateProject(req, res) {
    try {
        const { id } = req.params;
        const { title, description, style, space_type, location, area, year, cost, images, tags, service_tags, status, video_url } = req.body;
        const normalizedImages = (0, projectPersistence_1.assertProjectHasImages)(images);
        const persistedImages = await (0, projectImageStorage_1.persistProjectImages)(normalizedImages, {
            designerId: req.user.userId,
            projectId: id,
        });
        const finalImages = (0, projectPersistence_1.assertProjectHasImages)(persistedImages);
        const nextStatus = status === 'draft'
            ? (0, projectReview_1.getProjectStatusForDesignerSubmit)(false)
            : (0, projectReview_1.getProjectStatusForDesignerSubmit)(true);
        const values = (0, projectPersistence_1.buildProjectPersistenceValues)({
            title,
            description,
            style,
            location,
            area,
            year,
            cost,
            images: finalImages,
            tags,
            service_tags,
            status: nextStatus,
        });
        const [project] = await database_1.default.execute('SELECT * FROM projects WHERE id = ?', [id]);
        if (project.length === 0) {
            return res.status(404).json({ error: 'Project not found.' });
        }
        // Permission check: verify user owns this project via company_profiles
        const projectRow = project[0];
        const [ownerCheck] = await database_1.default.execute('SELECT id FROM company_profiles WHERE id = ? AND user_id = ?', [projectRow.company_profile_id, req.user.userId]);
        if (ownerCheck.length === 0) {
            return res.status(403).json({ error: 'You cannot edit another designer\'s project.' });
        }
        await database_1.default.execute(`UPDATE projects
       SET title = ?, description = ?, style = ?, space_type = ?, location = ?, area = ?, year = ?, cost = ?, images = ?, tags = ?, service_tags = ?, status = ?, rejection_reason = NULL, video_url = ?
       WHERE id = ?`, [
            values.title,
            values.description,
            values.style,
            space_type || null,
            values.location,
            values.area,
            values.year,
            values.cost,
            values.images,
            values.tags,
            values.service_tags,
            values.status,
            video_url || null,
            id,
        ]);
        const [updatedProject] = await database_1.default.execute('SELECT * FROM projects WHERE id = ?', [id]);
        setImmediate(() => {
            (0, activityLogger_1.logActivity)({
                userId: req.user.userId, userName: null, userRole: 'company',
                action: 'update', targetType: 'project', targetId: Number(req.params.id), targetName: title || 'Untitled',
                description: `编辑了项目「${title || 'Untitled'}」`,
                ip: (0, activityLogger_1.getClientIp)(req),
            }).catch(() => { });
        });
        res.json({
            message: 'Updated successfully.',
            project: normalizeProject(updatedProject[0])
        });
        // Fire-and-forget: AI tag new images via Google Vision
        (0, tagEngine_1.tagProjectImages)(Number(id)).catch((err) => console.error('[vision-tagging] Background tagging failed:', err));
    }
    catch (error) {
        if (error instanceof Error && error.message === projectPersistence_1.PROJECT_IMAGES_REQUIRED_ERROR) {
            return res.status(400).json({ error: 'At least one project image is required.' });
        }
        if (error instanceof Error && error.message === projectPersistence_1.BASE64_IMAGES_NOT_ALLOWED_ERROR) {
            return res.status(400).json({ error: 'Image upload must be processed before submission. Please try uploading again.' });
        }
        console.error('Update project error:', error);
        res.status(500).json({ error: 'Failed to update project.' });
    }
}
async function deleteProject(req, res) {
    try {
        const { id } = req.params;
        const [project] = await database_1.default.execute('SELECT * FROM projects WHERE id = ?', [id]);
        if (project.length === 0) {
            return res.status(404).json({ error: 'Project not found.' });
        }
        // Permission check: verify user owns this project via company_profiles
        const delProjectRow = project[0];
        const [delOwnerCheck] = await database_1.default.execute('SELECT id FROM company_profiles WHERE id = ? AND user_id = ?', [delProjectRow.company_profile_id, req.user.userId]);
        if (delOwnerCheck.length === 0) {
            return res.status(403).json({ error: 'You cannot delete another designer\'s project.' });
        }
        await database_1.default.execute('DELETE FROM projects WHERE id = ?', [id]);
        setImmediate(() => {
            (0, activityLogger_1.logActivity)({
                userId: req.user.userId, userName: null, userRole: 'company',
                action: 'delete', targetType: 'project', targetId: Number(req.params.id),
                description: '删除了项目',
                ip: (0, activityLogger_1.getClientIp)(req),
            }).catch(() => { });
        });
        res.json({ message: 'Project deleted.' });
    }
    catch (error) {
        console.error('Delete project error:', error);
        res.status(500).json({ error: 'Failed to delete project.' });
    }
}
