// src/pages/AuthCallbackPage.tsx
import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { api } from '../lib/api';

export default function AuthCallbackPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [callbackError, setCallbackError] = useState<string | null>(null);

  useEffect(() => {
    const token = searchParams.get('token');
    const error = searchParams.get('error');

    if (token) {
      api.setToken(token);

      // Fetch user info and route based on active_role
      fetch(`${import.meta.env.VITE_API_URL || '/api'}/auth/me`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      })
        .then(res => res.json())
        .then(async (data) => {
          if (data.user) {
            localStorage.setItem('user', JSON.stringify(data.user));
            localStorage.setItem('active_role', data.user.active_role || '');
          }
          const activeRole = data.user?.active_role;
          if (activeRole === 'company') {
            // Apply pending company profile from /for-companies signup
            try {
              const raw = sessionStorage.getItem('pending_company_profile');
              if (raw) {
                const pending = JSON.parse(raw);
                sessionStorage.removeItem('pending_company_profile');
                // Update user phone if missing
                if (pending.phone && !data.user?.phone) {
                  await fetch(`${import.meta.env.VITE_API_URL || '/api'}/auth/profile`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                    body: JSON.stringify({ phone: pending.phone }),
                  }).catch(() => {});
                  // Update localStorage
                  if (data.user) { data.user.phone = pending.phone; localStorage.setItem('user', JSON.stringify(data.user)); }
                }
                // Create company profile
                await fetch(`${import.meta.env.VITE_API_URL || '/api'}/auth/company/profile`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                  body: JSON.stringify({
                    company_name: pending.company_name || '',
                    contact_person: pending.contact_person || '',
                    phone: pending.phone || '',
                    city: pending.city || '',
                    company_type: pending.company_type || 'renovation_company',
                    description: '',
                    services: pending.services || ['Interior Design'],
                    establishment_year: pending.establishment_year || null,
                    signup_source: pending.signup_source || 'for-companies-landing',
                  }),
                }).catch(() => {});
              }
            } catch { /* best-effort */ }
            navigate('/company');
          } else {
            navigate('/dashboard');
          }
        })
        .catch(() => {
          navigate('/dashboard');
        });
    } else if (error) {
      // 错误处理
      navigate(`/auth?error=${encodeURIComponent(error)}`);
    } else {
      // No token and no error — likely a broken OAuth redirect
      // Wait a moment then show error with back link
      const timer = setTimeout(() => {
        setCallbackError('Sign-in could not be completed. Please try again.');
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [searchParams, navigate]);

  if (callbackError) {
    return (
      <div className="min-h-screen bg-[#FAFAF9] flex items-center justify-center px-4">
        <div className="text-center max-w-sm">
          <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
            <svg className="w-6 h-6 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <h2 className="font-serif text-xl text-[#1c1917] mb-2">Sign-in Failed</h2>
          <p className="text-stone-500 text-sm mb-6">{callbackError}</p>
          <Link
            to="/auth"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#B8864A] text-white text-sm font-medium hover:bg-[#a3780a] transition"
          >
            Back to Sign In
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FAFAF9] flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin w-8 h-8 border-2 border-[#B8864A] border-t-transparent rounded-full mx-auto mb-4" />
        <p className="text-stone-600">Completing sign in...</p>
      </div>
    </div>
  );
}
