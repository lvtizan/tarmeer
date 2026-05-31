import type { Metadata } from 'next';
import NewHomeDesignClient from '@/components/services/NewHomeDesignClient';

export const metadata: Metadata = {
  title: 'New Home Design Service - Floor Plans & 3D Renderings | Tarmeer',
  description: 'Professional new home interior design service in the UAE. Get floor plans, 3D renderings, construction drawings, and full material specifications. Starting from AED 2,999.',
  openGraph: {
    title: 'New Home Design Service | Tarmeer',
    description: 'Floor plans, 3D renderings, and construction drawings for your new home in the UAE.',
    images: [{ url: 'https://www.tarmeer.com/og-default.jpg' }],
    type: 'website',
    url: 'https://www.tarmeer.com/services/new-home-design',
  },
  twitter: { card: 'summary_large_image' },
  keywords: ['new home design UAE', 'interior design service', 'floor plan', '3D rendering', 'construction drawings', 'Tarmeer'],
  robots: { index: true, follow: true },
  alternates: { canonical: 'https://www.tarmeer.com/services/new-home-design' },
};

export default function NewHomeDesignPage() {
  return <NewHomeDesignClient />;
}
