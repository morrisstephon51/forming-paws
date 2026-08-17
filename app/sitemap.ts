import type { MetadataRoute } from 'next'
import { SITE_URL } from '@/lib/site'
import { GUIDES } from '@/lib/education'

/**
 * Public pages only. Everything behind auth is excluded here and in robots.ts —
 * listing a page that redirects to /login just spends crawl budget.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date('2026-08-17')

  return [
    { url: `${SITE_URL}/`, lastModified, changeFrequency: 'weekly', priority: 1 },
    { url: `${SITE_URL}/signup`, lastModified, changeFrequency: 'monthly', priority: 0.8 },
    { url: `${SITE_URL}/about`, lastModified, changeFrequency: 'monthly', priority: 0.8 },
    { url: `${SITE_URL}/education`, lastModified, changeFrequency: 'monthly', priority: 0.8 },
    { url: `${SITE_URL}/app`, lastModified, changeFrequency: 'monthly', priority: 0.7 },
    // Each guide is its own URL and its own answer to a real search — they are
    // listed individually rather than trusting a crawler to find them from the
    // hub.
    ...GUIDES.map((guide) => ({
      url: `${SITE_URL}/education/${guide.slug}`,
      lastModified,
      changeFrequency: 'monthly' as const,
      priority: 0.7,
    })),
    { url: `${SITE_URL}/vets`, lastModified, changeFrequency: 'monthly', priority: 0.6 },
    { url: `${SITE_URL}/faq`, lastModified, changeFrequency: 'monthly', priority: 0.6 },
    { url: `${SITE_URL}/donate`, lastModified, changeFrequency: 'monthly', priority: 0.5 },
    { url: `${SITE_URL}/contact`, lastModified, changeFrequency: 'yearly', priority: 0.5 },
    { url: `${SITE_URL}/login`, lastModified, changeFrequency: 'yearly', priority: 0.3 },
    { url: `${SITE_URL}/privacy`, lastModified, changeFrequency: 'yearly', priority: 0.3 },
    { url: `${SITE_URL}/terms`, lastModified, changeFrequency: 'yearly', priority: 0.3 },
  ]
}
