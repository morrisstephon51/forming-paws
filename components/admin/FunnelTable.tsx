import {
  FUNNEL_STEPS,
  barPercent,
  largestDrop,
  pct,
  type DashboardStats,
} from '@/lib/admin/dashboard'

/**
 * The activation funnel as a real table.
 *
 * The table is the chart: every value is visible as text in its own cell, so
 * the dataviz rule that every chart has a table view is met by construction,
 * and the bars only add shape. One series, so no legend; the section heading
 * names it. Bars are 12px thick with a 4px rounded data-end and a square end
 * at the baseline. Rows lift on hover; no value is hidden behind the hover.
 */
export default function FunnelTable({ funnel }: { funnel: DashboardStats['funnel'] }) {
  const drop = largestDrop(funnel)

  return (
    <table className="mt-4 w-full border-collapse text-sm">
      <caption className="sr-only">Activation funnel, real members only</caption>
      <thead>
        <tr>
          <th scope="col" className="fp-meta pb-2 text-left font-normal">
            Step
          </th>
          <th scope="col" className="fp-meta pb-2 pr-4 text-right font-normal">
            People
          </th>
          <th scope="col" className="fp-meta pb-2 pr-4 text-right font-normal">
            Of previous
          </th>
          <th scope="col" className="pb-2">
            <span className="sr-only">Share of sign-ups</span>
          </th>
        </tr>
      </thead>
      <tbody>
        {FUNNEL_STEPS.map((step, i) => {
          const value = funnel[step.key]
          const previous = i === 0 ? null : funnel[FUNNEL_STEPS[i - 1].key]
          return (
            <tr key={step.key} className="border-t border-hairline hover:bg-wash">
              {/*
                The flagged row's accessible name is pinned with aria-label,
                because a name computed from content depends on the engine:
                jsdom joins every child element with a space ("Added a dog ,
                Largest drop"), and browsers generally do not space inline
                spans, so without a separator they read "Added a dogLargest
                drop". aria-label gives every engine exactly "Added a dog,
                Largest drop". The visually hidden comma stays so copied text
                and textContent read the same way.
              */}
              <th
                scope="row"
                aria-label={drop === step.key ? `${step.label}, Largest drop` : undefined}
                className="py-2 pr-4 text-left font-normal text-ink"
              >
                {step.label}
                {drop === step.key ? (
                  <>
                    <span className="sr-only">, </span>
                    <span className="ml-2 text-ink-soft">Largest drop</span>
                  </>
                ) : null}
              </th>
              <td className="py-2 pr-4 text-right tabular-nums text-ink">{value}</td>
              <td className="py-2 pr-4 text-right tabular-nums text-ink-soft">
                {previous === null ? '' : pct(value, previous)}
              </td>
              <td className="w-2/5 py-2">
                <div
                  data-testid="funnel-bar"
                  aria-hidden="true"
                  className="h-3 rounded-r bg-brand"
                  style={{ width: `${barPercent(value, funnel.signed_up)}%` }}
                />
              </td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}
