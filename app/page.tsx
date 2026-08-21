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
import HeroScene from '@/components/art/HeroScene'
import SectionDivider from '@/components/art/SectionDivider'
import Reveal from '@/components/motion/Reveal'
import StepStack from '@/components/motion/StepStack'
import CountUp from '@/components/motion/CountUp'

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
    // "Expert-reviewed" was aspirational and is now checkable: /education is
    // live and no veterinarian has reviewed it. The claim moves to what is
    // actually true, and the page says so itself.
    tag: 'Started',
    title: 'Education hub',
    body: 'Practical guides on documentation, questions for your vet, and meeting safely — live now, and growing as the vet network does.',
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
    <div className="fp-shell py-8">
      <main>
        {/*
          The hero grid is unchanged; it has just gained a backdrop and the
          padding to sit inside one. HeroScene is absolutely positioned, so the
          columns below still lay out exactly as they did before it existed.
        */}
        <div className="relative mt-12 px-5 pb-24 pt-10 sm:px-9 sm:pb-28 sm:pt-12">
          <HeroScene />
          <div className="relative grid gap-10 md:grid-cols-5 md:items-start">
          <section className="md:col-span-3">
            <p className="fp-eyebrow">
              Nonprofit · Community-driven · Health-verified
            </p>
            <h1 className="mt-3 fp-display">
              Healthy matches.
              <br />
              Happy litters.
            </h1>
            <p className="mt-4 text-ink-soft">
              Forming Paws connects dog owners nearby for safe, health-documented breeding matches —
              thoughtful matchmaking for dogs, with veterinary verification at the centre of
              everything.
            </p>
            {/*
            The primary action, above the fold on a phone. Before this, the only
            way in from the top of the page was the header's "Join Now" chip or
            the sign-in panel — which on mobile sits below the entire hero.
          */}
            <div className="mt-6 flex flex-wrap gap-3">
              <Link href="/signup" className="fp-btn">
                Join free — list your dog
              </Link>
              <Link href="/app" className="fp-btn-ghost">
                See the app first
              </Link>
            </div>
            <dl className="mt-6 grid gap-4 sm:grid-cols-3">
              <div>
                <dt className="font-semibold">Health-gated</dt>
                <dd className="text-sm text-ink-soft">
                  matching unlocks only after vet docs are verified
                </dd>
              </div>
              <div>
                <dt className="font-semibold">Local-first</dt>
                <dd className="text-sm text-ink-soft">
                  find partners by distance, never exact addresses
                </dd>
              </div>
              <div>
                <dt className="font-semibold">Owner-safe</dt>
                <dd className="text-sm text-ink-soft">
                  in-app chat, neutral meetup guidance, report tools
                </dd>
              </div>
            </dl>
          </section>

          {/*
          No signed-in branch here any more: a signed-in visitor was redirected
          to /home before this rendered, so anyone reading this panel needs the
          sign-in form.
        */}
          <section id="signin" className="fp-card p-6 md:col-span-2">
            <h2 className="fp-h4">Member sign in</h2>
            <LoginForm
              error={params.error ?? null}
              offerResend={params.resend === '1'}
              initialEmail={safeEmailParam(params.email)}
            />
            <p className="mt-6 border-t border-brand/15 pt-6 text-sm text-ink-soft">
              New here?{' '}
              <Link href="/signup" className="fp-link">
                Create your account and dog profile
              </Link>
            </p>
          </section>
          </div>
        </div>

        <Reveal as="section" id="how" className="mt-20 scroll-mt-8">
          <h2 className="fp-h2">
            <span aria-hidden="true">🐾</span> How Forming Paws works
          </h2>
          <p className="mt-2 text-ink-soft">
            Four steps from profile to a safe, well-documented match.
          </p>
          <StepStack
            items={STEPS.map((step) => ({
              key: step.n,
              children: (
                <div className="fp-card md:flex md:items-start md:gap-7">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand font-bold text-ivory">
                    {step.n}
                  </span>
                  <div className="mt-3 md:mt-0">
                    <h3 className="fp-h4">{step.title}</h3>
                    <p className="mt-2 text-ink-soft">{step.body}</p>
                  </div>
                </div>
              ),
            }))}
          />
        </Reveal>

        {/* Breathing room between the two heaviest sections on the page. */}
        <SectionDivider className="mt-16" />

        <Reveal as="section" id="health" className="mt-4 scroll-mt-8">
          <h2 className="fp-h2">
            <span aria-hidden="true">🐾</span> Health first — it&apos;s the whole point
          </h2>
          <p className="mt-2 text-ink-soft">
            Forming Paws exists to raise the standard of dog breeding, not just to make
            introductions.
          </p>
          <div className="fp-depth mt-6 grid gap-4 sm:grid-cols-3">
            {HEALTH.map((card) => (
              <div key={card.title} className="fp-card">
                <span className="text-2xl" aria-hidden="true">
                  {card.icon}
                </span>
                <h3 className="mt-3 fp-h5">{card.title}</h3>
                <p className="mt-2 text-sm text-ink-soft">{card.body}</p>
              </div>
            ))}
          </div>
        </Reveal>

        <Reveal as="section" id="roadmap" className="mt-20 scroll-mt-8">
          <h2 className="fp-h2">Where we&apos;re headed</h2>
          <p className="mt-2 text-ink-soft">A nonprofit that grows with its community.</p>
          <ol className="fp-depth mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {ROADMAP.map((item) => (
              <li key={item.tag} className="fp-card">
                <span className="fp-eyebrow">
                  {item.tag}
                </span>
                <h3 className="mt-2 fp-h5">{item.title}</h3>
                <p className="mt-2 text-sm text-ink-soft">{item.body}</p>
              </li>
            ))}
          </ol>
        </Reveal>

        {/* Visitors only reach this page signed out, so no guard is needed. */}
        <Reveal as="section" id="waitlist" className="fp-band mt-20 scroll-mt-8">
          <h2 className="fp-h2">Be a Founding Member</h2>
          <p className="mt-2 text-ink-soft">
            Join the waitlist — the first 20 owners in our launch city get health verification{' '}
            <strong>free for life</strong>.
          </p>
          <div className="mt-7 grid gap-6 sm:max-w-md sm:grid-cols-2">
            <p>
              <span className="fp-h2 block text-brand">
                <CountUp to={20} />
              </span>
              <span className="fp-eyebrow mt-1 block">founding spots</span>
            </p>
            <p>
              <span className="fp-h2 block text-brand">
                <CountUp to={RESPONSE_TIME.hours} suffix="h" />
              </span>
              <span className="fp-eyebrow mt-1 block">max reply time</span>
            </p>
          </div>
          <WaitlistForm />
          <p className="mt-4 text-sm text-ink-soft">
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
        </Reveal>

        <Reveal as="section" id="faq" className="mt-20 scroll-mt-8">
          <h2 className="fp-h2">Questions people ask first</h2>
          <p className="mt-2 text-ink-soft">
            The five that come up most.{' '}
            <Link href="/faq" className="fp-link">
              All of them, on one page
            </Link>
            .
          </p>
          <div className="fp-depth mt-6 flex flex-col gap-3">
            {FAQS.map((faq) => (
              <details key={faq.question} className="fp-card">
                <summary className="cursor-pointer font-semibold">{faq.question}</summary>
                <p className="mt-3 text-sm text-ink-soft">{faq.answer}</p>
              </details>
            ))}
          </div>
        </Reveal>

        <Reveal as="section" className="fp-band mt-16">
          <h2 className="fp-h2">Still deciding?</h2>
          <p className="mt-2 text-ink-soft">
            {RESPONSE_TIME.sentence} Ask us anything before you sign up — a real person answers.
          </p>
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
              title="Forming Paws — health-verified breeding matches for dog owners"
            />
          </div>
        </Reveal>
      </main>

      <SiteFooter />
    </div>
  )
}
