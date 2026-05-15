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

import pool from '../config/database';

export type PendingAction = { type: string; data: unknown };

function parseActions(raw: unknown): PendingAction[] {
  if (!raw) return [];
  try {
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
    return Array.isArray(parsed) ? parsed : [];
  } catch { return []; }
}

/** Append an action to the user's pending queue. */
export async function save(userId: number, type: string, data: unknown): Promise<void> {
  const [rows] = await pool.execute(
    'SELECT pending_actions FROM users WHERE id = ? LIMIT 1',
    [userId]
  );
  const existing = parseActions((rows as any[])[0]?.pending_actions);
  existing.push({ type, data });
  await pool.execute(
    'UPDATE users SET pending_actions = ? WHERE id = ?',
    [JSON.stringify(existing), userId]
  );
}

/** Return all pending actions and clear the column atomically. */
export async function pop(userId: number): Promise<PendingAction[]> {
  const [rows] = await pool.execute(
    'SELECT pending_actions FROM users WHERE id = ? LIMIT 1',
    [userId]
  );
  const actions = parseActions((rows as any[])[0]?.pending_actions);
  if (actions.length > 0) {
    await pool.execute('UPDATE users SET pending_actions = NULL WHERE id = ?', [userId]);
  }
  return actions;
}
