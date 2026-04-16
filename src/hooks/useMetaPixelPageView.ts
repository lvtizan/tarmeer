import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';

declare global {
  interface Window {
    fbq?: (...args: unknown[]) => void;
  }
}

/**
 * Fires Meta Pixel PageView on SPA route changes.
 * Initial page load is already tracked by the <script> in index.html,
 * so we skip the first run to avoid double counting.
 */
export function useMetaPixelPageView() {
  const location = useLocation();
  const isFirstRun = useRef(true);

  useEffect(() => {
    if (isFirstRun.current) {
      isFirstRun.current = false;
      return;
    }
    window.fbq?.('track', 'PageView');
  }, [location.pathname]);
}
