'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '../lib/api';

const API_BASE = process.env.NEXT_PUBLIC_API_URL?.trim() || '/api';

export function useVerificationPoller(email: string | null, role?: string) {
  const router = useRouter();
  const timerRef = useRef<ReturnType<typeof setInterval>>(undefined);
  const stoppedRef = useRef(false);

  useEffect(() => {
    if (!email || stoppedRef.current) return;

    timerRef.current = setInterval(async () => {
      try {
        const res = await fetch(`${API_BASE}/auth/check-verified?email=${encodeURIComponent(email)}`);
        if (!res.ok) return;
        const data = await res.json() as { verified?: boolean; token?: string; user?: { active_role?: string } };
        if (data.verified && data.token) {
          stoppedRef.current = true;
          clearInterval(timerRef.current);

          api.setToken(data.token);
          if (data.user) {
            localStorage.setItem('user', JSON.stringify(data.user));
            localStorage.setItem('active_role', data.user.active_role || role || '');
          }

          const activeRole = data.user?.active_role || role;
          router.push(activeRole === 'company' ? '/company' : '/dashboard');
        }
      } catch {
        // silently ignore polling errors
      }
    }, 3000);

    return () => clearInterval(timerRef.current);
  }, [email, role, router]);
}
