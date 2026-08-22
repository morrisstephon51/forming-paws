import { test, expect } from '@playwright/test'

/**
 * The splash sizes itself as one screenful: 100svh minus the header above it
 * and the join bar fixed over the bottom. Both of those are CSS variables in
 * globals.css holding *measured* pixel heights, because neither element can be
 * observed from CSS — and the header's height is not even set by a media query.
 * It wraps from one row to two as the viewport narrows, at roughly 674px and
 * 466px, purely because the nav runs out of room.
 *
 * That makes --fp-header-h a snapshot of something that moves when the nav copy
 * or the brand lockup changes. When it drifts low, the splash is sized taller
 * than the space it has, and its last child — the scroll cue, the only
 * affordance saying there is a page below — renders underneath the join bar.
 * That is exactly the bug this file exists to catch: it shipped on every screen
 * 464px and narrower, and nothing failed.
 *
 * So this asserts the property that actually matters (the cue is reachable and
 * unobscured) rather than the numbers that implement it, and sweeps the widths
 * where the wraps happen so a drift of a few pixels is caught at the boundary.
 */

// Both header wrap points (~474, ~662) and the join bar breakpoint (639/640)
// are covered from both sides, plus the common phone widths in between.
const WIDTHS = [320, 360, 375, 390, 414, 430, 470, 476, 480, 600, 639, 640, 660, 664, 768, 1280]

test.describe('splash scroll cue clears the sticky join bar', () => {
  for (const width of WIDTHS) {
    test(`at ${width}px the cue is visible and unobscured`, async ({ page }) => {
      await page.setViewportSize({ width, height: 844 })
      await page.goto('/')

      const cue = page.locator('.fp-splash-cue')
      await expect(cue).toBeVisible()

      const geometry = await page.evaluate(() => {
        const cueEl = document.querySelector('.fp-splash-cue')!
        // The join bar carries no stable hook of its own, so it is found the
        // way a user meets it: the fixed thing pinned to the bottom edge.
        const bar = Array.from(document.querySelectorAll('div')).find((el) => {
          const style = getComputedStyle(el)
          const box = el.getBoundingClientRect()
          return (
            style.position === 'fixed' &&
            box.bottom >= window.innerHeight - 2 &&
            box.height > 20 &&
            box.height < 140
          )
        })
        return {
          cueBottom: cueEl.getBoundingClientRect().bottom,
          barTop: bar ? bar.getBoundingClientRect().top : null,
          viewportHeight: window.innerHeight,
        }
      })

      // Whatever the cue must stay above: the join bar where it renders, the
      // fold everywhere else. A cue below the fold on first paint is the same
      // failure — the visitor cannot see there is more page.
      const ceiling = geometry.barTop ?? geometry.viewportHeight
      expect(
        geometry.cueBottom,
        `cue overlaps by ${Math.round(geometry.cueBottom - ceiling)}px at ${width}px — ` +
          `--fp-header-h or --fp-joinbar-h in globals.css no longer matches the rendered chrome`,
      ).toBeLessThanOrEqual(ceiling)

      // The cue is a real link and has to stay operable, not merely on screen.
      await expect(cue).toHaveAttribute('href', '#start')
      await cue.click()
      await expect(page).toHaveURL(/#start$/)
    })
  }
})
