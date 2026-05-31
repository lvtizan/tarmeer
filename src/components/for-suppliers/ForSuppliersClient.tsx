'use client';

import { useState, useEffect, useRef } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { ChevronRight, Mail, Lock, Eye, EyeOff, Check, Package, Search, Globe } from 'lucide-react';
import { AUTH_INPUT_CLASS, AUTH_SOCIAL_BUTTON_CLASS } from '@/components/auth/authCardStyles';
import AuthCardShell from '@/components/auth/AuthCardShell';
import LoadingButton from '@/components/ui/LoadingButton';

const API_BASE = process.env.NEXT_PUBLIC_API_URL?.trim() || '/api';
const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
const MIN_PASSWORD_LENGTH = 6;

type AuthStep = 'initial' | 'password' | 'done';

function useSupplierVerificationPoller(email: string | null) {
  const router = useRouter();
  const timerRef = useRef<ReturnType<typeof setInterval>>(undefined);
  const stoppedRef = useRef(false);

  useEffect(() => {
    if (!email || stoppedRef.current) return;

    timerRef.current = setInterval(async () => {
      try {
        const res = await fetch(`${API_BASE}/supplier/auth/check-verified?email=${encodeURIComponent(email)}`);
        if (!res.ok) return;
        const data = await res.json() as { verified?: boolean; token?: string; user?: unknown };
        if (data.verified && data.token) {
          stoppedRef.current = true;
          clearInterval(timerRef.current);
          localStorage.setItem('supplier_token', data.token);
          if (data.user) localStorage.setItem('supplier_user', JSON.stringify(data.user));
          router.replace('/supplier/dashboard');
        }
      } catch {
        // ignore polling errors
      }
    }, 3000);

    return () => clearInterval(timerRef.current);
  }, [email, router]);
}

function SupplierAuthCard() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [step, setStep] = useState<AuthStep>('initial');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isNewEmail, setIsNewEmail] = useState<boolean | null>(null);
  const [emailConflict, setEmailConflict] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pollingEmail, setPollingEmail] = useState<string | null>(null);

  useSupplierVerificationPoller(pollingEmail);

  useEffect(() => {
    const token = searchParams.get('token');
    if (token) {
      localStorage.setItem('supplier_token', token);
      router.replace('/supplier/dashboard');
      return;
    }
    const err = searchParams.get('error');
    if (err === 'email_is_homeowner') setError('This email is registered as a different account. Please use another email.');
    else if (err) setError('Google sign-in failed. Please try again.');
  }, [searchParams, router]);

  useEffect(() => {
    if (typeof window !== 'undefined' && localStorage.getItem('supplier_token')) {
      router.replace('/supplier/dashboard');
    }
  }, [router]);

  useEffect(() => {
    if (!email || !EMAIL_REGEX.test(email)) { setIsNewEmail(null); setEmailConflict(false); return; }
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`${API_BASE}/supplier/auth/check-availability`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email }),
        });
        const data = await res.json() as { conflict?: string; isNewEmail?: boolean };
        if (data.conflict === 'homeowner') {
          setIsNewEmail(null);
          setEmailConflict(true);
        } else {
          setEmailConflict(false);
          setIsNewEmail(data.isNewEmail === true);
        }
      } catch { setIsNewEmail(null); setEmailConflict(false); }
    }, 500);
    return () => clearTimeout(t);
  }, [email]);

  const handleEmailContinue = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !EMAIL_REGEX.test(email)) { setError('Please enter a valid email'); return; }
    if (emailConflict) return;
    setError(null);
    setStep('password');
  };

  const performLogin = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/supplier/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json() as { token?: string; user?: unknown; error?: string };
      if (!res.ok) throw new Error(data.error || 'Login failed.');
      localStorage.setItem('supplier_token', data.token!);
      if (data.user) localStorage.setItem('supplier_user', JSON.stringify(data.user));
      router.push('/supplier/dashboard');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const performRegister = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/supplier/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json() as { error?: string };
      if (!res.ok) throw new Error(data.error || 'Registration failed.');

      try {
        const loginRes = await fetch(`${API_BASE}/supplier/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password }),
        });
        const loginData = await loginRes.json() as { token?: string; user?: unknown };
        if (loginRes.ok) {
          localStorage.setItem('supplier_token', loginData.token!);
          if (loginData.user) localStorage.setItem('supplier_user', JSON.stringify(loginData.user));
          router.push('/supplier/dashboard');
          return;
        }
      } catch { /* email verification required */ }

      setPollingEmail(email);
      setStep('done');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password || password.length < MIN_PASSWORD_LENGTH) {
      setError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters`);
      return;
    }
    setError(null);

    let resolvedIsNew = isNewEmail;
    if (resolvedIsNew === null) {
      try {
        const res = await fetch(`${API_BASE}/supplier/auth/check-availability`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email }),
        });
        const data = await res.json() as { isNewEmail?: boolean };
        resolvedIsNew = data.isNewEmail === true;
      } catch { resolvedIsNew = false; }
    }

    if (resolvedIsNew) {
      await performRegister();
    } else {
      await performLogin();
    }
  };

  return (
    <AuthCardShell className="mx-auto lg:mx-0 order-2 lg:order-1">
      <div className="mb-5">
        <h2 className="text-[18px] font-bold text-[#1c1917]">
          {step === 'done' ? 'Check your inbox' : isNewEmail === false ? 'Welcome back' : 'Join Tarmeer as a Supplier'}
        </h2>
        {step === 'initial' && (
          <p className="text-sm text-stone-500 mt-1">Create your supplier account or sign in</p>
        )}
      </div>

      {error && (
        <div className="mb-4 rounded-xl border border-red-100 bg-red-50/50 p-3 text-sm text-red-600">{error}</div>
      )}

      {step === 'initial' && (
        <div className="space-y-4">
          <a href={`${API_BASE}/supplier/auth/google`} className={AUTH_SOCIAL_BUTTON_CLASS}>
            <svg className="h-[18px] w-[18px]" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            Continue with Google
          </a>

          <div className="relative my-5">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-stone-100" />
            </div>
            <div className="relative flex justify-center">
              <span className="px-4 bg-white text-[10px] text-stone-400 font-medium tracking-[0.15em]">OR CONTINUE WITH EMAIL</span>
            </div>
          </div>

          <form onSubmit={handleEmailContinue} className="space-y-4">
            <div className="relative">
              <Mail className="absolute left-5 top-1/2 -translate-y-1/2 h-[18px] w-[18px] text-stone-400" />
              <input
                type="email"
                value={email}
                onChange={e => { setEmail(e.target.value); setError(null); }}
                placeholder="Enter your email"
                className={`${AUTH_INPUT_CLASS} pl-[52px] pr-[100px]`}
              />
              {isNewEmail === true && <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-medium text-emerald-600">New account</span>}
              {isNewEmail === false && <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-medium text-stone-500">Sign in</span>}
            </div>
            {emailConflict && (
              <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-4 py-2.5">
                This email has a Tarmeer account. Please{' '}
                <a href="/auth" className="font-semibold underline hover:text-amber-900">sign in there</a>
                {' '}or use a different email for your supplier account.
              </p>
            )}
            <button
              type="submit"
              disabled={emailConflict}
              className="w-full h-[54px] rounded-2xl bg-[#B8864A] text-white font-semibold text-[15px] hover:bg-[#a3780a] transition-all duration-200 shadow-[0_4px_20px_rgba(184,134,74,0.25)] disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Continue with email
            </button>
          </form>

          <p className="text-[10px] text-stone-400 text-center mt-5">
            By continuing, you agree to our{' '}
            <a href="/privacy" className="text-stone-500 hover:text-[#B8864A] transition-colors">Terms</a>
            {' '}•{' '}
            <a href="/privacy" className="text-stone-500 hover:text-[#B8864A] transition-colors">Privacy</a>
          </p>
        </div>
      )}

      {step === 'password' && (
        <div className="space-y-5">
          <button
            type="button"
            onClick={() => { setStep('initial'); setPassword(''); setError(null); }}
            className="text-sm text-stone-400 hover:text-[#1c1917] transition flex items-center gap-1"
          >
            <ChevronRight className="w-4 h-4 rotate-180" />
            Back
          </button>

          <form onSubmit={handlePasswordSubmit} className="space-y-4">
            <p className="text-sm text-stone-500">
              {isNewEmail ? 'Create a password for' : 'Enter password for'}{' '}
              <span className="font-medium text-[#1c1917]">{email}</span>
            </p>

            <div className="relative">
              <Lock className="absolute left-5 top-1/2 -translate-y-1/2 h-5 w-5 text-stone-400" />
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={e => { setPassword(e.target.value); setError(null); }}
                placeholder="Enter your password"
                autoFocus
                className={`${AUTH_INPUT_CLASS} pl-[52px] pr-12`}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 p-2 hover:bg-stone-100 rounded-lg transition"
              >
                {showPassword ? <EyeOff className="w-5 h-5 text-stone-400" /> : <Eye className="w-5 h-5 text-stone-400" />}
              </button>
            </div>

            <LoadingButton
              type="submit"
              loading={loading}
              className="w-full h-[54px] rounded-2xl font-semibold bg-[#B8864A] text-white hover:bg-[#a3780a] transition-all duration-200 shadow-[0_4px_20px_rgba(184,134,74,0.25)]"
            >
              {isNewEmail ? 'Create Account' : 'Sign In'}
            </LoadingButton>
          </form>
        </div>
      )}

      {step === 'done' && (
        <div className="text-center py-4">
          <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-3">
            <Check className="w-6 h-6 text-emerald-600" />
          </div>
          <h3 className="font-semibold text-[#1c1917] mb-2">Verify your email</h3>
          <p className="text-sm text-[#6b6b6b]">
            We sent a link to <strong>{email}</strong>. Click it to activate your account — this page will update automatically.
          </p>
          <div className="mt-4 flex items-center justify-center gap-2 text-[13px] text-stone-400">
            <div className="w-3 h-3 rounded-full border-2 border-stone-300 border-t-[#b8864a] animate-spin" />
            Waiting for verification…
          </div>
        </div>
      )}
    </AuthCardShell>
  );
}

const FEATURES = [
  {
    icon: Package,
    tag: 'LIST PRODUCTS',
    title: 'Showcase Your Catalogue',
    desc: ['Upload products, projects, and PDF catalogues.', 'Designers browse by category and origin.'],
    checks: ['Products with photos & specs', 'PDF catalogue downloads', 'Project case studies'],
  },
  {
    icon: Search,
    tag: 'GET DISCOVERED',
    title: 'Reach UAE Designers',
    desc: ['Your profile appears when renovation companies search materials in your categories.', 'SEO-optimised listing included.'],
    checks: ['China & Dubai supplier directory', 'Category & origin filtering', 'SEO-optimised profile page'],
  },
  {
    icon: Globe,
    tag: 'SUPPLY CHAIN ACCESS',
    title: "Enter UAE's Renovation Supply Chain",
    desc: ["Tarmeer connects UAE renovation companies with verified China and Dubai suppliers.", "Your listing becomes part of how they source."],
    checks: ['Access to China supply chain network', 'Listed in renovation company searches', 'Verified supplier presence on Tarmeer'],
  },
];

export default function ForSuppliersClient() {
  return (
    <div>
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div
          className="absolute inset-0 bg-cover bg-center bg-no-repeat"
          style={{ backgroundImage: 'url(/images/supplier-hero.jpg)' }}
        />
        <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(28,25,23,0.90)_0%,rgba(28,25,23,0.78)_50%,rgba(28,25,23,0.65)_100%)]" />

        <div className="relative max-w-5xl mx-auto px-4 sm:px-6 py-16 lg:py-24 grid lg:grid-cols-[1fr_auto] gap-8 lg:gap-10 items-center">
          <div>
            <p className="text-sm font-semibold text-[#c6a065] uppercase tracking-wider">
              UAE&apos;S INTERIOR DESIGN PLATFORM
            </p>
            <h1 className="font-serif text-4xl lg:text-5xl font-bold text-white leading-tight mt-4">
              Renovation Companies Are Sourcing{' '}
              <span className="text-[#c6a065]">Your Materials</span>
            </h1>
            <p className="text-lg text-white/70 mt-6 max-w-lg">
              Tarmeer is where UAE renovation companies source materials. List your products and catalogue to be discovered by designers and project managers actively sourcing from China and Dubai.
            </p>

            <div className="mt-8 flex flex-wrap gap-4">
              {['China suppliers welcome', 'Dubai-based suppliers', 'Verified supplier network'].map(item => (
                <div key={item} className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-[#c6a065] flex-shrink-0" />
                  <span className="text-[15px] text-white/80">{item}</span>
                </div>
              ))}
            </div>
          </div>

          <SupplierAuthCard />
        </div>
      </section>

      {/* Features */}
      <section className="bg-[#1c1917] py-14 lg:py-20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-px bg-white/10 rounded-2xl overflow-hidden">
            {FEATURES.map((feat) => (
              <div key={feat.tag} className="bg-[#1c1917] p-6 sm:p-8">
                <div className="flex items-center gap-3 mb-4">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#b8864a]/15">
                    <feat.icon className="w-5 h-5 text-[#c6a065]" />
                  </div>
                  <p className="text-[11px] font-semibold text-[#c6a065] uppercase tracking-wider">{feat.tag}</p>
                </div>
                <h3 className="font-serif text-xl font-bold text-white min-h-[3.5rem]">{feat.title}</h3>
                <div className="mt-2 space-y-1">
                  {feat.desc.map((line, i) => (
                    <p key={i} className="text-[14px] text-white/55 leading-relaxed">{line}</p>
                  ))}
                </div>
                <div className="mt-4 space-y-2">
                  {feat.checks.map(c => (
                    <div key={c} className="flex items-center gap-2">
                      <Check className="w-4 h-4 text-[#c6a065] flex-shrink-0" />
                      <span className="text-[14px] text-white/80">{c}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
