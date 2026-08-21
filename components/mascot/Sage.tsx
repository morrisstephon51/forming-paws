/**
 * Sage — the Forming Paws mascot.
 *
 * A mascot for an anti-puppy-mill platform has a hard constraint before it has
 * a style: it cannot look like a breed. Sage is deliberately mixed — one ear
 * perked, one folded — because a recognisable purebred head would be the
 * mascot quietly endorsing a breed this platform exists to be neutral about.
 *
 * That asymmetry is also what makes the mark work at 26px in the nav. A
 * symmetrical dog head at that size is a circle with two bumps; the hanging ear
 * is the one feature that still reads when everything else has collapsed.
 *
 * Every mood shares one 72×72 viewBox, including the moods that use none of the
 * outer margin. That is deliberate: swapping mood in place — an empty state
 * becoming a result, a form becoming a confirmation — must not shift the mark a
 * single pixel. A tighter box per mood would save a little space and make the
 * dog jump every time it changed its mind.
 *
 * Decorative by default. The surrounding copy always says what the state means,
 * so a screen reader announcing "dog, thinking" on top of "No dogs match your
 * filters" is noise. Pass `label` for the rare case where the mark is the only
 * thing carrying the message.
 */

const INK = '#2F6B5C' // brand — the line
const FILL = '#E3EFE9' // brand.soft — flat fills under the line
const FACE = '#FFFCF7' // paper — the head, so it reads against a card
const POP = '#E8734A' // accent — props only, never the dog itself
const WASH = '#FDEEE7' // accent.soft — the offset misregistration

const HEAD =
  'M35 16C45 16 52 23.5 52 33.5 52 44 44.5 51.5 35 51.5 25.5 51.5 18 44 18 33.5 18 23.5 25 16 35 16Z'
const EAR_UP = 'M22.5 22C19 14.5 17.6 9.4 19.6 8.2 21.6 7 25.8 11.4 30 16.6Z'
const EAR_FOLD =
  'M47.5 20.5C53.5 19 57.6 23.6 57.6 31.4 57.6 39.4 53.8 44.6 49.6 45 48 40.6 47.2 28.4 47.5 20.5Z'
const MUZZLE =
  'M35 35.5C42 35.5 46.5 38.6 46.5 42.8 46.5 47.4 41.2 50.2 35 50.2 28.8 50.2 23.5 47.4 23.5 42.8 23.5 38.6 28 35.5 35 35.5Z'
const NOSE =
  'M35 36.4C37.7 36.4 39.9 38 39.9 39.7 39.9 41.4 37.7 42.3 35 42.3 32.3 42.3 30.1 41.4 30.1 39.7 30.1 38 32.3 36.4 35 36.4Z'

export const SAGE_MOODS = [
  'happy',
  'waving',
  'thinking',
  'sleeping',
  'confused',
  'celebrating',
] as const

export type SageMood = (typeof SAGE_MOODS)[number]

/** The head-tilt. It carries thinking and confused almost on its own. */
const TILT: Partial<Record<SageMood, number>> = { thinking: -9, confused: 11, sleeping: 5 }

function Eyes({ mood }: { mood: SageMood }) {
  if (mood === 'sleeping') {
    return (
      <g fill="none" stroke={INK} strokeWidth="2.1" strokeLinecap="round">
        <path d="M25 31.6q3.2 3.2 6.4 0" />
        <path d="M38.6 31.6q3.2 3.2 6.4 0" />
      </g>
    )
  }
  if (mood === 'celebrating') {
    return (
      <g fill="none" stroke={INK} strokeWidth="2.1" strokeLinecap="round">
        <path d="M25 32.2q3.2-3.6 6.4 0" />
        <path d="M38.6 32.2q3.2-3.6 6.4 0" />
      </g>
    )
  }
  if (mood === 'thinking') {
    return (
      <g fill={INK}>
        <circle cx="28.2" cy="30" r="2.5" />
        <circle cx="41.8" cy="30" r="2.5" />
      </g>
    )
  }
  if (mood === 'confused') {
    // Mismatched pupils. Cheaper than a raised brow and it survives at 26px.
    return (
      <g fill={INK}>
        <circle cx="28.2" cy="31.2" r="3.1" />
        <circle cx="41.8" cy="31.2" r="2" />
      </g>
    )
  }
  return (
    <g fill={INK}>
      <circle cx="28.2" cy="31.2" r="2.7" />
      <circle cx="41.8" cy="31.2" r="2.7" />
    </g>
  )
}

function Mouth({ mood }: { mood: SageMood }) {
  if (mood === 'celebrating') {
    return (
      <path
        d="M30.6 43.6q4.4 5 8.8 0"
        fill={POP}
        stroke={INK}
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    )
  }
  if (mood === 'confused') {
    return (
      <path
        d="M31 44.6q2-1.9 3.9 0 1.9 1.9 3.8 0"
        fill="none"
        stroke={INK}
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    )
  }
  if (mood === 'sleeping') {
    return (
      <path d="M32.6 44.4h4.8" fill="none" stroke={INK} strokeWidth="1.8" strokeLinecap="round" />
    )
  }
  return (
    <path
      d="M35 42.4v1.7M31.2 44.2q3.8 3.2 7.6 0"
      fill="none"
      stroke={INK}
      strokeWidth="1.8"
      strokeLinecap="round"
    />
  )
}

/**
 * Props sit outside the tilted group. Rotating a question mark along with the
 * head makes it look like it fell over rather than like the dog is thinking.
 */
function Props({ mood }: { mood: SageMood }) {
  if (mood === 'waving') {
    return (
      <g fill={POP} stroke={INK} strokeWidth="1.6" strokeLinejoin="round">
        <path d="M62.4 54.4c4.2 0 6.8 2.6 6.8 5.6 0 3.2-3 5-6.8 5s-6.8-1.8-6.8-5c0-3 2.6-5.6 6.8-5.6Z" />
        <circle cx="56.6" cy="50.6" r="2.5" />
        <circle cx="62.4" cy="48.6" r="2.6" />
        <circle cx="68.2" cy="50.6" r="2.5" />
      </g>
    )
  }
  if (mood === 'thinking') {
    return (
      <g fill={POP}>
        <circle cx="57.5" cy="14" r="2.1" />
        <circle cx="63.5" cy="9" r="1.6" opacity=".75" />
        <circle cx="69" cy="4.6" r="1.2" opacity=".5" />
      </g>
    )
  }
  if (mood === 'sleeping') {
    return (
      <g fill="none" stroke={INK} strokeLinecap="round" strokeLinejoin="round">
        <path d="M55 12h7l-7 8h7" strokeWidth="1.7" />
        <path d="M64.5 3.5h4.6l-4.6 5.2h4.6" strokeWidth="1.4" />
      </g>
    )
  }
  if (mood === 'confused') {
    return (
      <g>
        <path
          d="M58.4 12.4c0-2.4 2-3.9 4-3.9s3.7 1.4 3.7 3.2c0 2.8-3.7 2.8-3.7 5.6"
          fill="none"
          stroke={POP}
          strokeWidth="1.9"
          strokeLinecap="round"
        />
        <circle cx="62.2" cy="21.6" r="1.4" fill={POP} />
      </g>
    )
  }
  if (mood === 'celebrating') {
    return (
      <g stroke={POP} strokeLinecap="round">
        <path d="M8 15l3 3M11 15l-3 3" strokeWidth="1.7" />
        <path d="M56 25l2 2M58 25l-2 2" strokeWidth="1.5" />
        <circle cx="62" cy="9" r="2" fill={POP} stroke="none" />
        <circle cx="12" cy="42" r="1.5" fill={POP} stroke="none" opacity=".8" />
      </g>
    )
  }
  return null
}

export default function Sage({
  mood = 'happy',
  size = 64,
  className,
  label,
}: {
  mood?: SageMood
  size?: number
  className?: string
  /** Omit for decorative use. Supply only when the mark alone carries meaning. */
  label?: string
}) {
  const tilt = TILT[mood] ?? 0
  const a11y = label
    ? { role: 'img' as const, 'aria-label': label }
    : { 'aria-hidden': true as const, focusable: false as const }

  return (
    <svg
      viewBox="0 0 72 72"
      width={size}
      height={size}
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      {...a11y}
    >
      <g transform={tilt ? `rotate(${tilt} 35 34)` : undefined}>
        {/* The offset wash — a risograph misregistration, and the reason the
            mark reads as printed rather than as clip art. */}
        <g opacity=".55" transform="translate(-2.6 2.4)" fill={WASH}>
          <path d={EAR_UP} />
          <path d={EAR_FOLD} />
          <path d={HEAD} />
        </g>
        <g fill="none" stroke={INK} strokeWidth="2.2" strokeLinejoin="round">
          <path d={EAR_UP} fill={FILL} />
          <path d={EAR_FOLD} fill={FILL} />
          <path d={HEAD} fill={FACE} />
          <path d={MUZZLE} fill={FILL} />
        </g>
        <path d={NOSE} fill={INK} />
        <Eyes mood={mood} />
        <Mouth mood={mood} />
      </g>
      <Props mood={mood} />
    </svg>
  )
}
