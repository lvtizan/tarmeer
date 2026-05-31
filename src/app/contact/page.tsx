import type { Metadata } from 'next';
import ContactClient from '@/components/contact/ContactClient';

export const metadata: Metadata = {
  title: 'Contact Tarmeer | Partner with UAE\'s Leading Design Platform',
  description: 'Get in touch with Tarmeer. Partner with us for interior design, renovation, and fit-out services in the UAE.',
  openGraph: {
    title: 'Contact Us - Tarmeer',
    description: 'Get in touch with Tarmeer for design and renovation partnerships in UAE.',
    url: 'https://www.tarmeer.com/contact',
    type: 'website',
    images: [{ url: 'https://www.tarmeer.com/images/tarmeer_logo.svg' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Contact Us - Tarmeer',
    description: 'Get in touch with Tarmeer. Partner with us for interior design, renovation, and fit-out services in the UAE.',
    images: ['https://www.tarmeer.com/images/tarmeer_logo.svg'],
  },
  keywords: ['contact tarmeer', 'interior design partnership', 'UAE showroom', 'renovation partner'],
  robots: { index: true, follow: true },
  alternates: { canonical: 'https://www.tarmeer.com/contact' },
};

export default function ContactPage() {
  return <ContactClient />;
}
