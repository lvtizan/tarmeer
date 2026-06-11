import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
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
    sitemap: 'https://www.tarmeer.com/sitemap.xml',
  };
}
