/**
 * Whether a date-only birth date is today or earlier in the *viewer's local*
 * calendar — the same frame the date picker showed them.
 *
 * `<input type="date">` yields a bare "YYYY-MM-DD". The obvious check,
 * `new Date(d) <= new Date()`, parses that as UTC midnight and compares it to
 * the current instant. West of UTC that quietly accepts a future date: at 8pm
 * in Chicago (UTC-5) the current instant is already 01:00 the next day in UTC,
 * so tomorrow-at-midnight-UTC sorts *before* it and slips past a guard whose
 * whole job is to reject the future. Members here are in Chicago, so that window
 * is every evening.
 *
 * Comparing calendar components in local time never builds a zoned instant, so
 * "is this day after today?" is answered in the frame the member actually chose
 * the day in. `now` is injectable purely so the boundary can be pinned in tests.
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

  const asNumber = year * 10000 + month * 100 + day
  const todayNumber = now.getFullYear() * 10000 + (now.getMonth() + 1) * 100 + now.getDate()
  return asNumber <= todayNumber
}
