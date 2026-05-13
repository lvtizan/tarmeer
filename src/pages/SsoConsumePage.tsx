/**
 * SsoConsumePage.tsx
 * Handles /sso/consume?token=<rawToken>
 * Called by CRM's consumeUrl redirect — validates the single-use token,
 * stores the JWT, then navigates to the company dashboard.
 */
import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { PageSpinner } from '../components/ui/Spinner';

export default function SsoConsumePage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [error, setError] = useState('');

  useEffect(() => {
    const token = searchParams.get('token');
    if (!token) {
      setError('Invalid SSO link — missing token.');
      return;
    }

    api.get(`/sso/consume?token=${encodeURIComponent(token)}`)
      .then((res: any) => {
        if (!res?.token) throw new Error('No token in response');
        api.setToken(res.token);
        // Store role so dashboard knows the active role
        localStorage.setItem('active_role', 'company');
        const redirect = res.redirectUrl || '/company/dashboard';
        navigate(redirect, { replace: true });
      })
      .catch((err: any) => {
        setError(err?.message || 'SSO login failed. Please try again.');
      });
  }, []);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-stone-50">
        <div className="max-w-sm w-full mx-auto p-8 bg-white rounded-2xl border border-stone-200 shadow-sm text-center space-y-4">
          <p className="text-red-600 font-medium">{error}</p>
          <button
            onClick={() => navigate('/auth', { replace: true })}
            className="btn-primary px-6 py-2 text-sm"
          >
            Go to Login
          </button>
        </div>
      </div>
    );
  }

  return <PageSpinner />;
}
