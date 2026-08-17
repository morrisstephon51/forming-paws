import { describe, it, expect } from 'vitest'
import { navLinks, isActive } from '@/lib/nav'

describe('navLinks', () => {
  it('gives the public variant on-page anchors', () => {
    expect(navLinks('public').map((l) => l.href)).toEqual(['#how', '#health', '#roadmap', '#faq'])
  })

  it('gives the member variant real routes', () => {
    expect(navLinks('member').map((l) => l.href)).toEqual([
      '/home',
      '/browse',
      '/matches',
      '/settings',
    ])
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
