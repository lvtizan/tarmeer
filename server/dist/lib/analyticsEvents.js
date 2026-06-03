"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.analyticsEvents = void 0;
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
const events_1 = require("events");
class AnalyticsEvents extends events_1.EventEmitter {
    constructor() {
        super(...arguments);
        this.pendingKinds = new Set();
        this.timer = null;
        this.lastFireMs = 0;
        this.THROTTLE_MS = 2000;
    }
    notifyChange(kind) {
        this.pendingKinds.add(kind);
        if (this.timer)
            return;
        const since = Date.now() - this.lastFireMs;
        const wait = since >= this.THROTTLE_MS ? 0 : this.THROTTLE_MS - since;
        this.timer = setTimeout(() => this.flush(), wait);
    }
    flush() {
        this.timer = null;
        if (!this.pendingKinds.size)
            return;
        const kinds = [...this.pendingKinds];
        this.pendingKinds.clear();
        this.lastFireMs = Date.now();
        // Emit one event per distinct kind so subscribers can filter if they want
        for (const kind of kinds) {
            this.emit('change', { kind, ts: this.lastFireMs });
        }
    }
}
exports.analyticsEvents = new AnalyticsEvents();
exports.analyticsEvents.setMaxListeners(50); // allow many concurrent SSE clients
