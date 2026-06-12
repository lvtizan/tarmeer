'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';

export default function FieldLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // 公开页：登录页 + 问卷（无需登录，任何人可填）
    if (pathname === '/field/login' || pathname === '/field/survey') {
      setReady(true);
      return;
    }
    const token = localStorage.getItem('field_token');
    if (!token) {
      router.replace('/field/login');
      return;
    }
    // Check expiry (JWT payload is base64 — decode second segment)
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      if (payload.exp && payload.exp * 1000 < Date.now()) {
        localStorage.removeItem('field_token');
        localStorage.removeItem('field_user');
        router.replace('/field/login');
        return;
      }
    } catch {
      // Malformed token — kick to login
      localStorage.removeItem('field_token');
      router.replace('/field/login');
      return;
    }
    setReady(true);
  }, [pathname, router]);

  if (!ready) return <div className="min-h-screen bg-[#faf9f7]" />;

  return (
    <div className="min-h-screen bg-[#faf9f7]">
      {children}
    </div>
  );
}
