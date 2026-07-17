import { test, expect } from "@playwright/test"

/**
 * Smoke-Test: fängt kaputte Deploys (Login rendert, Kernseiten antworten ohne
 * Serverfehler). Login-Teil läuft nur, wenn E2E_EMAIL + E2E_PASSWORD in
 * .env.local stehen — ohne Creds wird er übersprungen, nicht rot.
 */

const email = process.env.E2E_EMAIL
const password = process.env.E2E_PASSWORD

test("Login-Seite rendert", async ({ page }) => {
  await page.goto("/login")
  await expect(page.locator('input[type="email"]')).toBeVisible()
  await expect(page.locator('input[type="password"]')).toBeVisible()
})

test("unauthentifiziert wird auf /login umgeleitet", async ({ page }) => {
  await page.goto("/")
  await expect(page).toHaveURL(/\/login/)
})

test.describe("eingeloggt", () => {
  test.skip(!email || !password, "E2E_EMAIL/E2E_PASSWORD fehlen in .env.local")

  test("Dashboard und Kernseiten rendern", async ({ page }) => {
    await page.goto("/login")
    await page.locator('input[type="email"]').fill(email!)
    await page.locator('input[type="password"]').fill(password!)
    await page.locator('form button[type="submit"], form button').first().click()
    await page.waitForURL((u) => !u.pathname.includes("login"), { timeout: 20_000 })

    await page.goto("/")
    await expect(page.getByText(/Heute dran/i)).toBeVisible()

    for (const path of ["/contacts", "/pipeline", "/jobs", "/moments", "/book/artists"]) {
      const res = await page.goto(path)
      expect(res?.status(), `${path} antwortet ohne Serverfehler`).toBeLessThan(500)
      await expect(page.locator("body")).not.toContainText("Application error")
    }
  })

  test("Artist-Booking: Artist anlegen und wieder löschen", async ({ page }) => {
    await page.goto("/login")
    await page.locator('input[type="email"]').fill(email!)
    await page.locator('input[type="password"]').fill(password!)
    await page.locator('form button[type="submit"], form button').first().click()
    await page.waitForURL((u) => !u.pathname.includes("login"), { timeout: 20_000 })

    await page.goto("/book/artists")
    await page.getByRole("button", { name: "+ Artist" }).click()
    await page.locator('input[name="name"]').fill("E2E-Test-Artist")
    await page.locator('input[name="genres"]').fill("Techno, EBM")
    await page.getByRole("button", { name: "Anlegen" }).click()
    await page.waitForURL(/\/book\/artists\/[0-9a-f-]+/, { timeout: 20_000 })
    await expect(page.getByRole("heading", { name: /E2E-Test-Artist/ })).toBeVisible()
    await expect(page.getByText("Techno")).toBeVisible()

    page.on("dialog", (d) => d.accept())
    await page.getByRole("button", { name: "Löschen" }).click()
    await page.waitForURL(/\/book\/artists$/, { timeout: 20_000 })
    await expect(page.getByText("E2E-Test-Artist")).toHaveCount(0)
  })
})
