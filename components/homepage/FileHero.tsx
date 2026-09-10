import Link from 'next/link'
import RecordLine from '@/components/record/RecordLine'

/**
 * The split hero.
 *
 * A server component with no interactivity, no entrance animation and no
 * observer, so the whole thing is present and readable in the first paint of
 * the server HTML. That is the point: the previous opening hid every element
 * behind `[data-sc-in]` until JavaScript ran, which put the front door one
 * script error away from a blank page.
 *
 * Geometry is 7:5, not 50/50. An even split reads as a slideshow; the wider
 * copy column reads as a page with a plate on it, which is the register this
 * site is arguing for. Below md the photograph moves *below* the copy rather
 * than above it — the claim leads and the picture supports it, and a stranger
 * on a phone should not have to scroll past an animal to find out what the
 * site is.
 *
 * Nothing is set over the photograph. Copy sits on solid ivory beside it,
 * because the failure that got the last hero rejected was not contrast —
 * measured contrast was 10:1 — but edge competition between the type and the
 * artwork's contour strokes, which no scrim or plate can fix.
 */
export default function FileHero() {
  return (
    <section className="fp-shell pt-8 sm:pt-12" aria-labelledby="hero-title">
      <div className="grid gap-10 md:grid-cols-12 md:gap-0">
        {/* Copy — 7 of 12, on solid ground. */}
        <div className="md:col-span-7 md:self-center md:pr-12">
          <RecordLine label="File 001" value="Chicago" className="mb-5" />

          <h1 id="hero-title" className="fp-display text-balance">
            Every dog here has a file you can read.
          </h1>

          <p className="fp-lead mt-5 max-w-[34rem]">
            Forming Paws is a health-verified dog matching platform for Chicago owners. A
            person reviews the vet records before any match unlocks.
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link href="/browse" className="fp-btn">
              Browse dogs
            </Link>
            {/*
              An anchor, not a modal. The primary objection here is disbelief,
              and the fastest answer to disbelief is the artefact itself — so
              this jumps to the real record component further down the page
              rather than describing it in a dialog.
            */}
            <Link href="#file" className="fp-btn-ghost">
              See what a file contains
            </Link>
          </div>
        </div>

        {/*
          Photograph — 5 of 12, in its own panel.

          The vertical hairline is the seam between the two panels and only
          exists from md up; below that the panel takes a top rule instead, so
          the boundary never disappears entirely.
        */}
        <figure className="md:col-span-5 md:border-l md:border-hairline md:pl-12">
          {/*
            The frame sets a 4:5 box and the photograph fills it.

            The source is 3:4, which at this column width ran ~613px tall
            against a ~370px copy column and left a lot of dead ivory above and
            below the text. Cropping to 4:5 in the frame rather than re-encoding
            keeps one asset for every breakpoint. The ratio lives on the
            container, so the space is reserved before the image loads and there
            is no layout shift either way.
          */}
          <picture className="block aspect-[4/5] w-full overflow-hidden rounded border border-hairline bg-wash">
            <source
              type="image/avif"
              srcSet="/photo/hero-rest-780.avif 780w, /photo/hero-rest-1200.avif 1200w"
              sizes="(min-width: 768px) 40vw, 100vw"
            />
            <img
              src="/photo/hero-rest-1200.jpg"
              srcSet="/photo/hero-rest-780.jpg 780w, /photo/hero-rest-1200.jpg 1200w"
              sizes="(min-width: 768px) 40vw, 100vw"
              width={1200}
              height={1589}
              /* fetchPriority + eager: this is the LCP candidate on desktop,
                 and lazy-loading the LCP image is a measurable regression. */
              fetchPriority="high"
              loading="eager"
              decoding="async"
              alt="A mixed-breed dog resting on a hardwood floor beside a radiator, lit by a window."
              /* object-position keeps the dog in frame when the 3:4 source is
                 cropped to the 4:5 box: the crop has to come off the top, where
                 there is only wall. */
              className="h-full w-full object-cover object-bottom"
            />
          </picture>

          {/*
            The caption is not a hedge. It is the mark system working: this
            photograph was generated, so it carries no name, no location and no
            verified mark, because a synthetic dog wearing a green verified
            badge would be a fabricated record on a site whose whole argument is
            that its records are real. When a real member photograph replaces
            it, this line becomes a real record with a real mark.
          */}
          <figcaption className="mt-3">
            <RecordLine label="Illustrative" value="Not a member record" />
          </figcaption>
        </figure>
      </div>
    </section>
  )
}
