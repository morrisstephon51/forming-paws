import { describe, it, expect } from 'vitest'
import { isBirthDateNotInFuture } from '@/lib/dogBirthDate'

/**
 * The regression this guards against is a timezone off-by-one. `<input type="date">`
 * hands over a date-only string like "2026-08-15", and the old guard compared
 * `new Date("2026-08-15")` — which is UTC midnight — against the current instant.
 * West of UTC that let a *tomorrow* through: after 7pm in Chicago (UTC-5) "now"
 * is already past midnight UTC, so tomorrow-midnight-UTC sorts before it.
 *
 * `now` is injectable so the boundary is pinned deterministically. Every `now`
 * below is built from *local* components (`new Date(y, m, d, …)`), so the
 * assertions read the same calendar day in any CI timezone.
 */
describe('isBirthDateNotInFuture', () => {
  // Local Aug 14 2026, 8:00pm — the exact evening the old check misbehaved.
  const chicagoEvening = new Date(2026, 7, 14, 20, 0, 0)

  it('rejects tomorrow when the local clock is already evening (the bug)', () => {
    expect(isBirthDateNotInFuture('2026-08-15', chicagoEvening)).toBe(false)
  })

  it('documents that the old UTC-instant comparison accepted that same tomorrow', () => {
    // What NewDogForm used to do, expressed against absolute instants so it is
    // itself timezone-independent: 8pm Chicago == 01:00Z the next day.
    const oldCheck = new Date('2026-08-15') <= new Date('2026-08-15T01:00:00Z')
    expect(oldCheck).toBe(true)
  })

  it('accepts today in the local frame', () => {
    expect(isBirthDateNotInFuture('2026-08-14', chicagoEvening)).toBe(true)
  })

  it('accepts a date in the past', () => {
    expect(isBirthDateNotInFuture('2023-01-15', chicagoEvening)).toBe(true)
  })

  it('rejects a date well into the future', () => {
    expect(isBirthDateNotInFuture('2030-01-01', chicagoEvening)).toBe(false)
  })

  it('accepts a leap day that has already passed', () => {
    expect(isBirthDateNotInFuture('2024-02-29', new Date(2026, 0, 1, 9, 0, 0))).toBe(true)
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
