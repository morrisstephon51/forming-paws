/**
 * Canonical origin for absolute URLs (Open Graph, sitemap, canonical tags).
 *
 * Hard-coded rather than derived from VERCEL_URL: preview deployments get a
 * different hostname every build, and a canonical tag pointing at a preview
 * would ask search engines to index a throwaway URL.
 */
export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://theplugai.xyz'

export const SITE_NAME = 'Forming Paws'

/**
 * The title-tag tagline.
 *
 * It was 'Healthy Matches. Happy Litters.' -- a good brand line that carries no
 * search intent at all. The <title> is the single highest-value SEO slot on the
 * site and the first thing a searcher reads, so it now carries the phrase people
 * type. The brand line is not lost: it still runs on the page itself, where it
 * has room to do the warmth job it is actually good at.
 *
 * Kept at 58 characters including the brand name, under the ~60 Google renders.
 */
export const SITE_TAGLINE = 'Health-Verified Dog Breeding Matches Near You'

/**
 * The meta description, and the sentence most people read before they ever
 * reach the site. Written to the two things a search result has to do at once:
 * carry the phrase someone actually typed (health-verified dog breeding,
 * matches near you) and give them a reason to click rather than a summary of
 * the company. Kept under 160 characters so Google does not truncate the ask.
 */
export const SITE_DESCRIPTION =
  'Health-verified dog breeding matches near you. A person reads the vet records before matching unlocks, and every match is close enough to meet. Join free.'

/** Where privacy and data questions go. */
export const CONTACT_EMAIL = 'founder@theplugai.info'

/** Last substantive revision of the privacy policy and terms. */
export const LEGAL_LAST_UPDATED = '12 August 2026'
