import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, act, fireEvent } from '@testing-library/react'
import MemberTabBar from '@/components/MemberTabBar'
import { CAROUSEL_LINKS } from '@/lib/nav'

let mockPathname = '/home'
vi.mock('next/navigation', () => ({ usePathname: () => mockPathname }))

beforeEach(() => {
  mockPathname = '/home'
  vi.useFakeTimers()
  // jsdom has no matchMedia; default to "motion is fine" so rotation runs.
  window.matchMedia = vi.fn().mockReturnValue({ matches: false }) as unknown as typeof matchMedia
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

const advance = (ms: number) => act(() => void vi.advanceTimersByTime(ms))

describe('MemberTabBar', () => {
  it('always shows a Home link, whatever the carousel is doing', () => {
    render(<MemberTabBar />)
    expect(screen.getByRole('link', { name: /home/i })).toHaveAttribute('href', '/home')
  })

  it('keeps Home visible after the carousel has rotated', () => {
    render(<MemberTabBar />)
    advance(5000 * 3)
    expect(screen.getByRole('link', { name: /home/i })).toHaveAttribute('href', '/home')
  })

  it('marks Home as the current page when on /home', () => {
    render(<MemberTabBar />)
    expect(screen.getByRole('link', { name: /home/i })).toHaveAttribute('aria-current', 'page')
  })

  it('rotates to the next shortcut on its own', () => {
    render(<MemberTabBar />)
    const first = CAROUSEL_LINKS[0]
    const second = CAROUSEL_LINKS[1]
    expect(screen.getByRole('link', { name: new RegExp(first.label, 'i') })).toBeInTheDocument()
    advance(5000)
    expect(screen.getByRole('link', { name: new RegExp(second.label, 'i') })).toBeInTheDocument()
  })

  it('stops rotating for good once the member uses a control', () => {
    render(<MemberTabBar />)
    fireEvent.click(screen.getByRole('button', { name: 'Next shortcut' }))
    const afterClick = CAROUSEL_LINKS[1]
    advance(5000 * 4)
    // Still on the slide the member chose — the timer never took it away.
    expect(screen.getByRole('link', { name: new RegExp(afterClick.label, 'i') })).toBeInTheDocument()
  })

  it('wraps backwards from the first slide instead of going negative', () => {
    render(<MemberTabBar />)
    fireEvent.click(screen.getByRole('button', { name: 'Previous shortcut' }))
    const last = CAROUSEL_LINKS[CAROUSEL_LINKS.length - 1]
    expect(screen.getByRole('link', { name: new RegExp(last.label, 'i') })).toBeInTheDocument()
  })

  it('does not rotate at all when the member prefers reduced motion', () => {
    window.matchMedia = vi.fn().mockReturnValue({ matches: true }) as unknown as typeof matchMedia
    render(<MemberTabBar />)
    const first = CAROUSEL_LINKS[0]
    advance(5000 * 5)
    expect(screen.getByRole('link', { name: new RegExp(first.label, 'i') })).toBeInTheDocument()
  })

  it('offers a dot for every destination, so nothing is reachable only by waiting', () => {
    render(<MemberTabBar />)
    for (const link of CAROUSEL_LINKS) {
      expect(screen.getByRole('button', { name: `Show ${link.label}` })).toBeInTheDocument()
    }
  })

  it('jumps straight to a destination when its dot is pressed', () => {
    render(<MemberTabBar />)
    const target = CAROUSEL_LINKS[3]
    fireEvent.click(screen.getByRole('button', { name: `Show ${target.label}` }))
    expect(screen.getByRole('link', { name: new RegExp(target.label, 'i') })).toBeInTheDocument()
  })

  it('starts past the current page rather than offering a link to it', () => {
    mockPathname = '/browse'
    render(<MemberTabBar />)
    const browseIndex = CAROUSEL_LINKS.findIndex((l) => l.href === '/browse')
    const next = CAROUSEL_LINKS[browseIndex + 1]
    expect(screen.getByRole('link', { name: new RegExp(next.label, 'i') })).toBeInTheDocument()
  })

  it('does not announce its own rotation to screen readers', () => {
    const { container } = render(<MemberTabBar />)
    expect(container.querySelector('[aria-live="polite"]')).toBeNull()
    expect(container.querySelector('[aria-live="assertive"]')).toBeNull()
  })
})
