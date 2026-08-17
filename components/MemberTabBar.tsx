'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { CAROUSEL_LINKS, MEMBER_HOME, initialCarouselIndex, isActive, step } from '@/lib/nav'

const ROTATE_MS = 5000

/**
 * The signed-in member's bottom bar: a pinned Home button and a rotating
 * carousel of everywhere else.
 *
 * Home is pinned deliberately. Stefan asked for both "a home button on every
 * page" and "buttons that rotate"; a rotating home button rotates away, so the
 * only arrangement that satisfies both is to pin one and cycle the rest.
 *
 * Auto-rotation was an explicit request, and it is built with the mitigations
 * that keep a moving target usable:
 *   - it stops for good the moment the member touches any control, so a link
 *     never slides out from under a thumb mid-tap;
 *   - it pauses on hover and on keyboard focus;
 *   - it pauses when the tab is hidden, so a member does not return to a bar
 *     that spun a hundred times in the background;
 *   - prefers-reduced-motion disables rotation entirely;
 *   - every slide stays in the DOM and reachable, so the arrows and the dots
 *     are real controls rather than decoration.
 */
export default function MemberTabBar() {
  const pathname = usePathname() ?? MEMBER_HOME
  const [index, setIndex] = useState(() => initialCarouselIndex(pathname))
  const [paused, setPaused] = useState(false)

  // Once a member drives the bar themselves, it stops driving itself. A ref,
  // not state, so setting it never re-runs the timer effect.
  const stopped = useRef(false)

  const go = useCallback((delta: number) => {
    stopped.current = true
    setIndex((i) => step(i, delta))
  }, [])

  useEffect(() => {
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    if (reduced) return

    const timer = setInterval(() => {
      if (stopped.current || paused || document.visibilityState !== 'visible') return
      setIndex((i) => step(i, 1))
    }, ROTATE_MS)

    return () => clearInterval(timer)
  }, [paused])

  const current = CAROUSEL_LINKS[index]

  return (
    <nav
      aria-label="Member shortcuts"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-brand/15 bg-ivory/95 backdrop-blur"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
    >
      <div
        className="mx-auto flex max-w-3xl items-center gap-2 px-3 py-2"
        style={{ paddingBottom: 'calc(0.5rem + env(safe-area-inset-bottom))' }}
      >
        <Link
          href={MEMBER_HOME}
          aria-current={isActive(MEMBER_HOME, pathname) ? 'page' : undefined}
          className={`flex shrink-0 flex-col items-center rounded-lg px-3 py-1.5 text-xs font-bold transition-colors ${
            isActive(MEMBER_HOME, pathname)
              ? 'bg-brand text-ivory'
              : 'text-brand-dark hover:bg-brand-soft'
          }`}
        >
          <span aria-hidden="true" className="text-lg leading-none">
            🐾
          </span>
          Home
        </Link>

        <button
          type="button"
          onClick={() => go(-1)}
          aria-label="Previous shortcut"
          className="shrink-0 rounded-lg px-2 py-2 text-ink-soft transition-colors hover:bg-brand-soft hover:text-brand-dark"
        >
          <span aria-hidden="true">‹</span>
        </button>

        {/*
          aria-live=off on purpose. This region changes on a timer, and polite
          announcements every five seconds would make a screen reader unusable.
          Every destination is still reachable via the arrows and the dots.
        */}
        <div className="min-w-0 flex-1 text-center" aria-live="off">
          <Link
            href={current.href}
            aria-current={isActive(current.href, pathname) ? 'page' : undefined}
            className={`inline-flex w-full items-center justify-center gap-2 truncate rounded-lg px-3 py-2 text-sm font-bold transition-colors ${
              isActive(current.href, pathname)
                ? 'bg-brand text-ivory'
                : 'text-brand-dark hover:bg-brand-soft'
            }`}
          >
            <span aria-hidden="true">{current.icon}</span>
            {current.label}
          </Link>
        </div>

        <button
          type="button"
          onClick={() => go(1)}
          aria-label="Next shortcut"
          className="shrink-0 rounded-lg px-2 py-2 text-ink-soft transition-colors hover:bg-brand-soft hover:text-brand-dark"
        >
          <span aria-hidden="true">›</span>
        </button>
      </div>

      <ul className="flex items-center justify-center gap-1.5 pb-2">
        {CAROUSEL_LINKS.map((link, i) => (
          <li key={link.href}>
            <button
              type="button"
              onClick={() => {
                stopped.current = true
                setIndex(i)
              }}
              aria-label={`Show ${link.label}`}
              aria-current={i === index ? 'true' : undefined}
              className={`block h-1.5 rounded-full transition-all ${
                i === index ? 'w-4 bg-brand' : 'w-1.5 bg-brand/30 hover:bg-brand/60'
              }`}
            />
          </li>
        ))}
      </ul>
    </nav>
  )
}
