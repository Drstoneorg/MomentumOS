import { describe, it, expect } from "vitest"
import { styleSignals, suggestIntent } from "@/lib/scoring"

describe("styleSignals", () => {
  it("findet Alt/Goth/Aesthetic-Signale in Bio und Interessen", () => {
    expect(styleSignals({ bio: "goth girl aus Wien" }).length).toBeGreaterThan(0)
    expect(styleSignals({ interests: ["Techno", "Tattoos"] }).length).toBeGreaterThan(0)
  })

  it("schlägt bei Mainstream-Profil nicht an", () => {
    expect(styleSignals({ bio: "Reisen, Kochen, Netflix", interests: ["Yoga"] })).toEqual([])
  })

  it("matcht 'alt' nur als eigenes Wort (nicht 'Verwaltung')", () => {
    expect(styleSignals({ bio: "arbeite in der Verwaltung" })).toEqual([])
    expect(styleSignals({ bio: "alt fashion lover" }).length).toBeGreaterThan(0)
  })
})

describe("suggestIntent", () => {
  it("ohne Profildaten: date (keine Vorverurteilung)", () => {
    expect(suggestIntent({})).toBe("date")
    expect(suggestIntent({ interests: [] })).toBe("date")
  })

  it("Profildaten ohne Stil-Signal: event_lead", () => {
    expect(suggestIntent({ bio: "Ich liebe Brunch und Pilates" })).toBe("event_lead")
  })

  it("Profildaten mit Stil-Signal: date", () => {
    expect(suggestIntent({ bio: "rave und dark aesthetic" })).toBe("date")
  })
})
