import HeroParallax from '@/components/motion/HeroParallax'
import MeadowCanvas from '@/components/art/webgl/MeadowCanvas'

/**
 * The 3D ground behind the auth pages.
 *
 * This is the landing hero's scene with its sky deliberately removed, and the
 * removal is the point: `HeroScene` leads with a 40KB generated sky raster
 * marked `priority`, which makes it the LCP candidate of whatever page it is
 * on. That trade is defensible on the landing page, where the sky *is* the
 * largest thing in the viewport and the page exists to be looked at. It is not
 * defensible on /login — the page every gated route redirects to, which exists
 * to be used in four seconds — so the raster is gone and nothing here is
 * preloaded.
 *
 * What remains is genuinely three-dimensional and nearly free:
 *
 *   - MeadowCanvas, the same three.js ridge field, reused with no edits. It
 *     renders with `alpha: true` and fogs to #FBF7F0, so with the sky gone it
 *     composites straight onto ivory with no seam — the fog colour was already
 *     this page's background.
 *   - The two SVG ridge planes, about a kilobyte each, which are what shows
 *     when WebGL declines. `[data-fp-webgl='on']` fades them out once the canvas
 *     has a real frame, so there is never a blink and never a gap.
 *   - HeroParallax, which moves both planes at different rates from one
 *     property write per frame.
 *
 * MeadowCanvas finds its scroll parent with `closest('[data-fp-hero]')` and
 * HeroParallax with `querySelector('[data-fp-hero]')`, so carrying that
 * attribute here is the entire wiring. Neither component needed changing.
 *
 * Decorative and aria-hidden throughout. Absolutely positioned inside a
 * relative parent, so it cannot move a pixel of the form and contributes
 * exactly zero to CLS.
 */
export default function AuthScene() {
  return (
    <div
      data-fp-hero=""
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 overflow-hidden bg-ivory"
    >
      {/*
        The 3D ridges. Transparent canvas over ivory, in the same slot the SVG
        planes below occupy, so the scrim protects text whichever one is
        showing.
      */}
      <MeadowCanvas />

      {/*
        A light wash, and deliberately light.
        
        Text contrast is NOT this layer's job any more: the form sits on an
        opaque card and the copy beside it sits on its own plate, both by rule.
        A scrim heavy enough to protect bare text over these ridges is also
        heavy enough to desaturate the greens into the grey fog this project
        already diagnosed once on the landing hero, where it read as a rendering
        fault rather than a landscape. So this only softens the left, where the
        form overlaps, and lets the right stay green.
      */}
      <div className="absolute inset-0 bg-ivory/20 md:bg-gradient-to-r md:from-ivory/55 md:via-ivory/20 md:to-transparent" />

      {/* Midground hills. Same path as the landing hero: one landscape, two pages. */}
      <svg
        className="fp-plane fp-plane-hills absolute inset-x-0 -bottom-10 h-[calc(34%+2.5rem)] w-full"
        viewBox="0 0 1440 220"
        preserveAspectRatio="none"
        fill="none"
      >
        <path
          d="M0 132 C 180 96, 320 150, 520 128 C 720 106, 860 158, 1060 134 C 1220 115, 1340 146, 1440 128 L1440 220 L0 220 Z"
          fill="#2F6B5C"
        />
      </svg>

      {/* Foreground meadow. */}
      <svg
        className="fp-plane fp-plane-meadow absolute inset-x-0 -bottom-14 h-[calc(18%+3.5rem)] w-full"
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
