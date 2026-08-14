import { describe, it, expect } from 'vitest'
import { ageInYears } from '@/lib/age'

// A fixed "now" so birthday boundaries are deterministic. 2026-08-14 is not a
// leap year and neither is 2025, which is what makes the old 365.25-day formula
// undershoot.
const NOW = new Date('2026-08-14T00:00:00Z')

describe('ageInYears', () => {
  it('reads a dog that turned one *today* as 1, not 0 (the old drift bug)', () => {
    // The 365.25-day formula returned Math.floor(365 / 365.25) === 0 here.
    expect(ageInYears('2025-08-14', NOW)).toBe(1)
  })

  it('agrees with the browse_dogs "min age 1" filter on the boundary dog', () => {
    // browse_dogs includes birth_date <= current_date - 1 year, i.e. exactly one
    // year ago is age 1. The label must not say 0 for a dog that filter surfaced.
    const boundary = '2025-08-14'
    expect(ageInYears(boundary, NOW)).toBeGreaterThanOrEqual(1)
  })

  it('is still 0 the day before the first birthday', () => {
    expect(ageInYears('2025-08-15', NOW)).toBe(0)
  })

  it('counts a full multi-year span', () => {
    expect(ageInYears('2020-08-14', NOW)).toBe(6)
  })

  it('does not tick over until the birthday later in the year arrives', () => {
    expect(ageInYears('2020-12-25', NOW)).toBe(5)
  })

  it('handles a Feb-29 birthday in a non-leap year (turns older on Mar 1)', () => {
    expect(ageInYears('2024-02-29', new Date('2026-02-28T12:00:00Z'))).toBe(1)
    expect(ageInYears('2024-02-29', new Date('2026-03-01T12:00:00Z'))).toBe(2)
  })

  it('accepts a full ISO timestamp, not just YYYY-MM-DD', () => {
    expect(ageInYears('2020-08-14T00:00:00.000Z', NOW)).toBe(6)
  })

  it('returns 0 for a future birth date instead of a negative age', () => {
    expect(ageInYears('2030-01-01', NOW)).toBe(0)
  })

  it('returns 0 for an unparseable date instead of NaN', () => {
    expect(ageInYears('not-a-date', NOW)).toBe(0)
    expect(ageInYears('', NOW)).toBe(0)
  })
})
