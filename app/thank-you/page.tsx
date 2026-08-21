import Link from 'next/link'
import Breadcrumbs from '@/components/Breadcrumbs'
import Sage from '@/components/mascot/Sage'
import ShareButtons from '@/components/ShareButtons'
import SiteFooter from '@/components/SiteFooter'
import ResendConfirmation from './ResendConfirmation'
import { safeEmailParam } from '@/lib/auth/prefill'
import { RESPONSE_TIME } from '@/lib/promise'
import { absoluteUrl, pageMetadata } from '@/lib/seo'

export const metadata = pageMetadata({
  title: 'Thank you',
  description: 'We received that. Here is what happens next.',
  path: '/thank-you',
  // A confirmation page has nothing to offer a searcher, and indexing it would
  // put "thank you" in results for people who have not done the thing yet.
  index: false,
})

/**
 * One page for every "we got that" moment: the waitlist, a new account, and the
 * contact form. Each arrives with `?from=` and gets its own wording and its own
 * next step, because "thanks!" with no onward path is where momentum dies.
 */
const VARIANTS = {
  waitlist: {
    heading: "You're on the list",
    body: "We'll email you the moment Forming Paws opens in your area. Founding members — the first 20 owners in our launch city — get health verification free for life.",
    next: [
      { href: '/signup', label: 'Create your account now', primary: true },
      { href: '/app', label: 'See what the app looks like' },
    ],
    note: "You don't have to wait for launch to set up your dog's profile.",
  },
  signup: {
    heading: 'Check your email',
    body: "We've sent you a confirmation link. Open it and your account is ready — it works once, and expires after an hour.",
    next: [
      { href: '/faq', label: 'Read the FAQ while you wait' },
      { href: '/', label: 'Back to the home page' },
    ],
    note: 'Open the link on this device if you can. If your email app opens it in its own browser, it still works — it just has one more step.',
  },
  contact: {
    heading: 'Message received',
    body: `${RESPONSE_TIME.sentence} It goes to the team behind Forming Paws, not a queue, and you'll get a real reply from a person.`,
    next: [
      { href: '/faq', label: 'Read the FAQ' },
      { href: '/signup', label: 'Create your account', primary: true },
    ],
    note: 'If it turns out to be urgent, reply to our email and it comes straight back to us.',
  },
} as const

type Variant = keyof typeof VARIANTS

function isVariant(value: string | undefined): value is Variant {
  return value === 'waitlist' || value === 'signup' || value === 'contact'
}

export default async function ThankYouPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; email?: string }>
}) {
  const params = await searchParams
  const variant = isVariant(params.from) ? params.from : 'contact'
  const copy = VARIANTS[variant]
  const email = safeEmailParam(params.email)

  return (
    <div className="mx-auto max-w-2xl px-6 py-10">
      <Breadcrumbs trail={[{ label: 'Thank you' }]} />

      <main>

      <Sage mood="celebrating" size={104} className="mt-6" />
      <h1 className="mt-5 fp-h1">{copy.heading}</h1>
      <p className="mt-4 text-ink-soft">
        {variant === 'signup' && email ? (
          <>
            We&apos;ve sent a confirmation link to <span className="font-medium">{email}</span>. Open
            it and your account is ready — it works once, and expires after an hour.
          </>
        ) : (
          copy.body
        )}
      </p>

      {variant === 'signup' && email && <ResendConfirmation email={email} />}

      <div className="mt-8 flex flex-wrap gap-3">
        {copy.next.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className={
              'primary' in link && link.primary
                ? 'rounded bg-brand px-5 py-2 font-semibold text-white'
                : 'rounded border px-5 py-2 font-semibold'
            }
          >
            {link.label}
          </Link>
        ))}
      </div>

      <p className="mt-6 text-sm text-ink-soft">{copy.note}</p>

      {variant !== 'signup' && (
        <div className="mt-10 border-t pt-6">
          <p className="mb-3 text-sm text-ink-soft">
            Know another owner who cares about doing this properly?
          </p>
          <ShareButtons
            url={absoluteUrl('/')}
            title="Forming Paws — health-verified breeding matches for dog owners"
          />
        </div>
      )}

      </main>

      <SiteFooter />
    </div>
  )
}
