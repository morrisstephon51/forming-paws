import Link from 'next/link'
import SiteFooter from '@/components/SiteFooter'
import ShareButtons from '@/components/ShareButtons'
import { pageMetadata } from '@/lib/seo'
import { CONTACT_EMAIL, SITE_NAME, SITE_URL } from '@/lib/site'

export const metadata = pageMetadata({
  title: 'Support us',
  description:
    'Forming Paws cannot accept donations yet. Here is exactly why, and the things that genuinely help in the meantime.',
  path: '/donate',
})

const WAYS_TO_HELP = [
  {
    icon: '🐕',
    title: 'List your dog and get verified',
    body: 'The single most valuable thing. A health-first platform is worthless until enough verified dogs are on it that a good match is findable.',
    href: '/signup',
    cta: 'Join free',
  },
  {
    icon: '📣',
    title: 'Tell one dog owner',
    body: 'Not a hundred. One owner in Chicago who would otherwise use a classifieds site is worth more than a broad share to people who do not own dogs.',
    href: '/about',
    cta: 'What to tell them',
  },
  {
    icon: '🩺',
    title: 'Introduce us to a vet',
    body: 'The referral network is the biggest thing we cannot build alone. If you know a Chicago-area practice, an introduction is worth more than money right now.',
    href: '/vets',
    cta: 'What we need',
  },
  {
    icon: '🔎',
    title: 'Tell us where it breaks',
    body: 'Bugs, confusing wording, a step that made you give up. We would rather hear it than not, and a real person reads every message.',
    href: '/contact',
    cta: 'Send feedback',
  },
]

export default function DonatePage() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-4">

      <main className="mt-8">
        <h1 className="fp-h1">
          <span aria-hidden="true">❤️</span> Support {SITE_NAME}
        </h1>

        {/*
          No donate button, deliberately.
          Soliciting donations while implying tax-deductible status you do not
          hold is a real legal problem, not a technicality — and taking money
          with no processor and no fiscal sponsor in place would mean holding
          funds we cannot properly account for. The page says so instead.
        */}
        <div className="fp-card mt-6 border-l-4 border-l-accent">
          <p className="font-semibold text-ink">We are not accepting donations yet.</p>
          <p className="mt-2 text-sm text-ink-soft">
            {SITE_NAME} is being built as a nonprofit but is <strong>not an IRS-approved
            501(c)(3)</strong>. Until that comes through or a fiscal sponsor is in place, we cannot
            offer tax-deductible receipts — and we would rather have no donate button than one that
            implies otherwise.
          </p>
          <p className="mt-2 text-sm text-ink-soft">
            When that changes, this page becomes the place it happens.
          </p>
        </div>

        <section aria-labelledby="instead" className="mt-12">
          <h2 id="instead" className="fp-h2">
            What actually helps right now
          </h2>
          <p className="mt-2 text-ink-soft">
            All of these are worth more to the project today than a small donation would be.
          </p>
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            {WAYS_TO_HELP.map((way) => (
              <div key={way.title} className="fp-card flex flex-col">
                <span aria-hidden="true" className="text-2xl">
                  {way.icon}
                </span>
                <h3 className="mt-3 text-ink fp-h5">{way.title}</h3>
                <p className="mt-2 flex-1 text-sm text-ink-soft">{way.body}</p>
                <Link href={way.href} className="fp-btn-ghost mt-4 self-start px-4 py-2 text-sm">
                  {way.cta}
                </Link>
              </div>
            ))}
          </div>
        </section>

        <section aria-labelledby="funding" className="mt-12">
          <h2 id="funding" className="fp-h2">
            How this is funded
          </h2>
          <div className="mt-4 flex flex-col gap-4 text-ink-soft">
            <p>
              On nothing, so far. There is no outside capital, no paid staff, and no revenue. The
              hosting and the database run on free tiers.
            </p>
            <p>
              The long-term plan involves grants, a verified-badge fee, and eventually vet-referral
              partnerships — but none of that is in place today, and we are not going to describe
              plans as though they were income.
            </p>
          </div>
        </section>

        <section aria-labelledby="org" className="fp-band mt-12">
          <h2 id="org" className="fp-h2">
            Funder, grantmaker, or sponsor?
          </h2>
          <p className="mt-2 text-ink-soft">
            If you work with early-stage nonprofits — particularly on fiscal sponsorship — that
            conversation would unblock the rest of this page. Email us directly.
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <a href={`mailto:${CONTACT_EMAIL}`} className="fp-btn">
              {CONTACT_EMAIL}
            </a>
            <Link href="/about" className="fp-btn-ghost">
              Read about the mission
            </Link>
          </div>
          <div className="mt-6">
            <ShareButtons
              url={`${SITE_URL}/about`}
              title="Forming Paws — health-verified breeding matches for dog owners"
            />
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  )
}
