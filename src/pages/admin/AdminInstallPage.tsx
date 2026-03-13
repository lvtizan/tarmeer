import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { LayoutDashboard } from 'lucide-react';
import { useAdmin } from '../../contexts/AdminContext';
import PasswordInput from '../../components/admin/PasswordInput';

const PRIMARY = '#b8864a';

export default function AdminInstallPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { install, admin, isInstalled, isLoading: contextLoading } = useAdmin();
  const navigate = useNavigate();

  useEffect(() => {
    if (admin) {
      navigate('/admin');
    }
  }, [admin, navigate]);

  useEffect(() => {
    if (isInstalled === true) {
      navigate('/admin/login');
    }
  }, [isInstalled, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }

    setIsLoading(true);

    try {
      await install(email, password, fullName);
      navigate('/admin');
    } catch (err: any) {
      setError(err.message || 'Installation failed');
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
          <h1 className="text-3xl font-bold text-[#2c2c2c]">Welcome to Tarmeer</h1>
          <p className="mt-2 text-sm text-stone-600">
            Create your super admin account to get started
          </p>
        </div>

        <div className="bg-white py-8 px-6 shadow-sm rounded-lg border border-stone-200">
          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg text-sm">
                {error}
              </div>
            )}

            <div>
              <label htmlFor="fullName" className="block text-sm font-medium text-stone-700 mb-1">
                Full Name
              </label>
              <input
                id="fullName"
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
                autoFocus
                className="w-full px-3 py-2.5 border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#b8864a]/40 focus:border-[#b8864a]"
                placeholder="Admin User"
              />
            </div>

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
                className="w-full px-3 py-2.5 border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#b8864a]/40 focus:border-[#b8864a]"
                placeholder="admin@tarmeer.com"
              />
            </div>

            <PasswordInput
              id="password"
              value={password}
              onChange={setPassword}
              placeholder="Minimum 8 characters"
              required
              minLength={8}
            />

            <PasswordInput
              id="confirmPassword"
              value={confirmPassword}
              onChange={setConfirmPassword}
              placeholder="Confirm your password"
              required
              label="Confirm Password"
            />

            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-[#b8864a] text-white py-3 px-4 rounded-lg font-medium hover:bg-[#a67c47] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? 'Creating account...' : 'Create Super Admin'}
            </button>
          </form>
        </div>

        <p className="mt-4 text-center text-xs text-stone-500">
          This account will have full administrative access to the system.
        </p>
      </div>
    </div>
  );
}
