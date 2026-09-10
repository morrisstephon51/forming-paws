/**
 * The three marks.
 *
 * One status vocabulary, used across every public surface, with identical
 * meaning everywhere and never as decoration. The rule that keeps it worth
 * anything: a mark must be derivable from data the platform actually holds. If
 * a fact carries a mark it is a record; if it does not, it is prose. Never
 * hand-write a `verified` mark into a template — that is a fabricated record on
 * a site whose entire argument is that its records are real.
 *
 * `none` is the mark that earns the system. It says the thing does not exist,
 * in public, on purpose.
 */

export type MarkStatus = 'verified' | 'pending' | 'none'

/**
 * Screen-reader text. Deliberately not the same strings as the visible field
 * labels: the visible label names the field ("501(c)(3) status"), the mark
 * names its state, and a reader needs both.
 */
const MARK_LABELS: Record<MarkStatus, string> = {
  verified: 'Verified',
  pending: 'Pending review',
  none: 'Not yet',
}

/*
 * Written out in full rather than composed as `fp-mark--${status}`.
 *
 * Tailwind's content scanner is a regex over raw file text, not a type-aware
 * pass: a template literal yields the candidate `fp-mark--` and nothing else,
 * so all three modifiers get purged from the stylesheet and every mark renders
 * as an unstyled 9px box. The failure is silent in dev and in tests, because
 * jsdom asserts on class names and never on computed styles.
 */
const MARK_CLASSES: Record<MarkStatus, string> = {
  verified: 'fp-mark fp-mark--verified',
  pending: 'fp-mark fp-mark--pending',
  none: 'fp-mark fp-mark--none',
}

export function markLabel(status: MarkStatus): string {
  return MARK_LABELS[status]
}

export default function Mark({
  status,
  className,
  label,
}: {
  status: MarkStatus
  className?: string
  /**
   * Overrides the screen-reader name only. The three marks are one visual
   * vocabulary on a single axis — confirmed, underway, absent — but the word
   * that names a point on that axis changes with what is being described: a
   * health document is "Verified", a roadmap item is "Live". Same mark, same
   * meaning, accurate name. Never use this to soften an absence.
   */
  label?: string
}) {
  return (
    <span
      role="img"
      aria-label={label ?? MARK_LABELS[status]}
      data-mark={status}
      className={`${MARK_CLASSES[status]}${className ? ` ${className}` : ''}`}
    />
  )
}
