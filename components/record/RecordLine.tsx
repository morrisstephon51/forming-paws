import Mark, { type MarkStatus } from './Mark'

/**
 * A single line of a file: mark, field label, value.
 *
 *   ■ HIP SCREEN · REV 08-26
 *   ⊘ 501(C)(3) STATUS · NOT YET
 *   □ RECORDS · IN REVIEW
 *
 * Both the mark and the value are optional, and the two omissions mean
 * different things:
 *
 *   no `value`  — the field is named but carries nothing yet. The label still
 *                 renders, because a field that disappears when empty is how a
 *                 site quietly stops disclosing things.
 *   no `status` — this is a plain field, not a claim about verification. Used
 *                 for neutral metadata like a location or a date, where a mark
 *                 would imply someone checked something.
 */
export default function RecordLine({
  status,
  label,
  value,
  className,
  markLabel,
}: {
  status?: MarkStatus
  label: string
  value?: string | null
  className?: string
  /** Screen-reader name for the mark. See Mark's own `label` prop. */
  markLabel?: string
}) {
  const hasValue = typeof value === 'string' && value.trim() !== ''

  return (
    <span className={`fp-record${className ? ` ${className}` : ''}`}>
      {status ? (
        <Mark status={status} label={markLabel} className="fp-record__mark" />
      ) : null}
      <span className="fp-record__label">{label}</span>
      {/*
        The separator is a ::before on the value, not a sibling node.

        As a sibling it was a third flex child, and in a narrow column
        `flex-wrap` would break the line between the separator and the value it
        belongs to — leaving a lone "·" sitting on its own line above the text.
        Attached to the value it cannot be orphaned, and it drops out of the
        accessibility tree and the copied text for free.
      */}
      {hasValue ? <span className="fp-record__value">{value}</span> : null}
    </span>
  )
}
