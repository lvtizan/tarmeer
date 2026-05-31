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
          '/supplier/',
          '/auth/',
          '/api/',
        ],
      },
    ],
    sitemap: 'https://www.tarmeer.com/sitemap.xml',
  };
}
