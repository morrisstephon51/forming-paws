/**
 * Kept out of the pages so a jsdom test run can import it without dragging in
 * next/navigation and the Server Component machinery — the same reason
 * `ageInYears` lives in lib/age.ts and `locationSchema` in lib/validators.
 */

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
] as const

/**
 * Format a Postgres `date` value ("YYYY-MM-DD") as a plain human date, e.g.
 * "14 May 2023".
 *
 * Not `new Date(value).toLocaleDateString()` — the pattern this codebase uses
 * for `timestamptz` columns like `created_at`. A date-only string carries no
 * time or zone, so `new Date("2023-05-14")` parses it as UTC midnight. Rendered
 * in any timezone west of UTC — including America/Chicago, where the members
 * are — that instant is still the previous evening, so the day rolls back and a
 * dog born on the 14th shows as the 13th. On a breeding app a birth date is a
 * decision, so the day has to be the one the database stored.
 *
 * This reads the year, month and day straight off the string and never builds a
 * zoned instant, so the calendar day is preserved everywhere.
 *
 * A value that isn't a plain calendar date is returned unchanged rather than
 * rendered as "Invalid Date"; a stray value should degrade to something legible.
 */
export function formatCalendarDate(value: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value)
  if (!match) return value

  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])

  // Reject impossible components (month 13, day 40, …) rather than let them roll
  // over into a different, wrong date. Postgres `date` columns never store these;
  // this only guards a value that arrived malformed from somewhere else.
  if (month < 1 || month > 12 || day < 1 || day > 31) return value

  return `${day} ${MONTHS[month - 1]} ${year}`
}

/**
 * The zone the members live in. South-suburban Cook County is on Chicago time,
 * and every date picker on the site shows them their own calendar — see the note
 * on `formatCalendarDate` above for why that matters.
 */
const MEMBER_TIME_ZONE = 'America/Chicago'

/**
 * Today's calendar date in the members' timezone, as "YYYY-MM-DD".
 *
 * Anchored to the members' zone rather than the server's on purpose. Vercel runs
 * in UTC, so from about 7pm Chicago onward the server clock has already crossed
 * into tomorrow; a guard that asks "is this after *now*?" then treats a document
 * a member dated tomorrow as if it were today. Formatting the instant in
 * America/Chicago answers the question in the calendar the member actually used,
 * and `Intl` follows the daylight-saving rules so the offset is right year round.
 *
 * `now` is injectable purely so the boundary can be pinned in tests.
 */
export function todayInMemberZone(now: Date = new Date()): string {
  // en-CA renders a date as "YYYY-MM-DD".
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: MEMBER_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now)
}

/**
 * Whether a date-only "YYYY-MM-DD" is strictly after today in the members'
 * calendar — for guarding a form that must not accept a future date, e.g. the
 * date on a health document.
 *
 * The obvious `new Date(value) > new Date()` parses the value as UTC midnight and
 * compares it to the current instant, which quietly accepts a member's local
 * "tomorrow" every evening west of UTC (the same trap `formatCalendarDate`
 * avoids). Comparing two zero-padded "YYYY-MM-DD" strings is an ordinary
 * lexicographic comparison that matches their calendar order, and never builds a
 * zoned instant. A value that isn't a plain calendar date returns `false`;
 * callers reject a malformed value separately.
 */
export function isFutureCalendarDate(value: string, now: Date = new Date()): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  return value > todayInMemberZone(now)
}
