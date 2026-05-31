'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function SupplierPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/supplier/dashboard');
  }, [router]);
  return null;
}
