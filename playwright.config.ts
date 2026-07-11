import { defineConfig } from "@playwright/test"
import { config } from "dotenv"

// E2E_EMAIL / E2E_PASSWORD aus .env.local für den Login-Test
config({ path: ".env.local" })

export default defineConfig({
  testDir: "./e2e",
  timeout: 45_000,
  retries: 0,
  use: {
    baseURL: "http://localhost:3000",
    screenshot: "only-on-failure",
  },
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000",
    reuseExistingServer: true,
    timeout: 60_000,
  },
})
