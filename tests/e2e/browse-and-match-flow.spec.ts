import { test, expect, chromium } from '@playwright/test'

test('two verified owners browse, express mutual interest, and see a match', async () => {
  const emailA = process.env.E2E_FIXTURE_EMAIL
  const passwordA = process.env.E2E_FIXTURE_PASSWORD
  const emailB = process.env.E2E_FIXTURE_B_EMAIL
  const passwordB = process.env.E2E_FIXTURE_B_PASSWORD
  if (!emailA || !passwordA || !emailB || !passwordB) {
    throw new Error('E2E fixture env vars must be set in .env.local')
  }

  const browser = await chromium.launch()
  const contextA = await browser.newContext({ baseURL: 'http://localhost:3000' })
  const contextB = await browser.newContext({ baseURL: 'http://localhost:3000' })
  const pageA = await contextA.newPage()
  const pageB = await contextB.newPage()

  await pageA.goto('/login')
  await pageA.fill('input[name="email"]', emailA)
  await pageA.fill('input[name="password"]', passwordA)
  await pageA.click('button[type="submit"]')
  await expect(pageA).toHaveURL(/\/dashboard/)

  await pageB.goto('/login')
  await pageB.fill('input[name="email"]', emailB)
  await pageB.fill('input[name="password"]', passwordB)
  await pageB.click('button[type="submit"]')
  await expect(pageB).toHaveURL(/\/dashboard/)

  // Owner A browses and finds Owner B's dog
  await pageA.goto('/browse')
  await expect(pageA.locator('text=Fixture Dog B')).toBeVisible()
  await pageA.click('text=Fixture Dog B')
  await expect(pageA).toHaveURL(/\/dogs\//)
  await pageA.click('button:has-text("Express Interest")')
  await expect(pageA.locator('text=Interest expressed!')).toBeVisible()

  // Owner B browses and finds Owner A's dog, expresses interest back
  await pageB.goto('/browse')
  await expect(pageB.locator('text=Fixture Dog A')).toBeVisible()
  await pageB.click('text=Fixture Dog A')
  await expect(pageB).toHaveURL(/\/dogs\//)
  await pageB.click('button:has-text("Express Interest")')
  await expect(pageB.locator('text=Interest expressed!')).toBeVisible()

  // Both should now see a match
  await pageA.goto('/matches')
  await expect(pageA.locator('text=Fixture Dog A')).toBeVisible()
  await expect(pageA.locator('text=Fixture Dog B')).toBeVisible()

  await pageB.goto('/matches')
  await expect(pageB.locator('text=Fixture Dog A')).toBeVisible()
  await expect(pageB.locator('text=Fixture Dog B')).toBeVisible()

  await browser.close()
})
