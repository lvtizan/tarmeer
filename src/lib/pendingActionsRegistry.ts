/**
 * pendingActionsRegistry.ts
 *
 * Frontend "carry-over" scaffold.
 * Handlers are registered by action type and called automatically
 * when the email-verification poller detects a verified account.
 *
 * Usage — register a handler once (e.g. in your form component or App.tsx):
 *   registerPendingAction('create_company_profile', async (data, token) => {
 *     await fetch('/api/auth/company/profile', {
 *       method: 'POST',
 *       headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
 *       body: JSON.stringify(data),
 *     });
 *   });
 *
 * The poller calls applyPendingActions(actions, token) automatically —
 * you never need to touch useVerificationPoller.ts.
 *
 * Adding a new carry-over feature:
 *   1. Call registerPendingAction(type, handler) once near your form
 *   2. Pass pending_profile: { type, data } in the register API call
 *   Done — no other frontend changes needed.
 */

type ActionHandler = (data: unknown, token: string) => Promise<void>;

const registry = new Map<string, ActionHandler>();

/** Register a handler for a given action type. Call this once near your feature code. */
export function registerPendingAction(type: string, handler: ActionHandler): void {
  registry.set(type, handler);
}

/**
 * Apply all pending actions returned by checkVerified.
 * Errors per action are silently caught — the user can fill in missing data manually.
 */
export async function applyPendingActions(
  actions: Array<{ type: string; data: unknown }> | null | undefined,
  token: string
): Promise<void> {
  if (!actions?.length) return;
  for (const action of actions) {
    const handler = registry.get(action.type);
    if (handler) {
      try { await handler(action.data, token); } catch { /* ignore — user fills manually */ }
    }
  }
}
