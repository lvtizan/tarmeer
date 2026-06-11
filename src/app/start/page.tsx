import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { getCountry } from '@/lib/country';
import StartGuideClient from '@/components/start/StartGuideClient';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const c = getCountry((await headers()).get('x-country'));
  return {
    title: 'How to Get Started on Tarmeer | Company Onboarding Guide',
    description: `Step-by-step guide for construction and renovation companies joining Tarmeer. Set up your profile in 15 minutes and start receiving homeowner inquiries across ${c.name}.`,
    openGraph: {
      title: 'How to Get Started on Tarmeer | Company Guide',
      description: `Register your company, upload your projects, and receive verified homeowner inquiries across ${c.name}.`,
      images: [{ url: `${c.baseUrl}/images/tarmeer_logo.svg` }],
      url: `${c.baseUrl}/start`,
      type: 'website',
    },
    robots: { index: true, follow: true },
    alternates: { canonical: `${c.baseUrl}/start` },
  };
}

export default function StartGuidePage() {
  return <StartGuideClient />;
}
