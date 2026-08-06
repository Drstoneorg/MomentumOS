import { describe, it, expect } from "vitest"
import {
  kalenderWochen,
  freieWochenenden,
  blocktTermin,
  nextGigStatus,
  formatEuro,
  formatFeeRange,
  parseFeeInput,
  gigFeeTotals,
} from "../src/lib/artists"

describe("nextGigStatus", () => {
  it("läuft die Pipeline entlang", () => {
    expect(nextGigStatus("idea")).toBe("inquired")
    expect(nextGigStatus("inquired")).toBe("negotiating")
    expect(nextGigStatus("negotiating")).toBe("confirmed")
    expect(nextGigStatus("confirmed")).toBe("contracted")
    expect(nextGigStatus("contracted")).toBe("played")
  })
  it("finale Status haben keinen Nachfolger", () => {
    expect(nextGigStatus("played")).toBeNull()
    expect(nextGigStatus("cancelled")).toBeNull()
  })
})

describe("formatEuro", () => {
  it("lässt glatte Beträge ohne Nachkommastellen", () => {
    expect(formatEuro(30000)).toBe("300 €")
  })
  it("zeigt Cents wenn vorhanden", () => {
    expect(formatEuro(35050)).toBe("350,50 €")
  })
  it("nutzt deutschen Tausendertrenner", () => {
    expect(formatEuro(120000)).toBe("1.200 €")
  })
})

describe("formatFeeRange", () => {
  it("beide Grenzen → Spanne", () => {
    expect(formatFeeRange(30000, 50000)).toBe("300–500 €")
  })
  it("nur min → ab", () => {
    expect(formatFeeRange(30000, null)).toBe("ab 300 €")
  })
  it("nur max → bis", () => {
    expect(formatFeeRange(null, 50000)).toBe("bis 500 €")
  })
  it("gleiche Grenzen → Einzelbetrag", () => {
    expect(formatFeeRange(30000, 30000)).toBe("300 €")
  })
  it("keine Angabe → null", () => {
    expect(formatFeeRange(null, null)).toBeNull()
  })
})

describe("parseFeeInput", () => {
  it("ganze Euro", () => {
    expect(parseFeeInput("350")).toBe(35000)
  })
  it("Dezimal-Komma", () => {
    expect(parseFeeInput("350,50")).toBe(35050)
  })
  it("Tausender-Punkt", () => {
    expect(parseFeeInput("1.200")).toBe(120000)
  })
  it("Euro-Zeichen und Leerzeichen egal", () => {
    expect(parseFeeInput(" 350 € ")).toBe(35000)
  })
  it("leer → null", () => {
    expect(parseFeeInput("")).toBeNull()
    expect(parseFeeInput("   ")).toBeNull()
  })
  it("Unsinn/negativ → null", () => {
    expect(parseFeeInput("abc")).toBeNull()
    expect(parseFeeInput("-50")).toBeNull()
  })
})

describe("gigFeeTotals", () => {
  it("trennt fixe und offene Gagen, ignoriert Ideen und Absagen", () => {
    const { fixedCents, pendingCents } = gigFeeTotals([
      { status: "confirmed", fee_cents: 30000 },
      { status: "contracted", fee_cents: 20000 },
      { status: "played", fee_cents: 10000 },
      { status: "negotiating", fee_cents: 40000 },
      { status: "inquired", fee_cents: 5000 },
      { status: "idea", fee_cents: 99900 },
      { status: "cancelled", fee_cents: 99900 },
      { status: "confirmed", fee_cents: null },
    ])
    expect(fixedCents).toBe(60000)
    expect(pendingCents).toBe(45000)
  })
})

describe("Verfügbarkeitskalender", () => {
  it("kalenderWochen: August 2026 startet Samstag, 31 Tage, Mo-Start", () => {
    const wochen = kalenderWochen(2026, 8)
    // 1.8.2026 ist ein Samstag → 5 Füll-Nullen davor
    expect(wochen[0].slice(0, 5)).toEqual([null, null, null, null, null])
    expect(wochen[0][5]).toBe("2026-08-01")
    const tage = wochen.flat().filter(Boolean)
    expect(tage.length).toBe(31)
    expect(tage[30]).toBe("2026-08-31")
    for (const w of wochen) expect(w.length).toBe(7)
  })

  it("freieWochenenden überspringt belegte Freitage/Samstage", () => {
    // 7.8.2026 ist ein Freitag
    const frei = freieWochenenden(new Set(["2026-08-07"]), "2026-08-03", 2)
    expect(frei[0]).toEqual({ freitag: "2026-08-14", samstag: "2026-08-15" })
    expect(frei[1]).toEqual({ freitag: "2026-08-21", samstag: "2026-08-22" })
  })

  it("freieWochenenden startet am selben Tag, wenn der ein Freitag ist", () => {
    const frei = freieWochenenden(new Set(), "2026-08-07", 1)
    expect(frei[0].freitag).toBe("2026-08-07")
  })

  it("blocktTermin: Absage und Idee blocken nicht", () => {
    expect(blocktTermin("cancelled")).toBe(false)
    expect(blocktTermin("idea")).toBe(false)
    expect(blocktTermin("inquired")).toBe(true)
    expect(blocktTermin("contracted")).toBe(true)
  })
})
