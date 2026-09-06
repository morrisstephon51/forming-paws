import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import Mark, { markLabel, type MarkStatus } from '@/components/record/Mark'
import RecordLine from '@/components/record/RecordLine'

const ALL: MarkStatus[] = ['verified', 'pending', 'none']

describe('Mark', () => {
  it('renders all three states with distinct classes and accessible names', () => {
    for (const status of ALL) {
      const { unmount } = render(<Mark status={status} />)
      const el = screen.getByRole('img')
      expect(el).toHaveClass('fp-mark')
      expect(el).toHaveClass(`fp-mark--${status}`)
      expect(el).toHaveAttribute('data-mark', status)
      unmount()
    }
  })

  it('gives each state a different accessible name', () => {
    const names = ALL.map(markLabel)
    expect(new Set(names).size).toBe(ALL.length)
    expect(markLabel('none')).toBe('Not yet')
  })

  it('keeps caller classes without dropping its own', () => {
    render(<Mark status="verified" className="fp-record__mark" />)
    const el = screen.getByRole('img')
    expect(el).toHaveClass('fp-mark--verified')
    expect(el).toHaveClass('fp-record__mark')
  })
})

describe('RecordLine', () => {
  it('renders mark, label and value together', () => {
    render(<RecordLine status="verified" label="Hip screen" value="Rev 08-26" />)
    expect(screen.getByText('Hip screen')).toBeInTheDocument()
    expect(screen.getByText('Rev 08-26')).toBeInTheDocument()
    expect(screen.getByRole('img')).toHaveAttribute('data-mark', 'verified')
  })

  it('still renders the label when there is no value', () => {
    // A field that disappears when empty is how a site quietly stops
    // disclosing things. The label stays; only the value element goes.
    // The separator is a CSS ::before on the value, so it leaves with it.
    const { container } = render(<RecordLine status="pending" label="Partner vets" />)
    expect(screen.getByText('Partner vets')).toBeInTheDocument()
    expect(container.querySelector('.fp-record__value')).toBeNull()
  })

  it('treats an empty or whitespace value as no value', () => {
    const { container, rerender } = render(<RecordLine label="Records" value="" />)
    expect(container.querySelector('.fp-record__value')).toBeNull()
    rerender(<RecordLine label="Records" value="   " />)
    expect(container.querySelector('.fp-record__value')).toBeNull()
    rerender(<RecordLine label="Records" value={null} />)
    expect(container.querySelector('.fp-record__value')).toBeNull()
    // …and comes back when there is one, so the assertion above means something.
    rerender(<RecordLine label="Records" value="3" />)
    expect(container.querySelector('.fp-record__value')).toHaveTextContent('3')
  })

  it('omits the mark entirely for neutral metadata', () => {
    // No status means "this is a field, not a claim that someone checked it".
    render(<RecordLine label="Location" value="Logan Square" />)
    expect(screen.queryByRole('img')).toBeNull()
    expect(screen.getByText('Logan Square')).toBeInTheDocument()
  })

  it('publishes an absence as a first-class record', () => {
    render(<RecordLine status="none" label="501(c)(3) status" value="Not yet" />)
    expect(screen.getByRole('img')).toHaveAccessibleName('Not yet')
    expect(screen.getByText('501(c)(3) status')).toBeInTheDocument()
  })
})
