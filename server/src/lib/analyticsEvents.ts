/**
 * In-process pub/sub for admin analytics changes.
 *
 * Used by SSE endpoint /admin/stats/registration-events. When a controller
 * inserts a new company / homeowner / inquiry, it calls notifyChange(),
 * which emits a 'change' event (throttled to once per 2s to absorb bursts).
 *
 * Single-process only. If the API ever runs in PM2 cluster mode, replace
 * the EventEmitter with Redis pub/sub or sticky sessions.
 */
import { EventEmitter } from 'events';

export type RegistrationKind = 'company' | 'homeowner' | 'inquiry' | 'company_lead' | 'company_application';
export interface ChangePayload { kind: RegistrationKind; ts: number; }

class AnalyticsEvents extends EventEmitter {
  private pendingKinds: Set<RegistrationKind> = new Set();
  private timer: NodeJS.Timeout | null = null;
  private lastFireMs = 0;
  private readonly THROTTLE_MS = 2000;

  notifyChange(kind: RegistrationKind) {
    this.pendingKinds.add(kind);
    if (this.timer) return;
    const since = Date.now() - this.lastFireMs;
    const wait = since >= this.THROTTLE_MS ? 0 : this.THROTTLE_MS - since;
    this.timer = setTimeout(() => this.flush(), wait);
  }

  private flush() {
    this.timer = null;
    if (!this.pendingKinds.size) return;
    const kinds = [...this.pendingKinds];
    this.pendingKinds.clear();
    this.lastFireMs = Date.now();
    // Emit one event per distinct kind so subscribers can filter if they want
    for (const kind of kinds) {
      this.emit('change', { kind, ts: this.lastFireMs } as ChangePayload);
    }
  }
}

export const analyticsEvents = new AnalyticsEvents();
analyticsEvents.setMaxListeners(50);   // allow many concurrent SSE clients
