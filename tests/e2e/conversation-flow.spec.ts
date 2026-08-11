import { test, expect, type Page } from '@playwright/test'

const A = { email: process.env.E2E_FIXTURE_EMAIL!, password: process.env.E2E_FIXTURE_PASSWORD! }
const B = { email: process.env.E2E_FIXTURE_B_EMAIL!, password: process.env.E2E_FIXTURE_B_PASSWORD! }

async function signIn(page: Page, who: { email: string; password: string }) {
  await page.goto('/login')
  await page.fill('input[name="email"]', who.email)
  await page.fill('input[name="password"]', who.password)
  await page.click('button[type="submit"]')
  await page.waitForURL('**/dashboard')
}

async function openFirstThread(page: Page) {
  await page.goto('/matches')
  const first = page.locator('a[href^="/matches/"]').first()
  // If this is not visible the fixtures share no match, and every assertion
  // below would pass vacuously. Fail loudly instead.
  await expect(first, 'fixture owners must already share a match').toBeVisible()
  await first.click()
  await page.waitForURL(/\/matches\/[0-9a-f-]{36}/)
}

test('a message sent by one owner reaches the other', async ({ browser }) => {
  const body = `e2e hello ${Date.now()}`

  const ctxA = await browser.newContext()
  const pageA = await ctxA.newPage()
  await signIn(pageA, A)
  await openFirstThread(pageA)

  await pageA.fill('input[name="body"]', body)
  await pageA.getByRole('button', { name: 'Send' }).click()
  await expect(pageA.getByText(body)).toBeVisible({ timeout: 15_000 })

  const ctxB = await browser.newContext()
  const pageB = await ctxB.newPage()
  await signIn(pageB, B)
  await openFirstThread(pageB)
  await expect(pageB.getByText(body)).toBeVisible({ timeout: 15_000 })

  await ctxA.close()
  await ctxB.close()
})

test('closing a conversation removes the composer for both owners', async ({ browser }) => {
  const ctxA = await browser.newContext()
  const pageA = await ctxA.newPage()
  await signIn(pageA, A)
  await openFirstThread(pageA)

  await pageA.getByRole('button', { name: 'Close this conversation' }).click()
  await expect(pageA.getByText('You closed this conversation.')).toBeVisible({ timeout: 15_000 })
  await expect(pageA.locator('input[name="body"]')).toHaveCount(0)

  const ctxB = await browser.newContext()
  const pageB = await ctxB.newPage()
  await signIn(pageB, B)
  await openFirstThread(pageB)
  // The other party is never told who closed it.
  await expect(pageB.getByText('This conversation is no longer available.')).toBeVisible({
    timeout: 15_000,
  })
  await expect(pageB.getByText('You closed this conversation.')).toHaveCount(0)
  await expect(pageB.locator('input[name="body"]')).toHaveCount(0)

  // Restore the fixture so the suite is re-runnable.
  await pageA.reload()
  await pageA.getByRole('button', { name: 'Reopen conversation' }).click()
  await expect(pageA.locator('input[name="body"]')).toBeVisible({ timeout: 15_000 })

  await ctxA.close()
  await ctxB.close()
})
