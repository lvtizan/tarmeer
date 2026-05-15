import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { applyPendingActions } from '../lib/pendingActionsRegistry';

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
  const timerRef = useRef<ReturnType<typeof setInterval>>(undefined);
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

          // Apply pending actions (server-side first, sessionStorage as fallback for same-tab)
          const activeRole = data.user?.active_role || role;
          try {
            // Server-side: works cross-device/cross-browser
            let actions: Array<{ type: string; data: unknown }> = data.pendingActions || [];
            // Same-tab fallback: legacy sessionStorage key
            if (!actions.length) {
              const raw = sessionStorage.getItem('pending_company_profile');
              if (raw) { actions = [{ type: 'create_company_profile', data: JSON.parse(raw) }]; }
            }
            sessionStorage.removeItem('pending_company_profile');
            await applyPendingActions(actions, data.token);
          } catch { /* ignore */ }

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
