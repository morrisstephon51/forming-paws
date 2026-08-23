import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import Sage, { SAGE_MOODS } from '@/components/mascot/Sage'

/**
 * Two contracts DESIGN.md states about the mascot and nothing enforced.
 *
 * Both are real code branches — the mood switch draws different geometry, and
 * `label` picks between two different attribute sets — so both can regress
 * silently. The mark is in the footer of every page and in six empty states.
 */
describe('Sage', () => {
  const box = (mood: (typeof SAGE_MOODS)[number], size = 64) => {
    const { container } = render(<Sage mood={mood} size={size} />)
    const svg = container.querySelector('svg')!
    return {
      viewBox: svg.getAttribute('viewBox'),
      width: svg.getAttribute('width'),
      height: svg.getAttribute('height'),
    }
  }

  // "Swapping mood in place must not shift the mark a single pixel" — an empty
  // state becoming a result, a form becoming a confirmation. Asserted as
  // sameness across the set rather than against a hardcoded 72, so a mood that
  // draws itself a tighter box fails here even if someone updates the constant.
  it('gives every mood the identical box', () => {
    const boxes = SAGE_MOODS.map((mood) => box(mood))
    for (const b of boxes) expect(b).toEqual(boxes[0])
    expect(boxes[0].viewBox).toBe('0 0 72 72')
  })

  it('renders square at the requested size', () => {
    const { width, height } = box('happy', 96)
    expect(width).toBe('96')
    expect(height).toBe('96')
  })

  // Decorative by default: the surrounding copy always says what the state
  // means, so a screen reader announcing "dog, thinking" over "No dogs match
  // your filters" is noise. SageNote depends on this default being real.
  it('is hidden from assistive tech when no label is given', () => {
    const { container } = render(<Sage mood="thinking" />)
    const svg = container.querySelector('svg')!
    expect(svg).toHaveAttribute('aria-hidden', 'true')
    expect(svg).toHaveAttribute('focusable', 'false')
    expect(svg).not.toHaveAttribute('role')
    expect(svg).not.toHaveAttribute('aria-label')
  })

  it('becomes an announced image when the mark alone carries the message', () => {
    const { container } = render(<Sage mood="celebrating" label="Match confirmed" />)
    const svg = container.querySelector('svg')!
    expect(svg).toHaveAttribute('role', 'img')
    expect(svg).toHaveAttribute('aria-label', 'Match confirmed')
    expect(svg).not.toHaveAttribute('aria-hidden')
  })
})
