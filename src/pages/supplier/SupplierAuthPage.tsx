import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import TarmeerLogo from '../../components/TarmeerLogo';

const API_BASE = import.meta.env.VITE_API_URL?.trim() || '/api';

function getSupplierToken() { return localStorage.getItem('supplier_token'); }
function setSupplierToken(t: string) { localStorage.setItem('supplier_token', t); }

export default function SupplierAuthPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState('');

  // Handle Google OAuth callback
  useEffect(() => {
    const token = searchParams.get('token');
    if (token) {
      setSupplierToken(token);
      navigate('/supplier/dashboard', { replace: true });
    }
    const err = searchParams.get('error');
    if (err === 'email_is_homeowner') setError('This email is registered as a homeowner/company account. Please use a different email.');
    else if (err) setError('Google sign-in failed. Please try again.');
  }, [searchParams, navigate]);

  // If already logged in, redirect
  useEffect(() => {
    if (getSupplierToken()) navigate('/supplier/dashboard', { replace: true });
  }, [navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      if (mode === 'register') {
        const res = await fetch(`${API_BASE}/supplier/auth/register`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password, full_name: fullName, phone: phone || undefined }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Registration failed.');
        setSuccess('Account created! Please check your email to verify, then sign in.');
        setMode('login');
      } else {
        const res = await fetch(`${API_BASE}/supplier/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Login failed.');
        setSupplierToken(data.token);
        localStorage.setItem('supplier_user', JSON.stringify(data.user));
        navigate('/supplier/dashboard');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#faf9f7] flex items-center justify-center p-4">
      <Helmet><title>Supplier Login - Tarmeer</title></Helmet>
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <TarmeerLogo className="h-8 mx-auto mb-4" />
          <h1 className="text-xl font-bold text-[#2c2c2c]">Supplier Portal</h1>
          <p className="text-sm text-stone-500 mt-1">{mode === 'login' ? 'Sign in to manage your products' : 'Create your supplier account'}</p>
        </div>

        <div className="bg-white rounded-2xl border border-stone-200 shadow-sm p-6 space-y-5">
          {/* Google OAuth */}
          <a href={`${API_BASE}/supplier/auth/google`}
            className="flex h-12 w-full items-center justify-center gap-3 rounded-xl border border-stone-200 bg-white text-[15px] font-medium text-[#1c1917] hover:bg-stone-50 transition">
            <svg className="h-[18px] w-[18px]" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            Continue with Google
          </a>

          <div className="relative">
            <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-stone-200" /></div>
            <div className="relative flex justify-center"><span className="px-4 bg-white text-[10px] text-stone-400 font-medium tracking-widest">OR</span></div>
          </div>

          {success && <p className="text-sm text-emerald-700 bg-emerald-50 px-3 py-2 rounded-lg">{success}</p>}
          {error && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}

          <form onSubmit={handleSubmit} className="space-y-3">
            {mode === 'register' && (
              <>
                <input type="text" value={fullName} onChange={e => setFullName(e.target.value)} placeholder="Full name"
                  className="w-full h-11 px-4 rounded-xl border border-stone-200 bg-stone-50/80 text-[15px] text-[#1c1917] placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-[#b8864a]/15 focus:border-[#b8864a] transition" />
                <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="Phone (optional)"
                  className="w-full h-11 px-4 rounded-xl border border-stone-200 bg-stone-50/80 text-[15px] text-[#1c1917] placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-[#b8864a]/15 focus:border-[#b8864a] transition" />
              </>
            )}
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="Email" required
              className="w-full h-11 px-4 rounded-xl border border-stone-200 bg-stone-50/80 text-[15px] text-[#1c1917] placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-[#b8864a]/15 focus:border-[#b8864a] transition" />
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Password" required
              className="w-full h-11 px-4 rounded-xl border border-stone-200 bg-stone-50/80 text-[15px] text-[#1c1917] placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-[#b8864a]/15 focus:border-[#b8864a] transition" />
            <button type="submit" disabled={loading}
              className="w-full h-12 rounded-xl bg-[#b8864a] text-white font-semibold text-[15px] hover:bg-[#a67c47] disabled:opacity-50 transition">
              {loading ? 'Please wait...' : mode === 'login' ? 'Sign In' : 'Create Account'}
            </button>
          </form>

          <p className="text-center text-sm text-stone-500">
            {mode === 'login' ? "Don't have an account? " : 'Already have an account? '}
            <button type="button" onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError(''); setSuccess(''); }}
              className="text-[#b8864a] font-medium hover:underline">
              {mode === 'login' ? 'Register' : 'Sign In'}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
