import { describe, it, expect } from 'vitest'
import { isBirthDateNotInFuture } from '@/lib/dogBirthDate'

/**
 * The regression this guards against is a timezone off-by-one. `<input type="date">`
 * hands over a date-only string like "2026-08-15", and the old guard compared
 * `new Date("2026-08-15")` — UTC midnight — against the current instant. West of
 * UTC that let a *tomorrow* through: after 7pm in Chicago "now" is already past
 * midnight UTC, so tomorrow-midnight-UTC sorts before it.
 *
 * The guard now answers "is this after today?" in the members' calendar
 * (America/Chicago) rather than the runtime's, so it holds on a UTC Vercel server
 * as well as in a member's browser. Every `now` below is an absolute instant
 * (`new Date('...Z')`) so the assertions pin that calendar in any CI timezone —
 * the earlier fixtures were built from *local* components, which only ever proved
 * "local in, local out" and never exercised the UTC evening window where the bug
 * actually lives.
 */
describe('isBirthDateNotInFuture', () => {
  // 8:00pm Chicago on Aug 14 2026 (CDT, UTC-5) == 01:00Z Aug 15 — the evening
  // window where a UTC clock has crossed midnight but the member has not.
  const chicagoEvening = new Date('2026-08-15T01:00:00Z')

  it('rejects the member\'s tomorrow during the UTC evening window (the bug)', () => {
    // A UTC runtime reads "now" as Aug 15 and would wave 2026-08-15 through; the
    // member is still on Aug 14, so it is their tomorrow and must be rejected.
    expect(isBirthDateNotInFuture('2026-08-15', chicagoEvening)).toBe(false)
  })

  it('documents that the old UTC-instant comparison accepted that same tomorrow', () => {
    // What NewDogForm used to do, expressed against absolute instants so it is
    // itself timezone-independent: 8pm Chicago == 01:00Z the next day.
    const oldCheck = new Date('2026-08-15') <= new Date('2026-08-15T01:00:00Z')
    expect(oldCheck).toBe(true)
  })

  it('accepts today in the members\' calendar', () => {
    expect(isBirthDateNotInFuture('2026-08-14', chicagoEvening)).toBe(true)
  })

  it('is daylight-saving aware at the winter boundary', () => {
    // January is CST (UTC-6): 8pm Chicago Jan 15 == 02:00Z Jan 16.
    const winterEvening = new Date('2026-01-16T02:00:00Z')
    expect(isBirthDateNotInFuture('2026-01-16', winterEvening)).toBe(false) // member's tomorrow
    expect(isBirthDateNotInFuture('2026-01-15', winterEvening)).toBe(true) // member's today
  })

  it('accepts a date in the past', () => {
    expect(isBirthDateNotInFuture('2023-01-15', chicagoEvening)).toBe(true)
  })

  it('rejects a date well into the future', () => {
    expect(isBirthDateNotInFuture('2030-01-01', chicagoEvening)).toBe(false)
  })

  it('accepts a leap day that has already passed', () => {
    expect(isBirthDateNotInFuture('2024-02-29', new Date('2026-01-01T15:00:00Z'))).toBe(true)
  })

  it('rejects an impossible calendar date', () => {
    expect(isBirthDateNotInFuture('2023-02-30', chicagoEvening)).toBe(false)
    expect(isBirthDateNotInFuture('2023-13-01', chicagoEvening)).toBe(false)
  })

  it('rejects a value that is not a YYYY-MM-DD date', () => {
    expect(isBirthDateNotInFuture('not-a-date', chicagoEvening)).toBe(false)
    expect(isBirthDateNotInFuture('2023/01/15', chicagoEvening)).toBe(false)
    expect(isBirthDateNotInFuture('', chicagoEvening)).toBe(false)
  })

  it('is not fooled by leading or trailing whitespace', () => {
    expect(isBirthDateNotInFuture('  2023-01-15  ', chicagoEvening)).toBe(true)
  })
})
