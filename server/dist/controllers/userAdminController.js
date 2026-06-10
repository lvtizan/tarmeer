"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.listUsers = listUsers;
exports.getUserDetail = getUserDetail;
exports.updateUserStatus = updateUserStatus;
exports.updateUserRole = updateUserRole;
exports.editUser = editUser;
exports.getUserPermissions = getUserPermissions;
exports.updateUserPermissions = updateUserPermissions;
exports.forceVerifyUserEmail = forceVerifyUserEmail;
exports.deleteUser = deleteUser;
exports.restoreUser = restoreUser;
const database_1 = __importDefault(require("../config/database"));
const adminController_1 = require("./adminController");
const pendingActions = require("../lib/pendingActions");
// List users with pagination, filters, search
async function listUsers(req, res) {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const offset = (page - 1) * limit;
        const { role, status, search } = req.query;
        let where = 'WHERE deleted_at IS NULL';
        const params = [];
        if (role) {
            where += ' AND role = ?';
            params.push(role);
        }
        else {
            where += " AND role != 'company'";
        }
        if (status) {
            where += ' AND status = ?';
            params.push(status);
        }
        if (search) {
            where += ' AND (full_name LIKE ? OR email LIKE ?)';
            params.push(`%${search}%`, `%${search}%`);
        }
        const country = req.query.country;
        const VALID_COUNTRIES = new Set(['ae', 'vn', 'sa']);
        if (country && VALID_COUNTRIES.has(country)) {
            if (country === 'vn') {
                where += " AND (phone LIKE ? OR phone LIKE ?)";
                params.push('+84%', '084%');
            } else if (country === 'ae') {
                where += " AND (phone IS NULL OR (phone NOT LIKE ? AND phone NOT LIKE ?))";
                params.push('+84%', '084%');
            }
        }
        const [countRows] = await database_1.default.execute(`SELECT COUNT(*) as total FROM users ${where}`, params);
        const total = countRows[0].total;
        const [rows] = await database_1.default.execute(`SELECT id, email, full_name, phone, city, avatar_url, role, status, email_verified, created_at, updated_at
       FROM users ${where}
       ORDER BY created_at DESC
       LIMIT ${Number(limit)} OFFSET ${Number(offset)}`, params);
        res.json({
            users: rows,
            pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
        });
    }
    catch (error) {
        console.error('List users error:', error);
        res.status(500).json({ error: 'Failed to list users.' });
    }
}
// Get user detail with linked designer/company info
async function getUserDetail(req, res) {
    try {
        const { id } = req.params;
        const [userRows] = await database_1.default.execute('SELECT id, email, full_name, phone, city, avatar_url, role, status, email_verified, created_at, updated_at FROM users WHERE id = ?', [id]);
        if (userRows.length === 0) {
            return res.status(404).json({ error: 'User not found.' });
        }
        const user = userRows[0];
        // Get linked designer
        const [designerRows] = await database_1.default.execute('SELECT id, full_name, status, is_approved, bio, style, city, avatar_url, created_at FROM designers WHERE user_id = ? AND deleted_at IS NULL', [id]);
        const designer = designerRows[0] || null;
        // Get designer's projects if linked
        let projects = [];
        if (designer) {
            const [projectRows] = await database_1.default.execute('SELECT id, title, description, style, location, year, images, tags, status, rejection_reason, created_at, updated_at FROM projects WHERE designer_id = ? ORDER BY created_at DESC', [designer.id]);
            projects = projectRows.map((p) => {
                let parsedImages = p.images;
                if (typeof parsedImages === 'string') {
                    try {
                        parsedImages = JSON.parse(parsedImages);
                    }
                    catch {
                        parsedImages = [];
                    }
                }
                const normalizedImages = Array.isArray(parsedImages)
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
                    : [];
                return { ...p, images: normalizedImages };
            });
        }
        // Get linked company
        const [companyRows] = await database_1.default.execute('SELECT id, slug, city FROM uae_companies WHERE owner_user_id = ?', [id]);
        // Get company applications
        const [appRows] = await database_1.default.execute('SELECT id, company_name, status, created_at FROM company_applications WHERE user_id = ? ORDER BY created_at DESC', [id]);
        res.json({
            user,
            designer,
            projects,
            company: companyRows[0] || null,
            companyApplications: appRows,
        });
    }
    catch (error) {
        console.error('Get user detail error:', error);
        res.status(500).json({ error: 'Failed to get user.' });
    }
}
// Update user status (activate/suspend)
async function updateUserStatus(req, res) {
    try {
        const { id } = req.params;
        const { status } = req.body;
        if (!['active', 'suspended'].includes(status)) {
            return res.status(400).json({ error: 'Invalid status. Must be active or suspended.' });
        }
        await database_1.default.execute('UPDATE users SET status = ? WHERE id = ?', [status, id]);
        res.json({ message: `User ${status === 'active' ? 'activated' : 'suspended'}.` });
    }
    catch (error) {
        console.error('Update user status error:', error);
        res.status(500).json({ error: 'Failed to update status.' });
    }
}
// Update user role
async function updateUserRole(req, res) {
    try {
        const { id } = req.params;
        const { role } = req.body;
        if (!['user', 'designer', 'company'].includes(role)) {
            return res.status(400).json({ error: 'Invalid role.' });
        }
        await database_1.default.execute('UPDATE users SET role = ? WHERE id = ?', [role, id]);
        res.json({ message: `User role updated to ${role}.` });
    }
    catch (error) {
        console.error('Update user role error:', error);
        res.status(500).json({ error: 'Failed to update role.' });
    }
}
// Edit user profile fields
async function editUser(req, res) {
    try {
        const { id } = req.params;
        const { full_name, phone, city, email } = req.body;
        const userId = Number(id);
        if (!Number.isFinite(userId) || userId <= 0) {
            return res.status(400).json({ error: 'Invalid user id.' });
        }
        const [rows] = await database_1.default.execute('SELECT id FROM users WHERE id = ?', [userId]);
        if (rows.length === 0) {
            return res.status(404).json({ error: 'User not found.' });
        }
        // Build dynamic update
        const updates = [];
        const params = [];
        if (full_name !== undefined) {
            updates.push('full_name = ?');
            params.push(String(full_name).trim());
        }
        if (phone !== undefined) {
            updates.push('phone = ?');
            params.push(String(phone).trim() || null);
        }
        if (city !== undefined) {
            updates.push('city = ?');
            params.push(String(city).trim() || null);
        }
        if (email !== undefined) {
            const trimmedEmail = String(email).trim().toLowerCase();
            if (!trimmedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
                return res.status(400).json({ error: 'Invalid email format.' });
            }
            // Check uniqueness
            const [existing] = await database_1.default.execute('SELECT id FROM users WHERE email = ? AND id != ?', [trimmedEmail, userId]);
            if (existing.length > 0) {
                return res.status(400).json({ error: 'Email already in use by another user.' });
            }
            updates.push('email = ?');
            params.push(trimmedEmail);
        }
        if (updates.length === 0) {
            return res.status(400).json({ error: 'No fields to update.' });
        }
        params.push(userId);
        await database_1.default.execute(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`, params);
        const adminId = req.admin?.id;
        await (0, adminController_1.logActivity)(adminId, 'edit_user', 'user', userId, { updated_fields: updates.map(u => u.split(' = ')[0]) });
        res.json({ message: 'User updated successfully.' });
    }
    catch (error) {
        console.error('Edit user error:', error);
        res.status(500).json({ error: 'Failed to update user.' });
    }
}
const AVAILABLE_PERMISSIONS = [
    'manage_projects',
    'manage_company',
    'view_analytics',
    'manage_inquiries',
    'manage_users',
    'import_companies',
    'manage_complaints',
    'export_data',
];
// Get user permissions
async function getUserPermissions(req, res) {
    try {
        const { id } = req.params;
        const userId = Number(id);
        if (!Number.isFinite(userId) || userId <= 0) {
            return res.status(400).json({ error: 'Invalid user id.' });
        }
        const [rows] = await database_1.default.execute('SELECT id, permissions FROM users WHERE id = ? AND deleted_at IS NULL LIMIT 1', [userId]);
        const user = rows[0];
        if (!user)
            return res.status(404).json({ error: 'User not found.' });
        let permissions = [];
        if (user.permissions) {
            try {
                permissions = typeof user.permissions === 'string'
                    ? JSON.parse(user.permissions)
                    : user.permissions;
                if (!Array.isArray(permissions))
                    permissions = [];
            }
            catch {
                permissions = [];
            }
        }
        res.json({ permissions, available: AVAILABLE_PERMISSIONS });
    }
    catch (error) {
        console.error('Get user permissions error:', error);
        res.status(500).json({ error: 'Failed to get permissions.' });
    }
}
// Update user permissions
async function updateUserPermissions(req, res) {
    try {
        const { id } = req.params;
        const userId = Number(id);
        if (!Number.isFinite(userId) || userId <= 0) {
            return res.status(400).json({ error: 'Invalid user id.' });
        }
        const { permissions } = req.body;
        if (!Array.isArray(permissions)) {
            return res.status(400).json({ error: 'permissions must be an array.' });
        }
        // Filter to only known permissions
        const filtered = permissions.filter((p) => typeof p === 'string' && AVAILABLE_PERMISSIONS.includes(p));
        const [rows] = await database_1.default.execute('SELECT id FROM users WHERE id = ? AND deleted_at IS NULL LIMIT 1', [userId]);
        if (rows.length === 0)
            return res.status(404).json({ error: 'User not found.' });
        await database_1.default.execute('UPDATE users SET permissions = ? WHERE id = ?', [JSON.stringify(filtered), userId]);
        await (0, adminController_1.logActivity)(req.admin?.id, 'update_user_permissions', 'user', userId, { permissions: filtered });
        res.json({ message: 'Permissions updated.', permissions: filtered });
    }
    catch (error) {
        console.error('Update user permissions error:', error);
        res.status(500).json({ error: 'Failed to update permissions.' });
    }
}
// Force verify user email (admin override)
async function forceVerifyUserEmail(req, res) {
    try {
        const { id } = req.params;
        const userId = Number(id);
        if (!Number.isFinite(userId) || userId <= 0) {
            return res.status(400).json({ error: 'Invalid user id.' });
        }
        const [rows] = await database_1.default.execute('SELECT id, email, email_verified FROM users WHERE id = ? AND deleted_at IS NULL LIMIT 1', [userId]);
        const user = rows[0];
        if (!user)
            return res.status(404).json({ error: 'User not found.' });
        if (user.email_verified)
            return res.json({ message: 'Email already verified.' });
        await database_1.default.execute('UPDATE users SET email_verified = TRUE, verification_token = NULL, verification_token_expires = NULL WHERE id = ?', [userId]);
        // Apply carried-over signup actions (e.g. create_company_profile) just like normal verification
        await pendingActions.applyAll(userId).catch(() => { });
        await (0, adminController_1.logActivity)(req.admin?.id, 'force_verify_email', 'user', userId, { email: user.email });
        res.json({ message: 'Email verified successfully.' });
    }
    catch (error) {
        console.error('Force verify email error:', error);
        res.status(500).json({ error: 'Failed to verify email.' });
    }
}
function normalizeDeleteReason(rawReason) {
    if (typeof rawReason !== 'string')
        return null;
    const trimmed = rawReason.trim();
    if (!trimmed)
        return null;
    if (trimmed.length > 500)
        return trimmed.slice(0, 500);
    return trimmed;
}
// Hard delete user and all associated data
async function deleteUser(req, res) {
    try {
        const { id } = req.params;
        const adminId = req.admin?.id;
        const reason = normalizeDeleteReason(req.body?.reason);
        if (!reason) {
            return res.status(400).json({ error: 'Delete reason is required.' });
        }
        const userId = Number(id);
        if (!Number.isFinite(userId) || userId <= 0) {
            return res.status(400).json({ error: 'Invalid user id.' });
        }
        if (adminId === userId) {
            return res.status(400).json({ error: 'You cannot delete your own account.' });
        }
        const [rows] = await database_1.default.execute('SELECT id, email, full_name FROM users WHERE id = ? LIMIT 1', [userId]);
        const user = rows[0];
        if (!user)
            return res.status(404).json({ error: 'User not found.' });
        // Log before deletion (so audit trail is preserved)
        await (0, adminController_1.logActivity)(adminId, 'delete_user', 'user', userId, {
            email: user.email,
            full_name: user.full_name,
            reason,
        });
        // Hard delete all associated data — order matters to avoid FK constraint errors
        // 1. Projects linked to this user's company profiles
        await database_1.default.execute('DELETE FROM projects WHERE company_profile_id IN (SELECT id FROM company_profiles WHERE user_id = ?)', [userId]);
        // 2. Articles linked to company profiles
        await database_1.default.execute('DELETE FROM articles WHERE company_profile_id IN (SELECT id FROM company_profiles WHERE user_id = ?)', [userId]);
        // 3. Profile tables
        await database_1.default.execute('DELETE FROM company_profiles WHERE user_id = ?', [userId]);
        await database_1.default.execute('DELETE FROM homeowner_profiles WHERE user_id = ?', [userId]);
        // 4. Designer rows (auto-created by auth middleware)
        await database_1.default.execute('DELETE FROM designers WHERE user_id = ?', [userId]);
        // 5. Other associated data
        await database_1.default.execute('DELETE FROM company_applications WHERE user_id = ?', [userId]);
        await database_1.default.execute('DELETE FROM notifications WHERE user_id = ?', [userId]);
        await database_1.default.execute('DELETE FROM design_inquiries WHERE user_id = ?', [userId]);
        // 6. Unlink directory companies
        await database_1.default.execute('UPDATE uae_companies SET owner_user_id = NULL WHERE owner_user_id = ?', [userId]);
        // 7. Delete user last
        await database_1.default.execute('DELETE FROM users WHERE id = ?', [userId]);
        res.json({ message: 'User deleted successfully.' });
    }
    catch (error) {
        console.error('Delete user error:', error);
        res.status(500).json({ error: 'Failed to delete user.' });
    }
}
// Restore soft deleted user
async function restoreUser(req, res) {
    try {
        const { id } = req.params;
        const adminId = req.admin?.id;
        const userId = Number(id);
        if (!Number.isFinite(userId) || userId <= 0) {
            return res.status(400).json({ error: 'Invalid user id.' });
        }
        const [rows] = await database_1.default.execute('SELECT id, email, full_name, deleted_at FROM users WHERE id = ? LIMIT 1', [userId]);
        const user = rows[0];
        if (!user)
            return res.status(404).json({ error: 'User not found.' });
        if (!user.deleted_at)
            return res.status(400).json({ error: 'User is not deleted.' });
        await database_1.default.execute(`UPDATE users
       SET deleted_at = NULL, deleted_by_admin_id = NULL, delete_reason = NULL
       WHERE id = ?`, [userId]);
        await (0, adminController_1.logActivity)(adminId, 'restore_user', 'user', userId, {
            email: user.email,
            full_name: user.full_name,
        });
        res.json({ message: 'User restored successfully.' });
    }
    catch (error) {
        console.error('Restore user error:', error);
        res.status(500).json({ error: 'Failed to restore user.' });
    }
}
