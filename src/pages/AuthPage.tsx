import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mail, Lock, Eye, EyeOff, AlertCircle, CheckCircle, Phone, MapPin, User, FileText, ChevronDown } from 'lucide-react';
import { api } from '../lib/api';
import LoadingButton from '../components/ui/LoadingButton';

const PHONE_COUNTRY_STORAGE_KEY = 'tarmeer_phone_country';

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

  const handleRegisterChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const target = e.target as HTMLInputElement;
    const { name, value, type, checked } = target;
    
    setRegisterForm((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
    
    setError(null);
    
    if (name === 'fullName') {
      // 支持全球语言字符：中文、英文、阿拉伯文、空格、连字符、点号等
      // Unicode 字母范围涵盖大多数语言
      if (value.length > 0 && !/^[\p{L}\s\-'\.]+$/u.test(value)) {
        setNameError('Name can only contain letters, spaces, hyphens and dots');
      } else if (value.length > 50) {
        setNameError('Name is too long (max 50 characters)');
      } else {
        setNameError(null);
      }
    }
    
    if (name === 'email') {
      const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
      if (value.length > 0 && !emailRegex.test(value)) {
        setEmailError('Please enter a valid email address');
      } else {
        setEmailError(null);
      }
    }
    
    if (name === 'phone') {
      const digits = value.replace(/\D/g, '');
      const fullPhone = phoneCountryCode + digits;
      const phoneRegex = /^\+[1-9]\d{1,14}$/;
      if (digits.length > 0 && !phoneRegex.test(fullPhone)) {
        setPhoneError('Please enter a valid phone number');
      } else {
        setPhoneError(null);
      }
    }
    
    if (name === 'password') {
      if (value.length > 0 && value.length < 6) {
        setPasswordError('Password must be at least 6 characters');
      } else if (value.length >= 6) {
        const hasLetter = /[a-zA-Z]/.test(value);
        const hasSymbol = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(value);
        
        if (!hasLetter) {
          setPasswordError('Password must contain English letters');
        } else if (!hasSymbol) {
          setPasswordError('Password must contain special characters (e.g., !@#$%^&*)');
        } else {
          setPasswordError(null);
        }
      } else {
        setPasswordError(null);
      }
    }
    
    if (name === 'confirmPassword' && registerForm.password !== value) {
      setPasswordError('Passwords do not match');
    } else if (name === 'confirmPassword' && registerForm.password === value) {
      setPasswordError(null);
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
    
    if (nameError) {
      setError(nameError);
      return;
    }
    
    if (emailError) {
      setError(emailError);
      return;
    }
    
    const fullPhone = phoneCountryCode + registerForm.phone.replace(/\D/g, '');
    if (!/^\+[1-9]\d{1,14}$/.test(fullPhone)) {
      setError('Please enter a valid phone number');
      return;
    }
    if (phoneError) {
      setError(phoneError);
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

    setLoading(true);
    setError(null);

    try {
      const res = await api.post('/auth/register', {
        email: registerForm.email,
        password: registerForm.password,
        full_name: registerForm.fullName,
        phone: fullPhone,
        city: registerForm.city
      });

      setSuccess(res?.message || 'Registration successful! Please check your email to verify your account.');
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
    } catch (err: any) {
      setError(err.message || 'Registration failed, please try again later');
    } finally {
      setLoading(false);
    }
  };

  // Design system: rounded-lg (8px) for all, pr-10 for right icon (24px spacing)
  const inputBaseClass = "w-full h-11 px-3 py-2.5 rounded-lg border bg-white text-sm text-[#2c2c2c] placeholder:text-[#6b6b6b] focus:outline-none focus:border-[#b8864a] focus:ring-2 focus:ring-[#b8864a]/40 transition-all";
  const inputErrorClass = "border-red-300 focus:border-red-400 focus:ring-red-400/40";
  const inputNormalClass = "border-stone-200";

  return (
    <div className="min-h-screen bg-[#faf9f7] text-[#2c2c2c] flex flex-col">
      <section className="relative h-[180px] sm:h-[220px] overflow-hidden bg-stone-200">
        <img
          src="/images/showroom-sharjah-panorama.png"
          alt=""
          className="w-full h-full object-cover"
          onError={(e) => {
            (e.target as HTMLImageElement).style.display = 'none';
          }}
        />
        <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
          <h1 className="font-serif text-2xl sm:text-3xl font-bold text-white">
            {tab === 'login' ? 'Designer Login' : 'Create Designer Account'}
          </h1>
        </div>
      </section>

      <main className="flex-1 flex items-start justify-center px-4 py-8">
        <div className="w-full max-w-[440px]">
          <div className="flex rounded-lg bg-white border border-stone-200 p-1 mb-6">
            <button
              type="button"
              onClick={() => { setTab('login'); setError(null); setSuccess(null); }}
              className={`flex-1 py-2 rounded-md text-sm font-medium transition-all ${
                tab === 'login'
                  ? 'bg-[#b8864a] text-white'
                  : 'text-[#6b6b6b] hover:bg-stone-50'
              }`}
            >
              Sign in
            </button>
            <button
              type="button"
              onClick={() => { setTab('register'); setError(null); setSuccess(null); }}
              className={`flex-1 py-2 rounded-md text-sm font-medium transition-all ${
                tab === 'register'
                  ? 'bg-[#b8864a] text-white'
                  : 'text-[#6b6b6b] hover:bg-stone-50'
              }`}
            >
              Create account
            </button>
          </div>

          {error && (
            <div className="mb-4 p-4 rounded-lg bg-red-50 border border-red-200 flex items-start gap-3">
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
            <div className="mb-4 p-4 rounded-lg bg-green-50 border border-green-200 flex items-start gap-3">
              <CheckCircle className="w-5 h-5 text-green-500 shrink-0 mt-0.5" />
              <p className="text-sm text-green-700">{success}</p>
            </div>
          )}

          {tab === 'login' && (
            <form
              onSubmit={handleLoginSubmit}
              className="bg-white rounded-lg border border-stone-200 shadow-sm p-6 space-y-5"
            >
              <div className="space-y-1.5">
                <label className="block text-sm font-semibold text-[#2c2c2c]">Email</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
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
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
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
                    tabIndex={-1}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-[#b8864a]"
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
              className="bg-white rounded-lg border border-stone-200 shadow-sm p-6 space-y-4"
            >
              <div className="space-y-1.5">
                <label className="block text-sm font-semibold text-[#2c2c2c]">Full Name</label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
                  <input
                    name="fullName"
                    type="text"
                    required
                    value={registerForm.fullName}
                    onChange={handleRegisterChange}
                    placeholder="Your full name"
                    autoComplete="name"
                    className={`${inputBaseClass} pl-10 ${nameError && registerForm.fullName ? inputErrorClass : inputNormalClass}`}
                  />
                </div>
                {nameError && registerForm.fullName && (
                  <p className="text-xs text-red-500 mt-1">{nameError}</p>
                )}
              </div>

              <div className="space-y-1.5">
                <label className="block text-sm font-semibold text-[#2c2c2c]">Email</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
                  <input
                    name="email"
                    type="email"
                    required
                    value={registerForm.email}
                    onChange={handleRegisterChange}
                    placeholder="name@studio.com"
                    autoComplete="email"
                    className={`${inputBaseClass} pl-10 ${emailError && registerForm.email ? inputErrorClass : inputNormalClass}`}
                  />
                </div>
                {emailError && registerForm.email && (
                  <p className="text-xs text-red-500 mt-1">{emailError}</p>
                )}
              </div>

              <div className="space-y-1.5">
                <label className="block text-sm font-semibold text-[#2c2c2c]">Phone / WhatsApp</label>
                <div className="flex gap-2">
                  <div className="relative">
                    <select
                      value={phoneCountryCode}
                      onChange={(e) => {
                        const v = e.target.value;
                        setPhoneCountryCode(v);
                        localStorage.setItem(PHONE_COUNTRY_STORAGE_KEY, v);
                        setPhoneError(null);
                      }}
                      className="h-11 w-[90px] shrink-0 rounded-lg border border-stone-200 bg-white pl-2 pr-7 text-sm focus:border-[#b8864a] focus:outline-none focus:ring-2 focus:ring-[#b8864a]/40 appearance-none cursor-pointer"
                      aria-label="Country code"
                    >
                      {PHONE_COUNTRY_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>{opt.value}</option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#b8864a] pointer-events-none" />
                  </div>
                  <div className="relative flex-1">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
                    <input
                      name="phone"
                      type="tel"
                      required
                      value={registerForm.phone}
                      onChange={handleRegisterChange}
                      placeholder="50 123 4567"
                      autoComplete="tel-national"
                      className={`${inputBaseClass} pl-10 ${phoneError && registerForm.phone ? inputErrorClass : inputNormalClass}`}
                    />
                  </div>
                </div>
                {phoneError && registerForm.phone && (
                  <p className="text-xs text-red-500 mt-1">{phoneError}</p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="block text-sm font-semibold text-[#2c2c2c]">Password</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
                    <input
                      name="password"
                      type={showPassword ? 'text' : 'password'}
                      required
                      minLength={6}
                      value={registerForm.password}
                      onChange={handleRegisterChange}
                      placeholder="6+ chars"
                      autoComplete="new-password"
                      className={`${inputBaseClass} pl-10 pr-10 ${passwordError && registerForm.password ? inputErrorClass : inputNormalClass}`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      tabIndex={-1}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-[#b8864a]"
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                
                <div className="space-y-1.5">
                  <label className="block text-sm font-semibold text-[#2c2c2c]">Confirm</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
                    <input
                      name="confirmPassword"
                      type={showConfirmPassword ? 'text' : 'password'}
                      required
                      minLength={6}
                      value={registerForm.confirmPassword}
                      onChange={handleRegisterChange}
                      placeholder="Confirm"
                      autoComplete="new-password"
                      className={`${inputBaseClass} pl-10 pr-10 ${passwordError && registerForm.confirmPassword ? inputErrorClass : inputNormalClass}`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword((v) => !v)}
                      tabIndex={-1}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-[#b8864a]"
                      aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                    >
                      {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              </div>
              {passwordError && (registerForm.password || registerForm.confirmPassword) && (
                <p className="text-xs text-red-500 -mt-2">{passwordError}</p>
              )}

              <div className="space-y-1.5">
                <label className="block text-sm font-semibold text-[#2c2c2c]">City</label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400 z-10" />
                  <select
                    name="city"
                    value={registerForm.city}
                    onChange={handleRegisterChange}
                    className={`${inputBaseClass} pl-10 pr-10 appearance-none cursor-pointer`}
                  >
                    <option value="">Select City</option>
                    <option value="Dubai">Dubai</option>
                    <option value="Sharjah">Sharjah</option>
                    <option value="Abu Dhabi">Abu Dhabi</option>
                    <option value="Ajman">Ajman</option>
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#b8864a] pointer-events-none" />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="block text-sm font-semibold text-[#2c2c2c]">
                  Design Philosophy <span className="text-[#6b6b6b] font-normal">(optional)</span>
                </label>
                <div className="relative">
                  <FileText className="absolute left-3 top-3 w-4 h-4 text-stone-400" />
                  <textarea
                    name="philosophy"
                    rows={2}
                    value={registerForm.philosophy}
                    onChange={handleRegisterChange}
                    placeholder="Briefly describe your design style..."
                    className="w-full min-h-[44px] py-2.5 px-3 pl-10 rounded-lg border border-stone-200 bg-white text-sm text-[#2c2c2c] placeholder:text-[#6b6b6b] focus:outline-none focus:border-[#b8864a] focus:ring-2 focus:ring-[#b8864a]/40 transition-all resize-none"
                  />
                </div>
              </div>

              <label className="flex items-start gap-3 cursor-pointer pt-1">
                <input
                  type="checkbox"
                  name="agree"
                  checked={registerForm.agree}
                  onChange={handleRegisterChange}
                  required
                  className="mt-0.5 h-4 w-4 rounded border-stone-300 text-[#b8864a] focus:ring-[#b8864a]"
                />
                <span className="text-sm text-[#6b6b6b] leading-relaxed">
                  I agree to Tarmeer&apos;s <span className="text-[#b8864a] hover:underline cursor-pointer">Terms of Service</span> and <span className="text-[#b8864a] hover:underline cursor-pointer">Privacy Policy</span>.
                </span>
              </label>
              
              <LoadingButton
                type="submit"
                loading={loading}
                disabled={!registerForm.agree}
                className="w-full h-11 rounded-lg font-medium btn-primary text-white disabled:opacity-50 disabled:cursor-not-allowed"
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
