import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import SiteHeader from '@/components/SiteHeader'

describe('SiteHeader', () => {
  it('shows marketing anchors and a join CTA in the public variant', () => {
    render(<SiteHeader variant="public" />)
    expect(screen.getByRole('link', { name: 'How It Works' })).toHaveAttribute('href', '#how')
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
})
