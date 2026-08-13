import { RESPONSE_TIME } from '@/lib/promise'

/**
 * The five questions people actually ask before signing up, in one place so the
 * page and its structured data can never drift apart.
 *
 * Answers are held to what the platform does today. Where something is planned
 * rather than built, the answer says so — a policy page that promises a service
 * that doesn't exist yet is how a nonprofit loses the trust it runs on.
 */
export const FAQS = [
  {
    question: 'Does it cost anything to join?',
    answer:
      'No. Creating an account and listing your dog is free. The first 20 owners in our launch city also get health verification free for life as founding members.',
  },
  {
    question: 'What does "health verified" actually mean?',
    answer:
      'You upload your vet records — wellness exam, vaccinations, and any breed-specific screening — to a private health vault. Our team reads them and verifies them by hand. Until that baseline is verified, matching stays locked. A green badge on a dog means real records that a person checked, not an honour system.',
  },
  {
    question: 'Will other owners see where I live?',
    answer:
      'No. Browsing shows approximate distance only, and your exact location is never shared with another member. Conversations identify dogs by name rather than owners, so your own name stays off the screen until you choose to share it.',
  },
  {
    question: "What happens if my dog's records don't pass?",
    answer:
      "Your dog isn't removed. Matching stays locked until the missing records are in, and we tell you exactly what is missing rather than leaving you guessing. A referral network of partner vets, for owners who need affordable care to close that gap, is the next thing we are building.",
  },
  {
    question: 'How do I reach a real person, and how fast will you reply?',
    answer: `Use the contact form and it goes straight to the team. ${RESPONSE_TIME.sentence} If something on the site is broken or a link doesn't work, that is exactly the kind of message we want.`,
  },
] as const

/** Google's FAQPage markup, generated from the same answers shown on the page. */
export function faqSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: FAQS.map((faq) => ({
      '@type': 'Question',
      name: faq.question,
      acceptedAnswer: { '@type': 'Answer', text: faq.answer },
    })),
  }
}
