import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { AlertCircle, CheckCircle, Eye, EyeOff, Lock } from 'lucide-react';
import { adminApi } from '../../lib/adminApi';

export default function AdminResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [token, setToken] = useState<string | null>(null);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const value = searchParams.get('token');
    if (!value) {
      setError('Invalid reset link. Please request a new one.');
      return;
    }
    setToken(value);
  }, [searchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!token) {
      setError('Invalid reset token.');
      return;
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      await adminApi.resetPassword(token, password);
      setSuccess(true);
      setTimeout(() => navigate('/admin/login'), 1500);
    } catch (err: any) {
      setError(err.message || 'Failed to reset password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-[#faf9f7] px-4 pb-16 pt-[clamp(28px,10vh,96px)] sm:px-6 sm:pt-[clamp(40px,12vh,120px)]">
      <div className="mx-auto w-full max-w-md">
        <div className="bg-white rounded-lg border border-stone-200 shadow-sm p-8">
          <h1 className="text-2xl font-bold text-[#2c2c2c] mb-2 text-center">Reset Admin Password</h1>
          <p className="text-stone-600 text-center mb-6">Set your new admin password.</p>

          {success ? (
            <div className="p-4 rounded-lg bg-green-50 border border-green-200 flex items-start gap-3">
              <CheckCircle className="w-5 h-5 text-green-500 shrink-0 mt-0.5" />
              <p className="text-sm text-green-700">Password reset successfully. Redirecting to login...</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              {error && (
                <div className="p-4 rounded-lg bg-red-50 border border-red-200 flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm text-red-700">{error}</p>
                    {!token && (
                      <Link to="/admin/forgot-password" className="text-sm font-medium text-[#b8864a] hover:underline mt-2 inline-block">
                        Request a new link
                      </Link>
                    )}
                  </div>
                </div>
              )}

              {token && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-stone-700 mb-1">New Password</label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
                      <input
                        type={showPassword ? 'text' : 'password'}
                        minLength={8}
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="At least 8 characters"
                        className="w-full h-11 px-3 py-2.5 pl-10 pr-10 rounded-lg border border-stone-200 bg-white text-sm text-[#2c2c2c] focus:outline-none focus:border-[#b8864a] focus:ring-2 focus:ring-[#b8864a]/40"
                      />
                      <button
                        type="button"
                        tabIndex={-1}
                        onClick={() => setShowPassword((value) => !value)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-[#b8864a]"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-stone-700 mb-1">Confirm Password</label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
                      <input
                        type={showPassword ? 'text' : 'password'}
                        minLength={8}
                        required
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="Confirm password"
                        className="w-full h-11 px-3 py-2.5 pl-10 rounded-lg border border-stone-200 bg-white text-sm text-[#2c2c2c] focus:outline-none focus:border-[#b8864a] focus:ring-2 focus:ring-[#b8864a]/40"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-[#b8864a] text-white py-3 px-4 rounded-lg font-medium hover:bg-[#a67c47] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {loading ? 'Resetting...' : 'Reset Password'}
                  </button>
                </>
              )}
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
