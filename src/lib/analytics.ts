type AnalyticsPayload = Record<string, unknown>;

const API_BASE = import.meta.env.VITE_API_URL || (
  import.meta.env.PROD
    ? `${window.location.origin}/api`
    : 'http://localhost:3002/api'
);

function getCurrentPath() {
  if (typeof window === 'undefined') return '/';
  return `${window.location.pathname}${window.location.search || ''}`;
}

function pushDataLayer(eventName: string, payload: AnalyticsPayload = {}) {
  if (typeof window === 'undefined') return;
  const w = window as unknown as { dataLayer?: unknown[] };
  if (!w.dataLayer) w.dataLayer = [];
  w.dataLayer.push({
    event: eventName,
    page_path: getCurrentPath(),
    ...payload,
  });
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
      const blob = new Blob([body], { type: 'application/json' });
      navigator.sendBeacon(`${API_BASE}/stats/event`, blob);
      return;
    } catch {
      // fallback to fetch
    }
  }

  fetch(`${API_BASE}/stats/event`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
    keepalive: true,
  }).catch(() => {
    // Never break user actions because of analytics.
  });
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
