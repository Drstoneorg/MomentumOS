import { describe, it, expect } from "vitest"
import {
  tageSeit,
  kuerze,
  normName,
  nameScore,
  rankKontakte,
  slotDatum,
  juengstes,
  ASK_TOOLS,
  ASK_TOOL_BY_NAME,
  toolSchemas,
} from "../src/lib/ai/askTools"

const JETZT = new Date("2026-07-31T12:00:00Z").getTime()

describe("tageSeit", () => {
  it("zählt volle Tage in der Vergangenheit", () => {
    expect(tageSeit("2026-07-01T12:00:00Z", JETZT)).toBe(30)
    expect(tageSeit("2026-07-31T11:00:00Z", JETZT)).toBe(0)
  })

  it("gibt negativ für Zukunft und null für fehlende oder kaputte Werte", () => {
    expect(tageSeit("2026-08-10T12:00:00Z", JETZT)).toBe(-10)
    expect(tageSeit(null)).toBeNull()
    expect(tageSeit("keindatum")).toBeNull()
  })
})

describe("kuerze", () => {
  it("lässt kurze Texte unangetastet und normalisiert Leerraum", () => {
    expect(kuerze("kurz   und\nknapp")).toBe("kurz und knapp")
    expect(kuerze(null)).toBeNull()
  })

  it("kappt lange Texte auf die Maximallänge inklusive Auslassungszeichen", () => {
    const lang = "a".repeat(500)
    const out = kuerze(lang, 50)!
    expect(out).toHaveLength(50)
    expect(out.endsWith("…")).toBe(true)
  })
})

describe("Namensabgleich", () => {
  it("normalisiert Umlaute und Sonderzeichen", () => {
    expect(normName("Jörg-Peter")).toBe("joergpeter")
    expect(normName("Sofía")).toBe("sofia")
    expect(normName("Straße")).toBe("strasse")
  })

  it("wertet exakt über Wortanfang über Teilstring", () => {
    expect(nameScore("anna", "Anna")).toBe(3)
    expect(nameScore("ann", "Anna Schmidt")).toBe(2)
    expect(nameScore("schmidt", "Anna Schmidt")).toBe(1)
    expect(nameScore("xyz", "Anna")).toBe(0)
  })

  it("sortiert Treffer nach Güte und filtert Nichttreffer", () => {
    const liste = [{ name: "Marianne" }, { name: "Mara" }, { name: "Bernd" }]
    expect(rankKontakte("mara", liste)).toEqual([{ name: "Mara" }])
    expect(rankKontakte("mar", liste).map((c) => c.name)).toEqual(["Mara", "Marianne"])
    expect(rankKontakte("zzz", liste)).toEqual([])
  })

  it("findet Umlautnamen auch ohne Umlaut in der Suche", () => {
    expect(rankKontakte("joerg", [{ name: "Jörg" }])).toHaveLength(1)
  })
})

describe("slotDatum", () => {
  const slots = [
    { when: "2026-06-14T19:00:00Z", place: "Flex" },
    { when: "2026-06-21T19:00:00Z", place: "Grelle Forelle" },
  ]

  it("liefert den gewählten Slot", () => {
    expect(slotDatum(slots, 1)).toEqual({ when: "2026-06-21T19:00:00Z", place: "Grelle Forelle" })
  })

  it("liefert null ohne Wahl, bei kaputten Daten und bei Index daneben", () => {
    expect(slotDatum(slots, null)).toBeNull()
    expect(slotDatum(slots, 5)).toBeNull()
    expect(slotDatum("keinArray", 0)).toBeNull()
    expect(slotDatum([{ place: "ohne Zeit" }], 0)).toBeNull()
  })
})

describe("juengstes", () => {
  it("nimmt das jüngste vergangene Ereignis und ignoriert die Zukunft", () => {
    const items = [
      { when: "2026-05-01T10:00:00Z" },
      { when: "2026-06-14T10:00:00Z" },
      { when: "2026-09-01T10:00:00Z" },
    ]
    expect(juengstes(items, JETZT)?.when).toBe("2026-06-14T10:00:00Z")
  })

  it("gibt null, wenn alles in der Zukunft liegt", () => {
    expect(juengstes([{ when: "2026-12-24T10:00:00Z" }], JETZT)).toBeNull()
  })
})

describe("Werkzeug-Registry", () => {
  it("hat eindeutige Namen und für jedes Werkzeug eine Beschreibung", () => {
    const namen = ASK_TOOLS.map((t) => t.name)
    expect(new Set(namen).size).toBe(namen.length)
    for (const t of ASK_TOOLS) {
      expect(t.description.length).toBeGreaterThan(20)
      expect(t.parameters.type).toBe("object")
      expect(typeof t.run).toBe("function")
    }
  })

  it("führt jeden Pflichtparameter auch in den Eigenschaften", () => {
    for (const t of ASK_TOOLS) {
      for (const req of t.parameters.required ?? []) {
        expect(Object.keys(t.parameters.properties)).toContain(req)
      }
    }
  })

  it("deckt alle fünf Module ab", () => {
    const namen = new Set(ASK_TOOLS.map((t) => t.name))
    for (const pflicht of [
      "finde_kontakt",
      "letztes_treffen",
      "kommende_termine",
      "pipeline_uebersicht",
      "bewerbungen",
      "artists_und_gigs",
      "trading_stand",
      "geburtstage",
    ]) {
      expect(namen.has(pflicht)).toBe(true)
    }
  })

  it("liefert Schemata ohne die run-Funktion nach außen", () => {
    const schemas = toolSchemas()
    expect(schemas).toHaveLength(ASK_TOOLS.length)
    for (const s of schemas) {
      expect(s.type).toBe("function")
      expect(s.function).not.toHaveProperty("run")
      expect(ASK_TOOL_BY_NAME.has(s.function.name)).toBe(true)
    }
  })

  it("enthält keine schreibenden Supabase-Aufrufe", async () => {
    const { readFileSync } = await import("node:fs")
    const quelle = readFileSync("src/lib/ai/askTools.ts", "utf8")
    for (const verboten of [".insert(", ".update(", ".delete(", ".upsert(", ".rpc("]) {
      expect(quelle).not.toContain(verboten)
    }
  })

  it("vergleicht realm gegen den Wert aus der Datenbank", async () => {
    // In contacts.realm steht "moment", nicht "moments". Der Vergleich gegen
    // "moments" traf nie zu und meldete MomentOS-Kontakte als MatchOS.
    const { readFileSync } = await import("node:fs")
    const quelle = readFileSync("src/lib/ai/askTools.ts", "utf8")
    expect(quelle).not.toContain('realm === "moments"')
    expect(quelle).not.toContain('"moments", "match"')
    expect(quelle).toContain('realm === "moment"')
  })
})
