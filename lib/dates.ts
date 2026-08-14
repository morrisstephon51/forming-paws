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
