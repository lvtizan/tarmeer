'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api';
import { Suspense } from 'react';

const API_BASE = process.env.NEXT_PUBLIC_API_URL?.trim() || '/api';

function AuthCallbackInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [callbackError, setCallbackError] = useState<string | null>(null);

  useEffect(() => {
    const token = searchParams.get('token');
    const error = searchParams.get('error');

    if (token) {
      api.setToken(token);
      fetch(`${API_BASE}/auth/me`, { headers: { Authorization: `Bearer ${token}` } })
        .then(res => res.json())
        .then(async (data: { user?: { active_role?: string; phone?: string } }) => {
          if (data.user) {
            localStorage.setItem('user', JSON.stringify(data.user));
            localStorage.setItem('active_role', data.user.active_role || '');
          }
          const activeRole = data.user?.active_role;
          if (activeRole === 'company') {
            try {
              const raw = sessionStorage.getItem('pending_company_profile');
              if (raw) {
                const pending = JSON.parse(raw) as {
                  phone?: string; company_name?: string; contact_person?: string;
                  city?: string; company_type?: string; services?: string[];
                  establishment_year?: number; signup_source?: string;
                };
                sessionStorage.removeItem('pending_company_profile');
                if (pending.phone && !data.user?.phone) {
                  await fetch(`${API_BASE}/auth/profile`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                    body: JSON.stringify({ phone: pending.phone }),
                  }).catch(() => {});
                }
                await fetch(`${API_BASE}/auth/company/profile`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
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
            router.push('/company');
          } else {
            router.push('/dashboard');
          }
        })
        .catch(() => router.push('/dashboard'));
    } else if (error) {
      router.push(`/auth?error=${encodeURIComponent(error)}`);
    } else {
      const timer = setTimeout(() => {
        setCallbackError('Sign-in could not be completed. Please try again.');
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [searchParams, router]);

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
            href="/auth"
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

export default function AuthCallbackPage() {
  return (
    <Suspense>
      <AuthCallbackInner />
    </Suspense>
  );
}
