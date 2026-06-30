'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Mail, Lock, Eye, EyeOff, AlertCircle, CheckCircle, ChevronRight } from 'lucide-react';
import { api } from '@/lib/api';
import LoadingButton from '@/components/ui/LoadingButton';
import { MIN_PASSWORD_LENGTH } from '@/lib/constants';
import AuthCardShell from './AuthCardShell';
import { AUTH_INPUT_CLASS, AUTH_SOCIAL_BUTTON_CLASS } from './authCardStyles';
import { useVerificationPoller } from '@/hooks/useVerificationPoller';
import TarmeerLogo from '@/components/TarmeerLogo';
import { getCountry } from '@/lib/country';
import { useSiteLocale } from '@/contexts/SiteLocaleContext';

const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
const API_BASE = process.env.NEXT_PUBLIC_API_URL?.trim() || '/api';

const PANEL_FALLBACK = [
  'https://images.unsplash.com/photo-1631679706909-1844bbd07221?w=500&q=85',
  'https://images.unsplash.com/photo-1600210492493-0946911123ea?w=500&q=85',
  'https://images.unsplash.com/photo-1618221195710-dd6b41faaea6?w=500&q=85',
  'https://images.unsplash.com/photo-1616137466211-f939a420be84?w=500&q=85',
  'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=500&q=85',
  'https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=500&q=85',
  'https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=500&q=85',
  'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=500&q=85',
  'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=500&q=85',
  'https://images.unsplash.com/photo-1554995207-c18c203602cb?w=500&q=85',
  'https://images.unsplash.com/photo-1595526114035-0d45ed16cfbf?w=500&q=85',
  'https://images.unsplash.com/photo-1502005229762-cf1b2da7c5d6?w=500&q=85',
  'https://images.unsplash.com/photo-1484154218962-a197022b5858?w=500&q=85',
  'https://images.unsplash.com/photo-1523217582562-09d0def993a6?w=500&q=85',
  'https://images.unsplash.com/photo-1493809842364-78817add7ffb?w=500&q=85',
  'https://images.unsplash.com/photo-1567767292278-a4f21aa2d36e?w=500&q=85',
  'https://images.unsplash.com/photo-1615529328331-f8917597711f?w=500&q=85',
  'https://images.unsplash.com/photo-1556228453-efd6c1ff04f6?w=500&q=85',
];

const ENABLE_GOOGLE_AUTH = process.env.NEXT_PUBLIC_ENABLE_GOOGLE_AUTH !== 'false';
const ENABLE_FACEBOOK_AUTH = process.env.NEXT_PUBLIC_ENABLE_FACEBOOK_AUTH === 'true';

type AuthStep = 'initial' | 'password' | 'done';

export default function AuthClient({ country }: { country?: string }) {
  const c = getCountry(country);
  const ta = useSiteLocale().tr.auth;
  const router = useRouter();
  const searchParams = useSearchParams();
  const emailInputRef = useRef<HTMLInputElement>(null);
  const passwordInputRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<AuthStep>('initial');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isNewEmail, setIsNewEmail] = useState<boolean | null>(null);

  const authRole = searchParams.get('role') === 'company' ? 'company' : 'homeowner';

  const [panelImages, setPanelImages] = useState<string[]>(PANEL_FALLBACK);

  useEffect(() => {
    fetch(`${API_BASE}/site/showcase-images${country === 'vn' ? '?country=vn' : ''}`)
      .then(r => r.ok ? r.json() : null)
      .then((data: { images?: string[] } | null) => {
        if (data?.images && Array.isArray(data.images) && data.images.length >= 9) {
          setPanelImages(data.images);
        }
      })
      .catch(() => {});
  }, []);

  const third = Math.ceil(panelImages.length / 3);
  const col1 = panelImages.slice(0, third);
  const col2 = panelImages.slice(third, third * 2);
  const col3 = panelImages.slice(third * 2);

  useVerificationPoller(step === 'done' ? email : null, authRole);

  useEffect(() => {
    const urlEmail = searchParams.get('email');
    if (urlEmail && !email) {
      setEmail(urlEmail);
      setStep('password');
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const urlError = searchParams.get('error');
    if (urlError) setError(decodeURIComponent(urlError));
  }, [searchParams]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (step === 'initial') emailInputRef.current?.focus();
      else if (step === 'password') passwordInputRef.current?.focus();
    }, 100);
    return () => clearTimeout(timer);
  }, [step]);

  useEffect(() => {
    if (!email || !EMAIL_REGEX.test(email)) { setIsNewEmail(null); return; }
    const timeoutId = setTimeout(async () => {
      try {
        const result = await api.post('/auth/check-availability', { email }) as { emailAvailable?: boolean };
        setIsNewEmail(result.emailAvailable === true);
      } catch { setIsNewEmail(null); }
    }, 500);
    return () => clearTimeout(timeoutId);
  }, [email]);

  const handleEmailContinue = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !EMAIL_REGEX.test(email)) { setError(ta.invalidEmail); return; }
    setError(null);
    setStep('password');
  };

  const performLogin = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.post('/auth/login', { email, password }) as {
        accountType?: string; token: string; isAdmin?: boolean;
        admin?: unknown; user?: { active_role?: string };
      };
      if (response.accountType === 'supplier') {
        localStorage.setItem('supplier_token', response.token);
        localStorage.setItem('supplier_user', JSON.stringify(response.user));
        router.push('/supplier/dashboard');
        return;
      }
      api.setToken(response.token);
      if (response.isAdmin) {
        localStorage.setItem('admin_token', response.token);
        localStorage.setItem('admin', JSON.stringify(response.admin));
        router.push('/admin');
        return;
      }
      if (response.user) {
        localStorage.setItem('user', JSON.stringify(response.user));
        localStorage.setItem('active_role', response.user.active_role || '');
      }
      router.push(response.user?.active_role === 'company' ? '/company' : '/dashboard');
    } catch (err: unknown) {
      setLoading(false);
      setError(err instanceof Error ? err.message : ta.loginFailed);
    }
  };

  const performRegister = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.post('/auth/register', {
        email, password, full_name: '', phone: '', city: c.defaultCity,
        role: authRole, signup_source: 'auth-page',
      }) as { message?: string };
      setSuccess(res?.message || ta.accountCreated);
      setStep('done');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '';
      if (msg.includes('already') || msg.includes('registered')) {
        setError(ta.emailExists);
      } else {
        setError(msg || ta.registerFailed);
      }
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password || password.length < MIN_PASSWORD_LENGTH) {
      setError(ta.passwordTooShort(MIN_PASSWORD_LENGTH));
      return;
    }
    setError(null);
    if (isNewEmail === true) { await performRegister(); return; }
    if (isNewEmail === false) { await performLogin(); return; }
    try {
      const result = await api.post('/auth/check-availability', { email }) as { emailAvailable?: boolean };
      if (result.emailAvailable === true) await performRegister(); else await performLogin();
    } catch { await performLogin(); }
  };

  const handleBack = () => {
    if (step === 'password') { setStep('initial'); setEmail(''); setPassword(''); }
    setError(null);
  };

  const showSocialAuth = ENABLE_GOOGLE_AUTH || ENABLE_FACEBOOK_AUTH;

  return (
    <div className="flex min-h-[100dvh] flex-col bg-[#FAFAF9]">
      {/* Minimal header — global Navbar hides itself on /auth */}
      <header className="h-14 bg-white border-b border-stone-100 flex items-center px-4 sm:px-6 shrink-0">
        <div className="max-w-6xl mx-auto w-full">
          <TarmeerLogo />
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* LEFT PANEL */}
        <div className="hidden lg:flex lg:w-[52%] relative overflow-hidden bg-[#1a1714] flex-col justify-end">
          <div className="absolute inset-0 flex gap-0.5">
            <div className="flex-1 overflow-hidden">
              <div style={{ animation: 'scrollColDown 70s linear infinite', willChange: 'transform' }}>
                {[...col1, ...col1].map((src, i) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img key={i} src={src} alt="" className="w-full aspect-[3/4] object-cover mb-0.5 opacity-75" loading="lazy" />
                ))}
              </div>
            </div>
            <div className="flex-1 overflow-hidden">
              <div style={{ animation: 'scrollColUp 80s linear -26.7s infinite', willChange: 'transform' }}>
                {[...col2, ...col2].map((src, i) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img key={i} src={src} alt="" className="w-full aspect-[3/4] object-cover mb-0.5 opacity-75" loading="lazy" />
                ))}
              </div>
            </div>
            <div className="flex-1 overflow-hidden">
              <div style={{ animation: 'scrollColDown 90s linear -60s infinite', willChange: 'transform' }}>
                {[...col3, ...col3].map((src, i) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img key={i} src={src} alt="" className="w-full aspect-[3/4] object-cover mb-0.5 opacity-75" loading="lazy" />
                ))}
              </div>
            </div>
          </div>
          <div className="absolute top-0 left-0 right-0 h-28 bg-gradient-to-b from-[#1a1714] to-transparent pointer-events-none" />
          <div className="absolute inset-0 bg-gradient-to-t from-[#1a1714] via-[#1a1714]/65 to-transparent pointer-events-none" />
          <div className="relative z-10 p-12 pb-14">
            <p className="text-[#B8864A] text-[11px] font-medium tracking-[0.2em] uppercase mb-4">{ta.platformTag(c.name)}</p>
            <h1 className="font-serif text-[38px] text-white leading-[1.15] mb-4">
              {ta.heroTitle}
            </h1>
            <p className="text-stone-400 text-[15px] leading-relaxed max-w-[340px]">
              {ta.heroSubtitle(c.name)}
            </p>
            <div className="mt-8 flex gap-8">
              <div><p className="text-white text-2xl font-semibold">500+</p><p className="text-stone-500 text-xs mt-0.5">{ta.statVerified}</p></div>
              <div><p className="text-white text-2xl font-semibold">12K+</p><p className="text-stone-500 text-xs mt-0.5">{ta.statProjects}</p></div>
              <div><p className="text-white text-2xl font-semibold">{country === 'vn' ? '63' : c.name}</p><p className="text-stone-500 text-xs mt-0.5">{ta.statCoverage}</p></div>
            </div>
            <div className="mt-6 pt-4 border-t border-white/10">
              <span className="text-stone-600 text-[11px]">&copy; {new Date().getFullYear()} Tarmeer</span>
              <span className="text-stone-700 mx-2">·</span>
              <Link href="/privacy" className="text-stone-600 text-[11px] hover:text-stone-400 transition">{ta.privacy}</Link>
            </div>
          </div>
        </div>

        {/* RIGHT PANEL */}
        <div className="flex flex-1 flex-col items-center justify-center px-6 py-10 bg-white sm:px-10">
          <div className="w-full max-w-[400px]">
            <div className="flex justify-center w-full">
              <AuthCardShell>
                <div className="mb-6">
                  <p className="text-xs font-medium text-[#B8864A] tracking-[0.15em] uppercase mb-1.5">{ta.welcome}</p>
                  <h2 className="font-serif text-[24px] text-[#1c1917] leading-snug">{ta.signInOrCreate}</h2>
                </div>

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
                            setSuccess(ta.verificationResent);
                          } catch (err: unknown) {
                            setError(err instanceof Error ? err.message : ta.resendFailed);
                          }
                        }}
                        className="mt-2 ml-8 text-sm font-medium text-[#b8864a] hover:text-[#a67c47] underline underline-offset-2 transition"
                      >
                        {ta.resendVerification}
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

                {step === 'initial' && (
                  <div className="space-y-4">
                    {ENABLE_GOOGLE_AUTH && (
                      <button
                        type="button"
                        onClick={async () => {
                          setError(null);
                          const googleUrl = `${API_BASE}/auth/google?role=${authRole}&source=homeowner_auth`;
                          try {
                            const resp = await fetch(googleUrl, { method: 'GET', redirect: 'manual' });
                            if (resp.type === 'opaqueredirect' || resp.status === 302 || resp.status === 303 || resp.status === 301 || resp.ok) {
                              window.location.href = googleUrl;
                            } else {
                              setError(ta.googleUnavailable);
                            }
                          } catch {
                            window.location.href = googleUrl;
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
                        {ta.continueGoogle}
                      </button>
                    )}

                    {ENABLE_FACEBOOK_AUTH && (
                      <button
                        type="button"
                        onClick={() => { window.location.href = `${API_BASE}/auth/facebook`; }}
                        className={AUTH_SOCIAL_BUTTON_CLASS}
                      >
                        <svg className="h-[18px] w-[18px]" fill="#1877F2" viewBox="0 0 24 24">
                          <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 17.062 24 12.073z"/>
                        </svg>
                        {ta.continueFacebook}
                      </button>
                    )}

                    {showSocialAuth && (
                      <div className="relative my-5">
                        <div className="absolute inset-0 flex items-center">
                          <div className="w-full border-t border-stone-100" />
                        </div>
                        <div className="relative flex justify-center">
                          <span className="px-4 bg-white text-[10px] text-stone-400 font-medium tracking-[0.15em]">{ta.orContinueEmail}</span>
                        </div>
                      </div>
                    )}

                    <form onSubmit={handleEmailContinue} className="space-y-4">
                      <div className="relative">
                        <Mail className="absolute left-5 top-1/2 -translate-y-1/2 h-[18px] w-[18px] text-stone-400" />
                        <input
                          ref={emailInputRef}
                          type="email"
                          value={email}
                          onChange={(e) => { setEmail(e.target.value); setError(null); }}
                          placeholder={ta.emailPlaceholder}
                          className={`${AUTH_INPUT_CLASS} pl-[52px] pr-[52px]`}
                        />
                        {isNewEmail === true && (
                          <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-medium text-emerald-600">{ta.newAccount}</span>
                        )}
                        {isNewEmail === false && (
                          <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-medium text-stone-400">{ta.existing}</span>
                        )}
                      </div>
                      <button
                        type="submit"
                        className="w-full h-[54px] rounded-2xl bg-[#B8864A] text-white font-semibold text-[15px] hover:bg-[#a3780a] transition-all duration-200 disabled:opacity-35 disabled:cursor-not-allowed shadow-[0_4px_20px_rgba(184,134,74,0.25)]"
                        disabled={!email || !EMAIL_REGEX.test(email)}
                      >
                        {ta.continueEmail}
                      </button>
                    </form>

                    <p className="text-[10px] text-stone-400 text-center mt-5">
                      {ta.byContinuing}{' '}
                      <Link href="/privacy" className="text-stone-500 hover:text-[#B8864A] transition-colors">{ta.terms}</Link>
                      {' '}•{' '}
                      <Link href="/privacy" className="text-stone-500 hover:text-[#B8864A] transition-colors">{ta.privacy}</Link>
                    </p>
                  </div>
                )}

                {step === 'password' && (
                  <div className="space-y-5">
                    <button type="button" onClick={handleBack} className="text-sm text-stone-400 hover:text-[#1c1917] transition flex items-center gap-1">
                      <ChevronRight className="w-4 h-4 rotate-180" />
                      {ta.back}
                    </button>
                    <form onSubmit={handlePasswordSubmit} className="space-y-4">
                      <p className="text-sm text-stone-500">
                        {ta.enterPasswordFor} <span className="font-medium text-[#1c1917]">{email}</span>
                      </p>
                      <div className="relative">
                        <Lock className="absolute left-5 top-1/2 -translate-y-1/2 h-5 w-5 text-stone-400" />
                        <input
                          ref={passwordInputRef}
                          type={showPassword ? 'text' : 'password'}
                          value={password}
                          onChange={(e) => { setPassword(e.target.value); setError(null); }}
                          placeholder={ta.passwordPlaceholder}
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

                      <div className="flex items-center justify-between">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input type="checkbox" className="h-4 w-4 rounded border-stone-300 text-[#B8864A] focus:ring-[#B8864A]" />
                          <span className="text-sm text-stone-500">{ta.rememberMe}</span>
                        </label>
                        <button
                          type="button"
                          onClick={() => router.push('/forgot-password')}
                          className="text-sm font-medium text-[#B8864A] hover:opacity-70 transition"
                        >
                          {ta.forgotPassword}
                        </button>
                      </div>

                      <LoadingButton
                        type="submit"
                        loading={loading}
                        className="w-full h-[54px] rounded-2xl font-semibold bg-[#B8864A] text-white hover:bg-[#a3780a] transition-all duration-200 shadow-[0_4px_20px_rgba(184,134,74,0.25)]"
                      >
                        {ta.continue}
                      </LoadingButton>
                    </form>
                  </div>
                )}

                {step === 'done' && (
                  <div className="text-center py-8">
                    <div className="w-16 h-16 mx-auto mb-5 rounded-2xl bg-emerald-500 flex items-center justify-center shadow-lg shadow-emerald-500/20">
                      <CheckCircle className="w-8 h-8 text-white" />
                    </div>
                    <h2 className="font-serif text-xl text-[#1c1917] mb-2">{ta.checkEmail}</h2>
                    <p className="text-stone-500 text-sm mb-6 max-w-xs mx-auto">
                      {ta.sentVerificationTo} <strong className="text-stone-700">{email}</strong>
                    </p>
                    <div className="flex flex-col items-center gap-3">
                      <button
                        onClick={async () => {
                          try {
                            await api.post('/auth/resend-verification', { email });
                            setSuccess(ta.verificationResent);
                          } catch (err: unknown) {
                            setError(err instanceof Error ? err.message : ta.resendFailed);
                          }
                        }}
                        className="text-sm font-medium text-[#b8864a] hover:text-[#a67c47] transition underline underline-offset-2"
                      >
                        {ta.didntReceive}
                      </button>
                      <button
                        onClick={() => { setStep('initial'); setSuccess(null); setEmail(''); setPassword(''); }}
                        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-stone-100 text-stone-700 text-sm font-medium hover:bg-stone-200 transition"
                      >
                        <ChevronRight className="w-4 h-4 rotate-180" />
                        {ta.backToSignIn}
                      </button>
                    </div>
                  </div>
                )}
              </AuthCardShell>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
