/**
 * What the member should do next, as one prompt.
 *
 * A dashboard that shows five equally-weighted panels tells a new member
 * nothing about where to start. This picks exactly one thing, and the order is
 * the point: a dog with no verified records cannot match, so chasing that beats
 * suggesting they browse dogs they are not yet eligible to meet.
 *
 * Pure, and separate from the page, so every branch is testable without a
 * database or a Server Component.
 */

export type HomeSummary = {
  dogCount: number
  /**
   * Dogs with no verified baseline health documents yet. Carries the id, not
   * just the name, because the prompt has to link at the dog's own page — the
   * upload form lives there (app/dogs/[id]/page.tsx), not on this one.
   */
  unverifiedDogs: { id: string; name: string }[]
  hasLocation: boolean
  unreadCount: number
}

export type NextAction =
  | { kind: 'add-dog'; href: string; label: string; body: string }
  | { kind: 'verify-dog'; href: string; label: string; body: string; dogName: string }
  | { kind: 'set-location'; href: string; label: string; body: string }
  | { kind: 'read-messages'; href: string; label: string; body: string; count: number }
  | { kind: 'browse'; href: string; label: string; body: string }

export function nextAction(summary: HomeSummary): NextAction {
  if (summary.dogCount === 0) {
    return {
      kind: 'add-dog',
      href: '/dogs/new',
      label: 'Add your dog',
      body: 'Your dog needs a profile before anything else can happen.',
    }
  }

  // Ahead of unread messages on purpose: an unverified dog cannot match, so
  // clearing verification unblocks the whole product. Messages keep.
  const [unverified] = summary.unverifiedDogs
  if (unverified) {
    return {
      kind: 'verify-dog',
      href: `/dogs/${unverified.id}`,
      label: `Upload health records for ${unverified.name}`,
      body: 'Matching stays locked until a vet exam and vaccinations are verified.',
      dogName: unverified.name,
    }
  }

  if (summary.unreadCount > 0) {
    return {
      kind: 'read-messages',
      href: '/matches',
      label: summary.unreadCount === 1 ? 'Read your message' : 'Read your messages',
      body: 'An owner is waiting to hear back from you.',
      count: summary.unreadCount,
    }
  }

  if (!summary.hasLocation) {
    return {
      kind: 'set-location',
      href: '/browse',
      label: 'Set your location',
      body: 'Without it we cannot show you how far away a match is.',
    }
  }

  return {
    kind: 'browse',
    href: '/browse',
    label: 'Browse dogs near you',
    body: 'Your dog is verified and ready to match.',
  }
}
