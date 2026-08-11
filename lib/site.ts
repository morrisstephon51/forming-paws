/**
 * Canonical origin for absolute URLs (Open Graph, sitemap, canonical tags).
 *
 * Hard-coded rather than derived from VERCEL_URL: preview deployments get a
 * different hostname every build, and a canonical tag pointing at a preview
 * would ask search engines to index a throwaway URL.
 */
export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://theplugai.xyz'

export const SITE_NAME = 'Forming Paws'

export const SITE_DESCRIPTION =
  'Forming Paws connects dog owners nearby for safe, health-documented breeding matches — with veterinary verification at the centre of everything.'

/** Where privacy and data questions go. */
export const CONTACT_EMAIL = 'founder@theplugai.info'

/** Last substantive revision of the privacy policy and terms. */
export const LEGAL_LAST_UPDATED = '12 August 2026'
