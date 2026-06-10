'use client';

import { useState, useEffect, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { LogOut } from 'lucide-react';
import TarmeerLogo from '@/components/TarmeerLogo';
import { safeRemoveItem } from '@/lib/storage';
import { useSiteLocale } from '@/contexts/SiteLocaleContext';

interface ExpertLayoutProps {
  children: ReactNode;
}

export default function ExpertLayout({ children }: ExpertLayoutProps) {
  const router = useRouter();
  const { lang } = useSiteLocale();
  const t = (en: string, vi: string) => (lang === 'vi' ? vi : en);
  const token = typeof window !== 'undefined' ? api.getToken() : null;
  const [authValid, setAuthValid] = useState<boolean | null>(token ? null : false);

  useEffect(() => {
    if (!token) {
      setAuthValid(false);
      router.replace('/auth');
      return;
    }

    let mounted = true;
    api.get('/auth/me')
      .then(() => {
        if (!mounted) return;
        setAuthValid(true);
      })
      .catch(() => {
        if (!mounted) return;
        api.clearToken();
        safeRemoveItem('user');
        safeRemoveItem('active_role');
        setAuthValid(false);
        router.replace('/auth');
      });

    return () => { mounted = false; };
  }, [token, router]);

  const handleLogout = () => {
    api.clearToken();
    safeRemoveItem('user');
    safeRemoveItem('active_role');
    router.push('/auth');
  };

  if (!token || authValid === false) {
    return <div className="min-h-screen flex items-center justify-center text-stone-400">Redirecting...</div>;
  }

  if (authValid !== true) {
    return <div className="min-h-screen flex items-center justify-center text-stone-400">Checking session...</div>;
  }

  return (
    <div className="min-h-screen bg-stone-50 flex flex-col">
      <header className="bg-white border-b border-stone-200 sticky top-0 z-30 h-14 flex items-center px-4 sm:px-6 justify-between shrink-0">
        <TarmeerLogo className="h-6" />
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-[#2c2c2c] hidden sm:block">
            {t('Expert Center', 'Trung tâm chuyên gia')}
          </span>
          <button onClick={handleLogout} className="text-stone-400 hover:text-stone-600 transition p-1" title={t('Log out', 'Đăng xuất')}>
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      <main className="flex-1 w-full max-w-3xl mx-auto px-4 sm:px-6 py-6">
        {children}
      </main>
    </div>
  );
}
