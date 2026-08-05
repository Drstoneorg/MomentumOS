import { describe, it, expect } from "vitest"
import { RECRUIT_STAGES, RECRUIT_STAGE_LABELS, isRecruitStage } from "@/lib/recruit"
import { audienceMatch } from "@/lib/artists"

describe("RecruitOS-Stufen", () => {
  it("jede Stufe hat ein Label", () => {
    for (const s of RECRUIT_STAGES) {
      expect(RECRUIT_STAGE_LABELS[s]).toBeTruthy()
    }
  })

  it("isRecruitStage lässt nur bekannte Stufen durch", () => {
    expect(isRecruitStage("scouted")).toBe(true)
    expect(isRecruitStage("declined")).toBe(true)
    expect(isRecruitStage("archived")).toBe(false)
    expect(isRecruitStage("")).toBe(false)
    expect(isRecruitStage(null)).toBe(false)
  })

  it("RecruitOS-Aktionen bleiben lesend/entwerfend — kein Versand-Code", async () => {
    // Grundregel des Moduls: nichts sendet automatisch Nachrichten.
    const { readFileSync } = await import("node:fs")
    const quelle = readFileSync("src/app/recruit/actions.ts", "utf8")
    for (const verboten of ["sendMessage", "telegram", "sendMail", "fetch("]) {
      expect(quelle).not.toContain(verboten)
    }
  })
})

describe("audienceMatch (Zielpublikum Event ↔ Artist)", () => {
  it("identisches Publikum = 100", () => {
    expect(audienceMatch("Goth, Alternative", "goth alternative")?.score).toBe(100)
  })

  it("Synonyme zählen als Treffer (gothic ~ goth, rave ~ techno)", () => {
    const m = audienceMatch("Goth und Techno-Publikum 18-30", "Gothic Rave Crowd")
    expect(m).not.toBeNull()
    expect(m!.score).toBe(100)
    expect(m!.gemeinsam).toContain("goth")
    expect(m!.gemeinsam).toContain("techno")
  })

  it("keine Überschneidung = 0", () => {
    expect(audienceMatch("Schlager Mainstream", "Goth Industrial")?.score).toBe(0)
  })

  it("leeres Feld = null (keine Aussage, nicht 'passt nicht')", () => {
    expect(audienceMatch("", "goth")).toBeNull()
    expect(audienceMatch("goth", null)).toBeNull()
  })

  it("Umlaute werden normalisiert (ästhetisch ~ aesthetic)", () => {
    const m = audienceMatch("ästhetisch", "aesthetic crowd")
    expect(m!.gemeinsam).toContain("aesthetic")
  })
})
