import Link from 'next/link'
import RecordLine from '@/components/record/RecordLine'
import Mark from '@/components/record/Mark'
import FunnelTable from './FunnelTable'
import SignupColumns from './SignupColumns'
import { generatedLabel, waitingFor, type DashboardStats } from '@/lib/admin/dashboard'

type Queue = {
  key: string
  label: string
  href: string
  count: number
  /** Shown beside a non-zero count. */
  detail?: string
  /** Shown instead of a bare 0. */
  zeroText: string
}

/**
 * The admin overview, from an already-loaded DashboardStats.
 *
 * Presentational only, so it can be tested without a database. Needs attention
 * comes first because it is the part an admin acts on. Those counts are not
 * filtered for test accounts (see migration 0033), so they always match the
 * page each one links to.
 */
export default function DashboardView({ stats, now }: { stats: DashboardStats | null; now: Date }) {
  if (!stats) {
    return (
      <div role="alert" className="mt-6 border-y border-hairline py-5">
        <RecordLine status="none" label="Figures" value="Couldn't load figures" />
      </div>
    )
  }

  const { attention: a, engagement: e } = stats

  const queues: Queue[] = [
    {
      key: 'docs',
      label: 'Documents to review',
      href: '/admin/review-queue',
      count: a.docs_pending,
      detail: waitingFor(a.oldest_pending_uploaded_at, now),
      zeroText: 'Nothing waiting',
    },
    { key: 'reports', label: 'Open reports', href: '/admin/reports', count: a.reports_open, zeroText: 'Nothing waiting' },
    {
      key: 'contact',
      label: 'Unhandled contact messages',
      href: '/admin/messages',
      count: a.contact_unhandled,
      zeroText: 'Nothing waiting',
    },
    { key: 'removed', label: 'Removed dogs', href: '/admin/dogs', count: a.dogs_removed, zeroText: 'None removed' },
  ]

  const engagement: { label: string; last30: number; total: number | null }[] = [
    { label: 'Interest sent', last30: e.interests.last_30d, total: e.interests.total },
    { label: 'Matches', last30: e.matches.last_30d, total: e.matches.total },
    { label: 'Messages', last30: e.messages.last_30d, total: e.messages.total },
    { label: 'Active conversations', last30: e.active_conversations.last_30d, total: null },
    { label: 'Litters listed', last30: e.litters.last_30d, total: e.litters.total },
    { label: 'Puppy inquiries', last30: e.puppy_inquiries.last_30d, total: e.puppy_inquiries.total },
  ]

  return (
    <div className="mt-6">
      <div className="grid gap-x-8 gap-y-2 border-y border-hairline py-4 sm:grid-cols-2">
        <RecordLine label="Generated" value={generatedLabel(stats.meta.generated_at)} />
        <RecordLine label="Test accounts excluded" value={String(stats.meta.test_accounts_excluded)} />
      </div>

      <section aria-labelledby="attention-h" className="mt-10">
        <h2 id="attention-h" className="fp-h3">
          Needs attention
        </h2>
        <ul className="mt-4">
          {queues.map((q) => (
            <li key={q.key} className="fp-row flex items-baseline justify-between gap-4">
              <Link href={q.href} className="fp-link">
                {q.label}
              </Link>
              {q.count === 0 ? (
                <span className="flex items-baseline gap-2 text-sm text-ink-soft">
                  <Mark status="verified" label="Clear" />
                  {q.zeroText}
                </span>
              ) : (
                <span className="text-right">
                  <span className="tabular-nums text-ink">{q.count}</span>
                  {q.detail ? <span className="ml-3 text-sm text-ink-soft">{q.detail}</span> : null}
                </span>
              )}
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="funnel-h" className="mt-10">
        <h2 id="funnel-h" className="fp-h3">
          Activation funnel
        </h2>
        <p className="mt-1 text-sm text-ink-soft">Real members only. Each step counts people, not events.</p>
        <FunnelTable funnel={stats.funnel} />
      </section>

      <section aria-labelledby="signups-h" className="mt-10">
        <h2 id="signups-h" className="fp-h3">
          Signups, last 8 weeks
        </h2>
        <SignupColumns weeks={stats.signups_by_week} />
      </section>

      <section aria-labelledby="engagement-h" className="mt-10">
        <h2 id="engagement-h" className="fp-h3">
          Engagement
        </h2>
        <table className="mt-4 w-full border-collapse text-sm">
          <caption className="sr-only">Engagement, real members only</caption>
          <thead>
            <tr>
              <th scope="col" className="fp-meta pb-2 text-left font-normal">
                Activity
              </th>
              <th scope="col" className="fp-meta pb-2 text-right font-normal">
                Last 30 days
              </th>
              <th scope="col" className="fp-meta pb-2 text-right font-normal">
                All time
              </th>
            </tr>
          </thead>
          <tbody>
            {engagement.map((row) => (
              <tr key={row.label} className="border-t border-hairline">
                <th scope="row" className="py-2 text-left font-normal text-ink">
                  {row.label}
                </th>
                <td className="py-2 text-right tabular-nums text-ink">{row.last30}</td>
                <td className="py-2 text-right tabular-nums text-ink-soft">
                  {row.total === null ? 'n/a' : row.total}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  )
}
