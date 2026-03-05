import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Mail, Lock, Eye, EyeOff, LogIn } from 'lucide-react';

const PRIMARY = '#b8864a';

export default function LoginPage() {
  const [showPassword, setShowPassword] = useState(false);
  const [form, setForm] = useState({
    email: '',
    password: '',
    remember: false,
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, type, checked, value } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // TODO: API → redirect to /designer/upload
  };

  return (
    <div className="bg-[#faf9f7] text-[#2c2c2c] min-h-screen flex flex-col">
      {/* Simple header */}
      <header className="flex items-center justify-between border-b border-[#e5e5e5] px-4 sm:px-6 lg:px-10 py-4 bg-white/90 backdrop-blur">
        <div className="flex items-center gap-3">
          <div className="text-[24px]" style={{ color: PRIMARY }}>
            <span className="font-serif">T</span>
          </div>
          <h2 className="text-lg sm:text-xl font-semibold tracking-tight">Tarmeer.com</h2>
        </div>
        <div className="flex gap-3">
          <button
            type="button"
            className="inline-flex items-center justify-center rounded-lg h-9 px-4 text-sm font-bold"
            style={{ backgroundColor: `${PRIMARY}1a`, color: '#2c2c2c' }}
          >
            Help
          </button>
        </div>
      </header>

      {/* Centered login card */}
      <main className="flex flex-1 items-center justify-center px-4 py-10">
        <div className="w-full max-w-[440px] space-y-8">
          <div className="text-center">
            <h1 className="text-3xl sm:text-4xl font-bold leading-tight tracking-tight">
              Designer Login
            </h1>
            <p className="mt-2 text-[#6b6b6b] text-base">
              Welcome back! Enter your details to access your studio.
            </p>
          </div>

          <form
            onSubmit={handleSubmit}
            className="space-y-6 bg-white rounded-2xl border border-stone-200 shadow-sm p-6 sm:p-7"
          >
            {/* Email */}
            <div className="space-y-2">
              <label className="block text-sm font-semibold text-[#2c2c2c]">
                Email Address
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400">
                  <Mail className="w-4 h-4" />
                </span>
                <input
                  name="email"
                  type="email"
                  required
                  value={form.email}
                  onChange={handleChange}
                  placeholder="designer@tarmeer.com"
                  className="w-full pl-9 pr-3 h-11 rounded-xl border border-[#e5d6c5] bg-white text-sm focus:border-[#b8864a] focus-visible:ring-2 focus-visible:ring-[#b8864a]/40 outline-none transition placeholder:text-stone-400"
                />
              </div>
            </div>

            {/* Password */}
            <div className="space-y-2">
              <label className="block text-sm font-semibold text-[#2c2c2c]">
                Password
              </label>
              <div className="relative flex items-center">
                <span className="absolute left-3 text-stone-400">
                  <Lock className="w-4 h-4" />
                </span>
                <input
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={form.password}
                  onChange={handleChange}
                  placeholder="Enter your password"
                  className="w-full pl-9 pr-9 h-11 rounded-xl border border-[#e5d6c5] bg-white text-sm focus:border-[#b8864a] focus-visible:ring-2 focus-visible:ring-[#b8864a]/40 outline-none transition placeholder:text-stone-400"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 text-stone-400 hover:text-[#b8864a] transition-colors"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Remember + forgot */}
            <div className="flex items-center justify-between pt-1">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  name="remember"
                  checked={form.remember}
                  onChange={handleChange}
                  className="h-4 w-4 rounded border-stone-300 text-[#b8864a] focus:ring-[#b8864a]"
                />
                <span className="text-sm text-[#6b6b6b]">Remember me</span>
              </label>
              <button
                type="button"
                className="text-sm font-semibold"
                style={{ color: PRIMARY }}
              >
                Forgot password?
              </button>
            </div>

            {/* Primary action */}
            <div className="pt-2 space-y-4">
              <button
                type="submit"
                className="w-full h-11 rounded-xl font-semibold flex items-center justify-center gap-2 shadow-md"
                style={{ backgroundColor: PRIMARY, color: '#1c1917' }}
              >
                <span>Login to Studio</span>
                <LogIn className="w-4 h-4" />
              </button>

              <div className="text-center text-sm text-[#6b6b6b]">
                <p>Don&apos;t have an account yet?</p>
                <Link
                  to="/register"
                  className="mt-2 inline-flex w-full items-center justify-center h-11 rounded-xl border-2 border-[#e5d6c5] font-semibold hover:border-[#b8864a] hover:bg-[#b8864a]/5 transition-colors"
                  style={{ color: '#2c2c2c' }}
                >
                  Create Designer Account
                </Link>
              </div>
            </div>
          </form>
        </div>
      </main>
    </div>
  );
}

