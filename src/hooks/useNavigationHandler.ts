import { useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { SCROLL_TIMEOUT_MS } from '../lib/constants';

/**
 * Hook that handles navigation with hash-based scrolling support.
 * Used by Navbar to scroll to anchored sections (e.g. /#designers, /#pricing)
 * when already on the same page, or navigate normally otherwise.
 */
export function useNavigationHandler() {
  const navigate = useNavigate();
  const location = useLocation();

  const handleNavClick = useCallback(
    (to: string) => {
      const [path, hash] = to.split('#');
      const targetPath = path || '/';

      if (hash && location.pathname === targetPath) {
        const el = document.getElementById(hash);
        if (el) {
          setTimeout(
            () => el.scrollIntoView({ behavior: 'smooth', block: 'start' }),
            SCROLL_TIMEOUT_MS,
          );
          return;
        }
      }

      navigate(to);
    },
    [navigate, location.pathname],
  );

  return { handleNavClick };
}
