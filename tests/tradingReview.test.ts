import { describe, it, expect } from "vitest"
import { netUnits, judgeVerdict, verdictStats, TRADING_FEE_RATE } from "../src/lib/trading"

describe("netUnits (Kosten-Realismus)", () => {
  it("zieht die Orderkosten von der Stückzahl ab", () => {
    // 15€ × 1.08 $/€ / 100$ = 0.162 brutto, minus 0.25%
    expect(netUnits(15, 100, 1.08)).toBeCloseTo(0.162 * (1 - TRADING_FEE_RATE), 10)
  })
  it("feeRate 0 = brutto", () => {
    expect(netUnits(15, 100, 1.08, 0)).toBeCloseTo(0.162, 10)
  })
})

describe("judgeVerdict", () => {
  it("Pick schlägt Benchmark → right", () => {
    // Pick +10%, Benchmark +2%
    expect(judgeVerdict(100, 110, 50, 51)).toBe("right")
  })
  it("Pick verliert gegen Benchmark → wrong", () => {
    // Pick -5%, Benchmark +2%
    expect(judgeVerdict(100, 95, 50, 51)).toBe("wrong")
  })
  it("beide im Minus, Pick weniger schlimm → right", () => {
    // Pick -2%, Benchmark -6%
    expect(judgeVerdict(100, 98, 50, 47)).toBe("right")
  })
  it("Gleichstand zählt als right", () => {
    expect(judgeVerdict(100, 102, 50, 51)).toBe("right")
  })
})

describe("verdictStats", () => {
  it("zählt nur KI-Picks, nie den Benchmark", () => {
    const s = verdictStats([
      { verdict: "right", is_benchmark: false },
      { verdict: "right", is_benchmark: false },
      { verdict: "wrong", is_benchmark: false },
      { verdict: "open", is_benchmark: false },
      { verdict: "open", is_benchmark: true },
      { verdict: "right", is_benchmark: true },
    ])
    expect(s).toEqual({ right: 2, wrong: 1, open: 1, quote: 2 / 3 })
  })
  it("ohne bewertete Picks keine Quote", () => {
    expect(verdictStats([{ verdict: "open", is_benchmark: false }]).quote).toBeNull()
  })
})
