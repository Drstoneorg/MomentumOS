import { NextResponse } from "next/server"
import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "@/lib/database.types"
import { createAdminClient } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"
import { beatCron } from "@/lib/cronHeartbeat"
import {
  UNIVERSE,
  BENCHMARK,
  DAILY_BUDGET_EUR,
  fetchQuotes,
  fetchEurUsd,
  fetchNewsHeadlines,
  aggregateHoldings,
  judgeVerdict,
  netUnits,
} from "@/lib/trading"
import { critiqueTrades, decideTrades } from "@/lib/ai/trading"
import { sendTelegramBot } from "@/lib/telegramBot"

export const maxDuration = 120

/**
 * TradingOS-Tageslauf — reines PAPER-TRADING (Spielgeld, keine Broker-Anbindung,
 * es wird nie echtes Geld bewegt):
 * 1. News-Schlagzeilen + Kurse + EUR/USD holen
 * 2. DeepSeek verteilt 15€ VIRTUELL auf 1-3 Positionen aus dem fixen Universum
 * 3. Picks + Benchmark-Kauf (15€ MSCI World) als paper_trades speichern
 * 4. Markt-Digest speichern, optional Telegram-Info an den User
 * Läuft nur an US-Handelstagen (Mo-Fr), einmal pro Tag (day-unique).
 */
async function runTradingDay(supabase: SupabaseClient<Database>) {
  await beatCron(supabase, "trading")

  const day = new Date().toISOString().slice(0, 10)
  const weekday = new Date().getUTCDay()
  if (weekday === 0 || weekday === 6) {
    return { skipped: "Wochenende — Börse zu, kein Paper-Kauf" }
  }

  const { data: existing } = await supabase
    .from("trading_digests")
    .select("id")
    .eq("day", day)
    .maybeSingle()
  if (existing) return { skipped: `Lauf für ${day} existiert schon` }

  const [headlines, quotes, eurusd, tradesRes] = await Promise.all([
    fetchNewsHeadlines(),
    fetchQuotes([...UNIVERSE.map((u) => u.symbol), BENCHMARK.symbol]),
    fetchEurUsd(),
    supabase.from("paper_trades").select("symbol, label, units, amount_eur, is_benchmark"),
  ])

  // --- Selbstkritik-Loop: offene Picks nach 7 Tagen am Benchmark messen ---
  const cutoff7 = new Date(Date.now() - 7 * 86400_000).toISOString()
  const [{ data: duePicks }, { data: benchEntries }] = await Promise.all([
    supabase
      .from("paper_trades")
      .select("id, symbol, label, price_usd, thesis, traded_at")
      .eq("is_benchmark", false)
      .eq("verdict", "open")
      .lt("traded_at", cutoff7)
      .limit(8),
    supabase.from("paper_trades").select("price_usd, traded_at").eq("is_benchmark", true),
  ])
  const benchNow = quotes.get(BENCHMARK.symbol)
  const judged: { label: string; thesis: string; deltaPct: number; verdict: "right" | "wrong" }[] = []
  if (benchNow && duePicks?.length) {
    // Benchmark-Einstandskurs vom selben Kauf-Tag als Vergleichsbasis
    const benchByDay = new Map(
      (benchEntries ?? []).map((b) => [b.traded_at.slice(0, 10), Number(b.price_usd)])
    )
    for (const t of duePicks) {
      const nowPrice = quotes.get(t.symbol)
      const benchEntry = benchByDay.get(t.traded_at.slice(0, 10))
      if (!nowPrice || !benchEntry) continue
      const verdict = judgeVerdict(Number(t.price_usd), nowPrice, benchEntry, benchNow)
      await supabase.from("paper_trades").update({ verdict }).eq("id", t.id)
      judged.push({
        label: t.label,
        thesis: t.thesis ?? "",
        deltaPct: (nowPrice / Number(t.price_usd) - benchNow / benchEntry) * 100,
        verdict,
      })
    }
  }

  // Learnings fortschreiben (letzte 10) und in den heutigen Pick-Prompt geben
  let lessons: string[] = []
  const { data: lessonRow } = await supabase
    .from("settings")
    .select("value")
    .eq("key", "trading_learnings")
    .maybeSingle()
  try {
    const parsed =
      typeof lessonRow?.value === "string" ? JSON.parse(lessonRow.value) : lessonRow?.value
    if (Array.isArray(parsed)) lessons = parsed.filter((x): x is string => typeof x === "string")
  } catch {
    /* keine/kaputte Learnings */
  }
  if (judged.length) {
    try {
      const fresh = await critiqueTrades(judged)
      if (fresh.length) {
        lessons = [...fresh, ...lessons].slice(0, 10)
        await supabase
          .from("settings")
          .upsert({ key: "trading_learnings", value: JSON.stringify(lessons) }, { onConflict: "key" })
      }
    } catch {
      /* Kritik optional — Lauf geht weiter */
    }
  }

  const holdings = aggregateHoldings(tradesRes.data ?? []).filter((h) => !h.isBenchmark)
  const decision = await decideTrades({
    headlines,
    quotes,
    holdings: holdings.map((h) => ({ label: h.label, investedEur: h.investedEur })),
    budgetEur: DAILY_BUDGET_EUR,
    lessons,
  })

  // Picks ohne Kurs können nicht "gekauft" werden — Gewicht fällt auf die anderen
  const buyable = decision.picks.filter((p) => quotes.get(p.symbol))
  const weightSum = buyable.reduce((a, p) => a + p.weight, 0) || 1

  const rows = buyable.map((p) => {
    const price = quotes.get(p.symbol)!
    const amountEur = (DAILY_BUDGET_EUR * p.weight) / weightSum
    return {
      symbol: p.symbol,
      label: p.label,
      amount_eur: Math.round(amountEur * 100) / 100,
      price_usd: price,
      eurusd,
      // Kosten-Realismus: fiktive Orderkosten mindern die Stückzahl
      units: netUnits(amountEur, price, eurusd),
      thesis: p.thesis,
      is_benchmark: false,
    }
  })

  // Benchmark: stur 15€ in den MSCI World, gleicher Tag, gleicher Kurs-Stand
  const benchPrice = quotes.get(BENCHMARK.symbol)
  if (benchPrice) {
    rows.push({
      symbol: BENCHMARK.symbol,
      label: BENCHMARK.label,
      amount_eur: DAILY_BUDGET_EUR,
      price_usd: benchPrice,
      eurusd,
      // Benchmark zahlt dieselben fiktiven Orderkosten — fairer Vergleich
      units: netUnits(DAILY_BUDGET_EUR, benchPrice, eurusd),
      thesis: "Benchmark: stumpfer täglicher ETF-Sparplan",
      is_benchmark: true,
    })
  }

  if (rows.length) {
    const { error } = await supabase.from("paper_trades").insert(rows)
    if (error) throw new Error(error.message)
  }

  await supabase.from("trading_digests").insert({
    day,
    digest: decision.digest || "Kein Digest generiert",
    picks: buyable as never,
  })

  if (buyable.length) {
    await sendTelegramBot(
      supabase,
      `📈 <b>TradingOS (Paper)</b> — heute virtuell:\n${buyable
        .map((p) => `• ${p.label}: ${((DAILY_BUDGET_EUR * p.weight) / weightSum).toFixed(2)}€`)
        .join("\n")}\n\nKein echtes Geld — Details unter /trading`
    ).catch(() => {})
  }

  return {
    day,
    picks: buyable.map((p) => ({ symbol: p.symbol, eur: Math.round(((DAILY_BUDGET_EUR * p.weight) / weightSum) * 100) / 100 })),
    benchmark: !!benchPrice,
    headlines: headlines.length,
    reviewed: judged.length,
  }
}

/** Vercel-Cron (Bearer CRON_SECRET). */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET
  if (secret) {
    if (req.headers.get("authorization") !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 })
    }
  }
  try {
    return NextResponse.json(await runTradingDay(createAdminClient()))
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Fehler" }, { status: 500 })
  }
}

/** Manueller Lauf aus der App (eingeloggter User, Button auf /trading).
 *  Nutzt die User-Session statt Admin-Client — RLS erlaubt das und lokal
 *  läuft es auch ohne SUPABASE_SERVICE_ROLE_KEY. */
export async function POST() {
  const userClient = await createClient()
  const { data: auth } = await userClient.auth.getUser()
  if (!auth.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  try {
    return NextResponse.json(await runTradingDay(userClient))
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Fehler" }, { status: 500 })
  }
}
