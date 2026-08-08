import { describe, expect, it } from "vitest"
import { erkenneRsvp, erkenneRsvpAusNachrichten } from "@/lib/rsvpDetect"
import { noShowQuote, ueberbuchungsEmpfehlung } from "@/lib/noShow"
import { serienStatistik } from "@/lib/serien"
import { besteSendezeit, sendezeitProKontakt } from "@/lib/sendezeit"
import { eventKonflikte } from "@/lib/eventKonflikte"
import { einladungsIcs } from "@/lib/inviteIcs"
import { fuelleVorlage, waehleVorlage, STANDARD_VORLAGEN, type Vorlage } from "@/lib/inviteTemplates"
import { gastScore } from "@/lib/inviteScore"

describe("rsvpDetect", () => {
  it("erkennt klare Zusagen", () => {
    expect(erkenneRsvp("Ja mega, bin dabei!")?.status).toBe("yes")
    expect(erkenneRsvp("count me in 🖤")?.status).toBe("yes")
    expect(erkenneRsvp("ich komme sicher vorbei")?.status).toBe("yes")
  })
  it("erkennt Absagen — auch wenn Zusage-Wörter drinstehen", () => {
    expect(erkenneRsvp("sorry ich kann leider nicht kommen")?.status).toBe("no")
    expect(erkenneRsvp("muss leider absagen, bin krank")?.status).toBe("no")
    expect(erkenneRsvp("can't make it this time")?.status).toBe("no")
  })
  it("bleibt bei Smalltalk still", () => {
    expect(erkenneRsvp("wie war dein Tag?")).toBeNull()
    expect(erkenneRsvp("ich komme gerade vom Sport")).toBeNull()
    expect(erkenneRsvp("mal schauen ob ich Zeit habe")).toBeNull()
  })
  it("späteste Aussage gewinnt", () => {
    const v = erkenneRsvpAusNachrichten(["bin dabei!", "ach mist, kann doch nicht"])
    expect(v?.status).toBe("no")
  })
  it("liefert ein Zitat", () => {
    const v = erkenneRsvp("Hey! Bin am Start, freu mich")
    expect(v?.zitat).toContain("Bin am Start")
  })
})

describe("noShow", () => {
  it("rechnet Quote aus Zusagen vs. Erschienenen", () => {
    const invites = [
      ...Array(6).fill({ status: "yes" }),
      ...Array(3).fill({ status: "attended" }),
      { status: "no" },
      { status: "invited" },
    ]
    const s = noShowQuote(invites)
    expect(s.zugesagt).toBe(9)
    expect(s.erschienen).toBe(3)
    expect(s.quote).toBeCloseTo(2 / 3)
  })
  it("gibt null unter der Mindestbasis", () => {
    expect(noShowQuote([{ status: "yes" }, { status: "attended" }]).quote).toBeNull()
  })
  it("empfiehlt Überbuchung, gekappt bei 60 %", () => {
    expect(ueberbuchungsEmpfehlung(40, 0.25)).toBe(54)
    expect(ueberbuchungsEmpfehlung(40, 0.95)).toBe(100)
  })
})

describe("serien", () => {
  const inv = (contact_id: string, status: string, plus = 0) => ({ contact_id, status, plus_ones: plus })
  it("zählt Ausgaben, Wiederkehrer und Trend", () => {
    const s = serienStatistik([
      { id: "1", title: "Vol 1", starts_at: "2026-01-01T22:00:00Z", invites: [inv("a", "attended"), inv("b", "attended")] },
      { id: "2", title: "Vol 2", starts_at: "2026-02-01T22:00:00Z", invites: [inv("a", "attended", 1), inv("c", "attended"), inv("d", "yes")] },
    ])
    expect(s.ausgaben.map((a) => a.da)).toEqual([2, 3])
    // a war 2× da, b und c je 1× → 1 von 3 Wiederkehrer
    expect(s.wiederkehrerQuote).toBeCloseTo(1 / 3)
    expect(s.trend).toBe(1)
  })
  it("null-Quote bei nur einer Ausgabe", () => {
    const s = serienStatistik([
      { id: "1", title: "Vol 1", starts_at: "2026-01-01T22:00:00Z", invites: [inv("a", "attended")] },
    ])
    expect(s.wiederkehrerQuote).toBeNull()
    expect(s.trend).toBeNull()
  })
})

describe("sendezeit", () => {
  it("findet ein klares Muster", () => {
    // Fünf Donnerstagabende (Wien = UTC+1 im Januar)
    const stempel = [
      "2026-01-01T19:00:00Z",
      "2026-01-08T20:00:00Z",
      "2026-01-15T18:30:00Z",
      "2026-01-22T21:00:00Z",
      "2026-01-29T19:15:00Z",
    ]
    expect(besteSendezeit(stempel)).toBe("meist Do abends")
  })
  it("null bei zu wenig oder zu breitem Muster", () => {
    expect(besteSendezeit(["2026-01-01T19:00:00Z"])).toBeNull()
    const breit = [
      "2026-01-01T08:00:00Z",
      "2026-01-02T13:00:00Z",
      "2026-01-03T19:00:00Z",
      "2026-01-04T02:00:00Z",
      "2026-01-05T15:00:00Z",
      "2026-01-06T09:00:00Z",
    ]
    expect(besteSendezeit(breit)).toBeNull()
  })
  it("gruppiert pro Kontakt", () => {
    const msgs = Array.from({ length: 5 }, (_, i) => ({
      contact_id: "a",
      sent_at: `2026-01-${String(1 + i * 7).padStart(2, "0")}T19:00:00Z`,
    }))
    const map = sendezeitProKontakt([...msgs, { contact_id: "b", sent_at: "2026-01-01T10:00:00Z" }])
    expect(map.get("a")).toBe("meist Do abends")
    expect(map.has("b")).toBe(false)
  })
})

describe("eventKonflikte", () => {
  const ev = { id: "e1", title: "Goth Night", starts_at: "2026-09-12T21:00:00Z" }
  it("meldet Terminkollision am selben Tag", () => {
    const w = eventKonflikte(ev, [{ id: "e2", title: "Anderes", starts_at: "2026-09-12T18:00:00Z" }], [], [])
    expect(w).toHaveLength(1)
    expect(w[0]).toContain("Anderes")
  })
  it("meldet doppelt verplante Artists", () => {
    const w = eventKonflikte(
      ev,
      [],
      ["art1"],
      [{ event_id: "e9", artist_id: "art1", artistName: "DJ X", eventTitle: "Fremdes Event", starts_at: "2026-09-12T19:00:00Z" }]
    )
    expect(w[0]).toContain("DJ X")
  })
  it("still ohne Datum oder ohne Kollision", () => {
    expect(eventKonflikte({ ...ev, starts_at: null }, [{ id: "e2", title: "X", starts_at: ev.starts_at }], [], [])).toEqual([])
    expect(eventKonflikte(ev, [{ id: "e2", title: "X", starts_at: "2026-09-13T21:00:00Z" }], [], [])).toEqual([])
  })
})

describe("inviteIcs", () => {
  it("baut gültiges ICS mit Escaping", () => {
    const ics = einladungsIcs({
      uid: "abc",
      title: "Goth Night; Vol 2, Berlin",
      starts_at: "2026-09-12T21:00:00Z",
      location: "Keller, Wien",
      description: null,
    })
    expect(ics).toContain("BEGIN:VCALENDAR")
    expect(ics).toContain("SUMMARY:Goth Night\\; Vol 2\\, Berlin")
    expect(ics).toContain("DTSTART:20260912T210000Z")
    expect(ics).toContain("DTEND:20260913T010000Z")
    expect(ics).toContain("LOCATION:Keller\\, Wien")
  })
  it("wirft bei kaputtem Datum", () => {
    expect(() => einladungsIcs({ uid: "x", title: "T", starts_at: "quatsch", location: null, description: null })).toThrow()
  })
})

describe("Vorlagen A/B", () => {
  it("füllt Platzhalter", () => {
    const t = fuelleVorlage("Hey {name}, {event} am {datum}{ort}: {link}", {
      name: "Mika",
      event: "Goth Night",
      datum: "Fr um 22:00",
      ort: ", Wien",
      link: "https://x/y",
    })
    expect(t).toBe("Hey Mika, Goth Night am Fr um 22:00, Wien: https://x/y")
  })
  it("wechselt Varianten über den Index ab", () => {
    const map = new Map<string, Vorlage[]>([
      [
        "einladung:de",
        [
          { key: "einladung", lang: "de", variant: "A", text: "A {name}" },
          { key: "einladung", lang: "de", variant: "B", text: "B {name}" },
        ],
      ],
    ])
    expect(waehleVorlage(map, "einladung", "de", 0).variant).toBe("A")
    expect(waehleVorlage(map, "einladung", "de", 1).variant).toBe("B")
    expect(waehleVorlage(map, "einladung", "de", 2).variant).toBe("A")
  })
  it("fällt ohne DB-Vorlagen auf den Standard zurück", () => {
    const v = waehleVorlage(new Map(), "nachfass", "en", 0)
    expect(v.text).toBe(STANDARD_VORLAGEN.find((s) => s.key === "nachfass" && s.lang === "en")!.text)
  })
  it("Standard-Vorlagen halten die Stilregeln (kein Satzend-Punkt, keine Gedankenstriche)", () => {
    for (const s of STANDARD_VORLAGEN) {
      expect(s.text).not.toMatch(/[.]\s*$/)
      expect(s.text).not.toContain("—")
      expect(s.text).not.toContain("–")
    }
  })
})

describe("gastScore Feedback", () => {
  const kontakt = { realm: "moment", intent: null, location: null, relationship_tags: [], interests: [] }
  const event = { audience: null, location: null }
  it("gutes Feedback hebt, schlechtes senkt", () => {
    const neutral = gastScore(kontakt, event, { eingeladen: 0, reagiert: 0 }).score
    const gut = gastScore(kontakt, event, { eingeladen: 0, reagiert: 0, feedbackSchnitt: 4.5 })
    const schlecht = gastScore(kontakt, event, { eingeladen: 0, reagiert: 0, feedbackSchnitt: 1.5 })
    expect(gut.score).toBe(neutral + 8)
    expect(gut.gruende.join()).toContain("Feedback 4.5/5")
    expect(schlecht.score).toBe(neutral - 10)
  })
})
