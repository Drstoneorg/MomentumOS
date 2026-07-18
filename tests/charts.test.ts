import { describe, it, expect } from "vitest"
import { dailyCounts, sparklinePoints, lastPoint } from "../src/lib/charts"

const now = new Date("2026-07-18T12:00:00Z")

describe("dailyCounts", () => {
  it("bündelt Ereignisse pro Tag, älteste zuerst", () => {
    const out = dailyCounts(
      ["2026-07-18T08:00:00Z", "2026-07-18T09:00:00Z", "2026-07-16T10:00:00Z"],
      3,
      now
    )
    expect(out).toEqual([1, 0, 2])
  })
  it("ignoriert null und kaputte Daten", () => {
    expect(dailyCounts([null, undefined, "quatsch", "2026-07-18T00:00:00Z"], 2, now)).toEqual([0, 1])
  })
  it("Ereignisse außerhalb des Fensters zählen nicht", () => {
    expect(dailyCounts(["2026-07-01T00:00:00Z"], 3, now)).toEqual([0, 0, 0])
  })
})

describe("sparklinePoints", () => {
  it("normalisiert auf die viewBox und invertiert y", () => {
    const pts = sparklinePoints([0, 10], 100, 28, 2)
    expect(pts).toBe("2,26 98,2")
  })
  it("flache Serie wird Mittellinie, nicht Nulllinie", () => {
    const pts = sparklinePoints([5, 5, 5], 100, 28, 2)
    for (const p of pts.split(" ")) expect(p.endsWith(",14")).toBe(true)
  })
  it("leer → leerer String", () => {
    expect(sparklinePoints([])).toBe("")
  })
})

describe("lastPoint", () => {
  it("liefert den letzten Punkt", () => {
    expect(lastPoint("2,26 50,14 98,2")).toEqual({ x: 98, y: 2 })
  })
  it("leer → null", () => {
    expect(lastPoint("")).toBeNull()
  })
})
