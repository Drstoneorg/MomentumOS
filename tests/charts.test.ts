import { describe, it, expect } from "vitest"
import { dailyCounts, sparklinePoints, lastPoint, scaledPoints } from "../src/lib/charts"

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

describe("scaledPoints", () => {
  it("nutzt die übergebene Skala statt der Serien-Extrema", () => {
    // Serie 5..10 auf Skala 0..20: y von 10 liegt bei der Hälfte
    const pts = scaledPoints([0, 10, 20], 0, 20, 100, 44, 2)
    const ys = pts.split(" ").map((p) => Number(p.split(",")[1]))
    expect(ys[0]).toBe(42) // min → unten
    expect(ys[2]).toBe(2) // max → oben
    expect(ys[1]).toBe(22) // Mitte
  })

  it("flache Serie liegt auf der Mittellinie", () => {
    const pts = scaledPoints([5, 5], 5, 5, 100, 40, 2)
    for (const p of pts.split(" ")) expect(Number(p.split(",")[1])).toBe(20)
  })
})
