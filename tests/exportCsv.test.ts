import { describe, expect, it } from "vitest"
import { csvFeld, zuCsv } from "@/lib/exportCsv"

describe("csvFeld", () => {
  it("quotet Kommas, Anführungszeichen und Zeilenumbrüche", () => {
    expect(csvFeld('Sagt "hi", dann weg')).toBe('"Sagt ""hi"", dann weg"')
    expect(csvFeld("Zeile1\nZeile2")).toBe('"Zeile1\nZeile2"')
    expect(csvFeld("schlicht")).toBe("schlicht")
  })

  it("null/undefined werden leer, Objekte JSON", () => {
    expect(csvFeld(null)).toBe("")
    expect(csvFeld(undefined)).toBe("")
    expect(csvFeld({ a: 1 })).toBe('"{""a"":1}"')
  })
})

describe("zuCsv", () => {
  it("baut Kopfzeile aus der ersten Zeile und beginnt mit BOM", () => {
    const csv = zuCsv([
      { name: "Anna", city: "Wien" },
      { name: "Ben, jr.", city: null },
    ])
    expect(csv.startsWith("﻿")).toBe(true)
    expect(csv).toContain("name,city")
    expect(csv).toContain('"Ben, jr.",')
  })

  it("leere Liste ergibt nur BOM", () => {
    expect(zuCsv([])).toBe("﻿")
  })
})
