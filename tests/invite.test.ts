import { describe, it, expect } from "vitest"
import { buildInviteMessage } from "@/lib/inviteTemplates"
import { gastScore, zusagenMitBegleitung } from "@/lib/inviteScore"

describe("buildInviteMessage", () => {
  const event = { title: "Nachtmesse", starts_at: "2026-09-19T19:00:00Z", location: "Wien" }

  it("deutsche Einladung: Vorname, Event, Link, kein Satzend-Punkt", () => {
    const text = buildInviteMessage(
      { name: "Max Mustermann", language: "de" },
      event,
      "einladung",
      "https://x.test/einladung/abc"
    )
    expect(text).toContain("Max")
    expect(text).not.toContain("Mustermann")
    expect(text).toContain("Nachtmesse")
    expect(text).toContain("https://x.test/einladung/abc")
    expect(text.endsWith(".")).toBe(false)
  })

  it("englische Variante für language=en, Nachfass erwähnt Reminder", () => {
    const text = buildInviteMessage({ name: "Ash", language: "en" }, event, "nachfass", "https://x.test/e/1")
    expect(text).toContain("reminder")
    expect(text).toContain("Nachtmesse")
  })

  it("ohne Datum bricht nichts", () => {
    const text = buildInviteMessage({ name: "Kai", language: "de" }, { ...event, starts_at: null }, "einladung", "u")
    expect(text).toContain("bald")
  })
})

describe("gastScore", () => {
  const event = { audience: "goth, darkwave", location: "Wien" }

  it("Stil-Match + Stadt + Freundeskreis addieren sich mit Grund-Chips", () => {
    const { score, gruende } = gastScore(
      { realm: "moment", intent: null, location: "Wien", relationship_tags: ["goth"], interests: [] },
      event,
      { eingeladen: 0, reagiert: 0 }
    )
    expect(score).toBeGreaterThan(50)
    expect(gruende).toContain("Freundeskreis")
    expect(gruende).toContain("gleiche Stadt")
  })

  it("Ermüdungsschutz zieht ab, wenn nie reagiert wurde", () => {
    const mit = gastScore(
      { realm: "match", intent: "event_lead", location: null, relationship_tags: null, interests: null },
      event,
      { eingeladen: 3, reagiert: 0 }
    )
    expect(mit.score).toBeLessThan(0)
    expect(mit.gruende.join()).toContain("nie reagiert")
  })

  it("zuverlässige Reagierer kriegen Bonus", () => {
    const { gruende } = gastScore(
      { realm: "moment", intent: null, location: null, relationship_tags: null, interests: null },
      event,
      { eingeladen: 4, reagiert: 4 }
    )
    expect(gruende).toContain("reagiert zuverlässig")
  })
})

describe("zusagenMitBegleitung", () => {
  it("zählt Zusagen, Tickets und Anwesende samt Plus-Eins", () => {
    const r = zusagenMitBegleitung([
      { status: "yes", plus_ones: 2 },
      { status: "ticket", plus_ones: 0 },
      { status: "attended", plus_ones: 1 },
      { status: "invited", plus_ones: 3 },
      { status: "no", plus_ones: 1 },
    ])
    expect(r).toEqual({ zusagen: 3, begleitungen: 3, gesamt: 6 })
  })
})
