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
          // The old static sample view. Redirects to /app, which is a genuine
          // page and is indexed — its example dogs are labelled as examples.
          '/app.html',
          // Confirmation pages. Crawlable on purpose so the noindex tag on them
          // is actually read; a disallow here would hide that tag instead.
          '/account/',
        ],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  }
}
