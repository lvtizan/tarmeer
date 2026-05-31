type AnalyticsPayload = Record<string, unknown>;

const API_BASE = process.env.NEXT_PUBLIC_API_URL || '/api';

function ttqTrack(eventName: string, params: Record<string, unknown> = {}) {
  if (typeof window === 'undefined') return;
  const w = window as unknown as { ttq?: { track: (e: string, p?: Record<string, unknown>) => void } };
  w.ttq?.track(eventName, params);
}

function getCurrentPath() {
  if (typeof window === 'undefined') return '/';
  return `${window.location.pathname}${window.location.search || ''}`;
}

function pushDataLayer(eventName: string, payload: AnalyticsPayload = {}) {
  if (typeof window === 'undefined') return;
  const w = window as unknown as { dataLayer?: unknown[] };
  if (!w.dataLayer) w.dataLayer = [];
  w.dataLayer.push({ event: eventName, page_path: getCurrentPath(), ...payload });
}

function sendEventToBackend(eventName: string, payload: AnalyticsPayload = {}) {
  if (typeof window === 'undefined') return;
  const body = JSON.stringify({
    eventName,
    pagePath: getCurrentPath(),
    referrer: document.referrer || null,
    payload,
  });

  if (navigator.sendBeacon) {
    try {
      navigator.sendBeacon(`${API_BASE}/stats/event`, new Blob([body], { type: 'application/json' }));
      return;
    } catch { /* fallback */ }
  }

  fetch(`${API_BASE}/stats/event`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
    keepalive: true,
  }).catch(() => {});
}

export function trackAnalyticsEvent(eventName: string, payload: AnalyticsPayload = {}) {
  pushDataLayer(eventName, payload);
  sendEventToBackend(eventName, payload);
}

export function trackPageView(payload: AnalyticsPayload = {}) {
  trackAnalyticsEvent('page_view', {
    title: typeof document !== 'undefined' ? document.title : '',
    ...payload,
  });
}

export function trackViewContent(params: { content_name?: string; content_id?: string }) {
  ttqTrack('ViewContent', { content_type: 'product', ...params });
}

export function trackContact(params: { content_name?: string; content_id?: string }) {
  ttqTrack('Contact', { content_type: 'product', ...params });
}

export function trackLead(params: { content_name?: string; content_id?: string }) {
  ttqTrack('Lead', { content_type: 'product', ...params });
}

export function trackFbSubmitApplication() {
  if (typeof window !== 'undefined') {
    (window as unknown as { fbq?: (...args: unknown[]) => void }).fbq?.('track', 'SubmitApplication');
  }
}

export function trackClickButton(params: { content_name?: string }) {
  ttqTrack('ClickButton', { content_name: params.content_name });
}
