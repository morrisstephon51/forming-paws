import { describe, it, expect } from 'vitest'
import {
  displayNameSchema,
  emailSchema,
  notificationPrefsSchema,
  isDeleteConfirmed,
  purgeDateFrom,
  PURGE_GRACE_DAYS,
  DELETE_CONFIRMATION,
} from '@/lib/validators/settings'

describe('displayNameSchema', () => {
  it('accepts an ordinary name', () => {
    expect(displayNameSchema.parse('Stefan')).toBe('Stefan')
  })

  it('trims surrounding whitespace', () => {
    expect(displayNameSchema.parse('  Stefan  ')).toBe('Stefan')
  })

  it('rejects a name that is only whitespace', () => {
    expect(displayNameSchema.safeParse('   ').success).toBe(false)
  })

  it('rejects a single character', () => {
    expect(displayNameSchema.safeParse('S').success).toBe(false)
  })

  it('rejects anything past 60 characters', () => {
    expect(displayNameSchema.safeParse('a'.repeat(61)).success).toBe(false)
  })
})

describe('emailSchema', () => {
  it('lowercases so a changed address matches what auth stores', () => {
    expect(emailSchema.parse('Owner@Example.COM')).toBe('owner@example.com')
  })

  it('rejects a string with no domain', () => {
    expect(emailSchema.safeParse('owner@').success).toBe(false)
  })

  it('rejects an empty string', () => {
    expect(emailSchema.safeParse('').success).toBe(false)
  })
})

describe('notificationPrefsSchema', () => {
  it('accepts all three flags', () => {
    const parsed = notificationPrefsSchema.parse({
      notify_matches: true,
      notify_messages: false,
      notify_health_reviews: true,
    })
    expect(parsed).toEqual({
      notify_matches: true,
      notify_messages: false,
      notify_health_reviews: true,
    })
  })

  it('rejects a missing flag rather than defaulting it on', () => {
    expect(
      notificationPrefsSchema.safeParse({ notify_matches: true, notify_messages: false }).success
    ).toBe(false)
  })
})

describe('isDeleteConfirmed', () => {
  it('accepts the exact phrase', () => {
    expect(isDeleteConfirmed(DELETE_CONFIRMATION)).toBe(true)
  })

  it('ignores case and surrounding whitespace', () => {
    expect(isDeleteConfirmed('  Delete My Account  ')).toBe(true)
  })

  it('rejects a near miss', () => {
    expect(isDeleteConfirmed('delete account')).toBe(false)
  })

  it('rejects an empty string', () => {
    expect(isDeleteConfirmed('')).toBe(false)
  })
})

describe('purgeDateFrom', () => {
  it('adds the grace period', () => {
    const due = purgeDateFrom(new Date('2026-08-17T12:00:00Z'))
    expect(due.toISOString().slice(0, 10)).toBe('2026-09-16')
  })

  it('rolls across a month boundary', () => {
    const due = purgeDateFrom(new Date('2026-01-20T00:00:00Z'))
    expect(due.toISOString().slice(0, 10)).toBe('2026-02-19')
  })

  it('rolls across a year boundary', () => {
    const due = purgeDateFrom(new Date('2026-12-20T00:00:00Z'))
    expect(due.toISOString().slice(0, 10)).toBe('2027-01-19')
  })

  it('does not mutate the date it was given', () => {
    const start = new Date('2026-08-17T12:00:00Z')
    purgeDateFrom(start)
    expect(start.toISOString()).toBe('2026-08-17T12:00:00.000Z')
  })

  it('matches the grace constant the UI quotes to the member', () => {
    const start = new Date('2026-03-01T00:00:00Z')
    const due = purgeDateFrom(start)
    const days = Math.round((due.getTime() - start.getTime()) / 86_400_000)
    expect(days).toBe(PURGE_GRACE_DAYS)
  })
})
