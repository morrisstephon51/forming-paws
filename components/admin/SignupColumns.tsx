import { barPercent, weekLabel, type DashboardStats } from '@/lib/admin/dashboard'

/**
 * Weekly signups as eight columns, with a table twin.
 *
 * Columns rather than a line: these are discrete weekly counts where an empty
 * week matters, and an empty column reads as zero more plainly than a point.
 *
 * Dataviz rules applied: columns at most 24px wide (max-w-6), a 4px rounded
 * data-end on top and a square baseline, a 2px surface gap between columns
 * (gap-0.5), one series so no legend. Labels are selective: only the current
 * week and the peak week carry a cap label. Every column is focusable, and its
 * tooltip shows on hover AND focus. The hit area is the whole column slot, at
 * least 24px wide, not just the painted bar. The `<details>` table is the twin
 * that makes every value reachable without hovering.
 */
export default function SignupColumns({ weeks }: { weeks: DashboardStats['signups_by_week'] }) {
  const max = Math.max(0, ...weeks.map((w) => w.signups))
  const lastIndex = weeks.length - 1
  const peakIndex = max > 0 ? weeks.findIndex((w) => w.signups === max) : -1

  return (
    <div className="mt-4">
      <ol aria-label="Signups per week, last 8 weeks" className="flex h-40 items-end gap-0.5 pt-6">
        {weeks.map((week, i) => {
          const summary = `Week of ${weekLabel(week.week_start)}: ${week.signups} ${
            week.signups === 1 ? 'signup' : 'signups'
          }`
          const labelled = i === lastIndex || i === peakIndex
          return (
            <li
              key={week.week_start}
              data-testid="signup-column"
              tabIndex={0}
              aria-label={summary}
              className="group relative flex h-full min-w-6 flex-1 items-end justify-center rounded focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
            >
              <span
                role="tooltip"
                className="pointer-events-none absolute -top-8 z-10 hidden whitespace-nowrap rounded bg-ink px-2 py-1 text-xs text-ivory group-hover:block group-focus-visible:block"
              >
                {summary}
              </span>
              <div
                aria-hidden="true"
                className="relative w-full max-w-6 rounded-t bg-brand group-hover:opacity-80 group-focus-visible:opacity-80"
                style={{ height: `${barPercent(week.signups, max)}%` }}
              >
                {labelled ? (
                  <span
                    data-testid="cap-label"
                    className="absolute bottom-full left-1/2 mb-1 -translate-x-1/2 text-xs tabular-nums text-ink"
                  >
                    {week.signups}
                  </span>
                ) : null}
              </div>
            </li>
          )
        })}
      </ol>

      <ol aria-hidden="true" className="mt-1 flex gap-0.5">
        {weeks.map((week) => (
          <li key={week.week_start} className="min-w-6 flex-1 text-center text-xs text-ink-soft">
            {weekLabel(week.week_start)}
          </li>
        ))}
      </ol>

      <details className="mt-3 text-sm">
        <summary className="cursor-pointer text-ink-soft">Show as table</summary>
        <table className="mt-2 w-full border-collapse">
          <caption className="sr-only">Signups per week</caption>
          <thead>
            <tr>
              <th scope="col" className="fp-meta pb-1 text-left font-normal">
                Week of
              </th>
              <th scope="col" className="fp-meta pb-1 text-right font-normal">
                Signups
              </th>
            </tr>
          </thead>
          <tbody>
            {weeks.map((week) => (
              <tr key={week.week_start} className="border-t border-hairline">
                <td className="py-1 text-ink">{weekLabel(week.week_start)}</td>
                <td className="py-1 text-right tabular-nums text-ink">{week.signups}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </div>
  )
}
