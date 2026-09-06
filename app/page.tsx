import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { MEMBER_HOME } from '@/lib/nav'
import LoginForm from './(auth)/login/LoginForm'
import WaitlistForm from './WaitlistForm'
import { safeEmailParam } from '@/lib/auth/prefill'
import { SITE_URL } from '@/lib/site'
import { FAQS } from '@/lib/faq'
import { RESPONSE_TIME } from '@/lib/promise'
import ShareButtons from '@/components/ShareButtons'
import SiteFooter from '@/components/SiteFooter'
import FileHero from '@/components/homepage/FileHero'
import RecordLine from '@/components/record/RecordLine'
import Mark, { type MarkStatus } from '@/components/record/Mark'
import Sage from '@/components/mascot/Sage'

/**
 * theplugai.xyz — the public front door and the app's landing in one page.
 *
 * "The Open File" (2026-09-05). Direction and rationale:
 * docs/superpowers/specs/2026-09-05-the-open-file-design.md
 *
 * The thesis is that every competitor asks to be trusted and this one shows
 * you the file, including what is missing from it — so the page is structured
 * as a record rather than as a pitch, and its status vocabulary is honest in
 * both directions. `NOT YET` is published on purpose.
 *
 * This replaced the scrollcraft worldflight, which occupied the first 4,200px
 * of a 9,834px page, set body copy over illustration, and hid every element
 * behind `[data-sc-in]` until JavaScript ran. There is deliberately no
 * scroll-triggered animation anywhere on this page: everything meant to be
 * read is present and visible in the server HTML at first paint.
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
    body: "Filter by breed, sex, age, and distance. Express interest, and when it's mutual, chat unlocks so owners can talk first.",
  },
  {
    n: 4,
    title: 'Meet safely',
    body: 'We suggest neutral meeting locations and a record-exchange checklist, so both owners meet prepared and confident.',
  },
]

/**
 * What a file contains, told through the marks themselves.
 *
 * Deliberately not a specimen dog. Inventing "Juno, 4yr, Logan Square" with a
 * green verified badge to demonstrate the component would be a fabricated
 * record on the one site that cannot afford one — the same failure category as
 * the "expert-reviewed guides" claim already stripped from this page. Naming
 * the fields and showing the three states teaches the vocabulary without
 * asserting anything false about an animal that does not exist.
 */
const FILE_FIELDS: { status: MarkStatus; label: string; value: string; note: string }[] = [
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

const MEETING = [
  'Meet in a neutral, public place. Neither home, the first time.',
  'Bring the paperwork you uploaded, on paper. Both owners exchange the same set.',
  'Chat is locked until interest is mutual, so nobody is messaged out of the blue.',
  'Either owner can report a conversation, and a real person reads the report.',
]

const HEALTH = [
  {
    title: 'Verified health vault',
    body: 'Matching stays locked until baseline vet documentation is reviewed. A verified mark means real, checked records, not an honour system.',
  },
  {
    title: 'A path to healthy',
    body: "Dogs whose records don't pass aren't rejected. Right now that means a referral to PAWS Chicago's low-cost veterinary clinic; a dedicated partner network is next.",
  },
  {
    title: 'Built against puppy mills',
    body: 'A hard cap of one litter per dog per year, mandatory documentation, and community reporting keep high-volume breeders off the platform.',
  },
]

/**
 * The roadmap, carrying real marks.
 *
 * `mark` maps each item onto the same three-state axis the rest of the site
 * uses — confirmed, underway, absent — and `markLabel` gives the screen-reader
 * name appropriate to a roadmap rather than to a health document. "Vision" is
 * an absence and is marked as one; softening it to `pending` would be exactly
 * the aspirational claim this page has had stripped out of it twice.
 */
const ROADMAP: { tag: string; mark: MarkStatus; markLabel: string; title: string; body: string }[] = [
  {
    tag: 'Now',
    mark: 'verified',
    markLabel: 'Live',
    title: 'Matching platform',
    body: 'Profiles, health verification, local matching, and owner chat: the foundation you are looking at today.',
  },
  {
    tag: 'Now',
    mark: 'verified',
    markLabel: 'Live',
    title: 'PAWS Chicago referral',
    body: "Dogs that don't pass health review are pointed to PAWS Chicago's low-cost veterinary clinic today, while we build a dedicated partner network.",
  },
  {
    tag: 'Started',
    mark: 'pending',
    markLabel: 'In progress',
    title: 'Education hub',
    body: 'Practical guides on documentation, questions for your vet, and meeting safely. Live now, and growing as the vet network does.',
  },
  {
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

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; resend?: string; email?: string }>
}) {
  const params = await searchParams
  const supabase = await createClient()
  const { data } = await supabase.auth.getUser()
  const signedIn = Boolean(data.user)

  // Signed-in members go straight to their own home rather than reading the
  // pitch again. Stefan's call.
  //
  // Deliberately after getUser() and not in middleware: an implicit-flow auth
  // link puts the session in the URL *fragment*, which never reaches the
  // server. Those requests arrive here looking signed-out, render this page,
  // and HashSessionRecovery — mounted in the root layout — claims the session
  // client-side and forwards on. Redirecting earlier would break that path.
  if (signedIn) redirect(MEMBER_HOME)

  return (
    <>
      <main>
        <FileHero />

        {/*
          The ledger strip.

          Four facts, server-rendered as literal text. This replaced two
          scroll-driven counters that shipped `0` in the HTML and only reached
          their real values once the engine animated them — so every crawler and
          every visitor without JavaScript was told there were "0 founding
          spots". Every value here is a constant the site can actually stand
          behind, and the fourth is an absence, stated in the same notation as
          the other three.
        */}
        <section aria-label="At a glance" className="fp-shell mt-12 sm:mt-16">
          <div className="grid gap-x-8 gap-y-4 border-y border-hairline py-5 sm:grid-cols-2 lg:grid-cols-4">
            <RecordLine label="Founding spots" value="20" />
            <RecordLine label="Max reply time" value={`${RESPONSE_TIME.hours}h`} />
            <RecordLine label="Launch city" value="Chicago" />
            <RecordLine status="none" label="Vet-reviewed guides" value="Not yet" />
          </div>
        </section>

        <div className="fp-shell">
          {/* ---------- 04 · What a file contains ---------- */}
          <section id="file" className="mt-16 scroll-mt-24 sm:mt-20">
            <RecordLine label="Section 01" value="The record" className="mb-4" />
            <h2 className="fp-h2">What a file contains</h2>
            <p className="fp-lead mt-3 max-w-[46rem]">
              Three documents, one status each. The same three marks appear on every dog,
              every page and every claim on this site, and they mean the same thing each
              time.
            </p>

            <ul className="fp-ledger mt-8">
              {FILE_FIELDS.map((field) => (
                <li key={field.label} className="fp-row">
                  <RecordLine
                    status={field.status}
                    label={field.label}
                    value={field.value}
                    className="md:flex-nowrap md:whitespace-nowrap md:pt-1"
                  />
                  <p className="text-ink-soft">{field.note}</p>
                </li>
              ))}
            </ul>
          </section>

          {/* ---------- 05 · How review works ---------- */}
          <section id="how" className="mt-16 scroll-mt-24 sm:mt-20">
            <RecordLine label="Section 02" value="The process" className="mb-4" />
            <h2 className="fp-h2">How Forming Paws works</h2>
            <p className="fp-lead mt-3 max-w-[46rem]">
              Four steps from profile to a documented match. Numbered because the order
              matters: nothing unlocks out of sequence.
            </p>

            {/*
              Numbered ruled rows, not a card deck. These genuinely are a
              sequence, which is the only thing that justifies numbering them —
              the roadmap below is not one, and is not numbered.
            */}
            <ol className="mt-8">
              {STEPS.map((step) => (
                <li key={step.n} className="fp-row fp-rail">
                  <span className="fp-meta text-ink">Step {step.n}</span>
                  <div>
                    <h3 className="fp-h4">{step.title}</h3>
                    <p className="mt-2 text-ink-soft">{step.body}</p>
                  </div>
                </li>
              ))}
            </ol>
          </section>

          {/* ---------- 06 · Meeting safely ---------- */}
          <section id="safety" className="mt-16 scroll-mt-24 sm:mt-20">
            <div className="grid gap-10 md:grid-cols-2">
              <div>
                <RecordLine label="Section 03" value="Safety" className="mb-4" />
                <h2 className="fp-h2">Meeting safely</h2>
                <p className="fp-lead mt-3">
                  Health documentation is only half of it. The other half is that two
                  strangers have to meet, and the platform should have an opinion about how.
                </p>
              </div>
              <ul className="rounded-xl bg-wash p-7">
                {MEETING.map((line) => (
                  <li
                    key={line}
                    className="flex gap-3 border-t border-hairline py-3 first:border-t-0 first:pt-0 last:pb-0"
                  >
                    <Mark status="verified" label="" className="mt-[0.45rem]" />
                    <span className="text-ink-soft">{line}</span>
                  </li>
                ))}
              </ul>
            </div>
          </section>

          {/* ---------- Health principles ---------- */}
          <section id="health" className="mt-16 scroll-mt-24 sm:mt-20">
            <RecordLine label="Section 04" value="Principles" className="mb-4" />
            <h2 className="fp-h2">Health first. It&apos;s the whole point</h2>
            <p className="fp-lead mt-3 max-w-[46rem]">
              Forming Paws exists to raise the standard of dog breeding, not just to make
              introductions.
            </p>
            <div className="mt-8 grid gap-0 sm:grid-cols-3 sm:gap-8">
              {HEALTH.map((card) => (
                <div key={card.title} className="fp-row sm:border-t sm:pt-5">
                  <h3 className="fp-h5">{card.title}</h3>
                  <p className="mt-2 text-sm text-ink-soft">{card.body}</p>
                </div>
              ))}
            </div>
          </section>

          {/* ---------- 07 · Where we are ---------- */}
          <section id="roadmap" className="mt-16 scroll-mt-24 sm:mt-20">
            {/*
              The one contained inversion on the page: a moss band with ivory
              visible on all four sides, so the band reads as a surface element
              rather than as a background takeover.

              This sits *above* the join form on purpose. Showing a stranger
              what is not built before asking for their email costs some
              conversions and buys the ones it keeps.
            */}
            <div className="fp-band-deep">
              <RecordLine label="Section 05" value="Status" className="mb-4" />
              <h2 className="fp-h2">Where we&apos;re headed</h2>
              <p className="fp-lead mt-3 max-w-[46rem]">
                A nonprofit that grows with its community. What is live, what is underway,
                and what does not exist yet.
              </p>
              <ul className="mt-8">
                {ROADMAP.map((item) => (
                  // key is title, not tag: two items legitimately share "Now".
                  <li key={item.title} className="fp-row fp-rail border-brand/15">
                    <RecordLine
                      status={item.mark}
                      markLabel={item.markLabel}
                      label={item.tag}
                      className="md:pt-1"
                    />
                    <div>
                      <h3 className="fp-h5">{item.title}</h3>
                      <p className="mt-2 text-sm text-ink-soft">{item.body}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </section>

          {/* ---------- 08 · Sign in ---------- */}
          {/*
            No signed-in branch: a signed-in visitor was redirected to /home
            before this rendered, so anyone reading this panel needs the form.
          */}
          <section id="signin" className="mt-16 scroll-mt-24 sm:mt-20">
            <div className="grid gap-10 md:grid-cols-5 md:items-start">
              <div className="md:col-span-2">
                <RecordLine label="Members" value="Sign in" className="mb-4" />
                <h2 className="fp-h3">Already have an account?</h2>
                <p className="mt-3 text-ink-soft">
                  Straight back to your dogs, your records and your conversations.
                </p>
              </div>
              <div className="rounded-xl bg-wash p-7 md:col-span-3">
                <LoginForm
                  error={params.error ?? null}
                  offerResend={params.resend === '1'}
                  initialEmail={safeEmailParam(params.email)}
                />
                <p className="mt-6 border-t border-hairline pt-6 text-sm text-ink-soft">
                  New here?{' '}
                  <Link href="/signup" className="fp-link">
                    Create your account and dog profile
                  </Link>
                </p>
              </div>
            </div>
          </section>

          {/* ---------- 09 · Join ---------- */}
          {/*
            The one centred block on the page. The symmetry is the signal that
            this is the end of the file and the point at which it asks you for
            something.
          */}
          <section id="waitlist" className="fp-band mt-16 scroll-mt-24 text-center sm:mt-20">
            <div className="mx-auto max-w-xl">
              <h2 className="fp-h2">Be a Founding Member</h2>
              <p className="fp-lead mt-3">
                Join the waitlist. The first 20 owners in our launch city get health
                verification <strong className="text-ink">free for life</strong>.
              </p>
              <div className="mt-7 text-left">
                <WaitlistForm />
              </div>
              <p className="mt-5 text-sm text-ink-soft">
                Ready now?{' '}
                <Link href="/signup" className="fp-link font-semibold">
                  Create your account &amp; dog profile
                </Link>{' '}
                · or{' '}
                <Link href="/app" className="fp-link">
                  see what the app looks like
                </Link>{' '}
                first.
              </p>
            </div>
          </section>

          {/* ---------- 10 · Questions ---------- */}
          <section id="faq" className="mt-16 scroll-mt-24 sm:mt-20">
            <RecordLine label="Section 06" value="Questions" className="mb-4" />
            <h2 className="fp-h2">Questions people ask first</h2>
            <p className="fp-lead mt-3">
              The five that come up most.{' '}
              <Link href="/faq" className="fp-link">
                All of them, on one page
              </Link>
              .
            </p>
            <div className="mt-8">
              {FAQS.map((faq, i) => (
                <details
                  key={faq.question}
                  /* The first two are open so the section is not a wall of
                     closed doors, and so a reader who never clicks still
                     leaves with two answers. */
                  open={i < 2}
                  className="fp-row group"
                >
                  <summary className="cursor-pointer font-semibold marker:text-hairline">
                    {faq.question}
                  </summary>
                  <p className="mt-3 max-w-[52rem] text-sm text-ink-soft">{faq.answer}</p>
                </details>
              ))}
            </div>
          </section>

          {/* ---------- Closing ---------- */}
          <section className="fp-band-deep mt-16 sm:mt-20">
            <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="fp-h3">Still deciding?</h2>
                <p className="mt-2 text-ink-soft">
                  {RESPONSE_TIME.sentence} Ask us anything before you sign up. A real person
                  answers.
                </p>
              </div>
              <Sage mood="celebrating" size={72} />
            </div>
            <div className="mt-5 flex flex-wrap gap-3">
              <Link href="/contact" className="fp-btn">
                Ask a question
              </Link>
              <Link href="/app" className="fp-btn-ghost">
                See the app
              </Link>
            </div>
            <div className="mt-6">
              <ShareButtons
                url={SITE_URL}
                title="Forming Paws: health-verified breeding matches for dog owners"
              />
            </div>
          </section>

          {/* ---------- 11 · The site's own status block ---------- */}
          {/*
            The colophon. Forming Paws applies its own notation to itself, in
            public, above the footer. These are the three things a visitor is
            most likely to assume in our favour if we say nothing — so we say
            something, in the same three marks used everywhere else.
          */}
          <section aria-label="Forming Paws status" className="mt-16 sm:mt-20">
            <RecordLine label="This site" value="Status" className="mb-4" />
            <div className="grid gap-x-8 gap-y-4 border-y border-hairline py-5 sm:grid-cols-3">
              <RecordLine status="none" label="501(c)(3) status" value="Not yet" />
              <RecordLine status="none" label="Partner vets" value="None enrolled" />
              <RecordLine status="none" label="Vet-reviewed guides" value="Not yet" />
            </div>
          </section>
        </div>
      </main>

      <div className="fp-shell">
        <SiteFooter />
      </div>
    </>
  )
}
