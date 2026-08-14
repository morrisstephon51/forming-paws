/**
 * Completed calendar years between a dog's birth date and now.
 *
 * `birth_date` is a Postgres `date` (YYYY-MM-DD) — a calendar day with no time
 * or zone. The browse list used to derive age by dividing elapsed milliseconds
 * by a fixed 365.25-day year, which had two visible failures on a product where
 * age is a breeding decision:
 *
 *   1. A dog that had *just* turned one read as "0yo", because 365 real days is
 *      short of 365.25, and the shortfall drifts further with each non-leap year.
 *   2. `browse_dogs` filters age with calendar interval math
 *      (`birth_date <= current_date - N years`), so a dog surfaced by a
 *      "minimum age 1 year" search could still be labelled "0yo" — the filter
 *      and the label contradicting each other in the same row.
 *
 * Counting calendar years the way Postgres `age()` does keeps the number shown
 * in agreement with the filter that surfaced it. `now` is injectable so the
 * boundary cases can be tested without touching the clock.
 */
export function ageInYears(birthDate: string, now: Date = new Date()): number {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(birthDate.slice(0, 10))
  // An unparseable date has no honest age; don't invent one from `Invalid Date`.
  if (!match) return 0

  const birthYear = Number(match[1])
  const birthMonth = Number(match[2])
  const birthDay = Number(match[3])

  // UTC to line up with a Vercel server (UTC) and a Postgres `current_date`
  // that is almost always UTC too; a calendar date carries no zone of its own.
  const nowYear = now.getUTCFullYear()
  const nowMonth = now.getUTCMonth() + 1
  const nowDay = now.getUTCDate()

  let age = nowYear - birthYear
  // This year's birthday hasn't happened yet, so a year hasn't completed.
  if (nowMonth < birthMonth || (nowMonth === birthMonth && nowDay < birthDay)) {
    age -= 1
  }

  // A birth date in the future (guarded against elsewhere, but cheap to honour)
  // is zero years old, never negative.
  return age < 0 ? 0 : age
}
