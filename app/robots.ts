import type { MetadataRoute } from 'next'
import { SITE_URL } from '@/lib/site'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          // Member-only surfaces. They redirect to /login when signed out, so
          // crawling them yields nothing but wasted budget and stray login URLs
          // in the index.
          '/dashboard',
          '/browse',
          '/matches',
          '/dogs/',
          '/admin/',
          '/api/',
          '/auth/',
          // The carried-over static admin console. Gated by Supabase RLS rather
          // than by obscurity, but there is no reason for it to be indexed.
          '/admin.html',
          // Sample-data view — indexing it would put fictional dogs in search
          // results alongside real listings.
          '/app.html',
        ],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  }
}
