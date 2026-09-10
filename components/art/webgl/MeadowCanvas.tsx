'use client'

import { useEffect, useRef, useState } from 'react'
import type { MeadowHandle } from './meadow'

/**
 * Mounts the WebGL meadow, and is mostly a set of refusals.
 *
 * three.js is ~150KB gzipped. Putting that anywhere near first paint would undo
 * the LCP work this project just did, so nothing here runs early:
 *
 *   1. The module is a dynamic import(), so three is its own chunk and is not in
 *      the landing page's initial JavaScript.
 *   2. The import does not even start until the browser is idle — after the LCP
 *      image has painted. requestIdleCallback where it exists, a timeout where
 *      it does not (Safari).
 *   3. The render loop only runs while the hero is on screen AND the tab is
 *      visible. Scrolling past the hero stops it; switching tabs stops it.
 *
 * It also refuses to start at all when it should not: no WebGL context, a
 * save-data or low-core device, or a reduced-motion preference that we honour by
 * rendering a single static frame rather than a loop.
 *
 * Every refusal path is invisible, because the thing it declines to replace is
 * already on screen: the sky is a DOM <img> and the ridges are the original SVG
 * planes. The canvas fades in over them only once it has a frame to show, and
 * only then are the SVG ridges faded out. Nothing ever blinks.
 */
export default function MeadowCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const handleRef = useRef<MeadowHandle | null>(null)
  const [live, setLive] = useState(false)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    let cancelled = false
    let cleanup: (() => void) | null = null

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    function supported() {
      // Cheap probes first, then an actual context — some devices advertise
      // WebGL and then fail to give you one.
      const nav = navigator as Navigator & {
        connection?: { saveData?: boolean }
        hardwareConcurrency?: number
      }
      if (nav.connection?.saveData) return false
      if ((nav.hardwareConcurrency ?? 8) <= 2) return false
      // Not below md. On a phone the hero stacks to ~1200px tall, which puts the
      // ridges far under the fold — measured, the initial viewport shows only
      // sky. Downloading 137KB of three.js to render something the reader has to
      // scroll a full screen to reach is a bad trade, and the SVG planes it
      // falls back to look the same there anyway. 768px matches the breakpoint
      // the sticky step deck already uses.
      if (window.matchMedia('(max-width: 767px)').matches) return false
      try {
        const probe = document.createElement('canvas')
        return Boolean(
          probe.getContext('webgl2') ||
            probe.getContext('webgl') ||
            probe.getContext('experimental-webgl'),
        )
      } catch {
        return false
      }
    }

    async function boot() {
      if (cancelled || !supported()) return

      const { createMeadow } = await import('./meadow')
      if (cancelled || !canvasRef.current) return

      let handle: MeadowHandle
      try {
        handle = createMeadow(canvasRef.current, reduced)
      } catch {
        return // context creation can still throw; the fallback is already visible
      }
      handleRef.current = handle
      handle.resize()

      const hero = canvasRef.current.closest<HTMLElement>('[data-fp-hero]')

      function progress() {
        if (!hero) return 0
        const r = hero.getBoundingClientRect()
        return Math.min(1, Math.max(0, -r.top / Math.max(1, r.height)))
      }

      handle.setScroll(progress())
      handle.render()
      setLive(true)
      if (hero) hero.dataset.fpWebgl = 'on'

      if (reduced) {
        // One frame, then nothing. The scene is still 3D; it just holds still.
        const onResizeStatic = () => {
          handle.resize()
          handle.setScroll(progress())
          handle.render()
        }
        window.addEventListener('resize', onResizeStatic, { passive: true })
        cleanup = () => {
          window.removeEventListener('resize', onResizeStatic)
          handle.dispose()
        }
        return
      }

      let frame = 0
      const onScroll = () => {
        if (frame) return
        frame = requestAnimationFrame(() => {
          frame = 0
          handle.setScroll(progress())
        })
      }
      const onPointer = (e: PointerEvent) => {
        handle.setPointer(
          (e.clientX / window.innerWidth) * 2 - 1,
          (e.clientY / window.innerHeight) * 2 - 1,
        )
      }
      const onResize = () => handle.resize()

      // Both conditions live in one place now. Previously visibilitychange
      // consulted only document.hidden, so returning to the tab after
      // scrolling past the hero restarted a 60fps loop for an off-screen
      // canvas, and nothing stopped it until the hero crossed the edge again.
      let onScreen = true
      const settle = () => (onScreen && !document.hidden ? handle.start() : handle.stop())
      const onVisibility = settle

      window.addEventListener('scroll', onScroll, { passive: true })
      window.addEventListener('pointermove', onPointer, { passive: true })
      window.addEventListener('resize', onResize, { passive: true })
      document.addEventListener('visibilitychange', onVisibility)

      // Only render while the hero is actually on screen.
      const io = new IntersectionObserver(
        ([entry]) => {
          onScreen = entry.isIntersecting
          settle()
        },
        { threshold: 0 },
      )
      if (hero) io.observe(hero)

      // preventDefault() asks the browser to restore the context, so something
      // must listen for that. Without a restored handler one GPU reset left the
      // canvas blank permanently AND the SVG ridges faded out behind it, since
      // is-live and data-fp-webgl were cleared and never set again.
      const onLost = (e: Event) => {
        e.preventDefault()
        handle.stop()
        setLive(false)
        if (hero) delete hero.dataset.fpWebgl
      }
      const onRestored = () => {
        handle.resize()
        handle.setScroll(progress())
        handle.render()
        setLive(true)
        if (hero) hero.dataset.fpWebgl = 'on'
        settle()
      }
      canvasRef.current.addEventListener('webglcontextlost', onLost)
      canvasRef.current.addEventListener('webglcontextrestored', onRestored)

      cleanup = () => {
        io.disconnect()
        window.removeEventListener('scroll', onScroll)
        window.removeEventListener('pointermove', onPointer)
        window.removeEventListener('resize', onResize)
        document.removeEventListener('visibilitychange', onVisibility)
        canvasRef.current?.removeEventListener('webglcontextlost', onLost)
        canvasRef.current?.removeEventListener('webglcontextrestored', onRestored)
        if (frame) cancelAnimationFrame(frame)
        handle.dispose()
        if (hero) delete hero.dataset.fpWebgl
      }
    }

    // Wait for idle. This is the line that keeps three.js off the critical path.
    const idle = window as Window & {
      requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number
      cancelIdleCallback?: (id: number) => void
    }
    let idleId = 0
    let timeoutId = 0
    if (idle.requestIdleCallback) {
      idleId = idle.requestIdleCallback(() => void boot(), { timeout: 2500 })
    } else {
      timeoutId = window.setTimeout(() => void boot(), 1200)
    }

    return () => {
      cancelled = true
      if (idleId && idle.cancelIdleCallback) idle.cancelIdleCallback(idleId)
      if (timeoutId) clearTimeout(timeoutId)
      cleanup?.()
      handleRef.current = null
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className={`fp-meadow-canvas absolute inset-0 h-full w-full ${live ? 'is-live' : ''}`}
    />
  )
}
