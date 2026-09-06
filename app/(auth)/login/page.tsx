import Link from 'next/link'
import LoginForm from './LoginForm'
import SiteFooter from '@/components/SiteFooter'
import { safeEmailParam } from '@/lib/auth/prefill'
import { pageMetadata } from '@/lib/seo'

export const metadata = pageMetadata({
  title: 'Log in',
  description: 'Sign in to Forming Paws to manage your dogs, browse matches and message other owners.',
  path: '/login',
})

/**
 * Every gated route in the app redirects here, so this is one of the most
 * visited pages on the site. It was also the least designed: a bare
 * `max-w-sm p-8` column with the form floating in about 60% empty viewport, no
 * footer, and — the actual defect — no route to signup. Anyone who followed a
 * shared link to a gated page and did not yet have an account arrived at a dead
 * end, because "Join free" in the header was the only way out and it does not
 * read as the answer to "I am being asked to log in".
 *
 * The reassurance column is the same split grammar the homepage hero uses, so
 * the page that catches every redirect looks like it belongs to the same site.
 */
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; resend?: string; email?: string }>
}) {
  const params = await searchParams

  return (
    <>
      <main className="fp-shell py-12 sm:py-16">
        <div className="mx-auto grid max-w-4xl gap-10 lg:grid-cols-5 lg:items-start lg:gap-14">
          <section className="fp-card lg:col-span-3">
            <h1 className="fp-h2">Log in</h1>
            <p className="fp-lead mt-2 text-base">
              Welcome back. Your dogs and conversations are where you left them.
            </p>

            <LoginForm
              error={params.error ?? null}
              offerResend={params.resend === '1'}
              initialEmail={safeEmailParam(params.email)}
            />

            <p className="fp-hairline mt-7 pt-6 text-sm text-ink-soft">
              New here?{' '}
              <Link href="/signup" className="fp-link font-semibold">
                Create your account and dog profile
              </Link>
            </p>
          </section>

          <aside className="lg:col-span-2">
            <h2 className="fp-h4">What your account holds</h2>
            <dl className="mt-5 grid gap-5">
              <div>
                <dt className="font-semibold">Your dogs</dt>
                <dd className="mt-1 text-sm text-ink-soft">
                  Profiles, photos and the health documents you have uploaded.
                </dd>
              </div>
              <div>
                <dt className="font-semibold">Your matches</dt>
                <dd className="mt-1 text-sm text-ink-soft">
                  Mutual interest only. Chat unlocks when both owners agree.
                </dd>
              </div>
              <div>
                <dt className="font-semibold">Your health vault</dt>
                <dd className="mt-1 text-sm text-ink-soft">
                  Private by default. Other members see the verification badge,
                  never the paperwork.
                </dd>
              </div>
            </dl>
          </aside>
        </div>
      </main>
      <SiteFooter />
    </>
  )
}
