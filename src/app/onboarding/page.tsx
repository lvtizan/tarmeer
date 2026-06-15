'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Home, Building2, Info, ArrowLeft, LogOut } from 'lucide-react';
import { useSiteLocale } from '@/contexts/SiteLocaleContext';

const API_BASE = process.env.NEXT_PUBLIC_API_URL?.trim() || '/api';

type Role = 'homeowner' | 'company';

interface RoleOption {
  id: Role;
  icon: React.ReactNode;
  title: string;
  description: string;
  redirectPath: string;
}

export default function OnboardingPage() {
  const router = useRouter();
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const to = useSiteLocale().tr.onboarding;

  const roles: RoleOption[] = [
    {
      id: 'homeowner',
      icon: <Home className="w-10 h-10" />,
      title: to.roleHomeownerTitle,
      description: to.roleHomeownerDesc,
      redirectPath: '/dashboard',
    },
    {
      id: 'company',
      icon: <Building2 className="w-10 h-10" />,
      title: to.roleCompanyTitle,
      description: to.roleCompanyDesc,
      redirectPath: '/company',
    },
  ];

  const handleLogout = () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('auth_token');
      localStorage.removeItem('active_role');
      localStorage.removeItem('user');
    }
    router.replace('/auth');
  };

  const handleSelectRole = async (role: Role) => {
    setSelectedRole(role);
    setIsLoading(true);
    setError(null);

    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;
      const res = await fetch(`${API_BASE}/auth/select-role`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ role }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error((data as { error?: string }).error || to.errorOccurred);
      }
      if (typeof window !== 'undefined') localStorage.setItem('active_role', role);
      const opt = roles.find((r) => r.id === role);
      if (opt) router.push(opt.redirectPath);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : to.errorOccurred);
      setSelectedRole(null);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#faf9f7]">
      <div className="flex min-h-screen justify-center px-4 pb-10 pt-[clamp(28px,12vh,120px)] sm:pt-[clamp(40px,14vh,140px)]">
        <div className="w-full max-w-2xl">

          <motion.div
            className="text-center mb-10"
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <h1 className="font-serif text-3xl md:text-4xl font-bold text-[#2c2c2c] mb-3">
              {to.title}
            </h1>
            <p className="text-stone-500 text-base max-w-lg mx-auto">
              {to.subtitle}
            </p>
          </motion.div>

          {error && (
            <motion.div
              className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-center text-sm"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
            >
              <p>{error}</p>
              {/(token|log in|authentication)/i.test(error) && (
                <div className="mt-3 flex flex-wrap items-center justify-center gap-3">
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="inline-flex items-center gap-2 rounded-lg border border-red-200 bg-white px-3 py-2 font-semibold text-red-700 transition hover:bg-red-100"
                  >
                    <LogOut className="h-4 w-4" />
                    {to.reLogin}
                  </button>
                  <button
                    type="button"
                    onClick={() => router.push('/')}
                    className="inline-flex items-center gap-2 rounded-lg border border-stone-200 bg-white px-3 py-2 font-semibold text-stone-700 transition hover:bg-stone-50"
                  >
                    <ArrowLeft className="h-4 w-4" />
                    {to.home}
                  </button>
                </div>
              )}
            </motion.div>
          )}

          <motion.div
            className="grid grid-cols-1 sm:grid-cols-2 gap-5"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
          >
            {roles.map((role) => {
              const isSelected = selectedRole === role.id;
              return (
                <motion.button
                  key={role.id}
                  onClick={() => handleSelectRole(role.id)}
                  disabled={isLoading}
                  whileHover={{ y: -4 }}
                  whileTap={{ scale: 0.98 }}
                  className={`group relative w-full text-left rounded-2xl border p-8 transition-all duration-300 ${
                    isSelected
                      ? 'border-[#b8864a] bg-[#b8864a]/5 shadow-lg shadow-[#b8864a]/10'
                      : 'border-stone-200 bg-white hover:border-[#b8864a]/40 hover:shadow-lg'
                  } ${isLoading ? 'cursor-not-allowed opacity-70' : ''}`}
                >
                  <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mb-5 transition-colors duration-300 ${
                    isSelected ? 'bg-[#b8864a] text-white' : 'bg-[#b8864a]/10 text-[#b8864a] group-hover:bg-[#b8864a]/15'
                  }`}>
                    {role.icon}
                  </div>
                  <h3 className={`text-xl font-bold mb-2 transition-colors duration-300 ${
                    isSelected ? 'text-[#b8864a]' : 'text-[#2c2c2c] group-hover:text-[#b8864a]'
                  }`}>
                    {role.title}
                  </h3>
                  <p className="text-stone-500 text-sm leading-relaxed">{role.description}</p>
                  <div className={`mt-6 w-full py-3 rounded-lg font-semibold text-center text-sm transition-all duration-300 ${
                    isSelected
                      ? 'bg-[#b8864a] text-white'
                      : 'bg-[#b8864a]/10 text-[#b8864a] group-hover:bg-[#b8864a]/20'
                  }`}>
                    {isSelected && isLoading ? (
                      <span className="flex items-center justify-center gap-2">
                        <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        {to.selecting}
                      </span>
                    ) : isSelected ? to.selected : to.select}
                  </div>
                </motion.button>
              );
            })}
          </motion.div>

          <motion.div
            className="mt-10 flex items-center gap-3 rounded-2xl border border-[#b8864a]/20 bg-[#b8864a]/5 px-6 py-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.8 }}
          >
            <Info className="w-5 h-5 text-[#b8864a] flex-shrink-0" />
            <p className="text-[#2c2c2c] text-[15px] font-medium">
              {to.changeRoleNote}
            </p>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
