import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Mail, AlertCircle, CheckCircle } from 'lucide-react';
import { api } from '../lib/api';
import LoadingButton from '../components/ui/LoadingButton';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      await api.post('/auth/forgot-password', { email });
      setSuccess(true);
    } catch (err: any) {
      setError(err.message || 'Failed to send reset email. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#faf9f7] flex items-center justify-center px-4">
      <div className="max-w-md w-full">
        <div className="bg-white rounded-lg border border-stone-200 shadow-sm p-8">
          <h1 className="font-serif text-2xl font-bold text-[#2c2c2c] mb-2 text-center">
            Forgot Password
          </h1>
          <p className="text-[#6b6b6b] text-center mb-6">
            Enter your email and we'll send you a link to reset your password.
          </p>

          {success ? (
            <div className="p-4 rounded-lg bg-green-50 border border-green-200 flex items-start gap-3">
              <CheckCircle className="w-5 h-5 text-green-500 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm text-green-700">
                  If that email is registered, you will receive a password reset link shortly.
                </p>
                <Link to="/auth" className="text-sm font-medium text-[#b8864a] hover:underline mt-2 inline-block">
                  Back to Login
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
                <label className="block text-sm font-semibold text-[#2c2c2c]">Email</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="designer@example.com"
                    className="w-full h-11 px-3 py-2.5 pl-10 rounded-lg border border-stone-200 bg-white text-sm text-[#2c2c2c] placeholder:text-[#6b6b6b] focus:outline-none focus:border-[#b8864a] focus:ring-2 focus:ring-[#b8864a]/40 transition-all"
                  />
                </div>
              </div>

              <LoadingButton
                type="submit"
                loading={loading}
                className="w-full h-11 rounded-lg font-medium btn-primary text-white disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Send Reset Link
              </LoadingButton>

              <p className="text-center text-sm text-[#6b6b6b]">
                Remember your password?{' '}
                <Link to="/auth" className="font-medium text-[#b8864a] hover:underline">
                  Sign in
                </Link>
              </p>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
