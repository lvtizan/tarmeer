'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { CheckCircle, XCircle, Loader } from 'lucide-react';
import { api } from '@/lib/api';
import { useSiteLocale } from '@/contexts/SiteLocaleContext';

export default function VerifyEmailClient() {
  const ta = useSiteLocale().tr.auth;
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [error, setError] = useState<string | null>(null);
  const [isSupplier, setIsSupplier] = useState(false);

  useEffect(() => {
    const token = searchParams.get('token');

    if (!token) {
      setStatus('error');
      setError(ta.invalidVerifyLink);
      return;
    }

    const verifyEmail = async () => {
      const API_BASE = (process.env.NEXT_PUBLIC_API_URL ?? '/api').trim();

      const tryUser = async () => {
        const response = await api.post('/auth/verify-email', { token });
        api.setToken(response.token);
        if (response.user) {
          localStorage.setItem('user', JSON.stringify(response.user));
          localStorage.setItem('active_role', response.user.active_role || '');
        }
        const activeRole = response.user?.active_role;
        setStatus('success');
        setTimeout(() => {
          if (!activeRole) router.push('/onboarding');
          else if (activeRole === 'company') router.push('/company');
          else router.push('/dashboard');
        }, 2000);
      };

      const trySupplier = async () => {
        const res = await fetch(`${API_BASE}/supplier/auth/verify-email`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token }),
        });
        const data: { token?: string; user?: unknown; error?: string } = await res.json();
        if (!res.ok) throw new Error((data as { error?: string }).error || 'Verification failed');
        localStorage.setItem('supplier_token', data.token ?? '');
        if (data.user) localStorage.setItem('supplier_user', JSON.stringify(data.user));
        setIsSupplier(true);
        setStatus('success');
        setTimeout(() => router.push('/supplier/dashboard'), 2000);
      };

      try {
        await tryUser();
      } catch {
        try {
          await trySupplier();
        } catch (err: unknown) {
          setStatus('error');
          setError(err instanceof Error ? err.message : ta.verifyFailedRetry);
        }
      }
    };

    verifyEmail();
  }, [searchParams, router]);

  const handleManualRedirect = () => {
    if (isSupplier) {
      router.push('/supplier/dashboard');
      return;
    }
    const role = localStorage.getItem('active_role');
    router.push(role ? (role === 'company' ? '/company' : '/dashboard') : '/onboarding');
  };

  return (
    <div className="min-h-screen bg-[#faf9f7] flex items-center justify-center px-4">
      <div className="max-w-md w-full">
        <div className="bg-white rounded-lg border border-stone-200 shadow-sm p-8 text-center">
          {status === 'loading' && (
            <>
              <Loader className="w-16 h-16 text-[#b8864a] mx-auto mb-4 animate-spin" />
              <h1 className="font-serif text-2xl font-bold text-[#2c2c2c] mb-2">
                {ta.verifyingEmail}
              </h1>
              <p className="text-[#6b6b6b]">
                {ta.verifyingWait}
              </p>
            </>
          )}

          {status === 'success' && (
            <>
              <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
              <h1 className="font-serif text-2xl font-bold text-[#2c2c2c] mb-2">
                {ta.emailVerified}
              </h1>
              <p className="text-[#6b6b6b] mb-4">
                {ta.emailVerifiedRedirect}
              </p>
              <div className="text-sm text-[#6b6b6b]">
                {ta.ifNoRedirect}{' '}
                <button
                  onClick={handleManualRedirect}
                  className="text-[#b8864a] font-semibold hover:underline"
                >
                  {ta.clickHere}
                </button>
              </div>
            </>
          )}

          {status === 'error' && (
            <>
              <XCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
              <h1 className="font-serif text-2xl font-bold text-[#2c2c2c] mb-2">
                {ta.verificationFailedTitle}
              </h1>
              <p className="text-[#6b6b6b] mb-4">
                {error}
              </p>
              <div className="space-y-2">
                <button
                  onClick={() => router.push('/auth')}
                  className="w-full py-3 px-4 rounded-lg bg-[#b8864a] text-white font-semibold hover:bg-[#a67c47] transition"
                >
                  {ta.backToLogin}
                </button>
                <p className="text-sm text-[#6b6b6b]">
                  {ta.contactSupport}
                </p>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
