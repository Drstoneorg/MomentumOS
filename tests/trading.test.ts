import { describe, it, expect } from "vitest"
import { extractYahooPrice, aggregateHoldings, holdingValueEur, UNIVERSE, BENCHMARK } from "@/lib/trading"
import { normalizePicks } from "@/lib/ai/trading"

describe("extractYahooPrice", () => {
  it("liest regularMarketPrice aus der Chart-Antwort", () => {
    const json = { chart: { result: [{ meta: { regularMarketPrice: 213.55 } }] } }
    expect(extractYahooPrice(json)).toBe(213.55)
  })

  it("kaputte/leere Antworten geben null statt Crash", () => {
    expect(extractYahooPrice(null)).toBeNull()
    expect(extractYahooPrice({})).toBeNull()
    expect(extractYahooPrice({ chart: { result: [] } })).toBeNull()
    expect(extractYahooPrice({ chart: { result: [{ meta: { regularMarketPrice: "213" } }] } })).toBeNull()
    expect(extractYahooPrice({ chart: { result: [{ meta: { regularMarketPrice: -1 } }] } })).toBeNull()
  })
})

describe("normalizePicks", () => {
  it("wirft Symbole außerhalb des Universums raus (KI darf nichts erfinden)", () => {
    const picks = normalizePicks([
      { symbol: "AAPL", weight: 1, thesis: "ok" },
      { symbol: "GAMESTOP-MOON", weight: 5, thesis: "nope" },
    ])
    expect(picks).toHaveLength(1)
    expect(picks[0].symbol).toBe("AAPL")
  })

  it("normiert Gewichte auf Summe 1 und kappt bei 3 Picks", () => {
    const picks = normalizePicks([
      { symbol: "AAPL", weight: 2 },
      { symbol: "MSFT", weight: 2 },
      { symbol: "SPY", weight: 4 },
      { symbol: "QQQ", weight: 4 },
    ])
    expect(picks).toHaveLength(3)
    expect(picks.reduce((a, p) => a + p.weight, 0)).toBeCloseTo(1)
    expect(picks[2].weight).toBeCloseTo(0.5)
  })

  it("Ticker-Varianten werden gemappt, Duplikate fliegen", () => {
    const picks = normalizePicks([
      { symbol: "nvda", weight: 1 },
      { symbol: "NVDA.US", weight: 1 },
      { symbol: "$NVDA", weight: 1 },
    ])
    expect(picks).toHaveLength(1)
    expect(picks[0].symbol).toBe("NVDA")
  })

  it("fehlende Gewichte: Gleichverteilung statt Division durch 0", () => {
    const picks = normalizePicks([{ symbol: "AAPL" }, { symbol: "SPY" }])
    expect(picks.map((p) => p.weight)).toEqual([0.5, 0.5])
  })

  it("Benchmark-Symbol ist NICHT im wählbaren Universum", () => {
    expect(UNIVERSE.some((u) => u.symbol === BENCHMARK.symbol)).toBe(false)
    expect(normalizePicks([{ symbol: BENCHMARK.symbol, weight: 1 }])).toEqual([])
  })
})

describe("aggregateHoldings + holdingValueEur", () => {
  it("aggregiert Käufe pro Symbol, KI und Benchmark getrennt", () => {
    const holdings = aggregateHoldings([
      { symbol: "AAPL", label: "Apple", units: 0.05, amount_eur: 10, is_benchmark: false },
      { symbol: "AAPL", label: "Apple", units: 0.05, amount_eur: 10, is_benchmark: false },
      { symbol: "URTH", label: "Bench", units: 0.1, amount_eur: 15, is_benchmark: true },
    ])
    expect(holdings).toHaveLength(2)
    const apple = holdings.find((h) => h.symbol === "AAPL")!
    expect(apple.units).toBeCloseTo(0.1)
    expect(apple.investedEur).toBe(20)
  })

  it("rechnet USD-Wert über EUR/USD zurück; ohne Kurs null", () => {
    const h = { symbol: "AAPL", label: "Apple", units: 2, investedEur: 300, isBenchmark: false }
    const quotes = new Map([["AAPL", 200]])
    // 2 Stück * $200 = $400, bei EURUSD 1.25 → 320€
    expect(holdingValueEur(h, quotes, 1.25)).toBeCloseTo(320)
    expect(holdingValueEur(h, new Map(), 1.25)).toBeNull()
  })
})
