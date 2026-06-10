"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getDesignersForAdmin = getDesignersForAdmin;
exports.getDesignerDetails = getDesignerDetails;
exports.approveDesigner = approveDesigner;
exports.rejectDesigner = rejectDesigner;
exports.deleteDesigner = deleteDesigner;
exports.restoreDesigner = restoreDesigner;
exports.bulkApproveDesigners = bulkApproveDesigners;
exports.bulkDeleteDesigners = bulkDeleteDesigners;
exports.updateDesignerOrder = updateDesignerOrder;
exports.approveProject = approveProject;
exports.rejectProject = rejectProject;
exports.getRegistrationSources = getRegistrationSources;
exports.getStatsOverview = getStatsOverview;
exports.getActivityLogs = getActivityLogs;
exports.getDailyStatsReport = getDailyStatsReport;
exports.getRegistrationStats = getRegistrationStats;
exports.getRejectionTemplates = getRejectionTemplates;
const database_1 = __importDefault(require("../config/database"));
const adminController_1 = require("./adminController");
const projectReview_1 = require("../lib/projectReview");
const parseJsonField_1 = require("../lib/parseJsonField");
const designerSoftDelete_1 = require("../lib/designerSoftDelete");
const adminDesignersQuery_1 = require("../lib/adminDesignersQuery");
const designerApproval_1 = require("../lib/designerApproval");
const emailService_1 = require("../services/emailService");
// Get all designers with filters and pagination
async function getDesignersForAdmin(req, res) {
    const { status, search, deleted, sortBy = 'created_at', sortOrder = 'DESC', page = 1, limit = 20 } = req.query;
    // Sanitize pagination params
    const safeLimit = Math.min(Math.max(1, parseInt(limit) || 20), 100);
    const safePage = Math.max(1, parseInt(page) || 1);
    const offset = (safePage - 1) * safeLimit;
    const { whereClause, values } = (0, designerSoftDelete_1.buildDesignerAdminWhereClause)({
        status,
        search,
        deleted,
    });
    // Validate sort
    const validSorts = ['created_at', 'full_name', 'email', 'display_order', 'profile_views'];
    const safeSortBy = validSorts.includes(sortBy) ? sortBy : 'created_at';
    const safeSortOrder = sortOrder.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
    try {
        // Get total count
        const [countRows] = await database_1.default.execute(`SELECT COUNT(*) as total FROM designers d ${whereClause}`, values);
        const total = countRows[0].total;
        // Get designers with stats
        const query = (0, adminDesignersQuery_1.buildAdminDesignersListQuery)({
            whereClause,
            safeSortBy,
            safeSortOrder,
            safeLimit,
            offset,
        });
        const [rows] = await database_1.default.execute(query.sql, values);
        res.json({
            designers: rows,
            pagination: {
                total,
                page: safePage,
                limit: safeLimit,
                totalPages: Math.ceil(total / safeLimit)
            }
        });
    }
    catch (error) {
        console.error('Error getting designers:', error);
        res.status(500).json({ error: 'Failed to get designers.' });
    }
}
// Get single designer details
async function getDesignerDetails(req, res) {
    const { id } = req.params;
    try {
        // Get designer
        const [designerRows] = await database_1.default.execute(`SELECT * FROM designers WHERE id = ?`, [id]);
        const designers = designerRows;
        if (designers.length === 0) {
            return res.status(404).json({ error: 'Designer not found.' });
        }
        const designer = designers[0];
        // Get projects
        const [projectRows] = await database_1.default.execute(`SELECT id, title, description, style, location, year, images, tags, status, rejection_reason, created_at, updated_at
       FROM projects WHERE designer_id = ?
       ORDER BY created_at DESC`, [id]);
        // Get stats summary
        const [statsRows] = await database_1.default.execute(`SELECT 
        COALESCE(SUM(profile_views), 0) as total_profile_views,
        COALESCE(SUM(project_views), 0) as total_project_views,
        COALESCE(SUM(contact_clicks), 0) as total_contact_clicks,
        COALESCE(SUM(phone_clicks), 0) as total_phone_clicks,
        COALESCE(SUM(whatsapp_clicks), 0) as total_whatsapp_clicks
       FROM designer_stats WHERE designer_id = ?`, [id]);
        // Get recent activity (last 30 days)
        const [recentStatsRows] = await database_1.default.execute(`SELECT stat_date, profile_views, project_views, contact_clicks, phone_clicks, whatsapp_clicks
       FROM designer_stats 
       WHERE designer_id = ? AND stat_date >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
       ORDER BY stat_date ASC`, [id]);
        res.json({
            designer: sanitizeAdminDesigner(designer),
            projects: projectRows.map(normalizeProject),
            stats: statsRows[0],
            recentStats: recentStatsRows
        });
    }
    catch (error) {
        console.error('Error getting designer details:', error);
        res.status(500).json({ error: 'Failed to get designer details.' });
    }
}
function normalizeProject(project) {
    const parsedImages = (0, parseJsonField_1.parseJsonField)(project.images);
    const parsedTags = (0, parseJsonField_1.parseJsonField)(project.tags);
    return {
        ...project,
        images: Array.isArray(parsedImages)
            ? parsedImages
                .map((item) => {
                if (typeof item === 'string')
                    return item;
                if (item && typeof item === 'object') {
                    if (typeof item.url === 'string')
                        return item.url;
                    if (typeof item.src === 'string')
                        return item.src;
                    if (typeof item.imageUrl === 'string')
                        return item.imageUrl;
                }
                return '';
            })
                .filter(Boolean)
            : [],
        tags: Array.isArray(parsedTags) ? parsedTags.filter((tag) => typeof tag === 'string') : [],
    };
}
function sanitizeAdminDesigner(designer) {
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
        display_order: designer.display_order,
        rejection_reason: designer.rejection_reason,
        deleted_at: designer.deleted_at,
        deleted_by_admin_id: designer.deleted_by_admin_id,
        delete_reason: designer.delete_reason,
        created_at: designer.created_at,
        updated_at: designer.updated_at,
    };
}
// Approve designer
async function approveDesigner(req, res) {
    const { id } = req.params;
    try {
        const [existing] = await database_1.default.execute('SELECT id, full_name, email, status FROM designers WHERE id = ?', [id]);
        const designers = existing;
        if (designers.length === 0) {
            return res.status(404).json({ error: 'Designer not found.' });
        }
        const designer = designers[0];
        if (designer.status === 'approved') {
            return res.status(400).json({ error: 'Designer is already approved.' });
        }
        const conn = await database_1.default.getConnection();
        let autoApprovedProjects = 0;
        try {
            await conn.beginTransaction();
            await conn.execute(`UPDATE designers 
         SET status = 'approved', is_approved = 1, rejection_reason = NULL, updated_at = NOW()
         WHERE id = ?`, [id]);
            const projectUpdate = (0, designerApproval_1.buildAutoPublishPendingProjectsQuery)([Number(id)]);
            const [projectResult] = await conn.execute(projectUpdate.sql, projectUpdate.params);
            autoApprovedProjects = projectResult.affectedRows || 0;
            await conn.commit();
        }
        catch (txError) {
            await conn.rollback();
            throw txError;
        }
        finally {
            conn.release();
        }
        await (0, adminController_1.logActivity)(req.admin.id, 'approve_designer', 'designer', parseInt(id), {
            name: designer.full_name,
            email: designer.email,
            autoApprovedProjects,
        });
        res.json({
            message: 'Designer approved successfully.',
            designer: { id, status: 'approved' },
            autoApprovedProjects,
        });
    }
    catch (error) {
        console.error('Error approving designer:', error);
        res.status(500).json({ error: 'Failed to approve designer.' });
    }
}
// Reject designer
async function rejectDesigner(req, res) {
    const { id } = req.params;
    const { reason } = req.body;
    if (!reason || reason.trim().length === 0) {
        return res.status(400).json({ error: 'Rejection reason is required.' });
    }
    try {
        const [existing] = await database_1.default.execute('SELECT id, full_name, email, status FROM designers WHERE id = ?', [id]);
        const designers = existing;
        if (designers.length === 0) {
            return res.status(404).json({ error: 'Designer not found.' });
        }
        const designer = designers[0];
        if (designer.status === 'rejected') {
            return res.status(400).json({ error: 'Designer is already rejected.' });
        }
        await database_1.default.execute(`UPDATE designers 
       SET status = 'rejected', is_approved = 0, rejection_reason = ?, updated_at = NOW()
       WHERE id = ?`, [reason.trim(), id]);
        await (0, adminController_1.logActivity)(req.admin.id, 'reject_designer', 'designer', parseInt(id), {
            name: designer.full_name,
            email: designer.email,
            reason: reason.trim()
        });
        res.json({
            message: 'Designer rejected.',
            designer: { id, status: 'rejected', rejectionReason: reason.trim() }
        });
    }
    catch (error) {
        console.error('Error rejecting designer:', error);
        res.status(500).json({ error: 'Failed to reject designer.' });
    }
}
async function deleteDesigner(req, res) {
    const { id } = req.params;
    const reason = (0, designerSoftDelete_1.validateDeleteReason)(req.body?.reason);
    if (!reason) {
        return res.status(400).json({ error: 'Delete reason is required.' });
    }
    try {
        const [existing] = await database_1.default.execute('SELECT id, full_name, email, deleted_at FROM designers WHERE id = ?', [id]);
        const designers = existing;
        if (designers.length === 0) {
            return res.status(404).json({ error: 'Designer not found.' });
        }
        const designer = designers[0];
        if (designer.deleted_at) {
            return res.status(400).json({ error: 'Designer is already deleted.' });
        }
        await database_1.default.execute(`UPDATE designers
       SET deleted_at = NOW(), deleted_by_admin_id = ?, delete_reason = ?, updated_at = NOW()
       WHERE id = ?`, [req.admin.id, reason, id]);
        await (0, adminController_1.logActivity)(req.admin.id, 'delete_designer', 'designer', parseInt(id, 10), {
            name: designer.full_name,
            email: designer.email,
            reason,
        });
        res.json({
            message: 'Designer deleted successfully.',
            designer: { id: Number(id), deletedAt: new Date().toISOString(), deleteReason: reason },
        });
    }
    catch (error) {
        console.error('Error deleting designer:', error);
        res.status(500).json({ error: 'Failed to delete designer.' });
    }
}
async function restoreDesigner(req, res) {
    const { id } = req.params;
    try {
        const [existing] = await database_1.default.execute('SELECT id, full_name, email, deleted_at FROM designers WHERE id = ?', [id]);
        const designers = existing;
        if (designers.length === 0) {
            return res.status(404).json({ error: 'Designer not found.' });
        }
        const designer = designers[0];
        if (!designer.deleted_at) {
            return res.status(400).json({ error: 'Designer is not deleted.' });
        }
        await database_1.default.execute(`UPDATE designers
       SET deleted_at = NULL, deleted_by_admin_id = NULL, delete_reason = NULL, updated_at = NOW()
       WHERE id = ?`, [id]);
        await (0, adminController_1.logActivity)(req.admin.id, 'restore_designer', 'designer', parseInt(id, 10), {
            name: designer.full_name,
            email: designer.email,
        });
        res.json({
            message: 'Designer restored successfully.',
            designer: { id: Number(id), deletedAt: null, deleteReason: null },
        });
    }
    catch (error) {
        console.error('Error restoring designer:', error);
        res.status(500).json({ error: 'Failed to restore designer.' });
    }
}
// Bulk approve designers
async function bulkApproveDesigners(req, res) {
    const { designerIds } = req.body;
    if (!designerIds || !Array.isArray(designerIds) || designerIds.length === 0) {
        return res.status(400).json({ error: 'Designer IDs are required.' });
    }
    // Limit batch size to prevent abuse
    const MAX_BATCH = 100;
    if (designerIds.length > MAX_BATCH) {
        return res.status(400).json({ error: `Maximum ${MAX_BATCH} designers can be approved at once.` });
    }
    try {
        const placeholders = designerIds.map(() => '?').join(',');
        const conn = await database_1.default.getConnection();
        let affectedRows = 0;
        let autoApprovedProjects = 0;
        try {
            await conn.beginTransaction();
            const [result] = await conn.execute(`UPDATE designers 
         SET status = 'approved', is_approved = 1, rejection_reason = NULL, updated_at = NOW()
         WHERE id IN (${placeholders}) AND status != 'approved'`, designerIds);
            affectedRows = result.affectedRows || 0;
            const projectUpdate = (0, designerApproval_1.buildAutoPublishPendingProjectsQuery)(designerIds.map((value) => Number(value)));
            const [projectResult] = await conn.execute(projectUpdate.sql, projectUpdate.params);
            autoApprovedProjects = projectResult.affectedRows || 0;
            await conn.commit();
        }
        catch (txError) {
            await conn.rollback();
            throw txError;
        }
        finally {
            conn.release();
        }
        await (0, adminController_1.logActivity)(req.admin.id, 'bulk_approve_designers', 'designer', null, {
            count: affectedRows,
            ids: designerIds,
            autoApprovedProjects,
        });
        res.json({
            message: `${affectedRows} designer(s) approved.`,
            approvedCount: affectedRows,
            autoApprovedProjects,
        });
    }
    catch (error) {
        console.error('Error bulk approving designers:', error);
        res.status(500).json({ error: 'Failed to approve designers.' });
    }
}
async function bulkDeleteDesigners(req, res) {
    const { designerIds } = req.body;
    const reason = (0, designerSoftDelete_1.validateDeleteReason)(req.body?.reason);
    if (!designerIds || !Array.isArray(designerIds) || designerIds.length === 0) {
        return res.status(400).json({ error: 'Designer IDs are required.' });
    }
    if (!reason) {
        return res.status(400).json({ error: 'Delete reason is required.' });
    }
    const MAX_BATCH = 100;
    if (designerIds.length > MAX_BATCH) {
        return res.status(400).json({ error: `Maximum ${MAX_BATCH} designers can be deleted at once.` });
    }
    const normalizedIds = designerIds
        .map((value) => Number(value))
        .filter((value) => Number.isInteger(value) && value > 0);
    if (normalizedIds.length === 0) {
        return res.status(400).json({ error: 'No valid designer IDs provided.' });
    }
    try {
        const placeholders = normalizedIds.map(() => '?').join(',');
        const [result] = await database_1.default.execute(`UPDATE designers
       SET deleted_at = NOW(), deleted_by_admin_id = ?, delete_reason = ?, updated_at = NOW()
       WHERE id IN (${placeholders}) AND deleted_at IS NULL`, [req.admin.id, reason, ...normalizedIds]);
        const deletedCount = result.affectedRows || 0;
        await (0, adminController_1.logActivity)(req.admin.id, 'bulk_delete_designers', 'designer', null, {
            count: deletedCount,
            ids: normalizedIds,
            reason,
        });
        res.json({
            message: `${deletedCount} designer(s) deleted.`,
            deletedCount,
        });
    }
    catch (error) {
        console.error('Error bulk deleting designers:', error);
        res.status(500).json({ error: 'Failed to delete designers.' });
    }
}
// Update display order
async function updateDesignerOrder(req, res) {
    const { orders } = req.body;
    // orders: [{ id: 1, displayOrder: 1 }, { id: 2, displayOrder: 2 }, ...]
    if (!orders || !Array.isArray(orders) || orders.length === 0) {
        return res.status(400).json({ error: 'Orders array is required.' });
    }
    try {
        // Use transaction for atomic update
        const conn = await database_1.default.getConnection();
        await conn.beginTransaction();
        try {
            for (const item of orders) {
                await conn.execute('UPDATE designers SET display_order = ? WHERE id = ?', [item.displayOrder, item.id]);
            }
            await conn.commit();
        }
        catch (err) {
            await conn.rollback();
            throw err;
        }
        finally {
            conn.release();
        }
        await (0, adminController_1.logActivity)(req.admin.id, 'update_designer_order', 'designer', null, {
            count: orders.length
        });
        res.json({ message: 'Display order updated successfully.' });
    }
    catch (error) {
        console.error('Error updating order:', error);
        res.status(500).json({ error: 'Failed to update order.' });
    }
}
async function approveProject(req, res) {
    const { projectId } = req.params;
    try {
        const [rows] = await database_1.default.execute('SELECT id, designer_id, title, status FROM projects WHERE id = ?', [projectId]);
        const projects = rows;
        if (projects.length === 0) {
            return res.status(404).json({ error: 'Project not found.' });
        }
        const project = projects[0];
        if (!(0, projectReview_1.canAdminReviewProject)(project.status)) {
            return res.status(400).json({ error: 'Only pending projects can be approved.' });
        }
        await database_1.default.execute(`UPDATE projects
       SET status = 'published', rejection_reason = NULL, updated_at = NOW()
       WHERE id = ?`, [projectId]);
        await (0, adminController_1.logActivity)(req.admin.id, 'approve_project', 'project', parseInt(projectId, 10), {
            title: project.title,
            designerId: project.designer_id
        });
        res.json({
            message: 'Project approved successfully.',
            project: { id: Number(projectId), status: 'published' }
        });
    }
    catch (error) {
        console.error('Error approving project:', error);
        res.status(500).json({ error: 'Failed to approve project.' });
    }
}
async function rejectProject(req, res) {
    const { projectId } = req.params;
    const { reason } = req.body;
    if (!reason || !reason.trim()) {
        return res.status(400).json({ error: 'Rejection reason is required.' });
    }
    try {
        const [rows] = await database_1.default.execute('SELECT id, designer_id, company_profile_id, title, status FROM projects WHERE id = ?', [projectId]);
        const projects = rows;
        if (projects.length === 0) {
            return res.status(404).json({ error: 'Project not found.' });
        }
        const project = projects[0];
        if (!(0, projectReview_1.canAdminReviewProject)(project.status)) {
            return res.status(400).json({ error: 'Only pending projects can be rejected.' });
        }
        await database_1.default.execute(`UPDATE projects SET status = 'rejected', rejection_reason = ?, updated_at = NOW() WHERE id = ?`, [reason.trim(), projectId]);
        await (0, adminController_1.logActivity)(req.admin.id, 'reject_project', 'project', parseInt(projectId, 10), {
            title: project.title,
            designerId: project.designer_id,
            reason: reason.trim()
        });
        // Fire-and-forget: save template for this admin
        if (req.admin?.id) {
            database_1.default.execute(`INSERT INTO rejection_templates (admin_id, text, use_count, last_used_at)
         VALUES (?, ?, 1, NOW())
         ON DUPLICATE KEY UPDATE use_count = use_count + 1, last_used_at = NOW()`, [req.admin.id, reason.trim()]).catch((err) => console.error('Template save error:', err));
        }
        // Fire-and-forget: send email to company owner (if this is a company project)
        if (project.company_profile_id) {
            (async () => {
                try {
                    const [cpRows] = await database_1.default.execute(`SELECT u.email, cp.company_name
             FROM company_profiles cp
             JOIN users u ON u.id = cp.user_id
             WHERE cp.id = ?`, [project.company_profile_id]);
                    const cp = cpRows[0];
                    if (cp?.email) {
                        const frontendUrl = process.env.FRONTEND_URL || 'https://www.tarmeer.com';
                        const projectListUrl = `${frontendUrl}/company/projects?projectId=${projectId}`;
                        await (0, emailService_1.sendProjectRejectionEmail)(cp.email, cp.company_name || 'Company', project.title, reason.trim(), projectListUrl);
                    }
                }
                catch (emailErr) {
                    console.error('Rejection email error:', emailErr);
                }
            })();
        }
        res.json({
            message: 'Project rejected.',
            project: { id: Number(projectId), status: 'rejected', rejectionReason: reason.trim() }
        });
    }
    catch (error) {
        console.error('Error rejecting project:', error);
        res.status(500).json({ error: 'Failed to reject project.' });
    }
}
// Registration source distribution + company type distribution
async function getRegistrationSources(req, res) {
    try {
        const country = req.query.country;
        const VALID_COUNTRIES = new Set(['ae', 'vn', 'sa']);
        const cValid = country && VALID_COUNTRIES.has(country);
        // User phone prefix conditions (unqualified, for single-table queries on `users`)
        let userPhoneWhere = '';
        const userPhoneParams = [];
        // Qualified with `u.` alias, for queries that JOIN users AS u with another table
        let userPhoneWhereU = '';
        if (cValid) {
            if (country === 'vn') {
                userPhoneWhere = " AND (phone LIKE ? OR phone LIKE ?)";
                userPhoneWhereU = " AND (u.phone LIKE ? OR u.phone LIKE ?)";
                userPhoneParams.push('+84%', '084%');
            } else if (country === 'ae') {
                userPhoneWhere = " AND (phone IS NULL OR (phone NOT LIKE ? AND phone NOT LIKE ?))";
                userPhoneWhereU = " AND (u.phone IS NULL OR (u.phone NOT LIKE ? AND u.phone NOT LIKE ?))";
                userPhoneParams.push('+84%', '084%');
            }
        }
        // Company country conditions
        let cpWhere = 'WHERE deleted_at IS NULL';
        const cpParams = [];
        if (cValid) { cpWhere += ' AND country = ?'; cpParams.push(country); }
        const [sources] = await database_1.default.execute(`SELECT COALESCE(signup_source, 'direct') as source, COUNT(*) as count
       FROM users WHERE deleted_at IS NULL AND role IN ('company', 'homeowner')${userPhoneWhere}
       GROUP BY COALESCE(signup_source, 'direct') ORDER BY count DESC`, userPhoneParams);
        const [types] = await database_1.default.execute(`SELECT COALESCE(company_type, 'unknown') as type, COUNT(*) as count
       FROM company_profiles ${cpWhere}
       GROUP BY COALESCE(company_type, 'unknown') ORDER BY count DESC`, cpParams);
        // City distribution for map
        const [companyCities] = await database_1.default.execute(`SELECT COALESCE(city, 'Unknown') as city, COUNT(*) as count
       FROM company_profiles ${cpWhere} AND city IS NOT NULL AND city != ''
       GROUP BY city ORDER BY count DESC`, cpParams);
        let inqCityWhere = 'WHERE deleted_at IS NULL AND city IS NOT NULL AND city != \'\'';
        const inqCityParams = [];
        if (cValid) {
            if (country === 'vn') { inqCityWhere += " AND company_id IN (SELECT id FROM company_profiles WHERE country = ?)"; inqCityParams.push('vn'); }
            else if (country === 'ae') { inqCityWhere += " AND (company_id IS NULL OR company_id NOT IN (SELECT id FROM company_profiles WHERE country = ?))"; inqCityParams.push('vn'); }
        }
        const [inquiryCities] = await database_1.default.execute(`SELECT COALESCE(city, 'Unknown') as city, COUNT(*) as count
       FROM design_inquiries ${inqCityWhere}
       GROUP BY city ORDER BY count DESC`, inqCityParams);
        const [visitorCities] = await database_1.default.execute(`SELECT COALESCE(location_label, 'Unknown') as city, COUNT(DISTINCT viewer_ip) as count
       FROM visitor_logs WHERE location_label IS NOT NULL AND location_label != ''
       GROUP BY location_label ORDER BY count DESC LIMIT 30`);
        const [homeownerCities] = await database_1.default.execute(`SELECT COALESCE(hp.city, 'Unknown') as city, COUNT(*) as count
       FROM homeowner_profiles hp JOIN users u ON u.id = hp.user_id
       WHERE hp.city IS NOT NULL AND hp.city != ''${userPhoneWhereU}
       GROUP BY hp.city ORDER BY count DESC`, userPhoneParams);
        // Company type × city matrix (top cities per type)
        const [typeCityRows] = await database_1.default.execute(`SELECT COALESCE(company_type, 'unknown') as type,
              COALESCE(city, 'Unknown') as city,
              COUNT(*) as count
       FROM company_profiles
       ${cpWhere} AND company_type IS NOT NULL AND company_type != ''
         AND city IS NOT NULL AND city != ''
       GROUP BY company_type, city
       ORDER BY company_type, count DESC`, cpParams);
        // Aggregate: top 3 cities per type + total count per type
        const typeMap = {};
        for (const row of typeCityRows) {
            if (!typeMap[row.type])
                typeMap[row.type] = { total: 0, cities: [] };
            typeMap[row.type].total += Number(row.count);
            if (typeMap[row.type].cities.length < 3) {
                typeMap[row.type].cities.push({ city: row.city, count: Number(row.count) });
            }
        }
        const companyTypeCities = Object.entries(typeMap)
            .map(([type, d]) => ({ type, count: d.total, topCities: d.cities }))
            .sort((a, b) => b.count - a.count);
        res.json({ signup_sources: sources, company_types: types, company_cities: companyCities, inquiry_cities: inquiryCities, visitor_cities: visitorCities, homeowner_cities: homeownerCities, company_type_cities: companyTypeCities });
    }
    catch (error) {
        console.error('Get registration sources error:', error);
        res.status(500).json({ error: 'Failed to get registration sources.' });
    }
}
// Get designer stats overview
async function getStatsOverview(req, res) {
    const { startDate, endDate } = req.query;
    // Default to last 30 days
    const end = endDate || new Date().toISOString().split('T')[0];
    const start = startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    try {
        // Overview stats
        const [overviewRows] = await database_1.default.execute(`SELECT 
        COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_count,
        COUNT(CASE WHEN status = 'approved' THEN 1 END) as approved_count,
        COUNT(CASE WHEN status = 'rejected' THEN 1 END) as rejected_count,
        COUNT(*) as total_count
       FROM designers`);
        // Daily page views from analytics_events (real data)
        const [dailyStatsRows] = await database_1.default.execute(`SELECT
        DATE(created_at) as stat_date,
        COUNT(*) as profile_views
       FROM analytics_events
       WHERE DATE(created_at) BETWEEN ? AND ?
         AND event_name = 'page_view'
       GROUP BY DATE(created_at)
       ORDER BY stat_date ASC`, [start, end]);
        // Contact interactions from analytics_events (real data)
        const [contactRows] = await database_1.default.execute(`SELECT
        COALESCE(SUM(CASE WHEN event_name = 'click_whatsapp' THEN 1 ELSE 0 END), 0) as whatsapp_clicks,
        COALESCE(SUM(CASE WHEN event_name = 'apply_click' THEN 1 ELSE 0 END), 0) as contact_clicks,
        COALESCE(SUM(CASE WHEN event_name = 'view_designer_profile' THEN 1 ELSE 0 END), 0) as profile_views,
        COALESCE(SUM(CASE WHEN event_name = 'page_view' THEN 1 ELSE 0 END), 0) as page_views
       FROM analytics_events
       WHERE DATE(created_at) BETWEEN ? AND ?`, [start, end]);
        // Visitor count
        const [visitorRows] = await database_1.default.execute(`SELECT COUNT(DISTINCT viewer_ip) as unique_visitors
       FROM analytics_events
       WHERE DATE(created_at) BETWEEN ? AND ?`, [start, end]);
        // Top pages by views
        const [topPagesRows] = await database_1.default.execute(`SELECT
        page_path,
        COUNT(*) as total_views,
        COUNT(DISTINCT viewer_ip) as unique_visitors
       FROM analytics_events
       WHERE event_name = 'page_view'
         AND DATE(created_at) BETWEEN ? AND ?
         AND page_path IS NOT NULL
       GROUP BY page_path
       ORDER BY total_views DESC
       LIMIT 10`, [start, end]);
        const contact = contactRows[0] || {};
        // Top companies by page views (company detail pages)
        const [topCompanyRows] = await database_1.default.execute(`SELECT
        REPLACE(REPLACE(page_path, '/companies/', ''), '?preview=1', '') as company_slug,
        COUNT(*) as views
       FROM analytics_events
       WHERE event_name = 'page_view'
         AND page_path LIKE '/companies/%'
         AND page_path NOT LIKE '/companies?%'
         AND DATE(created_at) BETWEEN ? AND ?
       GROUP BY company_slug
       ORDER BY views DESC
       LIMIT 7`, [start, end]);
        res.json({
            overview: {
                ...overviewRows[0],
                unique_visitors: visitorRows[0]?.unique_visitors || 0,
            },
            dailyStats: dailyStatsRows,
            contactStats: {
                whatsapp_clicks: Number(contact.whatsapp_clicks) || 0,
                contact_clicks: Number(contact.contact_clicks) || 0,
                profile_views: Number(contact.profile_views) || 0,
                page_views: Number(contact.page_views) || 0,
            },
            topDesigners: [],
            topPages: topPagesRows,
            topCompanies: topCompanyRows,
            dateRange: { start, end }
        });
    }
    catch (error) {
        console.error('Error getting stats overview:', error);
        res.status(500).json({ error: 'Failed to get stats.' });
    }
}
// Get activity logs
async function getActivityLogs(req, res) {
    const { page = 1, limit = 50, adminId, action } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    const conditions = [];
    const values = [];
    if (adminId) {
        conditions.push('l.admin_id = ?');
        values.push(adminId);
    }
    if (action) {
        conditions.push('l.action = ?');
        values.push(action);
    }
    const whereClause = conditions.length > 0
        ? 'WHERE ' + conditions.join(' AND ')
        : '';
    try {
        const [rows] = await database_1.default.execute(`SELECT 
        l.id,
        l.action,
        l.target_type,
        l.target_id,
        l.details,
        l.ip_address,
        l.created_at,
        a.email as admin_email,
        a.full_name as admin_name
       FROM admin_activity_logs l
       LEFT JOIN admin_users a ON l.admin_id = a.id
       ${whereClause}
       ORDER BY l.created_at DESC
       LIMIT ${Math.min(parseInt(limit) || 50, 100)} OFFSET ${offset}`, values);
        res.json({ logs: rows });
    }
    catch (error) {
        console.error('Error getting activity logs:', error);
        res.status(500).json({ error: 'Failed to get activity logs.' });
    }
}
async function getDailyStatsReport(req, res) {
    const days = Math.min(parseInt(req.query.days) || 30, 90);
    const country = req.query.country;
    const VALID_COUNTRIES = new Set(['ae', 'vn', 'sa']);
    const cValid = country && VALID_COUNTRIES.has(country);
    // Phone-based user filter
    let userPhoneWhere = '';
    const userPhoneParams = [];
    if (cValid) {
        if (country === 'vn') { userPhoneWhere = " AND (phone LIKE ? OR phone LIKE ?)"; userPhoneParams.push('+84%', '084%'); }
        else if (country === 'ae') { userPhoneWhere = " AND (phone IS NULL OR (phone NOT LIKE ? AND phone NOT LIKE ?))"; userPhoneParams.push('+84%', '084%'); }
    }
    // Company country filter
    let cpCountryWhere = '';
    const cpCountryParams = [];
    if (cValid) { cpCountryWhere = ' AND country = ?'; cpCountryParams.push(country); }
    // Inquiry country filter
    let inqCountryWhere = '';
    const inqCountryParams = [];
    if (cValid) {
        if (country === 'vn') { inqCountryWhere = " AND company_id IN (SELECT id FROM company_profiles WHERE country = ?)"; inqCountryParams.push('vn'); }
        else if (country === 'ae') { inqCountryWhere = " AND (company_id IS NULL OR company_id NOT IN (SELECT id FROM company_profiles WHERE country = ?))"; inqCountryParams.push('vn'); }
    }
    try {
        // Generate a date series for the requested range
        const [dateRows] = await database_1.default.query(`SELECT DATE(DATE_SUB(CURDATE(), INTERVAL seq DAY)) as d
       FROM (SELECT 0 seq UNION SELECT 1 UNION SELECT 2 UNION SELECT 3 UNION SELECT 4
             UNION SELECT 5 UNION SELECT 6 UNION SELECT 7 UNION SELECT 8 UNION SELECT 9
             UNION SELECT 10 UNION SELECT 11 UNION SELECT 12 UNION SELECT 13 UNION SELECT 14
             UNION SELECT 15 UNION SELECT 16 UNION SELECT 17 UNION SELECT 18 UNION SELECT 19
             UNION SELECT 20 UNION SELECT 21 UNION SELECT 22 UNION SELECT 23 UNION SELECT 24
             UNION SELECT 25 UNION SELECT 26 UNION SELECT 27 UNION SELECT 28 UNION SELECT 29
             UNION SELECT 30 UNION SELECT 31 UNION SELECT 32 UNION SELECT 33 UNION SELECT 34
             UNION SELECT 35 UNION SELECT 36 UNION SELECT 37 UNION SELECT 38 UNION SELECT 39
             UNION SELECT 40 UNION SELECT 41 UNION SELECT 42 UNION SELECT 43 UNION SELECT 44
             UNION SELECT 45 UNION SELECT 46 UNION SELECT 47 UNION SELECT 48 UNION SELECT 49
             UNION SELECT 50 UNION SELECT 51 UNION SELECT 52 UNION SELECT 53 UNION SELECT 54
             UNION SELECT 55 UNION SELECT 56 UNION SELECT 57 UNION SELECT 58 UNION SELECT 59
             UNION SELECT 60 UNION SELECT 61 UNION SELECT 62 UNION SELECT 63 UNION SELECT 64
             UNION SELECT 65 UNION SELECT 66 UNION SELECT 67 UNION SELECT 68 UNION SELECT 69
             UNION SELECT 70 UNION SELECT 71 UNION SELECT 72 UNION SELECT 73 UNION SELECT 74
             UNION SELECT 75 UNION SELECT 76 UNION SELECT 77 UNION SELECT 78 UNION SELECT 79
             UNION SELECT 80 UNION SELECT 81 UNION SELECT 82 UNION SELECT 83 UNION SELECT 84
             UNION SELECT 85 UNION SELECT 86 UNION SELECT 87 UNION SELECT 88 UNION SELECT 89) t
       WHERE seq < ${days}
       ORDER BY d ASC`);
        const dates = dateRows.map((r) => r.d instanceof Date ? r.d.toISOString().slice(0, 10) : String(r.d).slice(0, 10));
        // Count queries (homeowners only: role='homeowner' or 'user', not company/designer)
        const [userRows] = await database_1.default.query(`SELECT DATE(created_at) as date, COUNT(*) as count
       FROM users
       WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL ${days} DAY) AND deleted_at IS NULL
         AND role IN ('homeowner', 'user')${userPhoneWhere}
       GROUP BY DATE(created_at)`, userPhoneParams);
        const [companyRows] = await database_1.default.query(`SELECT DATE(created_at) as date, COUNT(*) as count
       FROM company_profiles
       WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL ${days} DAY) AND deleted_at IS NULL${cpCountryWhere}
       GROUP BY DATE(created_at)`, cpCountryParams);
        const [inquiryRows] = await database_1.default.query(`SELECT DATE(created_at) as date, COUNT(*) as count
       FROM design_inquiries
       WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL ${days} DAY)${inqCountryWhere}
       GROUP BY DATE(created_at)`, inqCountryParams);
        const [supplierRows] = await database_1.default.query(`SELECT DATE(created_at) as date, COUNT(*) as count
       FROM supplier_users
       WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL ${days} DAY)
       GROUP BY DATE(created_at)`);
        // Detail queries for tooltip
        const [homeownerDetail] = await database_1.default.query(`SELECT DATE(created_at) as date, full_name, email, city
       FROM users
       WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL ${days} DAY) AND deleted_at IS NULL
         AND role IN ('homeowner', 'user')${userPhoneWhere}
       ORDER BY created_at DESC`, userPhoneParams);
        const [companyDetail] = await database_1.default.query(`SELECT DATE(cp.created_at) as date, cp.company_name, u.email, cp.city,
              (SELECT COUNT(*) FROM projects p WHERE p.company_profile_id = cp.id) as project_count
       FROM company_profiles cp
       LEFT JOIN users u ON cp.user_id = u.id
       WHERE cp.created_at >= DATE_SUB(CURDATE(), INTERVAL ${days} DAY) AND cp.deleted_at IS NULL${cpCountryWhere}
       ORDER BY cp.created_at DESC`, cpCountryParams);
        const [inquiryDetail] = await database_1.default.query(`SELECT DATE(created_at) as date, name, phone, city, source_company_name
       FROM design_inquiries
       WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL ${days} DAY)${inqCountryWhere}
       ORDER BY created_at DESC`, inqCountryParams);
        const toMap = (rows) => {
            const m = {};
            for (const r of rows) {
                const d = r.date instanceof Date ? r.date.toISOString().slice(0, 10) : String(r.date).slice(0, 10);
                m[d] = Number(r.count);
            }
            return m;
        };
        const toDetailMap = (rows) => {
            const m = {};
            for (const r of rows) {
                const d = r.date instanceof Date ? r.date.toISOString().slice(0, 10) : String(r.date).slice(0, 10);
                if (!m[d])
                    m[d] = [];
                m[d].push(r);
            }
            return m;
        };
        const uMap = toMap(userRows);
        const cMap = toMap(companyRows);
        const iMap = toMap(inquiryRows);
        const sMap = toMap(supplierRows);
        const homeownerDetailMap = toDetailMap(homeownerDetail);
        const companyDetailMap = toDetailMap(companyDetail);
        const inquiryDetailMap = toDetailMap(inquiryDetail);
        const data = dates.map((date) => ({
            date,
            new_homeowners: uMap[date] || 0,
            new_companies: cMap[date] || 0,
            new_inquiries: iMap[date] || 0,
            new_suppliers: sMap[date] || 0,
            homeowner_list: (homeownerDetailMap[date] || []).map((r) => ({
                name: r.full_name || r.email?.split('@')[0] || '—',
                email: r.email,
                city: r.city,
            })),
            company_list: (companyDetailMap[date] || []).map((r) => ({
                name: r.company_name || '—',
                email: r.email,
                city: r.city,
                projects: r.project_count || 0,
            })),
            inquiry_list: (inquiryDetailMap[date] || []).map((r) => ({
                name: r.name || '—',
                phone: r.phone,
                city: r.city,
                company: r.source_company_name,
            })),
        }));
        const totals = data.reduce((acc, r) => ({
            new_homeowners: acc.new_homeowners + r.new_homeowners,
            new_companies: acc.new_companies + r.new_companies,
            new_inquiries: acc.new_inquiries + r.new_inquiries,
            new_suppliers: acc.new_suppliers + r.new_suppliers,
        }), { new_homeowners: 0, new_companies: 0, new_inquiries: 0, new_suppliers: 0 });
        res.json({ data, totals, days });
    }
    catch (error) {
        console.error('Daily stats error:', error);
        res.status(500).json({ error: 'Failed to get daily stats.' });
    }
}
async function getRegistrationStats(req, res) {
    const days = Math.min(parseInt(req.query.days) || 30, 90);
    try {
        const [userRows] = await database_1.default.execute(`SELECT DATE(created_at) as date, COUNT(*) as count
       FROM users
       WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL ? DAY) AND deleted_at IS NULL
       GROUP BY DATE(created_at)
       ORDER BY date ASC`, [days]);
        const [companyRows] = await database_1.default.execute(`SELECT DATE(created_at) as date, COUNT(*) as count
       FROM company_profiles
       WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL ? DAY) AND deleted_at IS NULL
       GROUP BY DATE(created_at)
       ORDER BY date ASC`, [days]);
        res.json({ users: userRows, companies: companyRows });
    }
    catch (error) {
        console.error('Registration stats error:', error);
        res.status(500).json({ error: 'Failed to get registration stats.' });
    }
}
// Rejection template history (per admin)
async function getRejectionTemplates(req, res) {
    try {
        const adminId = req.admin?.id;
        if (!adminId)
            return res.status(401).json({ error: 'Unauthorized.' });
        const [rows] = await database_1.default.execute(`SELECT id, text, use_count, last_used_at
       FROM rejection_templates
       WHERE admin_id = ?
       ORDER BY last_used_at DESC
       LIMIT 10`, [adminId]);
        res.json({ templates: rows });
    }
    catch (error) {
        console.error('getRejectionTemplates error:', error);
        res.status(500).json({ error: 'Failed to load templates.' });
    }
}
