'use client'

import { useEffect, useLayoutEffect, useRef, type ReactNode } from 'react'

/**
 * useLayoutEffect warns when React renders on the server; useEffect is the
 * correct no-op there because there is no paint to get ahead of.
 */
const useIsomorphicLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect

/**
 * A fade-and-rise that plays when a section scrolls into view.
 *
 * Three constraints shaped this, and each rules out the obvious implementation:
 *
 * 1. Content must survive without JavaScript. So the server renders children
 *    with no hiding styles at all, and the hidden class is added on the client
 *    immediately before the first paint. A `initial={{ opacity: 0 }}` on a
 *    server-rendered motion component would ship opacity:0 in the HTML and leave
 *    a JS-less visitor staring at an empty page.
 *
 * 2. No scroll listeners. IntersectionObserver fires off the main thread's
 *    compositor bookkeeping rather than on every scroll tick, so a long page
 *    with thirty reveals still costs nothing while scrolling.
 *
 * 3. Transform and opacity only. Both are compositor-only properties: they
 *    never trigger layout or paint, which is what keeps this at 60fps on a
 *    mid-range Android. Animating height, top, or margin here would not.
 *
 * Reduced motion is checked before the element is ever hidden, so those visitors
 * get static, fully-visible content and the observer is never even created.
 * globals.css enforces the same thing again in CSS as an independent backstop.
 */
export default function Reveal({
  children,
  delayMs = 0,
  className = '',
  id,
  as: Tag = 'div',
}: {
  children: ReactNode
  /** Stagger for siblings. Keep it under ~200ms; beyond that it reads as lag. */
  delayMs?: number
  className?: string
  /** Passed through so wrapping a section cannot silently drop its anchor. */
  id?: string
  as?: 'div' | 'section' | 'li'
}) {
  const ref = useRef<HTMLElement>(null)

  // Before paint, so the element is never seen in its visible state and then
  // snapped away — a plain useEffect here produces a flash on every reveal.
  useIsomorphicLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    el.classList.add('fp-reveal')
  }, [])

  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue
          const target = entry.target as HTMLElement
          target.style.transitionDelay = `${delayMs}ms`
          target.classList.add('fp-reveal-in')
          // One-shot. Re-animating a section every time it re-enters turns a
          // long page into a flicker gallery on the way back up.
          observer.unobserve(target)
        }
      },
      // A little before the edge, so the motion resolves as the section arrives
      // rather than starting once the reader is already looking at it.
      { rootMargin: '0px 0px -12% 0px', threshold: 0.05 },
    )

    observer.observe(el)
    return () => observer.disconnect()
  }, [delayMs])

  return (
    <Tag ref={ref as never} id={id} className={className}>
      {children}
    </Tag>
  )
}
