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
 * The browser tab, the search result, and every shared link preview.
 *
 * This was "Forming Paws: Healthy Matches. Happy Litters." -- a tagline that
 * never says the word "dog". It is the first thing a person sees in a tab, in
 * a Google result and in a pasted link, and from it they could not tell whether
 * this is a breeder directory, a pet shop or a fertility clinic. That is the
 * same complaint that produced lib/positioning: people arrive and ask what we
 * actually do. A title is one of the places they arrive.
 *
 * Kept under 60 characters so search results do not truncate it, and leading
 * with the brand so the tab is still identifiable at a glance. The old tagline
 * still runs where it has room to work: the Open Graph card, which has a
 * clarifying subtitle underneath it.
 */
export const SITE_TITLE = `${SITE_NAME}: Health-Verified Dog Breeding Matches Nearby`

export const SITE_DESCRIPTION =
  'Forming Paws connects dog owners nearby for safe, health-documented breeding matches, with veterinary verification at the centre of everything.'

/** Where privacy and data questions go. */
export const CONTACT_EMAIL = 'founder@theplugai.info'

/** Last substantive revision of the privacy policy and terms. */
export const LEGAL_LAST_UPDATED = '12 August 2026'
