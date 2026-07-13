// TradingOS-Kern: Kursdaten (Yahoo-Finance-Chart-Endpoint, kostenlos, kein API-Key),
// News-Feeds, Portfolio-Rechnung. Alles PAPER — es wird nie echtes Geld bewegt.

/**
 * Fixes Anlage-Universum: nur liquide US-gelistete Aktien/ETFs, damit Yahoo
 * zuverlässig Kurse liefert und die KI nichts Exotisches "kaufen" kann.
 */
export const UNIVERSE: { symbol: string; label: string; sector: string }[] = [
  { symbol: "AAPL", label: "Apple", sector: "Tech" },
  { symbol: "MSFT", label: "Microsoft", sector: "Tech" },
  { symbol: "NVDA", label: "Nvidia", sector: "Halbleiter" },
  { symbol: "GOOGL", label: "Alphabet", sector: "Tech" },
  { symbol: "AMZN", label: "Amazon", sector: "Tech/Konsum" },
  { symbol: "META", label: "Meta", sector: "Tech" },
  { symbol: "TSLA", label: "Tesla", sector: "Auto/Tech" },
  { symbol: "AVGO", label: "Broadcom", sector: "Halbleiter" },
  { symbol: "AMD", label: "AMD", sector: "Halbleiter" },
  { symbol: "TSM", label: "TSMC (ADR)", sector: "Halbleiter" },
  { symbol: "ASML", label: "ASML (ADR)", sector: "Halbleiter" },
  { symbol: "CRM", label: "Salesforce", sector: "Software" },
  { symbol: "NFLX", label: "Netflix", sector: "Medien" },
  { symbol: "DIS", label: "Disney", sector: "Medien" },
  { symbol: "JPM", label: "JPMorgan", sector: "Finanzen" },
  { symbol: "V", label: "Visa", sector: "Finanzen" },
  { symbol: "MA", label: "Mastercard", sector: "Finanzen" },
  { symbol: "BRK-B", label: "Berkshire Hathaway B", sector: "Holding" },
  { symbol: "JNJ", label: "Johnson & Johnson", sector: "Pharma" },
  { symbol: "LLY", label: "Eli Lilly", sector: "Pharma" },
  { symbol: "NVO", label: "Novo Nordisk (ADR)", sector: "Pharma" },
  { symbol: "UNH", label: "UnitedHealth", sector: "Gesundheit" },
  { symbol: "PG", label: "Procter & Gamble", sector: "Konsum defensiv" },
  { symbol: "KO", label: "Coca-Cola", sector: "Konsum defensiv" },
  { symbol: "PEP", label: "PepsiCo", sector: "Konsum defensiv" },
  { symbol: "WMT", label: "Walmart", sector: "Handel" },
  { symbol: "MCD", label: "McDonald's", sector: "Konsum" },
  { symbol: "NKE", label: "Nike", sector: "Konsum" },
  { symbol: "XOM", label: "ExxonMobil", sector: "Energie" },
  { symbol: "CVX", label: "Chevron", sector: "Energie" },
  { symbol: "CAT", label: "Caterpillar", sector: "Industrie" },
  { symbol: "LMT", label: "Lockheed Martin", sector: "Rüstung" },
  { symbol: "RTX", label: "RTX", sector: "Rüstung" },
  { symbol: "SPY", label: "S&P 500 ETF (SPY)", sector: "ETF breit" },
  { symbol: "QQQ", label: "Nasdaq 100 ETF (QQQ)", sector: "ETF Tech" },
  { symbol: "GLD", label: "Gold ETF (GLD)", sector: "ETF Gold" },
  { symbol: "TLT", label: "US-Anleihen 20y ETF (TLT)", sector: "ETF Anleihen" },
]

/** Benchmark: stures 15€/Tag in den MSCI World — das muss die KI erstmal schlagen. */
export const BENCHMARK = { symbol: "URTH", label: "iShares MSCI World (Benchmark)" }

export const DAILY_BUDGET_EUR = 15

/** regularMarketPrice aus der Yahoo-Chart-Antwort ziehen (defensiv gegen Format-Drift). */
export function extractYahooPrice(json: unknown): number | null {
  const meta = (
    json as { chart?: { result?: { meta?: { regularMarketPrice?: unknown } }[] } }
  )?.chart?.result?.[0]?.meta
  const p = meta?.regularMarketPrice
  return typeof p === "number" && isFinite(p) && p > 0 ? p : null
}

async function fetchQuote(symbol: string): Promise<number | null> {
  try {
    const res = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=1d&interval=1d`,
      { headers: { "User-Agent": "Mozilla/5.0" }, cache: "no-store" }
    )
    if (!res.ok) return null
    return extractYahooPrice(await res.json())
  } catch {
    return null
  }
}

/** Aktuelle Kurse, ein Request pro Symbol, in 8er-Gruppen (Rate-Limit-freundlich). */
export async function fetchQuotes(symbols: string[]): Promise<Map<string, number>> {
  const map = new Map<string, number>()
  for (let i = 0; i < symbols.length; i += 8) {
    const chunk = symbols.slice(i, i + 8)
    const prices = await Promise.all(chunk.map((s) => fetchQuote(s)))
    chunk.forEach((s, j) => {
      if (prices[j]) map.set(s, prices[j]!)
    })
  }
  return map
}

/** EUR/USD-Kurs (wie viele USD ein EUR kostet). Fallback 1.08, wenn Yahoo klemmt. */
export async function fetchEurUsd(): Promise<number> {
  const p = await fetchQuote("EURUSD=X")
  return p && p > 0.5 && p < 2 ? p : 1.08
}

/** Wirtschafts-News-Schlagzeilen aus offenen RSS-Feeds (best effort). */
export async function fetchNewsHeadlines(): Promise<string[]> {
  const feeds = [
    "https://www.tagesschau.de/wirtschaft/index~rss2.xml",
    "https://www.cnbc.com/id/100003114/device/rss/rss.html",
    "https://feeds.content.dowjones.io/public/rss/mw_topstories",
  ]
  const headlines: string[] = []
  for (const url of feeds) {
    try {
      const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" }, cache: "no-store" })
      if (!res.ok) continue
      const xml = await res.text()
      const titles = [...xml.matchAll(/<title>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/g)]
        .map((m) => m[1].replace(/<[^>]+>/g, "").trim())
        .filter((t) => t && t.length > 15) // Feed-Titel selbst rausfiltern
        .slice(0, 12)
      headlines.push(...titles)
    } catch {
      // Feed-Ausfall ist ok
    }
  }
  return headlines.slice(0, 35)
}

export type Holding = {
  symbol: string
  label: string
  units: number
  investedEur: number
  isBenchmark: boolean
}

/** Trades zu Positionen aggregieren (KI-Portfolio und Benchmark getrennt). */
export function aggregateHoldings(
  trades: { symbol: string; label: string; units: number; amount_eur: number; is_benchmark: boolean }[]
): Holding[] {
  const map = new Map<string, Holding>()
  for (const t of trades) {
    const key = `${t.is_benchmark ? "b" : "k"}:${t.symbol}`
    const h = map.get(key) ?? {
      symbol: t.symbol,
      label: t.label,
      units: 0,
      investedEur: 0,
      isBenchmark: t.is_benchmark,
    }
    h.units += Number(t.units)
    h.investedEur += Number(t.amount_eur)
    map.set(key, h)
  }
  return [...map.values()].sort((a, b) => b.investedEur - a.investedEur)
}

/** Aktueller EUR-Wert einer Position. */
export function holdingValueEur(h: Holding, quotes: Map<string, number>, eurusd: number): number | null {
  const price = quotes.get(h.symbol)
  if (!price || !eurusd) return null
  return (h.units * price) / eurusd
}
