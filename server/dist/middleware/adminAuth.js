"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authenticateAdmin = authenticateAdmin;
exports.requireAdmin = requireAdmin;
exports.requireSuperAdmin = requireSuperAdmin;
exports.requireFieldOrSuperAdmin = requireFieldOrSuperAdmin;
exports.blockFieldStaff = blockFieldStaff;
exports.requirePermission = requirePermission;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const config_1 = __importDefault(require("../config"));
const database_1 = __importDefault(require("../config/database"));
function authenticateAdmin(req, res, next) {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
        return res.status(401).json({ error: 'Authentication token is required.' });
    }
    try {
        // Verify token with admin-specific payload structure
        const decoded = jsonwebtoken_1.default.verify(token, config_1.default.jwt.secret);
        // Check if this is an admin token (not a designer token)
        if (!decoded.adminId || decoded.type !== 'admin') {
            return res.status(401).json({ error: 'Invalid token type. Admin access required.' });
        }
        req.adminId = decoded.adminId;
        next();
    }
    catch (error) {
        res.status(401).json({ error: 'Invalid authentication token.' });
    }
}
async function requireAdmin(req, res, next) {
    if (!req.adminId) {
        return res.status(401).json({ error: 'Admin ID not found in token.' });
    }
    try {
        const [rows] = await database_1.default.execute('SELECT id, email, full_name, role, permissions, is_active, country FROM admin_users WHERE id = ?', [req.adminId]);
        const admins = rows;
        if (admins.length === 0) {
            return res.status(401).json({ error: 'Admin not found.' });
        }
        const admin = admins[0];
        if (!admin.is_active) {
            return res.status(403).json({ error: 'Admin account is deactivated.' });
        }
        req.admin = admin;
        next();
    }
    catch (error) {
        console.error('Error fetching admin:', error);
        res.status(500).json({ error: 'Internal server error.' });
    }
}
function requireSuperAdmin(req, res, next) {
    if (!req.admin) {
        return res.status(401).json({ error: 'Admin not authenticated.' });
    }
    if (req.admin.role !== 'super_admin') {
        return res.status(403).json({ error: 'Super admin privileges required.' });
    }
    next();
}
/** Allows field_staff OR super_admin. Blocks sub_admin. */
function requireFieldOrSuperAdmin(req, res, next) {
    if (!req.admin) {
        return res.status(401).json({ error: 'Admin not authenticated.' });
    }
    if (req.admin.role !== 'super_admin' && req.admin.role !== 'field_staff') {
        return res.status(403).json({ error: 'Field staff or super admin access required.' });
    }
    next();
}
/** Blocks field_staff from accessing super admin routes. */
function blockFieldStaff(req, res, next) {
    if (req.admin?.role === 'field_staff') {
        return res.status(403).json({ error: 'Field staff cannot access this endpoint.' });
    }
    next();
}
function requirePermission(permission) {
    return (req, res, next) => {
        if (!req.admin) {
            return res.status(401).json({ error: 'Admin not authenticated.' });
        }
        // Super admin has all permissions
        if (req.admin.role === 'super_admin') {
            return next();
        }
        // Check specific permission for sub-admin
        const permissions = req.admin.permissions || {};
        if (!permissions[permission]) {
            return res.status(403).json({
                error: `You don't have permission: ${permission}`
            });
        }
        next();
    };
}
