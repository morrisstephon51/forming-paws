import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { purgeDateFrom, purgeDateLabel } from '@/lib/validators/settings'
import { calendarDateInMemberZone } from '@/lib/dates'

// pg_cron runs purge_deactivated_accounts() at '10 4 * * *' (04:10 UTC) and
// purges rows where deactivated_at < now() - 30 days. This returns the first
// such run for a given deactivation instant.
function firstPurgeRun(deactivatedAt: Date): Date {
  const due = purgeDateFrom(deactivatedAt)
  const run = new Date(Date.UTC(due.getUTCFullYear(), due.getUTCMonth(), due.getUTCDate(), 4, 10))
  if (run.getTime() <= due.getTime()) run.setUTCDate(run.getUTCDate() + 1)
  return run
}

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

// "1 December 2026" -> "2026-12-01", so the label can be compared as a date.
function labelToIso(label: string): string {
  const [day, month, year] = label.split(' ')
  return `${year}-${String(MONTHS.indexOf(month) + 1).padStart(2, '0')}-${day.padStart(2, '0')}`
}

describe('purgeDateLabel', () => {
  it('shows the Chicago date for an evening deactivation (UTC is already tomorrow)', () => {
    // 1 Nov 2026 20:00 CST = 2 Nov 02:00 UTC. Due 2 Dec 02:00 UTC = 1 Dec 20:00 CST,
    // and the purge actually runs 2 Dec 04:10 UTC = 1 Dec 22:10 CST.
    expect(purgeDateLabel(new Date('2026-11-02T02:00:00Z'))).toBe('1 December 2026')
  })

  it('agrees with the UTC date for a daytime deactivation', () => {
    expect(purgeDateLabel(new Date('2026-11-01T16:00:00Z'))).toBe('1 December 2026')
  })

  it('follows daylight saving time (CDT, UTC-5)', () => {
    // 9 Jul 2026 22:30 CDT = 10 Jul 03:30 UTC. Due 8 Aug 22:30 CDT.
    expect(purgeDateLabel(new Date('2026-07-10T03:30:00Z'))).toBe('8 August 2026')
  })

  it('never promises a later day than the purge cron actually deletes the account', () => {
    for (const start of ['2026-01-10T00:00:00Z', '2026-07-10T00:00:00Z', '2026-10-25T00:00:00Z']) {
      for (let m = 0; m < 2 * 24 * 60; m += 15) {
        const deactivatedAt = new Date(new Date(start).getTime() + m * 60_000)
        const shownIso = labelToIso(purgeDateLabel(deactivatedAt))
        const deletedIso = calendarDateInMemberZone(firstPurgeRun(deactivatedAt))
        expect(shownIso <= deletedIso, `${deactivatedAt.toISOString()}: shows ${shownIso}, deleted ${deletedIso}`).toBe(true)
      }
    }
  })
})

describe('calendarDateInMemberZone', () => {
  it('reads the date in America/Chicago, not UTC', () => {
    expect(calendarDateInMemberZone(new Date('2026-12-02T02:00:00Z'))).toBe('2026-12-01')
    expect(calendarDateInMemberZone(new Date('2026-12-02T06:00:00Z'))).toBe('2026-12-02')
  })
})

describe('reactivate page call site', () => {
  const src = readFileSync(join(process.cwd(), 'app/account/reactivate/page.tsx'), 'utf8')

  it('renders the deletion date through purgeDateLabel', () => {
    expect(src).toContain('purgeDateLabel(new Date(owner.deactivated_at))')
  })

  it('does not derive the date from a UTC ISO string', () => {
    expect(src).not.toMatch(/toISOString\(\)/)
  })
})
