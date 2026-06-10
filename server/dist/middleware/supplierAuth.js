"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authenticateSupplier = authenticateSupplier;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const config_1 = __importDefault(require("../config"));
const database_1 = __importDefault(require("../config/database"));
async function authenticateSupplier(req, res, next) {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
        return res.status(401).json({ error: 'Authentication token is required.' });
    }
    try {
        const decoded = jsonwebtoken_1.default.verify(token, config_1.default.jwt.secret);
        if (!decoded.supplierUserId) {
            return res.status(401).json({ error: 'Invalid supplier token.' });
        }
        const [rows] = await database_1.default.execute('SELECT id, email, full_name FROM supplier_users WHERE id = ?', [decoded.supplierUserId]);
        const users = rows;
        if (users.length === 0) {
            return res.status(401).json({ error: 'Supplier account not found.' });
        }
        req.supplierUser = {
            id: users[0].id,
            email: users[0].email,
            full_name: users[0].full_name,
        };
        next();
    }
    catch {
        res.status(401).json({ error: 'Invalid authentication token.' });
    }
}
