import { describe, it, expect } from "vitest"
import {
  detectPromise,
  resolveTimePhrase,
  promiseSnippet,
  DEFAULT_PROMISE_DAYS,
} from "../src/lib/promiseDetect"

// Sa, 18.07.2026 (UTC-Wochentag 6)
const now = new Date("2026-07-18T14:00:00Z")
const day = (d: Date | undefined) => d?.toISOString().slice(0, 10)

describe("detectPromise", () => {
  it("Zusage + morgen", () => {
    const hit = detectPromise("bin unterwegs, melde mich morgen!", now)
    expect(day(hit?.dueAt)).toBe("2026-07-19")
  })
  it("Zusage + nächste Woche → nächster Montag", () => {
    const hit = detectPromise("stress grade, ich meld mich nächste Woche", now)
    expect(day(hit?.dueAt)).toBe("2026-07-20")
  })
  it("Zusage + in 3 Tagen", () => {
    const hit = detectPromise("sag dir Bescheid in 3 Tagen", now)
    expect(day(hit?.dueAt)).toBe("2026-07-21")
  })
  it("Zusage + Wochentag (Mittwoch)", () => {
    const hit = detectPromise("ich schreibe dir am Mittwoch", now)
    expect(day(hit?.dueAt)).toBe("2026-07-22")
  })
  it("Zusage ohne Zeitangabe → Default-Vorlauf", () => {
    const hit = detectPromise("okay, ich melde mich!", now)
    expect(day(hit?.dueAt)).toBe(
      new Date(now.getTime() + DEFAULT_PROMISE_DAYS * 86400_000).toISOString().slice(0, 10)
    )
    expect(hit?.label).toBe("Zusage")
  })
  it("Zeitangabe OHNE Zusage-Phrase → kein Treffer (keine False Positives)", () => {
    expect(detectPromise("ich bin morgen im Kino", now)).toBeNull()
    expect(detectPromise("nächste Woche wird stressig", now)).toBeNull()
  })
  it("normale Nachricht → null", () => {
    expect(detectPromise("haha ja voll, der Film war super 😄", now)).toBeNull()
  })
  it("Riesentext wird ignoriert (Schutz)", () => {
    expect(detectPromise(`melde mich morgen ${"x".repeat(2100)}`, now)).toBeNull()
  })
})

describe("resolveTimePhrase", () => {
  it("übermorgen vor morgen geprüft", () => {
    expect(resolveTimePhrase("übermorgen dann", now)?.days).toBe(2)
  })
  it("Wochenende von Samstag aus → nächster Samstag", () => {
    expect(resolveTimePhrase("am Wochenende", now)?.days).toBe(7)
  })
  it("nichts erkannt → null", () => {
    expect(resolveTimePhrase("irgendwann mal", now)).toBeNull()
  })
})

describe("promiseSnippet", () => {
  it("kürzt lange Texte mit Ellipse", () => {
    const s = promiseSnippet("a".repeat(100), 20)
    expect(s.length).toBe(20)
    expect(s.endsWith("…")).toBe(true)
  })
  it("glättet Whitespace", () => {
    expect(promiseSnippet("hey\n  melde   mich")).toBe("hey melde mich")
  })
})
