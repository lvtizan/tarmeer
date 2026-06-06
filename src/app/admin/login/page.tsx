'use client';

import { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAdmin } from '@/contexts/AdminContext';
import PasswordInput from '@/components/admin/PasswordInput';

function LoginContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { login, admin, isInstalled, isLoading: contextLoading } = useAdmin();

  useEffect(() => {
    const reason = searchParams.get('reason');
    if (reason === 'session_expired') {
      setError('登录已失效，请重新登录。');
    }
  }, [searchParams]);

  useEffect(() => {
    if (admin) {
      const isLeader = admin.role === 'field_staff' && admin.permissions?.can_view_interviews;
      router.push(admin.role === 'field_staff' && !isLeader ? '/field/survey' : '/admin');
    }
  }, [admin, router]);

  useEffect(() => {
    if (isInstalled === false) {
      router.push('/admin/install');
    }
  }, [isInstalled, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      await login(email, password);
      // redirect is handled by the useEffect above (watches `admin` which has full permissions)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setIsLoading(false);
    }
  };

  if (contextLoading || isInstalled === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#faf9f7]">
        <div className="text-stone-500">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-[#faf9f7] px-4 pb-16 pt-[clamp(28px,10vh,96px)] sm:px-6 sm:pt-[clamp(40px,12vh,120px)] lg:px-8">
      <div className="mx-auto w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-[#2c2c2c]">Tarmeer Admin</h1>
          <p className="mt-2 text-sm text-stone-600">Sign in to manage designers</p>
        </div>

        <div className="bg-white py-8 px-6 shadow-sm rounded-lg border border-stone-200">
          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg text-sm">
                {error}
              </div>
            )}

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-stone-700 mb-1">
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoFocus
                className="w-full px-3 py-2.5 border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#b8864a]/40 focus:border-[#b8864a]"
                placeholder="admin@example.com"
              />
            </div>

            <PasswordInput
              id="password"
              value={password}
              onChange={setPassword}
              placeholder="Enter your password"
              required
            />

            <div className="text-right -mt-2">
              <Link href="/admin/forgot-password" className="text-sm text-[#b8864a] hover:underline">
                Forgot password?
              </Link>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-[#b8864a] text-white py-3 px-4 rounded-lg font-medium hover:bg-[#a67c47] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? 'Signing in...' : 'Sign in'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

export default function AdminLoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-[#faf9f7]"><div className="text-stone-500">Loading...</div></div>}>
      <LoginContent />
    </Suspense>
  );
}
