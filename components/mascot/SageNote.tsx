import Sage, { type SageMood } from './Sage'

/**
 * The shape every empty, loading and error state shares.
 *
 * These moments were previously a single grey sentence — "No dogs match your
 * filters." — which tells a member what happened but not that anything is fine.
 * Giving all of them one block means a dead end never looks like a broken page,
 * and means the next one somebody adds doesn't invent a fourth layout.
 *
 * The mascot stays decorative: the heading and body already say what the state
 * is, so announcing "dog, thinking" over the top of it is noise.
 */
export default function SageNote({
  mood,
  title,
  children,
  size = 88,
  className = '',
  status = false,
}: {
  mood: SageMood
  title: string
  children?: React.ReactNode
  size?: number
  className?: string
  /*
   * Set on route loading boundaries. A screen-reader user gets no visual cue
   * that a navigation is in flight, so without a live region the page simply
   * goes quiet — role="status" implies aria-live="polite", which announces the
   * waiting message without interrupting whatever is being read.
   *
   * Off by default: an empty state is not a status update, and announcing
   * "No dogs match those filters" on render would talk over the filter control
   * the reader just used.
   */
  status?: boolean
}) {
  return (
    <div
      {...(status ? { role: 'status' } : {})}
      className={`flex flex-col items-center gap-3 py-10 text-center ${className}`}
    >
      <Sage mood={mood} size={size} className={mood === 'sleeping' ? 'fp-sage-breathe' : undefined} />
      <p className="fp-h4">{title}</p>
      {children ? <p className="max-w-sm text-ink-soft">{children}</p> : null}
    </div>
  )
}
