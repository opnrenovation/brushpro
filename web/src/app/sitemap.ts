import type { MetadataRoute } from 'next';

const BASE = 'https://www.opnrenovation.com';

export default function sitemap(): MetadataRoute.Sitemap {
  return ['', '/services', '/about', '/contact', '/book'].map((path) => ({
    url: `${BASE}${path}`,
    lastModified: new Date(),
    changeFrequency: 'monthly' as const,
    priority: path === '' ? 1 : 0.8,
  }));
}
