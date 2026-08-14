import { describe, it, expect } from 'vitest'
import { formatCalendarDate, isFutureCalendarDate, todayInMemberZone } from '@/lib/dates'

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

describe('todayInMemberZone', () => {
  it('returns the members\' calendar day, not the server\'s, at the UTC boundary', () => {
    // 8:00pm in Chicago on Aug 14 is already 01:00 on Aug 15 in UTC. A server in
    // UTC (Vercel) would call it the 15th; the members are still on the 14th.
    const eveningChicago = new Date('2026-08-15T01:00:00Z')
    expect(todayInMemberZone(eveningChicago)).toBe('2026-08-14')
  })

  it('applies the daylight-saving offset (CST vs CDT) automatically', () => {
    // January is CST (UTC-6): 8:00pm Chicago on Jan 15 is 02:00 Jan 16 in UTC.
    const winterEvening = new Date('2026-01-16T02:00:00Z')
    expect(todayInMemberZone(winterEvening)).toBe('2026-01-15')
  })
})

describe('isFutureCalendarDate', () => {
  // 8:00pm Chicago on Aug 14 2026 == 01:00Z on Aug 15 — the evening window where
  // the server clock has crossed midnight UTC but the member has not. Pinned as
  // an absolute instant so the assertions hold in any CI timezone.
  const chicagoEvening = new Date('2026-08-15T01:00:00Z')

  it('rejects a member\'s local "tomorrow" during the evening window (the bug)', () => {
    expect(isFutureCalendarDate('2026-08-15', chicagoEvening)).toBe(true)
  })

  it('documents that the old UTC-instant comparison accepted that same tomorrow', () => {
    // What the route used to do, expressed against absolute instants so it is
    // itself timezone-independent. `<= now` was "not in the future"; it was true,
    // so the future date slipped through.
    const oldCheckSaysNotFuture = new Date('2026-08-15') <= new Date('2026-08-15T01:00:00Z')
    expect(oldCheckSaysNotFuture).toBe(true)
  })

  it('accepts today in the members\' calendar', () => {
    expect(isFutureCalendarDate('2026-08-14', chicagoEvening)).toBe(false)
  })

  it('accepts a date in the past', () => {
    expect(isFutureCalendarDate('2020-01-01', chicagoEvening)).toBe(false)
  })

  it('rejects a date well into the future', () => {
    expect(isFutureCalendarDate('2030-01-01', chicagoEvening)).toBe(true)
  })

  it('is daylight-saving aware at the winter boundary', () => {
    const winterEvening = new Date('2026-01-16T02:00:00Z') // 8pm Jan 15 Chicago (CST)
    expect(isFutureCalendarDate('2026-01-16', winterEvening)).toBe(true) // member's tomorrow
    expect(isFutureCalendarDate('2026-01-15', winterEvening)).toBe(false) // member's today
  })

  it('treats a value that is not a plain calendar date as not-in-the-future', () => {
    // The route rejects these on its own NaN/empty guard; here we only assert the
    // helper never throws and never reports a malformed value as a future date.
    expect(isFutureCalendarDate('', chicagoEvening)).toBe(false)
    expect(isFutureCalendarDate('not-a-date', chicagoEvening)).toBe(false)
    expect(isFutureCalendarDate('2026/08/15', chicagoEvening)).toBe(false)
  })
})
