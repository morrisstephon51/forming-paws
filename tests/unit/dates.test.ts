import { describe, it, expect } from 'vitest'
import { formatCalendarDate } from '@/lib/dates'

describe('formatCalendarDate', () => {
  it('formats a Postgres date-only string as a plain human date', () => {
    expect(formatCalendarDate('2023-05-14')).toBe('14 May 2023')
  })

  it('keeps the calendar day the database stored, west of UTC', () => {
    // The app-standard `new Date(x).toLocaleDateString()` — correct for the
    // `timestamptz` columns it is used on — parses a date-only string as UTC
    // midnight, so in America/Chicago (where the members are) it renders the day
    // before. Proven deterministically here, independent of the machine's own
    // timezone, by pinning the zone explicitly:
    const naiveInChicago = new Date('2023-05-14').toLocaleDateString('en-US', {
      timeZone: 'America/Chicago',
    })
    expect(naiveInChicago).toBe('5/13/2023') // the off-by-one we are avoiding

    // The helper never builds a zoned instant, so the day is preserved:
    expect(formatCalendarDate('2023-05-14')).toBe('14 May 2023')
  })

  it('handles the first and last day of a month without drift', () => {
    expect(formatCalendarDate('2024-01-01')).toBe('1 January 2024')
    expect(formatCalendarDate('2024-12-31')).toBe('31 December 2024')
  })

  it('handles a leap day', () => {
    expect(formatCalendarDate('2024-02-29')).toBe('29 February 2024')
  })

  it('reads only the date part of a full ISO timestamp', () => {
    expect(formatCalendarDate('2023-05-14T00:00:00.000Z')).toBe('14 May 2023')
  })

  it('returns an unrecognised value unchanged instead of "Invalid Date"', () => {
    expect(formatCalendarDate('')).toBe('')
    expect(formatCalendarDate('not a date')).toBe('not a date')
    // Impossible components must not silently roll over into a different date.
    expect(formatCalendarDate('2023-13-40')).toBe('2023-13-40')
  })
})
