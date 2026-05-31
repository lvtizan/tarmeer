import type { Metadata } from 'next';
import SoftDecorationClient from '@/components/services/SoftDecorationClient';

export const metadata: Metadata = {
  title: 'Soft Decoration & Furniture Design Service | Tarmeer',
  description: 'Professional soft decoration service in the UAE. Furniture selection, color schemes, lighting plans, and complete styling for move-in ready spaces.',
  openGraph: {
    title: 'Soft Decoration & Furniture Design | Tarmeer',
    description: 'Furniture, color schemes, lighting, and styling for your home in the UAE.',
    images: [{ url: 'https://www.tarmeer.com/og-default.jpg' }],
    type: 'website',
    url: 'https://www.tarmeer.com/services/soft-decoration',
  },
  twitter: { card: 'summary_large_image' },
  keywords: ['soft decoration UAE', 'furniture design', 'interior styling', 'color scheme', 'lighting plan', 'Tarmeer'],
  robots: { index: true, follow: true },
  alternates: { canonical: 'https://www.tarmeer.com/services/soft-decoration' },
};

export default function SoftDecorationPage() {
  return <SoftDecorationClient />;
}
