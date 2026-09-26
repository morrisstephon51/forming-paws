import { describe, it, expect } from 'vitest'
import { GUIDES, guideBySlug, type Guide } from '@/lib/education'

/** The rate the reading times on the cards are derived from. */
const WORDS_PER_MINUTE = 200

function wordCount(guide: Guide): number {
  return guide.sections
    .flatMap((section) => [section.heading, ...section.body])
    .join(' ')
    .split(/\s+/)
    .filter(Boolean).length
}

describe('education guides', () => {
  it('gives every guide a unique, URL-safe slug', () => {
    const slugs = GUIDES.map((guide) => guide.slug)
    expect(new Set(slugs).size).toBe(slugs.length)
    for (const slug of slugs) expect(slug).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  })

  it('looks a guide up by slug, and finds nothing for one that does not exist', () => {
    expect(guideBySlug(GUIDES[0].slug)?.title).toBe(GUIDES[0].title)
    expect(guideBySlug('not-a-guide')).toBeUndefined()
  })

  it('gives every guide a title, a summary and sections with real prose', () => {
    for (const guide of GUIDES) {
      expect(guide.title.trim(), guide.slug).not.toBe('')
      expect(guide.summary.trim(), guide.slug).not.toBe('')
      expect(guide.sections.length, guide.slug).toBeGreaterThan(1)

      for (const section of guide.sections) {
        expect(section.heading.trim(), guide.slug).not.toBe('')
        expect(section.body.length, `${guide.slug}: ${section.heading}`).toBeGreaterThan(0)
        for (const paragraph of section.body) {
          expect(paragraph.trim().length, `${guide.slug}: ${section.heading}`).toBeGreaterThan(40)
        }
      }
    }
  })

  /**
   * The reading time is printed on the card and on the page. A stale one is a
   * small lie, and the words are right there to check it against. This test is
   * what caught the original three guides claiming 3 to 4 minutes for prose that
   * reads in under two.
   */
  it('states a reading time derived from the words, not from a guess', () => {
    for (const guide of GUIDES) {
      const words = wordCount(guide)
      const minutes = Math.max(1, Math.ceil(words / WORDS_PER_MINUTE))
      expect(
        guide.readingMinutes,
        `${guide.slug}: ${words} words is ${minutes} min at ${WORDS_PER_MINUTE} wpm`,
      ).toBe(minutes)
    }
  })

  it('carries a notice type the guide page knows how to render', () => {
    for (const guide of GUIDES) expect(['vet', 'legal'], guide.slug).toContain(guide.notice)
  })

  /**
   * The content-honesty rule, as a test. A page that tells an owner what a
   * statute requires has to show the statute; otherwise it is asking to be
   * trusted about the one thing it cannot be trusted on.
   */
  it('cites at least two sources on every guide that states the law', () => {
    const legal = GUIDES.filter((guide) => guide.notice === 'legal')
    expect(legal.length).toBeGreaterThan(0)
    for (const guide of legal) {
      expect(guide.sources?.length ?? 0, guide.slug).toBeGreaterThanOrEqual(2)
    }
  })

  it('gives every source a label and a working https URL, with no duplicates', () => {
    for (const guide of GUIDES) {
      const urls = (guide.sources ?? []).map((source) => source.url)
      expect(new Set(urls).size, guide.slug).toBe(urls.length)

      for (const source of guide.sources ?? []) {
        expect(source.label.trim(), guide.slug).not.toBe('')
        expect(() => new URL(source.url), `${guide.slug}: ${source.url}`).not.toThrow()
        expect(source.url.startsWith('https://'), `${guide.slug}: ${source.url}`).toBe(true)
      }
    }
  })

  /**
   * Illinois rules get cited to the General Assembly rather than to a summary of
   * it, because a summary can be wrong and cannot be checked against itself.
   */
  it('points the Illinois guide at the statute text itself', () => {
    const illinois = guideBySlug('illinois-law')
    expect(illinois?.notice).toBe('legal')
    expect(
      illinois?.sources?.filter((source) => source.url.includes('ilga.gov')).length ?? 0,
    ).toBeGreaterThanOrEqual(2)
  })
})
