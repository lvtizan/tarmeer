"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getDesigners = getDesigners;
exports.getDesignerById = getDesignerById;
exports.updateDesigner = updateDesigner;
const database_1 = __importDefault(require("../config/database"));
const publicDesignerSerialization_1 = require("../lib/publicDesignerSerialization");
const publicDesignersQuery_1 = require("../lib/publicDesignersQuery");
const parseJsonField_1 = require("../lib/parseJsonField");
function normalizeCity(city) {
    if (!city)
        return null;
    return city
        .trim()
        .split(/[\s-]+/)
        .filter(Boolean)
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
        .join(' ');
}
function sanitizePrivateDesigner(designer) {
    return {
        id: designer.id,
        email: designer.email,
        full_name: designer.full_name,
        title: designer.title || '',
        phone: designer.phone,
        city: designer.city,
        address: designer.address,
        bio: designer.bio,
        avatar_url: designer.avatar_url,
        style: designer.style,
        expertise: (0, parseJsonField_1.parseJsonField)(designer.expertise) || [],
        status: designer.status,
        is_approved: designer.is_approved,
        email_verified: designer.email_verified,
        display_order: designer.display_order,
        created_at: designer.created_at,
        updated_at: designer.updated_at,
    };
}
async function getDesigners(req, res) {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const offset = (page - 1) * limit;
        const whereClause = `WHERE status = 'approved' AND is_approved = 1 AND deleted_at IS NULL`;
        const params = [];
        const [countResult] = await database_1.default.execute(`SELECT COUNT(*) as total FROM designers ${whereClause}`, params);
        const total = countResult[0].total;
        const listQuery = (0, publicDesignersQuery_1.buildPublicDesignersListQuery)({
            limit,
            offset,
        });
        const [designers] = await database_1.default.execute(listQuery.sql, listQuery.params);
        res.json({
            designers: designers.map(publicDesignerSerialization_1.sanitizePublicDesigner),
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit)
            }
        });
    }
    catch (error) {
        console.error('Get designers error:', error);
        res.status(500).json({ error: 'Failed to load designers.' });
    }
}
async function getDesignerById(req, res) {
    try {
        const { id } = req.params;
        const [designer] = await database_1.default.execute(`SELECT
         id,
         full_name,
         title,
         city,
         bio,
         avatar_url,
         style,
         expertise,
         display_order,
         created_at,
         (SELECT COUNT(*) FROM projects p WHERE p.designer_id = designers.id AND p.status = 'published') as project_count,
         (SELECT images FROM projects p WHERE p.designer_id = designers.id AND p.status = 'published' ORDER BY p.created_at DESC LIMIT 1) as featured_project_images
       FROM designers WHERE id = ? AND status = 'approved' AND is_approved = 1 AND deleted_at IS NULL`, [id]);
        if (designer.length === 0) {
            return res.status(404).json({ error: 'Designer not found.' });
        }
        const [projects] = await database_1.default.execute(`SELECT id, title, description, style, location, area, year, cost, images, tags, status, created_at 
       FROM projects WHERE designer_id = ? AND status = 'published' 
       ORDER BY created_at DESC`, [id]);
        const designerRecord = designer[0];
        res.json({
            designer: (0, publicDesignerSerialization_1.sanitizePublicDesigner)(designerRecord),
            projects: projects.map((project) => (0, publicDesignerSerialization_1.sanitizePublicProject)({
                ...project,
                designer_name: designerRecord.full_name,
                designer_city: designerRecord.city,
                designer_avatar: designerRecord.avatar_url,
                designer_bio: designerRecord.bio,
            }))
        });
    }
    catch (error) {
        console.error('Get designer error:', error);
        res.status(500).json({ error: 'Failed to load designer.' });
    }
}
async function updateDesigner(req, res) {
    try {
        const { id } = req.params;
        const { full_name, title, phone, city, address, bio, avatar_url, style, expertise } = req.body;
        const requestedDesignerId = parseInt(id, 10);
        console.log('=== UPDATE DESIGNER ===');
        console.log('Designer ID:', id);
        console.log('User ID:', req.user.id);
        console.log('Request body keys:', Object.keys(req.body));
        console.log('Avatar URL length:', avatar_url?.length || 0);
        console.log('Avatar URL preview:', avatar_url?.substring(0, 100) || 'none');
        if (req.user.id !== requestedDesignerId) {
            return res.status(403).json({ error: 'You cannot edit another designer\'s profile.' });
        }
        let effectiveDesignerId = requestedDesignerId;
        let [existingRows] = await database_1.default.execute('SELECT * FROM designers WHERE id = ? AND deleted_at IS NULL', [effectiveDesignerId]);
        if (existingRows.length === 0) {
            // Try to find designer linked to this user's company profile
            const [cpRows] = await database_1.default.execute('SELECT id FROM company_profiles WHERE user_id = ? LIMIT 1', [req.user.userId]);
            if (cpRows.length === 0) {
                return res.status(404).json({ error: 'Designer not found.' });
            }
            // Look for a designer row linked to this user
            const [linkedRows] = await database_1.default.execute('SELECT * FROM designers WHERE user_id = ? AND deleted_at IS NULL LIMIT 1', [req.user.userId]);
            if (linkedRows.length === 0) {
                return res.status(404).json({ error: 'Designer not found.' });
            }
            effectiveDesignerId = linkedRows[0].id;
            existingRows = linkedRows;
        }
        const existing = existingRows[0];
        await database_1.default.execute(`UPDATE designers 
       SET full_name = ?, title = ?, phone = ?, city = ?, address = ?, bio = ?, avatar_url = ?, style = ?, expertise = ?
       WHERE id = ?`, [
            full_name ?? existing.full_name,
            title ?? existing.title,
            phone ?? existing.phone,
            normalizeCity(city) ?? existing.city,
            address ?? existing.address,
            bio ?? existing.bio,
            avatar_url ?? existing.avatar_url,
            style ?? existing.style,
            JSON.stringify(expertise ?? (0, parseJsonField_1.parseJsonField)(existing.expertise) ?? []),
            effectiveDesignerId,
        ]);
        const [designer] = await database_1.default.execute('SELECT * FROM designers WHERE id = ?', [effectiveDesignerId]);
        res.json({
            message: 'Updated successfully.',
            designer: sanitizePrivateDesigner(designer[0])
        });
    }
    catch (error) {
        console.error('Update designer error:', error);
        const errMsg = error instanceof Error ? error.message : String(error);
        // 数据包过大（通常是头像 base64 超出 MySQL 字段或请求体限制）
        if (errMsg.includes('too large') || errMsg.includes('ER_DATA_TOO_LONG') || errMsg.includes('ECONNRESET')) {
            res.status(413).json({ error: 'Profile photo is too large. Please choose a smaller image and try again.' });
            return;
        }
        res.status(500).json({ error: `Failed to save profile: ${errMsg}` });
    }
}
