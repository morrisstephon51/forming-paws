import { test, expect, chromium } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'

// Deletes any pre-existing interest expressed by `email`'s dog(s) toward
// `otherDogName`, so a prior run of this test doesn't leave a mutual
// interest in place that trips the dog_interests_unique constraint on the
// next run's "Express Interest" click. Uses a plain Node-side supabase-js
// client (not the app's browser wrapper) since this happens outside the UI.
async function withdrawExistingInterest(email: string, password: string, otherDogName: string) {
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
  const { error: signInError } = await supabase.auth.signInWithPassword({ email, password })
  if (signInError) throw signInError
  const { data: myDogs } = await supabase.from('dogs').select('id, name')
  const { data: otherDogs } = await supabase.from('dogs_browsable').select('id, name').eq('name', otherDogName)
  const otherDogId = otherDogs?.[0]?.id
  if (otherDogId) {
    for (const dog of myDogs ?? []) {
      await supabase.from('dog_interests').delete().eq('expressing_dog_id', dog.id).eq('target_dog_id', otherDogId)
    }
  }
  await supabase.auth.signOut()
}

test('two verified owners browse, express mutual interest, and see a match', async () => {
  const emailA = process.env.E2E_FIXTURE_EMAIL
  const passwordA = process.env.E2E_FIXTURE_PASSWORD
  const emailB = process.env.E2E_FIXTURE_B_EMAIL
  const passwordB = process.env.E2E_FIXTURE_B_PASSWORD
  if (!emailA || !passwordA || !emailB || !passwordB) {
    throw new Error('E2E fixture env vars must be set in .env.local')
  }

  // Clean up any leftover interest from a prior run of this same test so
  // it's safe to re-run without manual DB intervention.
  await withdrawExistingInterest(emailA, passwordA, 'Fixture Dog B')
  await withdrawExistingInterest(emailB, passwordB, 'Fixture Dog A')

  const browser = await chromium.launch()
  const contextA = await browser.newContext({ baseURL: 'http://localhost:3000' })
  const contextB = await browser.newContext({ baseURL: 'http://localhost:3000' })
  const pageA = await contextA.newPage()
  const pageB = await contextB.newPage()

  await pageA.goto('/login')
  await pageA.fill('input[name="email"]', emailA)
  await pageA.fill('input[name="password"]', passwordA)
  await pageA.click('button[type="submit"]')
  await expect(pageA).toHaveURL(/\/home/)

  await pageB.goto('/login')
  await pageB.fill('input[name="email"]', emailB)
  await pageB.fill('input[name="password"]', passwordB)
  await pageB.click('button[type="submit"]')
  await expect(pageB).toHaveURL(/\/home/)

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
