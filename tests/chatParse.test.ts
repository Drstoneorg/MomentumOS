import { describe, it, expect } from "vitest"
import { splitChatBlock, parseChatLines } from "@/lib/chatParse"

const REF = new Date("2026-07-12T15:00:00")

describe("splitChatBlock", () => {
  it("trennt Profil und Chat am Marker", () => {
    const raw = "Mika, 24, Wien\n--- CHATVERLAUF ---\n[them] hi\n[me] hey"
    const { profile, chat } = splitChatBlock(raw)
    expect(profile).toContain("Mika")
    expect(chat).toContain("[them] hi")
  })

  it("ohne Marker: alles Profil, kein Chat", () => {
    const { profile, chat } = splitChatBlock("nur Profiltext")
    expect(profile).toBe("nur Profiltext")
    expect(chat).toBeNull()
  })

  it("Extension-Marker mit Zusatztext matcht (Regression: Parser fiel still aufs LLM zurück)", () => {
    const raw =
      "--- CHATVERLAUF (Richtung erkannt: [me]=ich, [them]=Person) ---\n[them] hi\n[me] hey"
    const { chat } = splitChatBlock(raw)
    expect(chat).toContain("[them] hi")
  })

  it("Seitentext hinter dem Chat wandert ins Profil, nicht in die letzte Nachricht", () => {
    const raw =
      "--- CHATVERLAUF (Richtung erkannt: [me]=ich, [them]=Person) ---\n[them] bis später\n\n--- WEITERER SEITENTEXT ---\nMika, 24, Wien, mag Konzerte"
    const { profile, chat } = splitChatBlock(raw)
    expect(chat).toBe("[them] bis später")
    expect(profile).toContain("Mika, 24")
    const msgs = parseChatLines(chat!, REF)
    expect(msgs).toHaveLength(1)
    expect(msgs[0].content).toBe("bis später")
  })
})

describe("parseChatLines", () => {
  it("parst [me]/[them] mit korrekter Richtung — nie geflippt", () => {
    const msgs = parseChatLines("[them] hi du\n[me] hey :)", REF)
    expect(msgs).toHaveLength(2)
    expect(msgs[0]).toMatchObject({ direction: "in", content: "hi du" })
    expect(msgs[1]).toMatchObject({ direction: "out", content: "hey :)" })
  })

  it("hängt Folgezeilen an die vorige Nachricht an", () => {
    const msgs = parseChatLines("[them] erste Zeile\nzweite Zeile\n[me] ok", REF)
    expect(msgs).toHaveLength(2)
    expect(msgs[0].content).toBe("erste Zeile\nzweite Zeile")
  })

  it("übernimmt Datum+Zeit-Stempel als sent_at", () => {
    const msgs = parseChatLines("10.07.2026, 13:33\n[them] hallo", REF)
    expect(msgs).toHaveLength(1)
    expect(msgs[0].at).not.toBeNull()
    const d = new Date(msgs[0].at!)
    expect(d.getDate()).toBe(10)
    expect(d.getMonth()).toBe(6)
    expect(d.getHours()).toBe(13)
    expect(d.getMinutes()).toBe(33)
  })

  it("Nur-Zeit in der Zukunft = gestern", () => {
    // Referenz 15:00 — Stempel 18:30 kann nicht heute sein
    const msgs = parseChatLines("18:30\n[me] test", REF)
    const d = new Date(msgs[0].at!)
    expect(d.getHours()).toBe(18)
    expect(d.getDate()).toBe(11) // Vortag vom 12.
  })

  it("unbekanntes Format liefert [] (Caller fällt aufs LLM zurück)", () => {
    expect(parseChatLines("einfach irgendein Text ohne Präfixe", REF)).toEqual([])
  })

  it("Zeitzeile NACH der Nachricht stempelt die laufende Nachricht", () => {
    // So liefert es die Extension: Zeit steht unter der Bubble
    const msgs = parseChatLines("[them] na, wach?\n09:53\n[me] jetzt schon", REF)
    expect(msgs).toHaveLength(2)
    expect(new Date(msgs[0].at!).getHours()).toBe(9)
    expect(msgs[1].at).toBeNull()
  })
})
