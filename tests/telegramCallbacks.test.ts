import { describe, it, expect } from "vitest"
import { parseCallback } from "../src/lib/telegramCallbacks"

const uuid = "7af317a1-c035-4403-ac9c-1eb07de52bb8"

describe("parseCallback", () => {
  it("fu: Follow-up erledigt", () => {
    expect(parseCallback(`fu:${uuid}`)).toEqual({ kind: "fu", id: uuid })
  })
  it("sn: Signal-Key mit Bindestrichen + Tage", () => {
    expect(parseCallback(`sn:rhythm-${uuid}:7`)).toEqual({
      kind: "sn",
      id: `rhythm-${uuid}`,
      days: 7,
    })
  })
  it("ap/sh: Suggestion-Aktionen", () => {
    expect(parseCallback(`ap:${uuid}`)).toEqual({ kind: "ap", id: uuid })
    expect(parseCallback(`sh:${uuid}`)).toEqual({ kind: "sh", id: uuid })
  })
  it("kaputte Daten → null", () => {
    expect(parseCallback(null)).toBeNull()
    expect(parseCallback("")).toBeNull()
    expect(parseCallback("xx:123")).toBeNull()
    expect(parseCallback("sn:key")).toBeNull()
    expect(parseCallback("sn:key:abc")).toBeNull()
    expect(parseCallback("sn:key:0")).toBeNull()
    expect(parseCallback("sn:key:99")).toBeNull()
    expect(parseCallback(`fu:${"x".repeat(70)}`)).toBeNull()
  })
})
