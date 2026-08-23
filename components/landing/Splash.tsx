import Link from 'next/link'
import HeroScene from '@/components/art/HeroScene'
import SageHero from './SageHero'

/**
 * The first screen.
 *
 * One statement, the mascot, and a way down — nothing else. Everything that
 * used to sit in the hero and still has a job (the sign-in panel, the three
 * trust points) is the first thing you reach on scroll, not competing here.
 *
 * Structure follows the reference system: a full-bleed illustrated scene at
 * viewport height, with a glass overlay card carrying the headline. The card
 * earns its blur — it is what keeps the headline legible over a scene whose
 * colours change as the camera moves, without dropping a flat scrim over the
 * artwork and greying it out.
 *
 * Sized in svh, not vh: on mobile Safari `vh` is the *expanded* viewport, so a
 * 100vh splash hides its own scroll cue behind the browser chrome — the one
 * affordance telling a first-time visitor there is anything below.
 */
export default function Splash() {
  return (
    <section className="fp-splash" aria-labelledby="splash-title">
      <HeroScene bleed />

      <div className="fp-splash-inner">
        <SageHero />
        <div className="fp-splash-card">
          {/*
            Each term is kept whole. The line breaks at the separators or not at
            all: left to wrap freely the browser treats the hyphen in
            "Health-verified" as a break opportunity and splits it across two
            lines, which reads as two claims rather than one.
          */}
          <p className="fp-eyebrow">
            <span className="whitespace-nowrap">Nonprofit</span> ·{' '}
            <span className="whitespace-nowrap">Community-driven</span> ·{' '}
            <span className="whitespace-nowrap">Health-verified</span>
          </p>
          <h1 id="splash-title" className="mt-3 fp-display">
            Healthy matches.
            <br />
            Happy litters.
          </h1>
          <p className="fp-lead mt-4 max-w-prose">
            Forming Paws connects dog owners nearby for safe, health-documented breeding matches,
            with veterinary verification at the centre of everything.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Link href="/signup" className="fp-btn">
              Join free and list your dog
            </Link>
            <Link href="/app" className="fp-btn-ghost">
              See the app first
            </Link>
          </div>
        </div>
      </div>

      {/*
        A real link, not a decorative chevron. It moves focus and the URL to the
        section it points at, so it works from the keyboard and means something
        to a screen reader — "Skip to what Forming Paws does" rather than an
        unlabelled arrow.
      */}
      <Link href="#start" className="fp-splash-cue">
        <span>What Forming Paws does</span>
        <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" fill="none">
          <path
            d="M6 9.5 12 15.5 18 9.5"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </Link>
    </section>
  )
}
