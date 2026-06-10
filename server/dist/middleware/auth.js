"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authenticate = authenticate;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const config_1 = __importDefault(require("../config"));
const database_1 = __importDefault(require("../config/database"));
async function authenticate(req, res, next) {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
        return res.status(401).json({ error: 'Authentication token is required.' });
    }
    try {
        const decoded = jsonwebtoken_1.default.verify(token, config_1.default.jwt.secret);
        // New token format: { userId, email, role }
        if (decoded.userId) {
            const [rows] = await database_1.default.execute('SELECT id, email, role, active_role, status FROM users WHERE id = ?', [decoded.userId]);
            const users = rows;
            if (users.length === 0) {
                return res.status(401).json({ error: 'User account not found.' });
            }
            if (users[0].status === 'suspended') {
                return res.status(403).json({ error: 'Account suspended.' });
            }
            req.user = {
                userId: users[0].id,
                id: users[0].id,
                email: users[0].email,
                role: users[0].role,
                active_role: users[0].active_role,
            };
            return next();
        }
        // Legacy token format: { id, email } (designer tokens)
        // These users should re-login to get a new token, but handle gracefully
        if (decoded.id) {
            const [rows] = await database_1.default.execute('SELECT id, email, user_id FROM designers WHERE id = ? AND deleted_at IS NULL', [decoded.id]);
            const designers = rows;
            if (designers.length === 0) {
                return res.status(401).json({ error: 'Account not found. Please log in again.' });
            }
            const designer = designers[0];
            // If designer is linked to a user, use user info
            if (designer.user_id) {
                const [userRows] = await database_1.default.execute('SELECT id, email, role, active_role, status FROM users WHERE id = ?', [designer.user_id]);
                if (userRows.length > 0) {
                    const user = userRows[0];
                    req.user = { userId: user.id, id: user.id, email: user.email, role: user.role, active_role: user.active_role };
                    return next();
                }
            }
            // Unlinked designer — prompt re-login
            return res.status(401).json({ error: 'Please log in again to continue.' });
        }
        return res.status(401).json({ error: 'Invalid authentication token.' });
    }
    catch (error) {
        console.error('Auth middleware error:', error);
        res.status(401).json({ error: 'Invalid authentication token.' });
    }
}
