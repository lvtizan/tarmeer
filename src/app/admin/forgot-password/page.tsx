'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Mail, AlertCircle, CheckCircle } from 'lucide-react';
import { adminApi } from '@/lib/adminApi';

export default function AdminForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      await adminApi.forgotPassword(email);
      setSuccess(true);
    } catch {
      setError('Failed to send reset email.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-[#faf9f7] px-4 pb-16 pt-[clamp(28px,10vh,96px)] sm:px-6 sm:pt-[clamp(40px,12vh,120px)]">
      <div className="mx-auto w-full max-w-md">
        <div className="bg-white rounded-lg border border-stone-200 shadow-sm p-8">
          <h1 className="text-2xl font-bold text-[#2c2c2c] mb-2 text-center">Forgot Password</h1>
          <p className="text-stone-600 text-center mb-6">Enter your email to receive a reset link.</p>

          {success ? (
            <div className="p-4 rounded-lg bg-green-50 border border-green-200 flex items-start gap-3">
              <CheckCircle className="w-5 h-5 text-green-500 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm text-green-700">If that email is registered, a reset link has been sent.</p>
                <Link href="/admin/login" className="text-sm font-medium text-[#b8864a] hover:underline mt-2 inline-block">
                  Back to Admin Login
                </Link>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              {error && (
                <div className="p-4 rounded-lg bg-red-50 border border-red-200 flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                  <p className="text-sm text-red-700">{error}</p>
                </div>
              )}

              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-stone-700">Email</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="admin@example.com"
                    className="w-full h-11 px-3 py-2.5 pl-10 rounded-lg border border-stone-200 bg-white text-sm text-[#2c2c2c] focus:outline-none focus:border-[#b8864a] focus:ring-2 focus:ring-[#b8864a]/40"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-[#b8864a] text-white py-3 px-4 rounded-lg font-medium hover:bg-[#a67c47] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Sending...' : 'Send Reset Link'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
