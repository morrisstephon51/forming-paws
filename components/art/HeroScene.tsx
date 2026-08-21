import Image from 'next/image'
import heroSky from '@/assets/art/hero-sky.jpg'

/**
 * The layered backdrop behind the landing hero.
 *
 * Three planes, back to front: a generated sky raster, a midground hill
 * silhouette, and a foreground meadow band. The two front planes are inline SVG
 * rather than raster on purpose — they need real transparency to sit over the
 * sky, they cost about a kilobyte each instead of forty, and PR #2 animates them
 * at different scroll rates, which is far cheaper on a path than on a bitmap.
 *
 * Everything here is decorative. The hero already says "Healthy matches. Happy
 * litters." in an h1; a screen reader gaining "illustration of a park at dusk"
 * on top of that is noise, so the whole scene is aria-hidden.
 *
 * Layout-neutral by construction: absolutely positioned inside a relative
 * parent, so it cannot move the text a single pixel and contributes exactly zero
 * to CLS.
 */
export default function HeroScene() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 overflow-hidden rounded-3xl bg-ivory"
    >
      {/* Plane 1 — the generated sky. The only priority image on the site: it is
          the largest element in the viewport on load and therefore the LCP
          candidate. Every other image on every other page lazy-loads. */}
      <Image
        src={heroSky}
        alt=""
        fill
        priority
        placeholder="blur"
        sizes="(max-width: 1024px) 100vw, 1024px"
        className="object-cover object-bottom"
      />

      {/*
        The contrast guarantee, and it sits here — above the sky, below the
        meadow — rather than on top of the whole stack. Scrimming the SVG planes
        too was the first version, and it desaturated the greens into a grey fog
        that read as a rendering fault instead of a landscape.

        Hero copy runs across the sky only; the meadow band below is clear of
        text by the section's bottom padding, so it needs no protection and gets
        none.
      */}
      <div className="absolute inset-0 bg-ivory/30 md:bg-gradient-to-r md:from-ivory/75 md:via-ivory/25 md:to-transparent" />

      {/* Plane 2 — midground hills. */}
      <svg
        className="fp-hero-layer absolute inset-x-0 bottom-0 h-[30%] w-full"
        viewBox="0 0 1440 220"
        preserveAspectRatio="none"
        fill="none"
      >
        <path
          d="M0 132 C 180 96, 320 150, 520 128 C 720 106, 860 158, 1060 134 C 1220 115, 1340 146, 1440 128 L1440 220 L0 220 Z"
          fill="#2F6B5C"
        />
      </svg>

      {/* Plane 3 — foreground meadow. */}
      <svg
        className="fp-hero-layer absolute inset-x-0 bottom-0 h-[16%] w-full"
        viewBox="0 0 1440 140"
        preserveAspectRatio="none"
        fill="none"
      >
        <path
          d="M0 74 C 160 48, 300 92, 470 70 C 640 48, 780 96, 950 74 C 1120 52, 1300 88, 1440 66 L1440 140 L0 140 Z"
          fill="#245448"
        />
      </svg>
    </div>
  )
}
