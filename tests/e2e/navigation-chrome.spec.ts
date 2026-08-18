import { test, expect, type Page } from '@playwright/test'

const A = { email: process.env.E2E_FIXTURE_EMAIL!, password: process.env.E2E_FIXTURE_PASSWORD! }

async function signIn(page: Page) {
  await page.goto('/login')
  await page.fill('input[name="email"]', A.email)
  await page.fill('input[name="password"]', A.password)
  await page.click('button[type="submit"]')
  await page.waitForURL('**/home')
}

const memberBar = (page: Page) => page.getByRole('navigation', { name: 'Member shortcuts' })
const joinBar = (page: Page) => page.getByText('Free to join · health-verified matches near you')

test('every page carries a home link, signed out', async ({ page }) => {
  // The pages that had no header at all before the chrome moved into the layout.
  for (const path of ['/faq', '/contact', '/privacy', '/terms', '/login', '/signup', '/about']) {
    await page.goto(path)
    await expect(
      page.getByRole('navigation', { name: 'Main' }),
      `${path} must render the site nav`
    ).toBeVisible()
    await expect(
      page.locator('header a[href="/"]').first(),
      `${path} must offer a way home`
    ).toBeVisible()
  }
})

test('a signed-in member gets the tab bar and never the join bar', async ({ page }) => {
  await signIn(page)

  for (const path of ['/home', '/browse', '/matches', '/settings', '/faq', '/about']) {
    await page.goto(path)
    await expect(memberBar(page), `${path} must show the member tab bar`).toBeVisible()
    // The regression this guards: /faq, /contact and /app hard-coded the join
    // bar, so a member on those pages got two stacked fixed bottom bars.
    await expect(joinBar(page), `${path} must not also show the join bar`).toHaveCount(0)
  }
})

test('the tab bar keeps a Home button no matter where the carousel is', async ({ page }) => {
  await signIn(page)
  await page.goto('/browse')

  const home = memberBar(page).getByRole('link', { name: /home/i })
  await expect(home).toBeVisible()
  await expect(home).toHaveAttribute('href', '/home')

  // Drive the carousel forward through every slide; Home must survive all of it.
  const next = memberBar(page).getByRole('button', { name: 'Next shortcut' })
  for (let i = 0; i < 7; i++) {
    await next.click()
    await expect(home, 'Home must never rotate away').toBeVisible()
  }

  await home.click()
  await page.waitForURL('**/home')
})

test('a signed-in member visiting / is sent to their own home', async ({ page }) => {
  await signIn(page)
  await page.goto('/')
  await page.waitForURL('**/home')
})

test('a deactivated member gets no member navigation', async ({ page }) => {
  await signIn(page)

  try {
    await page.goto('/settings')
    await page.fill('input[name="confirmation"]', 'delete my account')
    await page.click('button:has-text("Delete account")')
    // deactivateAccount signs the member out and returns them to the landing page.
    await page.waitForURL(/\/\?deactivated=1|\/$/)

    await signIn2(page)
    await page.goto('/home')
    await page.waitForURL('**/account/reactivate')

    // The bug this guards: the layout rendered member chrome for a deactivated
    // member, so Home / Browse / Matches / Settings all bounced straight back
    // here — and the tab bar offered a fresh bounce every five seconds.
    await expect(
      memberBar(page),
      'a deactivated member must not be shown member shortcuts'
    ).toHaveCount(0)
    await expect(page.getByRole('link', { name: 'Browse' })).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Restore my account' })).toBeVisible()
  } finally {
    // Restore the fixture no matter what fails above, or every later run starts
    // from a deactivated account.
    await page.goto('/account/reactivate')
    const restore = page.getByRole('button', { name: 'Restore my account' })
    if (await restore.isVisible().catch(() => false)) {
      await restore.click()
      await page.waitForURL('**/home')
    }
  }
})

/** Sign in again after the deactivation signed us out. */
async function signIn2(page: Page) {
  await page.goto('/login')
  await page.fill('input[name="email"]', A.email)
  await page.fill('input[name="password"]', A.password)
  await page.click('button[type="submit"]')
  await page.waitForURL(/\/home|\/account\/reactivate/)
}
