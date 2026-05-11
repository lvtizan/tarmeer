/**
 * 前端行为埋点工具
 * 发送到 POST /api/track，不阻塞页面加载（fire-and-forget）
 */

const API_BASE = (import.meta as any).env?.VITE_API_URL?.trim() || '/api';

export interface TrackPayload {
  event_type: string;
  target_id?: number | null;
  target_name?: string | null;
  target_type?: string | null;
  metadata?: Record<string, unknown>;
}

export function trackEvent(payload: TrackPayload): void {
  const token = localStorage.getItem('auth_token') || localStorage.getItem('token') || undefined;
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  fetch(`${API_BASE}/track`, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  }).catch(() => { /* silent fail — tracking should never break the page */ });
}
