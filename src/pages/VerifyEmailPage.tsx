import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { CheckCircle, XCircle, Loader } from 'lucide-react';
import { api } from '../lib/api';

export default function VerifyEmailPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [error, setError] = useState<string | null>(null);
  const [isSupplier, setIsSupplier] = useState(false);

  useEffect(() => {
    const token = searchParams.get('token');
    
    if (!token) {
      setStatus('error');
      setError('Invalid verification link');
      return;
    }

    const verifyEmail = async () => {
      const API_BASE = (import.meta as any).env?.VITE_API_URL?.trim() || '/api';

      // Try user/company endpoint first, then supplier endpoint
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
          if (!activeRole) navigate('/onboarding');
          else if (activeRole === 'company') navigate('/company');
          else navigate('/dashboard');
        }, 2000);
      };

      const trySupplier = async () => {
        const res = await fetch(`${API_BASE}/supplier/auth/verify-email`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Verification failed');
        localStorage.setItem('supplier_token', data.token);
        if (data.user) localStorage.setItem('supplier_user', JSON.stringify(data.user));
        setIsSupplier(true);
        setStatus('success');
        setTimeout(() => navigate('/supplier/dashboard'), 2000);
      };

      try {
        await tryUser();
      } catch {
        try {
          await trySupplier();
        } catch (err: any) {
          setStatus('error');
          setError(err.message || 'Verification failed, please try again later');
        }
      }
    };

    verifyEmail();
  }, [searchParams, navigate]);

  return (
    <div className="min-h-screen bg-[#faf9f7] flex items-center justify-center px-4">
      <div className="max-w-md w-full">
        <div className="bg-white rounded-lg border border-stone-200 shadow-sm p-8 text-center">
          {status === 'loading' && (
            <>
              <Loader className="w-16 h-16 text-[#b8864a] mx-auto mb-4 animate-spin" />
              <h1 className="font-serif text-2xl font-bold text-[#2c2c2c] mb-2">
                Verifying your email...
              </h1>
              <p className="text-[#6b6b6b]">
                Please wait while we verify your email address
              </p>
            </>
          )}

          {status === 'success' && (
            <>
              <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
              <h1 className="font-serif text-2xl font-bold text-[#2c2c2c] mb-2">
                Email verified successfully!
              </h1>
              <p className="text-[#6b6b6b] mb-4">
                Your email has been verified. Redirecting to dashboard...
              </p>
              <div className="text-sm text-[#6b6b6b]">
                If redirect doesn't happen,
                <button
                  onClick={() => {
                    if (isSupplier) { navigate('/supplier/dashboard'); return; }
                    const role = localStorage.getItem('active_role');
                    navigate(role ? (role === 'company' ? '/company' : '/dashboard') : '/onboarding');
                  }}
                  className="text-[#b8864a] font-semibold hover:underline ml-1"
                >
                  click here
                </button>
              </div>
            </>
          )}

          {status === 'error' && (
            <>
              <XCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
              <h1 className="font-serif text-2xl font-bold text-[#2c2c2c] mb-2">
                Verification Failed
              </h1>
              <p className="text-[#6b6b6b] mb-4">
                {error}
              </p>
              <div className="space-y-2">
                <button
                  onClick={() => navigate('/auth')}
                  className="w-full py-3 px-4 rounded-lg bg-[#b8864a] text-white font-semibold hover:bg-[#a67c47] transition"
                >
                  Back to Login
                </button>
                <p className="text-sm text-[#6b6b6b]">
                  If the problem persists, please contact support
                </p>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
