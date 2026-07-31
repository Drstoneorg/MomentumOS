import { test, expect, type Page } from "@playwright/test"

const BASE = "https://momentumos-hq.vercel.app"
const email = process.env.E2E_EMAIL!
const password = process.env.E2E_PASSWORD!

test("überfällige Follow-ups werden als überfällig ausgewiesen", async ({ page }: { page: Page }) => {
  test.setTimeout(240_000)

  await page.goto(`${BASE}/login`)
  await page.locator('input[type="email"]').fill(email)
  await page.locator('input[type="password"]').fill(password)
  await page.locator('form button[type="submit"]').click()
  await page.waitForURL((u) => !u.pathname.includes("login"), { timeout: 30_000 })

  await page.goto(`${BASE}/ask`)
  await page.locator("textarea").fill("Was steht in den nächsten 30 Tagen an?")
  await page.getByRole("button", { name: "Fragen" }).click()
  await expect(page.getByText("denkt nach")).toHaveCount(0, { timeout: 150_000 })

  const blase = page.locator("div.max-w-\\[95\\%\\]").last()
  const text = await blase.innerText()
  console.log("\n########## ANTWORT:\n" + text + "\n")
  expect((await blase.getAttribute("class")) ?? "").not.toContain("bg-red-950")
  expect(text.toLowerCase()).toContain("überfällig")

  await page.screenshot({ path: "ask-prod.png" })
})
