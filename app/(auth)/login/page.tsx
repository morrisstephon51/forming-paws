import Link from 'next/link'
import LoginForm from './LoginForm'
import SiteFooter from '@/components/SiteFooter'
import AuthScene from '@/components/auth/AuthScene'
import AuthShowcase from '@/components/auth/AuthShowcase'
import { safeEmailParam } from '@/lib/auth/prefill'
import { pageMetadata } from '@/lib/seo'
import { WHAT_WE_DO } from '@/lib/positioning'

export const metadata = pageMetadata({
  title: 'Log in',
  description:
    'Sign in to Forming Paws to manage your dogs, browse matches and message other owners.',
  path: '/login',
})

/**
 * Every gated route in the app redirects here, so this is one of the most
 * visited pages on the site, and it is also where a first-time visitor who
 * followed a shared link lands. It therefore has two jobs that pull in
 * opposite directions: let a returning member in immediately, and tell a
 * stranger what this place is.
 *
 * The resolution is the band order, and it is the whole design:
 *
 *   Band 1 — the form, in the first viewport, with the 3D scene behind it and
 *            the one-sentence answer beside it. Nothing to scroll past, no
 *            animation standing between a member and their password.
 *   Band 2 — the three mechanics, in 3D, for the stranger. Entirely optional.
 *   Band 3 — what the account actually holds, for the member who wondered.
 *
 * THE FORM IS NEVER HIDDEN BY SCRIPT. No scrollcraft reveal attribute goes on
 * this page, deliberately: scrollcraft.css hides [data-sc-in] unconditionally,
 * its engine mounts once per page load with no re-scan, and the `sc-js` gate
 * only runs on a full load. A visitor who lands on the homepage (engine mounts,
 * gate stays on) and then clicks "Log in" — a client-side Link — would arrive
 * at a page whose revealed elements were never bound and never will be. On a
 * marketing section that is a bug. On the login form it is an outage.
 *
 * All 3D here degrades to a flat, fully visible page: Tilt3D and DepthField
 * write transforms to custom properties that default to the settled pose, and
 * the WebGL meadow fades in over markup that is already correct.
 */
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; resend?: string; email?: string }>
}) {
  const params = await searchParams

  return (
    <>
      <main>
        {/* ---- Band 1: the form, and the answer ---- */}
        <section className="relative isolate overflow-hidden">
          <AuthScene />

          <div className="fp-shell relative py-12 sm:py-16 lg:py-20">
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

              {/*
                The answer to "what is this", on the page most likely to be
                somebody's first. One of the three places lib/positioning is
                rendered by rule rather than by whoever remembered.
              */}
              {/*
                The plate is applied by rule, not where a ratio complained.

                On a phone this column stacks BELOW the form, which puts it over
                the foreground ridge: ink-soft on #245448 is unreadable, and it
                was. The lesson this project already paid for is that a remedy
                applied to one of four copy blocks is a coincidence, not a
                remedy, so the plate is unconditional. Ivory at 95% over the
                darkest point in the scene composites to #F0EFE8, which carries
                ink-soft at 5.24:1; over the palest point it is invisible, so
                desktop looks exactly as it did.

                95 and not 92: this project's Tailwind only emits the default
                opacity steps, and bg-ivory/92 silently computed to
                rgba(0,0,0,0) -- a plate with radius and padding and no surface
                at all, which looks fine in the markup and fixes nothing. Always
                read the computed backgroundColor back, never the class name.
              */}
              <aside className="rounded-xl bg-ivory/95 p-5 lg:col-span-2 lg:mt-4">
                <p className="fp-eyebrow text-brand-dark">What this is</p>
                <p className="fp-lead mt-3 text-base">{WHAT_WE_DO}</p>
              </aside>
            </div>
          </div>
        </section>

        {/* ---- Band 2: what we do, in three dimensions ---- */}
        <section className="fp-shell py-16 sm:py-20">
          <h2 className="fp-h3 max-w-2xl">How it works, in three steps</h2>
          <AuthShowcase className="mt-8 sm:grid-cols-3" />
        </section>

        {/* ---- Band 3: the returning member's reassurance ---- */}
        <section className="fp-shell pb-20">
          <h2 className="fp-h4">What your account holds</h2>
          {/*
            .fp-depth, so the site-wide DepthField driver gives these three the
            same scroll-settle as everything else. No per-card component and no
            second motion system.
          */}
          <dl className="fp-depth mt-6 grid gap-5 sm:grid-cols-3">
            <div className="fp-card">
              <dt className="font-semibold">Your dogs</dt>
              <dd className="mt-1 text-sm text-ink-soft">
                Profiles, photos and the health documents you have uploaded.
              </dd>
            </div>
            <div className="fp-card">
              <dt className="font-semibold">Your matches</dt>
              <dd className="mt-1 text-sm text-ink-soft">
                Mutual interest only. Chat unlocks when both owners agree.
              </dd>
            </div>
            <div className="fp-card">
              <dt className="font-semibold">Your health vault</dt>
              <dd className="mt-1 text-sm text-ink-soft">
                Private by default. Other members see the verification badge, never
                the paperwork.
              </dd>
            </div>
          </dl>
        </section>
      </main>
      <SiteFooter />
    </>
  )
}
