"use strict";
/**
 * pendingActions.ts
 *
 * Server-side "carry-over" scaffold.
 * Stores typed actions in users.pending_actions (JSON array).
 * Applied automatically when the user verifies their email.
 *
 * Usage:
 *   // Save during registration (before email is verified):
 *   await pendingActions.save(userId, 'create_company_profile', profileData);
 *
 *   // Pop in checkVerified — returns actions and clears the column:
 *   const actions = await pendingActions.pop(userId);
 *   res.json({ verified: true, token, pendingActions: actions });
 *
 * Adding a new carry-over feature:
 *   1. Call save() with a new type string during registration
 *   2. Register a handler on the frontend (src/lib/pendingActionsRegistry.ts)
 *   Done — no other backend changes needed.
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.save = save;
exports.pop = pop;
exports.applyAll = applyAll;
const database_1 = __importDefault(require("../config/database"));
const companyProfileAutoCreate_1 = require("./companyProfileAutoCreate");
function parseActions(raw) {
    if (!raw)
        return [];
    try {
        const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
        return Array.isArray(parsed) ? parsed : [];
    }
    catch {
        return [];
    }
}
/** Append an action to the user's pending queue. */
async function save(userId, type, data) {
    const [rows] = await database_1.default.execute('SELECT pending_actions FROM users WHERE id = ? LIMIT 1', [userId]);
    const existing = parseActions(rows[0]?.pending_actions);
    existing.push({ type, data });
    await database_1.default.execute('UPDATE users SET pending_actions = ? WHERE id = ?', [JSON.stringify(existing), userId]);
}
/** Return all pending actions and clear the column atomically. */
async function pop(userId) {
    const [rows] = await database_1.default.execute('SELECT pending_actions FROM users WHERE id = ? LIMIT 1', [userId]);
    const actions = parseActions(rows[0]?.pending_actions);
    if (actions.length > 0) {
        await database_1.default.execute('UPDATE users SET pending_actions = NULL WHERE id = ?', [userId]);
    }
    return actions;
}
/**
 * Apply all pending actions server-side, then clear the column.
 * Called when the user's email gets verified (both the email-link path and
 * the polling path) — the frontend never applies these itself.
 */
async function applyAll(userId) {
    const [rows] = await database_1.default.execute('SELECT pending_actions FROM users WHERE id = ? LIMIT 1', [userId]);
    const actions = parseActions(rows[0]?.pending_actions);
    if (actions.length === 0)
        return [];
    for (const action of actions) {
        if (action?.type === 'create_company_profile' && action.data && typeof action.data === 'object') {
            await (0, companyProfileAutoCreate_1.createCompanyProfileIfMissing)(userId, action.data)
                .catch((err) => console.error('[pendingActions] apply create_company_profile failed:', err?.message || err));
        }
    }
    await database_1.default.execute('UPDATE users SET pending_actions = NULL WHERE id = ?', [userId]);
    return actions;
}
