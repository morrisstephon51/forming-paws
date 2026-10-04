import { describe, it, expect } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import DashboardView from '@/components/admin/DashboardView'
import { STATS } from './fixtures/dashboard-stats'

const now = new Date('2026-09-12T20:04:00Z')

describe('DashboardView', () => {
  it('states when figures were generated and how many test accounts were excluded', () => {
    render(<DashboardView stats={STATS} now={now} />)
    expect(screen.getByText('Sep 12, 3:04 PM CDT')).toBeInTheDocument()
    expect(screen.getByText('37')).toBeInTheDocument()
  })

  it('links each queue to the page that works it', () => {
    render(<DashboardView stats={STATS} now={now} />)
    expect(screen.getByRole('link', { name: 'Documents to review' })).toHaveAttribute('href', '/admin/review-queue')
    expect(screen.getByRole('link', { name: 'Open reports' })).toHaveAttribute('href', '/admin/reports')
    expect(screen.getByRole('link', { name: 'Unhandled contact messages' })).toHaveAttribute('href', '/admin/messages')
    expect(screen.getByRole('link', { name: 'Removed dogs' })).toHaveAttribute('href', '/admin/dogs')
  })

  it('shows a non-empty queue with its count and how long the oldest item has waited', () => {
    render(<DashboardView stats={STATS} now={now} />)
    const docsRow = screen.getByRole('link', { name: 'Documents to review' }).closest('li')!
    expect(within(docsRow).getByText('4')).toBeInTheDocument()
    expect(within(docsRow).getByText('Waiting 3 days')).toBeInTheDocument()
  })

  it('shows an empty work queue as nothing waiting, and no removed dogs as none removed', () => {
    render(<DashboardView stats={STATS} now={now} />)
    const reportsRow = screen.getByRole('link', { name: 'Open reports' }).closest('li')!
    expect(within(reportsRow).getByText('Nothing waiting')).toBeInTheDocument()
    const removedRow = screen.getByRole('link', { name: 'Removed dogs' }).closest('li')!
    expect(within(removedRow).getByText('None removed')).toBeInTheDocument()
  })

  it('renders every section heading', () => {
    render(<DashboardView stats={STATS} now={now} />)
    for (const name of ['Needs attention', 'Activation funnel', 'Signups, last 8 weeks', 'Engagement']) {
      expect(screen.getByRole('heading', { name })).toBeInTheDocument()
    }
  })

  it('shows engagement for the last 30 days and all time, with n/a where there is no total', () => {
    render(<DashboardView stats={STATS} now={now} />)
    const table = screen.getByRole('table', { name: /engagement/i })
    const messagesRow = within(table).getByRole('rowheader', { name: 'Messages' }).closest('tr')!
    expect(within(messagesRow).getByText('5')).toBeInTheDocument()
    expect(within(messagesRow).getByText('7')).toBeInTheDocument()
    const activeRow = within(table).getByRole('rowheader', { name: 'Active conversations' }).closest('tr')!
    expect(within(activeRow).getByText('n/a')).toBeInTheDocument()
  })

  it('shows a single failure record and no numbers when figures could not be loaded', () => {
    render(<DashboardView stats={null} now={now} />)
    expect(screen.getByRole('alert')).toHaveTextContent("Couldn't load figures")
    expect(screen.queryByRole('heading', { name: 'Needs attention' })).toBeNull()
    expect(screen.queryByText('13')).toBeNull()
  })
})
