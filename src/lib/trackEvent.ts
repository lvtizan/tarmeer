/**
 * Frontend behavior tracking utility.
 * Sends to POST /api/track — fire-and-forget, never blocks page load.
 */

const API_BASE = process.env.NEXT_PUBLIC_API_URL?.trim() || '/api';

export interface TrackPayload {
  event_type: string;
  target_id?: number | null;
  target_name?: string | null;
  target_type?: string | null;
  metadata?: Record<string, unknown>;
}

export function trackEvent(payload: TrackPayload): void {
  if (typeof window === 'undefined') return;
  const token =
    localStorage.getItem('auth_token') || localStorage.getItem('token') || undefined;
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  fetch(`${API_BASE}/track`, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  }).catch(() => {
    /* silent fail — tracking should never break the page */
  });
}
