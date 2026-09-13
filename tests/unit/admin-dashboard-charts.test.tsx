import { describe, it, expect } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import FunnelTable from '@/components/admin/FunnelTable'
import SignupColumns from '@/components/admin/SignupColumns'
import { STATS } from './fixtures/dashboard-stats'

describe('FunnelTable', () => {
  it('is a real table with six step rows in journey order', () => {
    render(<FunnelTable funnel={STATS.funnel} />)
    const table = screen.getByRole('table', { name: /activation funnel/i })
    const rowHeaders = within(table).getAllByRole('rowheader')
    expect(rowHeaders.map((h) => h.textContent)).toEqual([
      'Signed up',
      'Confirmed email',
      'Signed in',
      'Added a dogLargest drop',
      'Has a verified dog',
      'Matched',
    ])
  })

  it('shows each count and its share of the previous step', () => {
    render(<FunnelTable funnel={STATS.funnel} />)
    const confirmedRow = screen.getByRole('rowheader', { name: 'Confirmed email' }).closest('tr')!
    expect(within(confirmedRow).getByText('11')).toBeInTheDocument()
    expect(within(confirmedRow).getByText('85%')).toBeInTheDocument()
  })

  it('shows n/a rather than dividing by a zero previous step', () => {
    render(
      <FunnelTable
        funnel={{ signed_up: 0, confirmed: 0, signed_in: 0, added_dog: 0, verified_dog: 0, matched: 0 }}
      />,
    )
    const confirmedRow = screen.getByRole('rowheader', { name: 'Confirmed email' }).closest('tr')!
    expect(within(confirmedRow).getByText('n/a')).toBeInTheDocument()
  })

  it('sizes each bar as a share of sign-ups', () => {
    render(<FunnelTable funnel={STATS.funnel} />)
    const bars = screen.getAllByTestId('funnel-bar')
    expect(bars).toHaveLength(6)
    expect(bars[0]).toHaveStyle({ width: '100%' })
    expect(bars[5].style.width).toBe(`${(1 / 13) * 100}%`)
  })
})

describe('SignupColumns', () => {
  it('renders eight keyboard-focusable columns, each named with its week and count', () => {
    render(<SignupColumns weeks={STATS.signups_by_week} />)
    const columns = screen.getAllByTestId('signup-column')
    expect(columns).toHaveLength(8)
    for (const column of columns) expect(column).toHaveAttribute('tabindex', '0')
    expect(columns[4]).toHaveAccessibleName('Week of Aug 17: 5 signups')
    expect(columns[7]).toHaveAccessibleName('Week of Sep 7: 1 signup')
  })

  it('labels only the current week and the peak week on the cap', () => {
    render(<SignupColumns weeks={STATS.signups_by_week} />)
    const caps = screen.getAllByTestId('cap-label')
    expect(caps.map((c) => c.textContent)).toEqual(['5', '1'])
  })

  it('still labels the current week when every week is zero, and draws no peak', () => {
    const empty = STATS.signups_by_week.map((w) => ({ ...w, signups: 0 }))
    render(<SignupColumns weeks={empty} />)
    expect(screen.getAllByTestId('cap-label').map((c) => c.textContent)).toEqual(['0'])
  })

  it('has a table twin listing every week with its count', () => {
    render(<SignupColumns weeks={STATS.signups_by_week} />)
    const table = screen.getByRole('table', { name: /signups per week/i, hidden: true })
    const rows = within(table).getAllByRole('row', { hidden: true }).slice(1)
    expect(rows).toHaveLength(8)
    expect(within(rows[1]).getByText('Jul 27')).toBeInTheDocument()
    expect(within(rows[1]).getByText('0')).toBeInTheDocument()
  })
})
