'use client'

import { useEffect, useLayoutEffect, useRef, useState } from 'react'

const useIsomorphicLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect

/**
 * A number that counts up once, when it scrolls into view.
 *
 * The server renders the *final* value, not zero. A crawler, a reader with
 * JavaScript disabled, or anyone whose hydration fails sees "20", which is the
 * true number — a component that ships `0` in the HTML and relies on script to
 * correct it is publishing a wrong figure and hoping nobody catches it. The
 * zeroing happens on the client, before paint, and only once we know we are
 * both allowed to animate and about to observe the element.
 *
 * Screen readers get the final value directly and never hear the intermediate
 * ticks: the animating digits are aria-hidden and a visually-hidden sibling
 * carries the real number.
 *
 * Reduced motion skips the whole mechanism — the value is simply correct from
 * the first frame, which is the content intact with the motion removed.
 */
export default function CountUp({
  to,
  suffix = '',
  durationMs = 1000,
  className = '',
}: {
  to: number
  suffix?: string
  durationMs?: number
  className?: string
}) {
  const ref = useRef<HTMLSpanElement>(null)
  const [shown, setShown] = useState(to)

  const reduced = () =>
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches

  useIsomorphicLayoutEffect(() => {
    if (reduced()) return
    setShown(0)
  }, [])

  useEffect(() => {
    const el = ref.current
    if (!el || reduced()) return

    let frame = 0
    let start = 0

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return
        observer.disconnect()

        const step = (now: number) => {
          if (!start) start = now
          const t = Math.min(1, (now - start) / durationMs)
          // easeOutCubic: quick off the mark, settles rather than stopping dead.
          setShown(Math.round(to * (1 - Math.pow(1 - t, 3))))
          if (t < 1) frame = requestAnimationFrame(step)
        }

        frame = requestAnimationFrame(step)
      },
      { threshold: 0.6 },
    )

    observer.observe(el)
    return () => {
      observer.disconnect()
      if (frame) cancelAnimationFrame(frame)
    }
  }, [to, durationMs])

  return (
    <span ref={ref} className={className}>
      <span aria-hidden="true" style={{ fontVariantNumeric: 'tabular-nums' }}>
        {shown}
        {suffix}
      </span>
      <span className="sr-only">
        {to}
        {suffix}
      </span>
    </span>
  )
}
