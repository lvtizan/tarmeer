import type { Metadata } from 'next';
import ForHomeownersClient from '@/components/for-homeowners/ForHomeownersClient';

export const metadata: Metadata = {
  title: 'Find Renovation Companies in UAE | Free Quotes | Tarmeer',
  description: 'Compare verified renovation companies in UAE. Browse real portfolios, get free quotes, and find the perfect match for your home project.',
  openGraph: {
    title: 'Find Renovation Companies in UAE | Free Quotes | Tarmeer',
    description: 'Compare verified renovation companies, browse real portfolios, and get free quotes — all in one place.',
    images: [{ url: 'https://www.tarmeer.com/images/tarmeer_logo.svg' }],
    url: 'https://www.tarmeer.com/for-homeowners',
    type: 'website',
  },
  twitter: { card: 'summary_large_image' },
  keywords: ['find renovation companies UAE', 'home renovation Dubai', 'interior design quotes', 'renovation platform', 'Tarmeer homeowners'],
  alternates: { canonical: 'https://www.tarmeer.com/for-homeowners' },
};

export default function ForHomeownersPage() {
  return <ForHomeownersClient />;
}
