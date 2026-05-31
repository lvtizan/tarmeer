import type { Metadata } from 'next';
import { Suspense } from 'react';
import VerifyEmailClient from '@/components/auth/VerifyEmailClient';

export const metadata: Metadata = {
  title: 'Verify Email - Tarmeer',
  robots: { index: false, follow: false },
};

export default function VerifyEmailPage() {
  return (
    <Suspense>
      <VerifyEmailClient />
    </Suspense>
  );
}
