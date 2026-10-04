import { describe, it, expect } from 'vitest'
import {
  FUNNEL_STEPS,
  barPercent,
  generatedLabel,
  largestDrop,
  pct,
  waitingFor,
  weekLabel,
} from '@/lib/admin/dashboard'
import { STATS } from './fixtures/dashboard-stats'

describe('pct', () => {
  it('rounds to a whole percent', () => {
    expect(pct(11, 13)).toBe('85%')
    expect(pct(13, 13)).toBe('100%')
    expect(pct(0, 13)).toBe('0%')
  })

  it('returns n/a instead of dividing by zero', () => {
    expect(pct(3, 0)).toBe('n/a')
  })
})

describe('waitingFor', () => {
  const now = new Date('2026-09-12T20:04:00Z')

  it('says nothing is waiting when there is no pending upload', () => {
    expect(waitingFor(null, now)).toBe('Nothing waiting')
  })

  it('says under a day for anything younger than 24 hours', () => {
    expect(waitingFor('2026-09-12T08:00:00Z', now)).toBe('Waiting under a day')
  })

  it('uses the singular for exactly one day', () => {
    expect(waitingFor('2026-09-11T08:00:00Z', now)).toBe('Waiting 1 day')
  })

  it('floors to whole days', () => {
    expect(waitingFor(STATS.attention.oldest_pending_uploaded_at, now)).toBe('Waiting 3 days')
  })
})

describe('weekLabel', () => {
  it('formats a week start as a short month and day, independent of server timezone', () => {
    expect(weekLabel('2026-09-07')).toBe('Sep 7')
    expect(weekLabel('2026-08-31')).toBe('Aug 31')
  })
})

describe('generatedLabel', () => {
  it('shows the generation time in Chicago, with ordinary spaces', () => {
    expect(generatedLabel('2026-09-12T20:04:00Z')).toBe('Sep 12, 3:04 PM CDT')
  })
})

describe('barPercent', () => {
  it('scales against the maximum', () => {
    expect(barPercent(5, 10)).toBe(50)
    expect(barPercent(10, 10)).toBe(100)
  })

  it('never returns NaN or a negative width', () => {
    expect(barPercent(5, 0)).toBe(0)
    expect(barPercent(0, 0)).toBe(0)
    expect(barPercent(-1, 10)).toBe(0)
  })

  it('never exceeds 100', () => {
    expect(barPercent(12, 10)).toBe(100)
  })
})

describe('largestDrop', () => {
  it('names the step where the most people were lost, earliest step on a tie', () => {
    // 10 -> 6 (added_dog) and 6 -> 2 (verified_dog) both lose 4.
    expect(largestDrop(STATS.funnel)).toBe('added_dog')
  })

  it('returns null when nobody is lost anywhere', () => {
    expect(
      largestDrop({ signed_up: 2, confirmed: 2, signed_in: 2, added_dog: 2, verified_dog: 2, matched: 2 }),
    ).toBeNull()
  })
})

describe('FUNNEL_STEPS', () => {
  it('lists the six steps in journey order', () => {
    expect(FUNNEL_STEPS.map((s) => s.key)).toEqual([
      'signed_up',
      'confirmed',
      'signed_in',
      'added_dog',
      'verified_dog',
      'matched',
    ])
  })
})
