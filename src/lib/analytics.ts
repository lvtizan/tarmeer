type AnalyticsPayload = Record<string, unknown>;

const API_BASE = import.meta.env.VITE_API_URL || '/api';

// TikTok Pixel helper
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

// TikTok Pixel Events

/** 浏览公司详情页 */
export function trackViewContent(params: { content_name?: string; content_id?: string }) {
  ttqTrack('ViewContent', {
    content_type: 'product',
    content_name: params.content_name,
    content_id: params.content_id,
  });
}

/** 提交询单（Contact 事件） */
export function trackContact(params: { content_name?: string; content_id?: string }) {
  ttqTrack('Contact', {
    content_type: 'product',
    content_name: params.content_name,
    content_id: params.content_id,
  });
}

/** 询单提交成功（Lead 事件） */
export function trackLead(params: { content_name?: string; content_id?: string }) {
  ttqTrack('Lead', {
    content_type: 'product',
    content_name: params.content_name,
    content_id: params.content_id,
  });
}

/** 点击重要按钮 */
export function trackClickButton(params: { content_name?: string }) {
  ttqTrack('ClickButton', {
    content_name: params.content_name,
  });
}
