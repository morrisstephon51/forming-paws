import { describe, it, expect, beforeAll } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { render, screen } from '@testing-library/react'
import SiteHeader from '@/components/SiteHeader'
import AuthShowcase from '@/components/auth/AuthShowcase'
import {
  WHAT_WE_DO,
  WHAT_WE_DO_SHORT,
  WHAT_WE_DO_PLAIN,
  HERO_HEADLINE,
} from '@/lib/positioning'
import { SITE_TITLE } from '@/lib/site'

/**
 * Guards the two rules this work exists to enforce.
 *
 * 1. The answer to "what do you actually do" is placed BY RULE in three
 *    surfaces, not wherever someone remembered. A copy edit that quietly drops
 *    one of them puts the site back where it started, and nothing else would
 *    catch it: the page still renders, the tests still pass, and the only
 *    symptom is a visitor asking the question again months later.
 *
 * 2. The auth pages never hide content behind the scrollcraft engine. That is
 *    not a style preference, it is an outage guard, and the reasoning is in the
 *    comment at the top of app/(auth)/login/page.tsx.
 */

/** Tilt3D reads matchMedia on mount, which jsdom does not implement. */
beforeAll(() => {
  if (!window.matchMedia) {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: (query: string) => ({
        matches: false,
        media: query,
        addEventListener: () => {},
        removeEventListener: () => {},
      }),
    })
  }
})

/**
 * Reads a project file as text.
 *
 * join(cwd) rather than a URL relative to import.meta.url: two of the paths
 * below contain a Next.js route group, and `new URL()` percent-encodes the
 * parentheses, which resolves to a file that does not exist.
 */
function source(path: string): string {
  return readFileSync(join(process.cwd(), path), 'utf8')
}

/**
 * The same file with its comments removed.
 *
 * The scrollcraft assertions below look for `data-sc-` as evidence that a
 * reveal attribute landed on a page that must never hide content. Several of
 * these files *explain in a comment* why they carry no such attribute, and that
 * prose contains the string -- so a naive substring check fails on the very
 * documentation that records the rule. Strip comments, then assert on markup.
 */
function markup(path: string): string {
  return source(path)
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '')
}

describe('the plain answer, placed by rule', () => {
  it('renders in the site header on public pages', () => {
    render(<SiteHeader variant="public" />)
    expect(screen.getByText(WHAT_WE_DO_SHORT)).toBeInTheDocument()
  })

  it('stays out of the member header, where it would be permanent furniture', () => {
    render(<SiteHeader variant="member" pathname="/home" />)
    expect(screen.queryByText(WHAT_WE_DO_SHORT)).toBeNull()
  })

  it('is the landing hero headline, from the shared constant', () => {
    // Read as source rather than rendered: WorldflightHero mounts the engine
    // and a worldflight, neither of which belongs in a unit test.
    expect(source('components/homepage/WorldflightHero.tsx')).toContain('HERO_HEADLINE')
  })

  it('is the band under the worldflight, and that band has no scroll device', () => {
    const page = source('app/page.tsx')
    expect(page).toContain('WHAT_WE_DO')
    expect(page).toContain('WHAT_WE_DO_PLAIN')

    // The band must survive a dead engine, since it IS the answer. Isolate the
    // band and assert no reveal attribute landed inside it.
    const start = page.indexOf('aria-labelledby="what-we-do"')
    expect(start).toBeGreaterThan(-1)
    const band = page.slice(start, page.indexOf('</section>', start))
    expect(band.replace(/\{\/\*[\s\S]*?\*\/\}/g, '')).not.toContain('data-sc-')
  })

  it('reaches both auth pages, which are many visitors’ first', () => {
    for (const path of ['app/(auth)/login/page.tsx', 'app/(auth)/signup/page.tsx']) {
      expect(source(path)).toContain('WHAT_WE_DO')
    }
  })
})

describe('the title says what this is', () => {
  it('names the product category, not just a tagline', () => {
    // "Forming Paws: Healthy Matches. Happy Litters." never said "dog". A tab,
    // a search result and a pasted link are all places people arrive, and they
    // arrived unable to tell what this was.
    expect(SITE_TITLE).toContain('Forming Paws')
    expect(SITE_TITLE.toLowerCase()).toContain('dog')
    expect(SITE_TITLE.toLowerCase()).toContain('health-verified')
  })

  it('fits a search result without truncation', () => {
    expect(SITE_TITLE.length).toBeLessThanOrEqual(60)
  })

  it('is defined once and reused, not retyped per meta tag', () => {
    const layout = source('app/layout.tsx')
    expect(layout).not.toContain('Healthy Matches. Happy Litters.')
    // title.default, openGraph.title and twitter.title all read the constant.
    expect(layout.match(/SITE_TITLE/g)?.length ?? 0).toBeGreaterThanOrEqual(4)
  })
})

describe('rendered copy conventions', () => {
  it('uses no em dashes, which this project reserves for code comments', () => {
    for (const line of [WHAT_WE_DO, WHAT_WE_DO_SHORT, WHAT_WE_DO_PLAIN, HERO_HEADLINE]) {
      expect(line).not.toContain('—')
    }
  })

  it('names the product and says it is free, which is the literal question asked', () => {
    expect(WHAT_WE_DO).toContain('Forming Paws')
    expect(WHAT_WE_DO).toContain('free')
    expect(WHAT_WE_DO).toContain('health-verified')
  })
})

describe('auth pages never hide content behind the engine', () => {
  it('carries no scrollcraft reveal attributes', () => {
    // scrollcraft.css hides [data-sc-in] unconditionally and its engine mounts
    // once per full page load with no re-scan. A visitor who lands on the
    // homepage and then follows the header's client-side "Log in" link would
    // reach a page whose revealed elements were never bound. On the login form
    // that is an outage, not a missing animation.
    for (const path of [
      'app/(auth)/login/page.tsx',
      'app/(auth)/signup/page.tsx',
      'components/auth/AuthScene.tsx',
      'components/auth/AuthShowcase.tsx',
    ]) {
      expect(markup(path)).not.toContain('data-sc-')
    }
  })

  it('depends on no scrollcraft asset', () => {
    for (const path of ['app/(auth)/login/page.tsx', 'app/(auth)/signup/page.tsx']) {
      expect(markup(path)).not.toContain('scrollcraft/scrollcraft')
    }
  })
})

describe('the auth showcase shows mechanics, never a fabricated record', () => {
  it('renders the three things the platform actually does', () => {
    render(<AuthShowcase />)
    expect(screen.getByText(/Records go in, privately/)).toBeInTheDocument()
    expect(screen.getByText(/A person reviews them/)).toBeInTheDocument()
    expect(screen.getByText(/you see who is nearby/)).toBeInTheDocument()
  })

  it('numbers the panels only when asked', () => {
    const { unmount } = render(<AuthShowcase />)
    expect(screen.queryByText('1')).toBeNull()
    unmount()

    render(<AuthShowcase numbered />)
    expect(screen.getByText('1')).toBeInTheDocument()
    expect(screen.getByText('3')).toBeInTheDocument()
  })

  it('hand-writes no verified mark, per the rule in components/record/Mark.tsx', () => {
    // "A mark must be derivable from data the platform actually holds... Never
    // hand-write a `verified` mark into a template." An illustrated dog stamped
    // Verified would break that rule on the page where a member decides whether
    // to trust us with their vet paperwork.
    const showcase = source('components/auth/AuthShowcase.tsx')
    expect(showcase).not.toMatch(/from '@\/components\/record\/Mark'/)
    expect(showcase).not.toMatch(/<Mark\s/)

    render(<AuthShowcase />)
    expect(screen.queryByText(/^Verified$/)).toBeNull()
  })
})
