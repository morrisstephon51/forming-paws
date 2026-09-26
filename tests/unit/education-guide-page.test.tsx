import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

// next/image needs layout information this environment cannot give it, and the
// banner is decoration: these tests are about the notice and the sources.
vi.mock('@/components/art/BannerArt', () => ({ default: () => null }))

import GuidePage from '@/app/education/[slug]/page'
import { guideBySlug } from '@/lib/education'

async function renderGuide(slug: string) {
  return render(await GuidePage({ params: Promise.resolve({ slug }) }))
}

describe('guide page notices and sources', () => {
  it('warns a legal guide is not legal advice, not that it is not veterinary advice', async () => {
    await renderGuide('illinois-law')
    expect(screen.getByText('Not legal advice.')).toBeInTheDocument()
    expect(screen.queryByText('Not veterinary advice.')).toBeNull()
  })

  it('keeps the veterinary notice on the guides about care', async () => {
    await renderGuide('year-round-wellness')
    expect(screen.getByText('Not veterinary advice.')).toBeInTheDocument()
    expect(screen.queryByText('Not legal advice.')).toBeNull()
  })

  it('links every source of a guide that cites them', async () => {
    await renderGuide('illinois-law')
    const sources = guideBySlug('illinois-law')?.sources ?? []
    expect(sources.length).toBeGreaterThan(0)

    expect(screen.getByRole('heading', { name: 'Sources' })).toBeInTheDocument()
    for (const source of sources) {
      const link = screen.getByRole('link', { name: source.label })
      expect(link).toHaveAttribute('href', source.url)
      // Off-site, so it opens away from the guide, and rel keeps the opener out.
      expect(link).toHaveAttribute('rel', 'noopener noreferrer')
    }
  })

  it('renders no sources section on a guide that cites none', async () => {
    await renderGuide('health-documents')
    expect(guideBySlug('health-documents')?.sources).toBeUndefined()
    expect(screen.queryByRole('heading', { name: 'Sources' })).toBeNull()
  })
})
