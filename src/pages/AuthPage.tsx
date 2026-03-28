import { useState, useEffect, useRef } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { Mail, Lock, Eye, EyeOff, AlertCircle, CheckCircle, ChevronRight, Briefcase, Users } from 'lucide-react';
import { api } from '../lib/api';
import LoadingButton from '../components/ui/LoadingButton';
import { MIN_PASSWORD_LENGTH } from '../lib/constants';

const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
const ENABLE_GOOGLE_AUTH = import.meta.env.VITE_ENABLE_GOOGLE_AUTH === 'true';
const ENABLE_FACEBOOK_AUTH = import.meta.env.VITE_ENABLE_FACEBOOK_AUTH === 'true';

type AuthStep = 'initial' | 'password' | 'done';

const valuePoints = [
  {
    icon: Briefcase,
    title: 'Showcase your portfolio',
    description: 'Present your best projects, services, and studio identity in one polished profile.',
  },
  {
    icon: Users,
    title: 'Reach high-intent clients',
    description: 'Be discovered by homeowners across the UAE searching for trusted design partners.',
  },
];

export default function AuthPage() {
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
        setIsNewEmail(result.emailExists === true ? false : true);
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
    } else {
      // Existing email or unknown, try login first
      await performLogin();
    }
  };

  const performLogin = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await api.post('/auth/login', { email, password });
      api.setToken(response.token);
      localStorage.setItem('designer', JSON.stringify(response.designer));
      navigate('/designer/dashboard');
    } catch (err: any) {
      setLoading(false);
      if (err.message?.includes('not found') || err.message?.includes('Invalid credentials') || err.message?.includes('Invalid email or password')) {
        await performRegister();
      } else {
        setError(err.message || 'Login failed. Please try again.');
      }
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
      });

      setSuccess(res?.message || 'Account created! Please check your email to verify.');
      setStep('done');
    } catch (err: any) {
      console.error('Registration error:', err);
      // If email already exists, show a helpful message
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

  const inputClass = "w-full h-[50px] px-5 rounded-2xl border border-stone-200 bg-stone-50/80 text-[15px] text-[#1c1917] placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-[#B8864A]/15 focus:border-[#B8864A] focus:bg-white transition-all duration-200";
  const socialButtonClass = "w-full flex items-center justify-center gap-3 h-[50px] px-5 rounded-2xl border border-stone-200 bg-white hover:border-stone-300 hover:bg-stone-50/50 transition-all duration-200 font-medium text-[#1c1917]";
  const showSocialAuth = ENABLE_GOOGLE_AUTH || ENABLE_FACEBOOK_AUTH;

  return (
    <div className="min-h-screen bg-[#FAFAF9] flex items-start justify-center px-4 sm:px-6 pt-[20vh] relative overflow-hidden">
      {/* Premium Ambient Background */}
      <div className="absolute top-0 left-0 w-[700px] h-[700px] bg-[#B8864A]/4 rounded-full blur-[150px] -translate-x-1/2 -translate-y-1/2" />
      <div className="absolute bottom-0 right-0 w-[600px] h-[600px] bg-stone-300/20 rounded-full blur-[120px] translate-x-1/3 translate-y-1/3" />

      {/* Main Container - Left Right Split */}
      <div className="relative z-10 w-full max-w-[1100px] mx-auto grid lg:grid-cols-[1.1fr_0.9fr] gap-8 lg:gap-10 items-start">

        {/* Left Column - Value Proposition */}
        <div className="max-w-[580px] -mt-12">
          {/* Logo */}
          <Link to="/" className="inline-flex items-center gap-2 font-serif text-base font-semibold text-[#1c1917] hover:opacity-60 transition-opacity mb-5">
            <img
              src="/images/tarmeer_logo.svg"
              alt="Tarmeer"
              className="h-7 w-auto"
              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
            />
            TARMEER
          </Link>

          {/* Eyebrow */}
          <p className="text-xs font-medium text-[#B8864A] tracking-[0.2em] mb-3 uppercase">
            For Interior Designers & Studios
          </p>

          {/* Main Title */}
          <h1 className="font-serif text-[32px] sm:text-[38px] lg:text-[42px] text-[#1c1917] mb-4 leading-[1.2] tracking-tight">
            Join the UAE's Premier<br />Design Community
          </h1>

          {/* Description */}
          <p className="text-stone-600 text-base leading-relaxed mb-8 max-w-[480px]">
            Build a premium presence and connect with homeowners seeking trusted design partners.
          </p>

          {/* Value Points */}
          <div className="space-y-5">
            {valuePoints.map((point, index) => {
              const Icon = point.icon;
              return (
                <div key={index} className="flex gap-4">
                  <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-[#B8864A]/10 flex items-center justify-center">
                    <Icon className="w-5 h-5 text-[#B8864A]" />
                  </div>
                  <div className="pt-1">
                    <h3 className="font-semibold text-[#1c1917] mb-1">{point.title}</h3>
                    <p className="text-sm text-stone-500 leading-relaxed">{point.description}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Column - Registration Card */}
        <div className="flex justify-center lg:justify-end">
          <div className="w-full max-w-[440px]">
            <div className="bg-white rounded-[28px] border border-stone-100/80 shadow-[0_4px_40px_rgba(0,0,0,0.04)] p-8 sm:p-10">
              {/* Error/Success Messages */}
              {error && (
                <div className="mb-5 flex items-start gap-3 rounded-xl border border-red-100 bg-red-50/50 p-3.5">
                  <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                  <p className="text-sm text-red-600">{error}</p>
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
                      onClick={() => window.location.href = '/api/auth/google'}
                      className={socialButtonClass}
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
                      className={socialButtonClass}
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
                        className={`${inputClass} pl-[52px] pr-[52px]`}
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
                    {error && error.includes('email') && <p className="text-sm text-red-500 mt-2">{error}</p>}
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
                        className={`${inputClass} pl-[52px] pr-12`}
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
                  <button
                    onClick={() => { setStep('initial'); setSuccess(null); setEmail(''); setPassword(''); }}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-stone-100 text-stone-700 text-sm font-medium hover:bg-stone-200 transition"
                  >
                    <ChevronRight className="w-4 h-4 rotate-180" />
                    Back to Sign In
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
