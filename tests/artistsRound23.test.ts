import { describe, it, expect } from "vitest"
import { parseSetSlot, slotsOverlap, gigStaleDays } from "../src/lib/artists"

describe("parseSetSlot", () => {
  it("einfache Stunden-Spanne", () => {
    expect(parseSetSlot("23–01")).toEqual({ start: 660, end: 780 })
  })
  it("mit Minuten und Bindestrich", () => {
    expect(parseSetSlot("23:30-01:00")).toEqual({ start: 690, end: 780 })
  })
  it("mit Uhr und bis", () => {
    expect(parseSetSlot("22 Uhr bis 0 Uhr")).toEqual({ start: 600, end: 720 })
  })
  it("Nachmittag bis Abend bleibt am selben Tag", () => {
    expect(parseSetSlot("18–20")).toEqual({ start: 360, end: 480 })
  })
  it("unlesbar → null", () => {
    expect(parseSetSlot("Headliner")).toBeNull()
    expect(parseSetSlot(null)).toBeNull()
    expect(parseSetSlot("")).toBeNull()
  })
  it("kaputte Stunde → null", () => {
    expect(parseSetSlot("25–27")).toBeNull()
  })
})

describe("slotsOverlap", () => {
  it("Überschneidung erkannt", () => {
    expect(slotsOverlap(parseSetSlot("23–01")!, parseSetSlot("00–02")!)).toBe(true)
  })
  it("Berührung Ende=Start ist kein Konflikt", () => {
    expect(slotsOverlap(parseSetSlot("23–01")!, parseSetSlot("01–03")!)).toBe(false)
  })
  it("getrennte Slots kein Konflikt", () => {
    expect(slotsOverlap(parseSetSlot("20–22")!, parseSetSlot("23–01")!)).toBe(false)
  })
})

describe("gigStaleDays", () => {
  const now = new Date("2026-07-18T12:00:00Z")
  it("inquired seit 6 Tagen → 6", () => {
    expect(gigStaleDays("inquired", "2026-07-12T12:00:00Z", now)).toBe(6)
  })
  it("negotiating seit 5 Tagen → 5 (Schwelle erreicht)", () => {
    expect(gigStaleDays("negotiating", "2026-07-13T12:00:00Z", now)).toBe(5)
  })
  it("frisch angefragt → null", () => {
    expect(gigStaleDays("inquired", "2026-07-16T12:00:00Z", now)).toBeNull()
  })
  it("andere Status nie überfällig", () => {
    expect(gigStaleDays("confirmed", "2026-07-01T12:00:00Z", now)).toBeNull()
    expect(gigStaleDays("idea", "2026-07-01T12:00:00Z", now)).toBeNull()
    expect(gigStaleDays("cancelled", "2026-07-01T12:00:00Z", now)).toBeNull()
  })
})
