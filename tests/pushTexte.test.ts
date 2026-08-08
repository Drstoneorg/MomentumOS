import { describe, expect, it } from "vitest"
import { bewerbungPush, leadPush, rsvpPush } from "@/lib/pushTexte"

describe("rsvpPush", () => {
  it("Zusage ohne Begleitung", () => {
    const p = rsvpPush("Anna", "Nachtschicht Vol. 2", "yes")
    expect(p.title).toContain("Zusage")
    expect(p.body).toBe('Anna kommt zu „Nachtschicht Vol. 2"')
  })

  it("Zusage mit Begleitung zählt +N", () => {
    expect(rsvpPush("Anna", "X", "yes", 2).body).toContain("Anna +2")
  })

  it("Absage nennt keine Begleitung", () => {
    const p = rsvpPush("Ben", "X", "no", 2)
    expect(p.body).toBe('Ben hat für „X" abgesagt')
    expect(p.body).not.toContain("+2")
  })

  it("Warteliste hat eigenen Text", () => {
    expect(rsvpPush("Cleo", "X", "waitlist").body).toContain("Warteliste")
  })
})

describe("bewerbungPush / leadPush", () => {
  it("Bewerbung mit und ohne Stadt", () => {
    expect(bewerbungPush("Mira", "Wien").body).toBe("Mira aus Wien hat sich über /model beworben")
    expect(bewerbungPush("Mira", null).body).toBe("Mira hat sich über /model beworben")
  })

  it("Lead nennt das Event", () => {
    expect(leadPush("Lou", "Nachtschicht").body).toBe('Lou will zu „Nachtschicht" kommen')
  })
})
