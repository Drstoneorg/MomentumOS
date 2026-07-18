import { describe, it, expect } from "vitest"
import { sortSignals, cronProblems, type Signal } from "../src/lib/signals"

const sig = (over: Partial<Signal>): Signal => ({
  key: Math.random().toString(36).slice(2),
  module: "match",
  icon: "x",
  title: "t",
  href: "/",
  prio: 1,
  ...over,
})

describe("sortSignals", () => {
  it("Priorität zuerst, dann Modul-Reihenfolge", () => {
    const out = sortSignals([
      sig({ module: "trading", prio: 2, title: "c" }),
      sig({ module: "book", prio: 1, title: "b" }),
      sig({ module: "system", prio: 0, title: "a" }),
      sig({ module: "match", prio: 1, title: "d" }),
    ])
    expect(out.map((s) => `${s.prio}-${s.module}`)).toEqual([
      "0-system",
      "1-match",
      "1-book",
      "2-trading",
    ])
  })
})

describe("cronProblems", () => {
  const now = new Date("2026-07-18T12:00:00Z").getTime()
  const beat = (hoursAgo: number) => new Date(now - hoursAgo * 3600_000).toISOString()
  const allFresh = () =>
    new Map(
      ["followups", "moments", "dispatch", "digest", "jobscan", "trading"].map((n) => [n, beat(1)])
    )

  it("alles frisch → keine Probleme", () => {
    expect(cronProblems(allFresh(), now)).toEqual([])
  })
  it("nie gelaufen wird gemeldet", () => {
    const beats = allFresh()
    beats.delete("jobscan")
    expect(cronProblems(beats, now)).toEqual([{ name: "jobscan", info: "noch nie gelaufen" }])
  })
  it("älter als 36h wird gemeldet", () => {
    const beats = allFresh()
    beats.set("digest", beat(40))
    expect(cronProblems(beats, now)).toEqual([{ name: "digest", info: "zuletzt vor 40h" }])
  })
  it("trading hat 100h-Fenster (läuft nur werktags)", () => {
    const beats = allFresh()
    beats.set("trading", beat(70))
    expect(cronProblems(beats, now)).toEqual([])
    beats.set("trading", beat(120))
    expect(cronProblems(beats, now)).toHaveLength(1)
  })
})
