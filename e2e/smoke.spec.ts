import { test, expect } from '@playwright/test'

/**
 * Smoke checks that need no credentials: the public pages render and the
 * proxy sends anonymous visitors of protected routes to sign-in.
 */

test('landing page renders', async ({ page }) => {
  await page.goto('/')
  await expect(page).toHaveTitle(/Doko/)
  await expect(page.getByRole('link', { name: /sign in/i }).first()).toBeVisible()
})

test('sign-in page renders the Google button', async ({ page }) => {
  await page.goto('/sign-in')
  await expect(page.getByRole('button', { name: /continue with google/i })).toBeVisible()
})

test('protected routes redirect anonymous visitors to sign-in with a redirect param', async ({ page }) => {
  await page.goto('/backlog')
  await expect(page).toHaveURL(/\/sign-in\?redirect=%2Fbacklog/)
})

test('JWKS endpoint answers (500 without keys configured, never 404)', async ({ request }) => {
  const res = await request.get('/.well-known/jwks.json')
  expect([200, 500]).toContain(res.status())
})
