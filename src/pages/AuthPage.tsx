import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mail, Lock, Eye, EyeOff, AlertCircle, CheckCircle, Phone, MapPin, User, FileText, ChevronDown } from 'lucide-react';
import { api } from '../lib/api';
import LoadingButton from '../components/ui/LoadingButton';
import SelectField from '../components/form/SelectField';
import { sanitizePersonName, sanitizePhoneDigits } from '../lib/formInputRules';

const PHONE_COUNTRY_STORAGE_KEY = 'tarmeer_phone_country';
const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
const PHONE_E164_REGEX = /^\+[1-9]\d{7,14}$/;

const PHONE_COUNTRY_OPTIONS = [
  { value: '+971', label: 'UAE +971' },
  { value: '+86', label: 'China +86' },
  { value: '+1', label: 'US/Canada +1' },
  { value: '+44', label: 'UK +44' },
  { value: '+91', label: 'India +91' },
  { value: '+966', label: 'Saudi +966' },
  { value: '+965', label: 'Kuwait +965' },
  { value: '+973', label: 'Bahrain +973' },
  { value: '+974', label: 'Qatar +974' },
  { value: '+968', label: 'Oman +968' },
  { value: '+60', label: 'Malaysia +60' },
  { value: '+65', label: 'Singapore +65' },
  { value: '+81', label: 'Japan +81' },
  { value: '+82', label: 'Korea +82' },
  { value: '+33', label: 'France +33' },
  { value: '+49', label: 'Germany +49' },
  { value: '+61', label: 'Australia +61' },
  { value: '+234', label: 'Nigeria +234' },
  { value: '+27', label: 'South Africa +27' },
  { value: '+20', label: 'Egypt +20' },
  { value: '+90', label: 'Turkey +90' },
  { value: '+39', label: 'Italy +39' },
  { value: '+34', label: 'Spain +34' },
  { value: '+31', label: 'Netherlands +31' },
  { value: '+7', label: 'Russia +7' },
  { value: '+55', label: 'Brazil +55' },
  { value: '+52', label: 'Mexico +52' },
  { value: '+62', label: 'Indonesia +62' },
  { value: '+63', label: 'Philippines +63' },
  { value: '+84', label: 'Vietnam +84' },
  { value: '+66', label: 'Thailand +66' },
  { value: '+64', label: 'New Zealand +64' },
  { value: '+353', label: 'Ireland +353' },
  { value: '+92', label: 'Pakistan +92' },
];

function getStoredPhoneCountry(): string {
  if (typeof window === 'undefined') return '+971';
  return localStorage.getItem(PHONE_COUNTRY_STORAGE_KEY) || '+971';
}

type Tab = 'login' | 'register';

const AUTH_BANNERS: Record<Tab, { image: string; title: string; subtitle: string }> = {
  login: {
    image: '/images/designers/projects/covers/cover-008.jpg',
    title: 'Designer Sign In',
    subtitle: 'Manage your projects and profile.',
  },
  register: {
    image: '/images/designers/projects/covers/cover-004.jpg',
    title: 'Create Account',
    subtitle: 'Start your designer profile.',
  },
};

export default function AuthPage() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>('login');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [needVerification, setNeedVerification] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [nameError, setNameError] = useState<string | null>(null);
  const [phoneCountryCode, setPhoneCountryCode] = useState<string>(() => getStoredPhoneCountry());
  const [checkingEmail, setCheckingEmail] = useState(false);
  const [checkingPhone, setCheckingPhone] = useState(false);
  const [registerTouched, setRegisterTouched] = useState<Record<string, boolean>>({});
  
  const [loginForm, setLoginForm] = useState({ email: '', password: '', remember: false });
  const [registerForm, setRegisterForm] = useState({
    fullName: '',
    email: '',
    phone: '',
    city: '',
    password: '',
    confirmPassword: '',
    philosophy: '',
    agree: false,
  });

  const handleLoginChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, type, checked, value } = e.target;
    setLoginForm((prev) => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
    setError(null);
  };

  const markRegisterTouched = (field: string) => {
    setRegisterTouched((prev) => ({ ...prev, [field]: true }));
  };

  const handleRegisterChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const target = e.target as HTMLInputElement;
    const { name, type, checked } = target;
    let { value } = target;

    if (name === 'fullName') {
      value = sanitizePersonName(value);
    }

    if (name === 'phone') {
      value = sanitizePhoneDigits(value);
    }

    setRegisterForm((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));

    setError(null);
    if (name === 'agree' || name === 'city') {
      markRegisterTouched(name);
    }

    if (name === 'fullName') {
      if (value.length > 0 && !/^[\p{L}\s\-'\.]+$/u.test(value)) {
        setNameError('Name can only contain letters, spaces, hyphens and dots');
      } else if (value.length > 50) {
        setNameError('Name is too long (max 50 characters)');
      } else {
        setNameError(null);
      }
    }

    if (name === 'email') {
      if (value.length > 0 && !EMAIL_REGEX.test(value)) {
        setEmailError('Please enter a valid email address');
      } else {
        setEmailError(null);
      }
    }

    if (name === 'phone') {
      const digits = value.replace(/\D/g, '');
      const fullPhone = phoneCountryCode + digits;
      if (digits.length > 0 && !PHONE_E164_REGEX.test(fullPhone)) {
        setPhoneError('Please enter a valid phone number');
      } else {
        setPhoneError(null);
      }
    }

    if (name === 'password') {
      if (value.length > 0 && value.length < 6) {
        setPasswordError('At least 6 characters');
      } else if (registerForm.confirmPassword && value !== registerForm.confirmPassword) {
        setPasswordError('Passwords do not match');
      } else {
        setPasswordError(null);
      }
    }

    if (name === 'confirmPassword') {
      if (value && registerForm.password !== value) {
        setPasswordError('Passwords do not match');
      } else if (registerForm.password.length > 0 && registerForm.password.length < 6) {
        setPasswordError('At least 6 characters');
      } else {
        setPasswordError(null);
      }
    }
  };

  const checkRegistrationAvailability = async (field: 'email' | 'phone') => {
    if (field === 'email') {
      const email = registerForm.email.trim();
      if (!email || emailError) return;

      setCheckingEmail(true);
      try {
        const result = await api.post('/auth/check-availability', { email });
        setEmailError(result.emailAvailable ? null : 'Email already registered');
      } catch (err: any) {
        setEmailError(err.message || 'Unable to verify email availability right now');
      } finally {
        setCheckingEmail(false);
      }
      return;
    }

    const fullPhone = phoneCountryCode + registerForm.phone.replace(/\D/g, '');
    if (!registerForm.phone || phoneError) return;

    setCheckingPhone(true);
    try {
      const result = await api.post('/auth/check-availability', { phone: fullPhone });
      setPhoneError(result.phoneAvailable ? null : 'Phone already registered');
    } catch (err: any) {
      setPhoneError(err.message || 'Unable to verify phone availability right now');
    } finally {
      setCheckingPhone(false);
    }
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setNeedVerification(false);

    try {
      const response = await api.post('/auth/login', {
        email: loginForm.email,
        password: loginForm.password
      });

      api.setToken(response.token);
      localStorage.setItem('designer', JSON.stringify(response.designer));
      
      navigate('/designer/dashboard');
    } catch (err: any) {
      const errorMessage = err.message || 'Login failed, please try again later';

      if (err.message.includes('please verify your email') || err.message.includes('verify your email')) {
        setNeedVerification(true);
        setError(errorMessage);
      } else {
        setError(errorMessage);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleResendVerification = async () => {
    setLoading(true);
    setError(null);

    try {
      await api.post('/auth/resend-verification', {
        email: loginForm.email
      });
      setSuccess('Verification email sent, please check your email');
      setNeedVerification(false);
    } catch (err: any) {
      setError(err.message || 'Failed to send, please try again later');
    } finally {
      setLoading(false);
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setRegisterTouched({
      submit: true,
      fullName: true,
      email: true,
      phone: true,
      city: true,
      password: true,
      confirmPassword: true,
      agree: true,
    });

    if (!registerForm.fullName.trim()) {
      setError('Please enter your full name');
      return;
    }

    if (nameError) {
      setError(nameError);
      return;
    }

    if (!registerForm.email.trim()) {
      setError('Please enter your email');
      return;
    }

    if (emailError) {
      setError(emailError);
      return;
    }

    const fullPhone = phoneCountryCode + registerForm.phone.replace(/\D/g, '');
    if (!PHONE_E164_REGEX.test(fullPhone)) {
      setError('Please enter a valid phone number');
      return;
    }
    if (phoneError) {
      setError(phoneError);
      return;
    }

    if (!registerForm.city) {
      setError('Please select your city');
      return;
    }

    if (passwordError) {
      setError(passwordError);
      return;
    }

    if (registerForm.password !== registerForm.confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (!registerForm.agree) {
      setError('Please agree to the Privacy Policy');
      return;
    }

    setLoading(true);
    setError(null);
    setNeedVerification(false);

    try {
      const res = await api.post('/auth/register', {
        email: registerForm.email,
        password: registerForm.password,
        full_name: registerForm.fullName,
        phone: fullPhone,
        city: registerForm.city
      });

      if (res?.emailSent === false) {
        setSuccess(null);
        setError(res?.message || 'Registration created, but verification email could not be delivered. Please retry sending verification email.');
        setNeedVerification(true);
      } else {
        setSuccess(res?.message || 'Registration successful! Please check your email to verify your account.');
      }
      setTab('login');
      setLoginForm(prev => ({ ...prev, email: registerForm.email }));
      setRegisterForm({
        fullName: '',
        email: '',
        phone: '',
        city: '',
        password: '',
        confirmPassword: '',
        philosophy: '',
        agree: false,
      });
      setRegisterTouched({});
      setNameError(null);
      setEmailError(null);
      setPhoneError(null);
      setPasswordError(null);
    } catch (err: any) {
      setError(err.message || 'Registration failed, please try again later');
    } finally {
      setLoading(false);
    }
  };

  const emailLooksValid =
    registerForm.email.length > 0 && !emailError && EMAIL_REGEX.test(registerForm.email);
  const passwordLengthOk = registerForm.password.length >= 6;
  const passwordsMatch =
    registerForm.password.length > 0 &&
    registerForm.confirmPassword.length > 0 &&
    registerForm.password === registerForm.confirmPassword &&
    passwordLengthOk;
  const cityError = !registerForm.city && (registerTouched.city || registerTouched.submit);
  const termsError = !registerForm.agree && (registerTouched.agree || registerTouched.submit);
  const requiredFilled = Boolean(
    registerForm.fullName.trim() &&
      registerForm.email.trim() &&
      registerForm.phone.trim() &&
      registerForm.city &&
      registerForm.password &&
      registerForm.confirmPassword &&
      registerForm.agree
  );
  const hasFieldErrors = Boolean(
    nameError || emailError || phoneError || passwordError || cityError || termsError
  );
  const registerDisabled = loading || !requiredFilled || hasFieldErrors;

  const inputBaseClass =
    'w-full h-11 rounded-lg border bg-white px-3 text-[14px] leading-5 text-[#2c2c2c] placeholder:text-[#8a857f] focus:outline-none focus:ring-2 focus:ring-[#b8864a]/20 transition-colors';
  const selectBaseClass =
    'h-11 rounded-lg border bg-white py-0 text-[14px] leading-5 text-[#2c2c2c] focus:border-[#b8864a] focus:ring-[#b8864a]/20';
  const iconBaseClass = 'absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400';
  const inputErrorClass = 'border-red-300 focus:border-red-400 focus:ring-red-300/30';
  const inputNormalClass = 'border-stone-200 focus:border-[#b8864a]';
  const eyeButtonClass =
    'absolute right-1.5 top-1/2 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-md text-stone-400 transition-colors hover:bg-stone-100 hover:text-[#8f6a3f] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#b8864a]/20';
  const activeBanner = AUTH_BANNERS[tab];

  return (
    <div className="min-h-screen bg-[#faf9f7] text-[#2c2c2c] flex flex-col">
      <section className="relative h-[220px] sm:h-[260px] overflow-hidden bg-stone-200">
        <img
          src={activeBanner.image}
          alt=""
          className="w-full h-full object-cover"
          onError={(e) => {
            (e.target as HTMLImageElement).style.display = 'none';
          }}
        />
        <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(17,14,10,0.72)_0%,rgba(17,14,10,0.48)_42%,rgba(17,14,10,0.18)_100%)]" />
        <div className="absolute inset-0 flex items-center">
          <div className="mx-auto w-full max-w-[440px] px-4 sm:max-w-[520px]">
            <div className="mx-auto max-w-[360px] text-center text-white">
              <h1 className="whitespace-nowrap text-[28px] font-bold leading-none sm:text-[34px]">
                {activeBanner.title}
              </h1>
              <p className="mt-2 text-sm leading-6 text-white/85 sm:text-[15px]">
                {activeBanner.subtitle}
              </p>
            </div>
          </div>
        </div>
      </section>

      <main className="flex-1 flex items-start justify-center px-4 py-7 sm:py-8">
        <div className="w-full max-w-[440px]">
          <div className="mb-4 flex rounded-xl border border-stone-200 bg-stone-50/80 p-1">
            <button
              type="button"
              onClick={() => { setTab('login'); setError(null); setSuccess(null); }}
              className={`h-9 w-1/2 rounded-lg text-sm font-medium transition-colors ${
                tab === 'login'
                  ? 'border border-stone-200 bg-white text-[#2c2c2c]'
                  : 'text-[#7a756f] hover:bg-stone-100/70'
              }`}
            >
              Sign in
            </button>
            <button
              type="button"
              onClick={() => { setTab('register'); setError(null); setSuccess(null); }}
              className={`h-9 w-1/2 rounded-lg text-sm font-medium transition-colors ${
                tab === 'register'
                  ? 'border border-stone-200 bg-white text-[#2c2c2c]'
                  : 'text-[#7a756f] hover:bg-stone-100/70'
              }`}
            >
              Create account
            </button>
          </div>
          {tab === 'register' && (
            <p className="mb-4 px-1 text-sm leading-5 text-[#7a756f]">
              Create your studio profile to start publishing projects.
            </p>
          )}

          {error && (
            <div className="mb-3 flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-3">
              <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm text-red-700">{error}</p>
                {needVerification && (
                  <button
                    type="button"
                    onClick={handleResendVerification}
                    disabled={loading}
                    className="mt-2 text-sm font-medium text-[#b8864a] hover:underline"
                  >
                    Resend verification email
                  </button>
                )}
              </div>
            </div>
          )}

          {success && (
            <div className="mb-3 flex items-start gap-3 rounded-lg border border-green-200 bg-green-50 p-3">
              <CheckCircle className="w-5 h-5 text-green-500 shrink-0 mt-0.5" />
              <p className="text-sm text-green-700">{success}</p>
            </div>
          )}

          {tab === 'login' && (
            <form
              onSubmit={handleLoginSubmit}
              className="space-y-4 rounded-xl border border-stone-200 bg-white p-5 shadow-[0_1px_2px_rgba(24,24,24,0.05)] sm:p-6"
            >
              <div className="space-y-1.5">
                <label className="block text-sm font-semibold text-[#2c2c2c]">Email</label>
                <div className="relative">
                  <Mail className={iconBaseClass} />
                  <input
                    name="email"
                    type="email"
                    required
                    value={loginForm.email}
                    onChange={handleLoginChange}
                    placeholder="designer@example.com"
                    className={`${inputBaseClass} pl-10`}
                  />
                </div>
              </div>
              
              <div className="space-y-1.5">
                <label className="block text-sm font-semibold text-[#2c2c2c]">Password</label>
                <div className="relative">
                  <Lock className={iconBaseClass} />
                  <input
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={loginForm.password}
                    onChange={handleLoginChange}
                    placeholder="Enter your password"
                    className={`${inputBaseClass} pl-10 pr-10`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className={eyeButtonClass}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              
              <div className="flex items-center justify-between pt-1">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    name="remember"
                    checked={loginForm.remember}
                    onChange={handleLoginChange}
                    className="h-4 w-4 rounded border-stone-300 text-[#b8864a] focus:ring-[#b8864a]"
                  />
                  <span className="text-sm text-[#6b6b6b]">Remember me</span>
                </label>
                <button type="button" onClick={() => navigate('/forgot-password')} className="text-sm font-medium text-[#b8864a] hover:underline">
                  Forgot password?
                </button>
              </div>
              
              <LoadingButton
                type="submit"
                loading={loading}
                className="w-full h-11 rounded-lg font-medium btn-primary text-white disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Sign in
              </LoadingButton>
            </form>
          )}

          {tab === 'register' && (
            <form
              onSubmit={handleRegisterSubmit}
              className="space-y-3.5 rounded-xl border border-stone-200 bg-white p-5 shadow-[0_1px_2px_rgba(24,24,24,0.05)] sm:p-6"
            >
              <div className="space-y-1.5">
                <label className="block text-sm font-semibold text-[#2c2c2c]">Full Name</label>
                <div className="relative">
                  <User className={iconBaseClass} />
                  <input
                    name="fullName"
                    type="text"
                    required
                    value={registerForm.fullName}
                    onChange={handleRegisterChange}
                    onBlur={() => markRegisterTouched('fullName')}
                    placeholder="Your full name"
                    autoComplete="name"
                    className={`${inputBaseClass} pl-10 ${nameError && (registerTouched.fullName || registerTouched.submit) ? inputErrorClass : inputNormalClass}`}
                  />
                </div>
                {nameError && (registerTouched.fullName || registerTouched.submit) && (
                  <p className="mt-1 text-xs text-red-600">{nameError}</p>
                )}
              </div>

              <div className="space-y-1.5">
                <label className="block text-sm font-semibold text-[#2c2c2c]">Email</label>
                <div className="relative">
                  <Mail className={iconBaseClass} />
                  <input
                    name="email"
                    type="email"
                    required
                    value={registerForm.email}
                    onChange={handleRegisterChange}
                    onBlur={() => {
                      markRegisterTouched('email');
                      void checkRegistrationAvailability('email');
                    }}
                    placeholder="name@studio.com"
                    autoComplete="email"
                    className={`${inputBaseClass} pl-10 ${emailError && (registerTouched.email || registerTouched.submit) ? inputErrorClass : inputNormalClass}`}
                  />
                </div>
                {checkingEmail && !emailError && registerForm.email && (
                  <p className="mt-1 text-xs text-stone-500">Checking email availability...</p>
                )}
                {emailError && (registerTouched.email || registerTouched.submit) && (
                  <p className="mt-1 text-xs text-red-600">{emailError}</p>
                )}
                {emailLooksValid && !checkingEmail && (
                  <p className="mt-1 text-xs text-emerald-700">Email looks good.</p>
                )}
              </div>

              <div className="space-y-1.5">
                <label className="block text-sm font-semibold text-[#2c2c2c]">Phone / WhatsApp</label>
                <div className="grid grid-cols-[96px_minmax(0,1fr)] gap-2">
                  <div className="relative shrink-0">
                    <select
                      value={phoneCountryCode}
                      onChange={(e) => {
                        const v = e.target.value;
                        setPhoneCountryCode(v);
                        localStorage.setItem(PHONE_COUNTRY_STORAGE_KEY, v);
                        setPhoneError(null);
                      }}
                      aria-label="Country code"
                      className={`${inputBaseClass} appearance-none pl-3 pr-8 ${phoneError && (registerTouched.phone || registerTouched.submit) ? inputErrorClass : inputNormalClass}`}
                    >
                      {PHONE_COUNTRY_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>{opt.value}</option>
                      ))}
                    </select>
                    <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
                  </div>
                  <div className="relative flex-1">
                    <Phone className={iconBaseClass} />
                    <input
                      name="phone"
                      type="tel"
                      required
                      value={registerForm.phone}
                      onChange={handleRegisterChange}
                      onBlur={() => {
                        markRegisterTouched('phone');
                        void checkRegistrationAvailability('phone');
                      }}
                      placeholder="50 123 4567"
                      autoComplete="tel-national"
                      inputMode="numeric"
                      className={`${inputBaseClass} pl-10 ${phoneError && (registerTouched.phone || registerTouched.submit) ? inputErrorClass : inputNormalClass}`}
                    />
                  </div>
                </div>
                {checkingPhone && !phoneError && registerForm.phone && (
                  <p className="mt-1 text-xs text-stone-500">Checking phone availability...</p>
                )}
                {phoneError && (registerTouched.phone || registerTouched.submit) && (
                  <p className="mt-1 text-xs text-red-600">{phoneError}</p>
                )}
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <label className="block text-sm font-semibold text-[#2c2c2c]">Password</label>
                  <div className="relative">
                    <Lock className={iconBaseClass} />
                    <input
                      name="password"
                      type={showPassword ? 'text' : 'password'}
                      required
                      minLength={6}
                      value={registerForm.password}
                      onChange={handleRegisterChange}
                      onBlur={() => markRegisterTouched('password')}
                      placeholder="At least 6 characters"
                      autoComplete="new-password"
                      className={`${inputBaseClass} pl-10 pr-10 ${passwordError && (registerTouched.password || registerTouched.submit || registerTouched.confirmPassword) ? inputErrorClass : inputNormalClass}`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      className={eyeButtonClass}
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                
                <div className="space-y-1.5">
                  <label className="block text-sm font-semibold text-[#2c2c2c]">Confirm</label>
                  <div className="relative">
                    <Lock className={iconBaseClass} />
                    <input
                      name="confirmPassword"
                      type={showConfirmPassword ? 'text' : 'password'}
                      required
                      minLength={6}
                      value={registerForm.confirmPassword}
                      onChange={handleRegisterChange}
                      onBlur={() => markRegisterTouched('confirmPassword')}
                      placeholder="Confirm password"
                      autoComplete="new-password"
                      className={`${inputBaseClass} pl-10 pr-10 ${passwordError && (registerTouched.confirmPassword || registerTouched.submit || registerTouched.password) ? inputErrorClass : inputNormalClass}`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword((v) => !v)}
                      className={eyeButtonClass}
                      aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                    >
                      {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              </div>
              {passwordError && (registerTouched.password || registerTouched.confirmPassword || registerTouched.submit) && (
                <p className="-mt-1 text-xs text-red-600">{passwordError}</p>
              )}
              {!passwordError && passwordLengthOk && registerTouched.password && !passwordsMatch && (
                <p className="-mt-1 text-xs text-stone-500">Passwords do not match yet.</p>
              )}
              {passwordsMatch && (
                <p className="-mt-1 text-xs text-emerald-700">Passwords match.</p>
              )}

              <div className="space-y-1.5">
                <label className="block text-sm font-semibold text-[#2c2c2c]">City</label>
                <SelectField
                  icon={<MapPin className="w-4 h-4" />}
                  name="city"
                  value={registerForm.city}
                  onChange={handleRegisterChange}
                  onBlur={() => markRegisterTouched('city')}
                  className={`${selectBaseClass} pr-9 ${cityError ? inputErrorClass : inputNormalClass}`}
                  chevronClassName="right-3 h-4 w-4 text-stone-400"
                >
                  <option value="">Select your city</option>
                  <option value="Dubai">Dubai</option>
                  <option value="Sharjah">Sharjah</option>
                  <option value="Abu Dhabi">Abu Dhabi</option>
                  <option value="Ajman">Ajman</option>
                </SelectField>
                {cityError && <p className="mt-1 text-xs text-red-600">Please select a city.</p>}
              </div>

              <div className="space-y-1 pt-0.5">
                <label className="block text-sm font-semibold text-[#2c2c2c]">
                  Design Philosophy <span className="font-normal text-[#8a857f]">(optional)</span>
                </label>
                <div className="relative">
                  <FileText className="absolute left-3 top-3 h-4 w-4 text-stone-400" />
                  <textarea
                    name="philosophy"
                    rows={2}
                    value={registerForm.philosophy}
                    onChange={handleRegisterChange}
                    placeholder="Share your approach, materials, or signature style..."
                    className="min-h-[82px] w-full resize-y rounded-lg border border-stone-200 bg-white px-3 py-2.5 pl-10 text-[14px] leading-5 text-[#2c2c2c] placeholder:text-[#8a857f] focus:border-[#b8864a] focus:outline-none focus:ring-2 focus:ring-[#b8864a]/20"
                  />
                </div>
              </div>

              <label className="flex cursor-pointer items-start gap-2.5 pt-0.5">
                <input
                  type="checkbox"
                  name="agree"
                  checked={registerForm.agree}
                  onChange={handleRegisterChange}
                  onBlur={() => markRegisterTouched('agree')}
                  required
                  className={`mt-0.5 h-4 w-4 rounded border ${termsError ? 'border-red-300' : 'border-stone-300'} text-[#b8864a] focus:ring-[#b8864a]`}
                />
                <span className="text-[13px] leading-5 text-[#6f6a64]">
                  I agree to Tarmeer&apos;s{' '}
                  <a className="font-medium text-[#9b7242] transition-colors hover:text-[#7e5b33] hover:underline" href="/privacy">
                    Privacy Policy
                  </a>
                  .
                </span>
              </label>
              {termsError && (
                <p className="-mt-1 text-xs text-red-600">Please agree before creating your account.</p>
              )}

              <LoadingButton
                type="submit"
                loading={loading}
                loadingText="Creating account..."
                disabled={registerDisabled}
                className="h-11 w-full rounded-lg font-medium btn-primary text-white disabled:cursor-not-allowed disabled:opacity-60 disabled:saturate-75"
              >
                Create account
              </LoadingButton>
            </form>
          )}
        </div>
      </main>
    </div>
  );
}
