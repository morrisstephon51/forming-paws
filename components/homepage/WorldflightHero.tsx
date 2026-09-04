'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import Sage, { type SageMood } from '@/components/mascot/Sage'
import Logo from '@/components/Logo'

/**
 * The opening worldflight: problem -> turn -> Sage meets you -> meadow.
 *
 * Poster-only by deliberate choice, not as a fallback. See
 * ~/.claude/skills/ultimate/scrollcraft/builds/forming-paws-homepage/BRIEF.md
 * ("Tension 2") for why: this is exactly the engine's own documented
 * reduced-motion path (references/worldflight.md §7), promoted to the
 * primary experience because two illustrated stills fit the real budget and
 * two 5s clips do not.
 *
 * Sage itself is never regenerated. Two real mood SVGs cross-fade based on
 * scroll progress through the flight -- the mascot doing its own
 * scroll-driven transform on top of the engine's world segments.
 *
 * 2026-09-01: the small corner mark now hands off to a full-body illustrated
 * Sage standing in the meadow at the peak. Same risograph line-and-wash
 * register as the two world-leg stills (matching style preamble, same brand
 * ink/wash colors, the accent color used only on a neckerchief prop and
 * never the coat itself), generated once and reused as a static image --
 * not re-generated per mood, since the corner mark still owns mood-swapping.
 * The two illustrated registers coexist deliberately: the flat SVG is the
 * small-size UI mark (footer, forms, this corner), the full-body art is the
 * brand/marketing register for moments large enough to carry it. See
 * docs/visual/SAGE-BRAND.md.
 */

declare global {
  interface Window {
    ScrollCraft?: {
      mount: (root: Document | HTMLElement) => unknown
      instances: unknown[]
    }
  }
}

const MOOD_TRACK: { at: number; mood: SageMood }[] = [
  { at: 0, mood: 'confused' },
  { at: 0.45, mood: 'thinking' },
  { at: 0.62, mood: 'waving' },
  { at: 1, mood: 'happy' },
]

function moodsAt(p: number): { from: SageMood; to: SageMood; mix: number } {
  let lo = MOOD_TRACK[0]
  let hi = MOOD_TRACK[MOOD_TRACK.length - 1]
  for (let i = 0; i < MOOD_TRACK.length - 1; i++) {
    if (p >= MOOD_TRACK[i].at && p <= MOOD_TRACK[i + 1].at) {
      lo = MOOD_TRACK[i]
      hi = MOOD_TRACK[i + 1]
      break
    }
  }
  const span = Math.max(hi.at - lo.at, 0.0001)
  const mix = Math.min(1, Math.max(0, (p - lo.at) / span))
  return { from: lo.mood, to: hi.mood, mix }
}

/** Leg 2 (Substance/meadow) starts where raw `seg + p` reaches 1.0 (0-indexed
 *  segment plus intra-segment progress, UNCLAMPED -- unlike `overall` below,
 *  which divides by leg count and caps at 1 for the mood track, and would
 *  never let this fire if reused here). Fully resolved by 1.3 (30% into leg
 *  2), well before the "waving"/"happy" moods land on the corner mark, so the
 *  full-body figure is already standing in the meadow by the time the corner
 *  mark finishes its own turn. */
const FIGURE_START = 1.0
const FIGURE_END = 1.3

function figureProgressAt(rawSegProgress: number): number {
  return Math.min(1, Math.max(0, (rawSegProgress - FIGURE_START) / (FIGURE_END - FIGURE_START)))
}

export default function WorldflightHero() {
  const rootRef = useRef<HTMLDivElement>(null)
  const [sageState, setSageState] = useState(() => moodsAt(0))
  const [figureProgress, setFigureProgress] = useState(0)
  /**
   * The scroll cue's opacity. Full at rest, gone within the first 6% of leg 1,
   * because a cue that is still on screen after the reader has obeyed it has
   * stopped being a hint and started being furniture.
   */
  const [cueOpacity, setCueOpacity] = useState(1)

  useEffect(() => {
    let raf = 0
    let mounted = false

    function relayout() {
      dispatchEvent(new Event('resize'))
    }

    let stageHidden = false

    function tick() {
      const root = rootRef.current
      if (root) {
        const p = parseFloat(getComputedStyle(root).getPropertyValue('--sc-segp')) || 0
        const seg = parseFloat(getComputedStyle(root).getPropertyValue('--sc-seg')) || 0
        // Track progress across the WHOLE flight (2 legs), not just the
        // current leg, so Sage's mood track spans the full journey.
        const overall = Math.min(1, Math.max(0, (seg + p) / 2))
        setSageState((prev) => {
          const next = moodsAt(overall)
          if (next.from === prev.from && next.to === prev.to && Math.abs(next.mix - prev.mix) < 0.003) {
            return prev
          }
          return next
        })
        setFigureProgress((prev) => {
          const next = figureProgressAt(seg + p)
          return Math.abs(next - prev) < 0.003 ? prev : next
        })
        setCueOpacity((prev) => {
          const next = Math.min(1, Math.max(0, 1 - (seg + p) / 0.06))
          return Math.abs(next - prev) < 0.01 ? prev : next
        })

        // Worldflight's fixed stage has no engine-side mechanism to release
        // once its own scroll track ends -- it's built as if the flight IS
        // the page. This page has real content after it, so the page (not
        // the engine) has to let go: once the spacer is scrolled fully past,
        // hide the fixed layer so it stops painting over -- and capturing
        // clicks on -- everything below it. Purely geometric (spacer bottom
        // vs. 0), independent of the engine's own seg/segp math.
        //
        // opacity + pointer-events on the stage/copy elements directly,
        // NOT visibility on an ancestor: the engine sets each segment's own
        // inline visibility to 'visible' whenever its opacity is above
        // 0.002 (true forever for the last, fully-landed leg), and an
        // element can override an inherited visibility:hidden from a
        // parent. Opacity doesn't have that escape -- a 0-opacity ancestor
        // hides its whole subtree regardless of any child's own opacity.
        const stage = root.querySelector('[data-sc-world]') as HTMLElement | null
        const copyLayer = root.querySelector('[data-sc-world-copy]') as HTMLElement | null
        const spacer = root.querySelector('[data-sc-spacer]') as HTMLElement | null
        if (spacer && stage && copyLayer) {
          const past = spacer.getBoundingClientRect().bottom <= 0
          if (past !== stageHidden) {
            stageHidden = past
            stage.style.opacity = past ? '0' : '1'
            stage.style.pointerEvents = past ? 'none' : ''
            copyLayer.style.opacity = past ? '0' : '1'
            copyLayer.style.pointerEvents = past ? 'none' : ''
          }
        }
      }
      raf = requestAnimationFrame(tick)
    }

    function mountEngine() {
      if (mounted || !window.ScrollCraft) return
      window.ScrollCraft.mount(document.body)
      mounted = true
      addEventListener('load', relayout)
      if (document.fonts && document.fonts.ready) document.fonts.ready.then(relayout)
      raf = requestAnimationFrame(tick)
    }

    if (window.ScrollCraft) {
      mountEngine()
    } else {
      const script = document.getElementById('scrollcraft-engine') as HTMLScriptElement | null
      script?.addEventListener('load', mountEngine)
      if (!script) {
        const s = document.createElement('script')
        s.id = 'scrollcraft-engine'
        s.src = '/scrollcraft/scrollcraft.js'
        s.addEventListener('load', mountEngine)
        document.body.appendChild(s)
      }
    }

    return () => {
      cancelAnimationFrame(raf)
    }
  }, [])

  return (
    <>
      {/* eslint-disable-next-line @next/next/no-css-tags -- vendored vanilla
          engine CSS served as a static asset, not part of Next's CSS pipeline */}
      <link rel="stylesheet" href="/scrollcraft/scrollcraft.css" />
      <style>{`
        #fp-flight {
          --sc-canvas: #FBF7F0;
          --sc-surface: #FFFCF7;
          --sc-ink: #26221C;
          --sc-ink-soft: #6C6155;
          --sc-accent: #AD4727;
          --sc-accent-ink: #FBF7F0;
          --sc-font-display: var(--font-display), Newsreader, Georgia, serif;
          --sc-font-text: var(--font-text), 'Public Sans', system-ui, sans-serif;
        }
        /* StickyJoinBar is fixed to the bottom of the viewport on phones only
           (sm:hidden). Everything the flight anchors to the bottom edge was
           laid out as if it were not there, so on a 390x844 phone the corner
           Sage cleared the bar by 7px -- close enough to read as clipped, and
           the reason the mascot looked "almost covered by the bottom of the
           page". --fp-floor is that bar's real height, added to every
           bottom-anchored offset in the flight, and 0 from sm: up where the
           bar does not exist. */
        #fp-flight { --fp-floor: 0px; }
        @media (max-width: 639px) {
          #fp-flight { --fp-floor: calc(3.8rem + env(safe-area-inset-bottom)); }
        }
        #fp-flight .sc-world__poster { object-fit: cover; width: 100%; height: 100%; }
        /* Scoped override of the vendored engine's own bottom anchors rather
           than an edit to scrollcraft.css, which is a vendored asset. */
        #fp-flight .sc-copy--lead,
        #fp-flight .sc-copy--trail { bottom: calc(clamp(3rem, 12vh, 9rem) + var(--fp-floor)); }
        #fp-flight .fp-flight-copy { max-width: 40rem; }
        #fp-flight .fp-flight-copy p { margin: 0; }
        /* The company name was an 11px tracked label here before -- easy to
           miss on the one screen every visitor actually lands on. This is a
           real lockup (mark + name), sized as its own moment rather than a
           kicker over the headline. */
        #fp-flight .fp-wordmark { display: flex; align-items: center; gap: 0.65rem; margin-bottom: 0.9rem; }
        #fp-flight .fp-wordmark span {
          font-family: var(--sc-font-display); font-weight: 700;
          font-size: clamp(1.75rem, 1.4rem + 1.6vw, 2.75rem);
          letter-spacing: -0.012em; color: #2F6B5C;
        }
        /* A scrim only where this one block sits, not a full-frame overlay:
           this is the block that crosses the seam onto the busiest part of
           the leg-1 artwork (the terracotta risograph wash), and measured
           contrast there dipped to 3.1:1 without it. */
        #fp-flight .fp-flight-copy--plate {
          background: color-mix(in oklab, var(--sc-canvas) 82%, transparent);
          padding: 0.9rem 1.2rem;
          border-radius: 14px;
        }
        #fp-flight .fp-sage-wrap {
          position: absolute; right: clamp(1.25rem, 5vw, 4rem);
          /* Raised from clamp(1.5rem, 8vh, 5rem): even on desktop, where there
             is no join bar, the mark sat 72px off a 900px floor and read as
             falling out of the frame. */
          bottom: calc(clamp(2.5rem, 11vh, 7rem) + var(--fp-floor));
          width: clamp(72px, 10vw, 128px); height: clamp(72px, 10vw, 128px);
          filter: drop-shadow(0 6px 14px rgba(47,107,92,0.18));
        }
        #fp-flight .fp-sage-layer { position: absolute; inset: 0; transition: opacity 60ms linear; }
        #fp-flight .fp-sage-figure {
          position: absolute; left: 55%; bottom: calc(7% + var(--fp-floor));
          width: clamp(150px, 24vw, 340px);
          transform: translateX(-50%);
          filter: drop-shadow(0 12px 22px rgba(38,34,28,0.2));
        }
        #fp-flight .fp-sage-figure img { display: block; width: 100%; height: auto; }
        @media (max-width: 640px) {
          /* The finale/turn copy plates and the sticky join bar both claim
             the bottom third on a phone-height crop, so the figure moves up
             into the open band between the tree canopy and the copy instead
             of trying to share the same footer strip the desktop layout has
             room for. */
          #fp-flight .fp-sage-figure { left: 68%; bottom: calc(28% + var(--fp-floor)); width: clamp(90px, 26vw, 160px); }
        }
        @media (max-width: 640px) {
          #fp-flight .fp-flight-copy h1, #fp-flight .fp-flight-copy p { text-shadow: 0 1px 12px rgba(251,247,240,0.9); }
        }
        /* The scroll cue.
           Placed inside the hero copy block rather than pinned to the bottom
           centre of the stage: the block is bottom-anchored, so the cue takes
           the floor position and the headline rises to make room, which keeps
           it clear of both the corner mascot (bottom right) and the join bar
           without a single absolute coordinate to keep in sync. */
        /* Over the leg-2 meadow this eyebrow measured close to invisible:
           accent terracotta at 11px on a pale wash, crossing the tree. Same
           treatment the copy plate already uses, sized to the label. */
        #fp-flight .fp-flight-eyebrow {
          display: inline-block;
          background: color-mix(in oklab, var(--sc-canvas) 82%, transparent);
          padding: 0.28rem 0.6rem; border-radius: 999px; margin-bottom: 0.5rem;
        }
        #fp-flight .fp-flight-cta { margin-top: 1.25rem; display: inline-flex; }
        #fp-flight .fp-scroll-cue {
          display: inline-flex; align-items: center; gap: 0.5rem;
          margin-top: 1.15rem; padding: 0.4rem 0.85rem 0.4rem 0.5rem;
          border-radius: 999px;
          background: color-mix(in oklab, var(--sc-canvas) 78%, transparent);
          color: var(--sc-ink-soft);
          font-family: var(--sc-font-text);
          font-size: 0.72rem; font-weight: 700;
          letter-spacing: 0.10em; text-transform: uppercase;
          transition: opacity 240ms ease;
        }
        #fp-flight .fp-scroll-cue svg.fp-cue-chevron { animation: fp-cue-bob 1.9s ease-in-out infinite; }
        @keyframes fp-cue-bob {
          0%, 100% { transform: translateY(-1px); }
          50%      { transform: translateY(3px); }
        }
        @media (prefers-reduced-motion: reduce) {
          #fp-flight .fp-scroll-cue svg.fp-cue-chevron { animation: none; }
        }
      `}</style>

      <div
        id="fp-flight"
        ref={rootRef}
        data-sc-mode="worldflight"
        data-sc-seam="0.16"
        data-sc-lerp="0.12"
        style={{ background: 'var(--sc-canvas)' }}
      >
        <div data-sc-world>
          <div data-sc-segment data-sc-w="2.4" data-sc-linger="0.25" data-sc-waypoint="Recognition">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              className="sc-world__poster"
              src="/world/leg1-problem.jpg"
              alt=""
              decoding="async"
              fetchPriority="high"
            />
          </div>
          <div data-sc-segment data-sc-w="2.6" data-sc-linger="0.45" data-sc-waypoint="Substance">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className="sc-world__poster" src="/world/leg2-meadow.jpg" alt="" decoding="async" />
            <div className="fp-sage-figure" style={{ opacity: figureProgress }} aria-hidden="true">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/mascot/sage-full-greet.webp" alt="" decoding="async" />
            </div>
          </div>
        </div>

        <div data-sc-world-copy>
          <div className="sc-world__scrim sc-scrim sc-scrim--band" />

          <div className="sc-copy sc-copy--lead fp-flight-copy" data-sc-copy data-sc-window="hero">
            <div className="fp-wordmark">
              <Logo size="md" />
              <span>Forming Paws</span>
            </div>
            <h1 className="fp-display" style={{ color: 'var(--sc-ink)' }}>
              Find a health-verified match for your dog nearby.
            </h1>
            <div className="fp-scroll-cue" style={{ opacity: cueOpacity }} aria-hidden="true">
              <Sage mood="thinking" size={26} />
              <span>Scroll</span>
              <svg
                className="fp-cue-chevron"
                width="11"
                height="7"
                viewBox="0 0 11 7"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M1 1l4.5 4.5L10 1" />
              </svg>
            </div>
          </div>

          <div className="sc-copy sc-copy--lead fp-flight-copy" data-sc-copy data-sc-window="0.14 0.42">
            <p className="fp-lead" style={{ color: 'var(--sc-ink)' }}>
              No way to see which dogs are actually nearby. No proof that a
              dog is healthy enough to breed. No path forward if the records
              fall short.
            </p>
          </div>

          <div className="sc-copy sc-copy--trail fp-flight-copy" data-sc-copy data-sc-window="0.46 0.72">
            <p className="fp-h2 fp-flight-copy--plate" style={{ color: 'var(--sc-ink)' }}>
              Forming Paws is the dog breeding community where a person reads
              the vet records before matching unlocks.
            </p>
          </div>

          <div className="sc-copy sc-copy--lead fp-flight-copy" data-sc-copy data-sc-window="finale">
            <p className="fp-eyebrow fp-flight-eyebrow" style={{ color: 'var(--sc-accent)' }}>
              Health-verified. Local. Owner to owner.
            </p>
            <h2 className="fp-display" style={{ color: 'var(--sc-ink)' }}>
              Add your dog, upload the records, and match nearby.
            </h2>
            {/*
              The flight had no call to action at the one moment it has earned
              one: the reader has just been shown the whole proposition and the
              next thing on screen was an unrelated section heading. This is the
              conversion beat, so it now carries the ask.
            */}
            <Link href="/signup" className="fp-btn fp-flight-cta" data-sc-magnet="0.22">
              Join free
            </Link>
          </div>

          <div className="fp-sage-wrap" aria-hidden="true" style={{ opacity: 1 - figureProgress }}>
            <div className="fp-sage-layer" style={{ opacity: 1 - sageState.mix }}>
              <Sage mood={sageState.from} size={128} />
            </div>
            <div className="fp-sage-layer" style={{ opacity: sageState.mix }}>
              <Sage mood={sageState.to} size={128} />
            </div>
          </div>
        </div>

        <div data-sc-spacer aria-hidden="true" />
      </div>
    </>
  )
}
