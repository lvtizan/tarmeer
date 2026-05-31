import type { Metadata } from 'next';
import { Suspense } from 'react';
import AuthClient from '@/components/auth/AuthClient';

export const metadata: Metadata = {
  title: 'Sign In / Register - Tarmeer',
  description: 'Sign in or create your Tarmeer account to connect with interior design and renovation professionals in UAE.',
  robots: { index: false, follow: false },
  alternates: { canonical: 'https://www.tarmeer.com/auth' },
};

export default function AuthPage() {
  return (
    <Suspense>
      <AuthClient />
    </Suspense>
  );
}
