import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

const API_BASE = import.meta.env.VITE_API_URL || (
  import.meta.env.PROD
    ? `${window.location.origin}/api`
    : 'http://localhost:3002/api'
);

function buildSessionKey(path: string) {
  const date = new Date().toISOString().slice(0, 10);
  return `tarmeer_visit:${date}:${path}`;
}

export function useVisitorTracking() {
  const location = useLocation();

  useEffect(() => {
    const path = `${location.pathname}${location.search || ''}`;
    const sessionKey = buildSessionKey(path);

    if (sessionStorage.getItem(sessionKey)) {
      return;
    }

    sessionStorage.setItem(sessionKey, '1');

    fetch(`${API_BASE}/stats/visit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        pagePath: path,
        referrer: document.referrer || null,
      }),
    }).catch(() => {
      // Visitor tracking should never block page usage.
    });
  }, [location.pathname, location.search]);
}
