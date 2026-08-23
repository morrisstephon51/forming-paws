import type { Metadata } from 'next'
import { SITE_DESCRIPTION, SITE_NAME, SITE_URL } from '@/lib/site'

/**
 * Per-page metadata, in one place so no page can quietly ship with the site-wide
 * title and description standing in for its own.
 *
 * The root layout sets `title.template`, so `title` here is the bare page name —
 * "Frequently asked questions", not "Frequently asked questions — Forming Paws".
 *
 * `index: false` is for pages that only exist behind a sign-in. They redirect to
 * /login for a crawler, so indexing them yields a login page under a member URL.
 * Those pages still get a real title, because a browser tab and a history entry
 * reading "Forming Paws" fourteen times is its own small failure.
 */
export function pageMetadata({
  title,
  description,
  path,
  index = true,
}: {
  title: string
  description: string
  path: string
  index?: boolean
}): Metadata {
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: {
      type: 'website',
      siteName: SITE_NAME,
      title: `${title} · ${SITE_NAME}`,
      description,
      url: path,
      locale: 'en_US',
    },
    twitter: {
      card: 'summary_large_image',
      title: `${title} · ${SITE_NAME}`,
      description,
    },
    ...(index ? {} : { robots: { index: false, follow: false } }),
  }
}

/** Absolute URL for a path, for schema and share links. */
export function absoluteUrl(path: string): string {
  return `${SITE_URL}${path}`
}

export { SITE_DESCRIPTION }
