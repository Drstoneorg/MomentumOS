import { describe, it, expect, afterEach } from "vitest"
import { cronAuthError } from "../src/lib/cronHeartbeat"

const req = (auth?: string) =>
  new Request("https://example.test/api/cron/digest", {
    headers: auth ? { authorization: auth } : {},
  })

afterEach(() => {
  delete process.env.CRON_SECRET
})

describe("cronAuthError", () => {
  it("ohne CRON_SECRET: 503 statt ungeschützt laufen (fail-closed)", () => {
    const res = cronAuthError(req("Bearer irgendwas"))
    expect(res?.status).toBe(503)
  })

  it("falscher oder fehlender Token: 401", () => {
    process.env.CRON_SECRET = "geheim"
    expect(cronAuthError(req())?.status).toBe(401)
    expect(cronAuthError(req("Bearer falsch"))?.status).toBe(401)
    expect(cronAuthError(req("geheim"))?.status).toBe(401)
  })

  it("korrekter Token: null (Route läuft)", () => {
    process.env.CRON_SECRET = "geheim"
    expect(cronAuthError(req("Bearer geheim"))).toBeNull()
  })
})
