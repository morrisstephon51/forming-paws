import { test, expect, type Page } from '@playwright/test'

/**
 * Signed-out sitewide guards.
 *
 * Deliberately no fixtures and no sign-in: the signed-in specs share one
 * Supabase project with a low auth rate limit, and a full-suite run can flake
 * purely from contention. These checks need no session, so they never pay that.
 *
 * What they are here to catch is the class of bug that global changes cause and
 * that nothing else notices -- the root layout, the site header and globals.css
 * reach all 26 pages at once, and a regression there renders perfectly, throws
 * nothing, and is invisible to unit tests.
 */

const PUBLIC = [
  '/', '/about', '/app', '/contact', '/donate', '/education',
  '/education/health-documents', '/faq', '/login', '/privacy',
  '/signup', '/terms', '/vets',
]

/**
 * The header is painted over, not missing.
 *
 * The landing page's worldflight stage is `position: fixed; inset: 0` at
 * z-index 1. The header used to be `position: static`, so it never entered the
 * stacking comparison and the stage won: every nav link, "Log in" and "Join
 * free" was unclickable on the one page every visitor lands on. It shipped to
 * production that way, because the links still looked and read perfectly
 * normal and nothing threw. toBeVisible() would have passed too -- the element
 * IS visible, it just cannot be reached by a pointer. Only hit-testing catches
 * this, so this test hit-tests.
 */
async function topmostAt(page: Page, selector: string) {
  return page.evaluate((sel) => {
    const el = document.querySelector(sel) as HTMLElement | null
    if (!el) return 'MISSING'
    const r = el.getBoundingClientRect()
    const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2)
    if (!hit) return 'NO_HIT'
    return el === hit || el.contains(hit) || hit.contains(el) ? 'REACHABLE' : hit.tagName + '.' + String((hit as HTMLElement).className).slice(0, 40)
  }, selector)
}

test('header links are actually clickable, including over the landing flight', async ({ page }) => {
  for (const path of ['/', '/about', '/login']) {
    await page.goto(path)
    await page.waitForTimeout(1200)
    expect(
      await topmostAt(page, 'header a[href="/login"]'),
      `${path}: the header "Log in" link must be reachable by a pointer, not painted over`
    ).toBe('REACHABLE')
    expect(
      await topmostAt(page, 'header a[href="/signup"]'),
      `${path}: the header "Join free" link must be reachable by a pointer`
    ).toBe('REACHABLE')
  }
})

test('every public page says what this is, above the fold', async ({ page }) => {
  // lib/positioning places the answer by rule. A copy edit that drops it from
  // the header would otherwise be silent.
  for (const path of PUBLIC) {
    await page.goto(path)
    await expect(
      page.locator('header').getByText('Health-verified breeding matches, owner to owner'),
      `${path} must carry the plain answer in its header`
    ).toBeVisible()
  }
})

test('no public page scrolls sideways on a phone', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  for (const path of PUBLIC) {
    await page.goto(path)
    await page.waitForTimeout(400)
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth
    )
    expect(overflow, `${path} overflows horizontally by ${overflow}px at 390px`).toBeLessThanOrEqual(1)
  }
})

test('every public page has exactly one h1 and one main landmark', async ({ page }) => {
  for (const path of PUBLIC) {
    await page.goto(path)
    const counts = await page.evaluate(() => ({
      h1: document.querySelectorAll('h1').length,
      main: document.querySelectorAll('main').length,
    }))
    expect(counts.h1, `${path} must have exactly one h1`).toBe(1)
    expect(counts.main, `${path} must have exactly one main landmark`).toBe(1)
  }
})
