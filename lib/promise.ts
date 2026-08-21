/**
 * The reply-time commitment, in one place.
 *
 * It appears on the contact page, in the FAQ, in the footer and on the thank-you
 * page. Four hard-coded copies would eventually disagree, and the one that says
 * something you can't deliver is the one a member will read.
 */
export const RESPONSE_TIME = {
  /** The bound itself, for anywhere that needs the number rather than a phrase. */
  hours: 24,
  /** Used inside sentences: "we reply {within}". */
  within: 'within 24 hours',
  short: '24-hour reply',
  sentence: 'We reply to every message within 24 hours.',
} as const
