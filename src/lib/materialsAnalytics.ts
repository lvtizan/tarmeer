type MaterialEvent = 'materials_directory_view' | 'materials_product_view' | 'materials_inquiry_start' | 'materials_inquiry_success';
export function materialEventBody(eventName: MaterialEvent, country: string, sessionId: string, productId?: number, internal = false) {
  return {
    eventName,
    referrer: '',
    pagePath: productId ? `/materials/products/${productId}` : '/materials',
    payload: { country, session_id: sessionId, product_id: productId || null, internal },
  };
}
/** Only IDs and country are sent: never contact data, search terms, messages or URL query strings. */
export function trackMaterialEvent(eventName: MaterialEvent, country: string, productId?: number) {
  if (typeof window === 'undefined') return;
  try {
    const key = 'tarmeer-materials-session';
    let sessionId = sessionStorage.getItem(key);
    if (!sessionId) { sessionId = crypto.randomUUID(); sessionStorage.setItem(key, sessionId); }
    const internal = ['localhost', '127.0.0.1', '::1'].includes(window.location.hostname);
    const body = materialEventBody(eventName, country, sessionId, productId, internal);
    const base = process.env.NEXT_PUBLIC_API_URL?.trim() || '/api';
    void fetch(`${base}/stats/event?country=${encodeURIComponent(country)}`, { method: 'POST', referrerPolicy: 'no-referrer', headers: { 'Content-Type': 'application/json', 'x-country': country }, body: JSON.stringify(body), keepalive: true }).catch(() => {});
  } catch { /* Disabled storage/telemetry must never interrupt procurement. */ }
}
