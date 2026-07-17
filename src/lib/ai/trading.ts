// TradingOS-KI: wählt aus dem fixen Universum die virtuellen Tages-Picks.
// Reines Paper-Trading — die Ausgabe bewegt nie echtes Geld.

import { chatJSON } from "@/lib/ai/deepseek"
import { UNIVERSE } from "@/lib/trading"

export type TradingPick = { symbol: string; label: string; weight: number; thesis: string }
export type TradingDecision = { digest: string; picks: TradingPick[] }

/**
 * Picks validieren und Gewichte auf Summe 1 normieren. Unbekannte Symbole
 * (nicht im Universum) fliegen raus — die KI darf nichts Exotisches erfinden.
 */
export function normalizePicks(raw: unknown): TradingPick[] {
  if (!Array.isArray(raw)) return []
  const bySymbol = new Map(UNIVERSE.map((u) => [u.symbol, u]))
  const picks: TradingPick[] = []
  for (const p of raw as { symbol?: string; weight?: number; thesis?: string }[]) {
    // Ticker-Varianten der KI abfangen: Kleinschreibung, ".US"-Suffix, "$"-Präfix
    const sym = (p.symbol ?? "").toUpperCase().trim().replace(/^\$/, "").replace(/\.US$/, "")
    const u = bySymbol.get(sym)
    if (!u) continue
    if (picks.some((x) => x.symbol === u.symbol)) continue
    picks.push({
      symbol: u.symbol,
      label: u.label,
      weight: Math.max(0, Number(p.weight) || 0),
      thesis: (p.thesis ?? "").slice(0, 400),
    })
    if (picks.length >= 3) break
  }
  const sum = picks.reduce((a, p) => a + p.weight, 0)
  if (!picks.length) return []
  if (sum <= 0) return picks.map((p) => ({ ...p, weight: 1 / picks.length }))
  return picks.map((p) => ({ ...p, weight: p.weight / sum }))
}

/**
 * Selbstkritik-Loop: destilliert aus bewerteten Picks (richtig/falsch vs.
 * Benchmark) maximal 3 kurze, generalisierbare Lehren für künftige Läufe.
 */
export async function critiqueTrades(
  judged: { label: string; thesis: string; deltaPct: number; verdict: "right" | "wrong" }[],
): Promise<string[]> {
  const out = await chatJSON(
    `Du bewertest rückblickend Picks eines Paper-Trading-Experiments (Spielgeld). Destilliere aus Treffern und Fehlgriffen maximal 3 kurze Lehren für künftige Auswahl-Entscheidungen — je 1 Satz, Deutsch, konkret und generalisierbar (Sektor-, News-, Bewertungs-Muster), keine Binsenweisheiten wie "diversifizieren ist gut". Antworte NUR als JSON: {"lessons":["..."]}`,
    judged
      .map(
        (j) =>
          `${j.label}: ${j.verdict === "right" ? "RICHTIG" : "FALSCH"} (${j.deltaPct >= 0 ? "+" : ""}${j.deltaPct.toFixed(1)} Prozentpunkte vs. Benchmark) — These war: ${j.thesis || "keine"}`,
      )
      .join("\n"),
    "trading_review",
  )
  try {
    const parsed = JSON.parse(out) as { lessons?: unknown }
    if (!Array.isArray(parsed.lessons)) return []
    return parsed.lessons
      .filter((l): l is string => typeof l === "string" && l.trim().length > 0)
      .map((l) => l.trim().slice(0, 200))
      .slice(0, 3)
  } catch {
    return []
  }
}

export async function decideTrades(input: {
  headlines: string[]
  quotes: Map<string, number>
  holdings: { label: string; investedEur: number }[]
  budgetEur: number
  lessons?: string[]
}): Promise<TradingDecision> {
  const quoteTable = UNIVERSE.map((u) => {
    const q = input.quotes.get(u.symbol)
    return `${u.symbol} | ${u.label} | ${u.sector} | ${q ? `$${q}` : "kein Kurs"}`
  }).join("\n")

  const out = await chatJSON(
    `Du bist Analyst in einem PAPER-TRADING-Experiment (Spielgeld, kein echtes Geld). Du verteilst heute ${input.budgetEur}€ virtuell auf 1-3 Positionen aus einem FIXEN Universum.
Antworte NUR als JSON:
{"digest":"8-12 Sätze Markt- und Weltlage auf Deutsch: was bewegt die Märkte heute, welche Themen/Risiken, was folgt daraus für die Auswahl","picks":[{"symbol":"AAPL","weight":0.6,"thesis":"2-3 Sätze konkrete Begründung mit Bezug auf die News"}]}
Regeln:
- NUR Symbole aus der Liste unten, exakt wie geschrieben. Maximal 3 Picks.
- Denke in Wahrscheinlichkeiten und Diversifikation, nicht in Garantien. Bei unklarer Lage sind breite ETFs (SPY, QQQ) oder Defensives legitim.
- thesis muss auf konkrete Schlagzeilen oder Bewertungslogik verweisen, keine Floskeln.
- Berücksichtige das bestehende Portfolio: Klumpenrisiko vermeiden.`,
    `HEUTIGE SCHLAGZEILEN:\n${input.headlines.map((h) => `- ${h}`).join("\n") || "- keine Feeds erreichbar, entscheide nach Bewertungs- und Diversifikationslogik"}\n\nUNIVERSUM (symbol | Name | Sektor | letzter Kurs):\n${quoteTable}\n\nBESTEHENDES PAPER-PORTFOLIO:\n${
      input.holdings.map((h) => `- ${h.label}: ${h.investedEur.toFixed(0)}€ investiert`).join("\n") || "- noch leer"
    }${
      input.lessons?.length
        ? `\n\nLEHREN AUS DER RÜCKBLICK-BEWERTUNG FRÜHERER PICKS (beachten):\n${input.lessons.map((l) => `- ${l}`).join("\n")}`
        : ""
    }`,
    "trading_picks"
  )
  const parsed = JSON.parse(out) as { digest?: string; picks?: unknown }
  return {
    digest: (parsed.digest ?? "").slice(0, 4000),
    picks: normalizePicks(parsed.picks),
  }
}
