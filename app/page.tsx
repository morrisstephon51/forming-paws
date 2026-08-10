import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import LoginForm from './(auth)/login/LoginForm'
import WaitlistForm from './WaitlistForm'
import { safeEmailParam } from '@/lib/auth/prefill'

/**
 * theplugai.xyz — the public front door and the app's landing in one page.
 *
 * This replaces the GitHub Pages index.html. Everything that page carried is
 * here (hero, how it works, health-first, roadmap, waitlist) so moving the
 * domain to Vercel loses nothing, plus the sign-in panel so a returning member
 * never has to hunt for a second page.
 *
 * Credentials are handled by LoginForm and nowhere else.
 */

const STEPS = [
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
    body: "Filter by breed, sex, age, and distance. Express interest — when it's mutual, chat unlocks so owners can talk first.",
  },
  {
    n: 4,
    title: 'Meet safely',
    body: 'We suggest neutral meeting locations and a record-exchange checklist, so both owners meet prepared and confident.',
  },
]

const HEALTH = [
  {
    icon: '🩺',
    title: 'Verified health vault',
    body: 'Matching stays locked until baseline vet documentation is reviewed. A green verified badge means real, checked records — not an honour system.',
  },
  {
    icon: '❤️‍🩹',
    title: 'A path to healthy',
    body: "Dogs whose records don't pass aren't rejected — they're referred to partner veterinarians with a plan to bring their health up to standard.",
  },
  {
    icon: '🚫',
    title: 'Built against puppy mills',
    body: 'Litter caps per profile, mandatory documentation, and community reporting keep high-volume breeders off the platform.',
  },
]

const ROADMAP = [
  {
    tag: 'Now',
    title: 'Matching platform',
    body: 'Profiles, health verification, local matching, and owner chat — the foundation you are looking at today.',
  },
  {
    tag: 'Next',
    title: 'Vet partner network',
    body: 'Referral pathways so under-documented dogs get affordable care and re-enter matching healthy.',
  },
  {
    tag: 'Later',
    title: 'Education hub',
    body: 'Expert-reviewed guides on responsible breeding, whelping, and puppy health for every owner.',
  },
  {
    tag: 'Vision',
    title: 'Safe breeding facility',
    body: 'A physical safe space for supervised mating, breeding, and whelping — run by the nonprofit.',
  },
]

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; resend?: string; email?: string }>
}) {
  const params = await searchParams
  const supabase = await createClient()
  const { data } = await supabase.auth.getUser()
  const signedIn = Boolean(data.user)

  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <span className="text-lg font-bold">🐾 Forming Paws</span>
        <nav className="flex items-center gap-4 text-sm">
          <a href="#how" className="text-gray-600 hover:underline">
            How It Works
          </a>
          <a href="#health" className="text-gray-600 hover:underline">
            Health First
          </a>
          {signedIn ? (
            <Link href="/dashboard" className="rounded bg-gray-900 px-3 py-1.5 text-white">
              Dashboard
            </Link>
          ) : (
            <Link href="/signup" className="rounded bg-gray-900 px-3 py-1.5 text-white">
              Join Now
            </Link>
          )}
        </nav>
      </header>

      <div className="mt-12 grid gap-10 md:grid-cols-5 md:items-start">
        <section className="md:col-span-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
            Nonprofit · Community-driven · Health-verified
          </p>
          <h1 className="mt-3 text-4xl font-bold leading-tight sm:text-5xl">
            Healthy matches.
            <br />
            Happy litters.
          </h1>
          <p className="mt-4 text-gray-600">
            Forming Paws connects dog owners nearby for safe, health-documented breeding matches —
            thoughtful matchmaking for dogs, with veterinary verification at the centre of
            everything.
          </p>
          <dl className="mt-6 grid gap-4 sm:grid-cols-3">
            <div>
              <dt className="font-semibold">Health-gated</dt>
              <dd className="text-sm text-gray-600">
                matching unlocks only after vet docs are verified
              </dd>
            </div>
            <div>
              <dt className="font-semibold">Local-first</dt>
              <dd className="text-sm text-gray-600">
                find partners by distance, never exact addresses
              </dd>
            </div>
            <div>
              <dt className="font-semibold">Owner-safe</dt>
              <dd className="text-sm text-gray-600">
                in-app chat, neutral meetup guidance, report tools
              </dd>
            </div>
          </dl>
        </section>

        <section id="signin" className="rounded-lg border p-6 md:col-span-2">
          {signedIn ? (
            <>
              <h2 className="text-xl font-bold">You&apos;re signed in</h2>
              <p className="mt-2 text-sm text-gray-600">
                Pick up where you left off with your dogs and matches.
              </p>
              <Link
                href="/dashboard"
                className="mt-6 block rounded bg-gray-900 p-2 text-center text-white"
              >
                Go to your dashboard
              </Link>
            </>
          ) : (
            <>
              <h2 className="text-xl font-bold">Member sign in</h2>
              <LoginForm
                error={params.error ?? null}
                offerResend={params.resend === '1'}
                initialEmail={safeEmailParam(params.email)}
              />
              <p className="mt-6 border-t pt-6 text-sm text-gray-600">
                New here?{' '}
                <Link href="/signup" className="underline">
                  Create your account and dog profile
                </Link>
              </p>
            </>
          )}
        </section>
      </div>

      <section id="how" className="mt-20 scroll-mt-8">
        <h2 className="text-2xl font-bold">How Forming Paws works</h2>
        <p className="mt-2 text-gray-600">
          Four steps from profile to a safe, well-documented match.
        </p>
        <ol className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((step) => (
            <li key={step.n} className="rounded-lg border p-5">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-900 font-bold text-white">
                {step.n}
              </span>
              <h3 className="mt-3 font-semibold">{step.title}</h3>
              <p className="mt-2 text-sm text-gray-600">{step.body}</p>
            </li>
          ))}
        </ol>
      </section>

      <section id="health" className="mt-20 scroll-mt-8">
        <h2 className="text-2xl font-bold">Health first — it&apos;s the whole point</h2>
        <p className="mt-2 text-gray-600">
          Forming Paws exists to raise the standard of dog breeding, not just to make introductions.
        </p>
        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          {HEALTH.map((card) => (
            <div key={card.title} className="rounded-lg border p-5">
              <span className="text-2xl" aria-hidden="true">
                {card.icon}
              </span>
              <h3 className="mt-3 font-semibold">{card.title}</h3>
              <p className="mt-2 text-sm text-gray-600">{card.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="roadmap" className="mt-20 scroll-mt-8">
        <h2 className="text-2xl font-bold">Where we&apos;re headed</h2>
        <p className="mt-2 text-gray-600">A nonprofit that grows with its community.</p>
        <ol className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {ROADMAP.map((item) => (
            <li key={item.tag} className="rounded-lg border p-5">
              <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                {item.tag}
              </span>
              <h3 className="mt-2 font-semibold">{item.title}</h3>
              <p className="mt-2 text-sm text-gray-600">{item.body}</p>
            </li>
          ))}
        </ol>
      </section>

      {!signedIn && (
        <section id="waitlist" className="mt-20 scroll-mt-8 rounded-lg border bg-gray-50 p-8">
          <h2 className="text-2xl font-bold">Be a Founding Member</h2>
          <p className="mt-2 text-gray-600">
            Join the waitlist — the first 20 owners in our launch city get health verification{' '}
            <strong>free for life</strong>.
          </p>
          <WaitlistForm />
          <p className="mt-4 text-sm text-gray-600">
            Ready now?{' '}
            <Link href="/signup" className="font-semibold underline">
              Create your account &amp; dog profile
            </Link>{' '}
            · or{' '}
            <a href="/app.html" className="underline">
              try the sample view
            </a>{' '}
            first.
          </p>
        </section>
      )}

      <footer className="mt-20 border-t py-8 text-sm text-gray-600">
        <p>
          🐾 <strong>Forming Paws</strong> — a nonprofit initiative for healthy, responsible dog
          breeding.
        </p>
        <p className="mt-2">
          Forming Paws is not a party to any breeding arrangement. Always consult your veterinarian.
        </p>
      </footer>
    </div>
  )
}
