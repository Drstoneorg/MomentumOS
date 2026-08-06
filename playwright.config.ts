import { defineConfig } from "@playwright/test"
import { config } from "dotenv"

// E2E_EMAIL / E2E_PASSWORD aus .env.local für den Login-Test
config({ path: ".env.local" })

// Port überschreibbar: reuseExistingServer würde sonst blind übernehmen, was
// gerade auf 3000 lauscht — auch ein fremdes Projekt.
const port = process.env.E2E_PORT || "3000"
const baseURL = `http://localhost:${port}`

export default defineConfig({
  testDir: "./e2e",
  timeout: 45_000,
  retries: 0,
  // Fehler-Screenshots zeigen echte Kontaktdaten und das Repo ist öffentlich —
  // Artefakte bleiben im gitignorierten .pwtmp, nie im Arbeitsverzeichnis-Root.
  outputDir: ".pwtmp/results",
  use: {
    baseURL,
    screenshot: "only-on-failure",
  },
  webServer: {
    command: `npm run dev -- --port ${port}`,
    url: baseURL,
    reuseExistingServer: true,
    timeout: 60_000,
  },
})
