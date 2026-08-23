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
 */
export default function SageHero() {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const stage = ref.current
    if (!stage) return

    const media = window.matchMedia('(prefers-reduced-motion: reduce)')
    let frame = 0
    let tx = 0
    let ty = 0
    let px = 0
    let py = 0
    let scroll = 0

    const paint = () => {
      frame = 0
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

    const onScroll = () => {
      const r = stage.getBoundingClientRect()
      scroll = Math.min(1, Math.max(0, -r.top / Math.max(1, r.height)))
      schedule()
    }

    const clear = () => {
      for (const p of ['--fp-sage-rx', '--fp-sage-ry', '--fp-sage-y', '--fp-sage-fade']) {
        stage.style.removeProperty(p)
      }
    }

    const bind = () => {
      if (media.matches) {
        window.removeEventListener('pointermove', onPointer)
        window.removeEventListener('scroll', onScroll)
        clear()
        return
      }
      window.addEventListener('pointermove', onPointer, { passive: true })
      window.addEventListener('scroll', onScroll, { passive: true })
      onScroll()
    }

    bind()
    media.addEventListener('change', bind)

    return () => {
      media.removeEventListener('change', bind)
      window.removeEventListener('pointermove', onPointer)
      window.removeEventListener('scroll', onScroll)
      if (frame) cancelAnimationFrame(frame)
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
