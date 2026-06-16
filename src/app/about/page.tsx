import type { Metadata } from 'next';
import { headers } from 'next/headers';
import AboutClient from '@/components/about/AboutClient';
import { getCountry } from '@/lib/country';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const c = getCountry((await headers()).get('x-country'));
  const isVn = c.code === 'vn';
  return {
    title: isVn
      ? `Về Chúng Tôi | Tarmeer ${c.name}`
      : `About Us | Tarmeer ${c.name}`,
    description: isVn
      ? 'Tarmeer kết nối gia chủ với các đối tác thiết kế, thi công và cải tạo uy tín tại Việt Nam.'
      : 'Tarmeer connects homeowners with verified design, build and renovation companies — and trusted building-materials suppliers — across the UAE.',
    alternates: { canonical: `${c.baseUrl}/about` },
    openGraph: {
      title: `About Tarmeer ${c.name}`,
      description: 'Connecting homeowners with trusted design, build and renovation partners.',
      url: `${c.baseUrl}/about`,
      type: 'website',
    },
  };
}

export default function AboutPage() {
  return <AboutClient />;
}
