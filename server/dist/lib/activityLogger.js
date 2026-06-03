"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.logActivity = logActivity;
exports.getClientIp = getClientIp;
const database_1 = __importDefault(require("../config/database"));
async function logActivity(entry) {
    try {
        await database_1.default.execute(`INSERT INTO activity_log (user_id, user_name, user_role, action, target_type, target_id, target_name, description, ip, country, city, metadata)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
            entry.userId, entry.userName, entry.userRole,
            entry.action, entry.targetType, entry.targetId || null,
            entry.targetName || null, entry.description,
            entry.ip || null, entry.country || null, entry.city || null,
            entry.metadata ? JSON.stringify(entry.metadata) : null,
        ]);
    }
    catch (err) {
        console.error('[ActivityLog] Write failed:', err);
    }
}
function getClientIp(req) {
    return req.headers?.['x-forwarded-for']?.split(',')[0]?.trim()
        || req.headers?.['x-real-ip']
        || req.connection?.remoteAddress
        || '';
}
