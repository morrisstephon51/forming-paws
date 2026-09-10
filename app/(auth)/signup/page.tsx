import Link from 'next/link'
import SignupForm from './SignupForm'
import SiteFooter from '@/components/SiteFooter'
import { pageMetadata } from '@/lib/seo'

export const metadata = pageMetadata({
  title: 'Create your account',
  description:
    'Join Forming Paws free. Create a profile for your dog, upload vet records for verification, and find health-documented breeding matches near you.',
  path: '/signup',
})

/**
 * The conversion page. It previously rendered a bare `max-w-sm` column with no
 * footer, no way back to login, and nothing answering "what am I signing up
 * for" at the moment the visitor is deciding.
 *
 * The three steps on the right are the same three the homepage promises, in the
 * same order, so the page reads as the continuation of that pitch rather than
 * as a form that appeared.
 */
const STEPS = [
  {
    n: 1,
    title: 'Create your profile',
    body: "Your dog's breed, age, temperament and photos. A few minutes.",
  },
  {
    n: 2,
    title: 'Upload vet records',
    body: 'Wellness exams, vaccinations and screenings go into a private vault. Our team verifies them.',
  },
  {
    n: 3,
    title: 'Match nearby',
    body: 'Browse by distance. Chat unlocks only when interest is mutual.',
  },
]

export default function SignupPage() {
  return (
    <>
      <main className="fp-shell py-12 sm:py-16">
        <div className="mx-auto grid max-w-4xl gap-10 lg:grid-cols-5 lg:items-start lg:gap-14">
          <section className="fp-card lg:col-span-3">
            <SignupForm />

            <p className="fp-hairline mt-7 pt-6 text-sm text-ink-soft">
              Already have an account?{' '}
              <Link href="/login" className="fp-link font-semibold">
                Log in
              </Link>
            </p>
          </section>

          <aside className="lg:col-span-2">
            <h2 className="fp-h4">What happens next</h2>
            <ol className="mt-5 grid gap-5">
              {STEPS.map((s) => (
                <li key={s.n} className="flex gap-3">
                  <span
                    className="fp-badge mt-0.5 h-6 w-6 shrink-0 justify-center"
                    aria-hidden="true"
                  >
                    {s.n}
                  </span>
                  <span>
                    <span className="block font-semibold">{s.title}</span>
                    <span className="mt-1 block text-sm text-ink-soft">{s.body}</span>
                  </span>
                </li>
              ))}
            </ol>
            <p className="mt-6 text-sm text-ink-soft">
              Free to join. We never sell your data, and your veterinary
              documents stay private to you and our reviewers.
            </p>
          </aside>
        </div>
      </main>
      <SiteFooter />
    </>
  )
}
