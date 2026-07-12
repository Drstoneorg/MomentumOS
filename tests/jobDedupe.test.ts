import { describe, it, expect } from "vitest"
import { normalizeJobUrl, jobKey } from "@/lib/jobDedupe"

describe("normalizeJobUrl", () => {
  it("entfernt Tracking-Parameter, behält Job-ID-Parameter", () => {
    expect(normalizeJobUrl("https://indeed.de/viewjob?jk=abc123&utm_source=x&ref=mail")).toBe(
      normalizeJobUrl("https://indeed.de/viewjob?jk=abc123")
    )
    // verschiedene Job-IDs bleiben verschieden
    expect(normalizeJobUrl("https://indeed.de/viewjob?jk=abc")).not.toBe(
      normalizeJobUrl("https://indeed.de/viewjob?jk=def")
    )
  })

  it("www/https/Trailing-Slash egal", () => {
    expect(normalizeJobUrl("http://www.karriere.at/jobs/123/")).toBe(
      normalizeJobUrl("https://karriere.at/jobs/123")
    )
  })

  it("null bleibt null", () => {
    expect(normalizeJobUrl(null)).toBeNull()
    expect(normalizeJobUrl(undefined)).toBeNull()
  })
})

describe("jobKey", () => {
  it("ignoriert (m/w/d)-Varianten und Satzzeichen", () => {
    expect(jobKey("ACME GmbH", "Senior Developer (m/w/d)")).toBe(
      jobKey("acme gmbh", "Senior   Developer")
    )
    expect(jobKey("ACME", "Data Engineer (w/m/x)")).toBe(jobKey("Acme", "Data-Engineer"))
  })

  it("verschiedene Titel bleiben verschieden", () => {
    expect(jobKey("ACME", "Frontend Dev")).not.toBe(jobKey("ACME", "Backend Dev"))
  })
})
