import type { Metadata } from 'next';
import { Suspense } from 'react';
import { headers } from 'next/headers';
import { getCountry } from '@/lib/country';
import AuthClient from '@/components/auth/AuthClient';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const c = getCountry((await headers()).get('x-country'));
  return {
    title: 'Sign In / Register - Tarmeer',
    description: `Sign in or create your Tarmeer account to connect with interior design and renovation professionals in ${c.name}.`,
    robots: { index: false, follow: false },
    alternates: { canonical: `${c.baseUrl}/auth` },
  };
}

export default async function AuthPage() {
  const headersList = await headers();
  const country = headersList.get('x-country') ?? 'ae';
  return (
    <Suspense>
      <AuthClient country={country} />
    </Suspense>
  );
}
