import { test, expect } from '@playwright/test'

test('signup shows the email confirmation prompt instead of the dashboard', async ({ page }) => {
  // This Supabase project requires email confirmation (mailer_autoconfirm: false),
  // so signUp() returns a user with no session — the page must show a pending-confirmation
  // message rather than redirecting to /dashboard.
  const uniqueEmail = `e2e-test-${Date.now()}@gmail.com`

  await page.goto('/signup')
  await page.fill('input[name="displayName"]', 'E2E Test Owner')
  await page.fill('input[name="email"]', uniqueEmail)
  await page.fill('input[name="password"]', 'testpassword123')
  await page.check('input[name="isAdult"]')
  await page.click('button[type="submit"]')

  // A real page rather than a state swap, so it survives a refresh and can be
  // measured as a conversion. It echoes the address back and offers a resend.
  await expect(page).toHaveURL(/\/thank-you\?from=signup/)
  await expect(page.locator('text=Check your email')).toBeVisible()
  await expect(page.locator(`text=${uniqueEmail}`)).toBeVisible()
  await expect(page.getByRole('button', { name: /send it again/i })).toBeVisible()
})

test('confirmed owner can add a dog and see health verification status', async ({ page }) => {
  const email = process.env.E2E_FIXTURE_EMAIL
  const password = process.env.E2E_FIXTURE_PASSWORD
  if (!email || !password) {
    throw new Error('E2E_FIXTURE_EMAIL/E2E_FIXTURE_PASSWORD must be set in .env.local')
  }

  await page.goto('/login')
  await page.fill('input[name="email"]', email)
  await page.fill('input[name="password"]', password)
  await page.click('button[type="submit"]')

  await expect(page).toHaveURL(/\/dashboard/)

  const dogName = `Test Dog ${Date.now()}`
  await page.click('text=Add a dog')
  await page.fill('input[name="name"]', dogName)
  await page.selectOption('select[name="breedId"]', { index: 1 })
  await page.selectOption('select[name="sex"]', 'male')
  await page.fill('input[name="birthDate"]', '2023-01-15')
  await page.click('button[type="submit"]')

  await expect(page).toHaveURL(/\/dashboard/)
  await page.click(`text=${dogName}`)

  await expect(page.locator('text=Health verification pending')).toBeVisible()
})
