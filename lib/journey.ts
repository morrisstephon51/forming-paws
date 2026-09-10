import type { MarkStatus } from '@/components/record/Mark'

/**
 * The shared spine of the product story.
 *
 * These arrays are read by the landing page and by /about, which describe the
 * same product at different depths. Kept in one place for the reason
 * lib/promise.ts exists: four hard-coded copies eventually disagree, and the
 * one a member reads is always the stale one. This repo has already had that
 * happen with the reply-time promise.
 *
 * Both consumers read the same objects and use different fields — the landing
 * page shows `tag`, /about additionally renders `mark`. Adding a roadmap item
 * therefore cannot land on one page and not the other.
 */

export const STEPS = [
  {
    n: 1,
    title: 'Create a profile',
    body: "Add your dog's breed, age, temperament, and photos. Owners verify their identity; dogs get their own profile page.",
  },
  {
    n: 2,
    title: 'Upload health records',
    body: 'Vet wellness exams, vaccinations, and breed-specific screenings go into a private health vault. Our team reviews and verifies them.',
  },
  {
    n: 3,
    title: 'Match nearby',
    body: "Filter by breed, sex, age, and distance. Express interest, and when it's mutual, chat unlocks so owners can talk first.",
  },
  {
    n: 4,
    title: 'Meet safely',
    body: 'We suggest neutral meeting locations and a record-exchange checklist, so both owners meet prepared and confident.',
  },
] as const

/**
 * What a file contains, told through the marks themselves.
 *
 * Deliberately not a specimen dog. Inventing "Juno, 4yr, Logan Square" with a
 * verified mark to demonstrate the component would be a fabricated record on
 * the one site that cannot afford one — the same failure category as the
 * "expert-reviewed guides" claim already stripped from the landing page.
 * Naming the fields and showing the three states teaches the vocabulary
 * without asserting anything false about an animal that does not exist.
 */
export const FILE_FIELDS: {
  status: MarkStatus
  label: string
  value: string
  note: string
}[] = [
  {
    status: 'verified',
    label: 'Vaccination record',
    value: 'Reviewed',
    note: 'Core vaccinations, read by a person against the dates on the document itself.',
  },
  {
    status: 'verified',
    label: 'Wellness exam',
    value: 'Reviewed',
    note: 'A general veterinary exam. We check that it is recent, not just that a file was uploaded.',
  },
  {
    status: 'verified',
    label: 'Breed screening',
    value: 'Reviewed',
    note: 'Hips, eyes or heart, depending on the dog. What is appropriate for a mixed breed is not what is appropriate for a retriever.',
  },
  {
    status: 'pending',
    label: 'In review',
    value: '',
    note: 'What you see while we read it. Uploaded and queued, and matching stays locked until a person has actually looked.',
  },
  {
    status: 'none',
    label: 'Not yet',
    value: '',
    note: 'What you see when a document is missing. The gap is shown rather than hidden, because a blank space you cannot see is indistinguishable from a document nobody ever uploaded.',
  },
]

export const MEETING = [
  'Meet in a neutral, public place. Neither home, the first time.',
  'Bring the paperwork you uploaded, on paper. Both owners exchange the same set.',
  'Chat is locked until interest is mutual, so nobody is messaged out of the blue.',
  'Either owner can report a conversation, and a real person reads the report.',
] as const

/**
 * The roadmap.
 *
 * `mark` maps each item onto the same three-state axis the rest of the site
 * uses — confirmed, underway, absent — and `markLabel` gives the screen-reader
 * name appropriate to a roadmap rather than to a health document. "Vision" is
 * an absence and is marked as one; softening it to `pending` would be exactly
 * the aspirational claim this page has had stripped out of it twice.
 */
export const ROADMAP: {
  tag: string
  mark: MarkStatus
  markLabel: string
  title: string
  body: string
}[] = [
  {
    tag: 'Now',
    mark: 'verified',
    markLabel: 'Live',
    title: 'Matching platform',
    body: 'Profiles, health verification, local matching, and owner chat: the foundation you are looking at today.',
  },
  {
    // "Vet partner network" implied an existing directory of clinics before one
    // existed. The honest version of Now is a real, nameable referral standing
    // in for the network until we have actually recruited and vetted one.
    tag: 'Now',
    mark: 'verified',
    markLabel: 'Live',
    title: 'PAWS Chicago referral',
    body: "Dogs that don't pass health review are pointed to PAWS Chicago's low-cost veterinary clinic today, while we build a dedicated partner network.",
  },
  {
    // "Expert-reviewed" was aspirational and is now checkable: /education is
    // live and no veterinarian has reviewed it. The claim moves to what is
    // actually true, and the page says so itself.
    tag: 'Started',
    mark: 'pending',
    markLabel: 'In progress',
    title: 'Education hub',
    body: 'Practical guides on documentation, questions for your vet, and meeting safely. Live now, and growing as the vet network does.',
  },
  {
    // Scoped deliberately, not a full storefront: live-animal sales are a
    // restricted category for most payment processors, and Illinois PA
    // 102-0227 constrains retail pet sales. Listings with in-app inquiries
    // only, no checkout.
    tag: 'Started',
    mark: 'pending',
    markLabel: 'In progress',
    title: 'Puppy marketplace',
    body: 'Verified litters, listed and browsable at /marketplace. Inquiries happen in-app; no payment moves through Forming Paws.',
  },
  {
    tag: 'Vision',
    mark: 'none',
    markLabel: 'Not built',
    title: 'Safe breeding facility',
    body: 'A physical safe space for supervised mating, breeding, and whelping, run by the nonprofit.',
  },
]
