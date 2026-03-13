import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { CheckCircle, XCircle, Loader } from 'lucide-react';
import { api } from '../lib/api';

export default function VerifyEmailPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const token = searchParams.get('token');
    
    if (!token) {
      setStatus('error');
      setError('Invalid verification link');
      return;
    }

    const verifyEmail = async () => {
      try {
        const response = await api.post('/auth/verify-email', { token });
        
        api.setToken(response.token);
        localStorage.setItem('designer', JSON.stringify(response.designer));
        
        setStatus('success');
        
        setTimeout(() => {
          navigate('/designer/dashboard');
        }, 2000);
      } catch (err: any) {
        setStatus('error');
        setError(err.message || 'Verification failed, please try again later');
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
                Your email has been verified. Redirecting to designer dashboard...
              </p>
              <div className="text-sm text-[#6b6b6b]">
                If redirect doesn't happen,
                <button
                  onClick={() => navigate('/designer/dashboard')}
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
