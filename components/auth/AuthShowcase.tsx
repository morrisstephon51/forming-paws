import Tilt3D from '@/components/motion/Tilt3D'

/**
 * What Forming Paws does, as three panels standing in 3D space.
 *
 * This exists because of a specific complaint: visitors reached the site and
 * asked "what is it that you guys actually do?" A landscape does not answer
 * that. The meadow behind these panels is the *ground*; these panels are the
 * subject, and each one depicts a real mechanic of the running product in the
 * order a member meets it — records in, a person reviews them, dogs near you.
 * Same spine as lib/journey's STEPS and the same claim as lib/positioning's
 * WHAT_WE_DO_PLAIN, so the three cannot drift apart.
 *
 * WHY THERE IS NO VERIFIED BADGE HERE, and why adding one would be a bug.
 * components/record/Mark.tsx sets this repo's rule: a mark must be derivable
 * from data the platform actually holds, and hand-writing a `verified` mark
 * into a template is a fabricated record on a site whose entire argument is
 * that its records are real. An illustrated dog card stamped "Verified" would
 * break exactly that rule, on the page where a member is deciding whether to
 * trust us with their vet paperwork. So: no invented dog, no invented owner, no
 * mark component, no number that is not real.
 *
 * What the diagrams are allowed to show instead is the *system's own states* —
 * a filled dot for records a person has reviewed, a hollow one for records
 * still waiting. That is a legend describing how the platform works, which is
 * prose, not a claim about any particular animal. The same reasoning that makes
 * Mark's `none` status publishable is what makes this publishable.
 *
 * The 3D is CSS, not WebGL. The meadow already owns the only GPU context on the
 * page, and Tilt3D gives these panels a scroll-driven settle on every device
 * plus a pointer lean where there is a cursor — which is the half that still
 * works on a phone, where MeadowCanvas declines to run at all. Each panel's
 * transform is a continuous function of scroll, so reduced motion declines it
 * rather than shortening it, landing on the same flat pose that renders with no
 * JavaScript at all.
 */

const BRAND = '#2F6B5C'
const MOSS = '#D2E4DA'
/* Accent is fill-only in this system — 2.82:1 on ivory. Never text. */
const ACCENT = '#E8734A'

/** A private record: a sheet, kept shut. */
function VaultDiagram() {
  return (
    <svg viewBox="0 0 64 64" className="h-14 w-14" fill="none" aria-hidden="true">
      <rect x="14" y="8" width="30" height="40" rx="3" fill={MOSS} />
      <rect x="14" y="8" width="30" height="40" rx="3" stroke={BRAND} strokeWidth="2" />
      <path d="M20 20h18M20 27h18M20 34h11" stroke={BRAND} strokeWidth="2" strokeLinecap="round" />
      {/* The shackle and body of a padlock, sitting over the sheet's corner. */}
      <path d="M38 48v-4a6 6 0 0 1 12 0v4" stroke={BRAND} strokeWidth="2.5" strokeLinecap="round" />
      <rect x="34" y="47" width="20" height="13" rx="2.5" fill={BRAND} />
    </svg>
  )
}

/** A person reading a record. A lens over a sheet — no stamp, no verdict. */
function ReviewDiagram() {
  return (
    <svg viewBox="0 0 64 64" className="h-14 w-14" fill="none" aria-hidden="true">
      <rect x="10" y="9" width="30" height="40" rx="3" fill={MOSS} />
      <rect x="10" y="9" width="30" height="40" rx="3" stroke={BRAND} strokeWidth="2" />
      <path d="M16 19h18M16 26h18M16 33h11" stroke={BRAND} strokeWidth="2" strokeLinecap="round" />
      <circle cx="40" cy="38" r="12" fill="#FBF7F0" fillOpacity="0.9" />
      <circle cx="40" cy="38" r="12" stroke={BRAND} strokeWidth="2.5" />
      <path d="M49 47l7 7" stroke={BRAND} strokeWidth="3" strokeLinecap="round" />
    </svg>
  )
}

/**
 * Distance, which is the literal mechanic of /browse: rings out from a member,
 * dogs placed on them. Filled dots are records a person has reviewed, hollow
 * ones are still waiting — the system's two states, as a key.
 */
function NearbyDiagram() {
  return (
    <svg viewBox="0 0 64 64" className="h-14 w-14" fill="none" aria-hidden="true">
      <circle cx="32" cy="32" r="26" stroke={MOSS} strokeWidth="2" />
      <circle cx="32" cy="32" r="17" stroke={MOSS} strokeWidth="2" />
      <circle cx="32" cy="32" r="8" stroke={BRAND} strokeWidth="2" strokeDasharray="3 3" />
      <circle cx="32" cy="32" r="3.5" fill={ACCENT} />
      {/* Reviewed. */}
      <circle cx="49" cy="25" r="4" fill={BRAND} />
      <circle cx="20" cy="46" r="4" fill={BRAND} />
      {/* Still waiting. */}
      <circle cx="15" cy="23" r="4" fill="#FBF7F0" stroke={BRAND} strokeWidth="2" />
    </svg>
  )
}

const PANELS = [
  {
    Diagram: VaultDiagram,
    title: 'Records go in, privately',
    body: "Upload your dog's wellness exams, vaccinations and screenings once. Other members never see the paperwork.",
  },
  {
    Diagram: ReviewDiagram,
    title: 'A person reviews them',
    body: 'Matching stays locked until a human has read the documents. Nothing here runs on an honour system.',
  },
  {
    Diagram: NearbyDiagram,
    title: 'Then you see who is nearby',
    body: 'Browse health-documented dogs by distance, never by exact address, and talk when the interest is mutual.',
  },
]

export default function AuthShowcase({
  className = '',
  /**
   * Numbers the panels. On /signup these three ARE the sequence a new member is
   * about to walk through, and the numerals say so; on /login they are an
   * explanation rather than a path, so they stay unnumbered.
   */
  numbered = false,
}: {
  className?: string
  numbered?: boolean
}) {
  return (
    <div className={`fp-stage grid gap-5 ${className}`}>
      {PANELS.map(({ Diagram, title, body }, i) => (
        <Tilt3D
          key={title}
          className="fp-card"
          /* A shallow ladder in Z, so the three read as a receding plane rather
             than as three cards at the same distance that happen to tilt. */
          depth={i * -14}
          entry={9}
          lean={4}
        >
          <div className="flex items-center gap-3">
            <Diagram />
            {numbered ? (
              <span
                className="fp-badge h-6 w-6 shrink-0 justify-center"
                aria-hidden="true"
              >
                {i + 1}
              </span>
            ) : null}
          </div>
          <h3 className="fp-h4 mt-4">{title}</h3>
          <p className="mt-2 text-sm text-ink-soft">{body}</p>
        </Tilt3D>
      ))}
    </div>
  )
}
