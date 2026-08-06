import type { Page } from "@playwright/test"

/**
 * Login über das echte Formular. Seriell benutzen — parallele Logins triggern
 * das Supabase-Auth-Rate-Limit (bekannter Flake).
 */
export async function login(page: Page, email: string, password: string) {
  await page.goto("/login")
  await page.locator('input[type="email"]').fill(email)
  await page.locator('input[type="password"]').fill(password)
  await page.locator('form button[type="submit"], form button').first().click()
  await page.waitForURL((u) => !u.pathname.includes("login"), { timeout: 20_000 })
}
