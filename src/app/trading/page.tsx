import { createClient } from "@/lib/supabase/server"
import { Card } from "@/components/ui"
import {
  UNIVERSE,
  BENCHMARK,
  fetchQuotes,
  fetchEurUsd,
  aggregateHoldings,
  holdingValueEur,
} from "@/lib/trading"
import { RunNowButton } from "./RunNowButton"
import type { TradingPick } from "@/lib/ai/trading"

export const dynamic = "force-dynamic"

const eur = (n: number) =>
  n.toLocaleString("de-DE", { style: "currency", currency: "EUR", maximumFractionDigits: 2 })

export default async function TradingPage() {
  const supabase = await createClient()
  const [tradesRes, digestsRes] = await Promise.all([
    supabase.from("paper_trades").select("*").order("traded_at", { ascending: false }),
    supabase.from("trading_digests").select("*").order("day", { ascending: false }).limit(7),
  ])

  const trades = tradesRes.data ?? []
  const holdings = aggregateHoldings(trades)
  const kiHoldings = holdings.filter((h) => !h.isBenchmark)
  const benchHoldings = holdings.filter((h) => h.isBenchmark)

  // Live-Bewertung nur für gehaltene Symbole (spart Requests)
  const heldSymbols = [...new Set(holdings.map((h) => h.symbol))]
  const [quotes, eurusd] = heldSymbols.length
    ? await Promise.all([fetchQuotes(heldSymbols), fetchEurUsd()])
    : [new Map<string, number>(), 1]

  function portfolioSum(list: typeof holdings) {
    let invested = 0
    let value = 0
    let complete = true
    for (const h of list) {
      invested += h.investedEur
      const v = holdingValueEur(h, quotes, eurusd)
      if (v == null) complete = false
      else value += v
    }
    return { invested, value, complete }
  }
  const ki = portfolioSum(kiHoldings)
  const bench = portfolioSum(benchHoldings)
  const pct = (s: { invested: number; value: number }) =>
    s.invested > 0 ? ((s.value - s.invested) / s.invested) * 100 : 0

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-xl font-bold">📈 TradingOS</h1>
        <span className="rounded-full bg-violet-950 px-2 py-0.5 text-xs font-semibold text-violet-300">
          Paper-Trading-Labor
        </span>
        <div className="ml-auto">
          <RunNowButton />
        </div>
      </div>

      <div className="rounded-xl border border-amber-900/60 bg-amber-950/20 p-3 text-xs text-amber-200/90">
        <strong>Spielgeld-Experiment, kein echtes Geld.</strong> Die KI investiert täglich 15 €
        virtuell und begründet jeden Pick — parallel läuft ein stumpfer 15-€-Sparplan in den
        MSCI World als Benchmark. Das ist keine Anlageberatung: Kein System schlägt zuverlässig
        den Markt, und dieses Labor soll genau das messbar machen. Echte Käufe machst du, wenn
        überhaupt, selbst bei deinem Broker.
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card title="🧠 KI-Portfolio">
          <p className="text-2xl font-bold text-white">{eur(ki.value)}</p>
          <p className="text-sm text-zinc-400">
            {eur(ki.invested)} investiert ·{" "}
            <span className={pct(ki) >= 0 ? "text-emerald-400" : "text-rose-400"}>
              {pct(ki) >= 0 ? "+" : ""}
              {pct(ki).toFixed(2)}%
            </span>
            {!ki.complete && " · Kurse teils nicht abrufbar"}
          </p>
        </Card>
        <Card title={`🐢 Benchmark (${BENCHMARK.label})`}>
          <p className="text-2xl font-bold text-white">{eur(bench.value)}</p>
          <p className="text-sm text-zinc-400">
            {eur(bench.invested)} investiert ·{" "}
            <span className={pct(bench) >= 0 ? "text-emerald-400" : "text-rose-400"}>
              {pct(bench) >= 0 ? "+" : ""}
              {pct(bench).toFixed(2)}%
            </span>
          </p>
          {ki.invested > 0 && bench.invested > 0 && (
            <p className="mt-1 text-xs font-medium">
              {pct(ki) > pct(bench) ? (
                <span className="text-emerald-400">KI liegt {(pct(ki) - pct(bench)).toFixed(2)} Punkte vorn</span>
              ) : pct(ki) < pct(bench) ? (
                <span className="text-amber-400">ETF liegt {(pct(bench) - pct(ki)).toFixed(2)} Punkte vorn</span>
              ) : (
                <span className="text-zinc-400">Gleichstand</span>
              )}
            </p>
          )}
        </Card>
      </div>

      {kiHoldings.length > 0 && (
        <Card title="Positionen (KI)">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="text-left text-zinc-500">
                <tr>
                  <th className="py-1">Position</th>
                  <th className="py-1 text-right">Investiert</th>
                  <th className="py-1 text-right">Wert jetzt</th>
                  <th className="py-1 text-right">+/-</th>
                </tr>
              </thead>
              <tbody>
                {kiHoldings.map((h) => {
                  const v = holdingValueEur(h, quotes, eurusd)
                  const p = v != null && h.investedEur > 0 ? ((v - h.investedEur) / h.investedEur) * 100 : null
                  return (
                    <tr key={h.symbol} className="border-t border-zinc-800/60">
                      <td className="py-1 text-zinc-200">{h.label}</td>
                      <td className="py-1 text-right text-zinc-400">{eur(h.investedEur)}</td>
                      <td className="py-1 text-right text-zinc-200">{v != null ? eur(v) : "—"}</td>
                      <td className={`py-1 text-right ${p == null ? "text-zinc-500" : p >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                        {p != null ? `${p >= 0 ? "+" : ""}${p.toFixed(2)}%` : "—"}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <Card title="📰 Tages-Digests (Weltlage + Picks)">
        {(digestsRes.data ?? []).length === 0 && (
          <p className="text-sm text-zinc-500">
            Noch kein Lauf — oben „Tageslauf jetzt" drücken oder auf den Werktags-Cron warten.
          </p>
        )}
        <ul className="space-y-4">
          {(digestsRes.data ?? []).map((d) => {
            const picks = (d.picks as TradingPick[] | null) ?? []
            return (
              <li key={d.id} className="rounded-xl border border-zinc-800 p-3">
                <p className="text-xs font-semibold text-violet-300">
                  {new Date(d.day).toLocaleDateString("de-DE", { weekday: "long", day: "2-digit", month: "2-digit" })}
                </p>
                <p className="mt-1 whitespace-pre-wrap text-sm text-zinc-300">{d.digest}</p>
                {picks.length > 0 && (
                  <ul className="mt-2 space-y-1">
                    {picks.map((p) => (
                      <li key={p.symbol} className="text-xs">
                        <span className="font-medium text-white">{p.label}</span>
                        <span className="text-zinc-500"> ({Math.round(p.weight * 100)}%)</span>
                        <span className="text-zinc-400"> — {p.thesis}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            )
          })}
        </ul>
      </Card>

      <Card title={`Universum (${UNIVERSE.length} Werte, fix)`}>
        <p className="mb-2 text-xs text-zinc-500">
          Die KI darf nur aus dieser Liste wählen — liquide US-gelistete Aktien und ETFs, damit
          Kurse zuverlässig und kostenlos abrufbar sind.
        </p>
        <div className="flex flex-wrap gap-1">
          {UNIVERSE.map((u) => (
            <span key={u.symbol} className="rounded-full bg-zinc-800 px-2 py-0.5 text-xs text-zinc-300" title={u.sector}>
              {u.label}
            </span>
          ))}
        </div>
      </Card>
    </div>
  )
}
