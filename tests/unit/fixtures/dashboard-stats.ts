import type { DashboardStats } from '@/lib/admin/dashboard'

/**
 * A plainly fake DashboardStats for component and page tests.
 *
 * Chosen so each assertion has something real to bite on: the documents queue
 * is non-empty with a known oldest upload, the reports queue is empty, the
 * funnel has a TIE for largest drop (10 -> 6 and 6 -> 2 both lose 4, and the
 * earlier step must win), the peak signup week is not the current week, and
 * the weekly signups sum to funnel.signed_up.
 */
export const STATS: DashboardStats = {
  meta: { generated_at: '2026-09-12T20:04:00Z', test_accounts_excluded: 37 },
  attention: {
    docs_pending: 4,
    oldest_pending_uploaded_at: '2026-09-09T12:00:00Z',
    reports_open: 0,
    contact_unhandled: 1,
    dogs_removed: 0,
  },
  funnel: { signed_up: 13, confirmed: 11, signed_in: 10, added_dog: 6, verified_dog: 2, matched: 1 },
  signups_by_week: [
    { week_start: '2026-07-20', signups: 1 },
    { week_start: '2026-07-27', signups: 0 },
    { week_start: '2026-08-03', signups: 1 },
    { week_start: '2026-08-10', signups: 2 },
    { week_start: '2026-08-17', signups: 5 },
    { week_start: '2026-08-24', signups: 1 },
    { week_start: '2026-08-31', signups: 2 },
    { week_start: '2026-09-07', signups: 1 },
  ],
  engagement: {
    interests: { total: 3, last_30d: 1 },
    matches: { total: 1, last_30d: 1 },
    messages: { total: 7, last_30d: 5 },
    active_conversations: { last_30d: 1 },
    litters: { total: 0, last_30d: 0 },
    puppy_inquiries: { total: 0, last_30d: 0 },
  },
}
