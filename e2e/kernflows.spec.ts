import { test, expect } from "@playwright/test"
import { login } from "./helpers"

/**
 * Kern-Flows über den Smoke-Test hinaus: öffentliche Landing samt Formular-
 * Schutz, Kalender-Feed-Auth, und eingeloggt Kontakt-Anlage/-Löschung, Queue,
 * Dubletten-Seite und Frage-Chat-Stream. Schreibende Tests räumen hinter sich
 * auf (E2E-Test-…-Namen).
 */

const email = process.env.E2E_EMAIL
const password = process.env.E2E_PASSWORD

test.describe("öffentlich", () => {
  test("/model rendert ohne Login mit Pflicht-Häkchen", async ({ page }) => {
    await page.goto("/model")
    await expect(page).not.toHaveURL(/\/login/)
    await expect(page.getByText(/TFP/i).first()).toBeVisible()
    // Einwilligung + 18+ sind Pflicht-Checkboxen des Formulars
    expect(await page.locator('input[type="checkbox"][required]').count()).toBeGreaterThanOrEqual(2)
  })

  test("/api/apply: Honeypot schluckt, fehlende Einwilligung ist 400", async ({ request }) => {
    // Honeypot gefüllt → höflich "ok", nichts gespeichert
    const bot = await request.post("/api/apply", {
      data: { name: "E2E-Bot", website: "spam.example", consent: true, age: true },
    })
    expect(bot.status()).toBe(200)
    expect(await bot.json()).toEqual({ ok: true })

    const ohneConsent = await request.post("/api/apply", {
      data: { name: "E2E-Test", city: "Wien" },
    })
    expect(ohneConsent.status()).toBe(400)
  })

  test("Kalender-Feed verlangt Token", async ({ request }) => {
    expect((await request.get("/api/calendar")).status()).toBe(401)
    // Prod: 401 (Token falsch). Lokal ohne SUPABASE_SERVICE_ROLE_KEY: 500
    // („Server nicht konfiguriert“). Entscheidend ist: nie Kalenderdaten.
    const falsch = await request.get("/api/calendar?token=falsch")
    expect(falsch.status()).toBeGreaterThanOrEqual(400)
    expect(await falsch.text()).not.toContain("BEGIN:VCALENDAR")
  })
})

test.describe("eingeloggt", () => {
  test.describe.configure({ mode: "serial" })
  test.skip(!email || !password, "E2E_EMAIL/E2E_PASSWORD fehlen in .env.local")

  test("Kontakt anlegen, Avatar-Platzhalter sichtbar, wieder löschen", async ({ page }) => {
    await login(page, email!, password!)
    await page.goto("/contacts")
    await page.getByRole("button", { name: "+ Neues Match" }).click()
    await page.locator('input[name="name"]').fill("E2E-Test-Kontakt")
    await page.getByRole("button", { name: "Anlegen" }).click()
    await page.waitForURL(/\/contacts\/[0-9a-f-]+/, { timeout: 20_000 })
    await expect(page.getByText("E2E-Test-Kontakt").first()).toBeVisible()

    page.on("dialog", (d) => d.accept())
    await page.getByRole("button", { name: "Löschen" }).click()
    await page.waitForURL(/\/contacts$/, { timeout: 20_000 })
    await expect(page.getByText("E2E-Test-Kontakt")).toHaveCount(0)
  })

  test("Queue und Dubletten-Seite rendern", async ({ page }) => {
    await login(page, email!, password!)
    for (const path of ["/queue", "/contacts/dubletten"]) {
      const res = await page.goto(path)
      expect(res?.status(), `${path} ohne Serverfehler`).toBeLessThan(500)
      await expect(page.locator("body")).not.toContainText("Application error")
    }
    await expect(page.getByText(/Dubletten/i).first()).toBeVisible()
  })

  test("Frage-Chat streamt eine Antwort-Blase", async ({ page }) => {
    await login(page, email!, password!)
    await page.goto("/ask")
    await page.locator("textarea").fill("Wie viele Kontakte habe ich?")
    await page.getByRole("button", { name: "Fragen" }).click()
    // Stream-Client muss eine Assistenten-Blase füllen — echte Antwort oder
    // sauber gemeldeter Fehler (lokal fehlt z.B. der DeepSeek-Key), aber nie
    // eine hängende leere Blase.
    await expect
      .poll(
        async () => {
          const blasen = page.locator("div.whitespace-pre-wrap")
          if ((await blasen.count()) === 0) return 0
          const text = await blasen.last().textContent()
          return text?.trim().length ?? 0
        },
        { timeout: 45_000 }
      )
      .toBeGreaterThan(0)
  })
})

test.describe("Einladungs-Links (öffentlich)", () => {
  test("Fantasie-Token zeigt neutrale Meldung, keine Event-Daten", async ({ page }) => {
    await page.goto("/einladung/deadbeefdeadbeefdeadbeefdeadbeef")
    await expect(page).not.toHaveURL(/\/login/)
    await expect(page.getByText(/Einladung nicht gefunden/i)).toBeVisible()
  })

  test("/api/rsvp: ungültiger Token wird nie ok, kaputter Body 400", async ({ request }) => {
    // Prod: 404. Lokal ohne SUPABASE_SERVICE_ROLE_KEY: 500 („Server nicht
    // konfiguriert“). Entscheidend: nie ok und nie ein Status geschrieben.
    const nix = await request.post("/api/rsvp", {
      data: { token: "deadbeefdeadbeefdeadbeefdeadbeef", antwort: "ja", plus_ones: 1 },
    })
    expect(nix.status()).toBeGreaterThanOrEqual(400)
    const kaputt = await request.post("/api/rsvp", { data: { token: "x", antwort: "vielleicht" } })
    expect(kaputt.status()).toBe(400)
  })
})
