/**
 * The admin overview's data shape and its formatting helpers.
 *
 * DashboardStats mirrors the JSON returned by public.admin_dashboard_stats()
 * (migration 0033) key for key. Everything here is pure: no I/O, no clock
 * reads except the `now` a caller passes in, so every helper is testable.
 */

export type Tally = { total: number; last_30d: number }

export type DashboardStats = {
  meta: { generated_at: string; test_accounts_excluded: number }
  attention: {
    docs_pending: number
    oldest_pending_uploaded_at: string | null
    reports_open: number
    contact_unhandled: number
    dogs_removed: number
  }
  funnel: {
    signed_up: number
    confirmed: number
    signed_in: number
    added_dog: number
    verified_dog: number
    matched: number
  }
  signups_by_week: { week_start: string; signups: number }[]
  engagement: {
    interests: Tally
    matches: Tally
    messages: Tally
    active_conversations: { last_30d: number }
    litters: Tally
    puppy_inquiries: Tally
  }
}

export type FunnelKey = keyof DashboardStats['funnel']

export const FUNNEL_STEPS: readonly { key: FunnelKey; label: string }[] = [
  { key: 'signed_up', label: 'Signed up' },
  { key: 'confirmed', label: 'Confirmed email' },
  { key: 'signed_in', label: 'Signed in' },
  { key: 'added_dog', label: 'Added a dog' },
  { key: 'verified_dog', label: 'Has a verified dog' },
  { key: 'matched', label: 'Matched' },
]

const DAY_MS = 24 * 60 * 60 * 1000

/** Whole-number percent. `n/a`, never an em dash: rendered copy on this site has none. */
export function pct(part: number, whole: number): string {
  if (whole === 0) return 'n/a'
  return `${Math.round((part / whole) * 100)}%`
}

export function waitingFor(iso: string | null, now: Date): string {
  if (iso === null) return 'Nothing waiting'
  const days = Math.floor((now.getTime() - new Date(iso).getTime()) / DAY_MS)
  if (days < 1) return 'Waiting under a day'
  return days === 1 ? 'Waiting 1 day' : `Waiting ${days} days`
}

/**
 * `week_start` is a calendar date. Parsed and formatted in UTC so the label
 * never slips a day depending on the server's timezone.
 */
export function weekLabel(weekStart: string): string {
  return new Date(`${weekStart}T00:00:00Z`).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  })
}

/**
 * Chicago, because that is where the platform's members are (the same anchor
 * #66 uses for birth dates). Recent ICU versions put a U+202F narrow no-break
 * space before AM/PM; it is normalised so copy and tests see ordinary spaces.
 */
export function generatedLabel(iso: string): string {
  return new Date(iso)
    .toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      timeZone: 'America/Chicago',
      timeZoneName: 'short',
    })
    .replace(/ /g, ' ')
}

/** 0 to 100 for a CSS width or height. Never NaN, never negative, never over 100. */
export function barPercent(value: number, max: number): number {
  if (max <= 0 || value <= 0) return 0
  return Math.min(100, (value / max) * 100)
}

/** The step where the most people were lost. Earliest step wins a tie. */
export function largestDrop(funnel: DashboardStats['funnel']): FunnelKey | null {
  let best: FunnelKey | null = null
  let bestDrop = 0
  for (let i = 1; i < FUNNEL_STEPS.length; i++) {
    const drop = funnel[FUNNEL_STEPS[i - 1].key] - funnel[FUNNEL_STEPS[i].key]
    if (drop > bestDrop) {
      bestDrop = drop
      best = FUNNEL_STEPS[i].key
    }
  }
  return best
}
