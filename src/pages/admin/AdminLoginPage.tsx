import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { LayoutDashboard } from 'lucide-react';
import { useAdmin } from '../../contexts/AdminContext';
import PasswordInput from '../../components/admin/PasswordInput';

const PRIMARY = '#b8864a';

export default function AdminLoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { login, admin, isInstalled, isLoading: contextLoading } = useAdmin();
  const navigate = useNavigate();

  useEffect(() => {
    if (admin) {
      navigate('/admin');
    }
  }, [admin, navigate]);

  useEffect(() => {
    if (isInstalled === false) {
      navigate('/admin/install');
    }
  }, [isInstalled, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      await login(email, password);
      navigate('/admin');
    } catch (err: any) {
      setError(err.message || 'Login failed');
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
    <div className="min-h-screen flex items-center justify-center bg-[#faf9f7] py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center size-12 rounded-xl mb-4" style={{ backgroundColor: `${PRIMARY}20` }}>
            <LayoutDashboard className="w-7 h-7" style={{ color: PRIMARY }} />
          </div>
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
