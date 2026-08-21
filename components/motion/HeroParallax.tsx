'use client'

import { useEffect } from 'react'

/**
 * Drives the hero's three planes by writing CSS custom properties.
 *
 * Renders nothing. The planes are server-rendered markup whose transforms are
 * declared in CSS reading `--fp-y-sky` and friends; this only supplies the
 * numbers. One property write per frame moves all three, the compositor already
 * knows about the transforms, and React never re-renders.
 *
 * The first version of this drove the planes with Framer Motion, which put ~34KB
 * gzipped on the landing page's critical path and cost ~250ms of LCP for an
 * effect nobody can see until they scroll. There is nothing in `useScroll` that
 * a passive listener and a rAF gate do not do here, so the library is gone and
 * the file that replaces it is under a kilobyte.
 *
 * Three things keep this at 60fps on a mid-range Android:
 *
 * 1. **The scroll listener only exists while the hero is on screen.** An
 *    IntersectionObserver attaches it on entry and detaches on exit, so the
 *    other nine-tenths of this page scrolls with no handler bound at all.
 * 2. **Geometry is measured on resize, never per frame.** Reading `scrollY` is
 *    free; `getBoundingClientRect()` forces layout, and doing that every frame
 *    is the classic way to make a parallax janky.
 * 3. **Transform only.** Compositor-only, so scrolling never triggers layout or
 *    paint. Animating `top` or `margin` here would cost a layout pass a frame.
 *
 * Reduced motion is honoured live rather than only at mount: the listener is
 * torn down and the properties cleared the moment the preference flips, and
 * globals.css pins the planes as an independent CSS-level backstop.
 */

/** Plane, and how far it travels across the hero. Negative overtakes the page. */
const PLANES = [
  ['--fp-y-sky', 56],
  ['--fp-y-hills', 22],
  ['--fp-y-meadow', -26],
] as const

export default function HeroParallax() {
  useEffect(() => {
    const root = document.querySelector<HTMLElement>('[data-fp-hero]')
    if (!root) return

    const media = window.matchMedia('(prefers-reduced-motion: reduce)')

    let frame = 0
    let bound = false
    let top = 0
    let height = 1

    const measure = () => {
      const rect = root.getBoundingClientRect()
      top = rect.top + window.scrollY
      height = Math.max(1, rect.height)
    }

    const paint = () => {
      frame = 0
      // 0 as the hero's top meets the viewport top, 1 as its bottom does.
      const p = Math.min(1, Math.max(0, (window.scrollY - top) / height))
      for (const [prop, distance] of PLANES) {
        root.style.setProperty(prop, `${p * distance}px`)
      }
    }

    const onScroll = () => {
      if (frame) return
      frame = requestAnimationFrame(paint)
    }

    const onResize = () => {
      measure()
      onScroll()
    }

    const bind = () => {
      if (bound || media.matches) return
      bound = true
      window.addEventListener('scroll', onScroll, { passive: true })
      measure()
      paint()
    }

    const unbind = () => {
      if (!bound) return
      bound = false
      window.removeEventListener('scroll', onScroll)
      if (frame) {
        cancelAnimationFrame(frame)
        frame = 0
      }
    }

    const clear = () => {
      for (const [prop] of PLANES) root.style.removeProperty(prop)
    }

    // Bind only while the hero is actually in view.
    const observer = new IntersectionObserver(
      ([entry]) => (entry.isIntersecting ? bind() : unbind()),
      { threshold: 0 },
    )

    const onPreference = () => {
      if (media.matches) {
        unbind()
        clear()
      } else {
        observer.disconnect()
        observer.observe(root)
      }
    }

    window.addEventListener('resize', onResize, { passive: true })
    media.addEventListener('change', onPreference)
    if (!media.matches) observer.observe(root)

    return () => {
      observer.disconnect()
      media.removeEventListener('change', onPreference)
      window.removeEventListener('resize', onResize)
      unbind()
      clear()
    }
  }, [])

  return null
}
