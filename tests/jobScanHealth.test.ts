import { describe, it, expect } from "vitest"
import { scanWarnings } from "../src/lib/jobScanHealth"

const run = (portal: string, found: number, day: string) => ({
  portal,
  found,
  ran_at: `${day}T06:30:00Z`,
})

describe("scanWarnings", () => {
  it("3 Läufe mit 0 Treffern → Warnung", () => {
    const w = scanWarnings([
      run("karriere_at", 0, "2026-07-15"),
      run("karriere_at", 0, "2026-07-16"),
      run("karriere_at", 0, "2026-07-17"),
    ])
    expect(w).toHaveLength(1)
    expect(w[0].portal).toBe("karriere_at")
    expect(w[0].zeroRuns).toBe(3)
  })
  it("jüngster Lauf mit Treffern rettet das Portal", () => {
    const w = scanWarnings([
      run("jobs_at", 0, "2026-07-14"),
      run("jobs_at", 0, "2026-07-15"),
      run("jobs_at", 0, "2026-07-16"),
      run("jobs_at", 2, "2026-07-17"),
    ])
    expect(w).toHaveLength(0)
  })
  it("alte Treffer schützen nicht — nur die letzten 3 Läufe zählen", () => {
    const w = scanWarnings([
      run("mediajobs", 5, "2026-07-10"),
      run("mediajobs", 0, "2026-07-15"),
      run("mediajobs", 0, "2026-07-16"),
      run("mediajobs", 0, "2026-07-17"),
    ])
    expect(w).toHaveLength(1)
  })
  it("zu wenige Läufe → keine Aussage", () => {
    const w = scanWarnings([run("berlinstartupjobs", 0, "2026-07-17")])
    expect(w).toHaveLength(0)
  })
  it("mehrere Portale getrennt bewertet, alphabetisch sortiert", () => {
    const runs = [
      ...["2026-07-15", "2026-07-16", "2026-07-17"].map((d) => run("zeta", 0, d)),
      ...["2026-07-15", "2026-07-16", "2026-07-17"].map((d) => run("alpha", 0, d)),
      ...["2026-07-15", "2026-07-16", "2026-07-17"].map((d) => run("ok_portal", 1, d)),
    ]
    expect(scanWarnings(runs).map((w) => w.portal)).toEqual(["alpha", "zeta"])
  })
})
