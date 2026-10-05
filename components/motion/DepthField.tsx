'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'

/**
 * Site-wide scroll depth for every `.fp-depth` grid, from one driver.
 *
 * `.fp-depth` already existed as this system's card-grid class and already
 * carried a pointer-driven hover tilt. What it did not have was any depth at
 * rest, so on a phone — where `@media (hover: hover)` never matches — the class
 * did nothing at all. This adds the half that works everywhere: cards enter
 * rotated back and settle flat as they rise through the viewport.
 *
 * Done here rather than in each card so that the whole site upgrades at once.
 * `.fp-depth` is on nine pages; wrapping every one of their children in a
 * component would have been nine diffs and nine chances to miss one. This is
 * the same reasoning that made the last restyle redefine the `.fp-*` classes
 * underneath their existing call sites instead of rewriting the pages.
 *
 * Cost control, because a scroll handler that touches every card on the page is
 * exactly how this effect goes wrong:
 *
 *   - An IntersectionObserver keeps a live set of the cards actually on screen.
 *     The scroll handler iterates that set — typically three to eight elements —
 *     and never the full page.
 *   - One rAF per scroll burst, not one per event.
 *   - Off-screen cards are left holding their last value. Nothing reads it.
 *
 * Renders nothing. Mounted once in the root layout.
 */
export default function DepthField() {
  const pathname = usePathname()

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)')

    // Bail before observing anything. Under reduced motion the CSS already
    // neutralises the transform, so there is nothing for a driver to do and no
    // reason to pay for an observer.
    if (media.matches) return

    const cards = Array.from(
      document.querySelectorAll<HTMLElement>('.fp-depth > *'),
    )
    if (cards.length === 0) return

    const onScreen = new Set<HTMLElement>()
    let frame = 0

    function apply() {
      frame = 0
      const vh = window.innerHeight || 1
      for (const el of onScreen) {
        const top = el.getBoundingClientRect().top
        // Same easing window as Tilt3D: settled once the top edge has reached
        // the upper two-thirds. Sharing the window is what keeps a page that
        // uses both systems from having two different arrival speeds.
        const raw = (vh - top) / (vh * 0.66)
        el.style.setProperty('--fp-settle', Math.min(1, Math.max(0, raw)).toFixed(3))
      }
    }

    function schedule() {
      if (frame) return
      frame = requestAnimationFrame(apply)
    }

    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const el = entry.target as HTMLElement
          if (entry.isIntersecting) onScreen.add(el)
          else onScreen.delete(el)
        }
        schedule()
      },
      // A margin, so a card is being tracked before it is visible and has
      // already reached its entry pose by the time it crosses the edge. Without
      // it the first frame a card is on screen is the frame it starts rotating,
      // which reads as a card that flinches on arrival.
      { rootMargin: '20% 0px 20% 0px', threshold: 0 },
    )

    for (const el of cards) io.observe(el)

    function onPreference() {
      if (!media.matches) return
      if (frame) cancelAnimationFrame(frame)
      frame = 0
      // Hand the pose back to the stylesheet rather than freezing it here.
      for (const el of cards) el.style.removeProperty('--fp-settle')
      io.disconnect()
      onScreen.clear()
    }

    window.addEventListener('scroll', schedule, { passive: true })
    window.addEventListener('resize', schedule, { passive: true })
    media.addEventListener('change', onPreference)
    schedule()

    return () => {
      if (frame) cancelAnimationFrame(frame)
      io.disconnect()
      window.removeEventListener('scroll', schedule)
      window.removeEventListener('resize', schedule)
      media.removeEventListener('change', onPreference)
      // Leave no inline styles behind for the next route to inherit.
      for (const el of cards) el.style.removeProperty('--fp-settle')
    }
    // Re-scanned per route: App Router swaps the tree without remounting the
    // layout, so a driver keyed only to mount would observe the first page's
    // cards forever and none of the next page's.
  }, [pathname])

  return null
}
