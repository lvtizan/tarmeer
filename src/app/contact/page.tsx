import type { Metadata } from 'next';
import { headers } from 'next/headers';
import ContactClient from '@/components/contact/ContactClient';
import { getCountry } from '@/lib/country';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const c = getCountry((await headers()).get('x-country'));
  return {
    title: `Contact Tarmeer | Partner with ${c.name}'s Leading Design Platform`,
    description: `Get in touch with Tarmeer. Partner with us for interior design, renovation, and fit-out services in ${c.name}.`,
    openGraph: {
      title: 'Contact Us - Tarmeer',
      description: `Get in touch with Tarmeer for design and renovation partnerships in ${c.name}.`,
      url: `${c.baseUrl}/contact`,
      type: 'website',
      images: [{ url: `${c.baseUrl}/images/tarmeer_logo.svg` }],
    },
    twitter: {
      card: 'summary_large_image',
      title: 'Contact Us - Tarmeer',
      description: `Get in touch with Tarmeer. Partner with us for interior design, renovation, and fit-out services in ${c.name}.`,
      images: [`${c.baseUrl}/images/tarmeer_logo.svg`],
    },
    keywords: ['contact tarmeer', 'interior design partnership', `${c.name} showroom`, 'renovation partner'],
    robots: { index: true, follow: true },
    alternates: { canonical: `${c.baseUrl}/contact` },
  };
}

export default function ContactPage() {
  return <ContactClient />;
}
