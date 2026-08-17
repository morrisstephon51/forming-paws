import { describe, it, expect } from 'vitest'
import {
  navLinks,
  isActive,
  CAROUSEL_LINKS,
  MEMBER_HOME,
  initialCarouselIndex,
  step,
} from '@/lib/nav'

describe('navLinks', () => {
  it('gives the public variant its anchors and public pages', () => {
    expect(navLinks('public').map((l) => l.href)).toEqual([
      '#how',
      '#health',
      '/education',
      '/about',
    ])
  })

  it('gives the member variant real routes, starting at home', () => {
    expect(navLinks('member').map((l) => l.href)).toEqual([
      '/home',
      '/browse',
      '/matches',
      '/education',
      '/settings',
    ])
  })
})

describe('carousel model', () => {
  // The bar pins Home and rotates the rest. If Home ever joined the rotation it
  // would rotate away, and "a home button on every page" would stop being true.
  it('never puts Home in the rotation', () => {
    expect(CAROUSEL_LINKS.map((l) => l.href)).not.toContain(MEMBER_HOME)
  })

  it('gives every slide a label and an icon', () => {
    for (const link of CAROUSEL_LINKS) {
      expect(link.label.length).toBeGreaterThan(0)
      expect(link.icon).toBeTruthy()
    }
  })

  it('has no duplicate destinations', () => {
    const hrefs = CAROUSEL_LINKS.map((l) => l.href)
    expect(new Set(hrefs).size).toBe(hrefs.length)
  })

  it('starts past the current page rather than linking to where you already are', () => {
    const browseIndex = CAROUSEL_LINKS.findIndex((l) => l.href === '/browse')
    expect(initialCarouselIndex('/browse')).toBe(browseIndex + 1)
  })

  it('starts at the first slide on a page that is not in the carousel', () => {
    expect(initialCarouselIndex('/privacy')).toBe(0)
  })

  it('wraps to the first slide when the current page is last', () => {
    const last = CAROUSEL_LINKS[CAROUSEL_LINKS.length - 1]
    expect(initialCarouselIndex(last.href)).toBe(0)
  })
})

describe('step', () => {
  it('advances', () => {
    expect(step(0, 1, 6)).toBe(1)
  })

  it('wraps forward past the end', () => {
    expect(step(5, 1, 6)).toBe(0)
  })

  it('wraps backward past the start — the case a plain % gets wrong', () => {
    expect(step(0, -1, 6)).toBe(5)
  })

  it('never returns a negative index', () => {
    for (let i = 0; i < 6; i++) expect(step(i, -3, 6)).toBeGreaterThanOrEqual(0)
  })
})

describe('isActive', () => {
  it('matches an exact route', () => {
    expect(isActive('/browse', '/browse')).toBe(true)
  })

  it('matches a nested route', () => {
    expect(isActive('/matches', '/matches/abc-123')).toBe(true)
  })

  it('does not treat a prefix of a longer segment as nested', () => {
    expect(isActive('/match', '/matches')).toBe(false)
  })

  it('never marks an anchor active', () => {
    expect(isActive('#how', '/')).toBe(false)
  })
})
