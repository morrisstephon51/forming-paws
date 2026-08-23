'use client'

import { useEffect, useRef } from 'react'
import Sage from '@/components/mascot/Sage'

/**
 * Sage, standing in front of the meadow.
 *
 * The mascot sits on its own Z-plane above the WebGL scene rather than inside
 * it. That is deliberate: as geometry it would be rasterised, and it would
 * disappear entirely on every path where WebGL declines to run — which includes
 * all of mobile. As an SVG on a near plane it stays a crisp vector at any size
 * and is present whether or not the canvas ever starts.
 *
 * The pop-out is real perspective, not a scale trick. The stage carries the
 * perspective; Sage sits at translateZ(120px) inside it, so a given rotation of
 * the stage swings the mascot further across the screen than the ridges behind
 * it. That difference in travel is the depth cue — the same thing the parallax
 * planes do, except here the browser derives it from the projection.
 *
 * Everything is transform and opacity, driven through custom properties by one
 * rAF-gated handler, and it degrades to a static mascot under reduced motion.
 *
 * The two rules HeroParallax states in its own header apply here for the same
 * reasons, and this file did not follow either of them at first:
 *
 * 1. **Geometry is measured on resize, never per event.** The scroll handler
 *    used to call getBoundingClientRect() in the listener body — outside the rAF
 *    gate, which only ever protected the writes. Since paint() dirties this
 *    subtree with four custom-property writes a frame, the next event's read
 *    flushed style and layout: one forced synchronous layout per scroll frame,
 *    on the one screen where the WebGL loop and HeroParallax are also running.
 * 2. **The listeners only exist while the stage is on screen.** They used to be
 *    bound to the window for the life of the page, so every scroll and every
 *    pointer move anywhere on the document still ran this handler long after
 *    Sage had left.
 */
export default function SageHero() {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const stage = ref.current
    if (!stage) return

    const media = window.matchMedia('(prefers-reduced-motion: reduce)')

    let frame = 0
    let bound = false
    let tx = 0
    let ty = 0
    let px = 0
    let py = 0
    // Page-space geometry, refreshed on resize rather than read per frame.
    let top = 0
    let height = 1

    const measure = () => {
      const rect = stage.getBoundingClientRect()
      top = rect.top + window.scrollY
      height = Math.max(1, rect.height)
    }

    const paint = () => {
      frame = 0
      // 0 as the stage's top meets the viewport top, 1 as its bottom does.
      // scrollY is free to read; the rect that would give the same answer is
      // not, which is the whole reason `top` and `height` are cached.
      const scroll = Math.min(1, Math.max(0, (window.scrollY - top) / height))
      px += (tx - px) * 0.06
      py += (ty - py) * 0.06
      stage.style.setProperty('--fp-sage-rx', `${(-py * 5).toFixed(2)}deg`)
      stage.style.setProperty('--fp-sage-ry', `${(px * 7).toFixed(2)}deg`)
      // Sage leaves faster than the landscape does, which is what sells the
      // separation between them as the reader scrolls away.
      stage.style.setProperty('--fp-sage-y', `${(scroll * -140).toFixed(1)}px`)
      stage.style.setProperty('--fp-sage-fade', String(Math.max(0, 1 - scroll * 1.35)))
      if (Math.abs(tx - px) > 0.002 || Math.abs(ty - py) > 0.002) schedule()
    }

    const schedule = () => {
      if (frame) return
      frame = requestAnimationFrame(paint)
    }

    const onPointer = (e: PointerEvent) => {
      tx = (e.clientX / window.innerWidth) * 2 - 1
      ty = (e.clientY / window.innerHeight) * 2 - 1
      schedule()
    }

    const onScroll = schedule

    const onResize = () => {
      if (!bound) return
      measure()
      schedule()
    }

    const clear = () => {
      for (const p of ['--fp-sage-rx', '--fp-sage-ry', '--fp-sage-y', '--fp-sage-fade']) {
        stage.style.removeProperty(p)
      }
    }

    const bind = () => {
      if (bound || media.matches) return
      bound = true
      window.addEventListener('pointermove', onPointer, { passive: true })
      window.addEventListener('scroll', onScroll, { passive: true })
      measure()
      paint()
    }

    const unbind = () => {
      if (!bound) return
      bound = false
      window.removeEventListener('pointermove', onPointer)
      window.removeEventListener('scroll', onScroll)
      if (frame) {
        cancelAnimationFrame(frame)
        frame = 0
      }
    }

    // Bind only while the stage is actually in view.
    const observer = new IntersectionObserver(
      ([entry]) => (entry.isIntersecting ? bind() : unbind()),
      { threshold: 0 },
    )

    const onPreference = () => {
      if (media.matches) {
        observer.disconnect()
        unbind()
        clear()
      } else {
        observer.disconnect()
        observer.observe(stage)
      }
    }

    window.addEventListener('resize', onResize, { passive: true })
    media.addEventListener('change', onPreference)
    if (!media.matches) observer.observe(stage)

    return () => {
      observer.disconnect()
      media.removeEventListener('change', onPreference)
      window.removeEventListener('resize', onResize)
      unbind()
      clear()
    }
  }, [])

  return (
    <div ref={ref} className="fp-sage-stage" aria-hidden="true">
      <div className="fp-sage-plane">
        {/*
          Sized in vmin so the mascot keeps its share of the viewport rather
          than its share of the width — a wide, short window would otherwise
          push it past the bottom of the splash.
        */}
        <Sage mood="happy" size={340} className="fp-sage-mark" />
      </div>
    </div>
  )
}
