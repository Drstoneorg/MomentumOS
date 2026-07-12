import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "@/lib/database.types"

type DB = SupabaseClient<Database>

/**
 * Outcome-Loop: misst, welche gesendeten Vorschläge echte Antworten bekommen.
 *
 * - Beim Extension-Sync werden neue ausgehende Nachrichten gegen offene
 *   Vorschlags-Varianten gematcht → Vorschlag gilt als gesendet (welcher Stil,
 *   wann), ohne dass der User etwas markieren muss.
 * - Neue eingehende Nachrichten setzen replied_at auf dem letzten gesendeten
 *   Vorschlag ohne Antwort → Antwortquote pro Stil/Sendezeit wird messbar.
 * - outcomeHints() fasst die Quoten als Prompt-Baustein zusammen, sobald genug
 *   Daten da sind — die KI lernt aus echten Ergebnissen statt nur Daumen.
 */

const norm = (s: string) =>
  s.toLowerCase().replace(/\s+/g, " ").replace(/[.!?…]+$/g, "").trim()

/** Ausgehende Nachrichten gegen offene Vorschläge matchen → auto als gesendet markieren. */
export async function matchSentSuggestions(
  supabase: DB,
  contactId: string,
  outgoing: { content: string; at: string }[]
) {
  if (!outgoing.length) return
  const { data: open } = await supabase
    .from("suggestions")
    .select("id, variants")
    .eq("contact_id", contactId)
    .in("status", ["draft", "approved"])
  if (!open?.length) return

  for (const s of open) {
    const variants = (s.variants ?? {}) as Record<string, string>
    for (const [style, text] of Object.entries(variants)) {
      if (typeof text !== "string" || !text.trim()) continue
      const hit = outgoing.find((m) => norm(m.content) === norm(text))
      if (hit) {
        await supabase
          .from("suggestions")
          .update({ status: "sent", sent_at: hit.at, chosen_variant: style })
          .eq("id", s.id)
        break
      }
    }
  }
}

/** Eingehende Nachricht = Antwort auf den letzten gesendeten Vorschlag ohne Antwort. */
export async function markSuggestionReplied(
  supabase: DB,
  contactId: string,
  inboundAt: string
) {
  const windowStart = new Date(new Date(inboundAt).getTime() - 14 * 86400_000).toISOString()
  const { data: last } = await supabase
    .from("suggestions")
    .select("id, sent_at")
    .eq("contact_id", contactId)
    .eq("status", "sent")
    .is("replied_at", null)
    .not("sent_at", "is", null)
    .gte("sent_at", windowStart)
    .lte("sent_at", inboundAt)
    .order("sent_at", { ascending: false })
    .limit(1)
    .maybeSingle()
  if (last) {
    await supabase.from("suggestions").update({ replied_at: inboundAt }).eq("id", last.id)
  }
}

export type OutcomeStats = {
  totalSent: number
  byStyle: { style: string; sent: number; replied: number; rate: number }[]
  byDaypart: { part: string; sent: number; replied: number; rate: number }[]
}

const DAYPARTS: [string, number, number][] = [
  ["Vormittag", 5, 12],
  ["Nachmittag", 12, 18],
  ["Abend", 18, 23],
  ["Nachts", 23, 29], // 23-05 Uhr (Stunde+24 für Wrap)
]

export async function outcomeStats(supabase: DB): Promise<OutcomeStats> {
  const { data } = await supabase
    .from("suggestions")
    .select("chosen_variant, sent_at, replied_at")
    .eq("status", "sent")
    .not("sent_at", "is", null)
    .order("sent_at", { ascending: false })
    .limit(500)

  const styleMap = new Map<string, { sent: number; replied: number }>()
  const partMap = new Map<string, { sent: number; replied: number }>()
  for (const s of data ?? []) {
    const replied = s.replied_at != null
    if (s.chosen_variant) {
      const e = styleMap.get(s.chosen_variant) ?? { sent: 0, replied: 0 }
      e.sent++
      if (replied) e.replied++
      styleMap.set(s.chosen_variant, e)
    }
    const h = new Date(s.sent_at!).getHours()
    const part = DAYPARTS.find(([, from, to]) => h >= from && h < to)?.[0]
      ?? DAYPARTS.find(([, from, to]) => h + 24 >= from && h + 24 < to)?.[0]
    if (part) {
      const e = partMap.get(part) ?? { sent: 0, replied: 0 }
      e.sent++
      if (replied) e.replied++
      partMap.set(part, e)
    }
  }
  const toList = (m: Map<string, { sent: number; replied: number }>) =>
    [...m.entries()]
      .map(([k, v]) => ({ style: k, part: k, ...v, rate: v.sent ? v.replied / v.sent : 0 }))
      .sort((a, b) => b.rate - a.rate)
  return {
    totalSent: data?.length ?? 0,
    byStyle: toList(styleMap),
    byDaypart: toList(partMap),
  }
}

/**
 * Prompt-Baustein aus gemessenen Quoten. Erst ab 10 gesendeten Vorschlägen
 * und mindestens 2 Stilen mit je 3+ Sendungen — vorher wäre es Rauschen.
 */
export function outcomeHints(stats: OutcomeStats): string | null {
  const solid = stats.byStyle.filter((s) => s.sent >= 3)
  if (stats.totalSent < 10 || solid.length < 2) return null
  const styleLine = solid
    .map((s) => `${s.style} ${Math.round(s.rate * 100)}% (${s.replied}/${s.sent})`)
    .join(", ")
  const bestPart = stats.byDaypart.filter((p) => p.sent >= 5)[0]
  return [
    `Gemessene Antwortquoten meiner tatsächlich gesendeten Nachrichten nach Stil: ${styleLine}.`,
    `Stile mit hoher Quote funktionieren nachweislich — orientiere alle Varianten leicht an deren Tonlage, liefere aber weiterhin jeden Stil.`,
    bestPart
      ? `Beste gemessene Sendezeit: ${bestPart.part} (${Math.round(bestPart.rate * 100)}% Antwortquote).`
      : null,
  ]
    .filter(Boolean)
    .join(" ")
}
