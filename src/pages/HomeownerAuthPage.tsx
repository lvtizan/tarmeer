import { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { Mail, Lock, Eye, EyeOff, AlertCircle, CheckCircle, ChevronRight, Briefcase, Users } from 'lucide-react';
import { api } from '../lib/api';
import LoadingButton from '../components/ui/LoadingButton';
import Navbar from '../components/Navbar';
import { MIN_PASSWORD_LENGTH } from '../lib/constants';
import AuthCardShell from '../components/auth/AuthCardShell';
import { AUTH_INPUT_CLASS, AUTH_SOCIAL_BUTTON_CLASS } from '../components/auth/authCardStyles';
import { useVerificationPoller } from '../hooks/useVerificationPoller';

const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
// Google Auth: enabled by default (backend is configured), disable explicitly with 'false'
const ENABLE_GOOGLE_AUTH = import.meta.env.VITE_ENABLE_GOOGLE_AUTH !== 'false';
// Facebook Auth: disabled by default until configured
const ENABLE_FACEBOOK_AUTH = import.meta.env.VITE_ENABLE_FACEBOOK_AUTH === 'true';

type AuthStep = 'initial' | 'password' | 'done';

const valuePoints = [
  {
    icon: Briefcase,
    title: 'Find the right company',
    description: 'Browse verified renovation companies and design studios across the UAE.',
  },
  {
    icon: Users,
    title: 'Get matched with professionals',
    description: 'Submit your requirements and connect with trusted partners for your project.',
  },
];

export default function HomeownerAuthPage() {
  const navigate = useNavigate();
  const emailInputRef = useRef<HTMLInputElement>(null);
  const passwordInputRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<AuthStep>('initial');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isNewEmail, setIsNewEmail] = useState<boolean | null>(null); // null = unknown, true = new, false = existing

  const [searchParams] = useSearchParams();
  const authRole = searchParams.get('role') === 'company' ? 'company' : 'homeowner';

  // Poll for email verification — auto-login when user verifies in another tab/device
  useVerificationPoller(step === 'done' ? email : null, authRole);


  // Pre-fill email from URL (from /join email continue)
  useEffect(() => {
    const urlEmail = searchParams.get('email');
    if (urlEmail && !email) {
      setEmail(urlEmail);
      setStep('password');
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const error = searchParams.get('error');
    if (error) {
      setError(decodeURIComponent(error));
    }
  }, [searchParams]);

  // Check email availability when email changes (debounced)
  useEffect(() => {
    const checkEmailAvailability = async () => {
      if (!email || !EMAIL_REGEX.test(email)) {
        setIsNewEmail(null);
        return;
      }
      try {
        const result = await api.post('/auth/check-availability', { email });
        setIsNewEmail(result.emailAvailable === true);
      } catch {
        setIsNewEmail(null);
      }
    };

    const timeoutId = setTimeout(checkEmailAvailability, 500);
    return () => clearTimeout(timeoutId);
  }, [email]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (step === 'initial' && emailInputRef.current) {
        emailInputRef.current.focus();
      } else if (step === 'password' && passwordInputRef.current) {
        passwordInputRef.current.focus();
      }
    }, 100);
    return () => clearTimeout(timer);
  }, [step]);

  const handleEmailContinue = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !EMAIL_REGEX.test(email)) {
      setError('Please enter a valid email address');
      return;
    }
    setError(null);
    setStep('password');
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password || password.length < MIN_PASSWORD_LENGTH) {
      setError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters`);
      return;
    }
    setError(null);

    // If we know it's a new email, register directly
    if (isNewEmail === true) {
      await performRegister();
    } else if (isNewEmail === false) {
      await performLogin();
    } else {
      // null: debounce hasn't resolved yet — check synchronously before deciding
      try {
        const result = await api.post('/auth/check-availability', { email });
        if (result.emailAvailable === true) {
          await performRegister();
        } else {
          await performLogin();
        }
      } catch {
        await performLogin();
      }
    }
  };

  const performLogin = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await api.post('/auth/login', { email, password });
      // Supplier account — store supplier token and redirect to supplier dashboard
      if (response.accountType === 'supplier') {
        localStorage.setItem('supplier_token', response.token);
        localStorage.setItem('supplier_user', JSON.stringify(response.user));
        navigate('/supplier/dashboard');
        return;
      }
      api.setToken(response.token);

      // Admin login — store admin info and redirect to admin panel
      if (response.isAdmin) {
        localStorage.setItem('admin_token', response.token);
        localStorage.setItem('admin', JSON.stringify(response.admin));
        navigate('/admin');
        return;
      }

      if (response.user) {
        localStorage.setItem('user', JSON.stringify(response.user));
        localStorage.setItem('active_role', response.user.active_role || '');
      }
      // Route based on active_role (no more onboarding redirect)
      const activeRole = response.user?.active_role;
      if (activeRole === 'company') {
        navigate('/company');
      } else {
        navigate('/dashboard');
      }
    } catch (err: any) {
      setLoading(false);
      setError(err.message || 'Invalid email or password. Please try again.');
    }
  };

  const performRegister = async () => {
    setLoading(true);
    setError(null);

    try {
      const res = await api.post('/auth/register', {
        email,
        password,
        full_name: '',
        phone: '',
        city: 'Dubai',
        role: authRole,
        signup_source: 'auth-page',
      });

      setSuccess(res?.message || 'Account created! Please check your email to verify.');
      setStep('done');
    } catch (err: any) {
      console.error('Registration error:', err);
      if (err.message?.includes('already') || err.message?.includes('registered')) {
        setError('This email is already registered. Please try logging in instead.');
      } else {
        setError(err.message || 'Registration failed. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    if (step === 'password') {
      setStep('initial');
      setEmail('');
      setPassword('');
    }
    setError(null);
  };

  const showSocialAuth = ENABLE_GOOGLE_AUTH || ENABLE_FACEBOOK_AUTH;

  return (
    <div className="flex min-h-[100dvh] flex-col bg-[#FAFAF9]">
      <Helmet>
        <title>Sign In / Register - Tarmeer</title>
        <meta name="description" content="Sign in or create your Tarmeer account to connect with interior design and renovation professionals in UAE." />
        <meta name="robots" content="noindex, nofollow" />
        <link rel="canonical" href="https://www.tarmeer.com/auth" />
      </Helmet>
      <Navbar forceShowOnAuth />

      <div className="flex flex-1 items-start justify-center overflow-hidden px-4 pt-[clamp(20px,8vh,80px)] pb-6 sm:px-6 sm:pt-[clamp(24px,10vh,100px)]">
      {/* Premium Ambient Background */}
      <div className="absolute top-0 left-0 w-[700px] h-[700px] bg-[#B8864A]/4 rounded-full blur-[150px] -translate-x-1/2 -translate-y-1/2" />
      <div className="absolute bottom-0 right-0 w-[600px] h-[600px] bg-stone-300/20 rounded-full blur-[120px] translate-x-1/3 translate-y-1/3" />

      {/* Main Container - Left Right Split */}
      <div className="relative z-10 w-full max-w-[1100px] mx-auto grid lg:grid-cols-[1.1fr_0.9fr] gap-8 lg:gap-10 items-center">

        {/* Left Column - Value Proposition */}
        <div className="max-w-[580px] hidden lg:block">
          {/* Eyebrow */}
          <p className="text-xs font-medium text-[#B8864A] tracking-[0.2em] mb-2 uppercase">
            UAE's Renovation Platform
          </p>

          {/* Main Title */}
          <h1 className="font-serif text-[28px] lg:text-[36px] text-[#1c1917] mb-3 leading-[1.2] tracking-tight">
            Your Home Renovation<br />Starts Here
          </h1>

          {/* Description */}
          <p className="text-stone-600 text-[15px] leading-relaxed mb-6 max-w-[480px]">
            Connect with top renovation companies and design studios across the UAE.
          </p>

          {/* Value Points */}
          <div className="space-y-4">
            {valuePoints.map((point, index) => {
              const Icon = point.icon;
              return (
                <div key={index} className="flex gap-3">
                  <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-[#B8864A]/10 flex items-center justify-center">
                    <Icon className="w-4 h-4 text-[#B8864A]" />
                  </div>
                  <div className="pt-0.5">
                    <h3 className="font-semibold text-[#1c1917] text-sm mb-0.5">{point.title}</h3>
                    <p className="text-sm text-stone-500 leading-snug">{point.description}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Column - Registration Card */}
        <div className="flex justify-center lg:justify-end">
          <AuthCardShell>
              {/* Error/Success Messages */}
              {error && (
                <div className="mb-5 rounded-xl border border-red-100 bg-red-50/50 p-3.5">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                    <p className="text-sm text-red-600">{error}</p>
                  </div>
                  {/verify/i.test(error) && email && (
                    <button
                      type="button"
                      onClick={async () => {
                        try {
                          await api.post('/auth/resend-verification', { email });
                          setError(null);
                          setSuccess('Verification email resent! Please check your inbox.');
                        } catch (err: any) {
                          setError(err.message || 'Failed to resend.');
                        }
                      }}
                      className="mt-2 ml-8 text-sm font-medium text-[#b8864a] hover:text-[#a67c47] underline underline-offset-2 transition"
                    >
                      Resend verification email
                    </button>
                  )}
                </div>
              )}

              {success && (
                <div className="mb-5 flex items-start gap-3 rounded-xl border border-emerald-100 bg-emerald-50/50 p-3.5">
                  <CheckCircle className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
                  <p className="text-sm text-emerald-600">{success}</p>
                </div>
              )}

              {/* Step: Initial */}
              {step === 'initial' && (
                <div className="space-y-4">
                  {/* Social Buttons */}
                  {ENABLE_GOOGLE_AUTH && (
                    <button
                      type="button"
                      onClick={async () => {
                        setError(null);
                        try {
                          // Pre-check: verify the OAuth endpoint is reachable before redirecting
                          const apiBase = import.meta.env.VITE_API_URL || '/api';
                          const googleUrl = `${apiBase}/auth/google?role=${authRole}`;
                          const resp = await fetch(googleUrl, {
                            method: 'GET',
                            redirect: 'manual',
                          });
                          if (resp.type === 'opaqueredirect' || resp.status === 302 || resp.status === 303 || resp.status === 301) {
                            window.location.href = googleUrl;
                          } else if (resp.ok) {
                            window.location.href = googleUrl;
                          } else {
                            setError('Google sign-in is temporarily unavailable. Please use email instead.');
                          }
                        } catch {
                          window.location.href = `${import.meta.env.VITE_API_URL || '/api'}/auth/google?role=${authRole}`;
                        }
                      }}
                      className={AUTH_SOCIAL_BUTTON_CLASS}
                    >
                      <svg className="h-[18px] w-[18px]" viewBox="0 0 24 24">
                        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                      </svg>
                      Continue with Google
                    </button>
                  )}

                  {ENABLE_FACEBOOK_AUTH && (
                    <button
                      type="button"
                      onClick={() => window.location.href = '/api/auth/facebook'}
                      className={AUTH_SOCIAL_BUTTON_CLASS}
                    >
                      <svg className="h-[18px] w-[18px]" fill="#1877F2" viewBox="0 0 24 24">
                        <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 17.062 24 12.073z"/>
                      </svg>
                      Continue with Facebook
                    </button>
                  )}

                  {showSocialAuth && (
                    <div className="relative my-5">
                      <div className="absolute inset-0 flex items-center">
                        <div className="w-full border-t border-stone-100"></div>
                      </div>
                      <div className="relative flex justify-center">
                        <span className="px-4 bg-white text-[10px] text-stone-400 font-medium tracking-[0.15em]">OR CONTINUE WITH EMAIL</span>
                      </div>
                    </div>
                  )}

                  {/* Email Form */}
                  <form onSubmit={handleEmailContinue} className="space-y-4">
                    <div className="relative">
                      <Mail className="absolute left-5 top-1/2 -translate-y-1/2 h-[18px] w-[18px] text-stone-400" />
                      <input
                        ref={emailInputRef}
                        type="email"
                        value={email}
                        onChange={(e) => {
                          setEmail(e.target.value);
                          setError(null);
                        }}
                        placeholder="Enter your email"
                        className={`${AUTH_INPUT_CLASS} pl-[52px] pr-[52px]`}
                      />
                      {/* Email Status Indicator */}
                      {isNewEmail === true && (
                        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-medium text-emerald-600">
                          New account
                        </span>
                      )}
                      {isNewEmail === false && (
                        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-medium text-stone-400">
                          Existing
                        </span>
                      )}
                    </div>
                    <button
                      type="submit"
                      className="w-full h-[54px] rounded-2xl bg-[#B8864A] text-white font-semibold text-[15px] hover:bg-[#a3780a] transition-all duration-200 disabled:opacity-35 disabled:cursor-not-allowed shadow-[0_4px_20px_rgba(184,134,74,0.25)]"
                      disabled={!email || !EMAIL_REGEX.test(email)}
                    >
                      Continue with email
                    </button>
                  </form>

                  {/* Terms */}
                  <p className="text-[10px] text-stone-400 text-center mt-5">
                    By continuing, you agree to our{' '}
                    <a href="/privacy" className="text-stone-500 hover:text-[#B8864A] transition-colors">Terms</a>
                    {' '}•{' '}
                    <a href="/privacy" className="text-stone-500 hover:text-[#B8864A] transition-colors">Privacy</a>
                  </p>
                </div>
              )}

              {/* Step: Password */}
              {step === 'password' && (
                <div className="space-y-5">
                  <button
                    type="button"
                    onClick={handleBack}
                    className="text-sm text-stone-400 hover:text-[#1c1917] transition flex items-center gap-1"
                  >
                    <ChevronRight className="w-4 h-4 rotate-180" />
                    Back
                  </button>

                  <form onSubmit={handlePasswordSubmit} className="space-y-4">
                    <p className="text-sm text-stone-500">
                      Enter password for <span className="font-medium text-[#1c1917]">{email}</span>
                    </p>

                    <div className="relative">
                      <Lock className="absolute left-5 top-1/2 -translate-y-1/2 h-5 w-5 text-stone-400" />
                      <input
                        ref={passwordInputRef}
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        onChange={(e) => {
                          setPassword(e.target.value);
                          setError(null);
                        }}
                        placeholder="Enter your password"
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
                    {error && error.includes('Password') && <p className="mt-2 text-sm text-red-500">{error}</p>}

                    <div className="flex items-center justify-between">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input type="checkbox" className="h-4 w-4 rounded border-stone-300 text-[#B8864A] focus:ring-[#B8864A]" />
                        <span className="text-sm text-stone-500">Remember me</span>
                      </label>
                      <button
                        type="button"
                        onClick={() => navigate('/forgot-password')}
                        className="text-sm font-medium text-[#B8864A] hover:opacity-70 transition"
                      >
                        Forgot password?
                      </button>
                    </div>

                    <LoadingButton
                      type="submit"
                      loading={loading}
                      className="w-full h-[54px] rounded-2xl font-semibold bg-[#B8864A] text-white hover:bg-[#a3780a] transition-all duration-200 shadow-[0_4px_20px_rgba(184,134,74,0.25)]"
                    >
                      Continue
                    </LoadingButton>
                  </form>
                </div>
              )}

              {/* Step: Done */}
              {step === 'done' && (
                <div className="text-center py-8">
                  <div className="w-16 h-16 mx-auto mb-5 rounded-2xl bg-emerald-500 flex items-center justify-center shadow-lg shadow-emerald-500/20">
                    <CheckCircle className="w-8 h-8 text-white" />
                  </div>
                  <h2 className="font-serif text-xl text-[#1c1917] mb-2">Check Your Email</h2>
                  <p className="text-stone-500 text-sm mb-6 max-w-xs mx-auto">
                    We've sent a verification link to <strong className="text-stone-700">{email}</strong>
                  </p>
                  <div className="flex flex-col items-center gap-3">
                    <button
                      onClick={async () => {
                        try {
                          await api.post('/auth/resend-verification', { email });
                          setSuccess('Verification email resent! Please check your inbox.');
                        } catch (err: any) {
                          setError(err.message || 'Failed to resend verification email.');
                        }
                      }}
                      className="text-sm font-medium text-[#b8864a] hover:text-[#a67c47] transition underline underline-offset-2"
                    >
                      Didn't receive it? Resend verification email
                    </button>
                    <button
                      onClick={() => { setStep('initial'); setSuccess(null); setEmail(''); setPassword(''); }}
                      className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-stone-100 text-stone-700 text-sm font-medium hover:bg-stone-200 transition"
                    >
                      <ChevronRight className="w-4 h-4 rotate-180" />
                      Back to Sign In
                    </button>
                  </div>
                </div>
              )}
          </AuthCardShell>
        </div>
      </div>
      </div>

      {/* Minimal footer — pinned to bottom */}
      <footer className="py-4 text-center text-[11px] text-stone-400">
        <span>&copy; {new Date().getFullYear()} Tarmeer</span>
        <span className="mx-2">·</span>
        <a href="/privacy" className="hover:text-stone-600 transition">Privacy</a>
      </footer>
    </div>
  );
}
