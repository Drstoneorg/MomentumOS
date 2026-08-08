import { describe, expect, it } from "vitest"
import { gruppiereFehler, normalisiereFehlermeldung } from "@/lib/fehlerGruppen"

describe("normalisiereFehlermeldung", () => {
  it("ersetzt Zahlen, UUIDs und URLs durch Platzhalter", () => {
    expect(
      normalisiereFehlermeldung(
        "Failed to fetch https://example.com/api/x?id=42 for 550e8400-e29b-41d4-a716-446655440000 at line 133"
      )
    ).toBe("Failed to fetch ‹url› for ‹id› at line ‹n›")
  })

  it("macht gleiche Fehler mit anderen Details identisch", () => {
    const a = normalisiereFehlermeldung("Cannot read properties of undefined (reading 'x') at chunk 123")
    const b = normalisiereFehlermeldung("Cannot read properties of undefined (reading 'x') at chunk 456")
    expect(a).toBe(b)
  })

  it("kappt auf 160 Zeichen und trimmt Weißraum", () => {
    const lang = normalisiereFehlermeldung("  a".repeat(200))
    expect(lang.length).toBeLessThanOrEqual(160)
    expect(lang.startsWith("a")).toBe(true)
  })
})

describe("gruppiereFehler", () => {
  const z = (message: string, created_at: string) => ({ message, created_at })

  it("gruppiert und sortiert nach Häufigkeit", () => {
    const gruppen = gruppiereFehler([
      z("boom at line 1", "2026-08-08T10:00:00Z"),
      z("boom at line 2", "2026-08-08T11:00:00Z"),
      z("boom at line 3", "2026-08-08T09:00:00Z"),
      z("anderes Problem", "2026-08-08T12:00:00Z"),
    ])
    expect(gruppen).toHaveLength(2)
    expect(gruppen[0]).toEqual({ muster: "boom at line ‹n›", anzahl: 3, zuletzt: "2026-08-08T11:00:00Z" })
  })

  it("leere Liste bleibt leer", () => {
    expect(gruppiereFehler([])).toEqual([])
  })
})
