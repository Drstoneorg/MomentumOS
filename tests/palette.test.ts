import { describe, it, expect } from "vitest"
import { fuzzyScore, filterCommands, staticCommands, type Command } from "../src/lib/palette"

describe("fuzzyScore", () => {
  it("kein Treffer → 0", () => {
    expect(fuzzyScore("xyz", "MatchOS · Dashboard")).toBe(0)
  })
  it("Substring schlägt verstreute Subsequenz", () => {
    expect(fuzzyScore("karte", "Karte erstellen")).toBeGreaterThan(
      fuzzyScore("karte", "Kontakte anrufen todo e")
    )
  })
  it("Groß/Klein und Akzente egal", () => {
    expect(fuzzyScore("cafe", "Café")).toBeGreaterThan(0)
    expect(fuzzyScore("MATCH", "matchbox")).toBeGreaterThan(0)
  })
  it("leere Query matcht alles", () => {
    expect(fuzzyScore("", "irgendwas")).toBeGreaterThan(0)
  })
  it("früher Substring-Treffer schlägt späten", () => {
    expect(fuzzyScore("inbox", "Inbox — alle Signale")).toBeGreaterThan(
      fuzzyScore("inbox", "Signale in der Inbox")
    )
  })
})

describe("filterCommands", () => {
  const cmds: Command[] = [
    { label: "MatchOS · Pipeline", href: "/pipeline", module: "match", icon: "→" },
    { label: "Karte erstellen", href: "/cards", module: "moments", icon: "🃏" },
    { label: "JobOS · Bewerbungen", href: "/jobs", module: "jobs", icon: "→" },
  ]
  it("sortiert nach Score, filtert Nicht-Treffer raus", () => {
    const out = filterCommands("karte", cmds)
    expect(out[0].href).toBe("/cards")
    expect(out.some((c) => c.href === "/jobs")).toBe(false)
  })
  it("ohne Query: erste N unverändert", () => {
    expect(filterCommands("", cmds, 2)).toHaveLength(2)
  })
})

describe("staticCommands", () => {
  it("enthält Inbox und alle Modul-Homes, ohne Duplikate", () => {
    const cmds = staticCommands()
    expect(cmds.some((c) => c.href === "/inbox")).toBe(true)
    for (const home of ["/", "/moments", "/jobs", "/book", "/trading"]) {
      expect(cmds.some((c) => c.href === home)).toBe(true)
    }
    const keys = cmds.map((c) => c.href + c.label)
    expect(new Set(keys).size).toBe(keys.length)
  })
})
