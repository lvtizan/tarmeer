import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';

/**
 * Polls /auth/check-verified every 3s after registration.
 * When email is verified (e.g. user clicked link on phone),
 * auto-logs in and redirects to the appropriate dashboard.
 *
 * @param email - The email to poll for, or null to disable
 * @param role - 'company' | 'homeowner' to determine redirect target
 */
export function useVerificationPoller(email: string | null, role?: string) {
  const navigate = useNavigate();
  const timerRef = useRef<ReturnType<typeof setInterval>>();
  const stoppedRef = useRef(false);

  useEffect(() => {
    if (!email || stoppedRef.current) return;

    const API_BASE = (import.meta as any).env?.VITE_API_URL?.trim() || '/api';

    timerRef.current = setInterval(async () => {
      try {
        const res = await fetch(`${API_BASE}/auth/check-verified?email=${encodeURIComponent(email)}`);
        if (!res.ok) return;
        const data = await res.json();
        if (data.verified && data.token) {
          // Stop polling
          stoppedRef.current = true;
          clearInterval(timerRef.current);

          // Auto-login
          api.setToken(data.token);
          if (data.user) {
            localStorage.setItem('user', JSON.stringify(data.user));
            localStorage.setItem('active_role', data.user.active_role || role || '');
          }

          // Redirect
          const activeRole = data.user?.active_role || role;
          if (activeRole === 'company') {
            navigate('/company');
          } else {
            navigate('/dashboard');
          }
        }
      } catch {
        // Silently ignore polling errors
      }
    }, 3000);

    return () => clearInterval(timerRef.current);
  }, [email, role, navigate]);
}
