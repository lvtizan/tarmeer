"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveLinkedDesigner = resolveLinkedDesigner;
exports.findOrLinkDesignerForUser = findOrLinkDesignerForUser;
const database_1 = __importDefault(require("../config/database"));
function resolveLinkedDesigner(user, linkedByUserId, linkedByEmail) {
    const directMatch = linkedByUserId[0] ?? null;
    if (directMatch) {
        return {
            designer: directMatch,
            shouldLinkByEmail: false,
        };
    }
    const emailMatch = linkedByEmail[0] ?? null;
    if (!emailMatch) {
        return {
            designer: null,
            shouldLinkByEmail: false,
        };
    }
    return {
        designer: {
            ...emailMatch,
            user_id: user.id,
        },
        shouldLinkByEmail: emailMatch.user_id !== user.id,
    };
}
async function findOrLinkDesignerForUser(user) {
    if (!user.email) {
        return null;
    }
    const [linkedRows] = await database_1.default.execute('SELECT id, user_id, email FROM designers WHERE user_id = ? AND deleted_at IS NULL LIMIT 1', [user.id]);
    const [emailRows] = await database_1.default.execute('SELECT id, user_id, email FROM designers WHERE email = ? AND deleted_at IS NULL LIMIT 1', [user.email]);
    const resolution = resolveLinkedDesigner(user, linkedRows, emailRows);
    if (!resolution.designer) {
        // Auto-create a designer row for this user so they can own projects.
        // This is the fix for company users (registered via users table) who submit projects:
        // projects.designer_id has FK to designers.id, so without this row the insert fails.
        const [userRows] = await database_1.default.execute('SELECT full_name FROM users WHERE id = ?', [user.id]);
        const fullName = userRows[0]?.full_name || user.email.split('@')[0] || 'User';
        try {
            const [insertResult] = await database_1.default.execute(`INSERT INTO designers (user_id, email, full_name, status, email_verified)
         VALUES (?, ?, ?, 'approved', 1)`, [user.id, user.email, fullName]);
            const newId = insertResult.insertId;
            return { id: newId, user_id: user.id, email: user.email };
        }
        catch (err) {
            // If email already exists (race or leftover row), fetch and link it
            if (err?.code === 'ER_DUP_ENTRY') {
                const [existing] = await database_1.default.execute('SELECT id FROM designers WHERE email = ? LIMIT 1', [user.email]);
                const existingId = existing[0]?.id;
                if (existingId) {
                    await database_1.default.execute('UPDATE designers SET user_id = ?, deleted_at = NULL WHERE id = ?', [user.id, existingId]);
                    return { id: existingId, user_id: user.id, email: user.email };
                }
            }
            throw err;
        }
    }
    if (resolution.shouldLinkByEmail) {
        await database_1.default.execute('UPDATE designers SET user_id = ? WHERE id = ?', [user.id, resolution.designer.id]);
    }
    return resolution.designer;
}
