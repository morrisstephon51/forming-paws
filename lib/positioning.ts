/**
 * What Forming Paws is, in one sentence.
 *
 * Visitors arriving from a shared link kept asking the same thing -- "what is
 * it that you guys actually do?" -- and the page was the reason. The
 * worldflight opens on a *problem* ("finding the right match shouldn't be
 * guesswork"), and the literal answer did not arrive until two scrolls down,
 * inside the finale eyebrow. Anyone who left before then never got it.
 *
 * The remedy is applied BY RULE, in the three places that cover every entry
 * point: the site header (every page, no scroll required), the hero headline
 * (the first words on the landing page), and a plain band directly under the
 * worldflight (for anyone who scrolls past the cinema). That is the lesson the
 * worldflight copy plates already taught this repo -- a treatment applied to
 * one of four blocks is not a treatment, it is a coincidence.
 *
 * CONTENT-HONESTY. Every claim here has to be true of the running product:
 *   - "free"            -- signup takes no payment and there is no paid tier.
 *   - "health-verified" -- matching stays locked until a human reviews the vet
 *                          documents. The badge reports review, not self-report.
 *   - "near"            -- browse ranks by distance from a coarse location,
 *                          never an exact address.
 * Nothing about vet partners, 501(c)(3) status, or expert-reviewed guides
 * belongs in this file. This repo has stripped fabricated claims twice; /about
 * states plainly what Forming Paws is not. Do not add a third round.
 */

/** The full sentence. The band under the hero renders this verbatim. */
export const WHAT_WE_DO =
  'Forming Paws is a free platform where dog owners find health-verified breeding matches near them.'

/**
 * The same claim at header scale.
 *
 * The full sentence wraps to three lines in the header strip at 390px, which is
 * how a clarifying line becomes clutter. This is the compressed form, and it
 * keeps the two load-bearing words -- health-verified, owner.
 */
export const WHAT_WE_DO_SHORT = 'Health-verified breeding matches, owner to owner'

/**
 * The hero headline. Identity first, not problem first.
 *
 * The old headline was "Finding the right match for your dog shouldn't be
 * guesswork." It is a good line and it still runs -- as the SECOND beat of the
 * flight, where amplifying the problem is the right job. It was the wrong first
 * beat, because a reader who does not yet know what the product is cannot tell
 * whether a problem statement is about dog breeding, pet insurance or a vet
 * directory.
 */
export const HERO_HEADLINE = 'Find a health-verified breeding match for your dog, nearby.'

/**
 * How it actually works, in literal mechanics rather than adjectives.
 *
 * Deliberately NOT a fourth trio of abstractions -- the landing page already
 * carries "Health-gated / Local-first / Owner-safe" in #start, and lib/journey
 * carries the numbered steps. This is the plain-language version that answers
 * "what do you do" for someone who will not read either, and it is shared with
 * the auth pages so the answer a visitor reads on the landing page is the same
 * answer they read on the page that asks them to sign in.
 */
export const WHAT_WE_DO_PLAIN =
  "Upload your dog's vet records once. Our team reviews them. Then you can see health-documented dogs near you, and talk to their owners when the interest is mutual."
