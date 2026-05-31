'use client';

import { useCallback } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { SCROLL_TIMEOUT_MS } from '../lib/constants';

export function useNavigationHandler() {
  const router = useRouter();
  const pathname = usePathname();

  const handleNavClick = useCallback(
    (to: string) => {
      const [path, hash] = to.split('#');
      const targetPath = path || '/';

      if (hash && pathname === targetPath) {
        const el = document.getElementById(hash);
        if (el) {
          setTimeout(
            () => el.scrollIntoView({ behavior: 'smooth', block: 'start' }),
            SCROLL_TIMEOUT_MS,
          );
          return;
        }
      }

      router.push(to);
    },
    [router, pathname],
  );

  return { handleNavClick };
}
