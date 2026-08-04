import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/admin', '/invoices', '/approve', '/feedback'],
      },
    ],
    sitemap: 'https://www.opnrenovation.com/sitemap.xml',
  };
}
