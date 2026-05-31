import type { Metadata } from 'next';
import DmcaClient from '@/components/dmca/DmcaClient';

export const metadata: Metadata = {
  title: 'DMCA / Copyright Policy | Tarmeer',
  description: 'Tarmeer DMCA and copyright policy. How to report copyright infringement.',
  robots: { index: true, follow: true },
  openGraph: {
    title: 'DMCA Policy - Tarmeer',
    description: 'Tarmeer DMCA and copyright policy.',
    url: 'https://www.tarmeer.com/dmca',
  },
  alternates: { canonical: 'https://www.tarmeer.com/dmca' },
};

export default function DmcaPage() {
  return <DmcaClient />;
}
