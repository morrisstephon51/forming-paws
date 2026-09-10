import { todayInMemberZone } from './dates'

/**
 * Whether a date-only birth date is today or earlier in the *members'* calendar
 * (America/Chicago) — the same frame the date picker showed them.
 *
 * `<input type="date">` yields a bare "YYYY-MM-DD". The obvious check,
 * `new Date(d) <= new Date()`, parses that as UTC midnight and compares it to
 * the current instant. West of UTC that quietly accepts a future date: at 8pm
 * in Chicago (UTC-5) the current instant is already 01:00 the next day in UTC,
 * so tomorrow-at-midnight-UTC sorts *before* it and slips past a guard whose
 * whole job is to reject the future.
 *
 * The fix is to answer "is this after today?" in one fixed calendar — the
 * members' — rather than whatever calendar the runtime happens to be in. Reading
 * `now.getFullYear()/getMonth()/getDate()` would use the *runtime's* zone: the
 * browser's for a member on Chicago time (so it looks fine there), but UTC on a
 * Vercel server, and whatever a member's device clock is set to otherwise —
 * every one of which reopens the exact evening-window hole this guards. Pinning
 * the comparison to America/Chicago via `todayInMemberZone` (daylight-saving
 * offset applied) keeps this guard in lockstep with its sibling
 * `isFutureCalendarDate` in lib/dates.ts, which was already standardised this way.
 * `now` is injectable purely so the boundary can be pinned in tests.
 */
export function isBirthDateNotInFuture(input: string, now: Date = new Date()): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(input.trim())
  if (!match) return false

  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])

  // Reject impossible calendar dates (2023-02-30, 2023-13-01): if the numbers
  // are real, constructing and reading them back round-trips exactly.
  const probe = new Date(year, month - 1, day)
  if (probe.getFullYear() !== year || probe.getMonth() !== month - 1 || probe.getDate() !== day) {
    return false
  }

  // Both sides are zero-padded "YYYY-MM-DD", so a lexicographic comparison is a
  // calendar comparison — and neither side is ever built into a zoned instant.
  return match[0] <= todayInMemberZone(now)
}
