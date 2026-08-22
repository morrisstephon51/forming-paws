import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, cleanup } from '@testing-library/react'
import SageHero from '@/components/landing/SageHero'

/**
 * SageHero drives the mascot's tilt and fade from scroll and pointer position.
 * Both of the rules HeroParallax states in its header apply to it, and neither
 * is visible in the rendered output — a version that forces a layout on every
 * scroll frame and keeps its listeners for the life of the page looks exactly
 * like this one on screen. So they are asserted as behaviour.
 */

let fireIntersect: (isIntersecting: boolean) => void
let firePreferenceChange: () => void
let reduced = false

beforeEach(() => {
  reduced = false
  const mediaListeners: (() => void)[] = []
  firePreferenceChange = () => mediaListeners.forEach((l) => l())

  vi.stubGlobal(
    'matchMedia',
    vi.fn(() => ({
      get matches() {
        return reduced
      },
      addEventListener: (_: string, l: () => void) => mediaListeners.push(l),
      removeEventListener: () => {},
    })),
  )

  vi.stubGlobal(
    'IntersectionObserver',
    class {
      constructor(cb: (e: { isIntersecting: boolean }[]) => void) {
        fireIntersect = (isIntersecting) => cb([{ isIntersecting }])
      }
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  )
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

const boundEvents = (spy: ReturnType<typeof vi.spyOn>) =>
  spy.mock.calls.map((c) => c[0]).filter((e) => e === 'scroll' || e === 'pointermove')

describe('SageHero', () => {
  it('binds no scroll or pointer handler until the stage is on screen', () => {
    const add = vi.spyOn(window, 'addEventListener')
    render(<SageHero />)
    expect(boundEvents(add)).toEqual([])

    fireIntersect(true)
    expect(boundEvents(add).sort()).toEqual(['pointermove', 'scroll'])
  })

  it('drops both handlers again once the stage leaves', () => {
    render(<SageHero />)
    fireIntersect(true)

    const remove = vi.spyOn(window, 'removeEventListener')
    fireIntersect(false)
    expect(boundEvents(remove).sort()).toEqual(['pointermove', 'scroll'])
  })

  // The point of the rework. paint() reads window.scrollY, which is free; the
  // rect that would give the same answer forces style and layout, and doing it
  // per event — after paint() has dirtied this subtree with four custom-property
  // writes — is one forced synchronous layout per scroll frame.
  it('measures geometry once on bind, not on every scroll', async () => {
    render(<SageHero />)
    const rect = vi.spyOn(Element.prototype, 'getBoundingClientRect')
    fireIntersect(true)

    const afterBind = rect.mock.calls.length
    expect(afterBind).toBeGreaterThan(0)

    for (let i = 0; i < 20; i++) window.dispatchEvent(new Event('scroll'))
    await new Promise((r) => requestAnimationFrame(() => r(null)))

    expect(rect.mock.calls.length).toBe(afterBind)
  })

  it('re-measures on resize, because cached geometry goes stale', async () => {
    render(<SageHero />)
    fireIntersect(true)
    const rect = vi.spyOn(Element.prototype, 'getBoundingClientRect')

    window.dispatchEvent(new Event('resize'))
    await new Promise((r) => requestAnimationFrame(() => r(null)))

    expect(rect.mock.calls.length).toBeGreaterThan(0)
  })

  it('binds nothing at all when reduced motion is already set', () => {
    reduced = true
    const add = vi.spyOn(window, 'addEventListener')
    render(<SageHero />)
    expect(boundEvents(add)).toEqual([])
  })

  it('tears down and clears the properties when reduced motion is turned on', () => {
    const { container } = render(<SageHero />)
    fireIntersect(true)
    const stage = container.querySelector('.fp-sage-stage') as HTMLElement
    expect(stage.style.getPropertyValue('--fp-sage-fade')).not.toBe('')

    const remove = vi.spyOn(window, 'removeEventListener')
    reduced = true
    firePreferenceChange()

    expect(boundEvents(remove).sort()).toEqual(['pointermove', 'scroll'])
    expect(stage.style.getPropertyValue('--fp-sage-fade')).toBe('')
  })
})
