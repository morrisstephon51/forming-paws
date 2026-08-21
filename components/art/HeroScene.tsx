import Image from 'next/image'
import heroSky from '@/assets/art/hero-sky.jpg'
import HeroParallax from '@/components/motion/HeroParallax'

/**
 * The layered backdrop behind the landing hero.
 *
 * Three planes, back to front: a generated sky raster, a midground hill
 * silhouette, and a foreground meadow band. The two front planes are inline SVG
 * rather than raster because they need real transparency to sit over the sky,
 * cost about a kilobyte each instead of forty, and animate far more cheaply as a
 * path than as a bitmap.
 *
 * This is deliberately a *server* component with no animation library in it.
 * The first version drove the planes with Framer Motion directly, which put 30KB
 * of gzipped JavaScript on the landing page's critical path and cost ~250ms of
 * LCP on throttled mobile. The planes now read their offsets from CSS custom
 * properties, and HeroParallax — a client component that renders nothing — is
 * what sets them. The markup, the image, and the LCP candidate
 * all still arrive in the server-rendered HTML.
 *
 * Depth comes from how much each plane lags the page. Scrolling down moves the
 * hero up; a plane that also drifts *down* appears to lag, and the more it lags
 * the further away it reads. The sky lags most, the hills barely, and the meadow
 * overtakes the page entirely with a negative offset, which is what puts it in
 * front. Every plane carries bleed past the container edge so that travel can
 * never expose a gap.
 *
 * Everything here is decorative and aria-hidden. Layout-neutral by construction:
 * absolutely positioned inside a relative parent, so it cannot move the text a
 * pixel and contributes exactly zero to CLS.
 */
export default function HeroScene() {
  return (
    <div
      data-fp-hero=""
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 overflow-hidden rounded-3xl bg-ivory"
    >
      {/* Plane 1 — the generated sky. The only priority image on the site: it is
          the largest element in the viewport on load and therefore the LCP
          candidate. Every other image on every other page lazy-loads.

          Scaled slightly past the frame so its own downward travel never
          uncovers the top edge. */}
      <div className="fp-plane fp-plane-sky absolute inset-0">
        <Image
          src={heroSky}
          alt=""
          fill
          priority
          placeholder="blur"
          sizes="(max-width: 1024px) 100vw, 1024px"
          className="object-cover object-bottom"
        />
      </div>

      {/*
        The contrast guarantee, and it sits here — above the sky, below the
        meadow — rather than on top of the whole stack. Scrimming the SVG planes
        too was the first version, and it desaturated the greens into a grey fog
        that read as a rendering fault instead of a landscape.

        Deliberately not parallaxed: the scrim protects text, and text does not
        move, so neither does it.
      */}
      <div className="absolute inset-0 bg-ivory/30 md:bg-gradient-to-r md:from-ivory/75 md:via-ivory/25 md:to-transparent" />

      {/* Plane 2 — midground hills. */}
      <svg
        className="fp-plane fp-plane-hills absolute inset-x-0 -bottom-10 h-[calc(30%+2.5rem)] w-full"
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
        className="fp-plane fp-plane-meadow absolute inset-x-0 -bottom-14 h-[calc(16%+3.5rem)] w-full"
        viewBox="0 0 1440 140"
        preserveAspectRatio="none"
        fill="none"
      >
        <path
          d="M0 74 C 160 48, 300 92, 470 70 C 640 48, 780 96, 950 74 C 1120 52, 1300 88, 1440 66 L1440 140 L0 140 Z"
          fill="#245448"
        />
      </svg>

      <HeroParallax />
    </div>
  )
}
