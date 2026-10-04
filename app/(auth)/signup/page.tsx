import Link from 'next/link'
import SignupForm from './SignupForm'
import SiteFooter from '@/components/SiteFooter'
import AuthScene from '@/components/auth/AuthScene'
import AuthShowcase from '@/components/auth/AuthShowcase'
import { pageMetadata } from '@/lib/seo'
import { WHAT_WE_DO } from '@/lib/positioning'

export const metadata = pageMetadata({
  title: 'Create your account',
  description:
    'Join Forming Paws free. Create a profile for your dog, upload vet records for verification, and find health-documented breeding matches near you.',
  path: '/signup',
})

/**
 * The conversion page, on the same three-band structure as /login so the two
 * pages a visitor bounces between read as one surface.
 *
 *   Band 1 — the form, first viewport, 3D scene behind it, and the sentence
 *            beside it. A stranger deciding whether to hand over vet paperwork
 *            gets told what this is before being asked for anything.
 *   Band 2 — the three mechanics, numbered here, because on this page they are
 *            literally the next three things that will happen.
 *   Band 3 — the privacy promise, which is the actual objection at this moment.
 *
 * The local three-step array this page used to carry is gone. It said nearly
 * the same thing as lib/journey's STEPS and as the /login panels, in slightly
 * different words — three hard-coded copies of one claim, which is how this
 * repo ended up with a stale reply-time promise in four places. One component,
 * read by both auth pages.
 *
 * As on /login, nothing here is hidden by script: no scrollcraft reveal
 * attributes, and every 3D transform defaults to its settled pose.
 */
export default function SignupPage() {
  return (
    <>
      <main>
        {/* ---- Band 1: the form, and the answer ---- */}
        <section className="relative isolate overflow-hidden">
          <AuthScene />

          <div className="fp-shell relative py-12 sm:py-16 lg:py-20">
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

        {/* ---- Band 2: the next three things that happen ---- */}
        <section className="fp-shell py-16 sm:py-20">
          <h2 className="fp-h3 max-w-2xl">What happens next</h2>
          <AuthShowcase numbered className="mt-8 sm:grid-cols-3" />
        </section>

        {/* ---- Band 3: the objection at this exact moment ---- */}
        <section className="fp-shell pb-20">
          <div className="fp-card max-w-2xl">
            <h2 className="fp-h4">Before you upload anything</h2>
            <p className="mt-3 text-sm text-ink-soft">
              Free to join. We never sell your data, and your veterinary documents
              stay private to you and our reviewers. Other members see only
              whether a dog&rsquo;s records passed review, never the records.
            </p>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  )
}
