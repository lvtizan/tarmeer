'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';

export default function FieldLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Login failed');
        return;
      }
      // Field staff must have role field_staff (or super_admin for testing)
      if (data.admin?.role !== 'field_staff' && data.admin?.role !== 'super_admin') {
        setError('This account does not have field staff access.');
        return;
      }
      localStorage.setItem('field_token', data.token);
      localStorage.setItem('field_user', JSON.stringify(data.admin));
      router.replace('/field/survey');
    } catch {
      setError('Network error — please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#faf9f7] flex items-center justify-center px-4">
      <div className="w-full max-w-sm bg-white rounded-3xl shadow-sm border border-stone-100 px-8 py-10">
        <div className="w-12 h-12 rounded-2xl bg-[#b8864a]/10 flex items-center justify-center mx-auto mb-6">
          <svg className="w-6 h-6 text-[#b8864a]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
        </div>
        <h1 className="text-xl font-bold text-[#1c1917] text-center mb-1">Field Staff Login</h1>
        <p className="text-sm text-stone-400 text-center mb-6">Sign in to access the survey</p>

        {error && (
          <div className="mb-4 px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-sm text-red-700">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-stone-500 mb-1.5">Email</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              autoFocus
              placeholder="your@email.com"
              className="w-full h-11 px-4 rounded-xl border border-stone-200 bg-stone-50 text-[15px] focus:outline-none focus:ring-2 focus:ring-[#b8864a]/20 focus:border-[#b8864a] focus:bg-white"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-stone-500 mb-1.5">Password</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              placeholder="••••••••"
              className="w-full h-11 px-4 rounded-xl border border-stone-200 bg-stone-50 text-[15px] focus:outline-none focus:ring-2 focus:ring-[#b8864a]/20 focus:border-[#b8864a] focus:bg-white"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="btn-primary w-full h-11 disabled:opacity-50"
          >
            {loading ? 'Signing in…' : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  );
}
