import { describe, it, expect } from "vitest"
import { outcomeHints, type OutcomeStats } from "@/lib/outcomes"

const stats = (over: Partial<OutcomeStats>): OutcomeStats => ({
  totalSent: 0,
  byStyle: [],
  byDaypart: [],
  ...over,
})

describe("outcomeHints", () => {
  it("null unter 10 gesendeten Vorschlägen (Rauschen)", () => {
    expect(
      outcomeHints(
        stats({
          totalSent: 9,
          byStyle: [
            { style: "flirty", sent: 5, replied: 4, rate: 0.8 },
            { style: "direkt", sent: 4, replied: 1, rate: 0.25 },
          ],
        })
      )
    ).toBeNull()
  })

  it("null wenn weniger als 2 Stile mit n>=3", () => {
    expect(
      outcomeHints(
        stats({
          totalSent: 12,
          byStyle: [
            { style: "flirty", sent: 10, replied: 7, rate: 0.7 },
            { style: "direkt", sent: 2, replied: 1, rate: 0.5 },
          ],
        })
      )
    ).toBeNull()
  })

  it("liefert Quoten-Text ab 10 Sendungen und 2 soliden Stilen", () => {
    const hint = outcomeHints(
      stats({
        totalSent: 12,
        byStyle: [
          { style: "flirty", sent: 7, replied: 5, rate: 5 / 7 },
          { style: "direkt", sent: 5, replied: 1, rate: 0.2 },
        ],
      })
    )
    expect(hint).toContain("flirty 71%")
    expect(hint).toContain("direkt 20%")
  })

  it("nennt beste Sendezeit erst ab 5 Sendungen im Bucket", () => {
    const base = {
      totalSent: 15,
      byStyle: [
        { style: "flirty", sent: 8, replied: 6, rate: 0.75 },
        { style: "locker", sent: 7, replied: 2, rate: 2 / 7 },
      ],
    }
    const without = outcomeHints(
      stats({ ...base, byDaypart: [{ style: "Abend", part: "Abend", sent: 4, replied: 3, rate: 0.75 } as never] })
    )
    expect(without).not.toContain("Sendezeit")
    const with5 = outcomeHints(
      stats({ ...base, byDaypart: [{ style: "Abend", part: "Abend", sent: 6, replied: 4, rate: 4 / 6 } as never] })
    )
    expect(with5).toContain("Abend")
  })
})
