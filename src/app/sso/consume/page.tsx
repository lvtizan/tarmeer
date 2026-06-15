'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useSiteLocale } from '@/contexts/SiteLocaleContext';

const API_BASE = process.env.NEXT_PUBLIC_API_URL?.trim() || '/api';

function SsoConsumeInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [error, setError] = useState('');
  const to = useSiteLocale().tr.onboarding;

  useEffect(() => {
    const token = searchParams.get('token');
    if (!token) {
      setError(to.ssoInvalidLink);
      return;
    }

    fetch(`${API_BASE}/sso/consume?token=${encodeURIComponent(token)}`, {
      headers: {
        'Content-Type': 'application/json',
      },
    })
      .then(async (res) => {
        if (!res.ok) throw new Error(to.ssoFailed);
        return res.json();
      })
      .then((data: { token?: string; redirectUrl?: string }) => {
        if (!data?.token) throw new Error(to.ssoNoToken);
        if (typeof window !== 'undefined') {
          localStorage.setItem('auth_token', data.token);
          localStorage.setItem('active_role', 'company');
        }
        const redirect = data.redirectUrl || '/company/dashboard';
        router.replace(redirect);
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : to.ssoFailedRetry);
      });
  }, [searchParams, router]);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-stone-50">
        <div className="max-w-sm w-full mx-auto p-8 bg-white rounded-2xl border border-stone-200 shadow-sm text-center space-y-4">
          <p className="text-red-600 font-medium">{error}</p>
          <button
            onClick={() => router.replace('/auth')}
            className="btn-primary px-6 py-2 text-sm"
          >
            {to.goToLogin}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-stone-50">
      <div className="w-8 h-8 rounded-full border-2 border-[#b8864a]/20 border-t-[#b8864a] animate-spin" />
    </div>
  );
}

export default function SsoConsumePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-stone-50">
        <div className="w-8 h-8 rounded-full border-2 border-[#b8864a]/20 border-t-[#b8864a] animate-spin" />
      </div>
    }>
      <SsoConsumeInner />
    </Suspense>
  );
}
