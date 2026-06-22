import type { MetadataRoute } from 'next';
import { headers } from 'next/headers';
import { getCountry } from '@/lib/country';

export const dynamic = 'force-dynamic';

export default async function robots(): Promise<MetadataRoute.Robots> {
  // 按子域名取国家根 URL：vn.tarmeer.com → VN sitemap，www → AE sitemap
  const c = getCountry((await headers()).get('x-country'));
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/admin/',
          '/dashboard/',
          '/company/',
          '/expert/',
          '/supplier/',
          '/field/',
          '/auth/',
          '/api/',
          '/sso/',
          '/verify-email',
          '/forgot-password',
          '/reset-password',
          '/onboarding',
        ],
      },
    ],
    sitemap: `${c.baseUrl}/sitemap.xml`,
  };
}
