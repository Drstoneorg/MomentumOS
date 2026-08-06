import { describe, it, expect } from "vitest"
import { promoAufgaben, PROMO_VORLAGE } from "@/lib/promo"

describe("promoAufgaben", () => {
  it("legt alle Vorlagen-Termine relativ zum Event an", () => {
    const aufgaben = promoAufgaben("2026-09-19T21:00:00Z")
    expect(aufgaben.length).toBe(PROMO_VORLAGE.length)
    // T-42 vom 19.9. = 8.8., 10:00 UTC
    expect(aufgaben[0].due_at).toBe("2026-08-08T10:00:00.000Z")
    // T+1 = 20.9.
    expect(aufgaben[aufgaben.length - 1].due_at).toBe("2026-09-20T10:00:00.000Z")
  })

  it("kaputtes Datum ergibt leere Liste", () => {
    expect(promoAufgaben("kein datum")).toEqual([])
  })
})
