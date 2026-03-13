import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { Lock, Eye, EyeOff, AlertCircle, CheckCircle, Loader2 } from 'lucide-react';
import { api } from '../lib/api';
import LoadingButton from '../components/ui/LoadingButton';

export default function ResetPasswordPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    const t = searchParams.get('token');
    if (!t) {
      setError('Invalid reset link. Please request a new password reset.');
    } else {
      setToken(t);
    }
  }, [searchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    if (!token) {
      setError('Invalid reset token.');
      return;
    }

    setLoading(true);

    try {
      const response = await api.post('/auth/reset-password', { token, password });
      api.setToken(response.token);
      localStorage.setItem('designer', JSON.stringify(response.designer));
      setSuccess(true);
      setTimeout(() => {
        navigate('/designer/dashboard');
      }, 2000);
    } catch (err: any) {
      setError(err.message || 'Failed to reset password. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (!token && !error) {
    return (
      <div className="min-h-screen bg-[#faf9f7] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-[#b8864a] animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#faf9f7] flex items-center justify-center px-4">
      <div className="max-w-md w-full">
        <div className="bg-white rounded-lg border border-stone-200 shadow-sm p-8">
          <h1 className="font-serif text-2xl font-bold text-[#2c2c2c] mb-2 text-center">
            Reset Password
          </h1>
          <p className="text-[#6b6b6b] text-center mb-6">
            Enter your new password below.
          </p>

          {success ? (
            <div className="p-4 rounded-lg bg-green-50 border border-green-200 flex items-start gap-3">
              <CheckCircle className="w-5 h-5 text-green-500 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm text-green-700">
                  Password reset successfully! Redirecting to dashboard...
                </p>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              {error && (
                <div className="p-4 rounded-lg bg-red-50 border border-red-200 flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm text-red-700">{error}</p>
                    {error.includes('Invalid') && (
                      <Link to="/forgot-password" className="text-sm font-medium text-[#b8864a] hover:underline mt-2 inline-block">
                        Request a new reset link
                      </Link>
                    )}
                  </div>
                </div>
              )}

              {token && (
                <>
                  <div className="space-y-1.5">
                    <label className="block text-sm font-semibold text-[#2c2c2c]">New Password</label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
                      <input
                        type={showPassword ? 'text' : 'password'}
                        required
                        minLength={6}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="6+ characters"
                        className="w-full h-11 px-3 py-2.5 pl-10 pr-10 rounded-lg border border-stone-200 bg-white text-sm text-[#2c2c2c] placeholder:text-[#6b6b6b] focus:outline-none focus:border-[#b8864a] focus:ring-2 focus:ring-[#b8864a]/40 transition-all"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((v) => !v)}
                        tabIndex={-1}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-[#b8864a]"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-sm font-semibold text-[#2c2c2c]">Confirm Password</label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
                      <input
                        type={showPassword ? 'text' : 'password'}
                        required
                        minLength={6}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="Confirm password"
                        className="w-full h-11 px-3 py-2.5 pl-10 rounded-lg border border-stone-200 bg-white text-sm text-[#2c2c2c] placeholder:text-[#6b6b6b] focus:outline-none focus:border-[#b8864a] focus:ring-2 focus:ring-[#b8864a]/40 transition-all"
                      />
                    </div>
                  </div>

                  <LoadingButton
                    type="submit"
                    loading={loading}
                    className="w-full h-11 rounded-lg font-medium btn-primary text-white disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Reset Password
                  </LoadingButton>
                </>
              )}
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
