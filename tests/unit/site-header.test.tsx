import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import SiteHeader from '@/components/SiteHeader'

describe('SiteHeader', () => {
  it('shows marketing anchors and a join CTA in the public variant', () => {
    render(<SiteHeader variant="public" />)
    // Homepage-absolute so it works from every page the header now renders on.
    expect(screen.getByRole('link', { name: 'How It Works' })).toHaveAttribute('href', '/#how')
    expect(screen.getByRole('link', { name: /join/i })).toHaveAttribute('href', '/signup')
  })

  it('shows member routes in the member variant', () => {
    render(<SiteHeader variant="member" pathname="/home" />)
    expect(screen.getByRole('link', { name: 'Browse' })).toHaveAttribute('href', '/browse')
  })

  it('hides the unread badge at zero', () => {
    render(<SiteHeader variant="member" pathname="/home" unreadCount={0} />)
    expect(screen.queryByTestId('unread-badge')).toBeNull()
  })

  it('announces the unread count as text, not a bare dot', () => {
    render(<SiteHeader variant="member" pathname="/home" unreadCount={3} />)
    expect(screen.getByTestId('unread-badge')).toHaveTextContent('3 unread')
  })

  it('marks the current section active, including nested routes', () => {
    render(<SiteHeader variant="member" pathname="/matches/abc" />)
    expect(screen.getByRole('link', { name: 'Matches' })).toHaveAttribute('aria-current', 'page')
  })

  it('does not mark a sibling route active', () => {
    render(<SiteHeader variant="member" pathname="/matches/abc" />)
    expect(screen.getByRole('link', { name: 'Browse' })).not.toHaveAttribute('aria-current')
  })

  // Sign-out must never be reachable by GET: a link would let any crawler or
  // link-prefetching browser end the member's session for them.
  it('signs out via a POST form, not a link', () => {
    const { container } = render(<SiteHeader variant="member" pathname="/home" />)
    const form = container.querySelector('form[action="/auth/signout"]')
    expect(form).not.toBeNull()
    expect(form).toHaveAttribute('method', 'post')
    expect(screen.getByRole('button', { name: 'Sign out' })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Sign out' })).toBeNull()
  })

  it('offers no sign-out on the public variant', () => {
    const { container } = render(<SiteHeader variant="public" />)
    expect(container.querySelector('form[action="/auth/signout"]')).toBeNull()
  })
})
