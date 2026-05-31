import type { Metadata } from 'next';
import StartGuideClient from '@/components/start/StartGuideClient';

export const metadata: Metadata = {
  title: 'How to Get Started on Tarmeer | Company Onboarding Guide',
  description: 'Step-by-step guide for construction and renovation companies joining Tarmeer. Set up your profile in 15 minutes and start receiving homeowner inquiries across UAE.',
  openGraph: {
    title: 'How to Get Started on Tarmeer | Company Guide',
    description: 'Register your company, upload your projects, and receive verified homeowner inquiries across UAE.',
    images: [{ url: 'https://www.tarmeer.com/images/tarmeer_logo.svg' }],
    url: 'https://www.tarmeer.com/start',
    type: 'website',
  },
  robots: { index: true, follow: true },
  alternates: { canonical: 'https://www.tarmeer.com/start' },
};

export default function StartGuidePage() {
  return <StartGuideClient />;
}
