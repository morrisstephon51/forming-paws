'use client'

import { useEffect, useRef } from 'react'
import type { ElementType, ReactNode } from 'react'

/**
 * A card that sits in real 3D space rather than flat on the page.
 *
 * Two drivers, and they are deliberately different:
 *
 *   1. Scroll — every device. A card enters the viewport rotated back on its X
 *      axis and settles to flat as it rises. This is the half that gives the
 *      page depth on a phone, where the WebGL meadow declines to run at all.
 *   2. Pointer — hover-capable devices only. A small lean toward the cursor on
 *      both axes, which is what makes the surface read as a physical panel
 *      instead of an animated div.
 *
 * Why CSS transforms and not WebGL: the hero already owns the only GPU context
 * on this page, and a second one to tilt eight cards would be indefensible. A
 * rotate on a promoted layer costs a composite and nothing else — no layout, no
 * paint, no 150KB of library.
 *
 * The transform is written to a custom property rather than to `style.transform`
 * so that the CSS owns the composition. That matters because the reduced-motion
 * block in globals.css can then neutralise the whole effect by redefining the
 * property, without this file having to know it happened, and without leaving a
 * stale inline transform behind on the element.
 *
 * Depth here is rotation and translation only. It never adds a shadow: this
 * system's rule is that elevation comes from the surface ramp, and a drop shadow
 * under a warm card on warm paper reads as grime. A tilted panel is legible as
 * near or far because its edges converge, which is what perspective is for.
 */
export default function Tilt3D({
  as: Tag = 'div',
  children,
  className = '',
  /** Degrees the card is rotated back when it first enters the viewport. */
  entry = 8,
  /** Maximum degrees of lean toward the pointer, per axis. */
  lean = 5,
  /** Pushes the card back in Z at rest, so siblings can sit in front of it. */
  depth = 0,
}: {
  as?: ElementType
  children: ReactNode
  className?: string
  entry?: number
  lean?: number
  depth?: number
}) {
  const ref = useRef<HTMLElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    const media = window.matchMedia('(prefers-reduced-motion: reduce)')
    const canHover = window.matchMedia('(hover: hover) and (pointer: fine)')

    // Scroll progress and pointer lean are tracked separately and composed on
    // write. Keeping them apart is what lets the pointer listener detach on a
    // touch device without the scroll driver losing its state.
    let settle = 0 // 0 = fully rotated back, 1 = flat
    let leanX = 0
    let leanY = 0
    let frame = 0
    /*
     * The card's box, cached.
     *
     * The first version read getBoundingClientRect() inside the pointermove
     * handler. That is a forced synchronous layout, and with seven of these on
     * the page it ran seven times per mouse move — several hundred layouts a
     * second, for a number that only changes when the page scrolls or resizes.
     * Both of those already have handlers, so the rect is measured there and
     * pointermove does arithmetic on a cached value instead.
     */
    let box = { cx: 0, cy: 0, hw: 1, hh: 1 }

    function write() {
      frame = 0
      if (!el) return
      if (media.matches) {
        el.style.removeProperty('--fp-tilt')
        return
      }
      const rx = (1 - settle) * entry + leanX
      const ry = leanY
      el.style.setProperty(
        '--fp-tilt',
        `perspective(var(--fp-persp, 1100px)) translate3d(0, 0, ${depth}px) rotateX(${rx.toFixed(2)}deg) rotateY(${ry.toFixed(2)}deg)`,
      )
    }

    function schedule() {
      if (frame || media.matches) return
      frame = requestAnimationFrame(write)
    }

    function measure() {
      if (!el) return
      const r = el.getBoundingClientRect()
      const vh = window.innerHeight || 1
      // Settled once the card's top has travelled into the upper two-thirds of
      // the viewport. Using the top edge rather than the centre means tall cards
      // do not stay tilted long after the reader has started on their text.
      const raw = (vh - r.top) / (vh * 0.66)
      settle = Math.min(1, Math.max(0, raw))
      // The one place the rect is read. Half-extents are stored rather than
      // edges because that is what the pointer maths actually wants, and a
      // guard against zero keeps a display:none card from dividing by it.
      box = {
        cx: r.left + r.width / 2,
        cy: r.top + r.height / 2,
        hw: Math.max(1, r.width / 2),
        hh: Math.max(1, r.height / 2),
      }
      schedule()
    }

    function onPointer(e: PointerEvent) {
      if (!el || media.matches) return
      // Ignore a cursor that is nowhere near this card. Without this every card
      // on the page leans toward a pointer at the far edge of the window, which
      // reads as the whole page wobbling rather than as one panel responding.
      const dx = (e.clientX - box.cx) / box.hw
      const dy = (e.clientY - box.cy) / box.hh
      if (Math.abs(dx) > 1.6 || Math.abs(dy) > 1.6) {
        if (leanX === 0 && leanY === 0) return
        leanX = 0
        leanY = 0
        schedule()
        return
      }
      leanX = -dy * lean
      leanY = dx * lean
      schedule()
    }

    function onPreference() {
      if (media.matches) {
        if (frame) cancelAnimationFrame(frame)
        frame = 0
        el?.style.removeProperty('--fp-tilt')
      } else {
        measure()
      }
    }

    measure()
    window.addEventListener('scroll', measure, { passive: true })
    window.addEventListener('resize', measure, { passive: true })
    if (canHover.matches) window.addEventListener('pointermove', onPointer, { passive: true })
    media.addEventListener('change', onPreference)

    return () => {
      if (frame) cancelAnimationFrame(frame)
      window.removeEventListener('scroll', measure)
      window.removeEventListener('resize', measure)
      window.removeEventListener('pointermove', onPointer)
      media.removeEventListener('change', onPreference)
    }
  }, [entry, lean, depth])

  return (
    <Tag ref={ref} className={`fp-tilt ${className}`}>
      {children}
    </Tag>
  )
}
