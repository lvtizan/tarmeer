import { useEffect, useRef, useCallback } from 'react';

const API_BASE = import.meta.env.VITE_API_URL || (
  import.meta.env.PROD
    ? `${window.location.origin}/api`
    : 'http://localhost:3002/api'
);

// Generate a simple fingerprint based on browser info
function generateFingerprint(): string {
  const components = [
    navigator.userAgent,
    navigator.language,
    screen.width,
    screen.height,
    new Date().getTimezoneOffset(),
  ];
  return btoa(components.join('|')).substring(0, 32);
}

// Get stored fingerprint or generate new one
function getFingerprint(): string {
  const stored = sessionStorage.getItem('_fp');
  if (stored) return stored;
  const fp = generateFingerprint();
  sessionStorage.setItem('_fp', fp);
  return fp;
}

// Track page view
export function usePageView(entityType: 'designer' | 'project', entityId: number | null) {
  const hasTracked = useRef(false);

  useEffect(() => {
    if (!entityId || hasTracked.current) return;

    hasTracked.current = true;

    // Debounce to avoid tracking on quick bounces
    const timer = setTimeout(() => {
      fetch(`${API_BASE}/stats/page-view`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entityType,
          entityId,
          referrer: document.referrer || null,
          fingerprint: getFingerprint(),
        }),
      }).catch(() => {
        // Silently fail - stats shouldn't affect user experience
      });
    }, 1000);

    return () => clearTimeout(timer);
  }, [entityType, entityId]);
}

// Track click events
export function useClickTracking(designerId: number) {
  const trackClick = useCallback((clickType: 'phone' | 'whatsapp' | 'email' | 'contact_form') => {
    fetch(`${API_BASE}/stats/click`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        designerId,
        clickType,
      }),
    }).catch(() => {
      // Silently fail
    });
  }, [designerId]);

  return { trackClick };
}

// Batch track events (useful for client-side batching)
export function useBatchTracking() {
  const eventsRef = useRef<any[]>([]);
  const flushTimerRef = useRef<NodeJS.Timeout | null>(null);

  const addEvent = useCallback((event: { type: 'page_view' | 'click'; [key: string]: any }) => {
    eventsRef.current.push({
      ...event,
      timestamp: Date.now(),
    });

    // Flush after 5 seconds or 10 events
    if (eventsRef.current.length >= 10) {
      flush();
    } else if (!flushTimerRef.current) {
      flushTimerRef.current = setTimeout(flush, 5000);
    }
  }, []);

  const flush = useCallback(() => {
    if (flushTimerRef.current) {
      clearTimeout(flushTimerRef.current);
      flushTimerRef.current = null;
    }

    const events = eventsRef.current;
    if (events.length === 0) return;

    eventsRef.current = [];

    fetch(`${API_BASE}/stats/batch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ events }),
    }).catch(() => {
      // Silently fail
    });
  }, []);

  // Flush on page unload
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (eventsRef.current.length > 0) {
        // Use sendBeacon for more reliable delivery on page unload
        navigator.sendBeacon(
          `${API_BASE}/stats/batch`,
          JSON.stringify({ events: eventsRef.current })
        );
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, []);

  return { addEvent, flush };
}

// Simple page view tracker (call once when component mounts)
export function trackPageView(entityType: 'designer' | 'project', entityId: number) {
  const fp = getFingerprint();
  
  fetch(`${API_BASE}/stats/page-view`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      entityType,
      entityId,
      referrer: document.referrer || null,
      fingerprint: fp,
    }),
  }).catch(() => {});
}

// Simple click tracker
export function trackClick(designerId: number, clickType: 'phone' | 'whatsapp' | 'email' | 'contact_form') {
  fetch(`${API_BASE}/stats/click`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      designerId,
      clickType,
    }),
  }).catch(() => {});
}
